"""
Peer handshake tracking servisi
Peer'ların online/offline durumlarını ve zamanlarını takip eder
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, or_
from typing import List, Optional, Dict, Any
from app.models.peer_handshake import PeerHandshake
from datetime import datetime, timedelta, timezone
import logging

logger = logging.getLogger(__name__)


def parse_mikrotik_time(time_str: str) -> Optional[int]:
    """
    MikroTik'ten gelen zaman formatını parse eder (örn: "20s", "5m", "2h", "1d")
    
    Returns:
        Saniye cinsinden geçen süre veya None
    """
    if not time_str or time_str == '0' or time_str == '' or time_str == 'never':
        return None
    
    # Göreceli zaman formatı kontrolü (örn: "20s", "5m", "2h", "1d")
    import re
    relative_time_match = re.match(r'^(\d+)([smhd])$', time_str)
    if relative_time_match:
        value = int(relative_time_match.group(1))
        unit = relative_time_match.group(2)
        
        seconds = 0
        if unit == 's':
            seconds = value
        elif unit == 'm':
            seconds = value * 60
        elif unit == 'h':
            seconds = value * 3600
        elif unit == 'd':
            seconds = value * 86400
        else:
            return None
        
        return seconds
    
    # Timestamp formatı kontrolü
    try:
        timestamp = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
        # Türkiye saat dilimi (UTC+3) kullan
        turkey_tz = timezone(timedelta(hours=3))
        now = datetime.now(turkey_tz)
        # Timestamp'i Türkiye saat dilimine çevir
        if timestamp.tzinfo:
            timestamp = timestamp.astimezone(turkey_tz)
        else:
            timestamp = timestamp.replace(tzinfo=turkey_tz)
        diff = (now - timestamp).total_seconds()
        return int(diff) if diff > 0 else None
    except Exception:
        pass
    
    return None


def is_peer_online(last_handshake_value: Optional[str]) -> bool:
    """
    Peer'ın online olup olmadığını kontrol eder
    90 saniyeden az süre geçtiyse online kabul edilir
    
    NOT: Persistent keepalive (25s) ile handshake farklı şeylerdir:
    - Persistent keepalive: NAT'ı günceller, her 25 saniyede bir gönderilir
    - Handshake: WireGuard'ın gerçek bağlantı kontrolü, daha seyrek gelebilir
    - Handshake gecikmeleri normaldir, özellikle NAT arkasındaki client'larda
    """
    if not last_handshake_value or last_handshake_value == 'never' or last_handshake_value == '0':
        return False
    
    seconds = parse_mikrotik_time(last_handshake_value)
    if seconds is None:
        return False
    
    # 90 saniye: Persistent keepalive 25s olduğu için handshake gecikmeleri normaldir
    # 90 saniye güvenli bir değer - gerçek kopmaları yakalar ama normal gecikmeleri yanlış offline yapmaz
    return seconds < 90


async def track_peer_status(
    db: AsyncSession,
    peer_id: str,
    interface_name: str,
    peer_name: Optional[str] = None,
    public_key: Optional[str] = None,
    last_handshake_value: Optional[str] = None
) -> Optional[PeerHandshake]:
    """
    Peer durumunu takip eder ve online/offline olaylarını kaydeder
    
    Args:
        db: Veritabanı session'ı
        peer_id: MikroTik peer ID
        interface_name: Interface adı
        peer_name: Peer adı/comment
        public_key: Peer public key
        last_handshake_value: MikroTik'ten gelen son handshake değeri (örn: "20s")
    
    Returns:
        Oluşturulan veya güncellenen PeerHandshake kaydı
    """
    try:
        # Mevcut durumu kontrol et
        current_is_online = is_peer_online(last_handshake_value)
        # Türkiye saat dilimi (UTC+3) kullan
        turkey_tz = timezone(timedelta(hours=3))
        current_time = datetime.now(turkey_tz)
        
        # Zaman karşılaştırması için timezone-aware datetime kullan
        
        # Son kaydı kontrol et (event_time NULL olmayan kayıtlar)
        query = select(PeerHandshake).where(
            and_(
                PeerHandshake.peer_id == peer_id,
                PeerHandshake.interface_name == interface_name,
                PeerHandshake.event_time.isnot(None)  # event_time NULL olmayan kayıtlar
            )
        ).order_by(desc(PeerHandshake.event_time)).limit(1)
        
        result = await db.execute(query)
        last_record = result.scalar_one_or_none()
        
        # Her durum kontrolünde kayıt oluştur (durum değişikliği olsun veya olmasın)
        # Ancak çok sık kayıt oluşturmamak için: son kayıttan 30 saniye geçmişse yeni kayıt oluştur
        should_create_new = False
        
        if not last_record:
            # İlk kayıt - mutlaka oluştur
            should_create_new = True
            logger.info(f"İlk peer durum kaydı oluşturuluyor: {peer_id} ({interface_name}) - {'online' if current_is_online else 'offline'}")
        elif last_record.is_online != current_is_online:
            # Durum değişti - mutlaka yeni kayıt oluştur
            # Ancak gerçek bir durum değişikliği mi kontrol et
            # Sadece handshake gecikmesi değil, gerçek bir kopma/bağlanma olmalı
            
            # Gerçek durum değişikliği kontrolü:
            # - Online'dan offline'a geçiş: handshake >= 90 saniye olmalı VE önceki kayıt online olmalı
            #   (Persistent keepalive 25s olduğu için handshake gecikmeleri normaldir, 90s güvenli bir değer)
            # - Offline'dan online'a geçiş: handshake < 90 saniye olmalı VE önceki kayıt offline olmalı
            
            is_real_status_change = False
            
            if not current_is_online and last_record.is_online:
                # Online'dan offline'a geçiş - gerçek kopma mı?
                if last_handshake_value:
                    handshake_seconds = parse_mikrotik_time(last_handshake_value)
                    # 90 saniye: Persistent keepalive ile handshake farklı şeylerdir
                    # Handshake gecikmeleri normaldir, sadece gerçek kopmaları yakalamalıyız
                    if handshake_seconds is not None and handshake_seconds >= 90:
                        # Handshake 90 saniye veya daha fazla - gerçek kopma
                        is_real_status_change = True
                else:
                    # Handshake değeri yok - gerçek kopma
                    is_real_status_change = True
            elif current_is_online and not last_record.is_online:
                # Offline'dan online'a geçiş - gerçek bağlanma mı?
                if last_handshake_value:
                    handshake_seconds = parse_mikrotik_time(last_handshake_value)
                    if handshake_seconds is not None and handshake_seconds < 90:
                        # Handshake 90 saniyeden az - gerçek bağlanma
                        is_real_status_change = True
            
            if is_real_status_change:
                should_create_new = True
                logger.info(f"Peer durum değişikliği tespit edildi: {peer_id} ({interface_name}) - {last_record.event_type} -> {'online' if current_is_online else 'offline'}")
            else:
                # Gerçek durum değişikliği değil, sadece handshake gecikmesi
                # Önceki durumu koru ve kaydı güncelle
                turkey_tz = timezone(timedelta(hours=3))
                current_time_turkey = datetime.now(turkey_tz)
                
                last_record.last_handshake_value = last_handshake_value
                last_record.peer_name = peer_name or last_record.peer_name
                last_record.public_key = public_key or last_record.public_key
                last_record.last_updated = current_time_turkey
                # Durumu değiştirme - önceki durumu koru
                await db.commit()
                await db.refresh(last_record)
                logger.debug(f"Peer durum güncellendi (handshake gecikmesi, durum değişmedi): {peer_id} ({interface_name})")
                return last_record
        elif last_record.event_time:
            # Durum aynı - sadece kaydı güncelle, yeni kayıt oluşturma
            # Periyodik kayıt oluşturmayı kaldırdık - sadece gerçek durum değişikliklerinde kayıt oluştur
            turkey_tz = timezone(timedelta(hours=3))
            current_time_turkey = datetime.now(turkey_tz)
            
            last_record.last_handshake_value = last_handshake_value
            last_record.peer_name = peer_name or last_record.peer_name
            last_record.public_key = public_key or last_record.public_key
            last_record.last_updated = current_time_turkey
            await db.commit()
            await db.refresh(last_record)
            logger.debug(f"Peer durum güncellendi (durum aynı): {peer_id} ({interface_name})")
            return last_record
        
        if should_create_new:
            # Yeni kayıt oluştur
            # Türkiye saat dilimi (UTC+3) kullan
            turkey_tz = timezone(timedelta(hours=3))
            current_time_turkey = datetime.now(turkey_tz)
            
            new_record = PeerHandshake(
                peer_id=peer_id,
                interface_name=interface_name,
                peer_name=peer_name,
                public_key=public_key,
                handshake_count=0,  # Eski sütun için default değer
                is_online=current_is_online,
                event_time=current_time_turkey,  # Türkiye saat dilimi ile kaydet
                last_handshake_value=last_handshake_value,
                event_type='online' if current_is_online else 'offline',
                first_seen=current_time_turkey,  # İlk görülme zamanı
                last_updated=current_time_turkey  # Son güncelleme zamanı
            )
            db.add(new_record)
            await db.commit()
            await db.refresh(new_record)
            logger.info(f"Peer durum kaydı oluşturuldu: {peer_id} ({interface_name}) - {new_record.event_type} - {new_record.event_time}")
            return new_record
        
        return None
        
    except Exception as e:
        logger.error(f"Peer durum tracking hatası: {e}")
        import traceback
        logger.error(traceback.format_exc())
        await db.rollback()
        raise


async def get_peer_logs(
    db: AsyncSession,
    peer_id: str,
    interface_name: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 10000
) -> List[PeerHandshake]:
    """
    Belirli bir peer'ın tüm loglarını getirir
    
    Args:
        db: Veritabanı session'ı
        peer_id: Peer ID
        interface_name: Interface adı
        start_date: Başlangıç tarihi (opsiyonel)
        end_date: Bitiş tarihi (opsiyonel)
        limit: Maksimum kayıt sayısı
    
    Returns:
        PeerHandshake kayıt listesi (tarihe göre sıralı)
    """
    query = select(PeerHandshake).where(
        and_(
            PeerHandshake.peer_id == peer_id,
            PeerHandshake.interface_name == interface_name
        )
    )
    
    # Tarih filtreleme
    if start_date:
        query = query.where(PeerHandshake.event_time >= start_date)
    if end_date:
        # Bitiş tarihine 1 gün ekle (o günün sonuna kadar)
        from datetime import timedelta
        end_date_with_time = end_date.replace(hour=23, minute=59, second=59)
        query = query.where(PeerHandshake.event_time <= end_date_with_time)
    
    query = query.order_by(desc(PeerHandshake.event_time)).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()


async def get_peer_status_summary(
    db: AsyncSession,
    peer_id: str,
    interface_name: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Peer'ın durum özetini getirir (toplam online/offline süreleri, sayıları)
    
    Args:
        db: Veritabanı session'ı
        peer_id: Peer ID
        interface_name: Interface adı
        start_date: Başlangıç tarihi (opsiyonel)
        end_date: Bitiş tarihi (opsiyonel)
    
    Returns:
        Durum özeti dictionary
    """
    # İlgili peer için tüm online/offline loglarını alıyoruz
    # NOT: get_peer_logs fonksiyonu kayıtları en yeni kayıt en başta olacak şekilde (desc) sıralı döner
    logs = await get_peer_logs(db, peer_id, interface_name, start_date, end_date, limit=100000)
    
    if not logs:
        return {
            "total_online_events": 0,
            "total_offline_events": 0,
            "first_seen": None,
            "last_seen": None,
            "current_status": "unknown",
            "total_events": 0,
            "disconnections": 0  # Offline'a geçiş sayısı (kopma)
        }
    
    # Gerçek durum değişikliklerini sayıyoruz (sadece geçiş anları)
    # DİKKAT: logs listesi en yeni kayıt başta olacak şekilde (desc) sıralı:
    #   logs[0] -> en son durum, logs[1] -> bir önceki durum, vb.
    # 
    # Kopma (disconnection): online'dan offline'a geçiş
    #   Mantık: Online olduktan sonra eğer koparsa ve 90 saniye gelmez ise offline say
    #   NOT: Persistent keepalive (25s) ile handshake farklı şeylerdir
    #   Handshake gecikmeleri normaldir, sadece gerçek kopmaları yakalamalıyız
    #   Ancak sadece GERÇEK durum değişikliklerini saymalıyız:
    #   - logs[i] offline VE logs[i+1] online olmalı (durum değişikliği)
    #   - logs[i] kaydının handshake değeri 90 saniye veya daha fazla olmalı (gerçekten offline)
    #   - logs[i+1] kaydının handshake değeri 90 saniyeden az olmalı (gerçekten online idi)
    # 
    # Yeniden bağlanma (reconnection): offline'dan online'a geçiş
    #   logs[i] online ve logs[i+1] offline ise → offline→online geçişi var
    #   Ancak sadece GERÇEK durum değişikliklerini saymalıyız
    
    disconnections = 0  # Online'dan offline'a geçişler (kopma) - gerçek durum değişiklikleri
    reconnections = 0  # Offline'dan online'a geçişler (yeniden bağlanma) - gerçek durum değişiklikleri
    
    for i in range(len(logs) - 1):
        # logs[i] = daha yeni kayıt, logs[i+1] = daha eski kayıt
        current_log = logs[i]
        previous_log = logs[i + 1]
        
        # Online'dan offline'a geçiş (kopma) kontrolü
        if not current_log.is_online and previous_log.is_online:
            # Durum değişikliği var, ama gerçek bir kopma mı kontrol et
            current_handshake_seconds = None
            previous_handshake_seconds = None
            
            # Yeni kaydın handshake değerini kontrol et
            if current_log.last_handshake_value:
                current_handshake_seconds = parse_mikrotik_time(current_log.last_handshake_value)
            
            # Önceki kaydın handshake değerini kontrol et
            if previous_log.last_handshake_value:
                previous_handshake_seconds = parse_mikrotik_time(previous_log.last_handshake_value)
            
            # Gerçek bir kopma saymak için:
            # 1. Yeni kayıt gerçekten offline olmalı (handshake >= 90 saniye veya yok)
            # 2. Önceki kayıt gerçekten online olmalı (handshake < 90 saniye)
            # NOT: Persistent keepalive 25s olduğu için handshake gecikmeleri normaldir
            is_current_really_offline = (
                current_handshake_seconds is None or 
                current_handshake_seconds >= 90
            )
            is_previous_really_online = (
                previous_handshake_seconds is not None and 
                previous_handshake_seconds < 90
            )
            
            if is_current_really_offline and is_previous_really_online:
                # Gerçek bir kopma: önceki kayıt online idi, şimdi offline
                disconnections += 1
        
        # Offline'dan online'a geçiş (yeniden bağlanma) kontrolü
        elif current_log.is_online and not previous_log.is_online:
            # Durum değişikliği var, ama gerçek bir yeniden bağlanma mı kontrol et
            current_handshake_seconds = None
            previous_handshake_seconds = None
            
            # Yeni kaydın handshake değerini kontrol et
            if current_log.last_handshake_value:
                current_handshake_seconds = parse_mikrotik_time(current_log.last_handshake_value)
            
            # Önceki kaydın handshake değerini kontrol et
            if previous_log.last_handshake_value:
                previous_handshake_seconds = parse_mikrotik_time(previous_log.last_handshake_value)
            
            # Gerçek bir yeniden bağlanma saymak için:
            # 1. Yeni kayıt gerçekten online olmalı (handshake < 90 saniye)
            # 2. Önceki kayıt gerçekten offline olmalı (handshake >= 90 saniye veya yok)
            # NOT: Persistent keepalive 25s olduğu için handshake gecikmeleri normaldir
            is_current_really_online = (
                current_handshake_seconds is not None and 
                current_handshake_seconds < 90
            )
            is_previous_really_offline = (
                previous_handshake_seconds is None or 
                previous_handshake_seconds >= 90
            )
            
            if is_current_really_online and is_previous_really_offline:
                # Gerçek bir yeniden bağlanma: önceki kayıt offline idi, şimdi online
                reconnections += 1
    
    first_seen = logs[-1].event_time if logs else None
    last_seen = logs[0].event_time if logs else None
    current_status = "online" if logs[0].is_online else "offline" if logs else "unknown"
    
    # Toplam gerçek olay sayısı = durum değişiklikleri (kopma + yeniden bağlanma)
    total_real_events = disconnections + reconnections
    
    # Mantık açıklaması:
    # - total_online_events: Sadece offline→online geçişleri (reconnections)
    #   → Online olur da offline olursa offline sayısı 1 olmalı mantığına uygun
    # - total_offline_events: Sadece online→offline geçişleri (disconnections)
    #   → Online olmadan offline sayma mantığına uygun
    # - total_events: Sadece gerçek durum değişiklikleri (kopma + yeniden bağlanma)
    #   → Periyodik kayıtlar dahil değil, sadece geçiş anları sayılır
    return {
        "total_online_events": reconnections,            # Gerçek online olay sayısı (offline→online geçişler)
        "total_offline_events": disconnections,           # Gerçek offline olay sayısı (online→offline geçişler)
        "first_seen": first_seen.isoformat() if first_seen else None,  # İlk görüldüğü zaman
        "last_seen": last_seen.isoformat() if last_seen else None,     # Son görüldüğü zaman
        "current_status": current_status,                 # Şu anki durum (online/offline/unknown)
        "total_events": total_real_events,                # Toplam gerçek olay sayısı (sadece durum değişiklikleri)
        "disconnections": disconnections                  # Kopma sayısı (offline olayları ile aynı)
    }

