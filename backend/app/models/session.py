"""
Session modeli
Kullanıcı oturumlarını takip eder (multi-device support)
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database.database import Base


class Session(Base):
    """
    Session tablosu modeli
    Her kullanıcı girişi için ayrı bir session kaydı oluşturulur
    """
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Session tanımlayıcıları
    session_token = Column(String, unique=True, nullable=False, index=True)  # Unique session identifier
    refresh_token = Column(String, unique=True, nullable=True, index=True)   # Refresh token (opsiyonel)

    # Device ve network bilgileri
    device_name = Column(String, nullable=True)         # "Chrome on Windows"
    device_type = Column(String, nullable=True)         # "desktop", "mobile", "tablet"
    user_agent = Column(String, nullable=True)          # Full user agent string
    ip_address = Column(String, nullable=True)          # IP address
    location = Column(String, nullable=True)            # "Istanbul, Turkey" (opsiyonel)

    # Session durumu
    is_active = Column(Boolean, default=True, nullable=False)
    remember_me = Column(Boolean, default=False, nullable=False)  # Extended session

    # Zaman bilgileri
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_activity = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    # Revoke bilgisi
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revoked_reason = Column(String, nullable=True)  # "user_logout", "admin_revoke", "suspicious_activity"
