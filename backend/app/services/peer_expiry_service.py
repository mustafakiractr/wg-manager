"""
Peer Expiry Scheduler Service
Süresi dolan peer'ları kontrol eder ve otomatik işlem yapar
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.database import AsyncSessionLocal
from app.models.peer_metadata import PeerMetadata
from app.mikrotik.connection import mikrotik_conn
from app.utils.datetime_helper import utcnow

logger = logging.getLogger(__name__)

# Global scheduler task
_expiry_task = None


class PeerExpiryService:
    """Peer son kullanma tarihi yönetimi"""

    @staticmethod
    async def get_expired_peers(db: AsyncSession) -> List[PeerMetadata]:
        """
        Süresi dolmuş peer'ları getirir
        
        Returns:
            Süresi dolmuş peer listesi
        """
        now = utcnow()
        result = await db.execute(
            select(PeerMetadata).where(
                and_(
                    PeerMetadata.expires_at.isnot(None),
                    PeerMetadata.expires_at <= now,
                    PeerMetadata.expired_notified == False
                )
            )
        )
        return result.scalars().all()

    @staticmethod
    async def get_expiring_soon_peers(db: AsyncSession, hours: int = 24) -> List[PeerMetadata]:
        """
        Yakında süresi dolacak peer'ları getirir
        
        Args:
            hours: Kaç saat içinde dolacakları kontrol et
            
        Returns:
            Süresi yaklaşan peer listesi
        """
        now = utcnow()
        soon = now + timedelta(hours=hours)
        result = await db.execute(
            select(PeerMetadata).where(
                and_(
                    PeerMetadata.expires_at.isnot(None),
                    PeerMetadata.expires_at > now,
                    PeerMetadata.expires_at <= soon
                )
            )
        )
        return result.scalars().all()

    @staticmethod
    async def set_peer_expiry(
        db: AsyncSession,
        peer_id: str,
        interface_name: str,
        expires_at: datetime = None,
        expiry_action: str = 'disable'
    ) -> PeerMetadata:
        """
        Peer için son kullanma tarihi ayarlar
        
        Args:
            peer_id: Peer ID
            interface_name: Interface adı
            expires_at: Son kullanma tarihi (None = süresiz)
            expiry_action: Süre dolduğunda yapılacak işlem
            
        Returns:
            Güncellenmiş metadata
        """
        # Mevcut metadata'yı bul veya oluştur
        result = await db.execute(
            select(PeerMetadata).where(
                and_(
                    PeerMetadata.peer_id == peer_id,
                    PeerMetadata.interface_name == interface_name
                )
            )
        )
        metadata = result.scalar_one_or_none()

        if metadata:
            metadata.expires_at = expires_at
            metadata.expiry_action = expiry_action
            metadata.expired_notified = False  # Reset notification flag
        else:
            metadata = PeerMetadata(
                peer_id=peer_id,
                interface_name=interface_name,
                expires_at=expires_at,
                expiry_action=expiry_action
            )
            db.add(metadata)

        await db.commit()
        await db.refresh(metadata)
        return metadata

    @staticmethod
    async def process_expired_peer(db: AsyncSession, metadata: PeerMetadata) -> Dict[str, Any]:
        """
        Süresi dolmuş bir peer için işlem yapar
        
        Args:
            metadata: Peer metadata
            
        Returns:
            İşlem sonucu
        """
        result = {
            "peer_id": metadata.peer_id,
            "interface": metadata.interface_name,
            "action": metadata.expiry_action,
            "success": False,
            "message": ""
        }

        try:
            if metadata.expiry_action == 'disable':
                # Peer'ı devre dışı bırak
                await mikrotik_conn.update_wireguard_peer(
                    metadata.peer_id,
                    interface=metadata.interface_name,
                    disabled="yes"
                )
                result["success"] = True
                result["message"] = "Peer devre dışı bırakıldı"
                logger.info(f"✅ Süresi dolan peer devre dışı bırakıldı: {metadata.peer_id}")

            elif metadata.expiry_action == 'delete':
                # Peer'ı sil
                await mikrotik_conn.delete_wireguard_peer(
                    metadata.peer_id,
                    interface=metadata.interface_name
                )
                result["success"] = True
                result["message"] = "Peer silindi"
                logger.info(f"✅ Süresi dolan peer silindi: {metadata.peer_id}")

            elif metadata.expiry_action == 'notify_only':
                # Sadece bildirim gönder
                result["success"] = True
                result["message"] = "Bildirim gönderildi"
                logger.info(f"ℹ️ Süresi dolan peer için bildirim: {metadata.peer_id}")

            # Bildirim gönderildi olarak işaretle
            metadata.expired_notified = True
            await db.commit()

        except Exception as e:
            result["message"] = str(e)
            logger.error(f"❌ Peer expiry işlemi başarısız: {metadata.peer_id}, Hata: {e}")

        return result

    @staticmethod
    async def check_and_process_expired_peers() -> Dict[str, Any]:
        """
        Süresi dolmuş tüm peer'ları kontrol eder ve işler
        
        Returns:
            İşlem özeti
        """
        results = {
            "checked_at": utcnow().isoformat(),
            "expired_count": 0,
            "processed": [],
            "errors": []
        }

        try:
            async with AsyncSessionLocal() as db:
                expired_peers = await PeerExpiryService.get_expired_peers(db)
                results["expired_count"] = len(expired_peers)

                for metadata in expired_peers:
                    try:
                        # Telegram bildirimi gönder
                        try:
                            from app.services.telegram_notification_service import TelegramNotificationService
                            await TelegramNotificationService.send_critical_event(
                                db=db,
                                event_type="peer_expired",
                                title="⏰ Peer Süresi Doldu",
                                description=f"Peer ID: {metadata.peer_id}",
                                details=f"Interface: {metadata.interface_name}\nİşlem: {metadata.expiry_action}"
                            )
                        except Exception as telegram_err:
                            logger.warning(f"Telegram bildirimi gönderilemedi: {telegram_err}")

                        # Peer işlemini yap
                        process_result = await PeerExpiryService.process_expired_peer(db, metadata)
                        results["processed"].append(process_result)

                    except Exception as e:
                        results["errors"].append({
                            "peer_id": metadata.peer_id,
                            "error": str(e)
                        })

                logger.info(f"📋 Expiry check: {results['expired_count']} expired, {len(results['processed'])} processed")

        except Exception as e:
            logger.error(f"❌ Expiry check hatası: {e}")
            results["errors"].append({"error": str(e)})

        return results

    @staticmethod
    async def get_expiry_stats(db: AsyncSession) -> Dict[str, Any]:
        """
        Expiry istatistiklerini getirir
        
        Returns:
            İstatistikler
        """
        now = utcnow()
        tomorrow = now + timedelta(days=1)
        next_week = now + timedelta(days=7)
        next_month = now + timedelta(days=30)

        # Süresi dolmuş
        expired_result = await db.execute(
            select(PeerMetadata).where(
                and_(
                    PeerMetadata.expires_at.isnot(None),
                    PeerMetadata.expires_at <= now
                )
            )
        )
        expired_count = len(expired_result.scalars().all())

        # 24 saat içinde dolacak
        expiring_24h_result = await db.execute(
            select(PeerMetadata).where(
                and_(
                    PeerMetadata.expires_at.isnot(None),
                    PeerMetadata.expires_at > now,
                    PeerMetadata.expires_at <= tomorrow
                )
            )
        )
        expiring_24h_count = len(expiring_24h_result.scalars().all())

        # 7 gün içinde dolacak
        expiring_7d_result = await db.execute(
            select(PeerMetadata).where(
                and_(
                    PeerMetadata.expires_at.isnot(None),
                    PeerMetadata.expires_at > now,
                    PeerMetadata.expires_at <= next_week
                )
            )
        )
        expiring_7d_count = len(expiring_7d_result.scalars().all())

        # Toplam expiry tanımlı
        total_with_expiry_result = await db.execute(
            select(PeerMetadata).where(
                PeerMetadata.expires_at.isnot(None)
            )
        )
        total_with_expiry = len(total_with_expiry_result.scalars().all())

        return {
            "expired": expired_count,
            "expiring_24h": expiring_24h_count,
            "expiring_7d": expiring_7d_count,
            "total_with_expiry": total_with_expiry
        }


async def expiry_check_loop():
    """Background task: Periyodik olarak süresi dolan peer'ları kontrol eder"""
    logger.info("🕐 Peer expiry scheduler başlatıldı")
    
    while True:
        try:
            await PeerExpiryService.check_and_process_expired_peers()
        except Exception as e:
            logger.error(f"❌ Expiry check loop hatası: {e}")
        
        # Her 5 dakikada bir kontrol et
        await asyncio.sleep(300)


async def start_expiry_scheduler():
    """Expiry scheduler'ı başlatır"""
    global _expiry_task
    
    if _expiry_task is None or _expiry_task.done():
        _expiry_task = asyncio.create_task(expiry_check_loop())
        logger.info("✅ Peer expiry scheduler başlatıldı")


async def stop_expiry_scheduler():
    """Expiry scheduler'ı durdurur"""
    global _expiry_task
    
    if _expiry_task and not _expiry_task.done():
        _expiry_task.cancel()
        try:
            await _expiry_task
        except asyncio.CancelledError:
            pass
        logger.info("⏹️ Peer expiry scheduler durduruldu")
