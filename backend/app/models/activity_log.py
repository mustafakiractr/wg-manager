"""
Activity Log model
Kullanıcı ve sistem aktivitelerini kaydetmek için veritabanı modeli
"""
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from app.database.database import Base


class ActivityLog(Base):
    """
    Aktivite log modeli
    Tüm kullanıcı ve sistem işlemlerini kaydeder
    """
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)

    # Kullanıcı bilgisi
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # Kullanıcı silindiğinde NULL yap (log'u sakla)
    username = Column(String(100), nullable=True)  # Cache için

    # Aksiyon bilgisi
    action = Column(String(100), nullable=False, index=True)  # 'login', 'logout', 'create_peer', 'delete_peer', vb.
    category = Column(String(50), nullable=False, index=True)  # 'auth', 'wireguard', 'user', 'system', 'mikrotik'

    # Detaylar
    description = Column(Text, nullable=False)  # İnsan okunabilir açıklama
    target_type = Column(String(50), nullable=True)  # 'peer', 'user', 'interface', vb.
    target_id = Column(String(100), nullable=True)  # Hedef nesnenin ID'si

    # İstek bilgisi
    ip_address = Column(String(50), nullable=True)  # İsteği yapan IP
    user_agent = Column(String(500), nullable=True)  # Browser/client bilgisi

    # Ek bilgi (JSON formatında)
    extra_data = Column(Text, nullable=True)  # Ek bilgiler için JSON string

    # Sonuç
    success = Column(String(20), default='success')  # 'success', 'failure', 'error'
    error_message = Column(Text, nullable=True)  # Hata durumunda mesaj

    # Zaman damgası
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def to_dict(self):
        """Model'i dictionary'ye çevir"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "username": self.username,
            "action": self.action,
            "category": self.category,
            "description": self.description,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "extra_data": self.extra_data,
            "success": self.success,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
