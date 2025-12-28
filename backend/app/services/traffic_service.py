"""
Trafik kayıt servisi
Sistem trafik kullanımını periyodik olarak kaydeder ve sorgular
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from typing import List, Optional, Dict, Any
from app.models.traffic_log import TrafficLog
from datetime import datetime, timedelta, timezone
import logging

logger = logging.getLogger(__name__)


async def save_traffic_log(
    db: AsyncSession,
    period_type: str,
    total_rx_bytes: int,
    total_tx_bytes: int,
    interface_count: int = 0,
    peer_count: int = 0,
    active_peer_count: int = 0,
    notes: Optional[str] = None
) -> TrafficLog:
    """
    Trafik log kaydı oluşturur
    
    Args:
        db: Veritabanı session'ı
        period_type: Periyot tipi ('hourly', 'daily', 'monthly', 'yearly')
        total_rx_bytes: Toplam indirme (bytes)
        total_tx_bytes: Toplam yükleme (bytes)
        interface_count: Interface sayısı
        peer_count: Peer sayısı
        active_peer_count: Aktif peer sayısı
        notes: Ek notlar
    
    Returns:
        Oluşturulan TrafficLog kaydı
    """
    try:
        # Türkiye saat dilimi (UTC+3)
        turkey_tz = timezone(timedelta(hours=3))
        current_time = datetime.now(turkey_tz)
        
        # MB'ye çevir
        total_rx_mb = total_rx_bytes / (1024 * 1024)
        total_tx_mb = total_tx_bytes / (1024 * 1024)
        
        new_log = TrafficLog(
            timestamp=current_time,
            period_type=period_type,
            total_rx_bytes=total_rx_bytes,
            total_tx_bytes=total_tx_bytes,
            total_rx_mb=total_rx_mb,
            total_tx_mb=total_tx_mb,
            interface_count=interface_count,
            peer_count=peer_count,
            active_peer_count=active_peer_count,
            notes=notes
        )
        
        db.add(new_log)
        await db.commit()
        await db.refresh(new_log)
        logger.info(f"Trafik log kaydı oluşturuldu: {period_type} - RX: {total_rx_mb:.2f} MB, TX: {total_tx_mb:.2f} MB")
        return new_log
    except Exception as e:
        logger.error(f"Trafik log kayıt hatası: {e}")
        await db.rollback()
        raise


async def get_traffic_logs(
    db: AsyncSession,
    period_type: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 1000
) -> List[TrafficLog]:
    """
    Trafik log kayıtlarını getirir
    
    Args:
        db: Veritabanı session'ı
        period_type: Periyot tipi ('hourly', 'daily', 'monthly', 'yearly')
        start_date: Başlangıç tarihi
        end_date: Bitiş tarihi
        limit: Maksimum kayıt sayısı
    
    Returns:
        Trafik log kayıtları listesi
    """
    try:
        query = select(TrafficLog).where(TrafficLog.period_type == period_type)
        
        if start_date:
            query = query.where(TrafficLog.timestamp >= start_date)
        if end_date:
            query = query.where(TrafficLog.timestamp <= end_date)
        
        query = query.order_by(desc(TrafficLog.timestamp)).limit(limit)
        
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        logger.error(f"Trafik log sorgulama hatası: {e}")
        raise


async def get_traffic_summary(
    db: AsyncSession,
    period_type: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Trafik özet istatistiklerini getirir
    
    Args:
        db: Veritabanı session'ı
        period_type: Periyot tipi ('hourly', 'daily', 'monthly', 'yearly')
        start_date: Başlangıç tarihi
        end_date: Bitiş tarihi
    
    Returns:
        Trafik özet istatistikleri
    """
    try:
        query = select(
            func.sum(TrafficLog.total_rx_bytes).label('total_rx'),
            func.sum(TrafficLog.total_tx_bytes).label('total_tx'),
            func.avg(TrafficLog.total_rx_bytes).label('avg_rx'),
            func.avg(TrafficLog.total_tx_bytes).label('avg_tx'),
            func.max(TrafficLog.total_rx_bytes).label('max_rx'),
            func.max(TrafficLog.total_tx_bytes).label('max_tx'),
            func.count(TrafficLog.id).label('record_count')
        ).where(TrafficLog.period_type == period_type)
        
        if start_date:
            query = query.where(TrafficLog.timestamp >= start_date)
        if end_date:
            query = query.where(TrafficLog.timestamp <= end_date)
        
        result = await db.execute(query)
        row = result.first()
        
        if row and row.record_count:
            return {
                "total_rx_bytes": row.total_rx or 0,
                "total_tx_bytes": row.total_tx or 0,
                "total_rx_mb": (row.total_rx or 0) / (1024 * 1024),
                "total_tx_mb": (row.total_tx or 0) / (1024 * 1024),
                "avg_rx_bytes": row.avg_rx or 0,
                "avg_tx_bytes": row.avg_tx or 0,
                "max_rx_bytes": row.max_rx or 0,
                "max_tx_bytes": row.max_tx or 0,
                "record_count": row.record_count
            }
        else:
            return {
                "total_rx_bytes": 0,
                "total_tx_bytes": 0,
                "total_rx_mb": 0.0,
                "total_tx_mb": 0.0,
                "avg_rx_bytes": 0,
                "avg_tx_bytes": 0,
                "max_rx_bytes": 0,
                "max_tx_bytes": 0,
                "record_count": 0
            }
    except Exception as e:
        logger.error(f"Trafik özet sorgulama hatası: {e}")
        raise

