"""
Trafik geçmişi API endpoint'leri
Trafik kullanım verilerini kaydetme ve sorgulama
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta, timezone
from app.security.auth import get_current_user
from app.models.user import User
from app.database.database import get_db
from app.services.traffic_service import (
    save_traffic_log,
    get_traffic_logs,
    get_traffic_summary
)
from app.services.peer_traffic_service import (
    save_peer_traffic_log,
    get_peer_traffic_logs,
    get_peer_traffic_summary
)
from app.mikrotik.connection import mikrotik_conn
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/hourly")
async def get_hourly_traffic(
    start_date: Optional[str] = Query(None, description="Başlangıç tarihi (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Bitiş tarihi (YYYY-MM-DD)"),
    limit: int = Query(100, ge=1, le=1000, description="Maksimum kayıt sayısı"),
    offset: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Saatlik trafik verilerini getirir (pagination destekli)
    """
    try:
        # Tarih parse et (Türkiye saat dilimi - UTC+3)
        turkey_tz = timezone(timedelta(hours=3))
        start_dt = None
        end_dt = None
        
        # Tarih filtresi yoksa son 7 günü göster (performans için)
        if not start_date and not end_date:
            end_dt = datetime.now(turkey_tz)
            start_dt = end_dt - timedelta(days=7)
        
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=turkey_tz)
            except ValueError:
                raise HTTPException(status_code=400, detail="Geçersiz başlangıç tarihi formatı. YYYY-MM-DD formatında olmalı.")
        
        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=turkey_tz)
            except ValueError:
                raise HTTPException(status_code=400, detail="Geçersiz bitiş tarihi formatı. YYYY-MM-DD formatında olmalı.")
        
        logs = await get_traffic_logs(db, "hourly", start_dt, end_dt, limit=limit)
        summary = await get_traffic_summary(db, "hourly", start_dt, end_dt)
        
        return {
            "success": True,
            "period_type": "hourly",
            "data": [
                {
                    "id": log.id,
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                    "total_rx_mb": log.total_rx_mb,
                    "total_tx_mb": log.total_tx_mb,
                    "total_rx_bytes": log.total_rx_bytes,
                    "total_tx_bytes": log.total_tx_bytes,
                    "interface_count": log.interface_count,
                    "peer_count": log.peer_count,
                    "active_peer_count": log.active_peer_count,
                }
                for log in logs
            ],
            "summary": summary,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "count": len(logs)
            }
        }
    except Exception as e:
        logger.error(f"Saatlik trafik sorgulama hatası: {e}")
        raise HTTPException(status_code=500, detail=f"Veri alınamadı: {str(e)}")


@router.get("/daily")
async def get_daily_traffic(
    start_date: Optional[str] = Query(None, description="Başlangıç tarihi (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Bitiş tarihi (YYYY-MM-DD)"),
    limit: int = Query(100, ge=1, le=1000, description="Maksimum kayıt sayısı"),
    offset: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Günlük trafik verilerini getirir (pagination destekli)
    """
    try:
        # Tarih parse et (Türkiye saat dilimi - UTC+3)
        turkey_tz = timezone(timedelta(hours=3))
        start_dt = None
        end_dt = None
        
        # Tarih filtresi yoksa son 30 günü göster (performans için)
        if not start_date and not end_date:
            end_dt = datetime.now(turkey_tz)
            start_dt = end_dt - timedelta(days=30)
        
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=turkey_tz)
            except ValueError:
                raise HTTPException(status_code=400, detail="Geçersiz başlangıç tarihi formatı. YYYY-MM-DD formatında olmalı.")
        
        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=turkey_tz)
            except ValueError:
                raise HTTPException(status_code=400, detail="Geçersiz bitiş tarihi formatı. YYYY-MM-DD formatında olmalı.")
        
        logs = await get_traffic_logs(db, "daily", start_dt, end_dt, limit=limit)
        summary = await get_traffic_summary(db, "daily", start_dt, end_dt)
        
        return {
            "success": True,
            "period_type": "daily",
            "data": [
                {
                    "id": log.id,
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                    "total_rx_mb": log.total_rx_mb,
                    "total_tx_mb": log.total_tx_mb,
                    "total_rx_bytes": log.total_rx_bytes,
                    "total_tx_bytes": log.total_tx_bytes,
                    "interface_count": log.interface_count,
                    "peer_count": log.peer_count,
                    "active_peer_count": log.active_peer_count,
                }
                for log in logs
            ],
            "summary": summary,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "count": len(logs)
            }
        }
    except Exception as e:
        logger.error(f"Günlük trafik sorgulama hatası: {e}")
        raise HTTPException(status_code=500, detail=f"Veri alınamadı: {str(e)}")


@router.get("/monthly")
async def get_monthly_traffic(
    start_date: Optional[str] = Query(None, description="Başlangıç tarihi (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Bitiş tarihi (YYYY-MM-DD)"),
    limit: int = Query(100, ge=1, le=1000, description="Maksimum kayıt sayısı"),
    offset: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Aylık trafik verilerini getirir (pagination destekli)
    """
    try:
        # Tarih parse et (Türkiye saat dilimi - UTC+3)
        turkey_tz = timezone(timedelta(hours=3))
        start_dt = None
        end_dt = None
        
        # Tarih filtresi yoksa son 12 ayı göster (performans için)
        if not start_date and not end_date:
            end_dt = datetime.now(turkey_tz)
            start_dt = end_dt - timedelta(days=365)
        
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=turkey_tz)
            except ValueError:
                raise HTTPException(status_code=400, detail="Geçersiz başlangıç tarihi formatı. YYYY-MM-DD formatında olmalı.")
        
        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=turkey_tz)
            except ValueError:
                raise HTTPException(status_code=400, detail="Geçersiz bitiş tarihi formatı. YYYY-MM-DD formatında olmalı.")
        
        logs = await get_traffic_logs(db, "monthly", start_dt, end_dt, limit=limit)
        summary = await get_traffic_summary(db, "monthly", start_dt, end_dt)
        
        return {
            "success": True,
            "period_type": "monthly",
            "data": [
                {
                    "id": log.id,
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                    "total_rx_mb": log.total_rx_mb,
                    "total_tx_mb": log.total_tx_mb,
                    "total_rx_bytes": log.total_rx_bytes,
                    "total_tx_bytes": log.total_tx_bytes,
                    "interface_count": log.interface_count,
                    "peer_count": log.peer_count,
                    "active_peer_count": log.active_peer_count,
                }
                for log in logs
            ],
            "summary": summary,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "count": len(logs)
            }
        }
    except Exception as e:
        logger.error(f"Aylık trafik sorgulama hatası: {e}")
        raise HTTPException(status_code=500, detail=f"Veri alınamadı: {str(e)}")


@router.get("/yearly")
async def get_yearly_traffic(
    start_date: Optional[str] = Query(None, description="Başlangıç tarihi (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Bitiş tarihi (YYYY-MM-DD)"),
    limit: int = Query(100, ge=1, le=1000, description="Maksimum kayıt sayısı"),
    offset: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Yıllık trafik verilerini getirir (pagination destekli)
    """
    try:
        # Tarih parse et (Türkiye saat dilimi - UTC+3)
        turkey_tz = timezone(timedelta(hours=3))
        start_dt = None
        end_dt = None
        
        # Tarih filtresi yoksa son 5 yılı göster (performans için)
        if not start_date and not end_date:
            end_dt = datetime.now(turkey_tz)
            start_dt = end_dt - timedelta(days=1825)  # 5 yıl
        
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=turkey_tz)
            except ValueError:
                raise HTTPException(status_code=400, detail="Geçersiz başlangıç tarihi formatı. YYYY-MM-DD formatında olmalı.")
        
        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=turkey_tz)
            except ValueError:
                raise HTTPException(status_code=400, detail="Geçersiz bitiş tarihi formatı. YYYY-MM-DD formatında olmalı.")
        
        logs = await get_traffic_logs(db, "yearly", start_dt, end_dt, limit=limit)
        summary = await get_traffic_summary(db, "yearly", start_dt, end_dt)
        
        return {
            "success": True,
            "period_type": "yearly",
            "data": [
                {
                    "id": log.id,
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                    "total_rx_mb": log.total_rx_mb,
                    "total_tx_mb": log.total_tx_mb,
                    "total_rx_bytes": log.total_rx_bytes,
                    "total_tx_bytes": log.total_tx_bytes,
                    "interface_count": log.interface_count,
                    "peer_count": log.peer_count,
                    "active_peer_count": log.active_peer_count,
                }
                for log in logs
            ],
            "summary": summary,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "count": len(logs)
            }
        }
    except Exception as e:
        logger.error(f"Yıllık trafik sorgulama hatası: {e}")
        raise HTTPException(status_code=500, detail=f"Veri alınamadı: {str(e)}")


@router.post("/record")
async def record_traffic(
    period_type: str = Query(..., description="Periyot tipi: hourly, daily, monthly, yearly"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Mevcut trafik kullanımını kaydeder
    """
    try:
        # MikroTik bağlantısını kontrol et
        await mikrotik_conn.ensure_connected()
        
        # Tüm interface'leri al
        interfaces = await mikrotik_conn.get_wireguard_interfaces()
        total_rx_bytes = 0
        total_tx_bytes = 0
        interface_count = len(interfaces)
        peer_count = 0
        active_peer_count = 0
        
        # Her interface için peer'ları al ve trafik topla
        for iface in interfaces:
            interface_name = iface.get('name') or iface.get('.id')
            if interface_name:
                try:
                    peers = await mikrotik_conn.get_wireguard_peers(interface_name)
                    peer_count += len(peers)
                    
                    for peer in peers:
                        # Aktif peer sayısını kontrol et
                        disabled = peer.get('disabled', 'true')
                        if disabled == 'false' or disabled is False:
                            active_peer_count += 1
                        
                        # Trafik verilerini topla
                        rx_bytes = int(peer.get('rx-bytes') or peer.get('rx') or 0)
                        tx_bytes = int(peer.get('tx-bytes') or peer.get('tx') or 0)
                        total_rx_bytes += rx_bytes
                        total_tx_bytes += tx_bytes
                except Exception as e:
                    logger.error(f"Peer trafik verisi alınamadı ({interface_name}): {e}")
        
        # Trafik log kaydı oluştur
        log = await save_traffic_log(
            db=db,
            period_type=period_type,
            total_rx_bytes=total_rx_bytes,
            total_tx_bytes=total_tx_bytes,
            interface_count=interface_count,
            peer_count=peer_count,
            active_peer_count=active_peer_count
        )
        
        return {
            "success": True,
            "message": f"Trafik kaydı oluşturuldu: {period_type}",
            "data": {
                "id": log.id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "total_rx_mb": log.total_rx_mb,
                "total_tx_mb": log.total_tx_mb,
                "total_rx_bytes": log.total_rx_bytes,
                "total_tx_bytes": log.total_tx_bytes,
            }
        }
    except Exception as e:
        logger.error(f"Trafik kayıt hatası: {e}")
        raise HTTPException(status_code=500, detail=f"Trafik kaydedilemedi: {str(e)}")


@router.get("/peer/{peer_id}/hourly")
async def get_peer_hourly_traffic(
    peer_id: str,
    interface: str = Query(..., description="Interface adı"),
    start_date: Optional[str] = Query(None, description="Başlangıç tarihi (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Bitiş tarihi (YYYY-MM-DD)"),
    limit: int = Query(100, ge=1, le=1000, description="Maksimum kayıt sayısı"),
    offset: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Peer saatlik trafik verilerini getirir (pagination destekli)"""
    try:
        from urllib.parse import unquote
        peer_id = unquote(peer_id)
        interface = unquote(interface)
        
        turkey_tz = timezone(timedelta(hours=3))
        start_dt = None
        end_dt = None
        
        # Tarih filtresi yoksa son 7 günü göster (performans için)
        if not start_date and not end_date:
            end_dt = datetime.now(turkey_tz)
            start_dt = end_dt - timedelta(days=7)
        
        if start_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=turkey_tz)
        if end_date:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=turkey_tz)
        
        logs = await get_peer_traffic_logs(db, peer_id, interface, "hourly", start_dt, end_dt, limit=limit)
        summary = await get_peer_traffic_summary(db, peer_id, interface, "hourly", start_dt, end_dt)
        
        return {
            "success": True,
            "period_type": "hourly",
            "data": [
                {
                    "id": log.id,
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                    "rx_mb": log.rx_mb,
                    "tx_mb": log.tx_mb,
                    "rx_bytes": log.rx_bytes,
                    "tx_bytes": log.tx_bytes,
                }
                for log in logs
            ],
            "summary": summary,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "count": len(logs)
            }
        }
    except Exception as e:
        logger.error(f"Peer saatlik trafik sorgulama hatası: {e}")
        raise HTTPException(status_code=500, detail=f"Veri alınamadı: {str(e)}")


@router.get("/peer/{peer_id}/daily")
async def get_peer_daily_traffic(
    peer_id: str,
    interface: str = Query(..., description="Interface adı"),
    start_date: Optional[str] = Query(None, description="Başlangıç tarihi (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Bitiş tarihi (YYYY-MM-DD)"),
    limit: int = Query(100, ge=1, le=1000, description="Maksimum kayıt sayısı"),
    offset: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Peer günlük trafik verilerini getirir (pagination destekli)"""
    try:
        from urllib.parse import unquote
        peer_id = unquote(peer_id)
        interface = unquote(interface)
        
        turkey_tz = timezone(timedelta(hours=3))
        start_dt = None
        end_dt = None
        
        # Tarih filtresi yoksa son 30 günü göster (performans için)
        if not start_date and not end_date:
            end_dt = datetime.now(turkey_tz)
            start_dt = end_dt - timedelta(days=30)
        
        if start_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=turkey_tz)
        if end_date:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=turkey_tz)
        
        logs = await get_peer_traffic_logs(db, peer_id, interface, "daily", start_dt, end_dt, limit=limit)
        summary = await get_peer_traffic_summary(db, peer_id, interface, "daily", start_dt, end_dt)
        
        return {
            "success": True,
            "period_type": "daily",
            "data": [
                {
                    "id": log.id,
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                    "rx_mb": log.rx_mb,
                    "tx_mb": log.tx_mb,
                    "rx_bytes": log.rx_bytes,
                    "tx_bytes": log.tx_bytes,
                }
                for log in logs
            ],
            "summary": summary,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "count": len(logs)
            }
        }
    except Exception as e:
        logger.error(f"Peer günlük trafik sorgulama hatası: {e}")
        raise HTTPException(status_code=500, detail=f"Veri alınamadı: {str(e)}")


@router.get("/peer/{peer_id}/monthly")
async def get_peer_monthly_traffic(
    peer_id: str,
    interface: str = Query(..., description="Interface adı"),
    start_date: Optional[str] = Query(None, description="Başlangıç tarihi (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Bitiş tarihi (YYYY-MM-DD)"),
    limit: int = Query(100, ge=1, le=1000, description="Maksimum kayıt sayısı"),
    offset: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Peer aylık trafik verilerini getirir (pagination destekli)"""
    try:
        from urllib.parse import unquote
        peer_id = unquote(peer_id)
        interface = unquote(interface)
        
        turkey_tz = timezone(timedelta(hours=3))
        start_dt = None
        end_dt = None
        
        # Tarih filtresi yoksa son 12 ayı göster (performans için)
        if not start_date and not end_date:
            end_dt = datetime.now(turkey_tz)
            start_dt = end_dt - timedelta(days=365)
        
        if start_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=turkey_tz)
        if end_date:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=turkey_tz)
        
        logs = await get_peer_traffic_logs(db, peer_id, interface, "monthly", start_dt, end_dt, limit=limit)
        summary = await get_peer_traffic_summary(db, peer_id, interface, "monthly", start_dt, end_dt)
        
        return {
            "success": True,
            "period_type": "monthly",
            "data": [
                {
                    "id": log.id,
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                    "rx_mb": log.rx_mb,
                    "tx_mb": log.tx_mb,
                    "rx_bytes": log.rx_bytes,
                    "tx_bytes": log.tx_bytes,
                }
                for log in logs
            ],
            "summary": summary,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "count": len(logs)
            }
        }
    except Exception as e:
        logger.error(f"Peer aylık trafik sorgulama hatası: {e}")
        raise HTTPException(status_code=500, detail=f"Veri alınamadı: {str(e)}")


@router.get("/peer/{peer_id}/yearly")
async def get_peer_yearly_traffic(
    peer_id: str,
    interface: str = Query(..., description="Interface adı"),
    start_date: Optional[str] = Query(None, description="Başlangıç tarihi (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Bitiş tarihi (YYYY-MM-DD)"),
    limit: int = Query(100, ge=1, le=1000, description="Maksimum kayıt sayısı"),
    offset: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Peer yıllık trafik verilerini getirir (pagination destekli)"""
    try:
        from urllib.parse import unquote
        peer_id = unquote(peer_id)
        interface = unquote(interface)
        
        turkey_tz = timezone(timedelta(hours=3))
        start_dt = None
        end_dt = None
        
        # Tarih filtresi yoksa son 5 yılı göster (performans için)
        if not start_date and not end_date:
            end_dt = datetime.now(turkey_tz)
            start_dt = end_dt - timedelta(days=1825)  # 5 yıl
        
        if start_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=turkey_tz)
        if end_date:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=turkey_tz)
        
        logs = await get_peer_traffic_logs(db, peer_id, interface, "yearly", start_dt, end_dt, limit=limit)
        summary = await get_peer_traffic_summary(db, peer_id, interface, "yearly", start_dt, end_dt)
        
        return {
            "success": True,
            "period_type": "yearly",
            "data": [
                {
                    "id": log.id,
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                    "rx_mb": log.rx_mb,
                    "tx_mb": log.tx_mb,
                    "rx_bytes": log.rx_bytes,
                    "tx_bytes": log.tx_bytes,
                }
                for log in logs
            ],
            "summary": summary,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "count": len(logs)
            }
        }
    except Exception as e:
        logger.error(f"Peer yıllık trafik sorgulama hatası: {e}")
        raise HTTPException(status_code=500, detail=f"Veri alınamadı: {str(e)}")

