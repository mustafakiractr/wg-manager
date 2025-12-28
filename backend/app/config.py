"""
Uygulama yapılandırma ayarları
.env dosyasından değişkenleri yükler
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator, validator
from typing import List, Literal
import os


class Settings(BaseSettings):
    # Ortam ayarı (development, production)
    ENVIRONMENT: Literal["development", "production"] = "development"

    # MikroTik bağlantı ayarları
    MIKROTIK_HOST: str = "192.168.1.1"
    MIKROTIK_PORT: int = 8728
    MIKROTIK_USER: str = "admin"
    MIKROTIK_PASSWORD: str = ""
    MIKROTIK_USE_TLS: bool = False

    # Veritabanı
    DATABASE_URL: str = "sqlite:///./router_manager.db"

    # JWT ayarları
    SECRET_KEY: str  # .env'den okunacak, varsayılan değer yok (güvenlik için)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # API ayarları
    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: str = "http://localhost:5173"  # Virgülle ayrılmış string, validator'da List'e çevrilecek
    _cors_origins_list: List[str] = []  # Private field, validator tarafından doldurulacak

    # Rate limiting (istekler/dakika)
    RATE_LIMIT_PER_MINUTE: int = 200
    RATE_LIMIT_LOGIN: int = 5  # Login endpoint için (brute force koruması)

    # Account lockout ayarları
    MAX_FAILED_LOGIN_ATTEMPTS: int = 5  # Kaç başarısız denemeden sonra kilitlenecek
    ACCOUNT_LOCKOUT_DURATION_MINUTES: int = 15  # Kilitleme süresi (dakika)

    # Session management ayarları
    SESSION_EXPIRE_MINUTES: int = 480  # Normal session: 8 saat
    SESSION_REMEMBER_ME_DAYS: int = 30  # Remember me: 30 gün
    MAX_ACTIVE_SESSIONS_PER_USER: int = 5  # Kullanıcı başına maksimum aktif session

    # Güvenlik ayarları
    ENABLE_HTTPS_REDIRECT: bool = False  # Production'da True olmalı
    TRUSTED_HOSTS: str = "*"  # Virgülle ayrılmış string, validator'da List'e çevrilecek
    _trusted_hosts_list: List[str] = ["*"]  # Private field
    MAX_REQUEST_SIZE: int = 10 * 1024 * 1024  # 10 MB maksimum request size

    @field_validator('CORS_ORIGINS')
    @classmethod
    def parse_cors_origins(cls, v):
        """CORS_ORIGINS string olarak kalır, get_cors_origins() ile liste döner"""
        return v

    @field_validator('TRUSTED_HOSTS')
    @classmethod
    def parse_trusted_hosts(cls, v):
        """TRUSTED_HOSTS string olarak kalır"""
        return v

    def get_cors_list(self) -> List[str]:
        """CORS origins'i liste olarak döner"""
        if not self._cors_origins_list:
            if isinstance(self.CORS_ORIGINS, str):
                self._cors_origins_list = [origin.strip() for origin in self.CORS_ORIGINS.split(',') if origin.strip()]
            else:
                self._cors_origins_list = []
        return self._cors_origins_list

    @field_validator('SECRET_KEY')
    @classmethod
    def validate_secret_key(cls, v):
        """SECRET_KEY'in yeterince güçlü olduğunu kontrol eder"""
        if len(v) < 32:
            raise ValueError("SECRET_KEY en az 32 karakter olmalıdır (güvenlik için)")
        return v

    # Log ayarları
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/app.log"

    # Production modu kontrolleri
    def is_production(self) -> bool:
        """Production ortamında mı çalışıyor?"""
        return self.ENVIRONMENT == "production"

    def get_cors_origins(self) -> List[str]:
        """
        CORS origins'i ortama göre döner
        Production'da sadece güvenli origin'lere izin verir
        """
        cors_list = self.get_cors_list()

        if self.is_production():
            # Production'da wildcard (*) ve localhost'a izin verme
            safe_origins = [
                origin for origin in cors_list
                if not origin.startswith("http://localhost")
                and not origin.startswith("http://127.0.0.1")
                and origin != "*"
            ]
            return safe_origins if safe_origins else cors_list
        return cors_list

    class Config:
        env_file = ".env"
        case_sensitive = True
        # List tipli field'lar için JSON parse'ı devre dışı bırak
        env_parse_enums = False


# Global settings instance
settings = Settings()

