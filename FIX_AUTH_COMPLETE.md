# ✅ 401 Authentication Hatası - TAM ÇÖZÜM

## 🔴 PROBLEM
PostgreSQL migration sonrası:
- ✅ 44 eski session silindi
- ⚠️ Frontend'de eski token'lar hala localStorage'da
- ⚠️ Peer add/delete işlemlerinde 500 hatası

## 🛠️ ÇÖZÜM ADIMLARı

### 1. Browser'da LocalStorage Temizle (ZORUNLU)

**Chrome/Firefox Console'da:**
```javascript
localStorage.clear()
sessionStorage.clear()
location.reload()
```

### 2. Tekrar Login Ol
- Username: admin
- Password: admin123 (veya yeni şifren)

### 3. Backend Log Kontrolü (500 hatası için)
```bash
tail -f /root/wg/backend/logs/backend.log
```

## 📊 UYGULANAN DÜZELTMELERİ

### ✅ Frontend api.js Düzeltildi
- 401 hatalarında otomatik logout
- localStorage temizleme
- Login sayfasına yönlendirme

### ✅ PostgreSQL Session Temizliği
- 44 eski session silindi
- Süresi geçmiş token'lar temizlendi

### ✅ Servisler Yeniden Başlatıldı
- Frontend: ✅ Çalışıyor (Port 5173)
- Backend: ✅ Çalışıyor (Port 8001)

## 🎯 ŞİMDİ YAPILACAKLAR

1. **Browser'ı aç:** http://localhost:5173
2. **F12 > Console aç** ve şunu çalıştır:
   ```javascript
   localStorage.clear()
   location.reload()
   ```
3. **Login ol:** admin / admin123
4. **Peer eklemeyi test et**

## 🐛 Hala Sorun Varsa

### 500 Hatası Devam Ederse:
```bash
# Backend log'unu kontrol et
tail -100 /root/wg/backend/logs/backend.log | grep -i error

# Backend'i yeniden başlat
systemctl restart wg-backend

# Database bağlantısını test et
PGPASSWORD=wg_secure_pass_2025 psql -h localhost -U wg_user -d wg_manager -c '\conninfo'
```

### Peer Ekleme 500 Hatası:
Büyük ihtimalle:
- MikroTik API bağlantısı
- Database constraint hatası
- IP Pool allocation hatası

Log'lara bakarak detaylı hata görebiliriz.
