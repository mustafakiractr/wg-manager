"""
Notification API endpoints
Bildirim yönetimi için API endpoint'leri
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.database import get_db
from app.security.auth import get_current_user
from app.services.notification_service import NotificationService
from app.models.notification import Notification
from app.models.user import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/notifications")
async def get_notifications(
    limit: int = 50,
    offset: int = 0,
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Kullanıcının bildirimlerini getir (user-specific)

    Args:
        limit: Maksimum kayıt sayısı (varsayılan: 50)
        offset: Başlangıç offset'i (varsayılan: 0)
        unread_only: Sadece okunmamış bildirimleri getir (varsayılan: False)
    """
    try:
        notifications = await NotificationService.get_notifications(
            db=db,
            user_id=current_user.id,  # User-specific filtering
            limit=limit,
            offset=offset,
            unread_only=unread_only,
        )

        return {
            "success": True,
            "notifications": notifications,
            "count": len(notifications),
        }
    except Exception as e:
        logger.error(f"Bildirimler getirilirken hata: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/notifications/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Kullanıcının okunmamış bildirim sayısını getir"""
    try:
        count = await NotificationService.get_unread_count(
            db=db,
            user_id=current_user.id  # User-specific count
        )
        return {
            "success": True,
            "count": count,
        }
    except Exception as e:
        logger.error(f"Okunmamış bildirim sayısı alınırken hata: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/notifications/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bildirimi okundu olarak işaretle (ownership verification)"""
    try:
        # Ownership verification: Notification belongs to current user?
        result = await db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == current_user.id
            )
        )
        notification = result.scalar_one_or_none()

        if not notification:
            raise HTTPException(
                status_code=404,
                detail="Bildirim bulunamadı veya erişim izniniz yok"
            )

        success = await NotificationService.mark_as_read(
            db=db,
            notification_id=notification_id,
        )

        return {
            "success": success,
            "message": "Bildirim okundu olarak işaretlendi",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bildirim işaretlenirken hata: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/notifications/read-all")
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Kullanıcının tüm bildirimlerini okundu olarak işaretle"""
    try:
        success = await NotificationService.mark_all_as_read(
            db=db,
            user_id=current_user.id  # Only mark current user's notifications
        )

        return {
            "success": success,
            "message": "Tüm bildirimler okundu olarak işaretlendi",
        }
    except Exception as e:
        logger.error(f"Bildirimler işaretlenirken hata: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bildirimi sil (ownership verification)"""
    try:
        # Ownership verification: Notification belongs to current user?
        result = await db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == current_user.id
            )
        )
        notification = result.scalar_one_or_none()

        if not notification:
            raise HTTPException(
                status_code=404,
                detail="Bildirim bulunamadı veya erişim izniniz yok"
            )

        success = await NotificationService.delete_notification(
            db=db,
            notification_id=notification_id,
        )

        return {
            "success": success,
            "message": "Bildirim silindi",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bildirim silinirken hata: {e}")
        raise HTTPException(status_code=500, detail=str(e))
