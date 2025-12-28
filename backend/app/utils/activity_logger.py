"""
Activity Logger Utility
Kritik işlemler için otomatik aktivite log kaydı
"""
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.activity_log_service import ActivityLogService
from app.models.user import User
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class ActivityLogger:
    """Activity log kayıtları için yardımcı sınıf"""

    @staticmethod
    def get_client_info(request: Request) -> tuple[str, str]:
        """
        Request'ten IP adresi ve user agent bilgisini çıkarır

        Returns:
            tuple: (ip_address, user_agent)
        """
        # IP adresi
        ip_address = request.client.host if request.client else "unknown"

        # X-Forwarded-For header'ı kontrol et (proxy arkasında ise)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            ip_address = forwarded_for.split(",")[0].strip()

        # User agent
        user_agent = request.headers.get("User-Agent", "unknown")

        return ip_address, user_agent

    @staticmethod
    async def log(
        db: AsyncSession,
        request: Request,
        action: str,
        category: str,
        description: str,
        user: Optional[User] = None,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        extra_data: Optional[Dict[str, Any]] = None,
        success: str = 'success',
        error_message: Optional[str] = None,
    ):
        """
        Aktivite kaydı oluştur

        Args:
            db: Database session
            request: FastAPI request
            action: Aksiyon adı
            category: Kategori
            description: Açıklama
            user: Kullanıcı (opsiyonel)
            target_type: Hedef tip (opsiyonel)
            target_id: Hedef ID (opsiyonel)
            extra_data: Ek bilgiler (opsiyonel)
            success: Sonuç ('success', 'failure', 'error')
            error_message: Hata mesajı (opsiyonel)
        """
        try:
            ip_address, user_agent = ActivityLogger.get_client_info(request)

            await ActivityLogService.log_activity(
                db=db,
                action=action,
                category=category,
                description=description,
                user_id=user.id if user else None,
                username=user.username if user else None,
                target_type=target_type,
                target_id=target_id,
                ip_address=ip_address,
                user_agent=user_agent,
                extra_data=extra_data,
                success=success,
                error_message=error_message,
            )
        except Exception as e:
            # Log kaydı hatası uygulamayı durdurmamali
            logger.error(f"Activity logging failed: {e}")


# Kısa yollar
async def log_auth(db: AsyncSession, request: Request, action: str, description: str,
                   user: Optional[User] = None, success: str = 'success', error_message: Optional[str] = None):
    """Auth kategorisi için log"""
    await ActivityLogger.log(db, request, action, 'auth', description, user, success=success, error_message=error_message)


async def log_user_action(db: AsyncSession, request: Request, action: str, description: str,
                          user: User, target_id: Optional[str] = None, success: str = 'success'):
    """User kategorisi için log"""
    await ActivityLogger.log(db, request, action, 'user', description, user, 'user', target_id, success=success)


async def log_wireguard(db: AsyncSession, request: Request, action: str, description: str,
                        user: User, peer_id: Optional[str] = None, success: str = 'success', error_message: Optional[str] = None):
    """WireGuard kategorisi için log"""
    await ActivityLogger.log(db, request, action, 'wireguard', description, user, 'peer', peer_id, success=success, error_message=error_message)


async def log_mikrotik(db: AsyncSession, request: Request, action: str, description: str,
                       user: User, success: str = 'success', error_message: Optional[str] = None):
    """MikroTik kategorisi için log"""
    await ActivityLogger.log(db, request, action, 'mikrotik', description, user, success=success, error_message=error_message)


async def log_system(db: AsyncSession, request: Request, action: str, description: str,
                     success: str = 'success', error_message: Optional[str] = None):
    """System kategorisi için log"""
    await ActivityLogger.log(db, request, action, 'system', description, success=success, error_message=error_message)
