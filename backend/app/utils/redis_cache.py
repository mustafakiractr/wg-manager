"""
Redis Cache Utility
Simple cache layer for MikroTik API responses and other frequently accessed data
"""
import redis
import json
import logging
from typing import Optional, Any
from functools import wraps
import hashlib

logger = logging.getLogger(__name__)

# Redis client (singleton)
redis_client = None

def init_redis(host: str = "localhost", port: int = 6379, db: int = 0):
    """Initialize Redis connection"""
    global redis_client
    try:
        redis_client = redis.Redis(
            host=host,
            port=port,
            db=db,
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5,
        )
        # Test connection
        redis_client.ping()
        logger.info(f"✅ Redis connected: {host}:{port}/{db}")
        return True
    except Exception as e:
        logger.warning(f"⚠️ Redis connection failed: {e}. Cache disabled.")
        redis_client = None
        return False


def get_cache(key: str) -> Optional[Any]:
    """Get value from cache"""
    if not redis_client:
        return None
    
    try:
        value = redis_client.get(key)
        if value:
            return json.loads(value)
        return None
    except Exception as e:
        logger.debug(f"Cache get error: {e}")
        return None


def set_cache(key: str, value: Any, ttl: int = 60):
    """
    Set value in cache with TTL
    
    Args:
        key: Cache key
        value: Value to cache (will be JSON serialized)
        ttl: Time to live in seconds (default: 60)
    """
    if not redis_client:
        return False
    
    try:
        serialized = json.dumps(value, default=str)
        redis_client.setex(key, ttl, serialized)
        return True
    except Exception as e:
        logger.debug(f"Cache set error: {e}")
        return False


def delete_cache(key: str):
    """Delete cache key"""
    if not redis_client:
        return False
    
    try:
        redis_client.delete(key)
        return True
    except Exception as e:
        logger.debug(f"Cache delete error: {e}")
        return False


def invalidate_pattern(pattern: str):
    """
    Invalidate all keys matching pattern
    Example: invalidate_pattern("wireguard:*")
    """
    if not redis_client:
        return False
    
    try:
        keys = redis_client.keys(pattern)
        if keys:
            redis_client.delete(*keys)
            logger.debug(f"Invalidated {len(keys)} cache keys: {pattern}")
        return True
    except Exception as e:
        logger.debug(f"Cache invalidate error: {e}")
        return False


def cache_key(*args, **kwargs) -> str:
    """
    Generate cache key from function arguments
    Example: cache_key("wireguard", "interfaces") -> "wireguard:interfaces"
    """
    parts = [str(arg) for arg in args]
    if kwargs:
        # Sort kwargs for consistent key generation
        sorted_kwargs = sorted(kwargs.items())
        kwargs_str = "_".join(f"{k}={v}" for k, v in sorted_kwargs)
        parts.append(kwargs_str)
    return ":".join(parts)


def cached(ttl: int = 60, key_prefix: str = ""):
    """
    Decorator for caching function results
    
    Usage:
        @cached(ttl=30, key_prefix="wireguard")
        async def get_interfaces():
            # expensive operation
            return result
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            func_name = func.__name__
            args_hash = hashlib.md5(
                json.dumps([args, kwargs], default=str).encode()
            ).hexdigest()[:8]
            
            key = f"{key_prefix}:{func_name}:{args_hash}" if key_prefix else f"{func_name}:{args_hash}"
            
            # Try cache first
            cached_value = get_cache(key)
            if cached_value is not None:
                logger.debug(f"Cache hit: {key}")
                return cached_value
            
            # Cache miss - execute function
            logger.debug(f"Cache miss: {key}")
            result = await func(*args, **kwargs)
            
            # Store in cache
            set_cache(key, result, ttl)
            
            return result
        
        return wrapper
    return decorator


# Stats
def get_cache_stats() -> dict:
    """Get Redis cache statistics"""
    if not redis_client:
        return {"enabled": False}
    
    try:
        info = redis_client.info("stats")
        memory = redis_client.info("memory")
        
        return {
            "enabled": True,
            "total_keys": redis_client.dbsize(),
            "used_memory": memory.get("used_memory_human", "N/A"),
            "total_commands": info.get("total_commands_processed", 0),
            "hits": info.get("keyspace_hits", 0),
            "misses": info.get("keyspace_misses", 0),
            "hit_rate": round(
                info.get("keyspace_hits", 0) / max(1, info.get("keyspace_hits", 0) + info.get("keyspace_misses", 0)) * 100,
                2
            ),
        }
    except Exception as e:
        logger.debug(f"Cache stats error: {e}")
        return {"enabled": False, "error": str(e)}
