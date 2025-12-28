"""
Peer Template API Endpoints
Peer şablonları yönetimi için REST API
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
from app.security.auth import get_current_user
from app.models.user import User
from app.models.peer_template import PeerTemplate
from app.database.database import get_db
from app.services.peer_template_service import PeerTemplateService
from app.utils.activity_logger import ActivityLogger
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== Pydantic Schemas ====================

class PeerTemplateCreate(BaseModel):
    """Peer template oluşturma modeli"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    allowed_address: Optional[str] = "auto"
    endpoint_address: Optional[str] = None
    endpoint_port: Optional[int] = None
    persistent_keepalive: Optional[int] = 0
    preshared_key: Optional[str] = None
    group_name: Optional[str] = None
    group_color: Optional[str] = None
    tags: Optional[str] = None
    notes_template: Optional[str] = None


class PeerTemplateUpdate(BaseModel):
    """Peer template güncelleme modeli"""
    name: Optional[str] = None
    description: Optional[str] = None
    allowed_address: Optional[str] = None
    endpoint_address: Optional[str] = None
    endpoint_port: Optional[int] = None
    persistent_keepalive: Optional[int] = None
    preshared_key: Optional[str] = None
    group_name: Optional[str] = None
    group_color: Optional[str] = None
    tags: Optional[str] = None
    notes_template: Optional[str] = None
    is_active: Optional[bool] = None


class PeerTemplateResponse(BaseModel):
    """Peer template response modeli"""
    id: int
    name: str
    description: Optional[str]
    allowed_address: Optional[str]
    endpoint_address: Optional[str]
    endpoint_port: Optional[int]
    persistent_keepalive: Optional[int]
    preshared_key: Optional[str]
    group_name: Optional[str]
    group_color: Optional[str]
    tags: Optional[str]
    notes_template: Optional[str]
    usage_count: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    last_used_at: Optional[datetime]

    class Config:
        from_attributes = True


# ==================== API Endpoints ====================

@router.post("/peer-templates", response_model=PeerTemplateResponse, status_code=201)
async def create_template(
    template_data: PeerTemplateCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Yeni peer şablonu oluşturur"""
    try:
        template = await PeerTemplateService.create_template(
            db,
            name=template_data.name,
            description=template_data.description,
            allowed_address=template_data.allowed_address,
            endpoint_address=template_data.endpoint_address,
            endpoint_port=template_data.endpoint_port,
            persistent_keepalive=template_data.persistent_keepalive,
            preshared_key=template_data.preshared_key,
            group_name=template_data.group_name,
            group_color=template_data.group_color,
            tags=template_data.tags,
            notes_template=template_data.notes_template
        )

        # Activity log
        await ActivityLogger.log(
            db=db,
            request=request,
            action="create_peer_template",
            category="template",
            description=f"Peer şablonu oluşturuldu: {template.name}",
            user=current_user,
            target_type="template",
            target_id=str(template.id),
            success='success'
        )

        return template

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Peer şablonu oluşturulamadı: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/peer-templates", response_model=List[PeerTemplateResponse])
async def list_templates(
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Tüm peer şablonlarını listeler

    Query params:
    - is_active: Aktif/pasif filtrele
    """
    try:
        templates = await PeerTemplateService.get_all_templates(db, is_active)
        return templates
    except Exception as e:
        logger.error(f"Peer şablonları listelenemedi: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/peer-templates/{template_id}", response_model=PeerTemplateResponse)
async def get_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Belirli bir peer şablonunu getirir"""
    template = await PeerTemplateService.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")

    return template


@router.put("/peer-templates/{template_id}", response_model=PeerTemplateResponse)
async def update_template(
    template_id: int,
    template_data: PeerTemplateUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Peer şablonunu günceller"""
    try:
        # Sadece değişen alanları al
        update_data = template_data.model_dump(exclude_unset=True)

        if not update_data:
            raise HTTPException(status_code=400, detail="Güncellenecek alan belirtilmedi")

        template = await PeerTemplateService.update_template(db, template_id, **update_data)

        # Activity log
        await ActivityLogger.log(
            db=db,
            request=request,
            action="update_peer_template",
            category="template",
            description=f"Peer şablonu güncellendi: {template.name}",
            user=current_user,
            target_type="template",
            target_id=str(template.id),
            success='success'
        )

        return template

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Peer şablonu güncellenemedi: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/peer-templates/{template_id}")
async def delete_template(
    template_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Peer şablonunu siler"""
    try:
        # Önce template bilgisini al (log için)
        template = await PeerTemplateService.get_template(db, template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Şablon bulunamadı")

        template_name = template.name
        success = await PeerTemplateService.delete_template(db, template_id)

        if not success:
            raise HTTPException(status_code=404, detail="Şablon bulunamadı")

        # Activity log
        await ActivityLogger.log(
            db=db,
            request=request,
            action="delete_peer_template",
            category="template",
            description=f"Peer şablonu silindi: {template_name}",
            user=current_user,
            target_type="template",
            target_id=str(template_id),
            success='success'
        )

        return {"success": True, "message": "Peer şablonu silindi"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Peer şablonu silinemedi: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/peer-templates/{template_id}/toggle")
async def toggle_template_active(
    template_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Peer şablonunu aktif/pasif yapar"""
    try:
        template = await PeerTemplateService.toggle_active(db, template_id)

        # Activity log
        await ActivityLogger.log(
            db=db,
            request=request,
            action="toggle_peer_template",
            category="template",
            description=f"Peer şablonu {'aktif' if template.is_active else 'pasif'} yapıldı: {template.name}",
            user=current_user,
            target_type="template",
            target_id=str(template.id),
            success='success'
        )

        return {
            "success": True,
            "message": f"Şablon {'aktif' if template.is_active else 'pasif'} yapıldı",
            "is_active": template.is_active
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Peer şablonu durumu değiştirilemedi: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/peer-templates/{template_id}/preview")
async def preview_template_data(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Şablondan oluşturulacak peer verilerini önizler
    (Template'i kullanmadan sadece nasıl görüneceğini gösterir)
    """
    try:
        template = await PeerTemplateService.get_template(db, template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Şablon bulunamadı")

        peer_data = PeerTemplateService.prepare_peer_data_from_template(template)

        return {
            "success": True,
            "template_name": template.name,
            "peer_data": peer_data
        }

    except Exception as e:
        logger.error(f"Şablon önizlemesi oluşturulamadı: {e}")
        raise HTTPException(status_code=500, detail=str(e))
