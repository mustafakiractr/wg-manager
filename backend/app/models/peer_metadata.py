"""
Peer Metadata Model
Peer'lar için ek bilgiler (grup, etiketler, notlar)
"""
from sqlalchemy import Column, Integer, String, DateTime, Text, Index
from sqlalchemy.sql import func
from app.database.database import Base


class PeerMetadata(Base):
    """
    Peer metadata tablosu
    Peer'lar için ek bilgileri saklar (grup, etiketler, notlar)
    """
    __tablename__ = "peer_metadata"

    id = Column(Integer, primary_key=True, index=True)
    peer_id = Column(String(100), nullable=False, index=True)  # MikroTik peer ID
    interface_name = Column(String(100), nullable=False, index=True)  # Interface adı
    public_key = Column(String(255), nullable=True, index=True)  # Peer public key (referans için)

    # Gruplama ve kategori
    group_name = Column(String(100), nullable=True, index=True)  # Grup adı (Çalışanlar, Müşteriler, Test)
    group_color = Column(String(20), nullable=True)  # Grup rengi (hex code)

    # Etiketler ve notlar
    tags = Column(Text, nullable=True)  # Etiketler (virgülle ayrılmış: "production,important,vip")
    notes = Column(Text, nullable=True)  # Kullanıcı notları

    # Ek alanlar
    custom_fields = Column(Text, nullable=True)  # JSON formatında ek alanlar

    # Zaman damgaları
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Composite index for better query performance
    __table_args__ = (
        Index('ix_peer_metadata_peer_interface', 'peer_id', 'interface_name'),
    )
