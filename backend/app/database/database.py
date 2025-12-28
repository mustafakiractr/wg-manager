"""
Veritabanı bağlantı ve yapılandırma
SQLAlchemy ile async veritabanı işlemleri
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import event
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# SQLite için async driver kullan
database_url = settings.DATABASE_URL
if database_url.startswith("sqlite"):
    database_url = database_url.replace("sqlite:///", "sqlite+aiosqlite:///")

# Async engine oluştur
engine = create_async_engine(
    database_url,
    echo=False,  # SQL sorgularını logla (geliştirme için True yapılabilir)
    future=True
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Base model sınıfı
Base = declarative_base()


# SQLite için foreign key desteği
@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """SQLite için foreign key desteğini etkinleştir"""
    if "sqlite" in database_url:
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


async def get_db():
    """
    Dependency injection için veritabanı session'ı döner
    Her request için yeni session oluşturur
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """
    Veritabanı tablolarını oluşturur
    Uygulama başlangıcında çağrılır
    """
    from app.models import (
        user,
        log_entry,
        settings,
        peer_handshake,
        traffic_log,
        peer_traffic_log,
        peer_key,
        notification,
        ip_pool,
        activity_log,
        peer_metadata,
        peer_template,
        session
    )

    async with engine.begin() as conn:
        # Tüm tabloları oluştur
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Veritabanı tabloları oluşturuldu")


