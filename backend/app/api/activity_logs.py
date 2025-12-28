"""
Activity Log API endpoints
Aktivite log kayıtları için API endpoint'leri
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.database import get_db
from app.security.auth import get_current_user
from app.services.activity_log_service import ActivityLogService
from app.models.user import User
from typing import Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/activity-logs")
async def get_activity_logs(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user_id: Optional[int] = None,
    category: Optional[str] = None,
    action: Optional[str] = None,
    success: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aktivite loglarını getir

    Args:
        limit: Maksimum kayıt sayısı (1-500)
        offset: Başlangıç offset'i
        user_id: Kullanıcıya göre filtrele (opsiyonel)
        category: Kategoriye göre filtrele (auth, wireguard, user, system, mikrotik)
        action: Aksiyona göre filtrele (login, logout, create_peer, vb.)
        success: Sonuca göre filtrele (success, failure, error)
        start_date: Başlangıç tarihi (ISO format, opsiyonel)
        end_date: Bitiş tarihi (ISO format, opsiyonel)
    """
    try:
        # Tarih string'lerini datetime'a çevir
        start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00')) if start_date else None
        end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00')) if end_date else None

        logs = await ActivityLogService.get_logs(
            db=db,
            limit=limit,
            offset=offset,
            user_id=user_id,
            category=category,
            action=action,
            success=success,
            start_date=start_dt,
            end_date=end_dt,
        )

        total_count = await ActivityLogService.get_log_count(
            db=db,
            user_id=user_id,
            category=category,
            action=action,
            success=success,
            start_date=start_dt,
            end_date=end_dt,
        )

        return {
            "success": True,
            "data": logs,
            "count": len(logs),
            "total": total_count,
            "has_more": (offset + len(logs)) < total_count,
        }

    except Exception as e:
        logger.error(f"Error fetching activity logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/activity-logs/recent")
async def get_recent_activity(
    limit: int = Query(10, ge=1, le=100),
    hours: int = Query(24, ge=1, le=168),  # Max 1 hafta
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Son X saatteki aktiviteleri getir

    Args:
        limit: Maksimum kayıt sayısı
        hours: Kaç saat geriye git (max 168 = 1 hafta)
    """
    try:
        logs = await ActivityLogService.get_recent_activity(
            db=db,
            limit=limit,
            hours=hours,
        )

        return {
            "success": True,
            "data": logs,
            "count": len(logs),
        }

    except Exception as e:
        logger.error(f"Error fetching recent activity: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/activity-logs/stats")
async def get_activity_stats(
    hours: int = Query(24, ge=1, le=720),  # Max 30 gün
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aktivite istatistiklerini getir

    Son X saatteki kategori ve sonuç bazlı istatistikler
    """
    try:
        # Son X saatteki tüm logları al
        logs = await ActivityLogService.get_recent_activity(
            db=db,
            limit=10000,  # Yeterince büyük limit
            hours=hours,
        )

        # İstatistikleri hesapla
        stats = {
            "total": len(logs),
            "by_category": {},
            "by_success": {},
            "by_action": {},
        }

        for log in logs:
            # Kategoriye göre
            category = log.get('category', 'unknown')
            stats['by_category'][category] = stats['by_category'].get(category, 0) + 1

            # Sonuca göre
            success = log.get('success', 'unknown')
            stats['by_success'][success] = stats['by_success'].get(success, 0) + 1

            # Aksiyona göre (top 10)
            action = log.get('action', 'unknown')
            stats['by_action'][action] = stats['by_action'].get(action, 0) + 1

        # Top 10 aksiyon
        top_actions = dict(sorted(
            stats['by_action'].items(),
            key=lambda x: x[1],
            reverse=True
        )[:10])
        stats['by_action'] = top_actions

        return {
            "success": True,
            "data": stats,
            "period_hours": hours,
        }

    except Exception as e:
        logger.error(f"Error fetching activity stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/activity-logs/cleanup")
async def cleanup_old_logs(
    days: int = Query(90, ge=30, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Eski logları temizle (sadece admin)

    Args:
        days: Kaç günden eski logları sil (min 30, max 365)
    """
    try:
        # Sadece admin yapabilir
        if not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Bu işlem için admin yetkisi gerekli")

        deleted_count = await ActivityLogService.cleanup_old_logs(
            db=db,
            days=days,
        )

        return {
            "success": True,
            "message": f"{deleted_count} eski log kaydı silindi",
            "deleted_count": deleted_count,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cleaning up old logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))
