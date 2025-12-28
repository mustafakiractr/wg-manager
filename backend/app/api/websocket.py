"""
WebSocket API endpoint'leri
Gerçek zamanlı peer güncellemeleri ve bildirimler için WebSocket desteği
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Optional
import asyncio
import logging

from app.websocket.connection_manager import manager
from app.security.auth import get_current_user_ws, WebSocketException
from app.database.database import get_db

logger = logging.getLogger(__name__)

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
