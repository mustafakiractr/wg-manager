"""
Notification Service
Bildirim oluşturma ve yönetimi için servis
"""
import logging
from datetime import datetime
from app.utils.datetime_helper import utcnow
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from app.models.notification import Notification
from app.websocket.connection_manager import manager

logger = logging.getLogger(__name__)


class NotificationService:
    """Bildirim servisi"""

    @staticmethod
    async def create_notification(
        db: AsyncSession,
        user_id: int,
        type: str,
        title: str,
        message: str,
        peer_id: str = None,
        interface: str = None,
    ):
        """
        Yeni bildirim oluştur ve WebSocket ile broadcast et

        Args:
            db: Database session
            user_id: Bildirim alacak kullanıcı ID'si (REQUIRED)
            type: Bildirim tipi ('info', 'warning', 'error', 'success')
            title: Bildirim başlığı
            message: Bildirim mesajı
            peer_id: İlgili peer ID (opsiyonel)
            interface: İlgili interface (opsiyonel)
        """
        try:
            notification = Notification(
                user_id=user_id,
                type=type,
                title=title,
                message=message,
                peer_id=peer_id,
                interface=interface,
                read=False,
            )
            db.add(notification)
            await db.commit()
            # db.refresh() kaldırıldı - to_dict() zaten tüm field'ları kullanıyor
            # Refresh yapmadan önce ID'yi alalım
            notification_id = notification.id

            logger.info(f"Bildirim oluşturuldu (ID={notification_id}, user_id={user_id}): {type} - {title}")

            # WebSocket ile kullanıcıya broadcast et
            try:
                notification_data = notification.to_dict()
                await manager.send_to_user(user_id, {
                    "type": "notification",
                    "data": notification_data
                })
                logger.debug(f"WebSocket bildirimi gönderildi (user_id={user_id})")
            except Exception as ws_error:
                # WebSocket broadcast hatası uygulamayı etkilememeli
                logger.error(f"WebSocket broadcast hatası (user_id={user_id}): {ws_error}")
                import traceback
                logger.debug(traceback.format_exc())

            return notification
        except Exception as e:
            logger.error(f"Bildirim oluşturulurken hata: {e}")
            import traceback
            logger.error(traceback.format_exc())
            await db.rollback()
            raise

    @staticmethod
    async def get_notifications(
        db: AsyncSession,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
    ):
        """
        Kullanıcıya ait bildirimleri getir

        Args:
            db: Database session
            user_id: Kullanıcı ID'si (sadece bu kullanıcıya ait bildirimler)
            limit: Maksimum kayıt sayısı
            offset: Başlangıç offset'i
            unread_only: Sadece okunmamış bildirimleri getir
        """
        try:
            query = select(Notification).where(
                Notification.user_id == user_id
            ).order_by(Notification.created_at.desc())

            if unread_only:
                query = query.where(Notification.read == False)

            query = query.limit(limit).offset(offset)
            result = await db.execute(query)
            notifications = result.scalars().all()

            return [n.to_dict() for n in notifications]
        except Exception as e:
            logger.error(f"Bildirimler getirilirken hata: {e}")
            raise

    @staticmethod
    async def mark_as_read(db: AsyncSession, notification_id: int):
        """Bildirimi okundu olarak işaretle"""
        try:
            stmt = (
                update(Notification)
                .where(Notification.id == notification_id)
                .values(read=True, read_at=utcnow())
            )
            await db.execute(stmt)
            await db.commit()

            logger.info(f"Bildirim okundu olarak işaretlendi: {notification_id}")
            return True
        except Exception as e:
            logger.error(f"Bildirim işaretlenirken hata: {e}")
            await db.rollback()
            raise

    @staticmethod
    async def mark_all_as_read(db: AsyncSession, user_id: int):
        """Kullanıcının tüm bildirimlerini okundu olarak işaretle"""
        try:
            stmt = (
                update(Notification)
                .where(Notification.user_id == user_id, Notification.read == False)
                .values(read=True, read_at=utcnow())
            )
            await db.execute(stmt)
            await db.commit()

            logger.info(f"Kullanıcının tüm bildirimleri okundu olarak işaretlendi (user_id={user_id})")
            return True
        except Exception as e:
            logger.error(f"Bildirimler işaretlenirken hata: {e}")
            await db.rollback()
            raise

    @staticmethod
    async def delete_notification(db: AsyncSession, notification_id: int):
        """Bildirimi sil"""
        try:
            stmt = delete(Notification).where(Notification.id == notification_id)
            await db.execute(stmt)
            await db.commit()

            logger.info(f"Bildirim silindi: {notification_id}")
            return True
        except Exception as e:
            logger.error(f"Bildirim silinirken hata: {e}")
            await db.rollback()
            raise

    @staticmethod
    async def get_unread_count(db: AsyncSession, user_id: int):
        """Kullanıcının okunmamış bildirim sayısını getir"""
        try:
            query = select(Notification).where(
                Notification.user_id == user_id,
                Notification.read == False
            )
            result = await db.execute(query)
            count = len(result.scalars().all())
            return count
        except Exception as e:
            logger.error(f"Okunmamış bildirim sayısı alınırken hata: {e}")
            raise


# Yardımcı fonksiyonlar - Hızlı bildirim oluşturma

async def notify_peer_disconnected(db: AsyncSession, user_id: int, peer_id: str, interface: str):
    """Peer bağlantısı kesildiğinde bildirim oluştur"""
    return await NotificationService.create_notification(
        db=db,
        user_id=user_id,
        type="warning",
        title="Peer Bağlantısı Kesildi",
        message=f"Peer {peer_id} bağlantısı kesildi",
        peer_id=peer_id,
        interface=interface,
    )


async def notify_peer_connected(db: AsyncSession, user_id: int, peer_id: str, interface: str):
    """Peer bağlandığında bildirim oluştur"""
    return await NotificationService.create_notification(
        db=db,
        user_id=user_id,
        type="success",
        title="Peer Bağlandı",
        message=f"Peer {peer_id} bağlantısı kuruldu",
        peer_id=peer_id,
        interface=interface,
    )


async def notify_high_traffic(db: AsyncSession, user_id: int, peer_id: str, interface: str, traffic_mb: float):
    """Yüksek trafik kullanımında bildirim oluştur"""
    return await NotificationService.create_notification(
        db=db,
        user_id=user_id,
        type="info",
        title="Yüksek Trafik Kullanımı",
        message=f"Peer {peer_id} son saatte {traffic_mb:.2f} MB veri kullandı",
        peer_id=peer_id,
        interface=interface,
    )


async def notify_mikrotik_disconnected(db: AsyncSession, user_id: int):
    """MikroTik bağlantısı kesildiğinde bildirim oluştur"""
    return await NotificationService.create_notification(
        db=db,
        user_id=user_id,
        type="error",
        title="MikroTik Bağlantısı Kesildi",
        message="MikroTik cihazı ile bağlantı kurulamıyor",
    )


async def notify_peer_created(db: AsyncSession, user_id: int, peer_name: str, interface: str):
    """Yeni peer oluşturulduğunda bildirim oluştur"""
    return await NotificationService.create_notification(
        db=db,
        user_id=user_id,
        type="success",
        title="✅ Yeni Peer Oluşturuldu",
        message=f"'{peer_name}' peer'ı {interface} interface'ine eklendi",
        peer_id=peer_name,
        interface=interface,
    )


async def notify_peer_deleted(db: AsyncSession, user_id: int, peer_name: str, interface: str):
    """Peer silindiğinde bildirim oluştur"""
    return await NotificationService.create_notification(
        db=db,
        user_id=user_id,
        type="warning",
        title="🗑️ Peer Silindi",
        message=f"'{peer_name}' peer'ı {interface} interface'inden silindi",
        peer_id=peer_name,
        interface=interface,
    )


async def notify_interface_started(db: AsyncSession, user_id: int, interface: str):
    """Interface başlatıldığında bildirim oluştur"""
    return await NotificationService.create_notification(
        db=db,
        user_id=user_id,
        type="success",
        title="🟢 Interface Başlatıldı",
        message=f"{interface} interface'i başarıyla başlatıldı",
        interface=interface,
    )


async def notify_interface_stopped(db: AsyncSession, user_id: int, interface: str):
    """Interface durdurulduğunda bildirim oluştur"""
    return await NotificationService.create_notification(
        db=db,
        user_id=user_id,
        type="info",
        title="🔴 Interface Durduruldu",
        message=f"{interface} interface'i durduruldu",
        interface=interface,
    )


async def notify_user_login(db: AsyncSession, user_id: int, ip_address: str, username: str):
    """Kullanıcı giriş yaptığında bildirim oluştur"""
    return await NotificationService.create_notification(
        db=db,
        user_id=user_id,
        type="info",
        title="🔐 Yeni Giriş",
        message=f"Hesabınıza {ip_address} IP adresinden giriş yapıldı",
    )


async def notify_failed_login(db: AsyncSession, user_id: int, username: str, ip_address: str, attempt_count: int):
    """Başarısız giriş denemesi bildirim oluştur"""
    return await NotificationService.create_notification(
        db=db,
        user_id=user_id,
        type="warning",
        title="⚠️ Başarısız Giriş Denemesi",
        message=f"{username} kullanıcısı için {ip_address} adresinden {attempt_count} başarısız giriş denemesi",
    )


async def notify_password_changed(db: AsyncSession, user_id: int):
    """Şifre değiştirildiğinde bildirim oluştur"""
    return await NotificationService.create_notification(
        db=db,
        user_id=user_id,
        type="success",
        title="🔑 Şifre Değiştirildi",
        message="Hesap şifreniz başarıyla değiştirildi",
    )
