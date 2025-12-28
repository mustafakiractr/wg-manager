"""
Peer trafik kayıt servisi
Her peer'ın trafik kullanımını periyodik olarak kaydeder ve sorgular
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from typing import List, Optional, Dict, Any
from app.models.peer_traffic_log import PeerTrafficLog
from datetime import datetime, timedelta, timezone
import logging

logger = logging.getLogger(__name__)


async def save_peer_traffic_log(
    db: AsyncSession,
    peer_id: str,
    interface_name: str,
    peer_name: Optional[str],
    public_key: Optional[str],
    period_type: str,
    rx_bytes: int,
    tx_bytes: int,
    notes: Optional[str] = None
) -> PeerTrafficLog:
    """
    Peer trafik log kaydı oluşturur
    
    Args:
        db: Veritabanı session'ı
        peer_id: MikroTik peer ID
        interface_name: Interface adı
        peer_name: Peer adı/comment
        public_key: Peer public key
        period_type: Periyot tipi ('hourly', 'daily', 'monthly', 'yearly')
        rx_bytes: İndirme (bytes)
        tx_bytes: Yükleme (bytes)
        notes: Ek notlar
    
    Returns:
        Oluşturulan PeerTrafficLog kaydı
    """
    try:
        # Türkiye saat dilimi (UTC+3)
        turkey_tz = timezone(timedelta(hours=3))
        current_time = datetime.now(turkey_tz)
        
        # MB'ye çevir
        rx_mb = rx_bytes / (1024 * 1024)
        tx_mb = tx_bytes / (1024 * 1024)
        
        new_log = PeerTrafficLog(
            timestamp=current_time,
            peer_id=peer_id,
            interface_name=interface_name,
            peer_name=peer_name,
            public_key=public_key,
            period_type=period_type,
            rx_bytes=rx_bytes,
            tx_bytes=tx_bytes,
            rx_mb=rx_mb,
            tx_mb=tx_mb,
            notes=notes
        )
        
        db.add(new_log)
        await db.commit()
        await db.refresh(new_log)
        logger.debug(f"Peer trafik log kaydı oluşturuldu: {peer_id} ({interface_name}) - {period_type} - RX: {rx_mb:.2f} MB, TX: {tx_mb:.2f} MB")
        return new_log
    except Exception as e:
        logger.error(f"Peer trafik log kayıt hatası: {e}")
        await db.rollback()
        raise


async def get_peer_traffic_logs(
    db: AsyncSession,
    peer_id: str,
    interface_name: str,
    period_type: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 1000
) -> List[PeerTrafficLog]:
    """
    Peer trafik log kayıtlarını getirir
    
    Args:
        db: Veritabanı session'ı
        peer_id: MikroTik peer ID
        interface_name: Interface adı
        period_type: Periyot tipi ('hourly', 'daily', 'monthly', 'yearly')
        start_date: Başlangıç tarihi
        end_date: Bitiş tarihi
        limit: Maksimum kayıt sayısı
    
    Returns:
        Peer trafik log kayıtları listesi
    """
    try:
        query = select(PeerTrafficLog).where(
            and_(
                PeerTrafficLog.peer_id == peer_id,
                PeerTrafficLog.interface_name == interface_name,
                PeerTrafficLog.period_type == period_type
            )
        )
        
        if start_date:
            query = query.where(PeerTrafficLog.timestamp >= start_date)
        if end_date:
            query = query.where(PeerTrafficLog.timestamp <= end_date)
        
        query = query.order_by(desc(PeerTrafficLog.timestamp)).limit(limit)
        
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        logger.error(f"Peer trafik log sorgulama hatası: {e}")
        raise


async def get_peer_traffic_summary(
    db: AsyncSession,
    peer_id: str,
    interface_name: str,
    period_type: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Peer trafik özet istatistiklerini getirir
    
    Args:
        db: Veritabanı session'ı
        peer_id: MikroTik peer ID
        interface_name: Interface adı
        period_type: Periyot tipi ('hourly', 'daily', 'monthly', 'yearly')
        start_date: Başlangıç tarihi
        end_date: Bitiş tarihi
    
    Returns:
        Peer trafik özet istatistikleri
    """
    try:
        query = select(
            func.sum(PeerTrafficLog.rx_bytes).label('total_rx'),
            func.sum(PeerTrafficLog.tx_bytes).label('total_tx'),
            func.avg(PeerTrafficLog.rx_bytes).label('avg_rx'),
            func.avg(PeerTrafficLog.tx_bytes).label('avg_tx'),
            func.max(PeerTrafficLog.rx_bytes).label('max_rx'),
            func.max(PeerTrafficLog.tx_bytes).label('max_tx'),
            func.count(PeerTrafficLog.id).label('record_count')
        ).where(
            and_(
                PeerTrafficLog.peer_id == peer_id,
                PeerTrafficLog.interface_name == interface_name,
                PeerTrafficLog.period_type == period_type
            )
        )
        
        if start_date:
            query = query.where(PeerTrafficLog.timestamp >= start_date)
        if end_date:
            query = query.where(PeerTrafficLog.timestamp <= end_date)
        
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
        logger.error(f"Peer trafik özet sorgulama hatası: {e}")
        raise

