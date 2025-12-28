"""
Log kayıt modeli
Kullanıcı işlemlerini kaydetmek için kullanılır
"""
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.database.database import Base


class LogEntry(Base):
    """
    Log kayıt tablosu modeli
    Kim, ne zaman, ne yaptı bilgilerini saklar
    """
    __tablename__ = "log_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True, nullable=False)
    action = Column(String, nullable=False)  # Örn: "peer_added", "peer_deleted"
    details = Column(Text, nullable=True)  # Detaylı bilgi (JSON string olabilir)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


