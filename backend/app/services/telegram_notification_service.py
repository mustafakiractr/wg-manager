"""
Telegram Notification Service
Telegram bot ile bildirim gönderme servisi
"""
import logging
import aiohttp
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.telegram_settings import TelegramSettings
from app.models.telegram_notification_log import TelegramNotificationLog
from app.utils.datetime_helper import utcnow

logger = logging.getLogger(__name__)


class TelegramNotificationService:
    """Telegram bildirim servisi"""

    @staticmethod
    async def send_message(
        db: AsyncSession,
        message: str,
        parse_mode: str = "HTML",
        category: str = "general",
        title: str = None,
        peer_id: str = None,
        interface_name: str = None,
        user_id: int = None,
    ) -> bool:
        """
        Telegram'a mesaj gönder ve log kaydet

        Args:
            db: Database session
            message: Gönderilecek mesaj
            parse_mode: Mesaj formatı (HTML, Markdown, None)
            category: Bildirim kategorisi (peer_down, backup_failed, vb.)
            title: Mesaj başlığı (opsiyonel)
            peer_id: İlgili peer ID (opsiyonel)
            interface_name: İlgili interface adı (opsiyonel)
            user_id: İlgili kullanıcı ID (opsiyonel)

        Returns:
            bool: Başarılı ise True
        """
        telegram_log = None
        try:
            # Telegram ayarlarını al
            result = await db.execute(select(TelegramSettings).where(TelegramSettings.id == 1))
            settings = result.scalar_one_or_none()

            if not settings:
                logger.warning("Telegram ayarları bulunamadı")
                return False

            if not settings.enabled:
                logger.debug("Telegram bildirimleri devre dışı")
                return False

            if not settings.bot_token or not settings.chat_id:
                logger.warning("Telegram bot_token veya chat_id eksik")
                return False

            # Telegram Bot API URL'i
            url = f"https://api.telegram.org/bot{settings.bot_token}/sendMessage"

            # Mesaj payload'u
            payload = {
                "chat_id": settings.chat_id,
                "text": message,
                "parse_mode": parse_mode,
            }

            # Async HTTP request
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status == 200:
                        # Başarılı gönderim - log kaydet
                        response_data = await response.json()
                        telegram_message_id = response_data.get("result", {}).get("message_id")
                        
                        # Log kaydı oluştur
                        telegram_log = TelegramNotificationLog(
                            category=category,
                            title=title or message[:100],
                            message=message,
                            chat_id=settings.chat_id,
                            bot_token_preview=settings.bot_token[:20] + "..." if len(settings.bot_token) > 20 else settings.bot_token,
                            status="sent",
                            success=True,
                            peer_id=peer_id,
                            interface_name=interface_name,
                            user_id=user_id,
                            telegram_message_id=telegram_message_id,
                        )
                        db.add(telegram_log)
                        
                        # Son bildirim zamanını güncelle
                        settings.last_notification_at = utcnow()
                        await db.commit()
                        
                        logger.info(f"✅ Telegram mesajı gönderildi ve log kaydedildi: {message[:50]}...")
                        return True
                    else:
                        # Başarısız gönderim - hata log kaydet
                        error_text = await response.text()
                        
                        telegram_log = TelegramNotificationLog(
                            category=category,
                            title=title or message[:100],
                            message=message,
                            chat_id=settings.chat_id,
                            bot_token_preview=settings.bot_token[:20] + "..." if len(settings.bot_token) > 20 else settings.bot_token,
                            status="failed",
                            success=False,
                            error_message=f"HTTP {response.status}: {error_text}",
                            peer_id=peer_id,
                            interface_name=interface_name,
                            user_id=user_id,
                        )
                        db.add(telegram_log)
                        await db.commit()
                        
                        logger.error(f"❌ Telegram API hatası ({response.status}): {error_text}")
                        return False

        except aiohttp.ClientError as e:
            # HTTP hatası - log kaydet
            telegram_log = TelegramNotificationLog(
                category=category,
                title=title or message[:100],
                message=message,
                chat_id=settings.chat_id if settings else "unknown",
                bot_token_preview="error",
                status="failed",
                success=False,
                error_message=f"HTTP Error: {str(e)}",
                peer_id=peer_id,
                interface_name=interface_name,
                user_id=user_id,
            )
            db.add(telegram_log)
            await db.commit()
            
            logger.error(f"❌ Telegram HTTP hatası: {e}")
            return False
        except Exception as e:
            # Genel hata - log kaydet
            if telegram_log is None:
                telegram_log = TelegramNotificationLog(
                    category=category,
                    title=title or message[:100],
                    message=message,
                    chat_id="unknown",
                    bot_token_preview="error",
                    status="failed",
                    success=False,
                    error_message=str(e),
                    peer_id=peer_id,
                    interface_name=interface_name,
                    user_id=user_id,
                )
                db.add(telegram_log)
                await db.commit()
            
            logger.error(f"❌ Telegram mesaj gönderme hatası: {e}")
            import traceback
            logger.debug(traceback.format_exc())
            return False

    @staticmethod
    async def send_critical_event(
        db: AsyncSession,
        event_type: str,
        title: str,
        description: str,
        details: Optional[str] = None,
        peer_id: str = None,
        interface: str = None,
        user_id: int = None,
    ) -> bool:
        """
        Kritik olay bildirimi gönder

        Args:
            db: Database session
            event_type: Olay tipi (peer_down, mikrotik_disconnect, vb.)
            title: Bildirim başlığı
            description: Kısa açıklama
            details: Detaylı bilgi (opsiyonel)
            peer_id: İlgili peer ID (opsiyonel)
            interface: İlgili interface adı (opsiyonel)
            user_id: İlgili kullanıcı ID (opsiyonel)

        Returns:
            bool: Başarılı ise True
        """
        try:
            # Telegram ayarlarını al
            result = await db.execute(select(TelegramSettings).where(TelegramSettings.id == 1))
            settings = result.scalar_one_or_none()

            if not settings or not settings.enabled:
                return False

            # Bildirim kategorisi aktif mi kontrol et
            if settings.notification_categories:
                if event_type not in settings.notification_categories:
                    logger.debug(f"Kategori devre dışı: {event_type}")
                    return False

            # Mesajı formatla (HTML)
            emoji_map = {
                "peer_down": "🔴",
                "peer_up": "🟢",
                "mikrotik_disconnect": "⚠️",
                "backup_failed": "💾",
                "login_failed": "🔒",
                "system_error": "❌",
            }
            emoji = emoji_map.get(event_type, "ℹ️")

            message = f"{emoji} <b>{title}</b>\n\n"
            message += f"{description}\n"
            
            if details:
                message += f"\n📋 Detaylar:\n{details}"

            # Timestamp ekle
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            message += f"\n\n🕐 {timestamp}"

            return await TelegramNotificationService.send_message(
                db, 
                message,
                category=event_type,
                title=title,
                peer_id=peer_id,
                interface_name=interface,
                user_id=user_id,
            )

        except Exception as e:
            logger.error(f"Kritik olay bildirimi hatası: {e}")
            return False

    @staticmethod
    async def send_test_message(db: AsyncSession) -> bool:
        """
        Test mesajı gönder

        Args:
            db: Database session

        Returns:
            bool: Başarılı ise True
        """
        try:
            message = "✅ <b>WireGuard Manager - Test Bildirimi</b>\n\n"
            message += "Telegram bildirimleri başarıyla yapılandırıldı!\n"
            message += "Kritik olaylar için bildirim alacaksınız."

            # Önce mesajı gönder ve log kaydet
            success = await TelegramNotificationService.send_message(
                db, 
                message,
                category="test",
                title="Test Bildirimi",
            )

            # Eğer mesaj başarıyla gönderildiyse test message counter'ı artır
            if success:
                result = await db.execute(select(TelegramSettings).where(TelegramSettings.id == 1))
                settings = result.scalar_one_or_none()
                
                if settings:
                    settings.test_message_count = (settings.test_message_count or 0) + 1
                    await db.commit()

            return success

        except Exception as e:
            logger.error(f"Test mesajı hatası: {e}")
            return False
