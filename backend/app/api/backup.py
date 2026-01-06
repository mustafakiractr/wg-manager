"""
Backup/Restore API endpoints
WireGuard konfigürasyon, database ve full system backup/restore
"""
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.mikrotik.connection import mikrotik_conn
from app.security.auth import get_current_user
from app.models.user import User
from app.database.database import get_db
from app.services.log_service import create_log
from app.services.backup_service import backup_service
from app.services.backup_scheduler_service import BackupSchedulerService
from app.services.backup_encryption_service import BackupEncryptionService
from sqlalchemy.ext.asyncio import AsyncSession
import logging
from datetime import datetime
from app.utils.datetime_helper import utcnow
import os
import zipfile
import tempfile
import shutil

router = APIRouter()
logger = logging.getLogger(__name__)

# Telegram bildirimi için lazy import
_telegram_service = None

def get_telegram_service():
    """Telegram service'i lazy import eder"""
    global _telegram_service
    if _telegram_service is None:
        from app.services.telegram_notification_service import TelegramNotificationService
        _telegram_service = TelegramNotificationService
    return _telegram_service


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
        if not await mikrotik_conn.ensure_connected():
            raise HTTPException(status_code=503, detail="MikroTik bağlantısı kurulamadı")

        # Interface'leri al (mevcut execute_command metodunu kullan)
        interfaces = await mikrotik_conn.get_wireguard_interfaces(use_cache=False)

        # Her interface için peer'ları al
        backup_data = {
            "timestamp": utcnow().isoformat(),
            "version": "1.0",
            "interfaces": []
        }

        for interface in interfaces:
            interface_name = interface.get('name')

            # Peer'ları al (mevcut execute_command metodunu kullan)
            peers = await mikrotik_conn.get_wireguard_peers(interface_name, use_cache=False)

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
            username=current_user.username,
            action="backup_config",
            details=f"WireGuard konfigürasyonu yedeklendi ({len(backup_data['interfaces'])} interface)"
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
            username=current_user.username,
            action="backup_config_error",
            details=f"Backup hatası: {str(e)}"
        )
        
        # Telegram bildirimi gönder (async, non-blocking)
        try:
            TelegramService = get_telegram_service()
            await TelegramService.send_critical_event(
                db=db,
                event_type="backup_failed",
                title="💾 Yedekleme Başarısız",
                description=f"WireGuard konfigürasyon yedeği alınamadı",
                details=f"Kullanıcı: {current_user.username}\nHata: {str(e)}"
            )
            logger.info(f"Telegram bildirimi gönderildi: backup_failed")
        except Exception as telegram_error:
            # Telegram hatası log kaydını etkilemez
            logger.error(f"Telegram bildirimi gönderilemedi: {telegram_error}")

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
        if not await mikrotik_conn.ensure_connected():
            raise HTTPException(status_code=503, detail="MikroTik bağlantısı kurulamadı")

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
                existing_interfaces = await mikrotik_conn.get_wireguard_interfaces(use_cache=False)
                interface_exists = any(
                    iface.get('name') == interface_name
                    for iface in existing_interfaces
                )

                # Interface yoksa uyar
                if not interface_exists:
                    logger.info(f"📝 Interface kontrol: {interface_name}")
                    # NOT: Interface oluşturma için private key gerekli
                    # Ancak güvenlik nedeniyle private key'i restore etmek riskli olabilir
                    # Bu nedenle sadece peer'ları restore ediyoruz
                    logger.warning(f"Interface {interface_name} mevcut değil. Sadece peer'lar restore edilecek.")

                # Peer'ları restore et
                if config.restore_peers:
                    peers = interface_data.get('peers', [])

                    # Mevcut peer'ları al
                    existing_peers_list = []
                    if interface_exists:
                        existing_peers_list = await mikrotik_conn.get_wireguard_peers(interface_name, use_cache=False)

                    for peer_data in peers:
                        try:
                            # Mevcut peer'ları kontrol et
                            public_key = peer_data.get('public_key')
                            
                            # Public key ile mevcut peer'ı ara
                            existing_peer = None
                            for ep in existing_peers_list:
                                ep_public_key = ep.get('public-key') or ep.get('public_key')
                                if ep_public_key and str(ep_public_key).strip() == str(public_key).strip():
                                    existing_peer = ep
                                    break

                            if existing_peer and not config.overwrite_existing:
                                logger.info(f"⏭️ Peer zaten mevcut, atlanıyor: {peer_data.get('comment')}")
                                results["peers_skipped"] += 1
                                continue

                            # Peer parametrelerini hazırla
                            peer_params = {
                                'comment': peer_data.get('comment', ''),
                                'allowed-address': peer_data.get('allowed_address', ''),
                            }

                            # Opsiyonel alanlar
                            if peer_data.get('persistent_keepalive'):
                                peer_params['persistent-keepalive'] = peer_data['persistent_keepalive']
                            if peer_data.get('preshared_key'):
                                peer_params['preshared-key'] = peer_data['preshared_key']

                            if existing_peer and config.overwrite_existing:
                                # Mevcut peer'ı güncelle
                                peer_id = existing_peer.get('.id') or existing_peer.get('id')
                                await mikrotik_conn.update_wireguard_peer(
                                    peer_id=peer_id,
                                    interface=interface_name,
                                    **peer_params
                                )
                                logger.info(f"🔄 Peer güncellendi: {peer_data.get('comment')}")
                            else:
                                # Yeni peer ekle
                                await mikrotik_conn.add_wireguard_peer(
                                    interface=interface_name,
                                    public_key=public_key,
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
            username=current_user.username,
            action="restore_config",
            details=f"Konfigürasyon geri yüklendi: {results['interfaces_restored']} interface, {results['peers_restored']} peer"
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
            username=current_user.username,
            action="restore_config_error",
            details=f"Restore hatası: {str(e)}"
        )

        raise HTTPException(status_code=500, detail=str(e))


# ===== Database & Full System Backup Endpoints =====

class CreateBackupRequest(BaseModel):
    """Backup oluşturma isteği"""
    backup_type: str  # "database" veya "full"
    description: str = ""


@router.post("/backup/create")
async def create_backup(
    request: CreateBackupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Yeni backup oluşturur

    Args:
        request: Backup tipi ve açıklama
            - backup_type: "database" veya "full"
            - description: Backup açıklaması (opsiyonel)
    """
    try:
        logger.info(f"💾 Backup oluşturma: Tip={request.backup_type}, Kullanıcı={current_user.username}")

        if request.backup_type == "database":
            result = backup_service.create_database_backup(description=request.description)
        elif request.backup_type == "full":
            result = backup_service.create_full_backup(description=request.description)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Geçersiz backup tipi: {request.backup_type}. 'database' veya 'full' olmalı."
            )

        # Log kaydı
        await create_log(
            db=db,
            username=current_user.username,
            action="create_backup",
            details=f"{request.backup_type} backup oluşturuldu: {result.get('backup_name')}"
        )

        logger.info(f"✅ Backup oluşturuldu: {result.get('backup_name')}")

        return {
            "success": True,
            "message": "Backup başarıyla oluşturuldu",
            "backup": result
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Backup oluşturma hatası: {e}")

        await create_log(
            db=db,
            username=current_user.username,
            action="create_backup_error",
            details=f"Backup oluşturma hatası: {str(e)}"
        )

        raise HTTPException(status_code=500, detail=str(e))


@router.get("/backup/list")
async def list_backups(
    backup_type: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Mevcut backup'ları listeler

    Args:
        backup_type: Backup tipi filtresi ("database", "full", veya None=hepsi)
    """
    try:
        backups = backup_service.list_backups(backup_type=backup_type)

        return {
            "success": True,
            "backups": backups,
            "count": len(backups)
        }

    except Exception as e:
        logger.error(f"❌ Backup listesi hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/backup/stats")
async def get_backup_stats(
    current_user: User = Depends(get_current_user)
):
    """Backup istatistiklerini döner"""
    try:
        stats = backup_service.get_backup_stats()

        return {
            "success": True,
            "stats": stats
        }

    except Exception as e:
        logger.error(f"❌ Backup stats hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class RestoreBackupRequest(BaseModel):
    """Backup geri yükleme isteği"""
    backup_name: str
    backup_type: str  # "database" veya "full"
    create_backup_before: bool = True


@router.post("/backup/restore")
async def restore_backup(
    request: RestoreBackupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Backup'tan geri yükler

    Args:
        request: Geri yükleme parametreleri
            - backup_name: Geri yüklenecek backup adı
            - backup_type: "database" veya "full"
            - create_backup_before: Geri yüklemeden önce mevcut durumu yedekle
    """
    try:
        logger.info(f"♻️ Backup restore: {request.backup_name}, Kullanıcı={current_user.username}")

        if request.backup_type == "database":
            result = backup_service.restore_database_backup(
                backup_name=request.backup_name,
                create_backup_before=request.create_backup_before
            )
        elif request.backup_type == "full":
            result = backup_service.restore_full_backup(
                backup_name=request.backup_name,
                create_backup_before=request.create_backup_before
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Geçersiz backup tipi: {request.backup_type}"
            )

        # Log kaydı
        await create_log(
            db=db,
            username=current_user.username,
            action="restore_backup",
            details=f"Backup geri yüklendi: {request.backup_name}"
        )

        logger.info(f"✅ Backup geri yüklendi: {request.backup_name}")

        return {
            "success": True,
            "message": "Backup başarıyla geri yüklendi",
            "result": result
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Backup restore hatası: {e}")

        await create_log(
            db=db,
            username=current_user.username,
            action="restore_backup_error",
            details=f"Backup restore hatası: {str(e)}"
        )

        raise HTTPException(status_code=500, detail=str(e))


class DeleteBackupRequest(BaseModel):
    """Backup silme isteği"""
    backup_name: str


@router.delete("/backup/delete")
async def delete_backup(
    request: DeleteBackupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Backup'ı siler

    Args:
        request: Silinecek backup adı
    """
    try:
        logger.info(f"🗑️ Backup silme: {request.backup_name}, Kullanıcı={current_user.username}")

        result = backup_service.delete_backup(backup_name=request.backup_name)

        # Log kaydı
        await create_log(
            db=db,
            username=current_user.username,
            action="delete_backup",
            details=f"Backup silindi: {request.backup_name}"
        )

        logger.info(f"✅ Backup silindi: {request.backup_name}")

        return {
            "success": True,
            "message": "Backup başarıyla silindi",
            "result": result
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Backup silme hatası: {e}")

        await create_log(
            db=db,
            username=current_user.username,
            action="delete_backup_error",
            details=f"Backup silme hatası: {str(e)}"
        )

        raise HTTPException(status_code=500, detail=str(e))


@router.post("/backup/upload")
async def upload_backup(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Backup dosyasını yükle
    Desteklenen formatlar: .json, .zip
    
    Args:
        file: Yüklenecek backup dosyası
    """
    try:
        logger.info(f"📤 Backup yükleme: {file.filename}, Kullanıcı={current_user.username}")
        
        # Dosya uzantısı kontrolü
        allowed_extensions = ['.json', '.zip']
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Desteklenmeyen dosya formatı. İzin verilen: {', '.join(allowed_extensions)}"
            )
        
        # Dosya boyutu kontrolü (500MB)
        max_size = 500 * 1024 * 1024  # 500MB
        file_content = await file.read()
        
        if len(file_content) > max_size:
            raise HTTPException(status_code=400, detail="Dosya çok büyük (maksimum 500MB)")
        
        # Backup dizinini kontrol et/oluştur
        backup_dir = os.path.join(os.path.dirname(__file__), "../..", "backups")
        os.makedirs(backup_dir, exist_ok=True)
        
        # Benzersiz dosya adı oluştur (timestamp ile)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = os.path.splitext(file.filename)[0]
        new_filename = f"{base_name}_{timestamp}{file_ext}"
        file_path = os.path.join(backup_dir, new_filename)
        
        # Dosyayı kaydet
        with open(file_path, 'wb') as f:
            f.write(file_content)
        
        logger.info(f"✅ Backup dosyası kaydedildi: {new_filename} ({len(file_content)} bytes)")
        
        # Log kaydı oluştur
        await create_log(
            db=db,
            username=current_user.username,
            action="upload_backup",
            details=f"Backup yüklendi: {new_filename} ({len(file_content)} bytes)"
        )
        
        return {
            "success": True,
            "message": "Backup başarıyla yüklendi",
            "filename": new_filename,
            "size": len(file_content),
            "path": os.path.join("backups", new_filename)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Backup yükleme hatası: {e}")
        import traceback
        logger.error(traceback.format_exc())
        
        await create_log(
            db=db,
            username=current_user.username,
            action="upload_backup_error",
            details=f"Backup yükleme hatası: {str(e)}"
        )
        
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/backup/download/{backup_name:path}")
async def download_backup(
    backup_name: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Backup dosyasını indir
    
    Args:
        backup_name: İndirilecek backup dosya/klasör adı
    """
    try:
        logger.info(f"📥 Backup indirme: {backup_name}, Kullanıcı={current_user.username}")
        
        backup_dir = os.path.join(os.path.dirname(__file__), "../..", "backups")
        backup_path = os.path.join(backup_dir, backup_name)
        
        # Güvenlik kontrolü - path traversal önleme
        if not os.path.abspath(backup_path).startswith(os.path.abspath(backup_dir)):
            raise HTTPException(status_code=403, detail="Geçersiz backup yolu")
        
        # Dosya mı klasör mü kontrol et
        if os.path.isfile(backup_path):
            # Tek dosya ise direkt indir
            await create_log(
                db=db,
                username=current_user.username,
                action="download_backup",
                details=f"Backup indirildi: {backup_name}"
            )
            
            return FileResponse(
                path=backup_path,
                filename=backup_name,
                media_type='application/octet-stream'
            )
            
        elif os.path.isdir(backup_path):
            # Klasör ise zip olarak indir
            # Geçici zip dosyası oluştur
            temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
            temp_zip.close()
            
            try:
                # Klasörü zip'le
                with zipfile.ZipFile(temp_zip.name, 'w', zipfile.ZIP_DEFLATED) as zipf:
                    for root, dirs, files in os.walk(backup_path):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arcname = os.path.relpath(file_path, backup_path)
                            zipf.write(file_path, arcname)
                
                await create_log(
                    db=db,
                    username=current_user.username,
                    action="download_backup",
                    details=f"Backup indirildi (zip): {backup_name}"
                )
                
                # Zip dosyasını döndür
                zip_filename = f"{backup_name}.zip"
                
                # FileResponse oluştur
                response = FileResponse(
                    path=temp_zip.name,
                    filename=zip_filename,
                    media_type='application/zip'
                )
                
                return response
                
            except Exception as zip_error:
                # Hata durumunda geçici dosyayı temizle
                if os.path.exists(temp_zip.name):
                    os.unlink(temp_zip.name)
                raise zip_error
        else:
            raise HTTPException(status_code=404, detail="Backup bulunamadı")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Backup indirme hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== SCHEDULED BACKUP ENDPOINTS ==========

@router.post("/backup/schedule/run")
async def run_scheduled_backup(
    backup_type: str = "database",
    send_notification: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Manuel olarak zamanlanmış backup çalıştır
    
    Args:
        backup_type: "database" veya "full"
        send_notification: Telegram bildirimi gönder
    
    Returns:
        Backup sonucu
    """
    try:
        logger.info(f"🕒 Manuel zamanlanmış backup: {backup_type}, Kullanıcı: {current_user.username}")
        
        result = await BackupSchedulerService.create_scheduled_backup(
            db=db,
            backup_type=backup_type,
            description=f"Manual scheduled {backup_type} backup by {current_user.username}",
            send_notification=send_notification
        )
        
        return result
    
    except Exception as e:
        logger.error(f"❌ Zamanlanmış backup hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/backup/retention/apply")
async def apply_retention_policy(
    backup_type: str = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retention policy uygula - eski backup'ları temizle
    
    Args:
        backup_type: Sadece belirli bir tip için policy uygula (None ise tümü)
    
    Returns:
        Temizleme sonucu
    """
    try:
        logger.info(f"🗑️ Retention policy: {backup_type or 'all'}, Kullanıcı: {current_user.username}")
        
        result = await BackupSchedulerService.apply_retention_policy(
            backup_type=backup_type
        )
        
        return result
    
    except Exception as e:
        logger.error(f"❌ Retention policy hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/backup/schedule/next")
async def get_next_scheduled_backups(
    current_user: User = Depends(get_current_user)
):
    """
    Sonraki zamanlanmış backup'ların bilgisini döndür
    
    Returns:
        Sonraki backup zamanları
    """
    try:
        result = await BackupSchedulerService.get_next_scheduled_backups()
        return result
    
    except Exception as e:
        logger.error(f"❌ Schedule bilgisi alınamadı: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/backup/schedule/settings")
async def get_backup_schedule_settings(
    current_user: User = Depends(get_current_user)
):
    """
    Backup zamanlama ve retention ayarlarını döndür
    
    Returns:
        Schedule ve retention ayarları
    """
    try:
        return {
            "success": True,
            "retention_policy": BackupSchedulerService.RETENTION_POLICY,
            "schedule": {
                "daily_database": {
                    "enabled": True,
                    "time": "02:00",
                    "description": "Günlük database backup (her gün 02:00)"
                },
                "weekly_full": {
                    "enabled": True,
                    "time": "03:00",
                    "day": "Sunday",
                    "description": "Haftalık full backup (her Pazar 03:00)"
                }
            }
        }
    
    except Exception as e:
        logger.error(f"❌ Schedule ayarları alınamadı: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== ŞİFRELEME ENDPOINTLERİ ==========

class EncryptBackupRequest(BaseModel):
    """Backup şifreleme isteği"""
    backup_filename: str
    password: str


class DecryptBackupRequest(BaseModel):
    """Backup şifre çözme isteği"""
    encrypted_filename: str
    password: str


@router.post("/backup/encrypt")
async def encrypt_backup(
    request: EncryptBackupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mevcut backup dosyasını şifreler
    
    Args:
        backup_filename: Şifrelenecek backup dosyası adı
        password: Şifreleme parolası
    
    Returns:
        Şifreli dosya bilgileri
    """
    try:
        # Backup dosyası kontrolü
        backup_file = os.path.join(backup_service.backup_dir, request.backup_filename)
        if not os.path.exists(backup_file):
            raise HTTPException(
                status_code=404,
                detail=f"Backup dosyası bulunamadı: {request.backup_filename}"
            )
        
        # Şifreli dosya adı (.encrypted uzantısı)
        encrypted_filename = f"{request.backup_filename}.encrypted"
        encrypted_file = os.path.join(backup_service.backup_dir, encrypted_filename)
        
        # Şifrele
        logger.info(f"🔐 Backup şifreleniyor: {request.backup_filename}")
        result = BackupEncryptionService.encrypt_file(
            backup_file,
            encrypted_file,
            request.password
        )
        
        # Activity log
        await create_log(
            db,
            current_user.username,
            "backup_encrypted",
            details=f"Backup şifrelendi: {request.backup_filename} → {encrypted_filename}",
            ip_address="127.0.0.1"
        )
        
        logger.info(f"✅ Backup şifrelendi: {encrypted_filename}")
        
        return {
            "success": True,
            "message": "Backup başarıyla şifrelendi",
            "original_file": request.backup_filename,
            "encrypted_file": encrypted_filename,
            "original_size": result["original_size"],
            "encrypted_size": result["encrypted_size"],
            "algorithm": result["algorithm"]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Backup şifreleme hatası: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Şifreleme başarısız: {str(e)}")


@router.post("/backup/decrypt")
async def decrypt_backup(
    request: DecryptBackupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Şifreli backup dosyasını çözer
    
    Args:
        encrypted_filename: Şifreli dosya adı
        password: Şifre çözme parolası
    
    Returns:
        Çözülmüş dosya bilgileri
    """
    try:
        # Şifreli dosya kontrolü
        encrypted_file = os.path.join(backup_service.backup_dir, request.encrypted_filename)
        if not os.path.exists(encrypted_file):
            raise HTTPException(
                status_code=404,
                detail=f"Şifreli dosya bulunamadı: {request.encrypted_filename}"
            )
        
        # Çözülmüş dosya adı (.encrypted uzantısını kaldır)
        decrypted_filename = request.encrypted_filename.replace('.encrypted', '')
        decrypted_file = os.path.join(backup_service.backup_dir, decrypted_filename)
        
        # Şifre çöz
        logger.info(f"🔓 Backup şifresi çözülüyor: {request.encrypted_filename}")
        result = BackupEncryptionService.decrypt_file(
            encrypted_file,
            decrypted_file,
            request.password
        )
        
        # Activity log
        await create_log(
            db,
            current_user.username,
            "backup_decrypted",
            details=f"Backup şifresi çözüldü: {request.encrypted_filename} → {decrypted_filename}",
            ip_address="127.0.0.1"
        )
        
        logger.info(f"✅ Backup şifresi çözüldü: {decrypted_filename}")
        
        return {
            "success": True,
            "message": "Backup şifresi başarıyla çözüldü",
            "encrypted_file": request.encrypted_filename,
            "decrypted_file": decrypted_filename,
            "encrypted_size": result["encrypted_size"],
            "decrypted_size": result["decrypted_size"]
        }
    
    except HTTPException:
        raise
    except ValueError as e:
        # Yanlış şifre veya bozuk dosya
        logger.error(f"❌ Şifre çözme hatası: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Backup şifre çözme hatası: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Şifre çözme başarısız: {str(e)}")


@router.post("/backup/create-encrypted")
async def create_encrypted_backup(
    backup_type: str = "database",
    password: str = None,
    send_notification: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Direkt olarak şifreli backup oluşturur (backup al → şifrele → orijinali sil)
    
    Args:
        backup_type: "database" veya "full"
        password: Şifreleme parolası
        send_notification: Telegram bildirimi gönderilsin mi?
    
    Returns:
        Şifreli backup bilgileri
    """
    try:
        # Validasyon
        if not password or len(password.strip()) < 8:
            raise HTTPException(
                status_code=400,
                detail="Şifre en az 8 karakter olmalıdır"
            )
        
        # Önce normal backup al
        logger.info(f"🔐 Şifreli backup oluşturuluyor: {backup_type}")
        
        if backup_type == "database":
            backup_result = await backup_service.backup_database()
        elif backup_type == "full":
            backup_result = await backup_service.backup_full()
        else:
            raise HTTPException(status_code=400, detail="Geçersiz backup tipi")
        
        if not backup_result["success"]:
            raise Exception("Backup oluşturulamadı")
        
        backup_filename = os.path.basename(backup_result["backup_file"])
        
        # Backup'ı şifrele
        encrypted_filename = f"{backup_filename}.encrypted"
        encrypted_file = os.path.join(backup_service.backup_dir, encrypted_filename)
        
        encrypt_result = BackupEncryptionService.encrypt_file(
            backup_result["backup_file"],
            encrypted_file,
            password
        )
        
        # Orijinal backup'ı sil (şifreli versiyonu kullanacağız)
        try:
            os.remove(backup_result["backup_file"])
            logger.info(f"🗑️ Orijinal backup silindi: {backup_filename}")
        except Exception as remove_error:
            logger.warning(f"⚠️ Orijinal backup silinemedi: {remove_error}")
        
        # Activity log
        await create_log(
            db,
            current_user.username,
            "encrypted_backup_created",
            details=f"Şifreli backup oluşturuldu: {encrypted_filename} ({backup_type})",
            ip_address="127.0.0.1"
        )
        
        # Telegram bildirimi (isteğe bağlı)
        if send_notification:
            try:
                TelegramService = get_telegram_service()
                await TelegramService.send_backup_completed(
                    db=db,
                    backup_type=backup_type,
                    backup_file=encrypted_filename,
                    file_size=encrypt_result["encrypted_size"],
                    is_encrypted=True
                )
            except Exception as telegram_error:
                logger.warning(f"⚠️ Telegram bildirimi gönderilemedi: {telegram_error}")
        
        logger.info(f"✅ Şifreli backup oluşturuldu: {encrypted_filename}")
        
        return {
            "success": True,
            "message": "Şifreli backup başarıyla oluşturuldu",
            "backup_type": backup_type,
            "encrypted_file": encrypted_filename,
            "encrypted_size": encrypt_result["encrypted_size"],
            "original_size": encrypt_result["original_size"],
            "algorithm": encrypt_result["algorithm"]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Şifreli backup oluşturma hatası: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Şifreli backup oluşturulamadı: {str(e)}")


@router.post("/backup/verify-password")
async def verify_backup_password(
    encrypted_filename: str,
    password: str,
    current_user: User = Depends(get_current_user)
):
    """
    Şifreli backup için şifre doğrulaması yapar
    
    Args:
        encrypted_filename: Şifreli dosya adı
        password: Test edilecek şifre
    
    Returns:
        Şifre doğru mu?
    """
    try:
        encrypted_file = os.path.join(backup_service.backup_dir, encrypted_filename)
        
        if not os.path.exists(encrypted_file):
            raise HTTPException(
                status_code=404,
                detail=f"Şifreli dosya bulunamadı: {encrypted_filename}"
            )
        
        # Şifreyi doğrula (test decryption)
        is_valid = BackupEncryptionService.verify_password(encrypted_file, password)
        
        return {
            "success": True,
            "is_valid": is_valid,
            "message": "Şifre doğru ✅" if is_valid else "Şifre yanlış ❌"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Şifre doğrulama hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/backup/encrypted-info/{filename}")
async def get_encrypted_backup_info(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """
    Şifreli backup dosyası hakkında bilgi döner (şifre çözmeden)
    
    Args:
        filename: Şifreli dosya adı
    
    Returns:
        Dosya bilgileri
    """
    try:
        encrypted_file = os.path.join(backup_service.backup_dir, filename)
        
        if not os.path.exists(encrypted_file):
            raise HTTPException(
                status_code=404,
                detail=f"Dosya bulunamadı: {filename}"
            )
        
        info = BackupEncryptionService.get_file_info(encrypted_file)
        
        return {
            "success": True,
            "filename": filename,
            **info
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Dosya bilgisi alınamadı: {e}")
        raise HTTPException(status_code=500, detail=str(e))
