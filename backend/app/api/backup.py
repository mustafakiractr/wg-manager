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
            "timestamp": utcnow().isoformat(),
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
