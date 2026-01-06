"""
JWT authentication ve password hashing fonksiyonları
Kullanıcı giriş ve token yönetimi için güvenlik fonksiyonları
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.database.database import get_db
from app.models.user import User
from app.utils.datetime_helper import utcnow
import logging

# WebSocket exception (FastAPI doesn't have WebSocketException in older versions)
class WebSocketException(Exception):
    """Custom WebSocket exception"""
    def __init__(self, code: int, reason: str):
        self.code = code
        self.reason = reason
        super().__init__(reason)

# Logger
logger = logging.getLogger(__name__)

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTP Bearer token scheme
security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Düz metin şifreyi hash ile karşılaştırır
    
    Args:
        plain_password: Kullanıcının girdiği şifre
        hashed_password: Veritabanındaki hash'lenmiş şifre
    
    Returns:
        Şifreler eşleşirse True
    """
    # bcrypt versiyonu sorununu önlemek için doğrudan bcrypt kullan
    import bcrypt
    try:
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        # Fallback olarak passlib kullan
        return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Şifreyi hash'ler
    Bcrypt'in 72 byte limiti nedeniyle şifreyi kontrol eder ve gerekirse kısaltır

    Args:
        password: Hash'lenecek şifre

    Returns:
        Hash'lenmiş şifre
    """
    # bcrypt versiyonu sorununu önlemek için doğrudan bcrypt kullan
    import bcrypt

    # Şifreyi bytes'a çevir
    password_bytes = password.encode('utf-8')

    # Bcrypt'in 72 byte limiti için kontrol et ve gerekirse kısalt
    if len(password_bytes) > 72:
        # 72 byte'a kısalt (bcrypt limiti)
        # UYARI: Tekrar encode etmeyin, direkt kısaltılmış byte array'i kullanın
        password_bytes = password_bytes[:72]

    # Hash'le
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    JWT access token oluşturur
    
    Args:
        data: Token içine eklenecek veri (genelde username)
        expires_delta: Token geçerlilik süresi
    
    Returns:
        JWT token string
    """
    to_encode = data.copy()
    if expires_delta:
        expire = utcnow() + expires_delta
    else:
        expire = utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """
    JWT refresh token oluşturur
    
    Args:
        data: Token içine eklenecek veri
    
    Returns:
        JWT refresh token string
    """
    to_encode = data.copy()
    expire = utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    JWT token'dan kullanıcı bilgisini çıkarır ve döner
    Protected endpoint'lerde kullanılır
    
    Args:
        credentials: HTTP Bearer token
        db: Veritabanı session'ı
    
    Returns:
        User modeli
    
    Raises:
        HTTPException: Token geçersiz veya kullanıcı bulunamazsa
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Geçersiz kimlik doğrulama bilgileri",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if username is None or token_type != "access":
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Kullanıcıyı veritabanından bul
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Kullanıcı aktif değil")

    return user


async def get_current_user_ws(
    websocket: WebSocket,
    token: str,
    db: AsyncSession
) -> User:
    """
    WebSocket bağlantısı için JWT token doğrulaması yapar
    Query parameter'dan alınan token ile kullanıcı bilgisini çıkarır

    Args:
        websocket: WebSocket bağlantı nesnesi
        token: JWT access token (query parameter'dan gelen)
        db: Veritabanı session'ı

    Returns:
        User modeli

    Raises:
        WebSocketException: Token geçersiz veya kullanıcı bulunamazsa
    """
    try:
        # JWT token'ı decode et
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        token_type: str = payload.get("type")

        # Token tipi kontrolü (access token olmalı)
        if username is None or token_type != "access":
            logger.warning(f"Invalid token type for WebSocket: {token_type}")
            raise WebSocketException(code=1008, reason="Invalid token type")

        # Kullanıcıyı veritabanından bul
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()

        if user is None:
            logger.warning(f"User not found for WebSocket: {username}")
            raise WebSocketException(code=1008, reason="User not found")

        # Kullanıcı aktif mi kontrol et
        if not user.is_active:
            logger.warning(f"Inactive user attempted WebSocket connection: {username}")
            raise WebSocketException(code=1008, reason="User inactive")

        logger.info(f"WebSocket authentication successful for user: {username} (ID: {user.id})")
        return user

    except JWTError as e:
        logger.error(f"JWT decode error in WebSocket auth: {e}")
        raise WebSocketException(code=1008, reason="Invalid token")
    except WebSocketException:
        # Re-raise WebSocketException as-is
        raise
    except Exception as e:
        logger.error(f"Unexpected error in WebSocket authentication: {e}")
        raise WebSocketException(code=1011, reason="Authentication error")


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Admin yetkisi kontrolü yapar
    Sadece admin kullanıcıların erişebileceği endpoint'lerde kullanılır
    
    Args:
        current_user: Mevcut kullanıcı (get_current_user'dan gelir)
    
    Returns:
        User modeli (admin ise)
    
    Raises:
        HTTPException: Kullanıcı admin değilse 403 Forbidden
    """
    if not current_user.is_admin:
        logger.warning(f"Non-admin user attempted admin operation: {current_user.username} (ID: {current_user.id})")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli"
        )
    return current_user

