"""
Peer handshake tracking modeli
Her peer'ın online/offline durumlarını ve zamanlarını kaydeder
"""
from sqlalchemy import Column, Integer, String, DateTime, Text, BigInteger, Boolean, Index
from sqlalchemy.sql import func
from app.database.database import Base


class PeerHandshake(Base):
    """
    Peer handshake tracking tablosu modeli
    Her peer'ın online/offline durumlarını ve zamanlarını saklar
    """
    __tablename__ = "peer_handshakes"

    id = Column(Integer, primary_key=True, index=True)
    peer_id = Column(String, index=True, nullable=False)  # MikroTik peer ID
    interface_name = Column(String, nullable=False, index=True)  # Interface adı
    peer_name = Column(String, nullable=True)  # Peer adı/comment
    public_key = Column(String, nullable=True)  # Peer public key
    handshake_count = Column(BigInteger, default=0, nullable=True)  # Eski sütun (geriye uyumluluk için)
    is_online = Column(Boolean, default=False, nullable=False)  # Online durumu
    event_time = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)  # Olay zamanı
    last_handshake_value = Column(String, nullable=True)  # MikroTik'ten gelen son handshake değeri (örn: "20s")
    event_type = Column(String, nullable=False)  # 'online' veya 'offline'
    notes = Column(Text, nullable=True)  # Ek notlar
    # Eski sütunlar (geriye uyumluluk için)
    last_handshake_time = Column(DateTime(timezone=True), nullable=True)
    first_seen = Column(DateTime(timezone=True), nullable=True)
    last_updated = Column(DateTime(timezone=True), nullable=True)

    # Composite index'ler - Sık kullanılan sorguları hızlandırır
    __table_args__ = (
        # Peer ve interface'e göre sıralı son kayıtları almak için
        Index('idx_peer_interface_time', 'peer_id', 'interface_name', 'event_time'),
        # Interface'e göre online peer'ları bulmak için
        Index('idx_interface_online', 'interface_name', 'is_online', 'event_time'),
    )

