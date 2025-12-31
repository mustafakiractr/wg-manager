"""
Authentication API endpoint'leri
Kullanıcı giriş ve token yenileme işlemleri
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, field_validator
from datetime import timedelta
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.database.database import get_db
from app.models.user import User
from app.security.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    get_current_user
)
from app.security.lockout import (
    is_account_locked,
    record_failed_login,
    reset_failed_login_attempts,
    get_remaining_lockout_time
)
from app.security.session_manager import create_session
from app.config import settings
from app.services.log_service import create_log
from app.services.notification_service import notify_user_login
from app.utils.ip_helper import get_client_ip
from app.utils.activity_logger import log_auth

router = APIRouter()
security_scheme = HTTPBearer()
limiter = Limiter(key_func=get_remote_address)

# Brute force saldırılarını önlemek için login rate limiti
LOGIN_RATE_LIMIT = f"{settings.RATE_LIMIT_LOGIN}/minute"


class LoginRequest(BaseModel):
    """Giriş isteği modeli"""
    username: str
    password: str

    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        """Username validasyonu"""
        # Whitespace trim
        v = v.strip()

        # Uzunluk kontrolü
        if len(v) < 3 or len(v) > 50:
            raise ValueError("Kullanıcı adı 3-50 karakter olmalıdır")

        # İzin verilen karakterler: alfanumerik, alt çizgi, tire
        import re
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError("Kullanıcı adı sadece harf, rakam, alt çizgi ve tire içerebilir")

        return v

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        """Password validasyonu"""
        # Uzunluk kontrolü (bcrypt 72 byte limiti)
        if len(v) < 6:
            raise ValueError("Şifre en az 6 karakter olmalıdır")
        if len(v.encode('utf-8')) > 72:
            raise ValueError("Şifre çok uzun (maksimum 72 byte)")

        return v


class TokenResponse(BaseModel):
    """Token yanıt modeli"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    requires_2fa: bool = False  # 2FA gerekiyorsa True


class TwoFactorRequiredResponse(BaseModel):
    """2FA gerekli yanıt modeli"""
    requires_2fa: bool = True
    pending_token: str  # Geçici token (sadece 2FA verify için kullanılabilir)


class RefreshTokenRequest(BaseModel):
    """Token yenileme isteği modeli"""
    refresh_token: str


class TwoFactorVerifyRequest(BaseModel):
    """2FA doğrulama isteği modeli"""
    pending_token: str
    code: str


@router.post("/login")
@limiter.limit("5/minute")  # Dakikada 5 login denemesi
async def login(
    request: Request,
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Kullanıcı giriş endpoint'i
    Username ve password ile giriş yapar
    2FA aktifse pending token, değilse JWT token döner
    """
    # Kullanıcıyı bul
    result = await db.execute(select(User).where(User.username == login_data.username))
    user = result.scalar_one_or_none()

    # Kullanıcı bulunamazsa veya şifre yanlışsa
    if not user or not verify_password(login_data.password, user.hashed_password):
        # Kullanıcı varsa failed login kaydet
        if user:
            is_locked, locked_until = await record_failed_login(db, user)
            # Activity log: Başarısız giriş
            await log_auth(db, request, "login_failed", f"Kullanıcı '{user.username}' için başarısız giriş denemesi", user, 'failure')
            if is_locked:
                remaining_minutes = get_remaining_lockout_time(user)
                # Activity log: Hesap kilitlendi
                await log_auth(db, request, "account_locked", f"Hesap '{user.username}' çok fazla başarısız deneme nedeniyle kilitlendi", user, 'error')
                raise HTTPException(
                    status_code=status.HTTP_423_LOCKED,
                    detail=f"Çok fazla başarısız deneme. Hesap {remaining_minutes} dakika süreyle kilitlendi."
                )
        else:
            # Kullanıcı bulunamadı
            await log_auth(db, request, "login_failed", f"Bilinmeyen kullanıcı adı ile giriş denemesi: '{login_data.username}'", success='failure')

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı adı veya şifre hatalı"
        )

    # Hesap kilitli mi kontrol et
    is_locked, locked_until = is_account_locked(user)
    if is_locked:
        remaining_minutes = get_remaining_lockout_time(user)
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Hesap kilitli. Kalan süre: {remaining_minutes} dakika"
        )

    # Hesap aktif mi?
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kullanıcı hesabı aktif değil"
        )

    # Başarılı login - failed attempts sıfırla
    await reset_failed_login_attempts(db, user)

    # 2FA aktif mi kontrol et
    if user.two_factor_enabled:
        # Geçici token oluştur (sadece 2FA verify için geçerli)
        from datetime import datetime, timedelta
        from jose import jwt

        pending_token_data = {
            "sub": user.username,
            "type": "pending_2fa",
            "exp": utcnow() + timedelta(minutes=5)  # 5 dakika geçerli
        }
        pending_token = jwt.encode(
            pending_token_data,
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM
        )

        return TwoFactorRequiredResponse(pending_token=pending_token)

    # 2FA yoksa normal token ve session oluştur
    access_token = create_access_token(data={"sub": user.username})
    refresh_token = create_refresh_token(data={"sub": user.username})

    # Session oluştur
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "Unknown")
    await create_session(
        db=db,
        user_id=user.id,
        ip_address=client_ip,
        user_agent=user_agent,
        remember_me=False,  # TODO: Frontend'den remember_me parametresi alınabilir
        refresh_token=refresh_token
    )

    # Activity log: Başarılı giriş
    await log_auth(db, request, "login", f"Kullanıcı '{user.username}' başarıyla giriş yaptı", user, 'success')

    # Bildirim gönder - hata olursa devam et
    try:
        await notify_user_login(
            db=db,
            user_id=user.id,
            ip_address=client_ip,
            username=user.username
        )
    except Exception as notif_error:
        # Bildirim hatası login'i etkilememeli
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"⚠️ Login bildirimi gönderilemedi (login başarılı): {notif_error}")

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token
    )


@router.post("/verify-2fa", response_model=TokenResponse)
@limiter.limit("10/minute")  # Dakikada 10 deneme
async def verify_two_factor_login(
    request: Request,
    verify_data: TwoFactorVerifyRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    2FA kodunu doğrular ve gerçek token'ları döner
    """
    from jose import jwt, JWTError

    # Pending token'ı decode et
    try:
        payload = jwt.decode(
            verify_data.pending_token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        username: str = payload.get("sub")
        token_type: str = payload.get("type")

        if username is None or token_type != "pending_2fa":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Geçersiz token"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya süresi dolmuş token"
        )

    # Kullanıcıyı bul
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()

    if not user or not user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA etkin değil"
        )

    # TOTP kodu doğrula
    from app.security.two_factor import verify_totp_code, verify_backup_code

    is_valid = verify_totp_code(user.totp_secret, verify_data.code)
    used_backup = False

    if not is_valid:
        # Belki yedek kod mu?
        if user.backup_codes:
            is_valid, updated_codes = verify_backup_code(
                verify_data.code,
                user.backup_codes
            )

            if is_valid:
                # Yedek kod kullanıldı, güncelle
                await db.execute(
                    update(User)
                    .where(User.id == user.id)
                    .values(backup_codes=updated_codes)
                )
                await db.commit()
                used_backup = True

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz 2FA kodu"
        )

    # Token'lar oluştur
    access_token = create_access_token(data={"sub": user.username})
    refresh_token = create_refresh_token(data={"sub": user.username})

    # Session oluştur
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "Unknown")
    await create_session(
        db=db,
        user_id=user.id,
        ip_address=client_ip,
        user_agent=user_agent,
        remember_me=False,
        refresh_token=refresh_token
    )

    # Activity log: 2FA ile başarılı giriş (log_auth ile halledilecek)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_data: RefreshTokenRequest
):
    """
    Refresh token ile yeni access token alır
    """
    from jose import jwt, JWTError

    try:
        payload = jwt.decode(
            refresh_data.refresh_token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        username: str = payload.get("sub")
        token_type: str = payload.get("type")

        if username is None or token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Geçersiz refresh token"
            )

        # Yeni token'lar oluştur
        access_token = create_access_token(data={"sub": username})
        new_refresh_token = create_refresh_token(data={"sub": username})

        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz refresh token"
        )


@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    Mevcut kullanıcı bilgilerini döner
    """
    return {
        "success": True,
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "is_admin": current_user.is_admin,
            "two_factor_enabled": current_user.two_factor_enabled
        }
    }


