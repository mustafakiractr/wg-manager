"""
FastAPI ana uygulama dosyası
Uygulama başlatma ve route tanımlamaları burada yapılır
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import logging
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.database.database import init_db
from app.api import auth, wireguard, logs, mikrotik, traffic, users, notifications, backup, two_factor, sessions, avatar, activity_logs, websocket, ip_pool, peer_metadata, peer_template, dashboard
from app.utils.logger import setup_logger
from app.utils.crypto import decrypt_password
from app.config import settings

# Logger kurulumu
setup_logger()
logger = logging.getLogger(__name__)

# Rate limiter kurulumu
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"]
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Uygulama başlangıç ve kapanış işlemleri
    Veritabanı bağlantısı ve tablo oluşturma burada yapılır
    """
    # Başlangıçta veritabanını başlat
    logger.info("Veritabanı başlatılıyor...")
    await init_db()
    
    # MikroTik ayarlarını veritabanından yükle
    try:
        from app.database.database import AsyncSessionLocal
        from app.models.settings import MikroTikSettings
        from sqlalchemy import select
        from app.mikrotik.connection import mikrotik_conn
        
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(MikroTikSettings).where(MikroTikSettings.id == 1))
            db_settings = result.scalar_one_or_none()
            
            if db_settings:
                # Veritabanından ayarları yükle
                mikrotik_conn.host = db_settings.host
                mikrotik_conn.port = db_settings.port
                mikrotik_conn.username = db_settings.username
                # Şifreyi decrypt et
                mikrotik_conn.password = decrypt_password(db_settings.password) if db_settings.password else ""
                mikrotik_conn.use_tls = db_settings.use_tls
                logger.info("MikroTik ayarları veritabanından yüklendi")
                
                # WireGuard işlemleri için bağlantıyı açık tut
                # Her cihaz yeniden başladığında otomatik bağlan
                try:
                    if mikrotik_conn.host and mikrotik_conn.username:
                        # Önce mevcut bağlantıyı kapat (varsa)
                        if mikrotik_conn.connection:
                            try:
                                await mikrotik_conn.disconnect()
                            except:
                                pass
                        
                        # Yeni bağlantı kur
                        connected = await mikrotik_conn.connect()
                        if connected:
                            logger.info(f"✅ MikroTik bağlantısı başarıyla kuruldu: {mikrotik_conn.host}:{mikrotik_conn.port}")
                            logger.info("MikroTik bağlantısı WireGuard işlemleri için açık tutuluyor")

                            # İlk senkronizasyon kontrolü
                            try:
                                from app.services.sync_service import SyncService

                                sync_needed = not await SyncService.check_sync_status(session)

                                if sync_needed:
                                    logger.info("🔄 İlk senkronizasyon başlatılıyor...")
                                    sync_result = await SyncService.perform_initial_sync(session)

                                    if sync_result["success"]:
                                        logger.info(
                                            f"✅ Senkronizasyon tamamlandı: "
                                            f"{sync_result['interfaces_synced']} interface, "
                                            f"{sync_result['peers_synced']} peer"
                                        )
                                    else:
                                        logger.warning(
                                            f"⚠️ Senkronizasyon kısmen başarılı: "
                                            f"{len(sync_result['errors'])} hata"
                                        )
                                else:
                                    logger.info("✓ İlk senkronizasyon daha önce tamamlanmış")

                            except Exception as sync_error:
                                # Sync hatası app'i crash ettirmemeli
                                logger.error(f"❌ Senkronizasyon hatası: {sync_error}")
                                logger.warning("Uygulama normal şekilde devam ediyor")
                                import traceback
                                logger.debug(traceback.format_exc())
                        else:
                            logger.error(f"❌ MikroTik bağlantısı kurulamadı: {mikrotik_conn.host}:{mikrotik_conn.port}")
                            logger.warning("WireGuard işlemleri sırasında tekrar denenilecek")
                    else:
                        logger.warning("⚠️ MikroTik bağlantı bilgileri eksik (host veya username yok)")
                        logger.warning("Lütfen MikroTik Bağlantı sayfasından bağlantı bilgilerini girin")
                except Exception as e:
                    logger.error(f"❌ MikroTik bağlantısı başlatılamadı: {e}")
                    logger.warning("WireGuard işlemleri sırasında tekrar denenilecek")
                    import traceback
                    logger.debug(traceback.format_exc())
    except Exception as e:
        logger.warning(f"MikroTik ayarları veritabanından yüklenemedi: {e}")
        import traceback
        logger.debug(traceback.format_exc())
    
    # Trafik kayıt zamanlayıcısını başlat
    try:
        from app.utils.traffic_scheduler import start_traffic_scheduler
        await start_traffic_scheduler()
        logger.info("Trafik kayıt zamanlayıcısı başlatıldı")
    except Exception as e:
        logger.warning(f"Trafik kayıt zamanlayıcısı başlatılamadı: {e}")
        import traceback
        logger.debug(traceback.format_exc())
    
    logger.info("Uygulama başlatıldı")
    yield
    # Kapanışta temizlik işlemleri
    logger.info("Uygulama kapatılıyor...")


# FastAPI uygulaması oluştur
app = FastAPI(
    title="MikroTik Router Yönetim Paneli",
    description="WireGuard ve Router yönetimi için API",
    version="1.0.0",
    lifespan=lifespan
)

# Rate limiter'ı app'e ekle
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Validation error handler - Detaylı hata mesajları için
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Pydantic validation hatalarını detaylı olarak logla
    """
    logger.error(f"❌ Validation Error on {request.url}")
    logger.error(f"❌ Errors: {exc.errors()}")
    logger.error(f"❌ Body: {exc.body}")

    return JSONResponse(
        status_code=422,
        content={
            "detail": exc.errors(),
            "body": exc.body
        }
    )

# CORS middleware - Frontend'den gelen isteklere izin ver
# Production'da daha kısıtlayıcı CORS kullan
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],  # Sadece gerekli metotlar
    allow_headers=["*"],
    max_age=600,  # Preflight cache: 10 dakika
)


# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """
    Her response'a güvenlik header'ları ekler
    """
    response = await call_next(request)

    # Güvenlik header'ları ekle
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Production'da ek güvenlik header'ları (CSP geçici olarak devre dışı)
    if settings.is_production():
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        # CSP devre dışı - frontend ile uyumluluk sorunu
        # response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'"

    return response


# Request size limiter middleware
@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    """
    Request boyutunu sınırlar (DoS koruması)
    """
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > settings.MAX_REQUEST_SIZE:
        return JSONResponse(
            status_code=413,
            content={"success": False, "message": "Request çok büyük (maksimum 10MB)"}
        )
    return await call_next(request)


# Hata yakalama middleware
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """
    Tüm beklenmeyen hataları yakalar ve standart JSON formatında döner
    """
    logger.error(f"Beklenmeyen hata: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Sunucu hatası oluştu", "error": str(exc)}
    )


# API route'larını ekle
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(two_factor.router, prefix="/api/v1/2fa", tags=["Two-Factor Auth"])
app.include_router(sessions.router, prefix="/api/v1", tags=["Sessions"])
app.include_router(wireguard.router, prefix="/api/v1/wg", tags=["WireGuard"])
app.include_router(logs.router, prefix="/api/v1", tags=["Logs"])
app.include_router(mikrotik.router, prefix="/api/v1/mikrotik", tags=["MikroTik"])
app.include_router(traffic.router, prefix="/api/v1/traffic", tags=["Traffic"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(avatar.router, prefix="/api/v1/avatar", tags=["Avatar"])
app.include_router(notifications.router, prefix="/api/v1", tags=["Notifications"])
app.include_router(activity_logs.router, prefix="/api/v1", tags=["Activity Logs"])
app.include_router(backup.router, prefix="/api/v1", tags=["Backup/Restore"])
app.include_router(websocket.router, prefix="/api/v1", tags=["WebSocket"])
app.include_router(ip_pool.router, prefix="/api/v1", tags=["IP Pool"])
app.include_router(peer_metadata.router, prefix="/api/v1", tags=["Peer Metadata"])
app.include_router(peer_template.router, prefix="/api/v1", tags=["Peer Templates"])
app.include_router(dashboard.router, prefix="/api/v1", tags=["Dashboard"])


# Sağlık kontrolü endpoint'i
@app.get("/")
async def root():
    """API'nin çalıştığını kontrol eden endpoint"""
    return {"success": True, "message": "MikroTik Router Yönetim API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    """Detaylı sağlık kontrolü"""
    return {
        "success": True,
        "status": "healthy",
        "service": "router-manager-api"
    }


