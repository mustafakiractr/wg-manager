"""
Telegram Settings Model
Telegram bildirim ayarları için veritabanı modeli
"""
from sqlalchemy import Column, Integer, String, Boolean, JSON, DateTime
from app.database.database import Base
from app.utils.datetime_helper import utcnow
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime


class TelegramSettings(Base):
    """
    Telegram bildirim ayarları
    Sistem kritik olayları için Telegram bildirimleri
    """
    __tablename__ = "telegram_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    
    # Telegram Bot bilgileri
    bot_token: Mapped[str] = mapped_column(String, nullable=True)  # Bot token (gizli)
    chat_id: Mapped[str] = mapped_column(String, nullable=True)  # Chat ID (kullanıcı veya grup)
    
    # Aktiflik durumu
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)  # Telegram bildirimleri aktif mi?
    
    # Bildirim kategorileri (JSON array)
    # ["peer_down", "peer_up", "mikrotik_disconnect", "backup_failed", "login_failed", "system_error"]
    notification_categories: Mapped[str] = mapped_column(JSON, nullable=True)
    
    # Test mesajı gönderme sayısı (debug için)
    test_message_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Son bildirim zamanı
    last_notification_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Oluşturulma ve güncellenme
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    def to_dict(self):
        """Model'i dictionary'ye çevir (API response için)"""
        return {
            "id": self.id,
            "bot_token": self.bot_token[:10] + "..." if self.bot_token else None,  # Güvenlik: sadece ilk 10 karakter
            "chat_id": self.chat_id,
            "enabled": self.enabled,
            "notification_categories": self.notification_categories or [],
            "test_message_count": self.test_message_count,
            "last_notification_at": self.last_notification_at.isoformat() if self.last_notification_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
