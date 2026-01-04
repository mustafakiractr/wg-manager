# 🔔 Telegram Bildirim Sistemi - Hızlı Başlangıç

## ✅ Kurulum Tamamlandı!

Telegram bildirim sistemi başarıyla kuruldu ve aktif durumda.

### 📦 Yüklenen Bileşenler

#### Backend (100% Tamamlandı)
- ✅ `TelegramSettings` model (timezone-aware)
- ✅ `TelegramNotificationService` (aiohttp ile)
- ✅ REST API endpoints (4 endpoint)
- ✅ Database migration (TIMESTAMP WITH TIME ZONE)
- ✅ Event hook entegrasyonları (4 kritik olay)

#### Frontend (100% Tamamlandı)
- ✅ `TelegramSettings` bileşeni (12KB)
- ✅ Settings sayfası "Bildirimler" sekmesi
- ✅ Production build

#### Event Hook Entegrasyonları
- ✅ **Peer Status Tracking** - Peer online/offline durumu
- ✅ **MikroTik Connection** - Router bağlantı kesintisi
- ✅ **Backup Operations** - Yedekleme hataları
- ✅ **Login Security** - Hesap kilitleme

---

## 🚀 Kullanıma Başlama

### 1. Telegram Bot Oluştur

```bash
# Telegram'da @BotFather'ı aç ve şu adımları izle:
1. /newbot komutunu gönder
2. Bot adı ver (örn: "WireGuard Manager")
3. Bot kullanıcı adı ver (örn: "my_wg_bot")
4. BotFather sana bir TOKEN verecek:
   1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

### 2. Chat ID Öğren

**Yöntem 1 - API Kullan:**
```bash
# Bot'una /start mesajı gönder
# Sonra tarayıcıda aç:
https://api.telegram.org/bot<TOKEN>/getUpdates

# JSON'da "chat":{"id":123456789} alanını bul
```

**Yöntem 2 - @userinfobot:**
```bash
# Telegram'da @userinfobot'a mesaj gönder
# Bot sana ID'ni verecek
```

### 3. Web Arayüzünden Yapılandır

1. Panele giriş yap: `http://localhost:5173` veya production URL
2. **Ayarlar** > **Bildirimler** sekmesine git
3. Bilgileri gir:
   - **Bot Token**: BotFather'dan aldığın token
   - **Chat ID**: Öğrendiğin chat ID
4. İstediğin bildirim kategorilerini seç:
   - 🔴 Peer Bağlantısı Kesildi
   - 🟢 Peer Bağlantısı Kuruldu
   - ⚠️ MikroTik Bağlantısı Kesildi
   - 💾 Yedekleme Başarısız
   - 🔒 Başarısız Giriş Denemesi
   - ❌ Sistem Hatası
5. **Aktif** anahtarını aç
6. **Test Mesajı Gönder** ile test et
7. **Kaydet** butonuna tıkla

---

## 📡 API Endpoints

### GET /api/v1/telegram-settings
Mevcut ayarları getir veya varsayılan ayarları oluştur

### POST /api/v1/telegram-settings
Ayarları güncelle
```json
{
  "bot_token": "1234567890:ABC...",
  "chat_id": "123456789",
  "enabled": true,
  "notification_categories": ["peer_down", "mikrotik_disconnect"]
}
```

### POST /api/v1/telegram-settings/test
Test mesajı gönder

### GET /api/v1/telegram-settings/categories
Tüm bildirim kategorilerini listele

---

## 🎯 Bildirim Kategorileri

| Kategori | Emoji | Açıklama | Tetiklenme |
|----------|-------|----------|------------|
| peer_down | 🔴 | Peer Bağlantısı Kesildi | Peer 90+ saniye yanıt vermezse |
| peer_up | 🟢 | Peer Bağlantısı Kuruldu | Peer tekrar yanıt verirse |
| mikrotik_disconnect | ⚠️ | MikroTik Bağlantısı Kesildi | Router API bağlantısı koparsa |
| backup_failed | 💾 | Yedekleme Başarısız | Backup işlemi hata verirse |
| login_failed | 🔒 | Başarısız Giriş Denemesi | 5 başarısız denemeden sonra |
| system_error | ❌ | Sistem Hatası | Kritik sistem hatalarında |

---

## 🧪 Test Senaryoları

### ✅ Manuel Test
1. Ayarlar > Bildirimler sayfasından **Test Mesajı Gönder**
2. Telegram'dan mesajı kontrol et

### ✅ Peer Down Test
```bash
# WireGuard peer'ı durdur
# 90 saniye sonra bildirim gelecek
```

### ✅ Login Failed Test
```bash
# 5 kez yanlış şifre ile giriş yap
# Hesap kilitlendiğinde bildirim gelecek
```

### ✅ Backup Failed Test
```bash
# Backup işlemi sırasında dosya izinlerini kaldır
# Backup hatası alındığında bildirim gelecek
```

---

## 📊 Veritabanı Yapısı

```sql
telegram_settings:
  - id (PK)
  - bot_token (VARCHAR, encrypted)
  - chat_id (VARCHAR)
  - enabled (BOOLEAN)
  - notification_categories (TEXT/JSON)
  - test_message_count (INTEGER)
  - last_notification_at (TIMESTAMP WITH TIME ZONE)
  - created_at (TIMESTAMP WITH TIME ZONE)
  - updated_at (TIMESTAMP WITH TIME ZONE)
```

**Mevcut Durumu Kontrol:**
```bash
cd /root/wg/backend && source venv/bin/activate
python3 -c "
from app.database.database import AsyncSessionLocal
from sqlalchemy import text
import asyncio

async def check():
    async with AsyncSessionLocal() as db:
        result = await db.execute(text('SELECT * FROM telegram_settings'))
        print(result.fetchone())

asyncio.run(check())
"
```

---

## 🔒 Güvenlik Özellikleri

- ✅ **Admin-Only Endpoints**: Sadece admin kullanıcılar erişebilir
- ✅ **Token Masking**: Bot token frontend'de maskelenmiş gösterilir (ilk 10 karakter + "...")
- ✅ **Non-Blocking**: Telegram hataları ana uygulamayı etkilemez
- ✅ **Timeout Protection**: 10 saniye timeout (aiohttp)
- ✅ **Error Handling**: Tüm event hook'larda try-except wrapper

---

## 📝 Loglar

Backend logları:
```bash
tail -f /root/wg/backend/logs/app.log | grep -i telegram
```

Systemd logları (production):
```bash
journalctl -u wg-backend -f | grep -i telegram
```

---

## 🔧 Sorun Giderme

### ❌ Backend'e Bağlanamıyor
```bash
# Backend'i yeniden başlat
lsof -ti :8001 | xargs -r kill -9
cd /root/wg/backend && source venv/bin/activate
python3 run.py
```

### ❌ Bot Token Hatası
- Token'ı kontrol et (BotFather'dan yeni token al)
- Boşluk/ekstra karakter yok mu kontrol et

### ❌ Chat ID Hatası
- Bot'a en az bir mesaj gönder
- getUpdates API'sini kontrol et
- Grup kullanıyorsan, bot yönetici mi kontrol et

### ❌ Bildirim Gelmiyor
- Ayarlar > Bildirimler'de **Aktif** olduğunu kontrol et
- İlgili kategori seçili mi kontrol et
- Backend loglarını kontrol et

---

## 📚 Detaylı Dokümantasyon

Tam kullanım kılavuzu için:
```bash
cat /root/wg/docs/TELEGRAM_SETUP.md
```

---

## 🎉 Başarılı Kurulum Testi

```bash
# 1. Backend health check
curl -s http://127.0.0.1:8001/health

# 2. Veritabanı kontrolü
cd /root/wg/backend && source venv/bin/activate
python3 -c "from app.models.telegram_settings import TelegramSettings; print('✅ Model OK')"

# 3. Frontend build kontrolü
ls -lh /root/wg/frontend/dist/index.html

# 4. Event hook kontrolü
grep -r "get_telegram_service" /root/wg/backend/app/services/ /root/wg/backend/app/api/ /root/wg/backend/app/mikrotik/ /root/wg/backend/app/security/
```

---

**🚀 Telegram bildirim sistemi kullanıma hazır!**

**Son Güncelleme:** 3 Ocak 2025
**Backend PID:** 42440 (health: ✅)
**Database:** telegram_settings tablosu aktif
**Frontend:** Production build tamamlandı
