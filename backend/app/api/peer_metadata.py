"""
Peer Metadata API Endpoints
Peer metadata yönetimi için REST API
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
from app.security.auth import get_current_user
from app.models.user import User
from app.models.peer_metadata import PeerMetadata
from app.database.database import get_db
from app.services.peer_metadata_service import PeerMetadataService
from app.utils.activity_logger import ActivityLogger
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== Pydantic Schemas ====================

class PeerMetadataUpdate(BaseModel):
    """Peer metadata güncelleme modeli"""
    group_name: Optional[str] = None
    group_color: Optional[str] = None
    tags: Optional[str] = None
    notes: Optional[str] = None


class PeerMetadataResponse(BaseModel):
    """Peer metadata response modeli"""
    id: int
    peer_id: str
    interface_name: str
    public_key: Optional[str]
    group_name: Optional[str]
    group_color: Optional[str]
    tags: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BulkGroupUpdate(BaseModel):
    """Toplu grup güncelleme modeli"""
    peer_ids: List[tuple]  # [(peer_id, interface_name), ...]
    group_name: str
    group_color: Optional[str] = None


# ==================== API Endpoints ====================

@router.get("/peer-metadata", response_model=List[PeerMetadataResponse])
async def list_peer_metadata(
    interface_name: Optional[str] = None,
    group_name: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Tüm peer metadata'larını listeler

    Query params:
    - interface_name: Interface'e göre filtrele
    - group_name: Gruba göre filtrele
    """
    try:
        metadata_list = await PeerMetadataService.get_all_metadata(
            db, interface_name, group_name
        )
        return metadata_list
    except Exception as e:
        logger.error(f"Peer metadata listelenemedi: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/peer-metadata/{peer_id}/{interface_name}", response_model=PeerMetadataResponse)
async def get_peer_metadata(
    peer_id: str,
    interface_name: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Peer metadata'sını getirir"""
    metadata = await PeerMetadataService.get_metadata(db, peer_id, interface_name)
    if not metadata:
        # Yoksa oluştur
        metadata = await PeerMetadataService.get_or_create_metadata(
            db, peer_id, interface_name
        )

    return metadata


@router.put("/peer-metadata/{peer_id}/{interface_name}", response_model=PeerMetadataResponse)
async def update_peer_metadata(
    peer_id: str,
    interface_name: str,
    metadata_data: PeerMetadataUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Peer metadata'sını günceller"""
    try:
        # Sadece değişen alanları al
        update_data = metadata_data.model_dump(exclude_unset=True)

        if not update_data:
            raise HTTPException(status_code=400, detail="Güncellenecek alan belirtilmedi")

        metadata = await PeerMetadataService.update_metadata(
            db, peer_id, interface_name, **update_data
        )

        # Activity log
        await ActivityLogger.log(
            db=db,
            request=request,
            action="update_peer_metadata",
            category="peer",
            description=f"Peer metadata güncellendi: {peer_id}",
            user=current_user,
            target_type="peer",
            target_id=peer_id,
            success='success'
        )

        return metadata

    except Exception as e:
        logger.error(f"Peer metadata güncellenemedi: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/peer-metadata/{peer_id}/{interface_name}")
async def delete_peer_metadata(
    peer_id: str,
    interface_name: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Peer metadata'sını siler"""
    try:
        success = await PeerMetadataService.delete_metadata(db, peer_id, interface_name)

        if not success:
            raise HTTPException(status_code=404, detail="Peer metadata bulunamadı")

        # Activity log
        await ActivityLogger.log(
            db=db,
            request=request,
            action="delete_peer_metadata",
            category="peer",
            description=f"Peer metadata silindi: {peer_id}",
            user=current_user,
            target_type="peer",
            target_id=peer_id,
            success='success'
        )

        return {"success": True, "message": "Peer metadata silindi"}

    except Exception as e:
        logger.error(f"Peer metadata silinemedi: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/peer-groups")
async def list_peer_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tüm peer gruplarını listeler"""
    try:
        groups = await PeerMetadataService.get_all_groups(db)
        return {"success": True, "data": groups}
    except Exception as e:
        logger.error(f"Peer grupları listelenemedi: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/peer-metadata/bulk-group")
async def bulk_update_peer_group(
    bulk_data: BulkGroupUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Birden fazla peer'ın grubunu günceller"""
    try:
        count = await PeerMetadataService.bulk_update_group(
            db,
            bulk_data.peer_ids,
            bulk_data.group_name,
            bulk_data.group_color
        )

        # Activity log
        await ActivityLogger.log(
            db=db,
            request=request,
            action="bulk_update_peer_group",
            category="peer",
            description=f"{count} peer'ın grubu güncellendi: {bulk_data.group_name}",
            user=current_user,
            target_type="peer",
            target_id="bulk",
            success='success'
        )

        return {
            "success": True,
            "message": f"{count} peer'ın grubu güncellendi",
            "count": count
        }

    except Exception as e:
        logger.error(f"Toplu grup güncelleme hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))
