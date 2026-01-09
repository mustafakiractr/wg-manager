"""
Sistem yönetimi API endpoint'leri
Sistem bilgisi, timezone ayarı, update/upgrade işlemleri
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from app.security.auth import get_current_user
from app.models.user import User
import subprocess
import psutil
import platform
import logging
import os
import shutil
from datetime import datetime, timezone, timedelta

router = APIRouter()
logger = logging.getLogger(__name__)

TIMEDATECTL_CANDIDATES = [
    shutil.which("timedatectl"),
    "/usr/bin/timedatectl",
    "/bin/timedatectl",
]
TIMEDATECTL_PATH = next(
    (path for path in TIMEDATECTL_CANDIDATES if path and os.path.exists(path)),
    None,
)
ZONEINFO_BASE_PATH = "/usr/share/zoneinfo"


def run_timedatectl(args: list[str], timeout: int = 5) -> subprocess.CompletedProcess:
    """timedatectl komutunu çalıştırır, bulunamazsa FileNotFoundError fırlatır"""
    if not TIMEDATECTL_PATH:
        raise FileNotFoundError("timedatectl komutu bulunamadı")
    return subprocess.run(
        [TIMEDATECTL_PATH, *args],
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def read_timezone_from_system() -> str:
    """Sistemdeki mevcut timezone bilgisini mümkün olan tüm kaynaklardan okur"""
    timezone_value = None

    # timedatectl çıktısı
    try:
        result = run_timedatectl(['show', '--property=Timezone', '--value'])
        if result.returncode == 0:
            timezone_value = result.stdout.strip() or None
    except FileNotFoundError:
        logger.debug("timedatectl bulunamadı, /etc dosyaları kullanılacak")
    except Exception as exc:
        logger.warning(f"timedatectl ile timezone okunamadı: {exc}")

    # /etc/timezone dosyası
    if not timezone_value and os.path.exists("/etc/timezone"):
        try:
            with open("/etc/timezone", "r", encoding="utf-8") as tz_file:
                file_value = tz_file.read().strip()
                if file_value:
                    timezone_value = file_value
        except Exception as exc:
            logger.debug(f"/etc/timezone okunamadı: {exc}")

    # /etc/localtime symlink'i
    if not timezone_value and os.path.exists("/etc/localtime"):
        try:
            if os.path.islink("/etc/localtime"):
                link_target = os.readlink("/etc/localtime")
                if "/zoneinfo/" in link_target:
                    timezone_value = link_target.split("/zoneinfo/")[-1]
                else:
                    timezone_value = os.path.basename(link_target)
        except Exception as exc:
            logger.debug(f"/etc/localtime symlink okunamadı: {exc}")

    return timezone_value or "Unknown"


def apply_timezone_symlink(timezone_name: str) -> None:
    """timedatectl başarısız olduğunda /etc/localtime symlink'ini günceller"""
    if ".." in timezone_name or not timezone_name.strip():
        raise ValueError("Geçersiz timezone formatı")

    zoneinfo_path = os.path.join(ZONEINFO_BASE_PATH, timezone_name)
    if not os.path.exists(zoneinfo_path):
        raise FileNotFoundError(f"Timezone dosyası bulunamadı: {zoneinfo_path}")

    # /etc/localtime dosyasını güncelle
    try:
        if os.path.exists("/etc/localtime"):
            os.unlink("/etc/localtime")
        os.symlink(zoneinfo_path, "/etc/localtime")
    except Exception as exc:
        raise RuntimeError(f"/etc/localtime güncellenemedi: {exc}") from exc

    # Debian tabanlı sistemlerde /etc/timezone dosyasını da güncelle
    try:
        with open("/etc/timezone", "w", encoding="utf-8") as tz_file:
            tz_file.write(timezone_name + "\n")
    except Exception as exc:
        logger.debug(f"/etc/timezone yazılamadı: {exc}")


class TimezoneUpdateRequest(BaseModel):
    """Timezone güncelleme isteği"""
    timezone: str  # Örn: "Europe/Istanbul", "UTC", "Asia/Tokyo"


@router.get("/info")
async def get_system_info(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Sistem bilgilerini getirir
    CPU, RAM, Disk, işletim sistemi bilgileri
    """
    try:
        # CPU bilgisi
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()
        
        # RAM bilgisi
        memory = psutil.virtual_memory()
        memory_total_gb = memory.total / (1024**3)
        memory_used_gb = memory.used / (1024**3)
        memory_percent = memory.percent
        
        # Disk bilgisi
        disk = psutil.disk_usage('/')
        disk_total_gb = disk.total / (1024**3)
        disk_used_gb = disk.used / (1024**3)
        disk_percent = disk.percent
        
        # İşletim sistemi bilgisi
        os_info = platform.uname()
        
        # Uptime
        boot_time = datetime.fromtimestamp(psutil.boot_time())
        uptime_seconds = (datetime.now() - boot_time).total_seconds()
        uptime_days = int(uptime_seconds // 86400)
        uptime_hours = int((uptime_seconds % 86400) // 3600)
        uptime_minutes = int((uptime_seconds % 3600) // 60)
        
        # Timezone bilgisi
        current_timezone = read_timezone_from_system()
        
        # Sistem saati (UTC)
        system_time_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        
        # Türkiye saati (UTC+3)
        turkey_tz = timezone(timedelta(hours=3))
        system_time_turkey = datetime.now(turkey_tz).strftime("%Y-%m-%d %H:%M:%S")
        
        return {
            "success": True,
            "data": {
                "cpu": {
                    "percent": cpu_percent,
                    "count": cpu_count
                },
                "memory": {
                    "total_gb": round(memory_total_gb, 2),
                    "used_gb": round(memory_used_gb, 2),
                    "percent": memory_percent
                },
                "disk": {
                    "total_gb": round(disk_total_gb, 2),
                    "used_gb": round(disk_used_gb, 2),
                    "percent": disk_percent
                },
                "os": {
                    "system": os_info.system,
                    "release": os_info.release,
                    "version": os_info.version,
                    "machine": os_info.machine
                },
                "uptime": {
                    "days": uptime_days,
                    "hours": uptime_hours,
                    "minutes": uptime_minutes,
                    "total_seconds": int(uptime_seconds)
                },
                "timezone": {
                    "current": current_timezone,
                    "system_time_utc": system_time_utc,
                    "system_time_turkey": system_time_turkey
                }
            }
        }
    except Exception as e:
        logger.error(f"Sistem bilgisi alınamadı: {e}")
        raise HTTPException(status_code=500, detail=f"Sistem bilgisi alınamadı: {str(e)}")


@router.post("/timezone")
async def update_timezone(
    request: TimezoneUpdateRequest,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Sistem timezone'unu günceller
    
    Args:
        request: Timezone güncelleme isteği (örn: Europe/Istanbul)
    """
    try:
        # Admin kontrolü
        if not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Bu işlem için admin yetkisi gerekli")
        
        # Timezone'u ayarla
        try:
            timedatectl_success = False
            timedatectl_error: Optional[str] = None

            try:
                result = run_timedatectl(['set-timezone', request.timezone], timeout=10)
                if result.returncode == 0:
                    timedatectl_success = True
                else:
                    timedatectl_error = result.stderr.strip() or f"timedatectl hata kodu: {result.returncode}"
            except FileNotFoundError as exc:
                timedatectl_error = str(exc)
            except subprocess.TimeoutExpired:
                raise HTTPException(status_code=500, detail="Timezone güncelleme zaman aşımına uğradı")
            except Exception as exc:
                timedatectl_error = str(exc)

            if timedatectl_success:
                logger.info(f"Timezone timedatectl ile güncellendi: {request.timezone} (Kullanıcı: {current_user.username})")
            else:
                logger.warning(
                    "timedatectl set-timezone kullanılamadı (%s). Manuel yöntem devreye alınacak.",
                    timedatectl_error,
                )
                apply_timezone_symlink(request.timezone)
                logger.info(f"Timezone manuel symlink yöntemiyle güncellendi: {request.timezone}")

            return {
                "success": True,
                "message": f"Timezone başarıyla güncellendi: {request.timezone}",
                "timezone": request.timezone
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Timezone güncellenemedi: {str(e)}")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Timezone güncelleme hatası: {e}")
        raise HTTPException(status_code=500, detail=f"Timezone güncellenemedi: {str(e)}")


@router.get("/timezones")
async def get_available_timezones(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Tüm kullanılabilir timezone listesini döner (timedatectl list-timezones kullanarak)
    pytz kullanmadan, doğrudan sistem komutlarıyla offset hesaplanır
    """
    try:
        # timedatectl list-timezones komutunu çalıştır
        all_timezones = []
        try:
            result = run_timedatectl(['list-timezones'], timeout=5)
            if result.returncode == 0:
                # Komut çıktısını satırlara böl
                all_timezones = [tz.strip() for tz in result.stdout.split('\n') if tz.strip()]
                logger.info(f"timedatectl'den {len(all_timezones)} timezone alındı")
            else:
                logger.error(f"timedatectl list-timezones başarısız: {result.stderr}")
                raise HTTPException(status_code=500, detail="Timezone listesi alınamadı")
        except FileNotFoundError as exc:
            logger.error(f"timedatectl bulunamadı: {exc}")
            raise HTTPException(status_code=500, detail="timedatectl komutu bulunamadı")
        except Exception as exc:
            logger.error(f"timedatectl list-timezones hatası: {exc}")
            raise HTTPException(status_code=500, detail=f"Timezone listesi alınamadı: {str(exc)}")

        if not all_timezones:
            raise HTTPException(status_code=500, detail="Timezone listesi boş")
             
        # Timezone listesini oluştur (offset bilgisiyle)
        # Her timezone için 'date' komutuyla offset hesapla
        timezones = []
        
        for tz_name in sorted(all_timezones):
            try:
                # TZ ortam değişkeniyle date komutunu çalıştır
                # %z: +0300 formatında offset verir
                result = subprocess.run(
                    ['date', '+%z'],
                    env={'TZ': tz_name},
                    capture_output=True,
                    text=True,
                    timeout=1
                )
                
                if result.returncode == 0 and result.stdout.strip():
                    offset_raw = result.stdout.strip()  # +0300, -0500 gibi
                    
                    # Offset'i parse et
                    if len(offset_raw) == 5:  # +0300 formatı
                        sign = offset_raw[0]
                        hours = offset_raw[1:3]
                        minutes = offset_raw[3:5]
                        offset_str = f"{sign}{hours}:{minutes}"
                    else:
                        offset_str = "+00:00"
                else:
                    offset_str = "+00:00"
                
                # Bölge ve şehir ismini ayır
                parts = tz_name.split('/')
                if len(parts) > 1:
                    region = parts[0]
                    city = parts[-1].replace('_', ' ')
                    label = f"{city} ({tz_name}) [UTC{offset_str}]"
                else:
                    label = f"{tz_name} [UTC{offset_str}]"
                
                timezones.append({
                    "value": tz_name,
                    "label": label,
                    "offset": offset_str,
                    "region": parts[0] if len(parts) > 1 else "Other"
                })
            except Exception as e:
                # Geçersiz timezone'ları atla ama logla
                logger.debug(f"Timezone atlandı: {tz_name} - {e}")
                continue
        
        return {
            "success": True,
            "data": timezones,
            "total": len(timezones)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Timezone listesi alınamadı: {e}")
        raise HTTPException(status_code=500, detail=f"Timezone listesi alınamadı: {str(e)}")


@router.post("/update")
async def system_update(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Sistem paket güncellemelerini kontrol eder (apt update)
    """
    try:
        # Admin kontrolü
        if not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Bu işlem için admin yetkisi gerekli")
        
        # apt update komutunu çalıştır
        result = subprocess.run(
            ['sudo', 'apt', 'update'],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode != 0:
            raise Exception(f"Update başarısız: {result.stderr}")
        
        logger.info(f"Sistem güncellemeleri kontrol edildi (Kullanıcı: {current_user.username})")
        
        return {
            "success": True,
            "message": "Paket listesi başarıyla güncellendi",
            "output": result.stdout
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Update işlemi zaman aşımına uğradı")
    except Exception as e:
        logger.error(f"System update hatası: {e}")
        raise HTTPException(status_code=500, detail=f"Update başarısız: {str(e)}")


@router.post("/upgrade")
async def system_upgrade(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Sistem paket yükseltmelerini yapar (apt upgrade -y)
    UYARI: Bu işlem uzun sürebilir ve sistemi etkileyebilir
    """
    try:
        # Admin kontrolü
        if not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Bu işlem için admin yetkisi gerekli")
        
        # apt upgrade komutunu çalıştır
        result = subprocess.run(
            ['sudo', 'apt', 'upgrade', '-y'],
            capture_output=True,
            text=True,
            timeout=300  # 5 dakika timeout
        )
        
        if result.returncode != 0:
            raise Exception(f"Upgrade başarısız: {result.stderr}")
        
        logger.info(f"Sistem paketleri yükseltildi (Kullanıcı: {current_user.username})")
        
        return {
            "success": True,
            "message": "Sistem paketleri başarıyla yükseltildi",
            "output": result.stdout
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Upgrade işlemi zaman aşımına uğradı (5 dakika)")
    except Exception as e:
        logger.error(f"System upgrade hatası: {e}")
        raise HTTPException(status_code=500, detail=f"Upgrade başarısız: {str(e)}")


@router.post("/reboot")
async def system_reboot(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Sistemi yeniden başlatır
    UYARI: Tüm servisler kapanacak
    """
    try:
        # Admin kontrolü
        if not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Bu işlem için admin yetkisi gerekli")
        
        logger.warning(f"Sistem yeniden başlatılıyor (Kullanıcı: {current_user.username})")
        
        # Reboot komutunu arka planda çalıştır (30 saniye sonra)
        subprocess.Popen(['sudo', 'shutdown', '-r', '+1'], 
                        stdout=subprocess.DEVNULL, 
                        stderr=subprocess.DEVNULL)
        
        return {
            "success": True,
            "message": "Sistem 1 dakika içinde yeniden başlatılacak"
        }
    except Exception as e:
        logger.error(f"System reboot hatası: {e}")
        raise HTTPException(status_code=500, detail=f"Reboot başarısız: {str(e)}")
