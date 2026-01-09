"""
WebSocket API endpoint'leri
Gerçek zamanlı peer güncellemeleri ve bildirimler için WebSocket desteği
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Optional, Dict, Set
import asyncio
import logging

from app.websocket.connection_manager import manager
from app.security.auth import get_current_user_ws, WebSocketException
from app.database.database import get_db
from app.mikrotik.connection import mikrotik_conn

logger = logging.getLogger(__name__)

# WAN Traffic için aktif bağlantılar ve streaming task
wan_traffic_clients: Set[WebSocket] = set()
wan_traffic_task: Optional[asyncio.Task] = None
wan_traffic_lock = asyncio.Lock()

router = APIRouter()


@router.websocket("/ws/wireguard/{interface_name}")
async def websocket_endpoint(
    websocket: WebSocket,
    interface_name: str
):
    """
    WireGuard interface için WebSocket endpoint'i
    Peer değişikliklerini gerçek zamanlı olarak istemcilere iletir

    Args:
        websocket: WebSocket bağlantısı
        interface_name: WireGuard interface adı (wg0, wg1, vb.)
    """
    await manager.connect(websocket, interface_name)

    try:
        # Bağlantı açık kaldığı sürece bekle
        # İstemciden gelen mesajları dinle (ping/pong için)
        while True:
            data = await websocket.receive_text()
            # Ping mesajına pong ile cevap ver
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, interface_name)
        logger.info(f"WebSocket bağlantısı kapatıldı: {interface_name}")
    except Exception as e:
        logger.error(f"WebSocket hatası: {e}")
        manager.disconnect(websocket, interface_name)


@router.websocket("/ws/notifications")
async def notifications_websocket(
    websocket: WebSocket,
    token: Optional[str] = None
):
    """
    Bildirimler için WebSocket endpoint'i
    Kullanıcıya özel gerçek zamanlı bildirimler gönderir

    Args:
        websocket: WebSocket bağlantısı
        token: JWT access token (query parameter: ?token=xxx)

    Message Types (Server → Client):
        - {"type": "connected", "message": "..."} - Bağlantı başarılı
        - {"type": "notification", "data": {...}} - Yeni bildirim
        - {"type": "pong"} - Heartbeat yanıtı
        - {"type": "ping"} - Server keepalive

    Message Types (Client → Server):
        - "ping" - Heartbeat
        - "pong" - Server ping yanıtı
    """
    # WebSocket bağlantısını kabul et
    await websocket.accept()

    # Token kontrolü
    if not token:
        await websocket.close(code=1008, reason="Token required")
        logger.warning("WebSocket connection rejected: No token provided")
        return

    # Database session'ı al
    async for db in get_db():
        user = None
        try:
            # Kullanıcıyı doğrula
            user = await get_current_user_ws(websocket, token, db)

            # Bağlantıyı kaydet
            await manager.connect_user(websocket, user.id)

            # Bağlantı başarılı mesajı gönder
            await websocket.send_json({
                "type": "connected",
                "message": "Successfully connected to notification stream",
                "user_id": user.id,
                "username": user.username
            })

            # Bağlantıyı canlı tut ve mesajları dinle
            while True:
                try:
                    # 60 saniye timeout ile mesaj bekle
                    data = await asyncio.wait_for(
                        websocket.receive_text(),
                        timeout=60.0
                    )

                    # Ping/pong heartbeat
                    if data == "ping":
                        await websocket.send_json({"type": "pong"})
                    elif data == "pong":
                        # Client'tan pong aldık, sessizce devam et
                        pass

                except asyncio.TimeoutError:
                    # 60 saniyede mesaj gelmedi, keepalive ping gönder
                    try:
                        await websocket.send_json({"type": "ping"})
                    except Exception:
                        # Ping gönderilemedi, bağlantı kopmuş
                        break

        except WebSocketDisconnect:
            if user:
                logger.info(f"User {user.id} ({user.username}) disconnected from notifications WebSocket")
        except WebSocketException as e:
            logger.error(f"WebSocket authentication failed: {e.reason}")
            try:
                await websocket.close(code=e.code, reason=e.reason)
            except Exception:
                pass
        except Exception as e:
            logger.error(f"Notification WebSocket error: {e}")
        finally:
            # Bağlantıyı temizle
            if user:
                manager.disconnect_user(websocket, user.id)

        # async for döngüsünden çık
        break


async def wan_traffic_broadcaster():
    """
    WAN ve WireGuard traffic verilerini MikroTik monitor-traffic komutuyla alıp broadcast eden background task.
    İlk client bağlandığında başlar, son client ayrıldığında durur.
    """
    global wan_traffic_clients

    logger.info("Traffic broadcaster started")
    wan_interface_name = None
    wg_interface_names = []

    while wan_traffic_clients:
        try:
            # MikroTik'ten traffic verisi al
            if not await mikrotik_conn.ensure_connected():
                await broadcast_to_wan_clients({
                    "type": "error",
                    "message": "MikroTik bağlantısı kurulamadı"
                })
                await asyncio.sleep(5)
                continue

            # Interface'leri bul (sadece bir kez)
            if not wan_interface_name or not wg_interface_names:
                # Tüm interface'leri al (WAN için)
                all_interfaces = await mikrotik_conn.execute_command("/interface", "print")
                for iface in all_interfaces:
                    iface_name = iface.get('name', '')
                    comment = iface.get('comment', '').lower()

                    # WAN interface (comment'te WAN yazan)
                    if 'wan' in comment and not wan_interface_name:
                        wan_interface_name = iface_name
                        logger.info(f"WAN interface bulundu: {wan_interface_name}")

                # WireGuard interface'lerini ayrı endpoint'ten al
                try:
                    wg_interfaces = await mikrotik_conn.execute_command("/interface/wireguard", "print")
                    for wg in wg_interfaces:
                        wg_name = wg.get('name', '')
                        if wg_name and wg_name not in wg_interface_names:
                            wg_interface_names.append(wg_name)
                            logger.info(f"WireGuard interface bulundu: {wg_name}")
                except Exception as e:
                    logger.warning(f"WireGuard interface listesi alınamadı: {e}")

                if not wan_interface_name:
                    logger.warning("WAN interface bulunamadı")

            # Monitor edilecek interface listesi oluştur
            interfaces_to_monitor = []
            if wan_interface_name:
                interfaces_to_monitor.append(wan_interface_name)
            interfaces_to_monitor.extend(wg_interface_names)

            if not interfaces_to_monitor:
                await broadcast_to_wan_clients({
                    "type": "error",
                    "message": "İzlenecek interface bulunamadı"
                })
                await asyncio.sleep(5)
                continue

            # MikroTik monitor-traffic komutu ile anlık rate al
            loop = asyncio.get_event_loop()

            def get_monitor_traffic():
                """MikroTik monitor-traffic komutunu çalıştır"""
                try:
                    api = mikrotik_conn.api
                    if api is None:
                        return None

                    resource = api.get_resource('/interface')
                    # Virgülle ayrılmış interface listesi
                    interface_str = ','.join(interfaces_to_monitor)
                    result = resource.call('monitor-traffic', {
                        'interface': interface_str,
                        'once': ''
                    })
                    return list(result) if result else None
                except Exception as e:
                    logger.error(f"monitor-traffic error: {e}")
                    return None

            traffic_data = await loop.run_in_executor(None, get_monitor_traffic)
            current_time = asyncio.get_event_loop().time()

            if traffic_data and len(traffic_data) > 0:
                wan_data = None
                wg_total_rx_bps = 0
                wg_total_tx_bps = 0
                wg_interfaces_data = []

                for data in traffic_data:
                    iface_name = data.get('name', '')
                    rx_rate_bps = int(data.get('rx-bits-per-second', 0) or 0)
                    tx_rate_bps = int(data.get('tx-bits-per-second', 0) or 0)

                    if iface_name == wan_interface_name:
                        wan_data = {
                            "interface_name": iface_name,
                            "rx_rate": round(rx_rate_bps / 8, 2),
                            "tx_rate": round(tx_rate_bps / 8, 2),
                            "rx_rate_bps": rx_rate_bps,
                            "tx_rate_bps": tx_rate_bps,
                            "running": True
                        }
                    elif iface_name in wg_interface_names:
                        wg_total_rx_bps += rx_rate_bps
                        wg_total_tx_bps += tx_rate_bps
                        wg_interfaces_data.append({
                            "name": iface_name,
                            "rx_rate_bps": rx_rate_bps,
                            "tx_rate_bps": tx_rate_bps
                        })

                # Broadcast
                await broadcast_to_wan_clients({
                    "type": "traffic_update",
                    "data": {
                        "wan": wan_data,
                        "wireguard": {
                            "total_rx_rate": round(wg_total_rx_bps / 8, 2),
                            "total_tx_rate": round(wg_total_tx_bps / 8, 2),
                            "total_rx_rate_bps": wg_total_rx_bps,
                            "total_tx_rate_bps": wg_total_tx_bps,
                            "interfaces": wg_interfaces_data
                        },
                        "timestamp": current_time
                    }
                })
            else:
                # monitor-traffic başarısız, interface'leri sıfırla
                wan_interface_name = None
                wg_interface_names = []

            # 500ms bekle
            await asyncio.sleep(0.5)

        except asyncio.CancelledError:
            logger.info("Traffic broadcaster cancelled")
            break
        except Exception as e:
            logger.error(f"Traffic broadcaster error: {e}")
            wan_interface_name = None
            wg_interface_names = []
            await asyncio.sleep(2)

    logger.info("Traffic broadcaster stopped")


async def broadcast_to_wan_clients(message: dict):
    """WAN traffic client'larına mesaj gönder"""
    global wan_traffic_clients

    disconnected = []
    for client in wan_traffic_clients:
        try:
            await client.send_json(message)
        except Exception:
            disconnected.append(client)

    # Kopmuş bağlantıları temizle
    for client in disconnected:
        wan_traffic_clients.discard(client)


@router.websocket("/ws/wan-traffic")
async def wan_traffic_websocket(
    websocket: WebSocket,
    token: Optional[str] = None
):
    """
    WAN Traffic için WebSocket endpoint'i
    Anlık WAN interface traffic verilerini stream eder

    Args:
        websocket: WebSocket bağlantısı
        token: JWT access token (query parameter: ?token=xxx)

    Message Types (Server → Client):
        - {"type": "connected", "message": "..."} - Bağlantı başarılı
        - {"type": "wan_traffic", "data": {...}} - Traffic verisi
        - {"type": "error", "message": "..."} - Hata mesajı
        - {"type": "pong"} - Heartbeat yanıtı
    """
    global wan_traffic_clients, wan_traffic_task

    await websocket.accept()

    # Token kontrolü
    if not token:
        await websocket.close(code=1008, reason="Token required")
        logger.warning("WAN Traffic WebSocket rejected: No token")
        return

    # Database session ile kullanıcı doğrulama
    async for db in get_db():
        user = None
        try:
            user = await get_current_user_ws(websocket, token, db)

            # Client'ı listeye ekle
            async with wan_traffic_lock:
                wan_traffic_clients.add(websocket)

                # İlk client ise broadcaster'ı başlat
                if wan_traffic_task is None or wan_traffic_task.done():
                    wan_traffic_task = asyncio.create_task(wan_traffic_broadcaster())
                    logger.info("WAN Traffic broadcaster task started")

            # Bağlantı başarılı mesajı
            await websocket.send_json({
                "type": "connected",
                "message": "WAN Traffic stream'e bağlandı"
            })

            logger.info(f"User {user.username} connected to WAN Traffic stream")

            # Bağlantıyı canlı tut
            while True:
                try:
                    data = await asyncio.wait_for(
                        websocket.receive_text(),
                        timeout=60.0
                    )

                    if data == "ping":
                        await websocket.send_json({"type": "pong"})

                except asyncio.TimeoutError:
                    # Keepalive ping
                    try:
                        await websocket.send_json({"type": "ping"})
                    except Exception:
                        break

        except WebSocketDisconnect:
            if user:
                logger.info(f"User {user.username} disconnected from WAN Traffic stream")
        except WebSocketException as e:
            logger.error(f"WAN Traffic WebSocket auth failed: {e.reason}")
            try:
                await websocket.close(code=e.code, reason=e.reason)
            except Exception:
                pass
        except Exception as e:
            logger.error(f"WAN Traffic WebSocket error: {e}")
        finally:
            # Client'ı listeden çıkar
            async with wan_traffic_lock:
                wan_traffic_clients.discard(websocket)

                # Son client ayrıldıysa task'ı durdur
                if not wan_traffic_clients and wan_traffic_task:
                    wan_traffic_task.cancel()
                    wan_traffic_task = None
                    logger.info("WAN Traffic broadcaster stopped (no clients)")

        break
