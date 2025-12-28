"""
WebSocket bağlantı yöneticisi
Gerçek zamanlı güncellemeler için WebSocket bağlantılarını yönetir
"""
from typing import Dict, Set
from fastapi import WebSocket
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """WebSocket bağlantılarını yöneten sınıf"""

    def __init__(self):
        # Interface adına göre aktif bağlantılar (WireGuard monitoring için)
        # {"wg0": {websocket1, websocket2, ...}}
        self.active_connections: Dict[str, Set[WebSocket]] = {}

        # Kullanıcı ID'sine göre aktif bağlantılar (bildirimler için)
        # {user_id: {websocket1, websocket2, ...}}
        self.user_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, interface_name: str):
        """Yeni WebSocket bağlantısını kabul et"""
        await websocket.accept()
        if interface_name not in self.active_connections:
            self.active_connections[interface_name] = set()
        self.active_connections[interface_name].add(websocket)
        logger.info(f"WebSocket bağlantısı açıldı: {interface_name} (Toplam: {len(self.active_connections[interface_name])})")

    def disconnect(self, websocket: WebSocket, interface_name: str):
        """WebSocket bağlantısını kapat"""
        if interface_name in self.active_connections:
            self.active_connections[interface_name].discard(websocket)
            if len(self.active_connections[interface_name]) == 0:
                del self.active_connections[interface_name]
            logger.info(f"WebSocket bağlantısı kapandı: {interface_name}")

    async def broadcast(self, interface_name: str, message: dict):
        """Belirli bir interface için tüm bağlantılara mesaj gönder"""
        if interface_name not in self.active_connections:
            return

        # Bağlantı kopmuş WebSocket'leri temizlemek için liste
        disconnected = []

        for websocket in self.active_connections[interface_name]:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"WebSocket mesaj gönderme hatası: {e}")
                disconnected.append(websocket)

        # Kopmuş bağlantıları temizle
        for websocket in disconnected:
            self.disconnect(websocket, interface_name)

    async def broadcast_all(self, message: dict):
        """Tüm interface'lere mesaj gönder"""
        for interface_name in list(self.active_connections.keys()):
            await self.broadcast(interface_name, message)

    # ===== User-Based Connection Methods (for notifications) =====

    async def connect_user(self, websocket: WebSocket, user_id: int):
        """
        Kullanıcıya özel WebSocket bağlantısını kaydet
        Bildirimler için kullanılır
        NOT: WebSocket endpoint'te zaten accept() çağrılmış olmalı

        Args:
            websocket: WebSocket bağlantı nesnesi
            user_id: Kullanıcı ID'si
        """
        # NOT: accept() burada ÇAĞRILMAMALI, endpoint'te zaten çağrıldı
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(websocket)
        logger.info(
            f"User {user_id} WebSocket connected "
            f"(Total connections for this user: {len(self.user_connections[user_id])})"
        )

    def disconnect_user(self, websocket: WebSocket, user_id: int):
        """
        Kullanıcıya özel WebSocket bağlantısını kapat

        Args:
            websocket: WebSocket bağlantı nesnesi
            user_id: Kullanıcı ID'si
        """
        if user_id in self.user_connections:
            self.user_connections[user_id].discard(websocket)
            # Eğer kullanıcının hiç bağlantısı kalmadıysa, dict'ten sil
            if len(self.user_connections[user_id]) == 0:
                del self.user_connections[user_id]
                logger.info(f"User {user_id} - all WebSocket connections closed")
            else:
                logger.info(
                    f"User {user_id} WebSocket disconnected "
                    f"(Remaining connections: {len(self.user_connections[user_id])})"
                )

    async def send_to_user(self, user_id: int, message: dict):
        """
        Belirli bir kullanıcının TÜM WebSocket bağlantılarına mesaj gönder
        Kullanıcı birden fazla tab açmışsa hepsine gönderilir

        Args:
            user_id: Kullanıcı ID'si
            message: Gönderilecek mesaj (dictionary)
        """
        if user_id not in self.user_connections:
            logger.debug(f"No active connections for user {user_id}, message not sent")
            return

        # Bağlantı kopmuş WebSocket'leri temizlemek için liste
        disconnected = []
        sent_count = 0

        for websocket in self.user_connections[user_id]:
            try:
                await websocket.send_json(message)
                sent_count += 1
            except Exception as e:
                logger.error(f"Error sending message to user {user_id}: {e}")
                disconnected.append(websocket)

        # Kopmuş bağlantıları temizle
        for websocket in disconnected:
            self.disconnect_user(websocket, user_id)

        if sent_count > 0:
            logger.debug(f"Message sent to user {user_id} ({sent_count} connections)")


# Global ConnectionManager instance
manager = ConnectionManager()
