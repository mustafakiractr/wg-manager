"""
IP Pool Service
IP havuzu yönetimi ve IP tahsisi için iş mantığı
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, delete
from app.models.ip_pool import IPPool, IPAllocation
from typing import Optional, List, Dict, Any
import ipaddress
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class IPPoolService:
    """IP havuzu yönetim servisi"""

    @staticmethod
    async def create_pool(
        db: AsyncSession,
        name: str,
        interface_name: str,
        subnet: str,
        start_ip: str,
        end_ip: str,
        gateway: Optional[str] = None,
        dns_servers: Optional[str] = None,
        description: Optional[str] = None,
        is_active: bool = True
    ) -> IPPool:
        """
        Yeni IP havuzu oluşturur

        Args:
            db: Database session
            name: Havuz adı
            interface_name: Interface adı
            subnet: Alt ağ (örn: 10.0.0.0/24)
            start_ip: Başlangıç IP
            end_ip: Bitiş IP
            gateway: Gateway IP (opsiyonel)
            dns_servers: DNS sunucuları (virgülle ayrılmış)
            description: Açıklama
            is_active: Havuz aktif mi?

        Returns:
            Oluşturulan IPPool objesi
        """
        # IP formatlarını doğrula
        try:
            ipaddress.ip_network(subnet)
            ipaddress.ip_address(start_ip)
            ipaddress.ip_address(end_ip)
            if gateway:
                ipaddress.ip_address(gateway)
        except ValueError as e:
            raise ValueError(f"Geçersiz IP formatı: {e}")

        # Başlangıç IP'nin bitiş IP'den küçük olduğunu kontrol et
        if ipaddress.ip_address(start_ip) >= ipaddress.ip_address(end_ip):
            raise ValueError("Başlangıç IP'si bitiş IP'sinden küçük olmalıdır")

        pool = IPPool(
            name=name,
            interface_name=interface_name,
            subnet=subnet,
            start_ip=start_ip,
            end_ip=end_ip,
            gateway=gateway,
            dns_servers=dns_servers,
            description=description,
            is_active=is_active
        )

        db.add(pool)
        await db.commit()
        await db.refresh(pool)

        logger.info(f"IP havuzu oluşturuldu: {name} ({subnet})")
        return pool

    @staticmethod
    async def get_pool(db: AsyncSession, pool_id: int) -> Optional[IPPool]:
        """Pool ID'ye göre havuzu getirir"""
        result = await db.execute(select(IPPool).where(IPPool.id == pool_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_pools(
        db: AsyncSession,
        interface_name: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[IPPool]:
        """
        IP havuzlarını listeler

        Args:
            db: Database session
            interface_name: Interface'e göre filtrele (opsiyonel)
            is_active: Aktiflik durumuna göre filtrele (opsiyonel)
        """
        query = select(IPPool)

        if interface_name:
            query = query.where(IPPool.interface_name == interface_name)
        if is_active is not None:
            query = query.where(IPPool.is_active == is_active)

        query = query.order_by(IPPool.created_at.desc())

        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def update_pool(
        db: AsyncSession,
        pool_id: int,
        **kwargs
    ) -> Optional[IPPool]:
        """
        IP havuzunu günceller

        Args:
            db: Database session
            pool_id: Pool ID
            **kwargs: Güncellenecek alanlar
        """
        pool = await IPPoolService.get_pool(db, pool_id)
        if not pool:
            return None

        # IP formatlarını doğrula (eğer güncelleniyorsa)
        if 'subnet' in kwargs:
            try:
                ipaddress.ip_network(kwargs['subnet'])
            except ValueError as e:
                raise ValueError(f"Geçersiz subnet formatı: {e}")

        if 'start_ip' in kwargs or 'end_ip' in kwargs:
            start = kwargs.get('start_ip', pool.start_ip)
            end = kwargs.get('end_ip', pool.end_ip)
            try:
                ipaddress.ip_address(start)
                ipaddress.ip_address(end)
                if ipaddress.ip_address(start) >= ipaddress.ip_address(end):
                    raise ValueError("Başlangıç IP'si bitiş IP'sinden küçük olmalıdır")
            except ValueError as e:
                raise ValueError(f"Geçersiz IP formatı: {e}")

        # Güncelleme
        for key, value in kwargs.items():
            if hasattr(pool, key):
                setattr(pool, key, value)

        await db.commit()
        await db.refresh(pool)

        logger.info(f"IP havuzu güncellendi: {pool.name}")
        return pool

    @staticmethod
    async def delete_pool(db: AsyncSession, pool_id: int) -> bool:
        """
        IP havuzunu siler (cascade ile tüm tahsisler de silinir)

        Args:
            db: Database session
            pool_id: Pool ID

        Returns:
            Başarılı ise True
        """
        # Önce pool ismini al (log için)
        pool = await IPPoolService.get_pool(db, pool_id)
        if not pool:
            return False

        pool_name = pool.name

        # DELETE statement kullan (greenlet hatası önlemek için)
        result = await db.execute(
            delete(IPPool).where(IPPool.id == pool_id)
        )

        if result.rowcount == 0:
            return False

        await db.commit()
        logger.info(f"IP havuzu silindi: {pool_name}")
        return True

    @staticmethod
    async def allocate_ip(
        db: AsyncSession,
        pool_id: int,
        peer_id: Optional[str] = None,
        peer_public_key: Optional[str] = None,
        peer_name: Optional[str] = None,
        ip_address: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Optional[IPAllocation]:
        """
        IP tahsis eder (manuel veya otomatik)

        Args:
            db: Database session
            pool_id: Pool ID
            peer_id: Peer ID (opsiyonel)
            peer_public_key: Peer public key (opsiyonel)
            peer_name: Peer adı (opsiyonel)
            ip_address: Belirli bir IP tahsis et (opsiyonel, boş ise otomatik)
            notes: Notlar

        Returns:
            IPAllocation objesi veya None (başarısız ise)
        """
        pool = await IPPoolService.get_pool(db, pool_id)
        if not pool or not pool.is_active:
            logger.error(f"Havuz bulunamadı veya aktif değil: {pool_id}")
            return None

        # Manuel IP tahsisi
        if ip_address:
            # IP formatını doğrula
            try:
                ip_obj = ipaddress.ip_address(ip_address)
            except ValueError:
                logger.error(f"Geçersiz IP formatı: {ip_address}")
                return None

            # IP'nin havuz aralığında olduğunu kontrol et
            start_ip = ipaddress.ip_address(pool.start_ip)
            end_ip = ipaddress.ip_address(pool.end_ip)

            if not (start_ip <= ip_obj <= end_ip):
                logger.error(f"IP havuz aralığında değil: {ip_address}")
                return None

            # IP'nin zaten tahsis edilmediğini kontrol et
            existing = await db.execute(
                select(IPAllocation).where(
                    and_(
                        IPAllocation.pool_id == pool_id,
                        IPAllocation.ip_address == ip_address,
                        IPAllocation.status == 'allocated'
                    )
                )
            )
            if existing.scalar_one_or_none():
                logger.error(f"IP zaten tahsis edilmiş: {ip_address}")
                return None

            assigned_ip = ip_address

        # Otomatik IP tahsisi
        else:
            assigned_ip = await IPPoolService.find_next_available_ip(db, pool_id)
            if not assigned_ip:
                logger.error(f"Havuzda boş IP kalmadı: {pool.name}")
                return None

        # Tahsisi oluştur
        allocation = IPAllocation(
            pool_id=pool_id,
            ip_address=assigned_ip,
            peer_id=peer_id,
            peer_public_key=peer_public_key,
            peer_name=peer_name,
            status='allocated',
            notes=notes
        )

        db.add(allocation)
        await db.commit()
        # db.refresh kaldırıldı - greenlet hatasını önlemek için
        # Allocation ID zaten oluşturuldu, diğer alanlar değişmedi

        logger.info(f"IP tahsis edildi: {assigned_ip} → {peer_name or peer_id or 'bilinmeyen'}")
        return allocation

    @staticmethod
    async def release_ip(
        db: AsyncSession,
        allocation_id: Optional[int] = None,
        peer_id: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> bool:
        """
        IP'yi serbest bırakır

        Args:
            db: Database session
            allocation_id: Allocation ID (opsiyonel)
            peer_id: Peer ID'ye göre bul (opsiyonel)
            ip_address: IP adresine göre bul (opsiyonel)

        Returns:
            Başarılı ise True
        """
        query = select(IPAllocation).where(IPAllocation.status == 'allocated')

        if allocation_id:
            query = query.where(IPAllocation.id == allocation_id)
        elif peer_id:
            query = query.where(IPAllocation.peer_id == peer_id)
        elif ip_address:
            query = query.where(IPAllocation.ip_address == ip_address)
        else:
            return False

        result = await db.execute(query)
        allocation = result.scalar_one_or_none()

        if not allocation:
            return False

        # IP'yi tamamen serbest bırakmak için allocation kaydını sil
        # (Released olarak işaretlemek yerine siliyoruz ki IP yeniden kullanılabilsin)
        ip_address = allocation.ip_address
        allocation_id_to_delete = allocation.id

        # DELETE statement kullan (greenlet hatası önlemek için)
        result = await db.execute(
            delete(IPAllocation).where(IPAllocation.id == allocation_id_to_delete)
        )

        if result.rowcount == 0:
            return False

        await db.commit()
        logger.info(f"IP serbest bırakıldı ve tahsis kaydı silindi: {ip_address}")
        return True

    @staticmethod
    async def find_next_available_ip(db: AsyncSession, pool_id: int) -> Optional[str]:
        """
        Havuzda sıradaki boş IP'yi bulur
        MikroTik'te kullanımdaki IP'leri de kontrol eder

        Args:
            db: Database session
            pool_id: Pool ID

        Returns:
            Boş IP adresi veya None
        """
        pool = await IPPoolService.get_pool(db, pool_id)
        if not pool:
            return None

        start_ip = ipaddress.ip_address(pool.start_ip)
        end_ip = ipaddress.ip_address(pool.end_ip)

        # 1. Tahsis edilmiş IP'leri al (database'den)
        result = await db.execute(
            select(IPAllocation.ip_address).where(
                and_(
                    IPAllocation.pool_id == pool_id,
                    IPAllocation.status == 'allocated'
                )
            )
        )
        allocated_ips = {row[0] for row in result.fetchall()}

        # 2. MikroTik'te kullanımdaki IP'leri al (gerçek kullanım)
        try:
            from app.mikrotik.connection import mikrotik_conn
            peers = await mikrotik_conn.get_wireguard_peers(pool.interface_name)

            # Her peer'ın allowed-address'inden IP'leri çıkar
            for peer in peers:
                allowed_addresses = peer.get('allowed-address', '')
                if allowed_addresses:
                    # Virgülle ayrılmış adresleri ayır
                    for addr in allowed_addresses.split(','):
                        addr = addr.strip()
                        # /32 veya /24 gibi subnet'i kaldır, sadece IP'yi al
                        if '/' in addr:
                            ip_only = addr.split('/')[0]
                            allocated_ips.add(ip_only)
                        else:
                            allocated_ips.add(addr)

            logger.debug(f"Pool {pool.name} - Kullanımdaki IP'ler: {allocated_ips}")
        except Exception as e:
            # MikroTik bağlantı hatası olursa sadece database'e güven
            logger.warning(f"MikroTik peer kontrolü yapılamadı, sadece database kullanılıyor: {e}")

        # 3. Gateway IP'yi de ekle (kullanılamaz)
        if pool.gateway:
            allocated_ips.add(pool.gateway)

        # 4. Aralıktaki tüm IP'leri kontrol et
        current_ip = start_ip
        while current_ip <= end_ip:
            ip_str = str(current_ip)
            if ip_str not in allocated_ips:
                logger.info(f"✅ Pool {pool.name} - Boş IP bulundu: {ip_str}")
                return ip_str
            current_ip += 1

        logger.warning(f"⚠️ Pool {pool.name} - Tüm IP'ler kullanımda!")
        return None

    @staticmethod
    async def get_pool_stats(db: AsyncSession, pool_id: int) -> Dict[str, Any]:
        """
        Havuz istatistiklerini döner

        Returns:
            {
                'total_ips': int,
                'allocated': int,
                'available': int,
                'usage_percent': float
            }
        """
        pool = await IPPoolService.get_pool(db, pool_id)
        if not pool:
            return {}

        # Toplam IP sayısını hesapla
        start_ip = ipaddress.ip_address(pool.start_ip)
        end_ip = ipaddress.ip_address(pool.end_ip)
        total_ips = int(end_ip) - int(start_ip) + 1

        # Tahsis edilmiş IP sayısını al
        result = await db.execute(
            select(func.count(IPAllocation.id)).where(
                and_(
                    IPAllocation.pool_id == pool_id,
                    IPAllocation.status == 'allocated'
                )
            )
        )
        allocated = result.scalar() or 0

        available = total_ips - allocated
        usage_percent = (allocated / total_ips * 100) if total_ips > 0 else 0

        return {
            'total_ips': total_ips,
            'allocated': allocated,
            'available': available,
            'usage_percent': round(usage_percent, 2)
        }

    @staticmethod
    async def get_allocations(
        db: AsyncSession,
        pool_id: Optional[int] = None,
        status: Optional[str] = None,
        peer_id: Optional[str] = None
    ) -> List[IPAllocation]:
        """
        IP tahsislerini listeler

        Args:
            db: Database session
            pool_id: Pool ID'ye göre filtrele (opsiyonel)
            status: Duruma göre filtrele (opsiyonel)
            peer_id: Peer ID'ye göre filtrele (opsiyonel)
        """
        query = select(IPAllocation)

        if pool_id:
            query = query.where(IPAllocation.pool_id == pool_id)
        if status:
            query = query.where(IPAllocation.status == status)
        if peer_id:
            query = query.where(IPAllocation.peer_id == peer_id)

        query = query.order_by(IPAllocation.allocated_at.desc())

        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_allocation_by_peer(
        db: AsyncSession,
        peer_id: str
    ) -> Optional[IPAllocation]:
        """Peer ID'ye göre aktif tahsisi getirir"""
        result = await db.execute(
            select(IPAllocation).where(
                and_(
                    IPAllocation.peer_id == peer_id,
                    IPAllocation.status == 'allocated'
                )
            )
        )
        return result.scalar_one_or_none()
