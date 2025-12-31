"""
MikroTik WireGuard Senkronizasyon Servisi
İlk kurulumda MikroTik'teki mevcut WireGuard yapılandırmasını database'e import eder
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.peer_key import PeerKey
from app.models.peer_metadata import PeerMetadata
from app.models.sync_status import SyncStatus
from app.models.ip_pool import IPPool, IPAllocation
from app.mikrotik.connection import mikrotik_conn
from typing import Dict, Any, List
import logging
import json
import ipaddress
from datetime import datetime
from app.utils.datetime_helper import utcnow

logger = logging.getLogger(__name__)


class SyncService:
    """MikroTik WireGuard senkronizasyon servisi"""

    @staticmethod
    async def check_sync_status(db: AsyncSession) -> bool:
        """
        İlk senkronizasyonun tamamlanıp tamamlanmadığını kontrol eder

        Args:
            db: Database session

        Returns:
            True: Sync tamamlanmış
            False: Sync yapılmamış
        """
        try:
            result = await db.execute(
                select(SyncStatus).where(SyncStatus.id == 1)
            )
            status = result.scalar_one_or_none()

            if not status:
                # İlk kayıt oluştur
                logger.info("Sync status kaydı oluşturuluyor...")
                status = SyncStatus(id=1, initial_sync_completed=False)
                db.add(status)
                await db.commit()
                return False

            return status.initial_sync_completed

        except Exception as e:
            logger.error(f"Sync status kontrolü hatası: {e}")
            return False

    @staticmethod
    async def perform_initial_sync(db: AsyncSession) -> Dict[str, Any]:
        """
        MikroTik'ten ilk senkronizasyonu gerçekleştirir

        Args:
            db: Database session

        Returns:
            {
                "success": bool,
                "interfaces_synced": int,
                "peers_synced": int,
                "errors": List[str]
            }
        """
        interfaces_synced = 0
        peers_synced = 0
        errors = []

        try:
            logger.info("🔄 MikroTik WireGuard senkronizasyonu başlatılıyor...")

            # MikroTik bağlantısını kontrol et
            if not mikrotik_conn.is_connected:
                error_msg = "MikroTik bağlantısı yok, sync yapılamıyor"
                logger.error(error_msg)
                errors.append(error_msg)
                return {
                    "success": False,
                    "interfaces_synced": 0,
                    "peers_synced": 0,
                    "errors": errors
                }

            # Tüm WireGuard interface'lerini çek
            interfaces = await mikrotik_conn.get_wireguard_interfaces(use_cache=False)
            logger.info(f"MikroTik'te {len(interfaces)} WireGuard interface bulundu")

            # Her interface'i sync et
            for interface in interfaces:
                try:
                    interface_name = interface.get('name')
                    if not interface_name:
                        logger.warning(f"İsimsiz interface atlanıyor: {interface}")
                        continue

                    logger.info(f"Interface sync ediliyor: {interface_name}")
                    peer_count = await SyncService.sync_interface(db, interface)

                    interfaces_synced += 1
                    peers_synced += peer_count

                    logger.info(f"✅ Interface sync edildi: {interface_name} ({peer_count} peer)")

                except Exception as iface_error:
                    error_msg = f"Interface sync hatası ({interface.get('name', 'unknown')}): {iface_error}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    continue

            # Sync tamamlandı olarak işaretle
            await SyncService.mark_sync_complete(
                db=db,
                interface_count=interfaces_synced,
                peer_count=peers_synced,
                errors=errors
            )

            success = len(errors) == 0
            logger.info(
                f"{'✅' if success else '⚠️'} Sync tamamlandı: "
                f"{interfaces_synced} interface, {peers_synced} peer"
                f"{f', {len(errors)} hata' if errors else ''}"
            )

            return {
                "success": success,
                "interfaces_synced": interfaces_synced,
                "peers_synced": peers_synced,
                "errors": errors
            }

        except Exception as e:
            error_msg = f"Sync başarısız: {e}"
            logger.error(error_msg)
            import traceback
            logger.debug(traceback.format_exc())
            errors.append(error_msg)

            return {
                "success": False,
                "interfaces_synced": interfaces_synced,
                "peers_synced": peers_synced,
                "errors": errors
            }

    @staticmethod
    async def sync_interface(
        db: AsyncSession,
        interface_data: Dict[str, Any]
    ) -> int:
        """
        Tek bir WireGuard interface'ini ve peer'larını sync eder

        Args:
            db: Database session
            interface_data: MikroTik'ten gelen interface verisi

        Returns:
            Sync edilen peer sayısı
        """
        interface_name = interface_data.get('name')
        peers_synced = 0

        try:
            # Bu interface'in peer'larını çek
            peers = await mikrotik_conn.get_wireguard_peers(
                interface=interface_name,
                use_cache=False
            )

            logger.info(f"Interface {interface_name} için {len(peers)} peer bulundu")

            # Her peer'ı sync et
            for peer in peers:
                try:
                    success = await SyncService.sync_peer(
                        db=db,
                        peer_data=peer,
                        interface_name=interface_name
                    )
                    if success:
                        peers_synced += 1
                except Exception as peer_error:
                    logger.warning(f"Peer sync hatası (devam ediliyor): {peer_error}")
                    continue

            return peers_synced

        except Exception as e:
            logger.error(f"Interface sync hatası ({interface_name}): {e}")
            raise

    @staticmethod
    async def sync_peer(
        db: AsyncSession,
        peer_data: Dict[str, Any],
        interface_name: str
    ) -> bool:
        """
        Tek bir peer'ı database'e sync eder

        Args:
            db: Database session
            peer_data: MikroTik'ten gelen peer verisi
            interface_name: Interface adı

        Returns:
            True: Peer sync edildi
            False: Peer zaten var veya hata oluştu
        """
        try:
            # Peer verilerini çıkar
            peer_id = peer_data.get('.id') or peer_data.get('id', '')
            public_key = peer_data.get('public-key') or peer_data.get('public_key')
            allowed_address = peer_data.get('allowed-address', '')
            comment = peer_data.get('comment', '')
            endpoint_address = peer_data.get('current-endpoint-address') or peer_data.get('endpoint-address')
            endpoint_port = peer_data.get('current-endpoint-port') or peer_data.get('endpoint-port')

            # Public key kontrolü
            if not public_key:
                logger.warning(f"Public key olmayan peer atlanıyor: {peer_data}")
                return False

            # Duplicate kontrolü
            result = await db.execute(
                select(PeerKey).where(PeerKey.public_key == public_key)
            )
            existing_peer = result.scalar_one_or_none()

            if existing_peer:
                logger.debug(f"Peer zaten mevcut, atlanıyor: {public_key[:20]}...")
                return False  # Duplicate, skip

            # PeerKey kaydı oluştur (private_key=None)
            peer_key = PeerKey(
                peer_id=str(peer_id) if peer_id else '',
                interface_name=interface_name,
                public_key=public_key,
                private_key=None,  # MikroTik peer private key sağlamaz
                client_allowed_ips=allowed_address or None,
                endpoint_address=endpoint_address,
                endpoint_port=int(endpoint_port) if endpoint_port and str(endpoint_port) not in ['0', ''] else None
            )
            db.add(peer_key)

            # PeerMetadata kaydı oluştur
            peer_metadata = PeerMetadata(
                peer_id=str(peer_id) if peer_id else '',
                interface_name=interface_name,
                public_key=public_key,
                group_name="Imported",  # MikroTik'ten import edildi
                group_color="#3B82F6",  # Mavi
                tags="mikrotik-sync",
                notes=f"MikroTik'ten import edildi: {utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC"
            )
            db.add(peer_metadata)

            # IP pool varsa link et
            if allowed_address:
                await SyncService.link_to_ip_pool(
                    db=db,
                    peer_id=str(peer_id) if peer_id else '',
                    public_key=public_key,
                    allowed_address=allowed_address,
                    interface_name=interface_name,
                    comment=comment
                )

            await db.commit()
            logger.info(f"✅ Peer sync edildi: {public_key[:20]}... ({comment or peer_id})")

            return True

        except Exception as e:
            logger.error(f"Peer sync hatası: {e}")
            await db.rollback()
            raise

    @staticmethod
    async def link_to_ip_pool(
        db: AsyncSession,
        peer_id: str,
        public_key: str,
        allowed_address: str,
        interface_name: str,
        comment: str
    ):
        """
        Peer IP'sini uygun IP pool'a link eder

        Args:
            db: Database session
            peer_id: Peer ID
            public_key: Peer public key
            allowed_address: Allowed address (virgülle ayrılmış olabilir)
            interface_name: Interface adı
            comment: Peer yorumu
        """
        try:
            # Bu interface için IP pool'ları bul
            result = await db.execute(
                select(IPPool).where(IPPool.interface_name == interface_name)
            )
            pools = result.scalars().all()

            if not pools:
                return  # Pool yok

            # Allowed address'leri parse et
            for addr in allowed_address.split(','):
                addr = addr.strip()
                if not addr:
                    continue

                # IP'yi çıkar (CIDR notation varsa)
                ip_only = addr.split('/')[0] if '/' in addr else addr

                try:
                    ip_obj = ipaddress.ip_address(ip_only)

                    # Hangi pool'a ait kontrol et
                    for pool in pools:
                        start_ip = ipaddress.ip_address(pool.start_ip)
                        end_ip = ipaddress.ip_address(pool.end_ip)

                        if start_ip <= ip_obj <= end_ip:
                            # Allocation var mı kontrol et
                            alloc_result = await db.execute(
                                select(IPAllocation).where(
                                    and_(
                                        IPAllocation.pool_id == pool.id,
                                        IPAllocation.ip_address == ip_only
                                    )
                                )
                            )
                            existing_alloc = alloc_result.scalar_one_or_none()

                            if not existing_alloc:
                                # Allocation oluştur
                                allocation = IPAllocation(
                                    pool_id=pool.id,
                                    ip_address=ip_only,
                                    peer_id=peer_id,
                                    peer_public_key=public_key,
                                    peer_name=comment or peer_id,
                                    status='allocated',
                                    notes=f"MikroTik sync sırasında otomatik link edildi"
                                )
                                db.add(allocation)
                                logger.debug(f"IP {ip_only} pool {pool.name}'e link edildi")

                            break  # Pool bulundu

                except ValueError:
                    logger.debug(f"Geçersiz IP adresi: {ip_only}")
                    continue

        except Exception as e:
            logger.warning(f"IP pool linking hatası (kritik değil): {e}")

    @staticmethod
    async def mark_sync_complete(
        db: AsyncSession,
        interface_count: int,
        peer_count: int,
        errors: List[str]
    ):
        """
        Sync'i tamamlandı olarak işaretle

        Args:
            db: Database session
            interface_count: Sync edilen interface sayısı
            peer_count: Sync edilen peer sayısı
            errors: Hata listesi
        """
        try:
            result = await db.execute(
                select(SyncStatus).where(SyncStatus.id == 1)
            )
            status = result.scalar_one_or_none()

            if not status:
                status = SyncStatus(id=1)
                db.add(status)

            status.initial_sync_completed = True
            status.last_sync_at = utcnow()
            status.synced_interface_count = interface_count
            status.synced_peer_count = peer_count
            status.sync_errors = json.dumps(errors, ensure_ascii=False) if errors else None

            await db.commit()
            logger.info("Sync durumu database'de güncellendi")

        except Exception as e:
            logger.error(f"Sync status güncelleme hatası: {e}")
            await db.rollback()
