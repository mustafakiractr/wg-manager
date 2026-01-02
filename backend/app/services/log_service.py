"""
Log servisi
Kullanıcı işlemlerini veritabanına kaydeder
"""
import asyncio
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from app.models.log_entry import LogEntry
from datetime import datetime

logger = logging.getLogger(__name__)


async def create_log(
    db: AsyncSession,
    username: str,
    action: str,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
    max_retries: int = 3,
    timeout: float = 5.0
) -> Optional[LogEntry]:
    """
    Yeni log kaydı oluşturur
    Database locked hatası için retry mekanizması içerir
    
    Args:
        db: Veritabanı session'ı
        username: İşlemi yapan kullanıcı
        action: Yapılan işlem (örn: "peer_added")
        details: Detaylı bilgi (JSON string olabilir)
        ip_address: Kullanıcı IP adresi
        max_retries: Maksimum deneme sayısı (default: 3)
        timeout: Her deneme için timeout süresi (saniye, default: 5.0)
    
    Returns:
        Oluşturulan log kaydı veya None (hata durumunda)
    """
    log_entry = LogEntry(
        username=username,
        action=action,
        details=details,
        ip_address=ip_address
    )
    
    # Retry mekanizması ile log kaydı yap
    for attempt in range(max_retries):
        try:
            db.add(log_entry)
            # Timeout ile commit yap
            await asyncio.wait_for(db.commit(), timeout=timeout)
            await db.refresh(log_entry)
            logger.debug(f"Log kaydı başarıyla oluşturuldu: {action} - {username}")
            return log_entry
        except asyncio.TimeoutError:
            logger.warning(f"Log kaydı timeout (deneme {attempt + 1}/{max_retries}): {action} - {username}")
            if attempt < max_retries - 1:
                # Kısa bir bekleme sonrası tekrar dene
                await asyncio.sleep(0.5 * (attempt + 1))
                # Rollback yap ve tekrar dene
                try:
                    await db.rollback()
                except Exception as rollback_error:
                    logger.debug(f"Rollback hatası (göz ardı edildi): {rollback_error}")
            else:
                logger.error(f"Log kaydı başarısız (timeout): {action} - {username}")
                try:
                    await db.rollback()
                except Exception as rollback_error:
                    logger.debug(f"Rollback hatası (göz ardı edildi): {rollback_error}")
                return None
        except Exception as e:
            error_msg = str(e)
            # Database locked hatası için retry yap
            if "locked" in error_msg.lower() or "database" in error_msg.lower():
                logger.warning(f"Database locked hatası (deneme {attempt + 1}/{max_retries}): {action} - {username}")
                if attempt < max_retries - 1:
                    # Kısa bir bekleme sonrası tekrar dene
                    await asyncio.sleep(0.5 * (attempt + 1))
                    # Rollback yap ve tekrar dene
                    try:
                        await db.rollback()
                    except Exception as rollback_error:
                        logger.debug(f"Rollback hatası (göz ardı edildi): {rollback_error}")
                else:
                    logger.error(f"Log kaydı başarısız (database locked): {action} - {username}")
                    try:
                        await db.rollback()
                    except Exception as rollback_error:
                        logger.debug(f"Rollback hatası (göz ardı edildi): {rollback_error}")
                    return None
            else:
                # Diğer hatalar için log yaz ve None döndür
                logger.error(f"Log kaydı hatası: {error_msg} - {action} - {username}")
                try:
                    await db.rollback()
                except Exception as rollback_error:
                    logger.debug(f"Rollback hatası (göz ardı edildi): {rollback_error}")
                return None
    
    return None


async def get_logs(
    db: AsyncSession,
    limit: int = 100,
    offset: int = 0,
    username: Optional[str] = None
) -> List[LogEntry]:
    """
    Log kayıtlarını getirir
    
    Args:
        db: Veritabanı session'ı
        limit: Maksimum kayıt sayısı
        offset: Atlanacak kayıt sayısı
        username: Filtreleme için kullanıcı adı
    
    Returns:
        Log kayıt listesi
    """
    query = select(LogEntry).order_by(desc(LogEntry.created_at))
    
    if username:
        query = query.where(LogEntry.username == username)
    
    query = query.limit(limit).offset(offset)
    
    result = await db.execute(query)
    return result.scalars().all()


