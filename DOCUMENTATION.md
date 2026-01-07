# 📘 WireGuard Manager - Tam Dokümantasyon

MikroTik RouterOS v7+ WireGuard VPN yönetimi için modern web arayüzü.

**Versiyon:** 2.0 | **Son Güncelleme:** 7 Ocak 2026

---

## 🎯 Hızlı Başlangıç

### Otomatik Kurulum (Önerilen)
```bash
git clone https://github.com/mustafakiractr/wg-manager.git /opt/wg-manager
cd /opt/wg-manager
sudo bash quick-start.sh
```

### İlk Giriş
- URL: `http://sunucu-ip:5173`
- Kullanıcı: `admin`
- Şifre: `admin123`

⚠️ **İlk girişten sonra şifreyi değiştirin!**

---

## 📋 Sistem Gereksinimleri

- **OS:** Ubuntu 20.04+, Debian 11+, CentOS 8+
- **RAM:** Min 1GB (2GB önerilir)
- **Disk:** 1GB boş alan
- **MikroTik:** RouterOS v7+ (API aktif)

**Not:** Python, Node.js ve tüm bağımlılıklar otomatik yüklenir.

---

## ⚙️ Yapılandırma

### Backend (.env)
```bash
# Ortam
ENVIRONMENT=production
SECRET_KEY=your-secret-key-min-32-chars

# MikroTik
MIKROTIK_HOST=192.168.1.1
MIKROTIK_PORT=8728
MIKROTIK_USER=admin
MIKROTIK_PASSWORD=your-password
MIKROTIK_USE_TLS=True

# Database (PostgreSQL önerilen)
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/wg_manager

# JWT
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
CORS_ORIGINS=https://domain.com

# Rate Limit
RATE_LIMIT_PER_MINUTE=200
RATE_LIMIT_LOGIN=5
```

### Frontend (.env)
```bash
VITE_API_URL=https://domain.com/api/v1
VITE_WS_URL=wss://domain.com/ws
```

---

## 🔐 Güvenlik

### Production Kontrol Listesi
- [ ] `ENVIRONMENT="production"` ayarlandı
- [ ] `SECRET_KEY` güçlü ve benzersiz (32+ karakter)
- [ ] HTTPS sertifikası kuruldu
- [ ] Firewall yapılandırıldı (port 22, 80, 443)
- [ ] Varsayılan admin şifresi değiştirildi
- [ ] PostgreSQL kullanılıyor (SQLite yerine)
- [ ] CORS sadece güvenli domain'ler
- [ ] Rate limiting aktif
- [ ] Otomatik yedekleme ayarlandı

### Güvenlik Özellikleri
- JWT Authentication
- Bcrypt şifre hashleme
- Rate limiting (DDoS koruması)
- Account lockout (5 başarısız deneme)
- Activity logging
- IP tracking
- Session management

---

## 📊 Özellikler

### WireGuard Yönetimi
- Interface oluşturma/düzenleme/silme
- Peer yönetimi (ekle/düzenle/sil/aç-kapat)
- QR kod üretimi
- Config dosyası indirme
- Toplu işlemler

### IP Havuzu
- Otomatik IP tahsisi
- Pool şablonları
- "auto" keyword desteği
- IP kullanım istatistikleri

### Peer Templates
- Hızlı peer oluşturma
- Önceden tanımlı yapılandırmalar
- Kullanım sayısı takibi

### Telegram Bildirimleri
- Gerçek zamanlı uyarılar
- Kritik olaylar
- Backup bildirimleri
- Peer durum değişiklikleri

### Dashboard
- Gerçek zamanlı istatistikler
- Trafik grafikleri
- Interface durumu
- Peer sayıları

---

## 🛠️ Yönetim Komutları

### Servis Yönetimi
```bash
# Başlat
bash start_all.sh

# Durdur
bash stop_services.sh

# Yeniden başlat
bash restart_services.sh

# Durum kontrolü
bash status_services.sh
```

### Veritabanı
```bash
# Admin şifre sıfırlama
cd backend && source venv/bin/activate
python reset_admin_password.py

# PostgreSQL kurulumu
bash setup_postgresql.sh

# Yedekleme
cd backend && source venv/bin/activate
python -c "from app.services.backup_service import BackupService; BackupService().create_database_backup()"
```

### Loglar
```bash
# Backend
tail -f backend/logs/backend.log

# Systemd (production)
journalctl -u wg-backend -f
journalctl -u wg-frontend -f
```

---

## 🚀 Performans Optimizasyonu

### MikroTik Bağlantı
- Cache süresi: 60 saniye
- Retry delay: 0.5 saniye
- Socket timeout: 10 saniye
- Connection pooling aktif

### Database
- PostgreSQL kullanın (SQLite yerine)
- Index'ler otomatik
- Connection pooling
- Async operations

### Frontend
- Production build: `npm run build`
- Vite optimizasyonu
- Code splitting
- Asset compression

### Nginx (Production)
```bash
# Frontend build
cd frontend && npm run build

# Nginx production serve
# /etc/nginx/sites-enabled/wg-manager ile
# dist/ klasörünü port 80'den serve eder

# SSL/HTTPS eklemek için:
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### Production Deployment
```bash
# 1. Frontend build
bash build_frontend.sh

# 2. Backend zaten çalışıyor (wg-backend.service)

# 3. Nginx restart (gerekirse)
sudo systemctl restart nginx

# Not: wg-frontend.service durdurun (nginx kullanıyorsa)
sudo systemctl stop wg-frontend
sudo systemctl disable wg-frontend
```

---

## 📦 Yedekleme & Restore

### Otomatik Yedekleme
```bash
# Zamanlanmış yedekleme (cron)
bash setup_backup_schedule.sh

# Manuel yedekleme
cd backend && source venv/bin/activate
python -c "from app.services.backup_scheduler_service import BackupSchedulerService; import asyncio; asyncio.run(BackupSchedulerService.create_scheduled_backup(None))"
```

### Retention Policy
- Database: 7 gün
- Full backup: 30 gün
- WireGuard config: 3 gün

### Restore
```bash
# Database restore
cd backend
python -c "from app.services.backup_service import BackupService; BackupService().restore_backup('backup_name.sql')"
```

---

## 🔧 Sorun Giderme

### Backend Başlamıyor
```bash
# Venv aktifleştir
cd backend && source venv/bin/activate

# Bağımlılıkları yükle
pip install -r requirements.txt

# Database başlat
python init_db.py

# Logları kontrol et
tail -f logs/backend.log
```

### MikroTik Bağlantı Hatası
```bash
# MikroTik'te API servisini kontrol et
/ip service print
/ip service set api disabled=no

# .env dosyasını kontrol et
cat backend/.env | grep MIKROTIK
```

### Frontend Çalışmıyor
```bash
# Bağımlılıkları yükle
cd frontend && npm install

# .env kontrol et
cat .env

# Development başlat
npm run dev
```

### CORS Hatası
```bash
# Backend .env dosyasında CORS_ORIGINS kontrol et
nano backend/.env

# Frontend URL'ini ekle
CORS_ORIGINS=http://localhost:5173,https://domain.com
```

---

## 📱 API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Giriş
- `POST /api/v1/auth/refresh` - Token yenileme
- `GET /api/v1/auth/me` - Kullanıcı bilgisi

### WireGuard
- `GET /api/v1/wg/interfaces` - Interface listesi
- `POST /api/v1/wg/interface/add` - Interface ekle
- `GET /api/v1/wg/peers/{interface}` - Peer listesi
- `POST /api/v1/wg/peer/add` - Peer ekle
- `GET /api/v1/wg/peer/{id}/qrcode` - QR kod

### IP Pool
- `GET /api/v1/ip-pools` - Pool listesi
- `POST /api/v1/ip-pools` - Pool oluştur
- `GET /api/v1/ip-pools/{id}/stats` - Pool istatistikleri

### Activity Logs
- `GET /api/v1/activity-logs` - Log listesi
- `GET /api/v1/activity-logs/recent` - Son aktiviteler

---

## 🔄 Güncelleme

```bash
cd /opt/wg-manager
git pull
bash restart_services.sh
```

---

## 📞 Destek

- **Issues:** GitHub Issues
- **Dokümantasyon:** Bu dosya
- **Telegram:** @wireguard-manager-support

---

## 📄 Lisans

MIT License - Detaylar için LICENSE dosyasını inceleyin.

---

## 🙏 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing`)
3. Commit yapın (`git commit -m 'feat: Add feature'`)
4. Push yapın (`git push origin feature/amazing`)
5. Pull Request açın

---

## 📚 Ek Kaynaklar

- [MikroTik API Docs](https://help.mikrotik.com/docs/display/ROS/API)
- [WireGuard Docs](https://www.wireguard.com/quickstart/)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [React Docs](https://react.dev/)

---

**Son Güncelleme:** 7 Ocak 2026  
**Geliştirici:** mustafakiractr
