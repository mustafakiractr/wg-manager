"""
Trafik kayıt zamanlayıcı
Periyodik olarak trafik verilerini kaydeder
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from app.database.database import AsyncSessionLocal
from app.services.traffic_service import save_traffic_log
from app.services.peer_traffic_service import save_peer_traffic_log
from app.mikrotik.connection import mikrotik_conn

logger = logging.getLogger(__name__)


async def record_traffic_periodic(period_type: str):
    """
    Periyodik trafik kaydı yapar
    
    Args:
        period_type: Periyot tipi ('hourly', 'daily', 'monthly', 'yearly')
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
                        peer_id = peer.get('id') or peer.get('.id')
                        peer_name = peer.get('comment') or peer.get('name')
                        public_key = peer.get('public-key')
                        
                        # Aktif peer sayısını kontrol et
                        disabled = peer.get('disabled', 'true')
                        if disabled == 'false' or disabled is False:
                            active_peer_count += 1
                        
                        # Trafik verilerini topla
                        rx_bytes = int(peer.get('rx-bytes') or peer.get('rx') or 0)
                        tx_bytes = int(peer.get('tx-bytes') or peer.get('tx') or 0)
                        total_rx_bytes += rx_bytes
                        total_tx_bytes += tx_bytes
                        
                        # Peer bazlı trafik kaydı oluştur
                        if peer_id:
                            try:
                                async with AsyncSessionLocal() as db:
                                    await save_peer_traffic_log(
                                        db=db,
                                        peer_id=str(peer_id),
                                        interface_name=interface_name,
                                        peer_name=peer_name,
                                        public_key=public_key,
                                        period_type=period_type,
                                        rx_bytes=rx_bytes,
                                        tx_bytes=tx_bytes
                                    )
                            except Exception as e:
                                logger.error(f"Peer trafik kaydı oluşturulamadı ({peer_id}): {e}")
                except Exception as e:
                    logger.error(f"Peer trafik verisi alınamadı ({interface_name}): {e}")
        
        # Trafik log kaydı oluştur
        async with AsyncSessionLocal() as db:
            await save_traffic_log(
                db=db,
                period_type=period_type,
                total_rx_bytes=total_rx_bytes,
                total_tx_bytes=total_tx_bytes,
                interface_count=interface_count,
                peer_count=peer_count,
                active_peer_count=active_peer_count
            )
        
        logger.info(f"Trafik kaydı oluşturuldu: {period_type} - RX: {total_rx_bytes / (1024*1024):.2f} MB, TX: {total_tx_bytes / (1024*1024):.2f} MB")
    except Exception as e:
        logger.error(f"Periyodik trafik kayıt hatası ({period_type}): {e}")


async def start_traffic_scheduler():
    """
    Trafik kayıt zamanlayıcısını başlatır
    """
    logger.info("Trafik kayıt zamanlayıcısı başlatılıyor...")
    
    async def hourly_scheduler():
        """Saatlik trafik kaydı"""
        while True:
            try:
                await asyncio.sleep(3600)  # 1 saat bekle
                await record_traffic_periodic('hourly')
            except Exception as e:
                logger.error(f"Saatlik trafik kayıt zamanlayıcı hatası: {e}")
    
    async def daily_scheduler():
        """Günlük trafik kaydı"""
        while True:
            try:
                await asyncio.sleep(86400)  # 24 saat bekle
                await record_traffic_periodic('daily')
            except Exception as e:
                logger.error(f"Günlük trafik kayıt zamanlayıcı hatası: {e}")
    
    # İlk kayıtları hemen yap
    try:
        await record_traffic_periodic('hourly')
        await record_traffic_periodic('daily')
    except Exception as e:
        logger.warning(f"İlk trafik kayıtları oluşturulamadı: {e}")
    
    # Zamanlayıcıları başlat
    asyncio.create_task(hourly_scheduler())
    asyncio.create_task(daily_scheduler())
    
    logger.info("Trafik kayıt zamanlayıcısı başlatıldı")

