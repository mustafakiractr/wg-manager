"""
Peer Template Model
Peer şablonları için veritabanı modeli
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.sql import func
from app.database.database import Base


class PeerTemplate(Base):
    """Peer şablonları tablosu"""
    __tablename__ = "peer_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True, unique=True)
    description = Column(Text, nullable=True)

    # Peer konfigürasyonu
    allowed_address = Column(String(100), nullable=True)  # IP adresi veya "auto" (IP Pool'dan al)
    endpoint_address = Column(String(200), nullable=True)  # Endpoint adresi
    endpoint_port = Column(Integer, nullable=True)  # Endpoint portu
    persistent_keepalive = Column(Integer, nullable=True, default=0)  # Keepalive süresi
    preshared_key = Column(String(100), nullable=True)  # Preshared key kullanılsın mı

    # Metadata
    group_name = Column(String(100), nullable=True)  # Varsayılan grup
    group_color = Column(String(20), nullable=True)  # Varsayılan grup rengi
    tags = Column(Text, nullable=True)  # Varsayılan etiketler
    notes_template = Column(Text, nullable=True)  # Not şablonu (değişkenler: {date}, {number}, vb.)

    # Kullanım istatistikleri
    usage_count = Column(Integer, default=0)  # Kaç kez kullanıldı
    is_active = Column(Boolean, default=True)  # Aktif mi

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=True)  # Son kullanım zamanı

    def __repr__(self):
        return f"<PeerTemplate(id={self.id}, name='{self.name}')>"
