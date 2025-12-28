"""
Notification model
Kullanıcı bildirimleri için veritabanı modeli
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.database import Base


class Notification(Base):
    """Bildirim modeli"""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)  # Bildirim sahibi kullanıcı
    type = Column(String(50), nullable=False)  # 'info', 'warning', 'error', 'success'
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    peer_id = Column(String(100), nullable=True)  # İlgili peer ID (opsiyonel)
    interface = Column(String(50), nullable=True)  # İlgili interface (opsiyonel)
    read = Column(Boolean, default=False)  # Okundu mu?
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True), nullable=True)

    # Relationship
    user = relationship("User", back_populates="notifications")

    def to_dict(self):
        """Model'i dictionary'ye çevir"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "type": self.type,
            "title": self.title,
            "message": self.message,
            "peer_id": self.peer_id,
            "interface": self.interface,
            "read": self.read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "read_at": self.read_at.isoformat() if self.read_at else None,
        }
