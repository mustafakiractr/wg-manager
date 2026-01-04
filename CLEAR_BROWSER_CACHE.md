# � Browser Cache Temizleme - 502 Hata Çözümü

## ⚠️ SORUN
Vite proxy yapılandırması düzeltildi ama browser hala eski proxy ayarlarını kullanıyor olabilir.

## ✅ ÇÖZÜM: Browser Cache Temizleme

### Yöntem 1: Hard Refresh (En Hızlı)
1. Tarayıcıda `http://localhost:5173` adresine gidin
2. **Ctrl + Shift + R** (veya **Cmd + Shift + R** Mac'te)
3. Veya **F12** tuşuna basın > Network tab > "Disable cache" seçeneğini işaretleyin
4. Sayfayı yenileyin

### Yöntem 2: Developer Tools ile Tam Temizlik
1. **F12** tuşuna basın (Developer Tools açılır)
2. **Application** tab'ına gidin
3. Sol menüden **Clear storage** seçin
4. **Clear site data** butonuna tıklayın
5. Sayfayı yenileyin (**F5**)

### Yöntem 3: Manuel Cache Temizleme
**Chrome/Edge:**
- Ayarlar (⋮) > More tools > Clear browsing data
- Time range: **Last hour**
- Sadece "Cached images and files" seçili olsun
- Clear data

**Firefox:**
- Ayarlar (≡) > Privacy & Security
- Cookies and Site Data > Clear Data
- Sadece "Cached Web Content" seçili olsun
- Clear

**Safari:**
- Safari > Preferences > Advanced
- "Show Develop menu" aktif edin
- Develop > Empty Caches

### Yöntem 4: İncognito/Private Pencere
1. **Ctrl + Shift + N** (Chrome/Edge)
2. **Ctrl + Shift + P** (Firefox)
3. **Cmd + Shift + N** (Safari)
4. `http://localhost:5173` adresine gidin
5. Login deneyin

## 🧪 Test: Proxy Doğru alışıyor mu?

Browser console'da (F12 > Console) kontrol edin:

```javascript
// API Base URL kontrol
console.log('Current location:', window.location.href)
// Çıktı: http://localhost:5173/

// Network tab'ında login isteğine bakın:
// Request URL: http://localhost:5173/api/v1/auth/login
// Proxy target: http://localhost:5000/api/v1/auth/login
```

## ✅ Doğrulama

Login başarılı olursa:
- ✅ Token alırsınız
- ✅ Dashboard sayfasına yönlendirilirsiniz
- ✅ 502 hatası gitmeli

## 🔍 Hala 502 Alıyorsanız

Console'da (F12 > Console) hata mesajını kopyalayın:
```
Network error: ...
Status: 502 Bad Gateway
Request URL: ...
```

Ve backend loglarını kontrol edin:
```bash
tail -f /tmp/backend.log
```
