"""
Sync durumu modeli
MikroTik'ten yapılan ilk senkronizasyon durumunu takip eder
"""
from sqlalchemy import Column, Integer, Boolean, DateTime, Text
from sqlalchemy.sql import func
from app.database.database import Base


class SyncStatus(Base):
    """
    Senkronizasyon durumu tablosu modeli
    İlk MikroTik sync işleminin durumunu takip eder (singleton pattern)
    """
    __tablename__ = "sync_status"

    id = Column(Integer, primary_key=True, default=1)  # Singleton - her zaman 1
    initial_sync_completed = Column(Boolean, default=False, nullable=False)  # İlk sync tamamlandı mı?
    last_sync_at = Column(DateTime(timezone=True), nullable=True)  # Son sync zamanı
    synced_interface_count = Column(Integer, default=0)  # Sync edilen interface sayısı
    synced_peer_count = Column(Integer, default=0)  # Sync edilen peer sayısı
    sync_errors = Column(Text, nullable=True)  # Sync hataları (JSON array)
    created_at = Column(DateTime(timezone=True), server_default=func.now())  # Oluşturulma zamanı
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())  # Güncellenme zamanı
