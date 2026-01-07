"""
Kullanıcı modeli
JWT authentication için kullanıcı bilgilerini saklar
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.database import Base


class User(Base):
    """
    Kullanıcı tablosu modeli
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    avatar_url = Column(String, nullable=True)  # Profil fotoğrafı URL'i

    # 2FA (Two-Factor Authentication) alanları
    two_factor_enabled = Column(Boolean, default=False, nullable=False)
    totp_secret = Column(String, nullable=True)  # TOTP secret key (base32 encoded)
    backup_codes = Column(String, nullable=True)  # JSON formatında yedek kodlar

    # Account lockout alanları
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    last_failed_login = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships - Kullanıcı silindiğinde ilişkili kayıtlar da silinir
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    # Activity logs için cascade - user silindiğinde loglar da silinir
    # NOT: Activity log model'de relationship tanımlanmalı


