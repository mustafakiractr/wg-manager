"""
Email ayarları ve notification API endpoint'leri
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.database import get_db
from app.security.auth import get_current_user, require_admin
from app.models.user import User
from app.services.email_service import EmailService
from app.models.email_settings import EmailSettings, EmailLog
from sqlalchemy import select, desc
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class EmailSettingsRequest(BaseModel):
    """Email ayarları request modeli"""
    smtp_host: str
    smtp_port: int
    smtp_username: str
    smtp_password: str
    from_email: EmailStr
    from_name: str = "WireGuard Manager"
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False
    enabled: bool = False
    recipient_emails: Optional[str] = None
    
    # Notification tercihleri
    notify_backup_success: bool = True
    notify_backup_failure: bool = True
    notify_peer_added: bool = False
    notify_peer_deleted: bool = False
    notify_peer_expired: bool = True
    notify_system_alerts: bool = True


class TestEmailRequest(BaseModel):
    """Test email request modeli"""
    test_email: EmailStr


@router.get("/email/settings")
async def get_email_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Email ayarlarını getir"""
    try:
        settings = await EmailService.get_settings(db)
        
        if not settings:
            return {
                "success": True,
                "data": None,
                "message": "Email ayarları henüz yapılandırılmamış"
            }
        
        # Şifreyi döndürme (güvenlik)
        return {
            "success": True,
            "data": {
                "smtp_host": settings.smtp_host,
                "smtp_port": settings.smtp_port,
                "smtp_username": settings.smtp_username,
                "smtp_use_tls": settings.smtp_use_tls,
                "smtp_use_ssl": settings.smtp_use_ssl,
                "from_email": settings.from_email,
                "from_name": settings.from_name,
                "enabled": settings.enabled,
                "recipient_emails": settings.recipient_emails,
                "notify_backup_success": settings.notify_backup_success,
                "notify_backup_failure": settings.notify_backup_failure,
                "notify_peer_added": settings.notify_peer_added,
                "notify_peer_deleted": settings.notify_peer_deleted,
                "notify_peer_expired": settings.notify_peer_expired,
                "notify_system_alerts": settings.notify_system_alerts,
                "last_test_sent": settings.last_test_sent,
                "last_test_status": settings.last_test_status
            }
        }
    except Exception as e:
        logger.error(f"Email ayarları getirme hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/email/settings")
async def save_email_settings(
    settings_data: EmailSettingsRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Email ayarlarını kaydet"""
    try:
        settings = await EmailService.save_settings(
            db=db,
            smtp_host=settings_data.smtp_host,
            smtp_port=settings_data.smtp_port,
            smtp_username=settings_data.smtp_username,
            smtp_password=settings_data.smtp_password,
            from_email=settings_data.from_email,
            from_name=settings_data.from_name,
            smtp_use_tls=settings_data.smtp_use_tls,
            smtp_use_ssl=settings_data.smtp_use_ssl,
            enabled=settings_data.enabled,
            recipient_emails=settings_data.recipient_emails,
            notify_backup_success=settings_data.notify_backup_success,
            notify_backup_failure=settings_data.notify_backup_failure,
            notify_peer_added=settings_data.notify_peer_added,
            notify_peer_deleted=settings_data.notify_peer_deleted,
            notify_peer_expired=settings_data.notify_peer_expired,
            notify_system_alerts=settings_data.notify_system_alerts
        )
        
        await db.commit()
        
        return {
            "success": True,
            "message": "Email ayarları başarıyla kaydedildi",
            "data": {
                "id": settings.id,
                "enabled": settings.enabled
            }
        }
    except Exception as e:
        await db.rollback()
        logger.error(f"Email ayarları kaydetme hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/email/test")
async def send_test_email(
    test_data: TestEmailRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Test email gönder"""
    try:
        result = await EmailService.send_test_email(db, test_data.test_email)
        await db.commit()
        
        if result["success"]:
            return {
                "success": True,
                "message": f"Test email başarıyla gönderildi: {test_data.test_email}"
            }
        else:
            return {
                "success": False,
                "message": "Test email gönderilemedi. Lütfen ayarları kontrol edin."
            }
    except Exception as e:
        await db.rollback()
        logger.error(f"Test email gönderme hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/email/logs")
async def get_email_logs(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Email log kayıtlarını getir"""
    try:
        # Log'ları getir
        result = await db.execute(
            select(EmailLog)
            .order_by(desc(EmailLog.sent_at))
            .limit(limit)
            .offset(offset)
        )
        logs = result.scalars().all()
        
        # Total count
        count_result = await db.execute(select(EmailLog))
        total = len(count_result.scalars().all())
        
        return {
            "success": True,
            "data": [
                {
                    "id": log.id,
                    "recipient": log.recipient,
                    "subject": log.subject,
                    "status": log.status,
                    "event_type": log.event_type,
                    "error_message": log.error_message,
                    "sent_at": log.sent_at
                }
                for log in logs
            ],
            "total": total,
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        logger.error(f"Email log'ları getirme hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))
