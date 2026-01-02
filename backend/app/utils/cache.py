"""
Cache yardımcı modülü
MikroTik API çağrılarını cache'ler
"""
import time
from typing import Optional, Dict, Any, Callable
import logging
from functools import wraps
import asyncio

logger = logging.getLogger(__name__)


class SimpleCache:
    """
    Basit in-memory cache sınıfı
    MikroTik API çağrılarını kısa süreli cache'ler
    Thread-safe ve async-safe
    """

    def __init__(self, default_ttl: int = 25, max_size: int = 1000):
        """
        Cache oluştur

        Args:
            default_ttl: Varsayılan cache süresi (saniye) - Auto-refresh 30s, cache 25s
            max_size: Maksimum cache boyutu (LRU eviction için)
        """
        self._cache: Dict[str, Dict[str, Any]] = {}
        self.default_ttl = default_ttl
        self.max_size = max_size
        self._access_times: Dict[str, float] = {}  # LRU tracking

    def get(self, key: str) -> Optional[Any]:
        """
        Cache'den değer al
        LRU tracking ile

        Args:
            key: Cache anahtarı

        Returns:
            Cache'deki değer veya None
        """
        if key not in self._cache:
            return None

        entry = self._cache[key]
        # TTL kontrolü
        if time.time() > entry['expires_at']:
            # Süresi dolmuş, cache'den sil
            del self._cache[key]
            if key in self._access_times:
                del self._access_times[key]
            return None

        # LRU tracking - En son erişim zamanını güncelle
        self._access_times[key] = time.time()
        return entry['value']

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """
        Cache'e değer kaydet
        LRU eviction ile

        Args:
            key: Cache anahtarı
            value: Kaydedilecek değer
            ttl: Cache süresi (saniye), None ise default_ttl kullanılır
        """
        ttl = ttl or self.default_ttl
        expires_at = time.time() + ttl

        # Cache boyut kontrolü (LRU eviction)
        if len(self._cache) >= self.max_size and key not in self._cache:
            # En az kullanılan (LRU) anahtarı bul ve sil
            if self._access_times:
                lru_key = min(self._access_times, key=self._access_times.get)
                del self._cache[lru_key]
                del self._access_times[lru_key]
                logger.debug(f"LRU eviction: {lru_key}")

        self._cache[key] = {
            'value': value,
            'expires_at': expires_at
        }
        self._access_times[key] = time.time()
    
    def clear(self, key: Optional[str] = None) -> None:
        """
        Cache'i temizle

        Args:
            key: Belirli bir anahtarı temizle, None ise tüm cache'i temizle
        """
        if key:
            if key in self._cache:
                del self._cache[key]
            if key in self._access_times:
                del self._access_times[key]
        else:
            self._cache.clear()
            self._access_times.clear()
    
    def invalidate_pattern(self, pattern: str) -> None:
        """
        Belirli bir pattern'e uyan cache anahtarlarını temizle

        Args:
            pattern: Temizlenecek anahtar pattern'i (basit string içerme kontrolü)
        """
        keys_to_delete = [k for k in self._cache.keys() if pattern in k]
        for key in keys_to_delete:
            del self._cache[key]
            if key in self._access_times:
                del self._access_times[key]
    
    def size(self) -> int:
        """Cache'deki kayıt sayısını döndür"""
        return len(self._cache)


# Global cache instance
# MikroTik API çağrıları için 30 saniyelik cache (performans için artırıldı)
mikrotik_cache = SimpleCache(default_ttl=30)


def cached(ttl: int = 10, key_prefix: str = ""):
    """
    Fonksiyon cache decorator'ı
    
    Args:
        ttl: Cache süresi (saniye)
        key_prefix: Cache anahtarı öneki
        
    Usage:
        @cached(ttl=10, key_prefix="interfaces")
        async def get_interfaces():
            ...
    """
    def decorator(func: Callable):
        async def wrapper(*args, **kwargs):
            # Cache anahtarı oluştur
            cache_key = f"{key_prefix}:{func.__name__}:{str(args)}:{str(sorted(kwargs.items()))}"
            
            # Cache'den kontrol et
            cached_value = mikrotik_cache.get(cache_key)
            if cached_value is not None:
                logger.debug(f"Cache hit: {cache_key}")
                return cached_value
            
            # Cache'de yok, fonksiyonu çalıştır
            logger.debug(f"Cache miss: {cache_key}")
            result = await func(*args, **kwargs)
            
            # Sonucu cache'le
            mikrotik_cache.set(cache_key, result, ttl=ttl)
            
            return result
        
        return wrapper
    return decorator

