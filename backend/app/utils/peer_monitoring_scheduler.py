"""
Peer Monitoring Scheduler
Peer durumlarını otomatik olarak izler ve Telegram bildirimleri gönderir
"""
import asyncio
import logging
from app.database.database import AsyncSessionLocal
from app.mikrotik.connection import mikrotik_conn
from app.services.peer_handshake_service import track_peer_status

logger = logging.getLogger(__name__)


async def monitor_all_peers():
    """
    Tüm WireGuard interface'lerindeki peer'ları kontrol eder
    """
    try:
        async with AsyncSessionLocal() as db:
            # Bağlantının açık olduğundan emin ol
            is_connected = await mikrotik_conn.ensure_connected()
            if not is_connected:
                logger.warning("Peer monitoring: MikroTik bağlantısı kurulamadı, atlanıyor")
                return
            
            # Tüm WireGuard interface'lerini al
            interfaces = await mikrotik_conn.get_wireguard_interfaces(use_cache=False)
            
            if not interfaces:
                logger.debug("Peer monitoring: WireGuard interface bulunamadı")
                return
            
            total_peers_checked = 0
            
            for interface in interfaces:
                interface_name = interface.get('name') or interface.get('.id')
                if not interface_name:
                    continue
                
                try:
                    # Interface'deki tüm peer'ları al
                    peers = await mikrotik_conn.get_wireguard_peers(interface_name, use_cache=False)
                    
                    for peer in peers:
                        peer_id = peer.get('id') or peer.get('.id')
                        if not peer_id:
                            continue
                        
                        # Peer bilgilerini al
                        public_key = peer.get('public-key') or peer.get('public_key')
                        peer_name = peer.get('comment') or peer.get('name')
                        last_handshake = peer.get('last-handshake')
                        
                        if public_key:
                            public_key = str(public_key).strip()
                        
                        # Peer durumunu track et (Telegram bildirimi dahil)
                        await track_peer_status(
                            db=db,
                            peer_id=str(peer_id),
                            interface_name=interface_name,
                            peer_name=peer_name,
                            public_key=public_key,
                            last_handshake_value=last_handshake
                        )
                        
                        total_peers_checked += 1
                
                except Exception as e:
                    error_msg = str(e)
                    # Timeout hatalarını sadece debug seviyede logla (çok sık olmasın diye)
                    if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
                        logger.debug(f"Peer monitoring timeout ({interface_name}): {e}")
                    else:
                        logger.error(f"Peer monitoring hatası ({interface_name}): {e}")
            
            if total_peers_checked > 0:
                logger.debug(f"Peer monitoring tamamlandı: {total_peers_checked} peer kontrol edildi")
    
    except Exception as e:
        error_msg = str(e)
        # Timeout hatalarını sadece debug seviyede logla
        if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
            logger.debug(f"Peer monitoring genel timeout: {e}")
        else:
            logger.error(f"Peer monitoring genel hatası: {e}")


async def start_peer_monitoring():
    """
    Peer monitoring zamanlayıcısını başlatır
    15 saniyede bir tüm peer'ları kontrol eder
    """
    logger.info("🔍 Peer monitoring scheduler başlatılıyor...")
    
    async def monitoring_loop():
        """15 saniyede bir peer'ları kontrol et"""
        while True:
            try:
                await asyncio.sleep(15)  # 15 saniye bekle (30 saniyeden daha kısa)
                await monitor_all_peers()
            except Exception as e:
                logger.error(f"Peer monitoring loop hatası: {e}")
    
    # İlk kontrolü hemen yap
    try:
        await monitor_all_peers()
        logger.info("✅ İlk peer kontrolü tamamlandı")
    except Exception as e:
        logger.warning(f"⚠️ İlk peer kontrolü yapılamadı: {e}")
    
    # Zamanlayıcıyı başlat
    asyncio.create_task(monitoring_loop())
    
    logger.info("✅ Peer monitoring scheduler başlatıldı (15 saniye interval)")
