"""
Email ayarları modeli
SMTP yapılandırması ve email notification tercihleri
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from app.database.database import Base
from datetime import datetime


class EmailSettings(Base):
    """Email/SMTP yapılandırma ayarları"""
    __tablename__ = "email_settings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # SMTP Ayarları
    smtp_host = Column(String(255), nullable=False, default="smtp.gmail.com")
    smtp_port = Column(Integer, nullable=False, default=587)
    smtp_username = Column(String(255), nullable=False)
    smtp_password = Column(Text, nullable=False)  # Encrypted
    smtp_use_tls = Column(Boolean, default=True)
    smtp_use_ssl = Column(Boolean, default=False)
    
    # Gönderici Bilgileri
    from_email = Column(String(255), nullable=False)
    from_name = Column(String(255), default="WireGuard Manager")
    
    # Notification Tercihleri
    enabled = Column(Boolean, default=False)
    notify_backup_success = Column(Boolean, default=True)
    notify_backup_failure = Column(Boolean, default=True)
    notify_peer_added = Column(Boolean, default=False)
    notify_peer_deleted = Column(Boolean, default=False)
    notify_peer_expired = Column(Boolean, default=True)
    notify_system_alerts = Column(Boolean, default=True)
    
    # Alıcılar (virgülle ayrılmış)
    recipient_emails = Column(Text, nullable=True)  # admin@example.com,user@example.com
    
    # Test
    last_test_sent = Column(DateTime, nullable=True)
    last_test_status = Column(String(50), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EmailLog(Base):
    """Gönderilen email kayıtları"""
    __tablename__ = "email_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    recipient = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=False)
    template_name = Column(String(100), nullable=True)
    status = Column(String(50), nullable=False)  # sent, failed, pending
    error_message = Column(Text, nullable=True)
    
    sent_at = Column(DateTime, default=datetime.utcnow)
    
    # Metadata
    event_type = Column(String(100), nullable=True)  # backup_success, peer_added, etc.
    event_data = Column(Text, nullable=True)  # JSON data
