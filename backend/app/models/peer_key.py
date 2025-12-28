"""
Peer private key modeli
WireGuard peer'larının private key'lerini saklar
NOT: MikroTik RouterOS'ta peer'lar için private-key alanı YOKTUR
Private key sadece client tarafında saklanmalıdır
Bu model, panelden peer eklenirken girilen private key'leri saklamak için kullanılır
"""
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.database.database import Base


class PeerKey(Base):
    """
    Peer private key tablosu modeli
    Her peer'ın private key'ini saklar (QR kod ve config dosyası için)
    """
    __tablename__ = "peer_keys"

    id = Column(Integer, primary_key=True, index=True)
    peer_id = Column(String, nullable=False, index=True)  # MikroTik peer ID
    interface_name = Column(String, nullable=False, index=True)  # Interface adı
    public_key = Column(String, nullable=False, index=True, unique=True)  # Peer public key (unique)
    private_key = Column(Text, nullable=False)  # Private key (şifrelenmiş olarak saklanmalı)
    client_allowed_ips = Column(Text, nullable=True)  # Client'ın AllowedIPs değeri (config dosyası için)
    endpoint_address = Column(String, nullable=True)  # Endpoint adresi (DNS veya IP)
    endpoint_port = Column(Integer, nullable=True)  # Endpoint port numarası
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)  # Oluşturulma zamanı
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)  # Güncellenme zamanı
