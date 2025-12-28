"""
Backup/Restore API endpoints
WireGuard konfigürasyon yedekleme ve geri yükleme
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any
from app.mikrotik.connection import mikrotik_conn
from app.security.auth import get_current_user
from app.models.user import User
from app.database.database import get_db
from app.services.log_service import create_log
from sqlalchemy.ext.asyncio import AsyncSession
import logging
from datetime import datetime

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/backup/wireguard")
async def backup_wireguard_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    WireGuard konfigürasyonunu backup al
    Tüm interface ve peer bilgilerini JSON formatında döner
    """
    try:
        logger.info(f"💾 Backup isteği: Kullanıcı={current_user.username}")

        # MikroTik bağlantısını kontrol et
        if not mikrotik_conn.connection:
            await mikrotik_conn.connect()

        # Interface'leri al
        interfaces = mikrotik_conn.connection.get_resource('/interface/wireguard').get()

        # Her interface için peer'ları al
        backup_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0",
            "interfaces": []
        }

        for interface in interfaces:
            interface_name = interface.get('name')

            # Peer'ları al
            peers = mikrotik_conn.connection.get_resource('/interface/wireguard/peers').get(
                interface=interface_name
            )

            interface_backup = {
                "name": interface_name,
                "mtu": interface.get('mtu'),
                "listen_port": interface.get('listen-port'),
                "private_key": interface.get('private-key'),
                "public_key": interface.get('public-key'),
                "disabled": interface.get('disabled', 'false'),
                "peers": []
            }

            # Peer'ları ekle
            for peer in peers:
                peer_backup = {
                    "comment": peer.get('comment', ''),
                    "public_key": peer.get('public-key'),
                    "endpoint_address": peer.get('endpoint-address', ''),
                    "endpoint_port": peer.get('endpoint-port', ''),
                    "allowed_address": peer.get('allowed-address', ''),
                    "persistent_keepalive": peer.get('persistent-keepalive', ''),
                    "preshared_key": peer.get('preshared-key', ''),
                    "disabled": peer.get('disabled', 'false'),
                }
                interface_backup["peers"].append(peer_backup)

            backup_data["interfaces"].append(interface_backup)

        # Log kaydı oluştur
        await create_log(
            db=db,
            action="backup_config",
            user=current_user.username,
            details=f"WireGuard konfigürasyonu yedeklendi ({len(backup_data['interfaces'])} interface)",
            success=True
        )

        logger.info(f"✅ Backup başarılı: {len(backup_data['interfaces'])} interface yedeklendi")

        return {
            "success": True,
            "message": "Yedekleme başarılı",
            "backup": backup_data
        }

    except Exception as e:
        logger.error(f"❌ Backup hatası: {e}")

        await create_log(
            db=db,
            action="backup_config",
            user=current_user.username,
            details=f"Backup hatası: {str(e)}",
            success=False
        )

        raise HTTPException(status_code=500, detail=str(e))


class RestoreConfig(BaseModel):
    """Restore konfigürasyon modeli"""
    backup: Dict[str, Any]
    restore_peers: bool = True
    overwrite_existing: bool = False


@router.post("/restore/wireguard")
async def restore_wireguard_config(
    config: RestoreConfig,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    WireGuard konfigürasyonunu geri yükle

    Args:
        config: Restore konfigürasyonu
            - backup: Backup verisi
            - restore_peers: Peer'ları da geri yükle (varsayılan: True)
            - overwrite_existing: Mevcut peer'ları üzerine yaz (varsayılan: False)
    """
    try:
        logger.info(f"♻️ Restore isteği: Kullanıcı={current_user.username}")

        backup_data = config.backup

        # Backup versiyonunu kontrol et
        if backup_data.get('version') != '1.0':
            raise HTTPException(
                status_code=400,
                detail=f"Desteklenmeyen backup versiyonu: {backup_data.get('version')}"
            )

        # MikroTik bağlantısını kontrol et
        if not mikrotik_conn.connection:
            await mikrotik_conn.connect()

        results = {
            "interfaces_restored": 0,
            "peers_restored": 0,
            "peers_skipped": 0,
            "errors": []
        }

        interfaces = backup_data.get('interfaces', [])

        for interface_data in interfaces:
            interface_name = interface_data.get('name')

            try:
                # Interface'in mevcut olup olmadığını kontrol et
                existing_interfaces = mikrotik_conn.connection.get_resource('/interface/wireguard').get(
                    name=interface_name
                )

                # Interface yoksa oluştur
                if not existing_interfaces:
                    logger.info(f"📝 Interface oluşturuluyor: {interface_name}")
                    # NOT: Interface oluşturma için private key gerekli
                    # Ancak güvenlik nedeniyle private key'i restore etmek riskli olabilir
                    # Bu nedenle sadece peer'ları restore ediyoruz
                    logger.warning(f"Interface {interface_name} mevcut değil. Sadece peer'lar restore edilecek.")

                # Peer'ları restore et
                if config.restore_peers:
                    peers = interface_data.get('peers', [])

                    for peer_data in peers:
                        try:
                            # Mevcut peer'ları kontrol et
                            public_key = peer_data.get('public_key')
                            existing_peers = mikrotik_conn.connection.get_resource('/interface/wireguard/peers').get(
                                interface=interface_name,
                                **{'public-key': public_key}
                            )

                            if existing_peers and not config.overwrite_existing:
                                logger.info(f"⏭️ Peer zaten mevcut, atlanıyor: {peer_data.get('comment')}")
                                results["peers_skipped"] += 1
                                continue

                            # Peer'ı ekle veya güncelle
                            peer_params = {
                                'interface': interface_name,
                                'public-key': public_key,
                                'comment': peer_data.get('comment', ''),
                                'allowed-address': peer_data.get('allowed_address', ''),
                            }

                            # Opsiyonel alanlar
                            if peer_data.get('endpoint_address'):
                                peer_params['endpoint-address'] = peer_data['endpoint_address']
                            if peer_data.get('endpoint_port'):
                                peer_params['endpoint-port'] = peer_data['endpoint_port']
                            if peer_data.get('persistent_keepalive'):
                                peer_params['persistent-keepalive'] = peer_data['persistent_keepalive']
                            if peer_data.get('preshared_key'):
                                peer_params['preshared-key'] = peer_data['preshared_key']

                            if existing_peers and config.overwrite_existing:
                                # Mevcut peer'ı güncelle
                                peer_id = existing_peers[0]['.id']
                                mikrotik_conn.connection.get_resource('/interface/wireguard/peers').set(
                                    id=peer_id,
                                    **peer_params
                                )
                                logger.info(f"🔄 Peer güncellendi: {peer_data.get('comment')}")
                            else:
                                # Yeni peer ekle
                                mikrotik_conn.connection.get_resource('/interface/wireguard/peers').add(
                                    **peer_params
                                )
                                logger.info(f"✅ Peer eklendi: {peer_data.get('comment')}")

                            results["peers_restored"] += 1

                        except Exception as peer_error:
                            error_msg = f"Peer restore hatası ({peer_data.get('comment')}): {str(peer_error)}"
                            logger.error(f"❌ {error_msg}")
                            results["errors"].append(error_msg)

                results["interfaces_restored"] += 1

            except Exception as interface_error:
                error_msg = f"Interface restore hatası ({interface_name}): {str(interface_error)}"
                logger.error(f"❌ {error_msg}")
                results["errors"].append(error_msg)

        # Log kaydı oluştur
        await create_log(
            db=db,
            action="restore_config",
            user=current_user.username,
            details=f"Konfigürasyon geri yüklendi: {results['interfaces_restored']} interface, {results['peers_restored']} peer",
            success=len(results["errors"]) == 0
        )

        logger.info(f"✅ Restore tamamlandı: {results}")

        return {
            "success": len(results["errors"]) == 0,
            "message": "Geri yükleme tamamlandı",
            "results": results
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Restore hatası: {e}")

        await create_log(
            db=db,
            action="restore_config",
            user=current_user.username,
            details=f"Restore hatası: {str(e)}",
            success=False
        )

        raise HTTPException(status_code=500, detail=str(e))
