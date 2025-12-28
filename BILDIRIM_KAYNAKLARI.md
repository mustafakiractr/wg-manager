# 📬 Bildirim Kaynakları - Sistem Dokümantasyonu

**Tarih**: 2025-12-25  
**Durum**: WebSocket Real-Time Aktif ✅

---

## 🔔 Şu Anda Tanımlı Bildirim Tipleri

### 1. ⚠️ Peer Bağlantısı Kesildi
**Fonksiyon**: `notify_peer_disconnected()`  
**Dosya**: `app/services/notification_service.py:179`  
**Durum**: ⏸️ Tanımlı ama aktif DEĞİL (henüz çağrılmıyor)

```python
# Kullanım:
await notify_peer_disconnected(
    db=db,
    user_id=current_user.id,
    peer_id="peer123",
    interface="wg0"
)
```

**Ne zaman kullanılmalı**:
- Peer'in son görülme zamanı > 5 dakika olduğunda
- Handshake timeout gerçekleştiğinde
- Peer silindiğinde

---

### 2. ✅ Peer Bağlandı
**Fonksiyon**: `notify_peer_connected()`  
**Dosya**: `app/services/notification_service.py:192`  
**Durum**: ⏸️ Tanımlı ama aktif DEĞİL

```python
# Kullanım:
await notify_peer_connected(
    db=db,
    user_id=current_user.id,
    peer_id="peer123",
    interface="wg0"
)
```

**Ne zaman kullanılmalı**:
- Yeni peer oluşturulduğunda
- Peer ilk kez handshake yaptığında
- Uzun süredir offline olan peer tekrar online olduğunda

---

### 3. 📊 Yüksek Trafik Kullanımı
**Fonksiyon**: `notify_high_traffic()`  
**Dosya**: `app/services/notification_service.py:205`  
**Durum**: ⏸️ Tanımlı ama aktif DEĞİL

```python
# Kullanım:
await notify_high_traffic(
    db=db,
    user_id=current_user.id,
    peer_id="peer123",
    interface="wg0",
    traffic_mb=1024.5  # 1 GB
)
```

**Ne zaman kullanılmalı**:
- Peer son 1 saatte > 500 MB kullandığında
- Günlük kota aşımında
- Anormal trafik artışı tespit edildiğinde

---

### 4. ❌ MikroTik Bağlantısı Kesildi
**Fonksiyon**: `notify_mikrotik_disconnected()`  
**Dosya**: `app/services/notification_service.py:218`  
**Durum**: ⏸️ Tanımlı ama aktif DEĞİL

```python
# Kullanım:
await notify_mikrotik_disconnected(
    db=db,
    user_id=current_user.id
)
```

**Ne zaman kullanılmalı**:
- MikroTik API bağlantı hatası
- SSH bağlantısı başarısız olduğunda
- MikroTik cihazı yanıt vermediğinde

---

## 🚀 Bildirim Eklemek İçin Adımlar

### Yöntem 1: Mevcut Fonksiyonları Aktif Hale Getirin

#### Örnek: Peer Oluşturulduğunda Bildirim

**Dosya**: `/root/wg/backend/app/api/wireguard.py`

```python
# Import ekleyin
from app.services.notification_service import notify_peer_connected

# Peer oluşturma endpoint'inde (create_peer fonksiyonu):
@router.post("/peers/{interface_name}")
async def create_peer(
    interface_name: str,
    peer_data: PeerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # ... mevcut kod ...
    
    # Peer başarıyla oluşturulduktan sonra:
    new_peer = await peer_service.create_peer(...)
    
    # ✅ BİLDİRİM EKLE
    await notify_peer_connected(
        db=db,
        user_id=current_user.id,
        peer_id=new_peer.public_key[:8],  # İlk 8 karakter
        interface=interface_name
    )
    
    return {"success": True, "peer": new_peer}
```

---

### Yöntem 2: Yeni Bildirim Tipi Oluşturun

#### Örnek: Kullanıcı Girişi Bildirimi

**1. NotificationService'e fonksiyon ekleyin**:

**Dosya**: `/root/wg/backend/app/services/notification_service.py`

```python
async def notify_user_login(db: AsyncSession, user_id: int, ip_address: str):
    """Kullanıcı giriş yaptığında bildirim oluştur"""
    return await NotificationService.create_notification(
        db=db,
        user_id=user_id,
        type="info",
        title="🔐 Yeni Giriş",
        message=f"Hesabınıza {ip_address} IP adresinden giriş yapıldı",
    )
```

**2. Login endpoint'inde çağırın**:

**Dosya**: `/root/wg/backend/app/api/auth.py`

```python
from app.services.notification_service import notify_user_login

@router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    # ... authentication logic ...
    
    # ✅ LOGIN BİLDİRİMİ
    await notify_user_login(
        db=db,
        user_id=user.id,
        ip_address=request.client.host
    )
    
    return {"access_token": token, ...}
```

---

## 📋 Önerilen Bildirim Senaryoları

### Yüksek Öncelikli (Hemen Eklenebilir):

1. **Peer İşlemleri** ✅
   - ✅ Yeni peer oluşturuldu → `notify_peer_connected()`
   - ⚠️ Peer silindi → Yeni fonksiyon: `notify_peer_deleted()`
   - 📊 Peer trafik limiti aştı → `notify_high_traffic()`

2. **Interface İşlemleri** ✅
   - 🟢 Interface başlatıldı
   - 🔴 Interface durduruldu
   - ⚙️ Interface yapılandırması değiştirildi

3. **Güvenlik Bildirimleri** 🔒
   - 🔐 Yeni giriş yapıldı
   - ⚠️ Başarısız giriş denemesi (5+ deneme)
   - 🔑 Şifre değiştirildi
   - 👤 Yeni kullanıcı oluşturuldu (adminler için)

4. **Sistem Bildirimleri** 🖥️
   - ❌ MikroTik bağlantısı kesildi → `notify_mikrotik_disconnected()`
   - ⚠️ Disk doluluk oranı > 80%
   - 🔄 Yedekleme tamamlandı
   - 📦 Sistem güncellemesi mevcut

### Orta Öncelikli:

5. **Trafik İzleme** 📊
   - Günlük trafik özeti
   - Aylık kota uyarısı
   - Anormal trafik tespit edildi

6. **Bakım Bildirimleri** 🔧
   - Planlı bakım yaklaşıyor
   - Sistem yeniden başlatılacak
   - Servis güncellemesi

---

## 🛠️ Toplu Bildirim Aktifleştirme Scripti

Tüm temel bildirimleri tek seferde aktif hale getirmek için:

```bash
# /root/wg/backend/app/api/wireguard.py dosyasını güncelleyin
cd /root/wg/backend

# Peer oluşturma endpoint'ine bildirim ekle
# Peer silme endpoint'ine bildirim ekle
# Interface başlatma/durdurma endpoint'lerine bildirim ekle
```

---

## 📊 Bildirim İstatistikleri (Aktif Olduktan Sonra)

Backend'de bildirim istatistiklerini görmek için:

```python
# Database'de bildirim sayısı
SELECT 
    user_id,
    type,
    COUNT(*) as total,
    SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END) as unread
FROM notifications
GROUP BY user_id, type;
```

---

## 🔄 Sonraki Adımlar

1. **Öncelikli**: Peer oluşturma/silme işlemlerine bildirim ekleyin
2. **Orta**: Interface başlatma/durdurma bildirimlerini aktif edin
3. **Gelecek**: Güvenlik ve sistem bildirimlerini ekleyin
4. **İsteğe Bağlı**: Kullanıcıların bildirim tercihlerini ayarlayabilmesi

---

**Hangisini eklemek istersiniz?** Kod yazayım, hazır hale getirelim! 🚀
