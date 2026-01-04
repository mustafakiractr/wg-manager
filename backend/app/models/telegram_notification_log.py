"""
Telegram Notification Log Model
Gönderilen Telegram bildirimlerinin geçmişi
"""
from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.database.database import Base
from app.utils.datetime_helper import utcnow


class TelegramNotificationLog(Base):
    """
    Gönderilen Telegram bildirimlerinin log kaydı
    Her bildirim mesajı burada saklanır
    """
    __tablename__ = "telegram_notification_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # Bildirim bilgileri
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # peer_down, backup_failed, etc.
    title: Mapped[str] = mapped_column(String(255), nullable=False)  # Mesaj başlığı
    message: Mapped[str] = mapped_column(Text, nullable=False)  # Mesaj içeriği
    
    # Telegram gönderim bilgileri
    chat_id: Mapped[str] = mapped_column(String(100), nullable=False)  # Gönderilen chat ID
    bot_token_preview: Mapped[str] = mapped_column(String(50), nullable=True)  # Token'in ilk 20 karakteri (güvenlik)
    
    # Durum bilgileri
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="sent")  # sent, failed
    success: Mapped[bool] = mapped_column(Boolean, default=True)  # Gönderim başarılı mı?
    error_message: Mapped[str] = mapped_column(Text, nullable=True)  # Hata mesajı (varsa)
    
    # İlgili kaynak bilgileri (opsiyonel)
    peer_id: Mapped[str] = mapped_column(String(100), nullable=True, index=True)  # İlgili peer
    interface_name: Mapped[str] = mapped_column(String(50), nullable=True, index=True)  # İlgili interface
    user_id: Mapped[int] = mapped_column(Integer, nullable=True, index=True)  # İlgili kullanıc (login_failed için)
    
    # Telegram API response bilgileri
    telegram_message_id: Mapped[int] = mapped_column(Integer, nullable=True)  # Telegram mesaj ID'si
    
    # Timestamp
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    def to_dict(self):
        """Model'i dictionary'ye çevir"""
        return {
            "id": self.id,
            "category": self.category,
            "title": self.title,
            "message": self.message,
            "chat_id": self.chat_id,
            "bot_token_preview": self.bot_token_preview,
            "status": self.status,
            "success": self.success,
            "error_message": self.error_message,
            "peer_id": self.peer_id,
            "interface_name": self.interface_name,
            "user_id": self.user_id,
            "telegram_message_id": self.telegram_message_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
