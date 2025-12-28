"""
Peer trafik log modeli
Her peer'ın trafik kullanımını kaydeder
"""
from sqlalchemy import Column, Integer, String, DateTime, BigInteger, Float
from sqlalchemy.sql import func
from app.database.database import Base


class PeerTrafficLog(Base):
    """
    Peer trafik log tablosu modeli
    Her peer'ın periyodik trafik kullanımını kaydeder
    """
    __tablename__ = "peer_traffic_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)  # Kayıt zamanı
    peer_id = Column(String, nullable=False, index=True)  # MikroTik peer ID
    interface_name = Column(String, nullable=False, index=True)  # Interface adı
    peer_name = Column(String, nullable=True)  # Peer adı/comment
    public_key = Column(String, nullable=True)  # Peer public key
    period_type = Column(String, nullable=False, index=True)  # 'hourly', 'daily', 'monthly', 'yearly'
    rx_bytes = Column(BigInteger, default=0, nullable=False)  # İndirme (bytes)
    tx_bytes = Column(BigInteger, default=0, nullable=False)  # Yükleme (bytes)
    rx_mb = Column(Float, default=0.0, nullable=False)  # İndirme (MB)
    tx_mb = Column(Float, default=0.0, nullable=False)  # Yükleme (MB)
    notes = Column(String, nullable=True)  # Ek notlar

