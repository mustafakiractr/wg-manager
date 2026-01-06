"""
Backup Scheduler Service
Otomatik backup zamanlama ve retention policy yönetimi
"""
import asyncio
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.backup_service import BackupService
from app.services.telegram_notification_service import TelegramNotificationService
from app.utils.datetime_helper import utcnow

logger = logging.getLogger(__name__)


class BackupSchedulerService:
    """Otomatik backup zamanlama ve retention policy servisi"""

    # Retention policy ayarları (gün cinsinden)
    RETENTION_POLICY = {
        "database": 7,  # Database backup'ları 7 gün saklanır
        "full": 30,     # Full backup'lar 30 gün saklanır
        "wireguard": 3, # WireGuard config 3 gün saklanır
    }

    @staticmethod
    async def create_scheduled_backup(
        db: AsyncSession,
        backup_type: str = "database",
        description: str = None,
        send_notification: bool = True
    ) -> Dict[str, Any]:
        """
        Zamanlanmış backup oluştur

        Args:
            db: Database session
            backup_type: "database" veya "full"
            description: Backup açıklaması
            send_notification: Telegram bildirimi gönder

        Returns:
            Backup sonucu
        """
        try:
            # Backup açıklaması
            if not description:
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
                description = f"Scheduled {backup_type} backup - {timestamp}"

            logger.info(f"🕒 Zamanlanmış backup başlatılıyor: {backup_type}")

            # BackupService instance oluştur
            backup_service = BackupService()

            # Backup oluştur
            if backup_type == "database":
                result = backup_service.create_database_backup(
                    description=description
                )
            elif backup_type == "full":
                result = backup_service.create_full_backup(
                    description=description
                )
            else:
                raise ValueError(f"Geçersiz backup tipi: {backup_type}")

            if result["success"]:
                logger.info(f"✅ Zamanlanmış backup başarılı: {result.get('backup_name')}")

                # Telegram bildirimi gönder
                if send_notification:
                    await BackupSchedulerService._send_backup_notification(
                        db=db,
                        backup_type=backup_type,
                        backup_name=result.get("backup_name"),
                        size_mb=result.get("size_mb", 0),
                        status="success"
                    )

                # Retention policy uygula
                await BackupSchedulerService.apply_retention_policy(
                    backup_type=backup_type
                )

                return result
            else:
                logger.error(f"❌ Zamanlanmış backup başarısız: {result.get('message')}")

                # Hata bildirimi gönder
                if send_notification:
                    await BackupSchedulerService._send_backup_notification(
                        db=db,
                        backup_type=backup_type,
                        backup_name=None,
                        size_mb=0,
                        status="failed",
                        error=result.get("message")
                    )

                return result

        except Exception as e:
            logger.error(f"❌ Zamanlanmış backup hatası: {e}")
            import traceback
            logger.error(traceback.format_exc())

            # Hata bildirimi gönder
            if send_notification:
                await BackupSchedulerService._send_backup_notification(
                    db=db,
                    backup_type=backup_type,
                    backup_name=None,
                    size_mb=0,
                    status="error",
                    error=str(e)
                )

            return {
                "success": False,
                "message": str(e)
            }

    @staticmethod
    async def apply_retention_policy(
        backup_type: str = None
    ) -> Dict[str, Any]:
        """
        Retention policy uygula - eski backup'ları temizle

        Args:
            backup_type: Sadece belirli bir tip için policy uygula (None ise tümü)

        Returns:
            Temizleme sonucu
        """
        try:
            backup_dir = Path("/opt/wg-manager/backend/backups")
            if not backup_dir.exists():
                backup_dir = Path("backups")

            deleted_count = 0
            deleted_size_mb = 0
            deleted_backups = []

            # İşlenecek backup tipleri
            types_to_process = [backup_type] if backup_type else list(BackupSchedulerService.RETENTION_POLICY.keys())

            for btype in types_to_process:
                retention_days = BackupSchedulerService.RETENTION_POLICY.get(btype, 7)
                cutoff_date = datetime.now() - timedelta(days=retention_days)

                logger.info(f"🗑️ Retention policy uygulanıyor: {btype} ({retention_days} gün)")

                # Backup listesini al
                backup_service_instance = BackupService()
                backups = backup_service_instance.list_backups()

                for backup in backups:
                    # Tip kontrolü - metadata'da "type" key'i kullanılıyor
                    backup_type_check = backup.get("type") or backup.get("backup_type")
                    if backup_type_check != btype:
                        continue

                    # Tarih kontrolü - metadata'da "datetime" key'i kullanılıyor
                    created_at_str = backup.get("datetime") or backup.get("created_at")
                    if not created_at_str:
                        continue

                    try:
                        created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                        created_at = created_at.replace(tzinfo=None)  # Timezone'u kaldır
                    except Exception as e:
                        logger.warning(f"Tarih parse edilemedi: {created_at_str}, Hata: {e}")
                        continue

                    # Eski backup mı?
                    if created_at < cutoff_date:
                        # Database backup için "filename", full backup için "dirname" kullan
                        backup_name = backup.get("filename") or backup.get("dirname") or backup.get("name")
                        # Size bytes olarak gelir, MB'a çevir
                        size_bytes = backup.get("size", 0)
                        size_mb = size_bytes / (1024 * 1024) if size_bytes else 0

                        logger.info(f"  🗑️ Eski backup siliniyor: {backup_name} (Oluşturulma: {created_at_str})")

                        # Backup'ı sil
                        delete_result = backup_service_instance.delete_backup(backup_name)

                        if delete_result.get("success"):
                            deleted_count += 1
                            deleted_size_mb += size_mb
                            deleted_backups.append(backup_name)
                            logger.info(f"    ✅ Silindi: {backup_name}")
                        else:
                            logger.warning(f"    ⚠️ Silinemedi: {backup_name}")

            logger.info(f"✅ Retention policy tamamlandı: {deleted_count} backup silindi ({deleted_size_mb:.2f} MB)")

            return {
                "success": True,
                "deleted_count": deleted_count,
                "deleted_size_mb": deleted_size_mb,
                "deleted_backups": deleted_backups
            }

        except Exception as e:
            logger.error(f"❌ Retention policy hatası: {e}")
            import traceback
            logger.error(traceback.format_exc())

            return {
                "success": False,
                "message": str(e)
            }

    @staticmethod
    async def _send_backup_notification(
        db: AsyncSession,
        backup_type: str,
        backup_name: str,
        size_mb: float,
        status: str,
        error: str = None
    ):
        """
        Backup sonucu için Telegram bildirimi gönder

        Args:
            db: Database session
            backup_type: Backup tipi
            backup_name: Backup dosya adı
            size_mb: Backup boyutu (MB)
            status: "success", "failed", "error"
            error: Hata mesajı (varsa)
        """
        try:
            # Mesaj içeriği
            if status == "success":
                emoji = "✅"
                title = f"{emoji} Backup Başarılı"
                message = f"""
<b>{title}</b>

<b>Tip:</b> {backup_type}
<b>Dosya:</b> <code>{backup_name}</code>
<b>Boyut:</b> {size_mb:.2f} MB
<b>Zaman:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Backup başarıyla oluşturuldu! ✨
"""
            else:
                emoji = "❌"
                title = f"{emoji} Backup Hatası"
                message = f"""
<b>{title}</b>

<b>Tip:</b> {backup_type}
<b>Zaman:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
<b>Durum:</b> {status}
<b>Hata:</b> {error or 'Bilinmeyen hata'}

⚠️ Backup oluşturulamadı! Lütfen kontrol edin.
"""

            # Telegram'a gönder
            await TelegramNotificationService.send_message(
                db=db,
                message=message,
                parse_mode="HTML",
                category="backup_scheduled",
                title=title
            )

        except Exception as e:
            logger.error(f"❌ Backup bildirimi gönderilemedi: {e}")

    @staticmethod
    async def get_next_scheduled_backups() -> Dict[str, Any]:
        """
        Sonraki zamanlanmış backup'ların bilgisini döndür
        (Cron job schedule'dan hesaplanır)

        Returns:
            Sonraki backup zamanları
        """
        try:
            now = datetime.now()

            # Günlük database backup - her gün 02:00
            next_daily = now.replace(hour=2, minute=0, second=0, microsecond=0)
            if next_daily <= now:
                next_daily += timedelta(days=1)

            # Haftalık full backup - her Pazar 03:00
            next_weekly = now.replace(hour=3, minute=0, second=0, microsecond=0)
            days_until_sunday = (6 - now.weekday()) % 7
            if days_until_sunday == 0 and next_weekly <= now:
                days_until_sunday = 7
            next_weekly += timedelta(days=days_until_sunday)

            return {
                "success": True,
                "next_database_backup": next_daily.isoformat(),
                "next_full_backup": next_weekly.isoformat(),
                "current_time": now.isoformat()
            }

        except Exception as e:
            logger.error(f"❌ Schedule hesaplama hatası: {e}")
            return {
                "success": False,
                "message": str(e)
            }
