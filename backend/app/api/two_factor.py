"""
Two-Factor Authentication (2FA) API endpoint'leri
TOTP kurulum, doğrulama ve yedek kod yönetimi
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from typing import List
import json

from app.database.database import get_db
from app.models.user import User
from app.security.auth import get_current_user, verify_password
from app.security.two_factor import (
    generate_totp_secret,
    get_totp_uri,
    generate_qr_code,
    verify_totp_code,
    generate_backup_codes,
    verify_backup_code,
    has_backup_codes
)
from app.services.log_service import create_log
from app.utils.ip_helper import get_client_ip

router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================

class SetupTwoFactorResponse(BaseModel):
    """2FA kurulum yanıtı"""
    secret: str
    qr_code: str
    manual_entry_key: str


class EnableTwoFactorRequest(BaseModel):
    """2FA etkinleştirme isteği"""
    code: str
    password: str  # Güvenlik için kullanıcının şifresini de iste


class VerifyTwoFactorRequest(BaseModel):
    """2FA doğrulama isteği"""
    code: str


class DisableTwoFactorRequest(BaseModel):
    """2FA devre dışı bırakma isteği"""
    password: str


class BackupCodesResponse(BaseModel):
    """Yedek kodlar yanıtı"""
    codes: List[str]
    remaining: int


class TwoFactorStatusResponse(BaseModel):
    """2FA durum yanıtı"""
    enabled: bool
    has_backup_codes: bool
    backup_codes_remaining: int


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/setup", response_model=SetupTwoFactorResponse)
async def setup_two_factor(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    2FA kurulumu için QR kod ve secret üretir
    Secret'ı veritabanına kaydeder ama henüz etkinleştirmez
    """
    # Yeni secret üret
    secret = generate_totp_secret()

    # Secret'ı veritabanına kaydet (henüz enabled=False)
    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(totp_secret=secret)
    )
    await db.commit()

    # QR kod URI oluştur
    uri = get_totp_uri(secret, current_user.username)

    # QR kod base64 image oluştur
    qr_code = generate_qr_code(uri)

    return SetupTwoFactorResponse(
        secret=secret,
        qr_code=qr_code,
        manual_entry_key=secret  # Kullanıcı manuel girerse diye
    )


@router.post("/enable", response_model=BackupCodesResponse)
async def enable_two_factor(
    request: Request,
    data: EnableTwoFactorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    2FA'yı etkinleştirir
    TOTP kodunu ve şifreyi doğrular, ardından yedek kodlar üretir
    """
    # 2FA zaten aktif mi?
    if current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA zaten etkinleştirilmiş"
        )

    # Secret var mı? (setup endpoint'i çağrılmış mı?)
    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Önce /setup endpoint'ini çağırarak 2FA kurulumunu başlatın"
        )

    # Şifreyi kontrol et (güvenlik)
    if not verify_password(data.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Şifre hatalı"
        )

    # TOTP kodunu doğrula
    if not verify_totp_code(current_user.totp_secret, data.code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz 2FA kodu"
        )

    # Yedek kodlar üret
    plain_codes, hashed_codes = generate_backup_codes(count=10)

    # 2FA'yı etkinleştir ve yedek kodları kaydet
    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(
            two_factor_enabled=True,
            backup_codes=json.dumps(hashed_codes)
        )
    )
    await db.commit()

    # Log kaydı
    client_ip = get_client_ip(request)
    await create_log(db, current_user.username, "2fa_enabled", ip_address=client_ip)

    # Yedek kodları döndür (bir kez gösterilecek!)
    return BackupCodesResponse(
        codes=plain_codes,
        remaining=len(plain_codes)
    )


@router.post("/disable")
async def disable_two_factor(
    request: Request,
    data: DisableTwoFactorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    2FA'yı devre dışı bırakır
    Şifre doğrulaması gerektirir
    """
    # 2FA zaten kapalı mı?
    if not current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA zaten devre dışı"
        )

    # Şifreyi kontrol et
    if not verify_password(data.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Şifre hatalı"
        )

    # 2FA'yı kapat
    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(
            two_factor_enabled=False,
            totp_secret=None,
            backup_codes=None
        )
    )
    await db.commit()

    # Log kaydı
    client_ip = get_client_ip(request)
    await create_log(db, current_user.username, "2fa_disabled", ip_address=client_ip)

    return {"success": True, "message": "2FA devre dışı bırakıldı"}


@router.post("/verify")
async def verify_two_factor(
    data: VerifyTwoFactorRequest,
    current_user: User = Depends(get_current_user)
):
    """
    2FA kodunu doğrular (login sonrası kullanılır)
    """
    # 2FA etkin mi kontrol et
    if not current_user.two_factor_enabled or not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA etkin değil"
        )

    # TOTP kodu doğrula
    is_valid = verify_totp_code(current_user.totp_secret, data.code)

    if not is_valid:
        # Belki yedek kod mu?
        if current_user.backup_codes:
            is_backup_valid, updated_codes = verify_backup_code(
                data.code,
                current_user.backup_codes
            )

            if is_backup_valid:
                # Yedek kod kullanıldı, güncelle
                # Bu kısım LoginRequest'te yapılmalı
                return {"success": True, "method": "backup_code"}

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz kod"
        )

    return {"success": True, "method": "totp"}


@router.post("/backup-codes", response_model=BackupCodesResponse)
async def regenerate_backup_codes(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Yeni yedek kodlar üretir (eski kodlar geçersiz olur)
    """
    # 2FA etkin mi kontrol et
    if not current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA etkin değil"
        )

    # Yeni yedek kodlar üret
    plain_codes, hashed_codes = generate_backup_codes(count=10)

    # Veritabanına kaydet
    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(backup_codes=json.dumps(hashed_codes))
    )
    await db.commit()

    # Log kaydı
    client_ip = get_client_ip(request)
    await create_log(db, current_user.username, "2fa_backup_codes_regenerated", ip_address=client_ip)

    return BackupCodesResponse(
        codes=plain_codes,
        remaining=len(plain_codes)
    )


@router.get("/status", response_model=TwoFactorStatusResponse)
async def get_two_factor_status(
    current_user: User = Depends(get_current_user)
):
    """
    Kullanıcının 2FA durumunu döner
    """
    backup_codes_count = 0
    if current_user.backup_codes:
        try:
            codes = json.loads(current_user.backup_codes)
            backup_codes_count = len(codes)
        except (json.JSONDecodeError, TypeError):
            pass

    return TwoFactorStatusResponse(
        enabled=current_user.two_factor_enabled,
        has_backup_codes=backup_codes_count > 0,
        backup_codes_remaining=backup_codes_count
    )
