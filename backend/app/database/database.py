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
# Connection pooling optimization
# - pool_size: Havuzda tutulacak minimum bağlantı sayısı
# - max_overflow: Ekstra bağlantı sayısı (pool_size + max_overflow = maksimum)
# - pool_pre_ping: Her bağlantıyı kullanmadan önce test et (stale connection kontrolü)
# - pool_recycle: Bağlantıları 1 saatte bir yenile (3600s)
# - pool_timeout: Bağlantı beklerken max timeout (30s)
engine = create_async_engine(
    database_url,
    echo=False,  # SQL sorgularını logla (geliştirme için True yapılabilir)
    future=True,
    pool_size=10,  # Default 5 → 10'a çıkarıldı
    max_overflow=20,  # Default 10 → 20'ye çıkarıldı (max 30 concurrent connection)
    pool_pre_ping=True,  # Stale connection kontrolü
    pool_recycle=3600,  # 1 saatte bir connection yenile
    pool_timeout=30,  # 30 saniye bağlantı timeout
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
        session,
        telegram_settings
    )

    async with engine.begin() as conn:
        # Tüm tabloları oluştur
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Veritabanı tabloları oluşturuldu")


