"""
Telegram Notification Logs API
Gönderilen Telegram bildirimlerinin geçmişi
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Optional
from datetime import datetime, timedelta
from app.database.database import get_db
from app.security.auth import get_current_user
from app.models.user import User
from app.models.telegram_notification_log import TelegramNotificationLog
from app.services.telegram_notification_service import TelegramNotificationService
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/telegram-logs")
async def get_telegram_logs(
    category: Optional[str] = Query(None, description="Bildirim kategorisi filter"),
    status: Optional[str] = Query(None, description="Durum filter (sent/failed)"),
    success: Optional[bool] = Query(None, description="Başarı durumu filter"),
    start_date: Optional[str] = Query(None, description="Başlang tarihi (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Bitiş tarihi (YYYY-MM-DD)"),
    limit: int = Query(50, ge=1, le=500, description="Maksimum kayıt sayısı"),
    offset: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Telegram bildirim geçmişini listele (filtreleme ve pagination ile)
    
    Returns:
        - items: Telegram log kayıtları
        - total: Toplam kayıt sayısı
        - limit: Sayfa başına kayıt
        - offset: Atlanan kayıt sayısı
    """
    try:
        # Parse date strings to datetime objects
        start_datetime = None
        end_datetime = None
        
        if start_date and start_date.strip():
            try:
                start_datetime = datetime.strptime(start_date, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status_code=400, detail="Geçersiz start_date formatı. YYYY-MM-DD kullanın.")
        
        if end_date and end_date.strip():
            try:
                # End date için günün sonunu (23:59:59) kullan
                end_datetime = datetime.strptime(end_date, "%Y-%m-%d")
                end_datetime = end_datetime.replace(hour=23, minute=59, second=59)
            except ValueError:
                raise HTTPException(status_code=400, detail="Geçersiz end_date formatı. YYYY-MM-DD kullanın.")
        
        # Base query
        query = select(TelegramNotificationLog)
        
        # Filters
        if category:
            query = query.where(TelegramNotificationLog.category == category)
        
        if status:
            query = query.where(TelegramNotificationLog.status == status)
        
        if success is not None:
            query = query.where(TelegramNotificationLog.success == success)
        
        if start_datetime:
            query = query.where(TelegramNotificationLog.created_at >= start_datetime)
        
        if end_datetime:
            query = query.where(TelegramNotificationLog.created_at <= end_datetime)
        
        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()
        
        # Apply ordering, limit, offset
        query = query.order_by(desc(TelegramNotificationLog.created_at))
        query = query.limit(limit).offset(offset)
        
        # Execute
        result = await db.execute(query)
        logs = result.scalars().all()
        
        return {
            "success": True,
            "items": [log.to_dict() for log in logs],
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    
    except Exception as e:
        logger.error(f"Telegram logs listesi hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/telegram-logs/{log_id}/resend")
async def resend_telegram_notification(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Başarısız bir Telegram bildirimini tekrar gönder
    
    Args:
        log_id: Telegram log ID
    
    Returns:
        Yeni gönderim sonucu
    """
    try:
        # Log kaydını bul
        result = await db.execute(
            select(TelegramNotificationLog).where(TelegramNotificationLog.id == log_id)
        )
        log = result.scalar_one_or_none()
        
        if not log:
            raise HTTPException(status_code=404, detail="Log kaydı bulunamad")
        
        # Tekrar gönder
        success = await TelegramNotificationService.send_message(
            db=db,
            message=log.message,
            category=log.category,
            title=log.title,
            peer_id=log.peer_id,
            interface_name=log.interface_name,
            user_id=log.user_id,
        )
        
        return {
            "success": True,
            "message": "Bildirim tekrar gönderildi" if success else "Bildirim gönderilemedi",
            "sent": success,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Telegram resend hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/telegram-logs/categories")
async def get_telegram_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Telegram bildirim kategorilerini listele (benzersiz)
    
    Returns:
        Kategori listesi
    """
    try:
        result = await db.execute(
            select(TelegramNotificationLog.category)
            .distinct()
        )
        categories = [row[0] for row in result]
        
        return {
            "success": True,
            "categories": categories,
        }
    
    except Exception as e:
        logger.error(f"Telegram categories hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/telegram-logs/stats")
async def get_telegram_notification_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Telegram bildirim istatistiklerini getir
    
    Returns:
        - total: Toplam mesaj sayısı
        - successful: Başarılı mesaj sayısı
        - failed: Başarısız mesaj sayısı
        - success_rate: Başarı oranı (%)
    """
    try:
        # Toplam mesaj sayısı
        total_result = await db.execute(
            select(func.count(TelegramNotificationLog.id))
        )
        total = total_result.scalar() or 0

        # Başarılı mesajlar
        success_result = await db.execute(
            select(func.count(TelegramNotificationLog.id))
            .where(TelegramNotificationLog.success == True)
        )
        successful = success_result.scalar() or 0

        # Başarısız mesajlar
        failed_result = await db.execute(
            select(func.count(TelegramNotificationLog.id))
            .where(TelegramNotificationLog.success == False)
        )
        failed = failed_result.scalar() or 0

        # Başarı oranı
        success_rate = round((successful / total * 100) if total > 0 else 0, 1)

        return {
            "total": total,
            "successful": successful,
            "failed": failed,
            "success_rate": success_rate,
        }

    except Exception as e:
        logger.error(f"Telegram istatistikleri alınırken hata: {e}")
        raise HTTPException(status_code=500, detail=str(e))
