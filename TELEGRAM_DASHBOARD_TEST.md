# 🧪 Telegram Dashboard & Real-time Notification Test Guide

**Tarih:** 3 Ocak 2026
**Durum:** ✅ Backend & Frontend Running

## 📊 Sistem Durumu

- **Backend:** ✅ Running (PID: 50544, Port: 5000)
- **Frontend:** ✅ Running (PID: 50819, Port: 5173)
- **PostgreSQL:** ✅ Active
- **Telegram Logs API:** ✅ Registered

## 🎯 Test Planı

### Test 1: Telegram Dashboard Erişimi

1. **Adım 1:** Tarayıcıda `http://localhost:5173` adresine gidin
2. **Adım 2:** Login olun (admin/admin123)
3. **Adım 3:** Settings sayfasına gidin
4. **Adım 4:** "Telegram Geçmişi" tab'ına tıklayın

**Beklenen Sonuç:**
- ✅ Telegram Dashboard görünür
- ✅ İstatistik kartları gösterilir (Toplam, Başarılı, Başarısız, Başarı Oranı)
- ✅ Filtre bölümü aktif
- ✅ Log tablosu boş (henüz mesaj gönderilmedi)

---

### Test 2: Telegram Test Mesajı Gönder

1. **Adım 1:** Settings > Bildirimler (Telegram Settings) sayfasına gidin
2. **Adım 2:** "Test Mesajı Gönder" butonuna tıklayın
3. **Adım 3:** Telegram uygulamanızda mesajı kontrol edin
4. **Adım 4:** Settings > Telegram Geçmişi'ne geri dönün
5. **Adım 5:** "Yenile" butonuna tıklayın

**Beklenen Sonuç:**
- ✅ Telegram'a mesaj ulaşır
- ✅ Dashboard'da yeni log kaydı görünür
- ✅ İstatistikler güncellenir:
  - Toplam: 1
  - Başarılı: 1
  - Başarı Oranı: 100%
- ✅ Log tablosunda:
  - Kategori: "test"
  - Başlık: "Test Bildirimi"
  - Durum: Yeşil "Başarılı" badge

---

### Test 3: Filtreleme Özellikleri

1. **Adım 1:** Kategori dropdown'dan "test" seçin
2. **Adım 2:** "Tarih Aralığı" filtrelerini ayarlayın
3. **Adım 3:** "Durum" filtresinden "Başarılı" seçin

**Beklenen Sonuç:**
- ✅ Filtreler çalışır
- ✅ Sadece filtreye uyan kayıtlar gösterilir
- ✅ "Temizle" butonu filtreleri sıfırlar

---

### Test 4: Real-time Notification (KRİTİK TEST!)

#### 4A. WebSocket Bağlantı Kontrolü

1. **Adım 1:** Browser'da F12 tuşuna basın (Developer Tools)
2. **Adım 2:** Network tab'ına gidin
3. **Adım 3:** "WS" filtresini seçin
4. **Adım 4:** Sayfayı yenileyin (F5)

**Beklenen Sonuç:**
- ✅ WebSocket bağlantısı görünür:
  ```
  ws://localhost:5173/api/v1/ws/notifications?token=...
  Status: 101 Switching Protocols
  ```
- ✅ Messages tab'ında "connected" mesajı gelir

**Sorun Giderme:**
- ❌ Bağlantı görünmüyorsa → Console tab'ında hata kontrol edin
- ❌ 401 Unauthorized → Token sorunu (logout/login yapın)
- ❌ Connection refused → Backend çalışmıyor (PID 50544 kontrol edin)

#### 4B. Gerçek Zamanlı Bildirim Testi

1. **Adım 1:** Notification dropdown'ı açık tutun (sağ üst köşe, zil ikonu)
2. **Adım 2:** Yeni bir tab açın, Settings > Bildirimler
3. **Adım 3:** "Test Mesajı Gönder" butonuna tıklayın
4. **Adım 4:** İlk tab'a dönün (dropdown açık olan)

**Beklenen Sonuç:**
- ✅ **ANINDA** (30 saniye beklemeden) yeni bildirim görünür
- ✅ Bildirim sayısı (+1) artar
- ✅ Browser console'da mesaj görünür:
  ```
  WebSocket message: { type: 'notification', data: {...} }
  ```

**Sorun Giderme:**
- ❌ 30 saniye sonra geliyor → Polling mode aktif
  - Console'da bakın: "Starting polling fallback" mesajı var mı?
  - WebSocket bağlantısı kopmuş olabilir
  
- ❌ Hiç gelmiyor → Backend notification_service hatası
  - Backend log kontrol: `tail -f /tmp/backend.log`
  - "WebSocket bildirimi gönderildi" mesajını arayın

#### 4C. WebSocket Connection State

Browser console'da kontrol edin:

```javascript
// NotificationContext state'i görün
// Notification dropdown'ı açık tutarken console'da:

// Bağlantı durumu - "connected" olmalı
console.log('Connection State:', document.querySelector('[data-connection-state]')?.dataset.connectionState)

// Polling mode - false olmalı
console.log('Using Polling:', document.querySelector('[data-using-polling]')?.dataset.usingPolling)
```

---

### Test 5: Pagination & Resend

1. **Adım 1:** 50+ log kaydı oluşturun (test mesajları göndererek)
2. **Adım 2:** Pagination butonlarını test edin
3. **Adım 3:** Başarısız bir kayıt oluşturun:
   - Backend'i durdurun: `kill 50544`
   - Test mesajı gönderin (başarısız olacak)
   - Backend'i yeniden başlatın
4. **Adım 4:** Dashboard'da başarısız kaydı bulun
5. **Adım 5:** "Yeniden gönder" (↻) ikonuna tıklayın

**Beklenen Sonuç:**
- ✅ Pagination çalışır (Önceki/Sonraki)
- ✅ Başarısız kayıt kırmızı "Başarısız" badge ile gösterilir
- ✅ Hata mesajı görünür (truncated)
- ✅ Resend butonu mesajı yeniden gönderir
- ✅ Toast "Bildirim yeniden gönderildi" mesajı gösterilir

---

## 🐛 Yaygın Sorunlar & Çözümler

### Sorun 1: "Not authenticated" Hatası

**Belirti:**
- API çağrılarında 401 hatası
- Telegram Dashboard yüklenmiyor

**Çözüm:**
```bash
# Logout yapın, tekrar login olun
# Token yenilenmiş olacak
```

### Sorun 2: WebSocket Bağlanamıyor

**Belirti:**
- Network tab'ında WebSocket görünmüyor
- Console'da "WebSocket error" mesajı

**Çözüm:**
```bash
# Backend loglarını kontrol edin:
tail -f /tmp/backend.log

# WebSocket endpoint erişilebilir mi:
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost:5000/api/v1/ws/notifications?token=test

# Vite proxy ayarlarını kontrol edin:
cat /root/wg/frontend/vite.config.js
```

### Sorun 3: Bildirimler 30 Saniye Sonra Geliyor

**Belirti:**
- Console'da: "Starting polling fallback (30s interval)"
- Gerçek zamanlı bildirim yok

**Çözüm:**
```javascript
// Browser console'da:
// 1. WebSocket failure count kontrol
console.log('WS Failures:', localStorage.getItem('ws_failure_count'))

// 2. Manuel reconnect
import notificationWebSocket from './services/websocket'
notificationWebSocket.disconnect()
setTimeout(() => notificationWebSocket.connect(), 1000)

// 3. Polling'i devre dışı bırak (debug için)
// NotificationContext.jsx'de usePolling state'ini kontrol edin
```

### Sorun 4: Telegram Mesajı Gitmiyor

**Belirti:**
- Dashboard'da "Başarısız" status
- Error message: "HTTP 400: Bad Request"

**Çözüm:**
```bash
# Telegram ayarlarını kontrol edin:
# Settings > Bildirimler
# - Bot Token doğru mu?
# - Chat ID doğru mu?

# Test:
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d "chat_id=<CHAT_ID>&text=Test"
```

---

## 📊 Backend Log Monitörü

Test sırasında backend loglarını izleyin:

```bash
# Terminal 1: Backend logs
tail -f /tmp/backend.log | grep -E "WebSocket|Telegram|notification"

# Terminal 2: PostgreSQL logs (opsiyonel)
sudo tail -f /var/log/postgresql/postgresql-*.log

# Görmek istediğiniz mesajlar:
# ✅ "WebSocket bağlantısı kabul edildi"
# ✅ "WebSocket bildirimi gönderildi (user_id=...)"
# ✅ "Telegram notification sent successfully"
# ✅ "TelegramNotificationLog created: id=..."
```

---

## ✅ Başarı Kriterleri

Test başarılı sayılır eğer:

1. ✅ **Telegram Dashboard** düzgün yükleniyor
2. ✅ **Test mesajı** Telegram'a ulaşıyor
3. ✅ **Log kaydı** dashboard'da görünüyor
4. ✅ **İstatistikler** doğru hesaplanıyor
5. ✅ **Filtreler** çalışıyor
6. ✅ **Pagination** çalışıyor
7. ✅ **WebSocket** bağlanıyor (Status: 101)
8. ✅ **Gerçek zamanlı bildirim** ANINDA geliyor (30s değil!)
9. ✅ **Resend** özelliği çalışıyor
10. ✅ **Hata mesajları** düzgün gösteriliyor

---

## 📸 Ekran Görüntüleri (Test Sonrası)

Test tamamlandığında şu ekran görüntülerini alın:

1. **Telegram Dashboard** - Tüm ekran
2. **İstatistik Kartları** - Yakın çekim
3. **Log Tablosu** - İlk 10 kayıt
4. **Browser DevTools** - Network > WS tab (bağlantı gösteriliyor)
5. **Browser Console** - "WebSocket message" logları

---

## 🚀 Sonraki Adımlar

Test başarılı olduktan sonra:

1. **Production Deployment:**
   ```bash
   cd /root/wg
   sudo bash deploy.sh
   ```

2. **Systemd Services:**
   ```bash
   sudo systemctl enable wg-backend wg-frontend
   sudo systemctl start wg-backend wg-frontend
   ```

3. **Telegram Webhook (İleri Düzey):**
   - Telegram bot'a webhook ekle
   - Gelen mesajları yakala
   - İki yönlü iletişim sağla

4. **Notification Categories Genişletme:**
   - Yeni event tipleri ekle
   - Custom kategoriler tanımla
   - Kategori bazlı filtreleme geliştir

---

**Test Eden:** _____________
**Test Tarihi:** 3 Ocak 2026
**Test Sonucu:** ⬜ Başarılı | ⬜ Başarısız | ⬜ Kısmen Başarılı

**Notlar:**
```
(Test notlarınızı buraya yazın)
```
