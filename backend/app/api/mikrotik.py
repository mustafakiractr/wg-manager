"""
MikroTik API bağlantı test endpoint'leri
Bağlantı durumu ve test işlemleri için API'ler
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.mikrotik.connection import mikrotik_conn
from app.security.auth import get_current_user
from app.models.user import User
from app.models.settings import MikroTikSettings
from app.database.database import get_db
from app.config import settings
from app.utils.crypto import encrypt_password, decrypt_password
import os
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def parse_mikrotik_rate(rate_str: str) -> int:
    """
    MikroTik rate string'ini bytes/sec'e çevirir
    Örn: "20.1kbps" -> 2512, "77.9kbps" -> 9737, "1.5Mbps" -> 187500

    Args:
        rate_str: MikroTik rate formatı (örn: "20.1kbps", "1.5Mbps")

    Returns:
        bytes/sec olarak integer değer
    """
    if not rate_str or rate_str == '0' or rate_str == '0bps':
        return 0

    try:
        # String'i temizle ve küçük harfe çevir
        rate_str = str(rate_str).strip().lower()

        # Sayı ve birim kısmını ayır
        # "20.1kbps" -> sayı: 20.1, birim: kbps
        import re
        match = re.match(r'^([\d.]+)\s*([a-z]+)$', rate_str)

        if not match:
            logger.warning(f"Rate formatı anlaşılamadı: {rate_str}")
            return 0

        value = float(match.group(1))
        unit = match.group(2)

        # Bits per second -> bytes per second çevrimi
        # bps: bits per second
        # kbps: kilobits per second (1000 bits)
        # Mbps: megabits per second (1000000 bits)
        # Gbps: gigabits per second (1000000000 bits)

        multipliers = {
            'bps': 1,
            'kbps': 1000,
            'mbps': 1000000,
            'gbps': 1000000000,
        }

        multiplier = multipliers.get(unit, 1)
        bits_per_sec = value * multiplier

        # Bits'i bytes'a çevir (8 bite böl)
        bytes_per_sec = int(bits_per_sec / 8)

        logger.debug(f"Rate parse: {rate_str} -> {bytes_per_sec} bytes/sec")

        return bytes_per_sec

    except Exception as e:
        logger.error(f"Rate parse hatası: {rate_str}, hata: {e}")
        return 0


class ConnectionTestResponse(BaseModel):
    """Bağlantı testi yanıt modeli"""
    success: bool
    connected: bool
    message: str
    host: str
    port: int
    details: Dict[str, Any] = {}


class ConnectionConfigUpdate(BaseModel):
    """Bağlantı yapılandırması güncelleme modeli"""
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    use_tls: Optional[bool] = None


@router.get("/test")
async def test_connection(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    MikroTik router bağlantısını test eder
    
    Returns:
        Bağlantı durumu ve detayları
    """
    try:
        # Önce veritabanından ayarları yükle (eğer varsa)
        from app.database.database import AsyncSessionLocal
        from app.models.settings import MikroTikSettings
        from sqlalchemy import select
        
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
        
        # Bağlantıyı test et
        connected = await mikrotik_conn.connect()
        
        if connected:
            # Bağlantı başarılıysa router bilgilerini almayı dene
            try:
                # Basit bir komut çalıştırarak bağlantının çalıştığını doğrula
                # System resource bilgisini al
                system_info = await mikrotik_conn.execute_command("/system/resource", "print")
                
                # Bağlantıyı kapatma - WireGuard işlemleri için açık kalmalı
                # await mikrotik_conn.disconnect()
                
                return {
                    "success": True,
                    "connected": True,
                    "message": "MikroTik router'a başarıyla bağlanıldı. Bağlantı WireGuard işlemleri için açık tutuluyor.",
                    "host": mikrotik_conn.host,
                    "port": mikrotik_conn.port,
                    "details": {
                        "system_info": system_info[0] if system_info else {},
                        "username": mikrotik_conn.username,
                        "use_tls": mikrotik_conn.use_tls
                    }
                }
            except Exception as e:
                # Bağlantı kuruldu ama komut çalıştırılamadı
                # Bağlantıyı kapatma - tekrar deneme şansı için açık tut
                # await mikrotik_conn.disconnect()
                error_msg = str(e)
                # Daha detaylı hata mesajı
                if "get_resource" in error_msg or "AttributeError" in error_msg:
                    error_msg = f"API erişim hatası: {error_msg}. MikroTik API versiyonu veya erişim izinleri kontrol edilmeli."
                return {
                    "success": True,
                    "connected": True,
                    "message": f"Bağlantı kuruldu ancak komut çalıştırılamadı: {error_msg}",
                    "host": mikrotik_conn.host,
                    "port": mikrotik_conn.port,
                    "details": {
                        "error": error_msg,
                        "error_type": type(e).__name__
                    }
                }
        else:
            # Port bilgisini kontrol et - None veya boş ise varsayılan port göster
            port = mikrotik_conn.port
            if port is None or port == "" or port == 0:
                port = 8728
            
            return {
                "success": False,
                "connected": False,
                "message": "MikroTik router'a bağlanılamadı",
                "host": mikrotik_conn.host or "Belirtilmemiş",
                "port": port,
                "details": {
                    "error": "Bağlantı kurulamadı. Port ve kimlik bilgilerini kontrol edin.",
                    "host": mikrotik_conn.host,
                    "port_original": mikrotik_conn.port,
                    "username": mikrotik_conn.username
                }
            }
    except Exception as e:
        error_msg = str(e)
        error_type = type(e).__name__
        
        # Port bilgisini kontrol et
        port = mikrotik_conn.port
        if port is None or port == "" or port == 0:
            port = 8728
        
        # Kimlik doğrulama hatası kontrolü
        if "invalid user name or password" in error_msg.lower() or "password" in error_msg.lower() or "login failure" in error_msg.lower() or "authentication" in error_msg.lower():
            error_msg = f"Kullanıcı adı veya şifre hatalı (Login Failure). MikroTik'te kontrol edin:\n" \
                       f"1. Kullanıcı adı: {mikrotik_conn.username}\n" \
                       f"2. Şifre doğru mu?\n" \
                       f"3. Kullanıcının API erişim izni var mı? (/user group print)\n" \
                       f"4. API servisi aktif mi? (/ip service print)\n" \
                       f"5. MikroTik log'larında 'login failure for user {mikrotik_conn.username}' görünüyor mu?"
        elif "connection" in error_msg.lower() or "timeout" in error_msg.lower():
            error_msg = f"Bağlantı hatası: {error_msg}. Port {port} açık mı ve MikroTik API servisi aktif mi kontrol edin."
        
        return {
            "success": False,
            "connected": False,
            "message": f"Bağlantı hatası: {error_msg}",
            "host": mikrotik_conn.host or "Belirtilmemiş",
            "port": port,
            "details": {
                "error": error_msg,
                "error_type": error_type,
                "host": mikrotik_conn.host,
                "port_original": mikrotik_conn.port,
                "username": mikrotik_conn.username
            }
        }


@router.get("/status")
async def get_connection_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    MikroTik bağlantı durumunu kontrol eder (bağlantı kurmadan)
    Önce veritabanından okur, yoksa runtime ayarlarından
    
    Returns:
        Bağlantı yapılandırması ve durumu
    """
    try:
        # Veritabanından ayarları oku
        result = await db.execute(select(MikroTikSettings).where(MikroTikSettings.id == 1))
        db_settings = result.scalar_one_or_none()
        
        # Bağlantı durumunu kontrol et (bağlantı kurmadan)
        is_connected = mikrotik_conn.connection is not None and mikrotik_conn.api is not None
        
        if db_settings:
            # Veritabanından ayarları kullan
            return {
                "success": True,
                "connected": is_connected,
                "host": db_settings.host,
                "port": db_settings.port,
                "username": db_settings.username,
                "password": "***" if db_settings.password else "",  # Şifreyi gizle
                "use_tls": db_settings.use_tls,
                "configured": bool(db_settings.host and db_settings.username)
            }
        else:
            # Veritabanında yoksa runtime ayarlarından oku
            password_display = "***" if mikrotik_conn.password else ""
            return {
                "success": True,
                "connected": is_connected,
                "host": mikrotik_conn.host,
                "port": mikrotik_conn.port,
                "username": mikrotik_conn.username,
                "password": password_display,  # Şifreyi gizle
                "use_tls": mikrotik_conn.use_tls,
                "configured": bool(mikrotik_conn.host and mikrotik_conn.username)
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Durum bilgisi alınamadı: {str(e)}")


@router.post("/config")
async def update_connection_config(
    config: ConnectionConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    MikroTik bağlantı yapılandırmasını günceller
    Veritabanına kaydeder ve runtime ayarlarını günceller
    
    Args:
        config: Güncellenecek yapılandırma bilgileri
        db: Veritabanı session'ı
    
    Returns:
        Güncellenmiş yapılandırma bilgisi
    """
    try:
        # Mevcut bağlantıyı kapat (varsa)
        if mikrotik_conn.connection:
            await mikrotik_conn.disconnect()
        
        # Veritabanından mevcut ayarları oku veya yeni oluştur
        result = await db.execute(select(MikroTikSettings).where(MikroTikSettings.id == 1))
        db_settings = result.scalar_one_or_none()
        
        if db_settings:
            # Mevcut kaydı güncelle
            if config.host is not None:
                db_settings.host = config.host
                mikrotik_conn.host = config.host
                settings.MIKROTIK_HOST = config.host
            
            if config.port is not None:
                db_settings.port = config.port
                mikrotik_conn.port = config.port
                settings.MIKROTIK_PORT = config.port
            
            if config.username is not None:
                db_settings.username = config.username
                mikrotik_conn.username = config.username
                settings.MIKROTIK_USER = config.username
            
            if config.password is not None:
                # Şifreyi encrypt et ve database'e kaydet
                encrypted_password = encrypt_password(config.password)
                db_settings.password = encrypted_password
                # Connection manager'a plain text olarak ver (decrypt etmeden)
                mikrotik_conn.password = config.password
                settings.MIKROTIK_PASSWORD = config.password
            
            if config.use_tls is not None:
                db_settings.use_tls = config.use_tls
                mikrotik_conn.use_tls = config.use_tls
                settings.MIKROTIK_USE_TLS = config.use_tls
        else:
            # Yeni kayıt oluştur
            plain_password = config.password or settings.MIKROTIK_PASSWORD or ""
            encrypted_password = encrypt_password(plain_password) if plain_password else ""

            new_settings = MikroTikSettings(
                id=1,
                host=config.host or settings.MIKROTIK_HOST or "192.168.1.1",
                port=config.port or settings.MIKROTIK_PORT or 8728,
                username=config.username or settings.MIKROTIK_USER or "admin",
                password=encrypted_password,  # Encrypted password
                use_tls=config.use_tls if config.use_tls is not None else settings.MIKROTIK_USE_TLS
            )

            # Runtime ayarlarını güncelle (plain text ile)
            mikrotik_conn.host = new_settings.host
            mikrotik_conn.port = new_settings.port
            mikrotik_conn.username = new_settings.username
            mikrotik_conn.password = plain_password  # Plain text for connection
            mikrotik_conn.use_tls = new_settings.use_tls

            settings.MIKROTIK_HOST = new_settings.host
            settings.MIKROTIK_PORT = new_settings.port
            settings.MIKROTIK_USER = new_settings.username
            settings.MIKROTIK_PASSWORD = plain_password  # Plain text for settings
            settings.MIKROTIK_USE_TLS = new_settings.use_tls

            db.add(new_settings)
            db_settings = new_settings
        
        # Veritabanına kaydet
        await db.commit()
        await db.refresh(db_settings)
        
        return {
            "success": True,
            "message": "Bağlantı yapılandırması başarıyla kaydedildi",
            "host": db_settings.host,
            "port": db_settings.port,
            "username": db_settings.username,
            "password": "***",  # Şifreyi gizle
            "use_tls": db_settings.use_tls,
            "configured": bool(db_settings.host and db_settings.username)
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Yapılandırma kaydedilemedi: {str(e)}")


@router.get("/wan-traffic")
async def get_wan_traffic(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    WAN interface'in trafik istatistiklerini getirir
    
    Returns:
        WAN interface RX/TX bytes ve rate bilgileri
    """
    try:
        # MikroTik bağlantısını kontrol et
        if not await mikrotik_conn.ensure_connected():
            raise HTTPException(status_code=503, detail="MikroTik router'a bağlanılamadı")

        # Tüm interface'leri al (generic interface, traffic stats dahil)
        all_interfaces = await mikrotik_conn.execute_command("/interface", "print")

        logger.info(f"MikroTik'ten alınan interface sayısı: {len(all_interfaces)}")

        # Debug: Tüm interface'leri logla
        for iface in all_interfaces:
            logger.info(f"  Interface: {iface.get('name')} - type: {iface.get('type')}, comment: {iface.get('comment', 'N/A')}, running: {iface.get('running')}")

        # WAN interface'i bul - SADECE COMMENT'e bakarak
        wan_interface_name = None

        # Comment'te "WAN" yazan interface'i bul (case-insensitive)
        for iface in all_interfaces:
            comment = iface.get('comment', '').lower()
            if 'wan' in comment:
                wan_interface_name = iface.get('name')
                logger.info(f"✅ WAN interface bulundu (comment ile): {wan_interface_name}, comment: {iface.get('comment')}")
                break

        if not wan_interface_name:
            logger.warning("WAN interface bulunamadı, hiç ethernet interface yok")
            return {
                "success": False,
                "message": "WAN interface bulunamadı",
                "data": {
                    "interface_name": None,
                    "rx_bytes": 0,
                    "tx_bytes": 0,
                    "rx_rate": 0,
                    "tx_rate": 0
                }
            }

        logger.info(f"WAN interface seçildi: {wan_interface_name}")

        # Seçilen WAN interface'in detaylarını bul
        wan_interface = next((iface for iface in all_interfaces if iface.get('name') == wan_interface_name), None)

        if not wan_interface:
            logger.error(f"WAN interface detayları bulunamadı: {wan_interface_name}")
            return {
                "success": False,
                "message": "WAN interface detayları alınamadı",
                "data": {
                    "interface_name": wan_interface_name,
                    "rx_bytes": 0,
                    "tx_bytes": 0,
                    "rx_rate": 0,
                    "tx_rate": 0
                }
            }

        logger.info(f"WAN interface detayları: {wan_interface}")

        # Trafik bilgilerini parse et (interface print içinde rx-byte, tx-byte var)
        rx_bytes = int(wan_interface.get('rx-byte', 0) or 0)
        tx_bytes = int(wan_interface.get('tx-byte', 0) or 0)

        # NOT: Rate hesaplaması frontend'de yapılacak (bytes farkı / zaman farkı)
        # MikroTik API'de monitor-traffic her versiyonda desteklenmiyor

        result = {
            "success": True,
            "data": {
                "interface_name": wan_interface_name,
                "rx_bytes": rx_bytes,
                "tx_bytes": tx_bytes,
                "total_bytes": rx_bytes + tx_bytes,
                "running": wan_interface.get('running', 'false') == 'true'
            }
        }

        logger.info(f"WAN Traffic sonuç: interface={wan_interface_name}, rx={rx_bytes}, tx={tx_bytes}")

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"WAN trafik bilgisi alınamadı: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"WAN trafik bilgisi alınamadı: {str(e)}")

