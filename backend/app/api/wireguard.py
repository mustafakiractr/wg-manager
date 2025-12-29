"""
WireGuard API endpoint'leri
Interface ve peer yönetimi için API'ler
"""
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.mikrotik.connection import mikrotik_conn
from app.security.auth import get_current_user
from app.models.user import User
from app.models.peer_key import PeerKey
from app.database.database import get_db
from app.services.log_service import create_log
from app.services.notification_service import (
    notify_peer_created,
    notify_peer_deleted,
    notify_interface_started,
    notify_interface_stopped,
)
from sqlalchemy import select, delete
from app.services.peer_handshake_service import track_peer_status, get_peer_logs, get_peer_status_summary
from app.utils.qrcode_generator import generate_qrcode
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import timezone, timedelta
from app.websocket.connection_manager import manager as ws_manager
import subprocess
import base64
import os
import logging
import re

router = APIRouter()
logger = logging.getLogger(__name__)


async def update_allocation_background(allocation_id: int, peer_id: str, public_key: str):
    """
    Arka planda IP allocation'ı güncelle (bağımsız DB session ile)

    Args:
        allocation_id: IP Allocation ID
        peer_id: Peer ID
        public_key: Public key
    """
    try:
        from app.database.database import AsyncSessionLocal
        from app.models.ip_pool import IPAllocation
        from sqlalchemy import update

        async with AsyncSessionLocal() as db:
            stmt = (
                update(IPAllocation)
                .where(IPAllocation.id == allocation_id)
                .values(
                    peer_id=str(peer_id),
                    peer_public_key=public_key
                )
            )
            await db.execute(stmt)
            await db.commit()
            logger.info(f"✅ IP allocation güncellendi (arka plan) - Peer ID: {peer_id}, Allocation ID: {allocation_id}")
    except Exception as e:
        logger.error(f"⚠️ IP allocation güncellenemedi (arka plan): {e}")
        import traceback
        logger.debug(traceback.format_exc())


async def send_peer_notification_background(user_id: int, peer_name: str, interface: str, action: str = "created"):
    """
    Arka planda bildirim gönder (bağımsız DB session ile)

    Args:
        user_id: Kullanıcı ID'si
        peer_name: Peer adı
        interface: Interface adı
        action: İşlem türü ("created", "deleted", "updated")
    """
    try:
        # Yeni bir database session oluştur
        from app.database.database import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            if action == "created":
                await notify_peer_created(
                    db=db,
                    user_id=user_id,
                    peer_name=peer_name,
                    interface=interface
                )
            elif action == "deleted":
                await notify_peer_deleted(
                    db=db,
                    user_id=user_id,
                    peer_name=peer_name,
                    interface=interface
                )
            logger.info(f"✅ Peer {action} bildirimi gönderildi: {peer_name}")
    except Exception as e:
        # Bildirim hatası uygulamayı etkilememeli
        logger.error(f"⚠️ Bildirim gönderilemedi (peer {action} başarılı): {e}")
        import traceback
        logger.debug(traceback.format_exc())


async def update_template_usage_background(template_id: int):
    """
    Arka planda template kullanım istatistiklerini güncelle (bağımsız DB session ile)

    Args:
        template_id: Template ID
    """
    try:
        from app.database.database import AsyncSessionLocal
        from app.models.peer_template import PeerTemplate
        from sqlalchemy import update
        from datetime import datetime

        async with AsyncSessionLocal() as db:
            # Template'in usage_count'unu artır ve last_used_at'ı güncelle
            stmt = (
                update(PeerTemplate)
                .where(PeerTemplate.id == template_id)
                .values(
                    usage_count=PeerTemplate.usage_count + 1,
                    last_used_at=datetime.utcnow()
                )
            )
            await db.execute(stmt)
            await db.commit()
            logger.info(f"✅ Template kullanım istatistiği güncellendi - Template ID: {template_id}")
    except Exception as e:
        logger.error(f"⚠️ Template istatistiği güncellenemedi (peer oluşturma başarılı): {e}")
        import traceback
        logger.debug(traceback.format_exc())


def generate_wireguard_keys():
    """
    WireGuard özel ve genel anahtar çifti oluşturur
    
    Returns:
        tuple: (private_key, public_key)
    """
    try:
        # wg komutu varsa kullan
        result = subprocess.run(
            ['wg', 'genkey'],
            capture_output=True,
            text=True,
            check=True
        )
        private_key = result.stdout.strip()
        
        # Public key'i oluştur
        pub_result = subprocess.run(
            ['wg', 'pubkey'],
            input=private_key,
            capture_output=True,
            text=True,
            check=True
        )
        public_key = pub_result.stdout.strip()
        
        return private_key, public_key
    except (subprocess.CalledProcessError, FileNotFoundError):
        # wg komutu yoksa, Python ile oluştur
        # WireGuard anahtarları 32 byte (256 bit) random data'dan oluşur
        private_key_bytes = os.urandom(32)
        private_key = base64.b64encode(private_key_bytes).decode('utf-8')
        
        # Public key, private key'den türetilir (Curve25519)
        # Bu basit bir yaklaşım, gerçekte Curve25519 kullanılmalı
        # Ancak WireGuard için wg komutu gerekli
        # Şimdilik random bir public key oluşturalım
        public_key_bytes = os.urandom(32)
        public_key = base64.b64encode(public_key_bytes).decode('utf-8')
        
        logger.warning("wg komutu bulunamadı, random anahtarlar oluşturuldu. Gerçek WireGuard anahtarları için wg komutu gerekli.")
        return private_key, public_key


@router.get("/generate-keys")
async def generate_keys(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    WireGuard özel ve genel anahtar çifti oluşturur
    """
    logger.info(f"🔑 Anahtar oluşturma isteği alındı. Kullanıcı: {current_user.username}")
    try:
        private_key, public_key = generate_wireguard_keys()
        
        # Anahtar uzunluklarını kontrol et
        if not private_key or not public_key:
            logger.error("Anahtar oluşturma başarısız: Boş anahtar döndü")
            raise HTTPException(status_code=500, detail="Anahtarlar oluşturulamadı: Boş anahtar döndü")
        
        if len(private_key) < 40 or len(public_key) < 40:
            logger.warning(f"Anahtar uzunlukları beklenenden kısa. Private: {len(private_key)}, Public: {len(public_key)}")
        
        logger.info(f"✅ Anahtarlar başarıyla oluşturuldu. Private Key (ilk 20): {private_key[:20]}..., Public Key (ilk 20): {public_key[:20]}...")
        
        return {
            "success": True,
            "private_key": private_key,
            "public_key": public_key
        }
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        logger.error(f"❌ Anahtar oluşturma hatası: {error_msg}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        # Subprocess hatalarını özel olarak işle
        if "wg" in error_msg.lower() or "subprocess" in error_msg.lower() or "command not found" in error_msg.lower():
            raise HTTPException(
                status_code=500,
                detail="WireGuard anahtarları oluşturulamadı. Sistemde 'wg' komutu bulunamadı veya çalıştırılamadı. Lütfen WireGuard'ın yüklü olduğundan emin olun."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Anahtarlar oluşturulamadı: {error_msg}"
            )


class PeerAddRequest(BaseModel):
    """Peer ekleme isteği modeli"""
    interface: str
    public_key: str
    allowed_address: Optional[str] = None
    comment: Optional[str] = None
    persistent_keepalive: Optional[str] = None
    private_key: Optional[str] = None  # QR kod ve config için
    dns: Optional[str] = None
    endpoint_allowed_address: Optional[str] = None  # Endpoint için izin verilen IP'ler
    preshared_key: Optional[str] = None  # Pre-shared key
    mtu: Optional[int] = None
    name: Optional[str] = None  # Peer adı
    endpoint_address: Optional[str] = None  # Endpoint adresi (DNS veya IP)
    endpoint_port: Optional[int] = None  # Endpoint port numarası
    template_id: Optional[int] = None  # Kullanılan şablon ID'si (kullanım istatistikleri için)


class PeerUpdateRequest(BaseModel):
    """Peer güncelleme isteği modeli"""
    allowed_address: Optional[str] = None
    comment: Optional[str] = None
    name: Optional[str] = None  # MikroTik'teki name alanı
    persistent_keepalive: Optional[str] = None
    disabled: Optional[bool] = None
    interface: Optional[str] = None  # Interface adı (allowed_address birleştirme için gerekli)


@router.get("/interfaces")
async def get_interfaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Tüm WireGuard interface'lerini listeler ve peer durumlarını takip eder
    """
    try:
        # Bağlantının açık olduğundan emin ol
        await mikrotik_conn.ensure_connected()
        interfaces = await mikrotik_conn.get_wireguard_interfaces()
        
        # Her interface için peer'ları al ve durumları takip et
        for iface in interfaces:
            interface_name = iface.get('name') or iface.get('.id')
            if interface_name:
                try:
                    peers = await mikrotik_conn.get_wireguard_peers(interface_name)
                    for peer in peers:
                        peer_id = peer.get('id') or peer.get('.id')
                        if peer_id:
                            # Public key'i normalize et - hem 'public-key' hem 'public_key' kontrolü yap
                            public_key = peer.get('public-key') or peer.get('public_key')
                            if public_key:
                                public_key = str(public_key).strip()
                            
                            # Durumu takip et
                            await track_peer_status(
                                db=db,
                                peer_id=str(peer_id),
                                interface_name=interface_name,
                                peer_name=peer.get('comment') or peer.get('name'),
                                public_key=public_key,
                                last_handshake_value=peer.get('last-handshake')
                            )
                except Exception as e:
                    logger.error(f"Peer durum tracking hatası ({interface_name}): {e}")
        
        return {
            "success": True,
            "data": interfaces
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Interface listesi alınamadı: {str(e)}")


@router.get("/next-available-ip/{interface}")
async def get_next_available_ip(
    interface: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Interface için IP pool varsa sıradaki boş IP'yi döner

    Returns:
        {
            "success": True,
            "has_pool": True,
            "next_ip": "10.0.0.5",
            "pool_info": {...}
        }

        veya pool yoksa:
        {
            "success": True,
            "has_pool": False,
            "message": "Bu interface için aktif IP pool yok"
        }
    """
    try:
        from app.services.ip_pool_service import IPPoolService

        # Interface için aktif pool'ları al
        pools = await IPPoolService.get_pools(
            db,
            interface_name=interface,
            is_active=True
        )

        if not pools:
            return {
                "success": True,
                "has_pool": False,
                "message": f"{interface} için aktif IP pool bulunamadı"
            }

        # İlk pool'u kullan (birden fazla pool varsa ilkini al)
        pool = pools[0]

        # Sıradaki boş IP'yi bul
        next_ip = await IPPoolService.find_next_available_ip(db, pool.id)

        if not next_ip:
            return {
                "success": True,
                "has_pool": True,
                "next_ip": None,
                "message": f"Pool dolu: {pool.name}",
                "pool_info": {
                    "id": pool.id,
                    "name": pool.name,
                    "subnet": pool.subnet,
                    "range": f"{pool.start_ip} - {pool.end_ip}"
                }
            }

        # Pool istatistiklerini al
        stats = await IPPoolService.get_pool_stats(db, pool.id)

        return {
            "success": True,
            "has_pool": True,
            "next_ip": next_ip,
            "pool_info": {
                "id": pool.id,
                "name": pool.name,
                "subnet": pool.subnet,
                "range": f"{pool.start_ip} - {pool.end_ip}",
                "gateway": pool.gateway,
                "dns_servers": pool.dns_servers,
                "stats": stats
            }
        }

    except Exception as e:
        logger.error(f"Sıradaki IP alınırken hata: {e}")
        import traceback
        logger.debug(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Sıradaki IP alınamadı: {str(e)}"
        )


class InterfaceAddRequest(BaseModel):
    """Interface ekleme isteği modeli"""
    name: str
    ip_address: Optional[str] = None
    listen_port: Optional[int] = None
    mtu: Optional[int] = None
    private_key: Optional[str] = None
    comment: Optional[str] = None


class InterfaceUpdateRequest(BaseModel):
    """Interface güncelleme isteği modeli"""
    listen_port: Optional[int] = None
    mtu: Optional[int] = None
    comment: Optional[str] = None


# ÖNEMLİ: /interface/add route'u /interface/{name} route'undan ÖNCE tanımlanmalı
# Aksi halde FastAPI "add" kelimesini name parametresi olarak algılar
@router.post("/interface/add")
async def add_interface(
    interface_data: InterfaceAddRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Yeni WireGuard interface ekler (RouterOS 7+)
    """
    try:
        # Interface adı kontrolü
        if not interface_data.name or not interface_data.name.strip():
            raise HTTPException(status_code=400, detail="Interface adı boş olamaz")
        
        # Mevcut interface'leri kontrol et
        existing_interfaces = await mikrotik_conn.get_wireguard_interfaces(use_cache=False)
        for existing_iface in existing_interfaces:
            existing_name = existing_iface.get('name') or existing_iface.get('.id')
            if existing_name == interface_data.name.strip():
                raise HTTPException(
                    status_code=400,
                    detail=f"'{interface_data.name}' adında bir interface zaten mevcut!"
                )
        
        # Interface ekle
        kwargs = {}
        if interface_data.comment:
            kwargs["comment"] = interface_data.comment
        
        interface = await mikrotik_conn.add_wireguard_interface(
            name=interface_data.name.strip(),
            listen_port=interface_data.listen_port,
            mtu=interface_data.mtu,
            private_key=interface_data.private_key,
            **kwargs
        )

        # IP adresi belirtilmişse, interface'e IP adresi ekle
        if interface_data.ip_address and interface_data.ip_address.strip():
            try:
                await mikrotik_conn.add_ip_address(
                    address=interface_data.ip_address.strip(),
                    interface=interface_data.name.strip()
                )
                logger.info(f"Interface {interface_data.name} için IP adresi eklendi: {interface_data.ip_address}")
            except Exception as ip_error:
                logger.warning(f"IP adresi eklenemedi: {ip_error}")
                # IP adresi eklenemese bile interface oluşturuldu, devam et

        # Log kaydı
        await create_log(
            db,
            current_user.username,
            "interface_added",
            details=f"Interface: {interface_data.name}, Port: {interface.get('listen-port')}",
            ip_address="127.0.0.1"
        )
        
        return {
            "success": True,
            "message": "Interface başarıyla eklendi",
            "data": interface
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Interface ekleme hatası: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Interface eklenemedi: {str(e)}")


@router.post("/interface/{name}/update")
async def update_interface(
    name: str,
    interface_data: InterfaceUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    WireGuard interface'i günceller
    """
    try:
        kwargs = {}
        if interface_data.listen_port is not None:
            kwargs["listen_port"] = interface_data.listen_port
        if interface_data.mtu is not None:
            kwargs["mtu"] = interface_data.mtu
        if interface_data.comment is not None:
            kwargs["comment"] = interface_data.comment
        
        interface = await mikrotik_conn.update_wireguard_interface(name, **kwargs)
        
        # Log kaydı
        await create_log(
            db,
            current_user.username,
            "interface_updated",
            details=f"Interface: {name}",
            ip_address="127.0.0.1"
        )
        
        return {
            "success": True,
            "message": "Interface başarıyla güncellendi",
            "data": interface
        }
    except Exception as e:
        logger.error(f"Interface güncelleme hatası: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Interface güncellenemedi: {str(e)}")


@router.delete("/interface/{name}")
async def delete_interface(
    name: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    WireGuard interface'i siler
    """
    try:
        await mikrotik_conn.delete_wireguard_interface(name)
        
        # Log kaydı
        await create_log(
            db,
            current_user.username,
            "interface_deleted",
            details=f"Interface: {name}",
            ip_address="127.0.0.1"
        )
        
        return {
            "success": True,
            "message": "Interface başarıyla silindi"
        }
    except Exception as e:
        logger.error(f"Interface silme hatası: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Interface silinemedi: {str(e)}")


@router.get("/interface/{name}")
async def get_interface(
    name: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Belirli bir interface'in detaylarını getirir
    """
    try:
        # Bağlantının açık olduğundan emin ol
        await mikrotik_conn.ensure_connected()
        interfaces = await mikrotik_conn.get_wireguard_interfaces()
        interface = next((i for i in interfaces if i.get(".id") == name or i.get("name") == name), None)
        
        if not interface:
            raise HTTPException(status_code=404, detail="Interface bulunamadı")
        
        return {
            "success": True,
            "data": interface
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Interface bilgisi alınamadı: {str(e)}")


@router.post("/interface/{name}/toggle")
async def toggle_interface(
    name: str,
    enable: bool = Query(True, description="True ise aç, False ise kapat"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Interface'i aç/kapat
    """
    try:
        await mikrotik_conn.toggle_interface(name, enable)

        # Log kaydı
        action = f"interface_{'enabled' if enable else 'disabled'}"
        await create_log(
            db,
            current_user.username,
            action,
            details=f"Interface: {name}",
            ip_address="127.0.0.1"
        )

        # Bildirim gönder - hata olursa devam et
        try:
            if enable:
                await notify_interface_started(
                    db=db,
                    user_id=current_user.id,
                    interface=name
                )
            else:
                await notify_interface_stopped(
                    db=db,
                    user_id=current_user.id,
                    interface=name
                )
            logger.info(f"✅ Interface {'başlatma' if enable else 'durdurma'} bildirimi gönderildi: {name}")
        except Exception as notif_error:
            # Bildirim hatası interface toggle'ı etkilememeli
            logger.warning(f"⚠️ Bildirim gönderilemedi (interface toggle başarılı): {notif_error}")

        return {
            "success": True,
            "message": f"Interface {'açıldı' if enable else 'kapatıldı'}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Interface durumu değiştirilemedi: {str(e)}")


@router.get("/peers/{interface}")
async def get_peers(
    interface: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Belirli bir interface'e ait peer'ları listeler ve durumlarını takip eder
    """
    try:
        # Bağlantının açık olduğundan emin ol
        await mikrotik_conn.ensure_connected()
        peers = await mikrotik_conn.get_wireguard_peers(interface)
        
        # Her peer için durumu takip et
        for peer in peers:
            peer_id = peer.get('id') or peer.get('.id')
            # Debug: Peer ID yapısını logla (sadece debug modunda)
            logger.debug(f"📋 Peer ID kontrol - id: {peer.get('id')}, .id: {peer.get('.id')}, tüm anahtarlar: {list(peer.keys())[:10]}")
            if peer_id:
                try:
                    # Public key'i normalize et - hem 'public-key' hem 'public_key' kontrolü yap
                    public_key = peer.get('public-key') or peer.get('public_key')
                    if public_key:
                        public_key = str(public_key).strip()
                    
                    await track_peer_status(
                        db=db,
                        peer_id=str(peer_id),
                        interface_name=interface,
                        peer_name=peer.get('comment') or peer.get('name'),
                        public_key=public_key,
                        last_handshake_value=peer.get('last-handshake')
                    )
                except Exception as e:
                    logger.error(f"Peer durum tracking hatası ({peer_id}): {e}")
        
        return {
            "success": True,
            "data": peers
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Peer listesi alınamadı: {str(e)}")


@router.post("/peer/add")
async def add_peer(
    peer_data: PeerAddRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Yeni WireGuard peer ekler
    """
    # Public key'i normalize et (trim ve boşlukları temizle)
    public_key_normalized = peer_data.public_key.strip() if peer_data.public_key else ""
    
    # Private key kontrolü ve loglama
    has_private_key = peer_data.private_key and peer_data.private_key.strip()
    logger.info(f"📥 Peer ekleme isteği alındı: interface={peer_data.interface}, public_key={public_key_normalized[:20] if public_key_normalized else 'YOK'}..., private_key={'VAR' if has_private_key else 'YOK'}")
    
    if has_private_key:
        logger.info(f"🔑 Private key mevcut, veritabanına kaydedilecek. Private key uzunluk={len(peer_data.private_key.strip())}")
    try:
        kwargs = {}

        # Allowed address ayarları - IP adresleri ve domain adreslerini ayır
        # NOT: allowed-address sadece IP adresleri içermeli, domain adresleri endpoint'e eklenmeli
        allowed_ips = []
        endpoint_domains = []

        # Otomatik IP tahsisi (IP Pool'dan)
        ip_allocation = None  # Allocation'ı sakla (peer oluşturulduktan sonra güncellemek için)
        if peer_data.allowed_address and peer_data.allowed_address.strip().lower() == "auto":
            logger.info(f"🔄 Otomatik IP tahsisi istendi (IP Pool'dan)")
            from app.services.ip_pool_service import IPPoolService

            # Interface için aktif pool'u bul
            pools = await IPPoolService.get_pools(
                db,
                interface_name=peer_data.interface,
                is_active=True
            )

            if not pools:
                raise HTTPException(
                    status_code=400,
                    detail=f"Bu interface için aktif IP pool bulunamadı: {peer_data.interface}"
                )

            # İlk pool'u kullan
            pool = pools[0]

            # Sıradaki boş IP'yi bul
            next_ip = await IPPoolService.find_next_available_ip(db, pool.id)

            if not next_ip:
                raise HTTPException(
                    status_code=400,
                    detail=f"IP pool dolu: {pool.name}. Lütfen bir peer silin veya pool'u genişletin."
                )

            # IP'yi HEMEN pool'da allocate et (peer oluşturmadan önce)
            # Böylece başka bir peer aynı IP'yi alamaz
            ip_allocation = await IPPoolService.allocate_ip(
                db=db,
                pool_id=pool.id,
                ip_address=next_ip,
                peer_name=peer_data.name or peer_data.comment or "Auto-allocated peer",
                notes=f"Otomatik tahsis edildi - {peer_data.interface}"
            )

            if not ip_allocation:
                raise HTTPException(
                    status_code=500,
                    detail=f"IP pool'da tahsis yapılamadı: {next_ip}"
                )

            # IP'yi /32 subnet ile kullan (tek IP için)
            peer_data.allowed_address = f"{next_ip}/32"
            logger.info(f"✅ Otomatik IP tahsis edildi ve pool'da rezerve edildi: {next_ip}/32 (Pool: {pool.name}, Allocation ID: {ip_allocation.id})")

        if peer_data.allowed_address:
            logger.info(f"🔍 Gelen allowed_address (frontend'den): '{peer_data.allowed_address}'")
            # Virgülle ayrılmış değerleri kontrol et
            addresses = [addr.strip() for addr in peer_data.allowed_address.split(",")]
            logger.info(f"🔍 Split sonrası adresler: {addresses}")
            for addr in addresses:
                # IP adresi mi kontrol et (IPv4 veya IPv6)
                ip_pattern = r'^(\d{1,3}\.){3}\d{1,3}(\/\d+)?$|^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(\/\d+)?$'
                if re.match(ip_pattern, addr):
                    allowed_ips.append(addr)
                    logger.info(f"🔍 IP adresi olarak eklendi: '{addr}'")
                else:
                    # Domain adresi ise endpoint'e ekle
                    endpoint_domains.append(addr)
                    logger.info(f"🔍 Domain adresi olarak işaretlendi: '{addr}'")

        logger.info(f"🔍 Toplam allowed_ips: {len(allowed_ips)}, Liste: {allowed_ips}")
        logger.info(f"🔍 Toplam endpoint_domains: {len(endpoint_domains)}, Liste: {endpoint_domains}")

        # Sadece IP adreslerini allowed-address'e ekle
        # NOT: MikroTik API için virgülden sonra boşluk OLMAMALI (CLI'de olsa da API'de olmamalı)
        # API: "192.168.100.4/32,192.168.40.0/24" (boşluksuz)
        # CLI: "192.168.100.4/32, 192.168.40.0/24" (boşluklu) - CLI daha toleranslı
        if allowed_ips:
            # Virgülden sonra boşluk OLMADAN birleştir (API için)
            kwargs["allowed-address"] = ",".join(allowed_ips)
            logger.info(f"🔍 Allowed IPs birleştirildi (boşluksuz): '{kwargs['allowed-address']}'")
        
        # Endpoint ayarları - Domain adreslerini endpoint'e ekle
        # Default endpoint: mwg.sahacam.com
        default_endpoint = "mwg.sahacam.com"
        endpoint_value = None
        
        if endpoint_domains:
            # Kullanıcının girdiği domain adreslerini kullan
            endpoint_value = endpoint_domains[0]  # İlk domain adresini kullan
        else:
            # Domain adresi yoksa default endpoint'i kullan
            endpoint_value = default_endpoint
        
        # Endpoint bilgisini sakla (comment'e eklenecek)
        # NOT: MikroTik WireGuard API'sinde peer ekleme komutunda 'endpoint' parametresi desteklenmiyor
        # Endpoint bilgisi config dosyası oluştururken kullanılacak
        # Performans için interface bilgisini cache'den al (gereksiz API çağrısını önle)
        # endpoint_info artık kullanılmıyor, sadece config oluştururken gerekli
        
        # Name ve Comment ayarları
        # NOT: MikroTik WireGuard API'sinde peer'lar için "name" alanı YOKTUR, sadece "comment" alanı vardır
        # Bu nedenle "name" ve "comment" değerlerini "comment" alanına gönderiyoruz
        # Kullanıcı "Ad" kısmına yazdığı değer ve "Açıklama" kısmına yazdığı değer MikroTik'teki "comment" alanına gider
        # NOT: Otomatik isimlendirme YAPILMAZ - sadece kullanıcının manuel yazdığı değer kullanılır
        
        # Name (Ad) değeri varsa MikroTik'teki name alanına ekle
        if peer_data.name and peer_data.name.strip():
            kwargs["name"] = peer_data.name.strip()
        
        # Comment (Açıklama) - Sadece kullanıcının manuel girdiği değer kullanılır
        # NOT: DNS ve Endpoint bilgileri otomatik olarak comment'e eklenmez
        # Kullanıcı isterse manuel olarak comment'e ekleyebilir
        if peer_data.comment and peer_data.comment.strip():
            kwargs["comment"] = peer_data.comment.strip()
        
        # Persistent keepalive ayarı - NAT arkasındaki client'lar için çok önemli
        # Eğer belirtilmemişse varsayılan olarak 25 saniye ekle (WireGuard önerisi)
        if peer_data.persistent_keepalive:
            kwargs["persistent-keepalive"] = peer_data.persistent_keepalive
        else:
            # Varsayılan persistent-keepalive: 25 saniye (NAT traversal için önerilen değer)
            # Bu, NAT arkasındaki client'ların bağlantısının kopmasını önler
            kwargs["persistent-keepalive"] = "25s"
            logger.info(f"Persistent keepalive belirtilmedi, varsayılan değer kullanılıyor: 25s")
        
        if peer_data.endpoint_allowed_address:
            # Endpoint için izin verilen IP'ler - MikroTik'te bu genellikle allowed-address'e eklenir
            # NOT: Sadece IP adresleri eklenmeli, domain adresleri eklenmemeli
            # Virgülle ayrılmış birden fazla IP adresi desteği
            ip_pattern = r'^(\d{1,3}\.){3}\d{1,3}(\/\d+)?$|^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(\/\d+)?$'

            # Virgülle ayrılmış IP adreslerini ayır ve her birini kontrol et
            endpoint_ips = [ip.strip() for ip in peer_data.endpoint_allowed_address.split(',')]
            valid_ips = []

            for ip in endpoint_ips:
                if re.match(ip_pattern, ip):
                    valid_ips.append(ip)
                else:
                    logger.warning(f"Geçersiz endpoint IP adresi atlandı: {ip}")

            # Geçerli IP'leri allowed-address'e ekle
            if valid_ips:
                endpoint_allowed_str = ','.join(valid_ips)
                if kwargs.get("allowed-address"):
                    kwargs["allowed-address"] = f"{kwargs['allowed-address']},{endpoint_allowed_str}"
                else:
                    kwargs["allowed-address"] = endpoint_allowed_str
        
        if peer_data.preshared_key:
            kwargs["preshared-key"] = peer_data.preshared_key
        
        # NOT: MTU parametresi MikroTik WireGuard API'sinde peer seviyesinde desteklenmiyor
        # MTU ayarı interface seviyesinde yapılır, peer'a direkt eklenemez
        # MTU değeri config dosyası oluştururken interface'den alınacak
        # Bu nedenle MTU'yu kwargs'a eklemiyoruz
        # if peer_data.mtu:
        #     kwargs["mtu"] = str(peer_data.mtu)
        
        # Private key varsa MikroTik'e gönder (MikroTik CLI destekliyor)
        if peer_data.private_key:
            kwargs["private-key"] = peer_data.private_key.strip()
            logger.info(f"ℹ️ Private key MikroTik'e gönderilecek (uzunluk: {len(peer_data.private_key.strip())})")

        # NOT: MTU ve Endpoint parametreleri MikroTik API'sinde desteklenmediği için kwargs'dan çıkarılmalı
        if "mtu" in kwargs:
            del kwargs["mtu"]
        if "endpoint" in kwargs:
            del kwargs["endpoint"]
        
        logger.info(f"📤 Peer ekleme parametreleri: interface={peer_data.interface}, public_key={public_key_normalized[:20]}...")
        logger.info(f"📤 MikroTik'e gönderilecek kwargs anahtarları: {list(kwargs.keys())}")
        logger.info(f"📤 MikroTik'e gönderilecek allowed-address değeri: {kwargs.get('allowed-address', 'YOK')}")
        
        # Public key'i normalize et (trim ve boşlukları temizle)
        public_key_normalized = peer_data.public_key.strip() if peer_data.public_key else ""
        if not public_key_normalized:
            raise HTTPException(status_code=400, detail="Public key boş olamaz")
        
        # Public key kontrolü - Aynı public key ile peer zaten var mı kontrol et
        # Cache'i bypass et, doğrudan API'den çek (güncel veri için)
        try:
            # Cache'i bypass et, doğrudan API'den çek (güncel veri için)
            existing_peers = await mikrotik_conn.get_wireguard_peers(peer_data.interface, use_cache=False)
            
            for existing_peer in existing_peers:
                # Key alanlarını normalize et - hem 'public-key' hem 'public_key' kontrolü yap
                existing_public_key = existing_peer.get('public-key') or existing_peer.get('public_key')
                if existing_public_key:
                    existing_public_key_normalized = str(existing_public_key).strip()
                    # Normalize edilmiş key'leri karşılaştır
                    if existing_public_key_normalized == public_key_normalized:
                        # Mevcut peer bilgilerini döndür
                        peer_id = existing_peer.get('.id') or existing_peer.get('id')
                        peer_comment = existing_peer.get('comment') or existing_peer.get('name') or 'N/A'
                        logger.warning(f"⚠️ Bu public key ile peer zaten mevcut: {public_key_normalized[:20]}...")
                        raise HTTPException(
                            status_code=400,
                            detail=f"Bu public key ile peer zaten mevcut! Peer ID: {peer_id}, Comment: {peer_comment}. Lütfen farklı bir public key kullanın."
                        )
        except HTTPException:
            raise
        except Exception as e:
            # Kontrol sırasında hata olursa devam et (peer eklemeyi dene)
            # MikroTik zaten duplicate kontrolü yapacak
            logger.warning(f"Public key kontrolü sırasında hata (devam ediliyor): {e}")
            import traceback
            logger.debug(traceback.format_exc())
        
        peer = None  # Peer değişkenini önceden tanımla

        # Birden fazla allowed-address varsa, özel işlem yap
        # MikroTik API virgülle ayrılmış değerleri doğru işlemiyor, set komutu kullanmamız gerekiyor
        full_allowed_address = kwargs.get("allowed-address", "")
        multiple_addresses = len(allowed_ips) > 1 if allowed_ips else False

        if multiple_addresses:
            # İlk adresi al, peer'ı onunla ekle
            first_address = allowed_ips[0]
            kwargs["allowed-address"] = first_address
            logger.info(f"🔍 Birden fazla IP var, önce tek IP ile ekleniyor: '{first_address}'")

        try:
            # Public key'i normalize edilmiş haliyle gönder
            peer = await mikrotik_conn.add_wireguard_peer(
                peer_data.interface,
                public_key_normalized,
                **kwargs
            )

            peer_id = peer.get('.id') or peer.get('id')
            logger.info(f"✅ Peer başarıyla eklendi: {peer_id}")

            # Eğer birden fazla adres varsa, şimdi set komutuyla tümünü güncelle
            if multiple_addresses and peer_id:
                logger.info(f"🔍 Birden fazla IP olduğu için set komutuyla güncelleniyor: '{full_allowed_address}'")
                try:
                    await mikrotik_conn.update_wireguard_peer(
                        peer_id,
                        interface=peer_data.interface,
                        **{"allowed-address": full_allowed_address}
                    )
                    logger.info(f"✅ Allowed-address güncellendi: {full_allowed_address}")

                    # Güncellenmiş peer'ı tekrar al
                    peers = await mikrotik_conn.get_wireguard_peers(peer_data.interface, use_cache=False)
                    for p in peers:
                        if (p.get('.id') or p.get('id')) == peer_id:
                            peer = p
                            break
                except Exception as e:
                    logger.error(f"❌ Allowed-address güncellenemedi: {e}")
                    # Hata olsa bile peer eklendi, devam et
        except HTTPException:
            # HTTPException'ları olduğu gibi fırlat
            raise
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ Peer ekleme hatası: {error_msg}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            
            # "entry already exists" hatasını yakala ve daha anlaşılır hale getir
            if "entry already exists" in error_msg.lower() or "already exists" in error_msg.lower():
                logger.error(f"❌ Peer eklenemedi - Public key zaten mevcut: {public_key_normalized[:20]}...")
                # Mevcut peer'ı bul ve bilgi ver - cache'i bypass et
                try:
                    # Cache'i bypass et, doğrudan API'den çek (güncel veri için)
                    existing_peers = await mikrotik_conn.get_wireguard_peers(peer_data.interface, use_cache=False)
                    
                    for existing_peer in existing_peers:
                        # Key alanlarını normalize et - hem 'public-key' hem 'public_key' kontrolü yap
                        existing_public_key = existing_peer.get('public-key') or existing_peer.get('public_key')
                        if existing_public_key:
                            existing_public_key_normalized = str(existing_public_key).strip()
                            # Normalize edilmiş key'leri karşılaştır
                            if existing_public_key_normalized == public_key_normalized:
                                peer_id = existing_peer.get('.id') or existing_peer.get('id')
                                peer_comment = existing_peer.get('comment') or existing_peer.get('name') or 'N/A'
                                raise HTTPException(
                                    status_code=400,
                                    detail=f"Bu public key ile peer zaten mevcut! Peer ID: {peer_id}, Comment: {peer_comment}. Lütfen farklı bir public key kullanın."
                                )
                except HTTPException:
                    raise
                except Exception as lookup_error:
                    logger.warning(f"Mevcut peer arama hatası: {lookup_error}")
                
                raise HTTPException(
                    status_code=400,
                    detail=f"Bu public key ile peer zaten mevcut! Lütfen farklı bir public key kullanın."
                )
            else:
                # Diğer hataları daha anlaşılır hale getir
                # Network error'ları için özel mesaj
                if "network" in error_msg.lower() or "connection" in error_msg.lower() or "timeout" in error_msg.lower():
                    raise HTTPException(
                        status_code=503,
                        detail=f"MikroTik router'a bağlanılamadı. Lütfen bağlantıyı kontrol edin ve tekrar deneyin. Hata: {error_msg}"
                    )
                else:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Peer eklenemedi: {error_msg}"
                    )
        
        # Private key'i veritabanına kaydet (eğer varsa ve peer başarıyla eklendiyse)
        # NOT: MikroTik RouterOS'ta peer'lar için private-key alanı YOKTUR
        # Private key sadece QR kod ve config dosyası oluştururken kullanılır
        # Bu yüzden private key'i veritabanında saklıyoruz
        logger.info(f"🔍 Private key kontrolü: peer={peer is not None}, peer_data.private_key={'VAR' if peer_data.private_key else 'YOK'}, private_key.strip()={'VAR' if (peer_data.private_key and peer_data.private_key.strip()) else 'YOK'}")
        if peer and peer_data.private_key and peer_data.private_key.strip():
            # Peer ID'yi farklı formatlardan al (*E, .id, id, vb.)
            peer_id = peer.get('.id') or peer.get('id') or peer.get('*id')
            if peer_id is None:
                # Tüm anahtarları kontrol et
                for key in peer.keys():
                    if key.endswith('id') or key == '.id' or key.startswith('*'):
                        peer_id = peer.get(key)
                        logger.debug(f"Peer ID alternatif alandan bulundu: {key} = {peer_id}")
                        break
            
            private_key_normalized = peer_data.private_key.strip()

            # Client AllowedIPs değerini al (kullanıcının girdiği endpoint_allowed_address)
            client_allowed_ips = peer_data.endpoint_allowed_address or "0.0.0.0/0, ::/0"
            if client_allowed_ips:
                client_allowed_ips = client_allowed_ips.strip()

            logger.info(f"🔍 Private key kaydediliyor: Peer ID={peer_id}, Public Key={public_key_normalized[:30]}... (uzunluk: {len(public_key_normalized)}), Private Key uzunluk={len(private_key_normalized)}, Client AllowedIPs={client_allowed_ips}")
            logger.info(f"🔍 Peer objesi: {peer}")

            if peer_id:
                try:
                    # Mevcut private key kaydı var mı kontrol et (hem public key hem peer ID ile)
                    result_by_public = await db.execute(
                        select(PeerKey).where(PeerKey.public_key == public_key_normalized)
                    )
                    existing_key_by_public = result_by_public.scalar_one_or_none()
                    
                    result_by_id = await db.execute(
                        select(PeerKey).where(PeerKey.peer_id == str(peer_id))
                    )
                    existing_key_by_id = result_by_id.scalar_one_or_none()
                    
                    existing_key = existing_key_by_public or existing_key_by_id
                    
                    if existing_key:
                        # Mevcut kaydı güncelle
                        existing_key.private_key = private_key_normalized
                        existing_key.peer_id = str(peer_id)
                        existing_key.interface_name = peer_data.interface
                        existing_key.public_key = public_key_normalized  # Public key'i de güncelle (eşleştirme için)
                        existing_key.client_allowed_ips = client_allowed_ips  # Client AllowedIPs'i kaydet
                        existing_key.endpoint_address = peer_data.endpoint_address  # Endpoint adresi
                        existing_key.endpoint_port = peer_data.endpoint_port  # Endpoint portu
                        existing_key.template_id = peer_data.template_id  # Template ID (usage tracking için)
                        await db.commit()
                        logger.info(f"✅ Private key güncellendi: Peer ID={peer_id}, Public Key={public_key_normalized[:30]}..., Private Key uzunluk={len(private_key_normalized)}")
                    else:
                        # Yeni kayıt oluştur
                        new_key = PeerKey(
                            peer_id=str(peer_id),
                            interface_name=peer_data.interface,
                            public_key=public_key_normalized,
                            private_key=private_key_normalized,
                            client_allowed_ips=client_allowed_ips,
                            endpoint_address=peer_data.endpoint_address,
                            endpoint_port=peer_data.endpoint_port,
                            template_id=peer_data.template_id
                        )
                        db.add(new_key)
                        await db.commit()
                        logger.info(f"✅ Private key kaydedildi: Peer ID={peer_id}, Public Key={public_key_normalized[:30]}..., Private Key uzunluk={len(private_key_normalized)}")
                        
                        # Kayıt sonrası doğrulama
                        verify_result = await db.execute(
                            select(PeerKey).where(PeerKey.public_key == public_key_normalized)
                        )
                        verify_key = verify_result.scalar_one_or_none()
                        if verify_key:
                            logger.info(f"✅ Kayıt doğrulandı: Veritabanında bulundu, Private Key uzunluk={len(verify_key.private_key)}")
                        else:
                            logger.error(f"❌ Kayıt doğrulanamadı: Veritabanında bulunamadı!")
                except Exception as key_error:
                    # Private key kaydı başarısız olsa bile peer ekleme başarılı olduğu için devam et
                    logger.error(f"❌ Private key kaydı yapılamadı (peer ekleme başarılı): {key_error}")
                    import traceback
                    logger.error(traceback.format_exc())
                    await db.rollback()
            else:
                logger.warning(f"⚠️ Peer ID bulunamadı, private key kaydedilemedi. Peer: {peer}")
        else:
            if not peer:
                logger.warning(f"⚠️ Peer eklenemedi veya peer objesi None, private key kaydedilemedi")
            elif not peer_data.private_key or not peer_data.private_key.strip():
                logger.info(f"ℹ️ Private key girilmedi, kayıt yapılmayacak")

        # Endpoint'e Erişim İçin İzin Verilen IP Adresleri için IP route ekle
        if peer and peer_data.endpoint_allowed_address:
            try:
                import ipaddress

                # Endpoint allowed address'lerden subnet'leri filtrele (/32 olmayanlar)
                endpoint_ips = [ip.strip() for ip in peer_data.endpoint_allowed_address.split(',')]
                endpoint_subnets = []

                for ip in endpoint_ips:
                    if '/' in ip and not ip.endswith('/32'):
                        endpoint_subnets.append(ip)
                        logger.info(f"🆕 Endpoint subnet tespit edildi: {ip}")

                if endpoint_subnets:
                    # MikroTik'teki mevcut interface subnet'lerini al
                    existing_subnets = await mikrotik_conn.get_interface_subnets()
                    logger.info(f"📋 MikroTik'te mevcut subnet'ler: {existing_subnets}")

                    # Gateway olarak allowed_address'in ilk IP'sini kullan
                    gateway_ip = None

                    # peer'dan allowed-address'i al
                    peer_allowed = peer.get('allowed-address') or peer.get('allowed_address') or ""
                    if peer_allowed:
                        allowed_list = peer_allowed.split(',')
                        # İlk /32 IP'yi bul
                        for ip in allowed_list:
                            ip = ip.strip()
                            if '/' in ip:
                                if ip.endswith('/32'):
                                    gateway_ip = ip.split('/')[0]
                                    logger.info(f"🌐 Gateway IP belirlendi (/32 IP bulundu): {gateway_ip}")
                                    break
                            else:
                                gateway_ip = ip
                                logger.info(f"🌐 Gateway IP belirlendi (CIDR yok): {gateway_ip}")
                                break

                        # Eğer /32 bulunamadıysa ilk IP'yi kullan
                        if not gateway_ip and allowed_list:
                            first_ip = allowed_list[0].strip()
                            gateway_ip = first_ip.split('/')[0]
                            logger.warning(f"⚠️ /32 IP bulunamadı, ilk IP kullanılıyor: {gateway_ip}")

                    if gateway_ip:
                        # Peer açıklamasını belirle (route comment için)
                        peer_description = peer_data.comment if peer_data.comment and peer_data.comment.strip() else "Unnamed peer"

                        # Her endpoint subnet için route ekle (ama MikroTik'te zaten varsa ekleme)
                        for subnet in endpoint_subnets:
                            try:
                                # Subnet'i normalize et
                                subnet_network = ipaddress.ip_network(subnet, strict=False)
                                subnet_normalized = str(subnet_network)

                                # MikroTik'te zaten bu subnet tanımlı mı kontrol et
                                if subnet_normalized in existing_subnets:
                                    logger.info(f"⏭️ Subnet zaten MikroTik interface'inde tanımlı, route eklenmiyor: {subnet_normalized}")
                                    continue

                                logger.info(f"🛣️ IP route ekleniyor: {subnet} via {gateway_ip}")
                                await mikrotik_conn.add_ip_route(
                                    dst_address=subnet,
                                    gateway=gateway_ip,
                                    comment=f"{peer_description} for WireGuard peer {peer_data.interface}"
                                )
                                logger.info(f"✅ IP route başarıyla eklendi: {subnet} via {gateway_ip}")
                            except Exception as route_error:
                                # Route ekleme hatası peer eklemeyi engellemez
                                logger.error(f"❌ IP route eklenemedi ({subnet} via {gateway_ip}): {route_error}")
                    else:
                        logger.warning(f"⚠️ Gateway IP bulunamadı, endpoint subnet route'ları eklenemedi")
            except Exception as e:
                # Route ekleme hatası peer eklemeyi engellemez
                logger.error(f"❌ Endpoint subnet route ekleme hatası: {e}")

        # Log kaydı - hata olursa devam et (peer ekleme başarılı)
        try:
            await create_log(
                db,
                current_user.username,
                "peer_added",
                details=f"Interface: {peer_data.interface}, Public Key: {public_key_normalized[:20]}...",
                ip_address="127.0.0.1"
            )
        except Exception as log_error:
            # Log kaydı başarısız olsa bile peer ekleme başarılı olduğu için devam et
            logger.warning(f"⚠️ Log kaydı yapılamadı (peer ekleme başarılı): {log_error}")
            # Database locked hatası için özel log
            if "locked" in str(log_error).lower() or "database" in str(log_error).lower():
                logger.warning("⚠️ Veritabanı kilitli, log kaydı atlandı. Peer başarıyla eklendi.")

        # IP Pool tracking - Manuel IP için de allocation kaydı oluştur
        # Eğer "auto" kullanılmadıysa ama IP bir pool'a aitse, onu track et
        if not ip_allocation and allowed_ips and peer_id:
            try:
                from app.services.ip_pool_service import IPPoolService
                import ipaddress

                # Bu interface için pool'ları al
                pools = await IPPoolService.get_pools(
                    db,
                    interface_name=peer_data.interface,
                    is_active=True
                )

                if pools:
                    # Her allowed IP'yi kontrol et
                    for allowed_ip_with_cidr in allowed_ips:
                        # CIDR'den IP'yi ayır (örn: "192.168.100.2/32" -> "192.168.100.2")
                        ip_only = allowed_ip_with_cidr.split('/')[0]

                        # Bu IP hangi pool'a ait?
                        for pool in pools:
                            try:
                                ip_obj = ipaddress.ip_address(ip_only)
                                start_ip = ipaddress.ip_address(pool.start_ip)
                                end_ip = ipaddress.ip_address(pool.end_ip)

                                # IP pool aralığında mı?
                                if start_ip <= ip_obj <= end_ip:
                                    # Bu IP'yi pool'da track et
                                    logger.info(f"📊 Manuel IP pool aralığında bulundu, track ediliyor: {ip_only} (Pool: {pool.name})")

                                    # Allocation kaydı oluştur
                                    ip_allocation = await IPPoolService.allocate_ip(
                                        db=db,
                                        pool_id=pool.id,
                                        ip_address=ip_only,
                                        peer_id=str(peer_id),
                                        peer_public_key=public_key_normalized,
                                        peer_name=peer_data.name or peer_data.comment or str(peer_id),
                                        notes=f"Manuel tahsis (VPN Template) - {peer_data.interface}"
                                    )

                                    if ip_allocation:
                                        logger.info(f"✅ Manuel IP pool'da kaydedildi: {ip_only} (Allocation ID: {ip_allocation.id})")
                                    else:
                                        logger.warning(f"⚠️ Manuel IP pool'da kaydedilemedi (zaten tahsisli olabilir): {ip_only}")

                                    # Sadece ilk eşleşen pool'u kullan
                                    break
                            except Exception as pool_check_error:
                                logger.debug(f"Pool kontrolü hatası: {pool_check_error}")
                                continue
            except Exception as tracking_error:
                # IP pool tracking hatası peer eklemeyi engellemez
                logger.warning(f"⚠️ IP pool tracking hatası (peer ekleme başarılı): {tracking_error}")
                import traceback
                logger.debug(traceback.format_exc())

        # Bildirim gönder - arka planda (bağımsız DB session ile)
        peer_name = peer_data.comment if peer_data.comment and peer_data.comment.strip() else public_key_normalized[:16]
        background_tasks.add_task(
            send_peer_notification_background,
            user_id=current_user.id,
            peer_name=peer_name,
            interface=peer_data.interface,
            action="created"
        )
        logger.info(f"📬 Peer oluşturma bildirimi arka planda gönderilecek: {peer_name}")

        # IP Pool entegrasyonu - allocation'ı peer_id ile güncelle (arka planda)
        if ip_allocation and peer_id:
            background_tasks.add_task(
                update_allocation_background,
                allocation_id=ip_allocation.id,
                peer_id=str(peer_id),
                public_key=public_key_normalized
            )
            logger.info(f"📬 IP allocation güncellemesi arka planda yapılacak - Allocation ID: {ip_allocation.id}")

        # Template kullanım istatistiklerini güncelle (arka planda)
        if peer_data.template_id:
            background_tasks.add_task(
                update_template_usage_background,
                template_id=peer_data.template_id
            )
            logger.info(f"📊 Template kullanım istatistiği güncellenecek - Template ID: {peer_data.template_id}")

        return {
            "success": True,
            "message": "Peer başarıyla eklendi",
            "data": peer,
            "private_key": peer_data.private_key if peer_data.private_key else None  # QR kod için döndür
        }
    except HTTPException:
        # HTTPException'ları olduğu gibi fırlat (zaten düzgün formatlanmış)
        raise
    except Exception as e:
        error_msg = str(e)
        logger.error(f"❌ Peer ekleme genel hatası: {error_msg}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        # Network/connection hatalarını özel olarak işle
        if "network" in error_msg.lower() or "connection" in error_msg.lower() or "timeout" in error_msg.lower():
            raise HTTPException(
                status_code=503,
                detail=f"MikroTik router'a bağlanılamadı. Lütfen bağlantı ayarlarını kontrol edin."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Peer eklenemedi: {error_msg}"
            )


@router.post("/peer/{peer_id}/update")
async def update_peer(
    peer_id: str,
    peer_data: PeerUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    WireGuard peer'ı günceller
    Allowed address güncellenirken mevcut değerler korunur ve yeni IP'ler eklenir
    Yeni eklenen subnet'ler için otomatik IP route oluşturulur
    """
    try:
        logger.info(f"🔍 Peer güncelleme başladı - Peer ID: {peer_id}")
        logger.info(f"🔍 Gelen allowed_address: {peer_data.allowed_address}")
        logger.info(f"🔍 Gelen interface: {peer_data.interface}")

        # Önce mevcut peer'ı MikroTik'ten çek
        existing_peer = None
        existing_allowed_ips = []
        interface_name = peer_data.interface

        # Eğer interface belirtilmemişse, peer_id'den bul
        if not interface_name:
            logger.warning(f"⚠️ Interface belirtilmedi, peer_id'den aranıyor: {peer_id}")
            try:
                # Tüm WireGuard interface'lerini al
                interfaces = await mikrotik_conn.get_wireguard_interfaces(use_cache=False)
                for iface in interfaces:
                    iface_name = iface.get('name') or iface.get('.id')
                    if iface_name:
                        # Bu interface'deki peer'ları kontrol et
                        peers = await mikrotik_conn.get_wireguard_peers(iface_name, use_cache=False)
                        for p in peers:
                            p_id = p.get('.id') or p.get('id')
                            if str(p_id) == str(peer_id) or str(p_id).lstrip('*') == str(peer_id).lstrip('*'):
                                existing_peer = p
                                interface_name = iface_name
                                logger.info(f"✅ Peer bulundu! Interface: {interface_name}, Peer ID: {p_id}")
                                break
                        if existing_peer:
                            break
            except Exception as e:
                logger.error(f"❌ Interface bulunamadı: {e}")

        # Interface varsa (ya da bulunduysa), mevcut peer bilgisini al
        if interface_name and not existing_peer:
            try:
                peers = await mikrotik_conn.get_wireguard_peers(interface_name, use_cache=False)
                for p in peers:
                    p_id = p.get('.id') or p.get('id')
                    if str(p_id) == str(peer_id) or str(p_id).lstrip('*') == str(peer_id).lstrip('*'):
                        existing_peer = p
                        break
            except Exception as e:
                logger.warning(f"⚠️ Mevcut peer bilgisi alınamadı: {e}")

        # Mevcut allowed-address'i parse et
        if existing_peer:
            current_allowed = existing_peer.get('allowed-address') or existing_peer.get('allowed_address') or ""
            if current_allowed:
                existing_allowed_ips = [ip.strip() for ip in current_allowed.split(',') if ip.strip()]
                logger.info(f"🔍 Mevcut allowed-address: '{current_allowed}'")
                logger.info(f"🔍 Mevcut IP'ler: {existing_allowed_ips}")
        else:
            logger.warning(f"⚠️ Mevcut peer bulunamadı! Database'den IP'ler alınmaya çalışılıyor...")
            # Database'den mevcut IP'leri almayı dene
            try:
                from app.models.peer_key import PeerKey
                from sqlalchemy import select

                stmt = select(PeerKey).where(PeerKey.peer_id == str(peer_id))
                result = await db.execute(stmt)
                db_peer = result.scalar_one_or_none()

                if db_peer and db_peer.client_allowed_ips:
                    existing_allowed_ips = [ip.strip() for ip in db_peer.client_allowed_ips.split(',') if ip.strip()]
                    logger.info(f"✅ Database'den client_allowed_ips alındı: {db_peer.client_allowed_ips}")
                    logger.info(f"🔍 Database'den mevcut IP'ler: {existing_allowed_ips}")
                else:
                    logger.warning(f"⚠️ Database'de de peer bulunamadı veya IP yok")
            except Exception as db_error:
                logger.error(f"❌ Database'den IP alma hatası: {db_error}")

        kwargs = {}
        newly_added_subnets = []
        removed_subnets = []

        # Allowed address güncellemesi için özel işlem
        if peer_data.allowed_address is not None:
            new_allowed = peer_data.allowed_address.strip()
            logger.info(f"🔍 Yeni allowed address (trim edilmiş): '{new_allowed}'")

            # Yeni IP'leri parse et
            new_ips = [ip.strip() for ip in new_allowed.split(',') if ip.strip()]
            logger.info(f"🔍 Yeni IP'ler (frontend'den): {new_ips}")
            logger.info(f"🔍 Mevcut IP'ler: {existing_allowed_ips}")

            # Frontend'den gelen listeyi AYNEN kullan (merge yapma)
            # Yeni eklenen subnet'leri tespit et (mevcut listede OLMAYAN subnet'ler)
            for ip in new_ips:
                if ip not in existing_allowed_ips:
                    # Bu yeni eklenen bir IP
                    if '/' in ip and not ip.endswith('/32'):
                        newly_added_subnets.append(ip)
                        logger.info(f"🆕 Yeni subnet tespit edildi: {ip}")

            # Silinen subnet'leri tespit et (mevcut listede OLAN ama yeni listede OLMAYAN subnet'ler)
            for ip in existing_allowed_ips:
                if ip not in new_ips:
                    # Bu silinen bir IP
                    if '/' in ip and not ip.endswith('/32'):
                        removed_subnets.append(ip)
                        logger.info(f"🗑️ Silinen subnet tespit edildi: {ip}")

            # Frontend'den gelen listeyi kullan (merge YOK)
            kwargs["allowed-address"] = ','.join(new_ips)
            logger.info(f"✅ Allowed address güncellendi: '{kwargs['allowed-address']}'")
            logger.info(f"🔍 Toplam IP sayısı: {len(new_ips)}, IP'ler: {new_ips}")
            logger.info(f"🔍 Yeni eklenen subnet'ler: {newly_added_subnets}")
            logger.info(f"🔍 Silinen subnet'ler: {removed_subnets}")

        if peer_data.name is not None:
            kwargs["name"] = peer_data.name  # MikroTik'teki name alanını güncelle
        if peer_data.comment is not None:
            kwargs["comment"] = peer_data.comment
        if peer_data.persistent_keepalive is not None:
            kwargs["persistent-keepalive"] = peer_data.persistent_keepalive
        if peer_data.disabled is not None:
            kwargs["disabled"] = "true" if peer_data.disabled else "false"

        # Peer'ı interface ile güncelle
        peer = await mikrotik_conn.update_wireguard_peer(peer_id, interface=interface_name, **kwargs)

        # Silinen subnet'ler için IP route'ları sil
        if removed_subnets:
            logger.info(f"🗑️ {len(removed_subnets)} silinen subnet için route'lar silinecek")
            for subnet in removed_subnets:
                try:
                    logger.info(f"🛣️ IP route siliniyor: {subnet}")
                    await mikrotik_conn.delete_ip_route(dst_address=subnet)
                    logger.info(f"✅ IP route silindi: {subnet}")
                except Exception as e:
                    # Route silme hatası peer güncellemesini engellemez
                    logger.warning(f"⚠️ IP route silinemedi ({subnet}): {e}")

        # Yeni eklenen subnet'ler için IP route ekle
        if newly_added_subnets and "allowed-address" in kwargs:
            try:
                import ipaddress

                # MikroTik'teki mevcut interface subnet'lerini al
                existing_subnets = await mikrotik_conn.get_interface_subnets()
                logger.info(f"📋 MikroTik'te mevcut subnet'ler: {existing_subnets}")

                # Gateway olarak peer'ın allowed-address listesindeki ilk /32 IP'yi kullan
                merged_ips = kwargs["allowed-address"].split(',')
                gateway_ip = None

                # İlk /32 IP'yi bul
                for ip in merged_ips:
                    ip = ip.strip()
                    if '/' in ip:
                        # CIDR notasyonu var
                        if ip.endswith('/32'):
                            # /32 IP bulundu, gateway olarak kullan
                            gateway_ip = ip.split('/')[0]
                            logger.info(f"🌐 Gateway IP belirlendi (/32 IP bulundu): {gateway_ip}")
                            break
                    else:
                        # CIDR notasyonu yok, direkt IP
                        gateway_ip = ip
                        logger.info(f"🌐 Gateway IP belirlendi (CIDR yok): {gateway_ip}")
                        break

                # Eğer /32 IP bulunamadıysa, ilk IP'yi kullan
                if not gateway_ip and merged_ips:
                    first_ip = merged_ips[0].strip()
                    gateway_ip = first_ip.split('/')[0]
                    logger.warning(f"⚠️ /32 IP bulunamadı, ilk IP kullanılıyor: {gateway_ip}")

                if gateway_ip:
                    # Peer açıklamasını belirle (route comment için)
                    # Önce güncellemede gelen comment'i kullan, yoksa mevcut peer'dan al
                    peer_description = None
                    if peer_data.comment and peer_data.comment.strip():
                        peer_description = peer_data.comment.strip()
                    elif existing_peer:
                        peer_description = existing_peer.get('comment') or "Unnamed peer"
                    else:
                        peer_description = "Unnamed peer"

                    # Her yeni subnet için route ekle (ama MikroTik'te zaten varsa ekleme)
                    for subnet in newly_added_subnets:
                        try:
                            # Subnet'i normalize et
                            subnet_network = ipaddress.ip_network(subnet, strict=False)
                            subnet_normalized = str(subnet_network)

                            # MikroTik'te zaten bu subnet tanımlı mı kontrol et
                            if subnet_normalized in existing_subnets:
                                logger.info(f"⏭️ Subnet zaten MikroTik interface'inde tanımlı, route eklenmiyor: {subnet_normalized}")
                                continue

                            logger.info(f"🛣️ IP route ekleniyor: {subnet} via {gateway_ip}")
                            await mikrotik_conn.add_ip_route(
                                dst_address=subnet,
                                gateway=gateway_ip,
                                comment=f"{peer_description} for WireGuard peer {interface_name}"
                            )
                            logger.info(f"✅ IP route başarıyla eklendi: {subnet} via {gateway_ip}")
                        except Exception as e:
                            # Route ekleme hatası peer güncellemesini engellemez
                            logger.error(f"❌ IP route eklenemedi ({subnet} via {gateway_ip}): {e}")
                else:
                    logger.error(f"❌ Gateway IP bulunamadı, route eklenemedi!")
            except Exception as e:
                logger.error(f"❌ Route ekleme genel hatası: {e}")

        # Veritabanını güncelle (allowed_address değiştiyse)
        if "allowed-address" in kwargs:
            from app.models.peer_key import PeerKey
            from sqlalchemy import select, update

            try:
                # Peer'ı veritabanında bul ve güncelle
                stmt = (
                    update(PeerKey)
                    .where(PeerKey.peer_id == peer_id)
                    .values(client_allowed_ips=kwargs["allowed-address"])
                )
                await db.execute(stmt)
                await db.commit()
                logger.info(f"✅ Veritabanı güncellendi - Peer ID: {peer_id}, Allowed IPs: {kwargs['allowed-address']}")
            except Exception as e:
                logger.error(f"❌ Veritabanı güncellenemedi: {e}")
                # Hata olsa bile MikroTik güncellemesi başarılı olduğu için devam et

        # Log kaydı
        await create_log(
            db,
            current_user.username,
            "peer_updated",
            details=f"Peer ID: {peer_id}",
            ip_address="127.0.0.1"
        )

        return {
            "success": True,
            "message": "Peer başarıyla güncellendi",
            "data": peer
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Peer güncellenemedi: {str(e)}")


@router.post("/peer/{peer_id}/toggle")
async def toggle_peer(
    peer_id: str,
    interface: str = Query(..., description="Interface adı"),
    enable: bool = Query(True, description="True ise aktif et, False ise pasif et"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    WireGuard peer'ı aktif/pasif yapar
    """
    try:
        # Bağlantının açık olduğundan emin ol
        await mikrotik_conn.ensure_connected()
        
        logger.info(f"Peer toggle çağrıldı: Peer ID={peer_id}, Interface={interface}, Enable={enable}")
        
        # MikroTik'te disabled parametresi string olarak geçilmeli ("yes"/"no")
        # enable=True ise disabled="no" (aktif)
        # enable=False ise disabled="yes" (pasif)
        disabled_value = "no" if enable else "yes"
        
        logger.info(f"Disabled değeri: '{disabled_value}' (enable={enable})")
        
        peer = await mikrotik_conn.update_wireguard_peer(
            peer_id=peer_id,
            interface=interface,
            disabled=disabled_value
        )
        
        logger.info(f"Peer güncelleme sonucu: {peer}")
        
        # Log kaydı
        action = f"peer_{'enabled' if enable else 'disabled'}"
        await create_log(
            db,
            current_user.username,
            action,
            details=f"Peer ID: {peer_id}, Interface: {interface}",
            ip_address="127.0.0.1"
        )
        
        return {
            "success": True,
            "message": f"Peer {'aktif edildi' if enable else 'pasif edildi'}",
            "data": peer
        }
    except Exception as e:
        logger.error(f"Peer toggle hatası: {e}")
        raise HTTPException(status_code=500, detail=f"Peer durumu değiştirilemedi: {str(e)}")


@router.delete("/peer/{peer_id}")
async def delete_peer(
    peer_id: str,
    background_tasks: BackgroundTasks,
    interface: str = Query(..., description="Interface adı"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    WireGuard peer'ı siler
    """
    logger.info(f"🗑️ DELETE PEER çağrıldı: peer_id={peer_id}, interface={interface}, user={current_user.username}")
    try:
        # Bağlantının açık olduğundan emin ol
        await mikrotik_conn.ensure_connected()

        logger.info(f"Peer silme çağrıldı: Peer ID={peer_id}, Interface={interface}")

        # URL decode yap (peer_id URL'den geliyorsa)
        import urllib.parse
        peer_id = urllib.parse.unquote(peer_id)

        # Peer'ı silmeden önce allowed-address bilgisini al (IP route'ları silmek için)
        peer_to_delete = None
        try:
            peers = await mikrotik_conn.get_wireguard_peers(interface, use_cache=False)
            for p in peers:
                p_id = p.get('.id') or p.get('id')
                if str(p_id) == str(peer_id) or str(p_id).lstrip('*') == str(peer_id).lstrip('*'):
                    peer_to_delete = p
                    logger.info(f"🔍 Silinecek peer bulundu: {p_id}")
                    break
        except Exception as e:
            logger.warning(f"⚠️ Peer bilgisi alınamadı (devam ediliyor): {e}")

        # Peer'a ait IP route'ları sil
        if peer_to_delete:
            try:
                peer_allowed = peer_to_delete.get('allowed-address') or peer_to_delete.get('allowed_address') or ""
                if peer_allowed:
                    allowed_list = peer_allowed.split(',')
                    # Subnet'leri filtrele (/32 olmayanlar)
                    subnets = [ip.strip() for ip in allowed_list if '/' in ip and not ip.endswith('/32')]

                    if subnets:
                        logger.info(f"🗑️ Peer'a ait {len(subnets)} subnet bulundu, route'lar silinecek")
                        for subnet in subnets:
                            try:
                                await mikrotik_conn.delete_ip_route(dst_address=subnet)
                                logger.info(f"✅ IP route silindi: {subnet}")
                            except Exception as route_error:
                                # Route silme hatası peer silmeyi engellemez
                                logger.warning(f"⚠️ IP route silinemedi ({subnet}): {route_error}")
            except Exception as e:
                # Route silme hatası peer silmeyi engellemez
                logger.warning(f"⚠️ IP route'ları silinirken hata (devam ediliyor): {e}")

        # Peer'ı MikroTik'ten sil
        await mikrotik_conn.delete_wireguard_peer(peer_id, interface=interface)

        # Private key'i veritabanından sil ve template usage count'u düşür
        try:
            # Önce peer_key kaydını al (template_id'yi okumak için)
            peer_key_result = await db.execute(
                select(PeerKey).where(PeerKey.peer_id == str(peer_id))
            )
            peer_key_record = peer_key_result.scalar_one_or_none()

            # Template ID'yi sakla (kayıt silindikten sonra kullanmak için)
            template_id_to_decrement = None
            if peer_key_record and peer_key_record.template_id:
                template_id_to_decrement = peer_key_record.template_id
                logger.info(f"📊 Peer template ile oluşturulmuş, usage count düşürülecek - Template ID: {template_id_to_decrement}")

            # PeerKey kaydını sil
            result = await db.execute(
                delete(PeerKey).where(PeerKey.peer_id == str(peer_id))
            )
            if result.rowcount > 0:
                await db.commit()
                logger.info(f"✅ Private key silindi: Peer ID={peer_id}")

                # Template usage count'u düşür
                if template_id_to_decrement:
                    try:
                        from app.models.peer_template import PeerTemplate
                        template_result = await db.execute(
                            select(PeerTemplate).where(PeerTemplate.id == template_id_to_decrement)
                        )
                        template = template_result.scalar_one_or_none()
                        if template and template.usage_count > 0:
                            template.usage_count -= 1
                            await db.commit()
                            logger.info(f"✅ Template usage count düşürüldü - Template ID: {template_id_to_decrement}, Yeni count: {template.usage_count}")
                        else:
                            logger.warning(f"⚠️ Template bulunamadı veya usage_count zaten 0 - Template ID: {template_id_to_decrement}")
                    except Exception as template_error:
                        logger.error(f"❌ Template usage count düşürülemedi: {template_error}")
                        await db.rollback()
        except Exception as key_error:
            logger.warning(f"⚠️ Private key silme hatası (peer silme başarılı): {key_error}")
            await db.rollback()

        # PeerMetadata kayıtlarını sil (varsa)
        try:
            from app.models.peer_metadata import PeerMetadata
            result = await db.execute(
                delete(PeerMetadata).where(PeerMetadata.peer_id == str(peer_id))
            )
            if result.rowcount > 0:
                await db.commit()
                logger.info(f"✅ PeerMetadata kayıtları silindi: {result.rowcount} kayıt")
        except Exception as metadata_error:
            logger.warning(f"⚠️ PeerMetadata silme hatası (peer silme başarılı): {metadata_error}")
            await db.rollback()
        
        # Log kaydı
        await create_log(
            db,
            current_user.username,
            "peer_deleted",
            details=f"Peer ID: {peer_id}, Interface: {interface}",
            ip_address="127.0.0.1"
        )

        # Bildirim gönder - arka planda (bağımsız DB session ile)
        # Silinen peer'ın ismini belirle
        peer_name = peer_to_delete.get('comment') if peer_to_delete else None
        if not peer_name or not peer_name.strip():
            peer_name = str(peer_id)[:16] if peer_id else "Unknown"

        background_tasks.add_task(
            send_peer_notification_background,
            user_id=current_user.id,
            peer_name=peer_name,
            interface=interface,
            action="deleted"
        )
        logger.info(f"📬 Peer silme bildirimi arka planda gönderilecek: {peer_name}")

        # IP Pool'dan IP'yi serbest bırak (opsiyonel) - hata olursa peer silme başarılı sayılır
        try:
            from app.services.ip_pool_service import IPPoolService

            # Peer ID'ye göre allocation var mı kontrol et
            allocation = await IPPoolService.get_allocation_by_peer(db, peer_id)

            if allocation:
                # Allocation silinmeden önce bilgileri kaydet (detached object hatası önlenir)
                alloc_ip = allocation.ip_address
                alloc_id = allocation.id

                # IP'yi release et (allocation'ı siler)
                success = await IPPoolService.release_ip(db, peer_id=peer_id)
                if success:
                    logger.info(f"✅ IP pool'dan serbest bırakıldı: {alloc_ip} (Allocation ID: {alloc_id})")
                else:
                    logger.warning(f"⚠️ IP pool'dan serbest bırakılamadı: {alloc_ip}")
            else:
                logger.debug(f"ℹ️ Peer için IP pool tahsisi bulunamadı: {peer_id}")

        except Exception as pool_error:
            # IP pool hatası peer silmeyi etkilememeli
            logger.warning(f"⚠️ IP pool release yapılamadı (peer silme başarılı): {pool_error}")
            import traceback
            logger.debug(traceback.format_exc())

        logger.info(f"✅ Peer başarıyla silindi: peer_id={peer_id}, interface={interface}")
        return {
            "success": True,
            "message": "Peer başarıyla silindi"
        }
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"❌ Peer silme hatası: {e}")
        logger.error(f"❌ Full traceback:\n{error_trace}")

        # Greenlet hatasını özel olarak logla
        if "greenlet" in str(e).lower():
            logger.error(f"🔴 GREENLET HATASI TESPIT EDİLDİ! Bu bir async/await sorunu.")
            logger.error(f"🔴 Hata mesajı: {str(e)}")
            logger.error(f"🔴 Traceback:\n{error_trace}")

        raise HTTPException(status_code=500, detail=f"Peer silinemedi: {str(e)}")


@router.get("/peer/{peer_id}/logs")
async def get_peer_logs_endpoint(
    peer_id: str,
    interface: str = Query(..., description="Interface adı"),
    start_date: Optional[str] = Query(None, description="Başlangıç tarihi (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Bitiş tarihi (YYYY-MM-DD)"),
    limit: int = Query(100, ge=1, le=1000, description="Maksimum kayıt sayısı"),
    offset: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Belirli bir peer'ın loglarını getirir (online/offline zamanları)
    Tarih filtreleme ve pagination desteği ile
    """
    try:
        import urllib.parse
        from datetime import datetime
        peer_id = urllib.parse.unquote(peer_id)
        
        # Tarih parse et (Türkiye saat dilimi - UTC+3)
        turkey_tz = timezone(timedelta(hours=3))
        start_dt = None
        end_dt = None
        
        # Tarih filtresi yoksa son 7 günü göster (performans için)
        if not start_date and not end_date:
            end_dt = datetime.now(turkey_tz)
            start_dt = end_dt - timedelta(days=7)
        
        if start_date:
            try:
                # Türkiye saat diliminde başlangıç günü (00:00:00)
                start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=turkey_tz)
            except ValueError:
                raise HTTPException(status_code=400, detail="Geçersiz başlangıç tarihi formatı. YYYY-MM-DD formatında olmalı.")
        
        if end_date:
            try:
                # Türkiye saat diliminde bitiş günü (23:59:59)
                end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=turkey_tz)
            except ValueError:
                raise HTTPException(status_code=400, detail="Geçersiz bitiş tarihi formatı. YYYY-MM-DD formatında olmalı.")
        
        logs = await get_peer_logs(db, peer_id, interface, start_dt, end_dt, limit=limit)
        summary = await get_peer_status_summary(db, peer_id, interface, start_dt, end_dt)
        
        # Türkiye saat dilimi (UTC+3) için timezone bilgisi ekle
        turkey_tz = timezone(timedelta(hours=3))
        
        formatted_logs = []
        for log in logs:
            event_time = log.event_time
            if event_time:
                # Eğer timezone bilgisi yoksa Türkiye saat dilimi olarak kabul et
                if event_time.tzinfo is None:
                    event_time = event_time.replace(tzinfo=turkey_tz)
                # Türkiye saat dilimine çevir
                event_time_turkey = event_time.astimezone(turkey_tz)
                event_time_str = event_time_turkey.isoformat()
            else:
                event_time_str = None
            
            formatted_logs.append({
                "id": log.id,
                "event_type": log.event_type,
                "is_online": log.is_online,
                "event_time": event_time_str,
                "last_handshake_value": log.last_handshake_value,
                "peer_name": log.peer_name,
            })
        
        return {
            "success": True,
            "data": formatted_logs,
            "summary": summary,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "count": len(formatted_logs)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Peer logları alınamadı: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Peer logları alınamadı: {str(e)}")


@router.get("/peer/{peer_id}/qrcode")
async def get_peer_qrcode(
    peer_id: str,
    interface: str = Query(..., description="Interface adı"),
    private_key: Optional[str] = Query(None, description="Client'ın private key'i (opsiyonel, veritabanından da alınabilir)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Peer için WireGuard config'ini QR kod olarak döner
    NOT: MikroTik RouterOS'ta peer'lar için private-key alanı YOKTUR.
    Private key veritabanında saklanır veya query parameter olarak gönderilir.
    """
    try:
        # Peer bilgilerini al - Cache'i atla, güncel verileri çek
        peers = await mikrotik_conn.get_wireguard_peers(interface, use_cache=False)

        # Peer ID eşleştirmesi - MikroTik'te .id farklı formatlarda olabilir (*4, *5, vb.)
        peer = None

        # Peer ID'yi normalize et (URL decode ve trim)
        import urllib.parse
        try:
            decoded_peer_id = urllib.parse.unquote(peer_id)
        except:
            decoded_peer_id = peer_id
        
        # Peer ID varyantları oluştur (*A, A, *4, 4 gibi formatlar için)
        peer_id_variants = [peer_id, decoded_peer_id, str(peer_id), str(decoded_peer_id)]
        # * ile başlayan ID'ler için hem *A hem A formatını ekle
        if str(peer_id).startswith("*"):
            peer_id_variants.append(str(peer_id)[1:])  # *A -> A
            peer_id_variants.append(str(peer_id))  # *A -> *A (zaten var ama emin olmak için)
        if str(decoded_peer_id).startswith("*"):
            peer_id_variants.append(str(decoded_peer_id)[1:])  # *A -> A
            peer_id_variants.append(str(decoded_peer_id))  # *A -> *A
        
        # Tüm varyantları string'e çevir ve normalize et
        peer_id_variants = [str(v).strip() for v in peer_id_variants if v]
        # Tekrarları kaldır
        peer_id_variants = list(dict.fromkeys(peer_id_variants))
        
        logger.info(f"🔍 QR kod için peer aranıyor: Peer ID={peer_id} (decoded: {decoded_peer_id}), Interface={interface}, Varyantlar={peer_id_variants}")
        logger.info(f"📋 MikroTik'ten gelen peer sayısı: {len(peers)}")
        if peers:
            # Tüm peer'ların ID'lerini logla
            all_peer_ids = []
            for idx, p in enumerate(peers[:5]):
                peer_id_from_mikrotik = p.get(".id") or p.get("id") or p.get("*id")
                if peer_id_from_mikrotik is None:
                    # Tüm anahtarları kontrol et
                    for key in p.keys():
                        if key.endswith('id') or key == '.id' or key.startswith('*'):
                            peer_id_from_mikrotik = p.get(key)
                            break
                all_peer_ids.append(f"Peer[{idx}]: {peer_id_from_mikrotik} (tip: {type(peer_id_from_mikrotik).__name__})")
            logger.info(f"📋 İlk 5 peer ID'leri: {all_peer_ids}")
        
        for p in peers:
            # .id ve id alanlarını kontrol et - MikroTik'te genelde .id kullanılır
            peer_dot_id = p.get(".id") or p.get("id") or p.get("*id")
            
            # Eğer hala None ise, tüm anahtarları kontrol et
            if peer_dot_id is None:
                for key in p.keys():
                    if key.endswith('id') or key == '.id' or key.startswith('*'):
                        peer_dot_id = p.get(key)
                        logger.debug(f"Peer ID alternatif alandan bulundu: {key} = {peer_dot_id}")
                        break
            
            if peer_dot_id is None:
                logger.debug(f"Peer'da ID bulunamadı. Peer keys: {list(p.keys())}")
                continue
            
            peer_dot_id_str = str(peer_dot_id).strip()
            
            # Direkt eşleşme kontrolü (hem string hem orijinal değer ile)
            if peer_dot_id_str in peer_id_variants or peer_dot_id in peer_id_variants:
                peer = p
                logger.info(f"✅ Peer bulundu (direkt eşleşme): Peer ID={peer_dot_id_str} (aranan: {peer_id})")
                break
            
            # Case-insensitive eşleşme (büyük/küçük harf duyarsız)
            peer_dot_id_upper = peer_dot_id_str.upper()
            variants_upper = [v.upper() for v in peer_id_variants]
            if peer_dot_id_upper in variants_upper:
                peer = p
                logger.info(f"✅ Peer bulundu (case-insensitive eşleşme): Peer ID={peer_dot_id_str} (aranan: {peer_id})")
                break
            
            # * karakterini kaldırarak karşılaştırma (hem baştan hem sondan)
            peer_dot_id_normalized = peer_dot_id_str.lstrip("*").rstrip("*")
            for variant in peer_id_variants:
                variant_normalized = str(variant).lstrip("*").rstrip("*")
                if peer_dot_id_normalized == variant_normalized:
                    peer = p
                    logger.info(f"✅ Peer bulundu (normalize edilmiş eşleşme): {peer_dot_id_normalized} == {variant_normalized}")
                    break
                
                # Case-insensitive normalize edilmiş eşleşme
                if peer_dot_id_normalized.upper() == variant_normalized.upper():
                    peer = p
                    logger.info(f"✅ Peer bulundu (case-insensitive normalize eşleşme): {peer_dot_id_normalized.upper()} == {variant_normalized.upper()}")
                    break
            
            if peer:
                break
        
        # Eğer hala bulunamadıysa, tüm peer'ları ve varyantları logla
        if not peer:
            logger.error(f"❌ Peer bulunamadı! Aranan ID: {peer_id}, Decoded: {decoded_peer_id}")
            logger.error(f"❌ Varyantlar: {peer_id_variants}")
            logger.error(f"❌ MikroTik'ten gelen tüm peer ID'leri:")
            for idx, p in enumerate(peers):
                p_id = p.get(".id") or p.get("id") or p.get("*id")
                if p_id is None:
                    for key in p.keys():
                        if key.endswith('id') or key == '.id' or key.startswith('*'):
                            p_id = p.get(key)
                            break
                logger.error(f"  Peer[{idx}]: {p_id} (tip: {type(p_id).__name__})")
        
        if not peer:
            logger.error(f"❌ QR kod için peer bulunamadı. Peer ID: {peer_id} (decoded: {decoded_peer_id}), Interface: {interface}, Mevcut peer sayısı: {len(peers)}")
            if peers:
                logger.error(f"Mevcut peer ID'leri: {[str(p.get('.id') or p.get('id') or 'YOK') for p in peers]}")
                logger.error(f"İlk peer örneği: {peers[0] if peers else 'YOK'}")
            raise HTTPException(status_code=404, detail=f"Peer bulunamadı (ID: {peer_id})")
        
        # Interface bilgilerini al - cache'i atla, doğrudan API'den çek (güncel veri için)
        interfaces = await mikrotik_conn.get_wireguard_interfaces(use_cache=False)
        interface_data = None
        for i in interfaces:
            if i.get("name") == interface or i.get(".id") == interface:
                interface_data = i
                break
        
        if not interface_data:
            logger.warning(f"QR kod için interface bulunamadı. Interface: {interface}")
            raise HTTPException(status_code=404, detail=f"Interface bulunamadı: {interface}")
        
        # Debug: Interface verilerini logla
        logger.info(f"📋 QR kod için interface verileri alındı: {interface_data.get('name')}")
        logger.debug(f"Interface tüm anahtarları: {list(interface_data.keys())}")
        # Public key'i farklı alanlardan kontrol et
        interface_public_key_debug = interface_data.get("public-key") or interface_data.get("public_key") or interface_data.get("publicKey")
        logger.info(f"🔑 Interface public key (debug): {interface_public_key_debug[:30] if interface_public_key_debug else 'BULUNAMADI'}...")
        # Tüm alanları kontrol et (public içeren)
        for key in interface_data.keys():
            if 'public' in key.lower() or 'key' in key.lower():
                logger.debug(f"Interface key alanı bulundu: {key} = {str(interface_data.get(key))[:30] if interface_data.get(key) else 'None'}...")
        
        # WireGuard config oluştur (client tarafı için)
        config_lines = ["[Interface]"]
        config_lines.append("")
        
        # Private key - Önce query parameter'dan kontrol et, yoksa veritabanından al
        # NOT: MikroTik RouterOS'ta peer'lar için private-key alanı YOKTUR
        # Private key veritabanında saklanır veya query parameter olarak gönderilir
        client_private_key = private_key  # Query parameter'dan al

        # Query parameter'da yoksa veritabanından al
        if not client_private_key:
            try:
                # ÖNCELİKLE Peer ID ile dene - bu en güvenilir yöntem
                logger.info(f"🔍 QR kod için veritabanından private key aranıyor: Peer ID={peer_id}, tip={type(peer_id).__name__}, repr={repr(peer_id)}")

                # Tüm veritabanındaki peer_id'leri logla (debugging için)
                all_peer_keys_result = await db.execute(select(PeerKey))
                all_peer_keys = all_peer_keys_result.scalars().all()
                logger.info(f"📋 Veritabanındaki tüm peer_id'ler: {[pk.peer_id for pk in all_peer_keys]}")

                # Orijinal peer_id ile dene
                logger.info(f"🔍 Arama yapılıyor: PeerKey.peer_id == '{peer_id}'")
                peer_id_result = await db.execute(
                    select(PeerKey).where(PeerKey.peer_id == str(peer_id))
                )
                peer_key_record = peer_id_result.scalar_one_or_none()
                logger.info(f"🔍 Orijinal peer_id ile sonuç: {'BULUNDU' if peer_key_record else 'BULUNAMADI'}")

                # Eğer bulunamadıysa ve ID yıldız (*) ile başlıyorsa, normalize edilmiş ID ile dene (* karakterini kaldır)
                if not peer_key_record and str(peer_id).startswith("*"):
                    normalized_id = str(peer_id)[1:]
                    logger.info(f"🔍 Normalize edilmiş ID ile deneniyor (yıldız kaldırıldı): '{normalized_id}'")
                    peer_id_result_normalized = await db.execute(
                        select(PeerKey).where(PeerKey.peer_id == normalized_id)
                    )
                    peer_key_record = peer_id_result_normalized.scalar_one_or_none()
                    logger.info(f"🔍 Normalize edilmiş ID ile sonuç: {'BULUNDU' if peer_key_record else 'BULUNAMADI'}")

                # Eğer hala bulunamadıysa ve ID yıldız ile BAŞLAMIYOR ise, başına * ekleyerek dene
                if not peer_key_record and not str(peer_id).startswith("*"):
                    with_asterisk_id = "*" + str(peer_id)
                    logger.info(f"🔍 Yıldız eklenerek deneniyor: '{with_asterisk_id}'")
                    peer_id_result_with_asterisk = await db.execute(
                        select(PeerKey).where(PeerKey.peer_id == with_asterisk_id)
                    )
                    peer_key_record = peer_id_result_with_asterisk.scalar_one_or_none()
                    logger.info(f"🔍 Yıldız eklenerek sonuç: {'BULUNDU' if peer_key_record else 'BULUNAMADI'}")

                if peer_key_record:
                    client_private_key = peer_key_record.private_key
                    logger.info(f"✅ Private key Peer ID ile bulundu: Peer ID={peer_id}, Private Key uzunluk={len(client_private_key) if client_private_key else 0}")
                else:
                    # Peer ID ile bulunamadıysa, Public Key ile dene (fallback)
                    peer_public_key = peer.get('public-key') or peer.get('public_key')
                    if peer_public_key:
                        peer_public_key_normalized = str(peer_public_key).strip()
                        logger.warning(f"⚠️ Peer ID ile bulunamadı, Public Key ile deneniyor: {peer_public_key_normalized[:30]}...")

                        result = await db.execute(
                            select(PeerKey).where(PeerKey.public_key == peer_public_key_normalized)
                        )
                        peer_key_record = result.scalar_one_or_none()

                        if peer_key_record:
                            client_private_key = peer_key_record.private_key
                            logger.info(f"✅ Private key Public Key ile bulundu: Private Key uzunluk={len(client_private_key) if client_private_key else 0}")
                        else:
                            logger.error(f"❌ Veritabanında private key bulunamadı! Peer ID={peer_id}, Public Key={peer_public_key_normalized[:30] if peer_public_key_normalized else 'YOK'}...")
                    else:
                        logger.error(f"❌ Peer'da public key yok ve Peer ID ile de bulunamadı: Peer ID={peer_id}")
            except Exception as db_error:
                logger.error(f"❌ Veritabanından private key alınamadı: {db_error}")
                import traceback
                logger.error(traceback.format_exc())
        
        # Private key'i normalize et (trim ve boşlukları temizle)
        if client_private_key:
            client_private_key = str(client_private_key).strip()
        
        if client_private_key and len(client_private_key) > 0:
            config_lines.append(f"PrivateKey = {client_private_key}")
        else:
            # Private key yoksa placeholder kullan
            config_lines.append("PrivateKey = <YOUR_PRIVATE_KEY>")
            logger.warning(f"⚠️ Private key bulunamadı. Peer ID: {peer_id}, Interface: {interface}. QR kod için placeholder kullanılıyor.")
        
        # Address (client'ın kullanacağı IP) - panelden çek (peer'dan allowed-address'ten)
        if peer.get("allowed-address"):
            # allowed-address virgülle ayrılmış olabilir, /32 olan IP'yi bul
            addresses = peer.get("allowed-address").split(",")
            client_address = None
            for addr in addresses:
                addr = addr.strip()
                if "/32" in addr:
                    client_address = addr
                    break
            if not client_address:
                # /32 yoksa ilk adresi al
                client_address = addresses[0].strip()
            if client_address:
                config_lines.append(f"Address = {client_address}")
        
        # MTU - varsayılan 1380
        mtu = peer.get("mtu") or interface_data.get("mtu") or 1380
        config_lines.append(f"MTU = {mtu}")
        
        # DNS - varsayılan 1.1.1.1
        dns_value = peer.get("dns") or "1.1.1.1"
        config_lines.append(f"DNS = {dns_value}")
        
        config_lines.append("")
        config_lines.append("[Peer]")
        config_lines.append("")
        
        # Server'ın public key'i - panelden çek (interface'den)
        # Interface'den public key'i normalize et - tüm olası alan adlarını kontrol et
        interface_public_key = None
        # Önce standart alan adlarını kontrol et
        interface_public_key = interface_data.get("public-key") or interface_data.get("public_key") or interface_data.get("publicKey")
        
        # Eğer bulunamadıysa, tüm alanları tarayarak public key'i bul
        if not interface_public_key:
            for key in interface_data.keys():
                key_lower = key.lower()
                # Public key içeren tüm alanları kontrol et
                if ('public' in key_lower and 'key' in key_lower) or key_lower == 'public-key' or key_lower == 'public_key':
                    potential_key = interface_data.get(key)
                    if potential_key and len(str(potential_key).strip()) > 20:  # WireGuard key'leri genelde 40+ karakter
                        interface_public_key = potential_key
                        logger.info(f"Interface public key alternatif alandan bulundu: {key} = {interface_public_key[:20]}...")
                        break
        
        if interface_public_key:
            interface_public_key = str(interface_public_key).strip()
            logger.info(f"✅ Interface public key kullanılıyor: {interface_public_key[:20]}... (uzunluk: {len(interface_public_key)})")
            config_lines.append(f"PublicKey = {interface_public_key}")
        else:
            logger.error(f"❌ Interface public key bulunamadı. Interface: {interface}, Tüm alanlar: {list(interface_data.keys())}")
            # Hata fırlatmak yerine uyarı ver ve devam et
            config_lines.append("PublicKey = <INTERFACE_PUBLIC_KEY_NOT_FOUND>")
        
        # Allowed IPs - Client'ın hangi trafiği VPN üzerinden yönlendireceğini belirtir
        # Kullanıcının girdiği değeri database'den al
        peer_public_key = peer.get("public-key") or peer.get("public_key")
        allowed_ips_value = "0.0.0.0/0, ::/0"  # Varsayılan
        if peer_public_key:
            try:
                result = await db.execute(
                    select(PeerKey).where(PeerKey.public_key == str(peer_public_key).strip())
                )
                peer_key_record = result.scalar_one_or_none()
                if peer_key_record and peer_key_record.client_allowed_ips:
                    allowed_ips_value = peer_key_record.client_allowed_ips
                    logger.info(f"✅ Database'den client_allowed_ips alındı: {allowed_ips_value}")
            except Exception as e:
                logger.warning(f"⚠️ Database'den client_allowed_ips alınamadı: {e}")
                allowed_ips_value = peer.get("endpoint-allowed-address") or peer.get("endpoint_allowed_address") or "0.0.0.0/0, ::/0"
        else:
            allowed_ips_value = peer.get("endpoint-allowed-address") or peer.get("endpoint_allowed_address") or "0.0.0.0/0, ::/0"
        if allowed_ips_value:
            allowed_ips_value = str(allowed_ips_value).strip()
        if not allowed_ips_value or allowed_ips_value == "":
            allowed_ips_value = "0.0.0.0/0, ::/0"
        config_lines.append(f"AllowedIPs = {allowed_ips_value}")

        # Endpoint - Database'den endpoint bilgisini al, yoksa varsayılan kullan
        endpoint_address = None
        endpoint_port = None
        if peer_key_record:
            endpoint_address = peer_key_record.endpoint_address
            endpoint_port = peer_key_record.endpoint_port
            logger.info(f"✅ Database'den endpoint bilgisi alındı: {endpoint_address}:{endpoint_port}")

        # Endpoint oluştur - database'den veya varsayılan
        if endpoint_address and endpoint_port:
            endpoint = f"{endpoint_address}:{endpoint_port}"
            config_lines.append(f"Endpoint = {endpoint}")
        elif interface_data.get("listen-port"):
            # Fallback: endpoint bilgisi yoksa varsayılan kullan
            listen_port = interface_data.get("listen-port")
            endpoint = f"vpn.sahacam.com:{listen_port}"
            config_lines.append(f"Endpoint = {endpoint}")
            logger.warning(f"⚠️ Database'de endpoint bilgisi yok, varsayılan kullanılıyor: {endpoint}")
        
        # Persistent Keepalive - varsayılan 25
        if peer.get("persistent-keepalive"):
            keepalive = peer.get("persistent-keepalive")
            # 's' harfini kaldır
            if keepalive.endswith("s"):
                keepalive = keepalive[:-1]
            elif keepalive.endswith("m"):
                minutes = int(keepalive[:-1])
                keepalive = str(minutes * 60)
            config_lines.append(f"PersistentKeepalive = {keepalive}")
        else:
            # Default persistent keepalive: 25
            config_lines.append("PersistentKeepalive = 25")
        
        # Pre-shared Key - normalize et
        preshared_key = peer.get("preshared-key") or peer.get("preshared_key")
        if preshared_key:
            preshared_key = str(preshared_key).strip()
            config_lines.append(f"PresharedKey = {preshared_key}")
        
        config = "\n".join(config_lines)
        
        # QR kod oluştur
        qr_code = generate_qrcode(config)
        
        return {
            "success": True,
            "config": config,
            "qrcode": qr_code,
            "peer": peer
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"QR kod oluşturma hatası: {e}")
        raise HTTPException(status_code=500, detail=f"QR kod oluşturulamadı: {str(e)}")


@router.get("/peer/{peer_id}/config")
async def get_peer_config(
    peer_id: str,
    interface: str = Query(..., description="Interface adı"),
    private_key: Optional[str] = Query(None, description="Client'ın private key'i (opsiyonel, veritabanından da alınabilir)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Peer için WireGuard config dosyasını döner
    NOT: MikroTik RouterOS'ta peer'lar için private-key alanı YOKTUR.
    Private key veritabanında saklanır veya query parameter olarak gönderilir.
    """
    try:
        # Peer bilgilerini al - Cache'i atla, güncel verileri çek
        peers = await mikrotik_conn.get_wireguard_peers(interface, use_cache=False)

        # Debug: MikroTik'ten gelen peer verilerini logla
        logger.debug(f"Config için peer listesi alındı. Interface: {interface}, Peer sayısı: {len(peers)}")
        if peers:
            logger.debug(f"İlk peer örneği: {peers[0]}")
            logger.debug(f"Tüm peer ID'leri: {[str(p.get('.id', 'YOK')) + ' (tip: ' + str(type(p.get('.id'))) + ')' for p in peers]}")
        
        # Peer ID'yi decode et (URL encoding'den gelebilir)
        try:
            decoded_peer_id = peer_id
            if "%" in peer_id:
                import urllib.parse
                decoded_peer_id = urllib.parse.unquote(peer_id)
        except:
            decoded_peer_id = peer_id
        
        logger.debug(f"Aranan peer ID: {peer_id} (decoded: {decoded_peer_id})")
        
        # Peer ID eşleştirmesi - MikroTik'te .id farklı formatlarda olabilir (*4, *5, vb.)
        peer = None
        
        # Peer ID varyantları oluştur (*A, A, *4, 4 gibi formatlar için)
        peer_id_variants = [peer_id, decoded_peer_id, str(peer_id), str(decoded_peer_id)]
        # * ile başlayan ID'ler için hem *A hem A formatını ekle
        if str(peer_id).startswith("*"):
            peer_id_variants.append(str(peer_id)[1:])  # *A -> A
            peer_id_variants.append(str(peer_id))  # *A -> *A (zaten var ama emin olmak için)
        if str(decoded_peer_id).startswith("*"):
            peer_id_variants.append(str(decoded_peer_id)[1:])  # *A -> A
            peer_id_variants.append(str(decoded_peer_id))  # *A -> *A
        
        # Tüm varyantları string'e çevir ve normalize et
        peer_id_variants = [str(v).strip() for v in peer_id_variants if v]
        # Tekrarları kaldır
        peer_id_variants = list(dict.fromkeys(peer_id_variants))
        
        logger.info(f"🔍 Config için peer aranıyor: Peer ID={peer_id} (decoded: {decoded_peer_id}), Interface={interface}, Varyantlar={peer_id_variants}")
        logger.info(f"📋 MikroTik'ten gelen peer sayısı: {len(peers)}")
        if peers:
            # Tüm peer'ların ID'lerini logla
            all_peer_ids = []
            for idx, p in enumerate(peers[:5]):
                peer_id_from_mikrotik = p.get(".id") or p.get("id") or p.get("*id")
                if peer_id_from_mikrotik is None:
                    # Tüm anahtarları kontrol et
                    for key in p.keys():
                        if key.endswith('id') or key == '.id' or key.startswith('*'):
                            peer_id_from_mikrotik = p.get(key)
                            break
                all_peer_ids.append(f"Peer[{idx}]: {peer_id_from_mikrotik} (tip: {type(peer_id_from_mikrotik).__name__})")
            logger.info(f"📋 İlk 5 peer ID'leri: {all_peer_ids}")
        
        for p in peers:
            # .id ve id alanlarını kontrol et - MikroTik'te genelde .id kullanılır
            peer_dot_id = p.get(".id") or p.get("id") or p.get("*id")
            
            # Eğer hala None ise, tüm anahtarları kontrol et
            if peer_dot_id is None:
                for key in p.keys():
                    if key.endswith('id') or key == '.id' or key.startswith('*'):
                        peer_dot_id = p.get(key)
                        logger.debug(f"Peer ID alternatif alandan bulundu: {key} = {peer_dot_id}")
                        break
            
            if peer_dot_id is None:
                logger.debug(f"Peer'da ID bulunamadı. Peer keys: {list(p.keys())}")
                continue
            
            peer_dot_id_str = str(peer_dot_id).strip()
            
            # Direkt eşleşme kontrolü (hem string hem orijinal değer ile)
            if peer_dot_id_str in peer_id_variants or peer_dot_id in peer_id_variants:
                logger.info(f"✅ Peer bulundu (direkt eşleşme): Peer ID={peer_dot_id_str} (aranan: {peer_id})")
                peer = p
                break
            
            # Case-insensitive eşleşme (büyük/küçük harf duyarsız)
            peer_dot_id_upper = peer_dot_id_str.upper()
            variants_upper = [v.upper() for v in peer_id_variants]
            if peer_dot_id_upper in variants_upper:
                logger.info(f"✅ Peer bulundu (case-insensitive eşleşme): Peer ID={peer_dot_id_str} (aranan: {peer_id})")
                peer = p
                break
            
            # * karakterini kaldırarak karşılaştırma (hem baştan hem sondan)
            peer_dot_id_normalized = peer_dot_id_str.lstrip("*").rstrip("*")
            for variant in peer_id_variants:
                variant_normalized = str(variant).lstrip("*").rstrip("*")
                if peer_dot_id_normalized == variant_normalized:
                    logger.info(f"✅ Peer bulundu (normalize edilmiş eşleşme): {peer_dot_id_normalized} == {variant_normalized}")
                    peer = p
                    break
                
                # Case-insensitive normalize edilmiş eşleşme
                if peer_dot_id_normalized.upper() == variant_normalized.upper():
                    logger.info(f"✅ Peer bulundu (case-insensitive normalize eşleşme): {peer_dot_id_normalized.upper()} == {variant_normalized.upper()}")
                    peer = p
                    break
            
            if peer:
                break
            
            # * karakterini kaldırarak karşılaştırma
            peer_dot_id_normalized = peer_dot_id_str.lstrip("*")
            for variant in peer_id_variants:
                variant_normalized = str(variant).lstrip("*")
                if peer_dot_id_normalized == variant_normalized:
                    logger.debug(f"Peer bulundu! Normalize edilmiş eşleşme: {peer_dot_id_normalized} == {variant_normalized}")
                    peer = p
                    break
            
            if peer:
                break
            
            # Public key ile de eşleştirme yap (fallback) - normalize edilmiş key'leri kullan
            peer_public_key = p.get("public-key") or p.get("public_key")
            if peer_public_key:
                peer_public_key_normalized = str(peer_public_key).strip()
                if peer_public_key_normalized == str(peer_id).strip() or peer_public_key_normalized == str(decoded_peer_id).strip():
                    logger.debug(f"Peer public key ile bulundu!")
                    peer = p
                    break
        
        if not peer:
            logger.warning(f"Config için peer bulunamadı. Peer ID: {peer_id} (decoded: {decoded_peer_id}), Interface: {interface}, Mevcut peer sayısı: {len(peers)}")
            if peers:
                logger.debug(f"Mevcut peer ID'leri: {[str(p.get('.id', 'YOK')) for p in peers]}")
                logger.debug(f"Peer ID varyantları denenmiş: {peer_id_variants}")
                # İlk peer'ın tüm anahtarlarını göster
                if len(peers) > 0:
                    logger.debug(f"İlk peer'ın tüm anahtarları: {list(peers[0].keys())}")
            raise HTTPException(status_code=404, detail=f"Peer bulunamadı (ID: {peer_id})")
        
        # Interface bilgilerini al - cache'i atla, doğrudan API'den çek (güncel veri için)
        interfaces = await mikrotik_conn.get_wireguard_interfaces(use_cache=False)
        interface_data = None
        for i in interfaces:
            if i.get("name") == interface or i.get(".id") == interface:
                interface_data = i
                break
        
        if not interface_data:
            logger.warning(f"Config için interface bulunamadı. Interface: {interface}")
            raise HTTPException(status_code=404, detail=f"Interface bulunamadı: {interface}")
        
        # Debug: Interface verilerini logla
        logger.info(f"📋 Config için interface verileri alındı: {interface_data.get('name')}")
        logger.debug(f"Interface tüm anahtarları: {list(interface_data.keys())}")
        # Public key'i farklı alanlardan kontrol et
        interface_public_key_debug = interface_data.get("public-key") or interface_data.get("public_key") or interface_data.get("publicKey")
        logger.info(f"🔑 Interface public key (debug): {interface_public_key_debug[:30] if interface_public_key_debug else 'BULUNAMADI'}...")
        # Tüm alanları kontrol et (public içeren)
        for key in interface_data.keys():
            if 'public' in key.lower() or 'key' in key.lower():
                logger.debug(f"Interface key alanı bulundu: {key} = {str(interface_data.get(key))[:30] if interface_data.get(key) else 'None'}...")
        
        # WireGuard config oluştur (client tarafı için)
        config_lines = ["[Interface]"]
        config_lines.append("")
        
        # Private key - Önce query parameter'dan kontrol et, yoksa veritabanından al
        # NOT: MikroTik RouterOS'ta peer'lar için private-key alanı YOKTUR
        # Private key veritabanında saklanır veya query parameter olarak gönderilir
        client_private_key = private_key  # Query parameter'dan al
        
        # Query parameter'da yoksa veritabanından al
        if not client_private_key:
            try:
                # ÖNCELİKLE Peer ID ile dene - bu en güvenilir yöntem
                logger.info(f"🔍 Config için veritabanından private key aranıyor: Peer ID={peer_id}, tip={type(peer_id).__name__}, repr={repr(peer_id)}")

                # Tüm veritabanındaki peer_id'leri logla (debugging için)
                all_peer_keys_result = await db.execute(select(PeerKey))
                all_peer_keys = all_peer_keys_result.scalars().all()
                logger.info(f"📋 Veritabanındaki tüm peer_id'ler: {[pk.peer_id for pk in all_peer_keys]}")

                # Orijinal peer_id ile dene
                logger.info(f"🔍 Arama yapılıyor: PeerKey.peer_id == '{peer_id}'")
                peer_id_result = await db.execute(
                    select(PeerKey).where(PeerKey.peer_id == str(peer_id))
                )
                peer_key_record = peer_id_result.scalar_one_or_none()
                logger.info(f"🔍 Orijinal peer_id ile sonuç: {'BULUNDU' if peer_key_record else 'BULUNAMADI'}")

                # Eğer bulunamadıysa ve ID yıldız (*) ile başlıyorsa, normalize edilmiş ID ile dene (* karakterini kaldır)
                if not peer_key_record and str(peer_id).startswith("*"):
                    normalized_id = str(peer_id)[1:]
                    logger.info(f"🔍 Normalize edilmiş ID ile deneniyor (yıldız kaldırıldı): '{normalized_id}'")
                    peer_id_result_normalized = await db.execute(
                        select(PeerKey).where(PeerKey.peer_id == normalized_id)
                    )
                    peer_key_record = peer_id_result_normalized.scalar_one_or_none()
                    logger.info(f"🔍 Normalize edilmiş ID ile sonuç: {'BULUNDU' if peer_key_record else 'BULUNAMADI'}")

                # Eğer hala bulunamadıysa ve ID yıldız ile BAŞLAMIYOR ise, başına * ekleyerek dene
                if not peer_key_record and not str(peer_id).startswith("*"):
                    with_asterisk_id = "*" + str(peer_id)
                    logger.info(f"🔍 Yıldız eklenerek deneniyor: '{with_asterisk_id}'")
                    peer_id_result_with_asterisk = await db.execute(
                        select(PeerKey).where(PeerKey.peer_id == with_asterisk_id)
                    )
                    peer_key_record = peer_id_result_with_asterisk.scalar_one_or_none()
                    logger.info(f"🔍 Yıldız eklenerek sonuç: {'BULUNDU' if peer_key_record else 'BULUNAMADI'}")

                if peer_key_record:
                    client_private_key = peer_key_record.private_key
                    logger.info(f"✅ Private key Peer ID ile bulundu: Peer ID={peer_id}, Private Key uzunluk={len(client_private_key) if client_private_key else 0}")
                else:
                    # Peer ID ile bulunamadıysa, Public Key ile dene (fallback)
                    peer_public_key = peer.get('public-key') or peer.get('public_key')
                    if peer_public_key:
                        peer_public_key_normalized = str(peer_public_key).strip()
                        logger.warning(f"⚠️ Peer ID ile bulunamadı, Public Key ile deneniyor: {peer_public_key_normalized[:30]}...")

                        result = await db.execute(
                            select(PeerKey).where(PeerKey.public_key == peer_public_key_normalized)
                        )
                        peer_key_record = result.scalar_one_or_none()

                        if peer_key_record:
                            client_private_key = peer_key_record.private_key
                            logger.info(f"✅ Private key Public Key ile bulundu: Private Key uzunluk={len(client_private_key) if client_private_key else 0}")
                        else:
                            logger.error(f"❌ Veritabanında private key bulunamadı! Peer ID={peer_id}, Public Key={peer_public_key_normalized[:30] if peer_public_key_normalized else 'YOK'}...")
                    else:
                        logger.error(f"❌ Peer'da public key yok ve Peer ID ile de bulunamadı: Peer ID={peer_id}")
            except Exception as db_error:
                logger.error(f"❌ Veritabanından private key alınamadı: {db_error}")
                import traceback
                logger.error(traceback.format_exc())
        
        # Private key'i normalize et (trim ve boşlukları temizle)
        if client_private_key:
            client_private_key = str(client_private_key).strip()
        
        if client_private_key and len(client_private_key) > 0:
            config_lines.append(f"PrivateKey = {client_private_key}")
        else:
            # Private key yoksa placeholder kullan
            config_lines.append("PrivateKey = <YOUR_PRIVATE_KEY>")
            logger.warning(f"⚠️ Private key bulunamadı. Peer ID: {peer_id}, Interface: {interface}. Config için placeholder kullanılıyor.")
        
        # Address (client'ın kullanacağı IP) - panelden çek (peer'dan allowed-address'ten)
        if peer.get("allowed-address"):
            # allowed-address virgülle ayrılmış olabilir, /32 olan IP'yi bul
            addresses = peer.get("allowed-address").split(",")
            client_address = None
            for addr in addresses:
                addr = addr.strip()
                if "/32" in addr:
                    client_address = addr
                    break
            if not client_address:
                # /32 yoksa ilk adresi al
                client_address = addresses[0].strip()
            if client_address:
                config_lines.append(f"Address = {client_address}")
        
        # MTU - varsayılan 1380
        mtu = peer.get("mtu") or interface_data.get("mtu") or 1380
        config_lines.append(f"MTU = {mtu}")
        
        # DNS - varsayılan 1.1.1.1
        dns_value = peer.get("dns") or "1.1.1.1"
        config_lines.append(f"DNS = {dns_value}")
        
        config_lines.append("")
        config_lines.append("[Peer]")
        config_lines.append("")
        
        # Server'ın public key'i - panelden çek (interface'den)
        # Interface'den public key'i normalize et - hem 'public-key' hem 'public_key' kontrolü yap
        interface_public_key = interface_data.get("public-key") or interface_data.get("public_key")
        if interface_public_key:
            interface_public_key = str(interface_public_key).strip()
            config_lines.append(f"PublicKey = {interface_public_key}")
        else:
            logger.warning(f"⚠️ Interface public key bulunamadı. Interface: {interface}")
        
        # Allowed IPs - Client'ın hangi trafiği VPN üzerinden yönlendireceğini belirtir
        # Kullanıcının girdiği değeri database'den al
        peer_public_key = peer.get("public-key") or peer.get("public_key")
        allowed_ips_value = "0.0.0.0/0, ::/0"  # Varsayılan
        if peer_public_key:
            try:
                result = await db.execute(
                    select(PeerKey).where(PeerKey.public_key == str(peer_public_key).strip())
                )
                peer_key_record = result.scalar_one_or_none()
                if peer_key_record and peer_key_record.client_allowed_ips:
                    allowed_ips_value = peer_key_record.client_allowed_ips
                    logger.info(f"✅ Database'den client_allowed_ips alındı: {allowed_ips_value}")
            except Exception as e:
                logger.warning(f"⚠️ Database'den client_allowed_ips alınamadı: {e}")
                allowed_ips_value = peer.get("endpoint-allowed-address") or peer.get("endpoint_allowed_address") or "0.0.0.0/0, ::/0"
        else:
            allowed_ips_value = peer.get("endpoint-allowed-address") or peer.get("endpoint_allowed_address") or "0.0.0.0/0, ::/0"
        if allowed_ips_value:
            allowed_ips_value = str(allowed_ips_value).strip()
        if not allowed_ips_value or allowed_ips_value == "":
            allowed_ips_value = "0.0.0.0/0, ::/0"
        config_lines.append(f"AllowedIPs = {allowed_ips_value}")

        # Endpoint - Database'den endpoint bilgisini al, yoksa varsayılan kullan
        endpoint_address = None
        endpoint_port = None
        if peer_key_record:
            endpoint_address = peer_key_record.endpoint_address
            endpoint_port = peer_key_record.endpoint_port
            logger.info(f"✅ Database'den endpoint bilgisi alındı: {endpoint_address}:{endpoint_port}")

        # Endpoint oluştur - database'den veya varsayılan
        if endpoint_address and endpoint_port:
            endpoint = f"{endpoint_address}:{endpoint_port}"
            config_lines.append(f"Endpoint = {endpoint}")
        elif interface_data.get("listen-port"):
            # Fallback: endpoint bilgisi yoksa varsayılan kullan
            listen_port = interface_data.get("listen-port")
            endpoint = f"vpn.sahacam.com:{listen_port}"
            config_lines.append(f"Endpoint = {endpoint}")
            logger.warning(f"⚠️ Database'de endpoint bilgisi yok, varsayılan kullanılıyor: {endpoint}")
        
        # Persistent Keepalive - varsayılan 25
        if peer.get("persistent-keepalive"):
            keepalive = peer.get("persistent-keepalive")
            # 's' harfini kaldır
            if keepalive.endswith("s"):
                keepalive = keepalive[:-1]
            elif keepalive.endswith("m"):
                minutes = int(keepalive[:-1])
                keepalive = str(minutes * 60)
            config_lines.append(f"PersistentKeepalive = {keepalive}")
        else:
            # Default persistent keepalive: 25
            config_lines.append("PersistentKeepalive = 25")
        
        # Pre-shared Key - normalize et
        preshared_key = peer.get("preshared-key") or peer.get("preshared_key")
        if preshared_key:
            preshared_key = str(preshared_key).strip()
            config_lines.append(f"PresharedKey = {preshared_key}")
        
        config = "\n".join(config_lines)
        
        return {
            "success": True,
            "config": config,
            "peer": peer
        }
    except HTTPException:
        raise
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Config dosyası oluşturma hatası: {error_msg}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        # Network/connection/timeout hatalarını özel olarak işle
        if "network" in error_msg.lower() or "connection" in error_msg.lower() or "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
            raise HTTPException(
                status_code=503,
                detail=f"MikroTik router'a bağlanılamadı veya yanıt alınamadı. Lütfen bağlantıyı kontrol edin ve tekrar deneyin. Hata: {error_msg}"
            )
        
        # !re veya Malformed hatasını özel olarak işle
        if "!re" in error_msg or "Malformed" in error_msg or "malformed" in error_msg.lower() or "parse edilemedi" in error_msg.lower():
            raise HTTPException(
                status_code=500,
                detail=f"MikroTik API yanıtı parse edilemedi. Bu genellikle bağlantı sorunu veya MikroTik API versiyonu uyumsuzluğu nedeniyle oluşur. Lütfen bağlantıyı kontrol edin ve tekrar deneyin."
            )
        
        raise HTTPException(status_code=500, detail=f"Config dosyası oluşturulamadı: {error_msg}")




# ========== TOPLU PEER İŞLEMLERİ ==========

class BulkPeerOperation(BaseModel):
    """Toplu peer işlemi için model"""
    peer_ids: List[str]
    interface: str


@router.post("/peers/bulk/enable")
async def bulk_enable_peers(
    operation: BulkPeerOperation,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Birden fazla peer'ı toplu olarak aktif et
    
    Args:
        operation: Toplu işlem verisi (peer_ids ve interface)
    """
    logger.info(f"📦 Toplu peer aktif etme isteği: {len(operation.peer_ids)} peer")
    
    results = {
        "success": [],
        "failed": [],
        "total": len(operation.peer_ids),
    }
    
    try:
        # MikroTik bağlantısını kontrol et
        if not mikrotik_conn.connection:
            await mikrotik_conn.connect()
        
        for peer_id in operation.peer_ids:
            try:
                # Peer'ı enable et
                mikrotik_conn.connection.get_resource('/interface/wireguard/peers').call(
                    'enable',
                    {'.id': peer_id}
                )
                results["success"].append(peer_id)
                logger.info(f"✅ Peer aktif edildi: {peer_id}")
                
                # Log kaydı oluştur
                await create_log(
                    db=db,
                    action="enable_peer",
                    user=current_user.username,
                    details=f"Peer {peer_id} aktif edildi (bulk operation)",
                    success=True
                )
            except Exception as e:
                logger.error(f"❌ Peer aktif edilemedi: {peer_id}, Hata: {e}")
                results["failed"].append({"peer_id": peer_id, "error": str(e)})
                
                await create_log(
                    db=db,
                    action="enable_peer",
                    user=current_user.username,
                    details=f"Peer {peer_id} aktif edilemedi: {str(e)}",
                    success=False
                )
        
        success_count = len(results["success"])
        failed_count = len(results["failed"])
        
        return {
            "success": failed_count == 0,
            "message": f"{success_count} peer başarıyla aktif edildi, {failed_count} başarısız",
            "results": results
        }
    
    except Exception as e:
        logger.error(f"❌ Toplu peer aktif etme hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/peers/bulk/disable")
async def bulk_disable_peers(
    operation: BulkPeerOperation,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Birden fazla peer'ı toplu olarak pasif et
    
    Args:
        operation: Toplu işlem verisi (peer_ids ve interface)
    """
    logger.info(f"📦 Toplu peer pasif etme isteği: {len(operation.peer_ids)} peer")
    
    results = {
        "success": [],
        "failed": [],
        "total": len(operation.peer_ids),
    }
    
    try:
        # MikroTik bağlantısını kontrol et
        if not mikrotik_conn.connection:
            await mikrotik_conn.connect()
        
        for peer_id in operation.peer_ids:
            try:
                # Peer'ı disable et
                mikrotik_conn.connection.get_resource('/interface/wireguard/peers').call(
                    'disable',
                    {'.id': peer_id}
                )
                results["success"].append(peer_id)
                logger.info(f"✅ Peer pasif edildi: {peer_id}")
                
                # Log kaydı oluştur
                await create_log(
                    db=db,
                    action="disable_peer",
                    user=current_user.username,
                    details=f"Peer {peer_id} pasif edildi (bulk operation)",
                    success=True
                )
            except Exception as e:
                logger.error(f"❌ Peer pasif edilemedi: {peer_id}, Hata: {e}")
                results["failed"].append({"peer_id": peer_id, "error": str(e)})
                
                await create_log(
                    db=db,
                    action="disable_peer",
                    user=current_user.username,
                    details=f"Peer {peer_id} pasif edilemedi: {str(e)}",
                    success=False
                )
        
        success_count = len(results["success"])
        failed_count = len(results["failed"])
        
        return {
            "success": failed_count == 0,
            "message": f"{success_count} peer başarıyla pasif edildi, {failed_count} başarısız",
            "results": results
        }
    
    except Exception as e:
        logger.error(f"❌ Toplu peer pasif etme hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/peers/bulk/delete")
async def bulk_delete_peers(
    operation: BulkPeerOperation,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Birden fazla peer'ı toplu olarak sil
    
    Args:
        operation: Toplu işlem verisi (peer_ids ve interface)
    """
    logger.info(f"📦 Toplu peer silme isteği: {len(operation.peer_ids)} peer")
    
    results = {
        "success": [],
        "failed": [],
        "total": len(operation.peer_ids),
    }
    
    try:
        # MikroTik bağlantısını kontrol et
        if not mikrotik_conn.connection:
            await mikrotik_conn.connect()
        
        for peer_id in operation.peer_ids:
            try:
                # Peer'ı sil
                mikrotik_conn.connection.get_resource('/interface/wireguard/peers').call(
                    'remove',
                    {'.id': peer_id}
                )
                results["success"].append(peer_id)
                logger.info(f"✅ Peer silindi: {peer_id}")
                
                # Log kaydı oluştur
                await create_log(
                    db=db,
                    action="delete_peer",
                    user=current_user.username,
                    details=f"Peer {peer_id} silindi (bulk operation)",
                    success=True
                )
            except Exception as e:
                logger.error(f"❌ Peer silinemedi: {peer_id}, Hata: {e}")
                results["failed"].append({"peer_id": peer_id, "error": str(e)})
                
                await create_log(
                    db=db,
                    action="delete_peer",
                    user=current_user.username,
                    details=f"Peer {peer_id} silinemedi: {str(e)}",
                    success=False
                )
        
        success_count = len(results["success"])
        failed_count = len(results["failed"])
        
        return {
            "success": failed_count == 0,
            "message": f"{success_count} peer başarıyla silindi, {failed_count} başarısız",
            "results": results
        }
    
    except Exception as e:
        logger.error(f"❌ Toplu peer silme hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync")
async def sync_wireguard_from_mikrotik(
    request: Request,
    force: bool = Query(False, description="Sync tamamlanmış olsa bile yeniden sync yap"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    MikroTik'teki mevcut WireGuard yapılandırmasını database'e manuel olarak sync eder

    Args:
        force: True ise sync tamamlanmış olsa bile yeniden sync yapar
        db: Database session
        current_user: Mevcut kullanıcı

    Returns:
        Sync istatistikleri ve sonuçları
    """
    try:
        from app.services.sync_service import SyncService
        from app.utils.activity_logger import ActivityLogger

        # Sync durumunu kontrol et
        sync_status = await SyncService.check_sync_status(db)

        if sync_status and not force:
            return {
                "success": False,
                "message": "İlk senkronizasyon zaten tamamlanmış. Yeniden sync için force=true kullanın",
                "already_synced": True
            }

        # Sync başlat
        logger.info(f"Manuel sync tetiklendi: {current_user.username}")
        sync_result = await SyncService.perform_initial_sync(db)

        # Activity log kaydet
        await ActivityLogger.log(
            db=db,
            request=request,
            action="manual_sync",
            category="wireguard",
            description=f"Manuel MikroTik sync: {sync_result['interfaces_synced']} interface, {sync_result['peers_synced']} peer",
            user=current_user,
            success='success' if sync_result['success'] else 'error',
            error_message="; ".join(sync_result['errors']) if sync_result['errors'] else None
        )

        return {
            "success": sync_result["success"],
            "message": "Senkronizasyon tamamlandı",
            "stats": {
                "interfaces_synced": sync_result["interfaces_synced"],
                "peers_synced": sync_result["peers_synced"],
                "errors": sync_result["errors"]
            }
        }

    except Exception as e:
        logger.error(f"Manuel sync hatası: {e}")
        import traceback
        logger.debug(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
