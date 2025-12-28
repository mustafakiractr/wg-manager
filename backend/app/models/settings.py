"""
MikroTik bağlantı ayarları modeli
Veritabanında ayarları saklamak için
"""
from sqlalchemy import Column, String, Integer, Boolean, DateTime
from sqlalchemy.sql import func
from app.database.database import Base


class MikroTikSettings(Base):
    """
    MikroTik bağlantı ayarları tablosu
    Tek bir kayıt tutulur (singleton pattern)
    """
    __tablename__ = "mikrotik_settings"

    id = Column(Integer, primary_key=True, default=1)  # Her zaman 1 olacak (singleton)
    host = Column(String(255), nullable=False, default="192.168.1.1")
    port = Column(Integer, nullable=False, default=8728)
    username = Column(String(255), nullable=False, default="admin")
    password = Column(String(255), nullable=True, default="")
    use_tls = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def to_dict(self):
        """Model'i dictionary'ye dönüştürür"""
        return {
            "id": self.id,
            "host": self.host,
            "port": self.port,
            "username": self.username,
            "password": "***" if self.password else "",  # Şifreyi gizle
            "use_tls": self.use_tls,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

