"""
IP Pool Management Models
IP havuzu ve IP tahsisi için veritabanı modelleri
"""
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.database import Base


class IPPool(Base):
    """
    IP Havuzu tablosu
    Her havuz bir interface'e ait olur ve belirli bir IP aralığını yönetir
    """
    __tablename__ = "ip_pools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # Havuz adı (örn: "Ana VPN Havuzu")
    interface_name = Column(String(100), nullable=False, index=True)  # WireGuard interface adı
    subnet = Column(String(50), nullable=False)  # Alt ağ (örn: "10.0.0.0/24")
    start_ip = Column(String(45), nullable=False)  # Başlangıç IP (örn: "10.0.0.10")
    end_ip = Column(String(45), nullable=False)  # Bitiş IP (örn: "10.0.0.250")
    gateway = Column(String(45), nullable=True)  # Gateway IP (opsiyonel)
    dns_servers = Column(Text, nullable=True)  # DNS sunucuları (virgülle ayrılmış)
    description = Column(Text, nullable=True)  # Açıklama
    is_active = Column(Boolean, default=True, nullable=False)  # Havuz aktif mi?
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # İlişkiler
    allocations = relationship("IPAllocation", back_populates="pool", cascade="all, delete-orphan")


class IPAllocation(Base):
    """
    IP Tahsis tablosu
    Hangi IP'nin hangi peer'a tahsis edildiğini takip eder
    """
    __tablename__ = "ip_allocations"

    id = Column(Integer, primary_key=True, index=True)
    pool_id = Column(Integer, ForeignKey("ip_pools.id", ondelete="CASCADE"), nullable=False, index=True)
    ip_address = Column(String(45), nullable=False, index=True)  # Tahsis edilen IP
    peer_id = Column(String(100), nullable=True, index=True)  # MikroTik peer ID
    peer_public_key = Column(Text, nullable=True)  # Peer public key (referans için)
    peer_name = Column(String(100), nullable=True)  # Peer adı/comment
    status = Column(String(20), nullable=False, default='allocated')  # allocated, released, reserved
    allocated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    released_at = Column(DateTime(timezone=True), nullable=True)  # Serbest bırakıldığında
    notes = Column(Text, nullable=True)  # Notlar

    # İlişkiler
    pool = relationship("IPPool", back_populates="allocations")
