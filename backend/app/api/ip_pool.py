"""
IP Pool Management API Endpoints
IP havuzu yönetimi ve IP tahsisi için REST API
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from pydantic import BaseModel, field_validator
from datetime import datetime
from app.security.auth import get_current_user
from app.models.user import User
from app.models.ip_pool import IPPool, IPAllocation
from app.database.database import get_db
from app.services.ip_pool_service import IPPoolService
from app.utils.activity_logger import ActivityLogger
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== Pydantic Schemas ====================

class IPPoolCreate(BaseModel):
    """IP havuzu oluşturma modeli"""
    name: str
    interface_name: str
    subnet: str
    start_ip: str
    end_ip: str
    gateway: Optional[str] = None
    dns_servers: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if len(v) < 2:
            raise ValueError('Havuz adı en az 2 karakter olmalıdır')
        return v


class IPPoolUpdate(BaseModel):
    """IP havuzu güncelleme modeli"""
    name: Optional[str] = None
    interface_name: Optional[str] = None
    subnet: Optional[str] = None
    start_ip: Optional[str] = None
    end_ip: Optional[str] = None
    gateway: Optional[str] = None
    dns_servers: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class IPAllocateRequest(BaseModel):
    """IP tahsis etme modeli"""
    peer_id: Optional[str] = None
    peer_public_key: Optional[str] = None
    peer_name: Optional[str] = None
    ip_address: Optional[str] = None  # Manuel IP (boş ise otomatik)
    notes: Optional[str] = None


class IPPoolResponse(BaseModel):
    """IP havuzu response modeli"""
    id: int
    name: str
    interface_name: str
    subnet: str
    start_ip: str
    end_ip: str
    gateway: Optional[str]
    dns_servers: Optional[str]
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class IPAllocationResponse(BaseModel):
    """IP tahsis response modeli"""
    id: int
    pool_id: int
    ip_address: str
    peer_id: Optional[str]
    peer_public_key: Optional[str]
    peer_name: Optional[str]
    status: str
    allocated_at: datetime
    released_at: Optional[datetime]
    notes: Optional[str]

    class Config:
        from_attributes = True


# ==================== API Endpoints ====================

@router.get("/ip-pools", response_model=List[IPPoolResponse])
async def list_pools(
    interface_name: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Tüm IP havuzlarını listeler

    Query params:
    - interface_name: Interface'e göre filtrele
    - is_active: Aktiflik durumuna göre filtrele
    """
    try:
        pools = await IPPoolService.get_pools(db, interface_name, is_active)
        return pools
    except Exception as e:
        logger.error(f"IP havuzları listelenemedi: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ip-pools", response_model=IPPoolResponse)
async def create_pool(
    pool_data: IPPoolCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Yeni IP havuzu oluşturur"""
    try:
        pool = await IPPoolService.create_pool(
            db=db,
            name=pool_data.name,
            interface_name=pool_data.interface_name,
            subnet=pool_data.subnet,
            start_ip=pool_data.start_ip,
            end_ip=pool_data.end_ip,
            gateway=pool_data.gateway,
            dns_servers=pool_data.dns_servers,
            description=pool_data.description,
            is_active=pool_data.is_active
        )

        # Activity log
        await ActivityLogger.log(
            db=db,
            request=request,
            action="create_ip_pool",
            category="ip_pool",
            description=f"IP havuzu oluşturuldu: {pool.name}",
            user=current_user,
            target_type="ip_pool",
            target_id=str(pool.id),
            success='success'
        )

        return pool

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"IP havuzu oluşturulamadı: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== IP Allocation Endpoints (BEFORE {pool_id} to avoid routing conflicts) ====================

@router.get("/ip-pools/allocations")
async def list_allocations(
    pool_id: Optional[int] = Query(None, description="Pool ID'ye göre filtrele"),
    status: Optional[str] = Query(None, description="Duruma göre filtrele"),
    peer_id: Optional[str] = Query(None, description="Peer ID'ye göre filtrele"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    IP tahsislerini listeler

    Query params:
    - pool_id: Havuza göre filtrele
    - status: Duruma göre filtrele (allocated, released, reserved)
    - peer_id: Peer ID'ye göre filtrele
    """
    try:
        logger.info(f"📋 Allocations listesi istendi - pool_id={pool_id}, status={status}, peer_id={peer_id}")
        allocations = await IPPoolService.get_allocations(db, pool_id, status, peer_id)
        logger.info(f"📊 {len(allocations)} allocation bulundu")

        # Convert to dict list for response
        result = []
        for alloc in allocations:
            result.append({
                "id": alloc.id,
                "pool_id": alloc.pool_id,
                "ip_address": alloc.ip_address,
                "peer_id": alloc.peer_id,
                "peer_public_key": alloc.peer_public_key,
                "peer_name": alloc.peer_name,
                "status": alloc.status,
                "allocated_at": alloc.allocated_at,
                "released_at": alloc.released_at,
                "notes": alloc.notes
            })

        logger.info(f"✅ Allocations başarıyla dönüldü")
        return result
    except Exception as e:
        logger.error(f"❌ IP tahsisleri listelenemedi: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ip-pools/allocations/peer/{peer_id}", response_model=IPAllocationResponse)
async def get_allocation_by_peer(
    peer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Peer ID'ye göre aktif IP tahsisini getirir"""
    allocation = await IPPoolService.get_allocation_by_peer(db, peer_id)

    if not allocation:
        raise HTTPException(status_code=404, detail="Bu peer için aktif IP tahsisi bulunamadı")

    return allocation


@router.delete("/ip-pools/allocations/{allocation_id}")
async def release_ip_by_id(
    allocation_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """IP tahsisini serbest bırakır"""
    try:
        success = await IPPoolService.release_ip(db, allocation_id=allocation_id)

        if not success:
            raise HTTPException(status_code=404, detail="IP tahsisi bulunamadı")

        # Activity log
        await ActivityLogger.log(
            db=db,
            request=request,
            action="release_ip",
            category="ip_pool",
            description=f"IP serbest bırakıldı (allocation_id: {allocation_id})",
            user=current_user,
            target_type="ip_allocation",
            target_id=str(allocation_id),
            success='success'
        )

        return {"success": True, "message": "IP serbest bırakıldı"}

    except Exception as e:
        logger.error(f"IP serbest bırakılamadı: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== IP Pool Endpoints (Generic {pool_id} routes) ====================

@router.get("/ip-pools/{pool_id}", response_model=IPPoolResponse)
async def get_pool(
    pool_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """IP havuzunu ID'ye göre getirir"""
    pool = await IPPoolService.get_pool(db, pool_id)
    if not pool:
        raise HTTPException(status_code=404, detail="IP havuzu bulunamadı")

    return pool


@router.get("/ip-pools/{pool_id}/stats")
async def get_pool_stats(
    pool_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """IP havuzu istatistiklerini döner"""
    stats = await IPPoolService.get_pool_stats(db, pool_id)
    if not stats:
        raise HTTPException(status_code=404, detail="IP havuzu bulunamadı")

    return {"success": True, "data": stats}


@router.put("/ip-pools/{pool_id}", response_model=IPPoolResponse)
async def update_pool(
    pool_id: int,
    pool_data: IPPoolUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """IP havuzunu günceller"""
    try:
        # Sadece değişen alanları al
        update_data = pool_data.model_dump(exclude_unset=True)

        if not update_data:
            raise HTTPException(status_code=400, detail="Güncellenecek alan belirtilmedi")

        pool = await IPPoolService.update_pool(db, pool_id, **update_data)

        if not pool:
            raise HTTPException(status_code=404, detail="IP havuzu bulunamadı")

        # Activity log
        await ActivityLogger.log(
            db=db,
            request=request,
            action="update_ip_pool",
            category="ip_pool",
            description=f"IP havuzu güncellendi: {pool.name}",
            user=current_user,
            target_type="ip_pool",
            target_id=str(pool.id),
            success='success'
        )

        return pool

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"IP havuzu güncellenemedi: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/ip-pools/{pool_id}")
async def delete_pool(
    pool_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """IP havuzunu siler (tüm tahsisler de silinir)"""
    try:
        # Önce havuzu al (log için)
        pool = await IPPoolService.get_pool(db, pool_id)
        if not pool:
            raise HTTPException(status_code=404, detail="IP havuzu bulunamadı")

        pool_name = pool.name

        success = await IPPoolService.delete_pool(db, pool_id)

        if not success:
            raise HTTPException(status_code=404, detail="IP havuzu bulunamadı")

        # Activity log
        await ActivityLogger.log(
            db=db,
            request=request,
            action="delete_ip_pool",
            category="ip_pool",
            description=f"IP havuzu silindi: {pool_name}",
            user=current_user,
            target_type="ip_pool",
            target_id=str(pool_id),
            success='success'
        )

        return {"success": True, "message": "IP havuzu silindi"}

    except Exception as e:
        logger.error(f"IP havuzu silinemedi: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ip-pools/{pool_id}/allocate", response_model=IPAllocationResponse)
async def allocate_ip(
    pool_id: int,
    allocation_data: IPAllocateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """IP tahsis eder (manuel veya otomatik)"""
    try:
        allocation = await IPPoolService.allocate_ip(
            db=db,
            pool_id=pool_id,
            peer_id=allocation_data.peer_id,
            peer_public_key=allocation_data.peer_public_key,
            peer_name=allocation_data.peer_name,
            ip_address=allocation_data.ip_address,
            notes=allocation_data.notes
        )

        if not allocation:
            raise HTTPException(status_code=400, detail="IP tahsis edilemedi (havuz dolu veya geçersiz IP)")

        # Activity log
        await ActivityLogger.log(
            db=db,
            request=request,
            action="allocate_ip",
            category="ip_pool",
            description=f"IP tahsis edildi: {allocation.ip_address} → {allocation_data.peer_name or allocation_data.peer_id or 'bilinmeyen'}",
            user=current_user,
            target_type="ip_allocation",
            target_id=str(allocation.id),
            success='success'
        )

        return allocation

    except Exception as e:
        logger.error(f"IP tahsis edilemedi: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ip-pools/{pool_id}/sync")
async def sync_pool_with_mikrotik(
    pool_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Pool'daki mevcut peer IP'lerini MikroTik ile senkronize eder
    MikroTik'te pool aralığındaki IP'leri kullanan peer'lar için allocation kaydı oluşturur
    """
    try:
        from app.mikrotik.connection import mikrotik_conn
        import ipaddress

        # Pool'u al
        pool = await IPPoolService.get_pool(db, pool_id)
        if not pool:
            raise HTTPException(status_code=404, detail="Pool bulunamadı")

        logger.info(f"🔄 Pool senkronizasyonu başlatılıyor: {pool.name} ({pool.interface_name})")

        # MikroTik'ten peer'ları al
        peers = await mikrotik_conn.get_wireguard_peers(pool.interface_name)

        start_ip = ipaddress.ip_address(pool.start_ip)
        end_ip = ipaddress.ip_address(pool.end_ip)

        synced_count = 0
        skipped_count = 0

        # Her peer için kontrol et
        for peer in peers:
            peer_id = peer.get('.id') or peer.get('id')
            allowed_addresses = peer.get('allowed-address', '')

            if not allowed_addresses or not peer_id:
                continue

            # Allowed addresses'i parse et
            for addr in allowed_addresses.split(','):
                addr = addr.strip()
                if '/' in addr:
                    ip_only = addr.split('/')[0]
                else:
                    ip_only = addr

                try:
                    ip_obj = ipaddress.ip_address(ip_only)

                    # IP pool aralığında mı?
                    if start_ip <= ip_obj <= end_ip:
                        # Bu IP için zaten allocation var mı?
                        existing = await IPPoolService.get_allocation_by_peer(db, str(peer_id))

                        if not existing:
                            # Allocation oluştur
                            peer_name = peer.get('comment') or peer.get('name') or str(peer_id)
                            public_key = peer.get('public-key') or peer.get('public_key')

                            allocation = await IPPoolService.allocate_ip(
                                db=db,
                                pool_id=pool.id,
                                ip_address=ip_only,
                                peer_id=str(peer_id),
                                peer_public_key=public_key,
                                peer_name=peer_name,
                                notes=f"Senkronizasyon ile eklendi - {pool.interface_name}"
                            )

                            if allocation:
                                logger.info(f"✅ Senkronize edildi: {ip_only} → {peer_name} (Peer ID: {peer_id})")
                                synced_count += 1
                            else:
                                logger.warning(f"⚠️ Senkronize edilemedi: {ip_only} (zaten tahsisli)")
                                skipped_count += 1
                        else:
                            logger.debug(f"⏭️ Zaten kayıtlı: {ip_only} (Peer ID: {peer_id})")
                            skipped_count += 1

                except (ValueError, Exception) as e:
                    logger.debug(f"IP parse hatası: {addr} - {e}")
                    continue

        # Activity log
        await ActivityLogger.log(
            db=db,
            request=request,
            action="sync_pool",
            category="ip_pool",
            description=f"Pool senkronize edildi: {pool.name} - {synced_count} yeni kayıt, {skipped_count} atlandı",
            user=current_user,
            target_type="ip_pool",
            target_id=str(pool_id),
            success='success'
        )

        logger.info(f"✅ Pool senkronizasyonu tamamlandı: {synced_count} yeni kayıt, {skipped_count} atlandı")

        return {
            "success": True,
            "message": f"Pool senkronize edildi",
            "synced": synced_count,
            "skipped": skipped_count
        }

    except Exception as e:
        logger.error(f"Pool senkronizasyon hatası: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
