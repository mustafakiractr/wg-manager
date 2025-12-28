"""
IP address helper functions
X-Forwarded-For ve gerçek IP adresini çıkarmak için
"""
from fastapi import Request

def get_client_ip(request: Request) -> str:
    """
    Request'ten gerçek client IP adresini döner
    Proxy arkasındaysa X-Forwarded-For header'ını kontrol eder
    """
    # X-Forwarded-For header'ını kontrol et (proxy/load balancer arkasındaysa)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # İlk IP gerçek client IP'dir
        return forwarded.split(",")[0].strip()
    
    # X-Real-IP header'ını kontrol et (Nginx gibi)
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    
    # Direkt client IP
    if request.client:
        return request.client.host
    
    return "127.0.0.1"
