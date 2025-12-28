"""
Trafik log modeli
Sistem trafik kullanımını kaydeder
"""
from sqlalchemy import Column, Integer, String, DateTime, BigInteger, Float
from sqlalchemy.sql import func
from app.database.database import Base


class TrafficLog(Base):
    """
    Trafik log tablosu modeli
    Periyodik olarak trafik kullanımını kaydeder
    """
    __tablename__ = "traffic_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)  # Kayıt zamanı
    period_type = Column(String, nullable=False, index=True)  # 'hourly', 'daily', 'monthly', 'yearly'
    total_rx_bytes = Column(BigInteger, default=0, nullable=False)  # Toplam indirme (bytes)
    total_tx_bytes = Column(BigInteger, default=0, nullable=False)  # Toplam yükleme (bytes)
    total_rx_mb = Column(Float, default=0.0, nullable=False)  # Toplam indirme (MB)
    total_tx_mb = Column(Float, default=0.0, nullable=False)  # Toplam yükleme (MB)
    interface_count = Column(Integer, default=0, nullable=False)  # Interface sayısı
    peer_count = Column(Integer, default=0, nullable=False)  # Peer sayısı
    active_peer_count = Column(Integer, default=0, nullable=False)  # Aktif peer sayısı
    notes = Column(String, nullable=True)  # Ek notlar

