"""
Telegram Settings API
Telegram bildirim ayarları için API endpoint'leri
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List

from app.database.database import get_db
from app.security.auth import get_current_user
from app.models.user import User
from app.models.telegram_settings import TelegramSettings
from app.models.telegram_notification_log import TelegramNotificationLog
from app.services.telegram_notification_service import TelegramNotificationService
from sqlalchemy import func
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class TelegramSettingsUpdate(BaseModel):
    """Telegram ayarları güncelleme modeli"""
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None
    enabled: Optional[bool] = None
    notification_categories: Optional[List[str]] = None


@router.get("/telegram-settings")
async def get_telegram_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Telegram ayarlarını getir
    Sadece admin kullanıcılar erişebilir
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Sadece admin kullanıcılar erişebilir")

    try:
        # Ayarları al
        result = await db.execute(select(TelegramSettings).where(TelegramSettings.id == 1))
        settings = result.scalar_one_or_none()

        if not settings:
            # İlk kez oluştur
            settings = TelegramSettings(
                id=1,
                enabled=False,
                notification_categories=["peer_down", "mikrotik_disconnect", "backup_failed", "login_failed"]
            )
            db.add(settings)
            await db.commit()
            await db.refresh(settings)

        return {
            "success": True,
            "settings": settings.to_dict(),
        }

    except Exception as e:
        logger.error(f"Telegram ayarları alınırken hata: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/telegram-settings")
async def update_telegram_settings(
    settings_update: TelegramSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Telegram ayarlarını güncelle
    Sadece admin kullanıcılar erişebilir
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Sadece admin kullanıcılar erişebilir")

    try:
        # Ayarları al veya oluştur
        result = await db.execute(select(TelegramSettings).where(TelegramSettings.id == 1))
        settings = result.scalar_one_or_none()

        if not settings:
            settings = TelegramSettings(id=1)
            db.add(settings)

        # Güncelle
        if settings_update.bot_token is not None:
            settings.bot_token = settings_update.bot_token.strip() if settings_update.bot_token else None

        if settings_update.chat_id is not None:
            settings.chat_id = settings_update.chat_id.strip() if settings_update.chat_id else None

        if settings_update.enabled is not None:
            settings.enabled = settings_update.enabled

        if settings_update.notification_categories is not None:
            settings.notification_categories = settings_update.notification_categories

        await db.commit()
        await db.refresh(settings)

        logger.info(f"✅ Telegram ayarları güncellendi (enabled={settings.enabled})")

        return {
            "success": True,
            "message": "Telegram ayarları güncellendi",
            "settings": settings.to_dict(),
        }

    except Exception as e:
        logger.error(f"Telegram ayarları güncellenirken hata: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/telegram-settings/test")
async def send_test_notification(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Test bildirimi gönder
    Telegram ayarlarının doğru çalıştığını test et
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Sadece admin kullanıcılar erişebilir")

    try:
        # Test mesajı gönder
        success = await TelegramNotificationService.send_test_message(db)

        if success:
            return {
                "success": True,
                "message": "Test mesajı Telegram'a gönderildi! Lütfen botunuzu kontrol edin.",
            }
        else:
            return {
                "success": False,
                "message": "Test mesajı gönderilemedi. Bot token ve chat ID'yi kontrol edin.",
            }

    except Exception as e:
        logger.error(f"Test mesajı hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/telegram-settings/categories")
async def get_notification_categories(
    current_user: User = Depends(get_current_user),
):
    """
    Kullanılabilir bildirim kategorilerini getir
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Sadece admin kullanıcılar erişebilir")

    categories = [
        {
            "id": "peer_down",
            "name": "Peer Bağlantısı Koptu",
            "description": "WireGuard peer bağlantısı kesildiğinde bildirim",
            "emoji": "🔴",
        },
        {
            "id": "peer_up",
            "name": "Peer Bağlandı",
            "description": "WireGuard peer yeniden bağlandığında bildirim",
            "emoji": "🟢",
        },
        {
            "id": "mikrotik_disconnect",
            "name": "MikroTik Bağlantısı Koptu",
            "description": "MikroTik router bağlantısı kesildiğinde bildirim",
            "emoji": "⚠️",
        },
        {
            "id": "backup_failed",
            "name": "Yedekleme Başarısız",
            "description": "Otomatik yedekleme işlemi başarısız olduğunda bildirim",
            "emoji": "💾",
        },
        {
            "id": "login_failed",
            "name": "Başarısız Giriş Denemesi",
            "description": "Çok sayıda başarısız giriş denemesi olduğunda bildirim",
            "emoji": "🔒",
        },
        {
            "id": "system_error",
            "name": "Sistem Hatası",
            "description": "Kritik sistem hatası oluştuğunda bildirim",
            "emoji": "❌",
        },
    ]

    return {
        "success": True,
        "categories": categories,
    }


@router.get("/telegram-settings/stats")
async def get_telegram_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Telegram bildirim istatistiklerini getir
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Sadece admin kullanıcılar erişebilir")

    try:
        # Toplam mesaj sayısı
        total_result = await db.execute(
            select(func.count(TelegramNotificationLog.id))
        )
        total = total_result.scalar() or 0

        # Başarılı mesajlar
        success_result = await db.execute(
            select(func.count(TelegramNotificationLog.id))
            .where(TelegramNotificationLog.success == True)
        )
        success = success_result.scalar() or 0

        # Başarısız mesajlar
        failed_result = await db.execute(
            select(func.count(TelegramNotificationLog.id))
            .where(TelegramNotificationLog.success == False)
        )
        failed = failed_result.scalar() or 0

        # Başarı oranı
        success_rate = round((success / total * 100) if total > 0 else 0, 1)

        return {
            "success": True,
            "stats": {
                "total": total,
                "successful": success,
                "failed": failed,
                "success_rate": success_rate,
            }
        }

    except Exception as e:
        logger.error(f"Telegram istatistikleri alınırken hata: {e}")
        raise HTTPException(status_code=500, detail=str(e))

