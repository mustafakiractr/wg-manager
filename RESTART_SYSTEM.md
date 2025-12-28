# WireGuard Manager - Otomatik Servis Yeniden Başlatma Sistemi

Bu döküman, backend ve frontend servislerinin otomatik olarak yeniden başlatılması için oluşturulan yapıyı açıklar.

## Komutlar

### 🔄 Servisleri Yeniden Başlat

```bash
# Uzun yol
/root/wg/restart_services.sh

# Kısa yol
/root/wg/rs
```

Bu script:
- ✅ Port 8001'deki backend sürecini güvenli şekilde durdurur
- ✅ Tüm frontend (vite) süreçlerini durdurur
- ✅ Backend'i yeniden başlatır ve hazır olmasını bekler
- ✅ Frontend'i yeniden başlatır ve hazır olmasını bekler
- ✅ Her iki servisin de çalışır durumda olduğunu doğrular
- ✅ Durumu renkli çıktı ile gösterir

### 📊 Servis Durumunu Kontrol Et

```bash
/root/wg/status_services.sh
```

Bu script:
- Backend ve frontend'in çalışıp çalışmadığını kontrol eder
- Process ID'lerini gösterir
- Health check yapar
- Log dosyalarının konumunu gösterir
- URL'leri listeler

## Kullanım Senaryoları

### Kod Değişikliği Sonrası

```bash
# Kod değişikliği yaptınız
# ...değişiklikler...

# Servisleri yeniden başlat
/root/wg/rs

# Otomatik olarak:
# 1. Eski süreçler durdurulur
# 2. Yeni süreçler başlatılır
# 3. Hazır olmaları beklenir
# 4. Durum kontrol edilir
```

### Manuel Kontrol

```bash
# Önce durumu kontrol et
/root/wg/status_services.sh

# Gerekirse yeniden başlat
/root/wg/rs
```

## Log Dosyaları

Backend ve frontend logları aşağıdaki konumlarda saklanır:

- **Backend:** `/tmp/backend.log`
- **Frontend:** `/tmp/frontend.log`

Log dosyalarını görüntülemek için:

```bash
# Backend log
tail -f /tmp/backend.log

# Frontend log
tail -f /tmp/frontend.log

# Son 50 satır
tail -50 /tmp/backend.log
```

## Servis Detayları

### Backend
- **Port:** 8001
- **URL:** http://localhost:8001
- **API Docs:** http://localhost:8001/docs
- **Health Check:** http://localhost:8001/health
- **Başlatma:** Python venv kullanarak uvicorn
- **Reload:** Etkin (kod değişikliklerinde otomatik yenileme)

### Frontend
- **Port:** 5173
- **Local URL:** http://localhost:5173
- **Network URL:** http://192.168.40.38:5173
- **Başlatma:** npm run dev (Vite)
- **Hot Reload:** Etkin

## Özellikler

### ✅ Güvenli Durdurma
- Önce nazikçe SIGTERM gönderir
- 2 saniye bekler
- Gerekirse SIGKILL ile zorla durdurur
- Port bazlı tespit (backend için)

### ✅ Akıllı Başlatma
- Virtual environment kullanır
- Background'da çalışır (nohup)
- Log dosyalarına yazar
- Health check ile doğrular
- Timeout ile bekler (backend: 30s, frontend: 20s)

### ✅ Hata Yönetimi
- Süreç bulunamazsa uyarı verir
- Health check başarısızsa bildirir
- Timeout olursa rapor eder
- Tüm çıktılar renkli ve anlaşılır

## Sorun Giderme

### Backend Başlamıyor

```bash
# Log dosyasını kontrol et
tail -50 /tmp/backend.log

# Port meşgul mü?
lsof -i :8001

# Manuel durdur
lsof -ti :8001 | xargs kill -9

# Yeniden başlat
/root/wg/rs
```

### Frontend Başlamıyor

```bash
# Log dosyasını kontrol et
tail -50 /tmp/frontend.log

# Port meşgul mü?
lsof -i :5173

# Manuel durdur
pkill -9 vite

# Yeniden başlat
/root/wg/rs
```

### Her İkisi de Çalışmıyor

```bash
# Tüm süreçleri temizle
lsof -ti :8001 | xargs kill -9 2>/dev/null
pkill -9 vite 2>/dev/null

# Yeniden başlat
/root/wg/rs
```

## Notlar

- ⚠️ Script'ler root olarak çalıştırılmalıdır
- ⚠️ Backend virtual environment `/root/wg/backend/venv` konumunda olmalıdır
- ⚠️ Frontend `npm run dev` komutu çalışır durumda olmalıdır
- ✅ Script'ler her kod değişikliğinden sonra otomatik olarak kullanılabilir
- ✅ Manuel müdahale gerektirmez
- ✅ Servisler daima temiz bir durumda başlatılır

## Geliştirici İpuçları

### Hızlı Erişim için Alias Oluştur

```bash
# .bashrc veya .bash_profile dosyasına ekle
alias rs='/root/wg/rs'
alias status='/root/wg/status_services.sh'
alias blog='tail -f /tmp/backend.log'
alias flog='tail -f /tmp/frontend.log'

# Sonra
source ~/.bashrc

# Artık sadece:
rs              # Servisleri yeniden başlat
status          # Durumu kontrol et
blog            # Backend log izle
flog            # Frontend log izle
```

### VS Code / IDE Entegrasyonu

Editörünüzün task sistemine ekleyebilirsiniz:

```json
{
  "tasks": [
    {
      "label": "Restart Services",
      "type": "shell",
      "command": "/root/wg/rs",
      "problemMatcher": []
    }
  ]
}
```

## Güncellemeler

Bu restart sistemi şu durumlarda otomatik kullanılmalıdır:

1. ✅ Backend model değişikliklerinden sonra
2. ✅ API endpoint eklemelerinden sonra
3. ✅ Frontend component değişikliklerinden sonra
4. ✅ Servis katmanı güncellemelerinden sonra
5. ✅ Herhangi bir kod değişikliğinden sonra

Artık manuel olarak backend veya frontend'i başlatmanıza gerek yok!
