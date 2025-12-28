# 📦 MikroTik WireGuard Yönetim Paneli - Deployment Paketi

## 🚀 Hızlı Başlangıç (30 Saniye)

### Adım 1: Zip Dosyasını Açın
```bash
unzip wg-manager.zip
cd wg-manager
```

### Adım 2: Tek Komutla Kurun
```bash
sudo bash quick-start.sh
```

**Hepsi bu kadar!** Script otomatik olarak:
- ✅ Sistem gereksinimlerini kontrol eder
- ✅ Tüm bağımlılıkları yükler
- ✅ Environment yapılandırması yapar
- ✅ Veritabanını oluşturur
- ✅ Servisleri başlatır

### Adım 3: Tarayıcıdan Erişin
```
http://YOUR_SERVER_IP:5173
```

**Giriş Bilgileri:**
- Kullanıcı: `admin`
- Şifre: `admin123`

⚠️ **İlk girişten sonra mutlaka şifrenizi değiştirin!**

---

## 📋 Paket İçeriği

### 📂 Ana Dizin
```
wg-manager/
├── quick-start.sh              # 🚀 Tek komut kurulum scripti
├── install.sh                  # Detaylı kurulum scripti
├── deploy.sh                   # Production deployment scripti
├── setup_environment.sh        # Environment yapılandırma
├── start_all.sh                # Servisleri başlat
├── restart_all.sh              # Servisleri yeniden başlat
├── status.sh                   # Durum kontrolü
├── README.md                   # Genel bilgiler
├── README-DEPLOYMENT.md        # Bu dosya
├── DEPLOYMENT.md               # Detaylı deployment rehberi
├── INSTALL.md                  # Kurulum rehberi
├── QUICKSTART.md               # Hızlı başlangıç rehberi
├── SECURITY.md                 # Güvenlik rehberi
├── IMPROVEMENTS_SUMMARY.md     # Yapılan iyileştirmeler
├── backend/                    # Backend (FastAPI)
├── frontend/                   # Frontend (React + Vite)
├── nginx/                      # Nginx yapılandırma örnekleri
└── systemd/                    # Systemd servis dosyaları
```

### 🔧 Kurulum Scriptleri

| Script | Açıklama | Kullanım |
|--------|----------|----------|
| `quick-start.sh` | Tek komutla tam kurulum | `sudo bash quick-start.sh` |
| `install.sh` | Detaylı kurulum (interaktif değil) | `sudo bash install.sh` |
| `setup_environment.sh` | Environment yapılandırma | `bash setup_environment.sh` |
| `deploy.sh` | Production deployment | `sudo bash deploy.sh` |

### 📚 Dokümantasyon

| Dosya | İçerik |
|-------|--------|
| `DEPLOYMENT.md` | Kapsamlı deployment rehberi, tüm detaylar |
| `INSTALL.md` | Kurulum adımları ve manuel kurulum |
| `QUICKSTART.md` | Hızlı başlangıç ve temel kullanım |
| `SECURITY.md` | Güvenlik kontrol listesi ve best practices |
| `IMPROVEMENTS_SUMMARY.md` | Yapılan güvenlik ve performans iyileştirmeleri |

---

## 🖥️ Sistem Gereksinimleri

### Minimum
- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **CPU**: 1 core
- **RAM**: 1GB
- **Disk**: 1GB boş alan
- **Python**: 3.9+
- **Node.js**: 16+

### Önerilen (Production)
- **OS**: Ubuntu 22.04 LTS
- **CPU**: 2+ cores
- **RAM**: 2GB+
- **Disk**: 5GB+ (loglar için)
- **Python**: 3.11+
- **Node.js**: 18+ LTS

---

## 📖 Kurulum Senaryoları

### Senaryo 1: Development (Tek Komut)

En hızlı kurulum:

```bash
sudo bash quick-start.sh
```

Erişim: `http://SERVER_IP:5173`

### Senaryo 2: Production (Nginx + SSL)

Tam production kurulum:

```bash
# 1. Sistem kurulumu
sudo bash install.sh

# 2. Environment yapılandırması
bash setup_environment.sh
# "production" seçin

# 3. Production deployment
sudo bash deploy.sh
# Nginx yapılandırması: y
# Domain: yourdomain.com

# 4. SSL sertifikası
sudo certbot --nginx -d yourdomain.com
```

Erişim: `https://yourdomain.com`

### Senaryo 3: Manuel Kurulum

Adım adım kontrol için:

```bash
# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
nano .env  # Düzenle
python run.py &

# Frontend
cd ../frontend
npm install
npm run dev &
```

Erişim: `http://localhost:5173`

---

## 🔐 Environment Yapılandırması

### Otomatik (Önerilen)

```bash
bash setup_environment.sh
```

İnteraktif olarak sorar:
- Environment (development/production)
- MikroTik IP ve port
- Kullanıcı adı ve şifre
- TLS kullanımı

### Manuel

`backend/.env` dosyasını düzenleyin:

```ini
# Ortam
ENVIRONMENT="production"

# Güvenlik (otomatik oluşturulur)
SECRET_KEY="..."

# MikroTik
MIKROTIK_HOST="192.168.1.1"
MIKROTIK_PORT=8728
MIKROTIK_USERNAME="admin"
MIKROTIK_PASSWORD="your-password"
MIKROTIK_USE_TLS=False

# CORS (production için)
CORS_ORIGINS="https://yourdomain.com"

# Rate Limiting
RATE_LIMIT_PER_MINUTE=100
RATE_LIMIT_LOGIN=3
```

---

## 🛠️ Servis Yönetimi

### Development Modu

```bash
# Başlat
bash start_all.sh

# Durum
bash status.sh

# Yeniden başlat
bash restart_all.sh

# Durdur
pkill -f 'python.*run.py' && pkill -f 'vite'
```

### Production Modu (Systemd)

```bash
# Başlat
sudo systemctl start wg-backend wg-frontend

# Durum
sudo systemctl status wg-backend wg-frontend

# Yeniden başlat
sudo systemctl restart wg-backend wg-frontend

# Durdur
sudo systemctl stop wg-backend wg-frontend

# Otomatik başlatma
sudo systemctl enable wg-backend wg-frontend

# Loglar
sudo journalctl -u wg-backend -f
```

---

## 🌐 Erişim ve URL'ler

### Development
```
Frontend:  http://SERVER_IP:5173
Backend:   http://SERVER_IP:8001
API Docs:  http://SERVER_IP:8001/docs
```

### Production (Nginx)
```
App:       https://yourdomain.com
API Docs:  https://yourdomain.com/docs
Backend:   https://yourdomain.com/api (reverse proxy)
```

---

## 🔥 Firewall Yapılandırması

### Development

```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 5173/tcp # Frontend
sudo ufw allow 8001/tcp # Backend
sudo ufw enable
```

### Production (Nginx)

```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

---

## 📊 Özellikler

### ✅ Güvenlik
- JWT authentication
- 2FA (Two-Factor Authentication)
- Rate limiting (brute force koruması)
- Security headers (XSS, Clickjacking, MIME sniffing)
- Input validation (Pydantic)
- Encrypted password storage
- Session management
- Account lockout

### ⚡ Performans
- LRU cache stratejisi
- Database indexing
- Frontend build optimization (Vite)
- Vendor chunking
- Tree shaking
- Lazy loading

### 🎯 Özellikler
- WireGuard interface yönetimi
- Peer ekleme/düzenleme/silme
- QR kod oluşturma (mobil config)
- Trafik istatistikleri
- Real-time monitoring
- WebSocket desteği
- Kullanıcı yönetimi
- Backup/restore
- Log görüntüleme
- Karanlık mod

---

## 💾 Backup ve Restore

### Otomatik Backup

`deploy.sh` her çalıştırıldığında otomatik backup alır:
```bash
sudo bash deploy.sh
# Backup: backups/router_manager_YYYYMMDD_HHMMSS.db
```

### Manuel Backup

```bash
mkdir -p backups
cp backend/router_manager.db \
   backups/router_manager_$(date +%Y%m%d_%H%M%S).db
```

### Restore

```bash
sudo systemctl stop wg-backend
cp backups/router_manager_20241223.db backend/router_manager.db
sudo systemctl start wg-backend
```

---

## 🆘 Sorun Giderme

### Backend Başlamıyor

```bash
# Log kontrolü
cat backend/logs/backend.log

# Port kontrolü
sudo lsof -i :8001

# Manuel başlatma
cd backend
source venv/bin/activate
python run.py
```

### Frontend Hata Veriyor

```bash
# Build kontrolü
cd frontend
npm install
npm run build

# Dev server
npm run dev
```

### MikroTik Bağlantı Hatası

```bash
# Bağlantı testi
telnet MIKROTIK_IP 8728

# MikroTik API kontrolü
# MikroTik'te: /ip service print
# MikroTik'te: /ip service enable api
```

### Permission Denied

```bash
# Dosya izinleri
sudo chown -R $USER:$USER /path/to/wg-manager

# Script izinleri
chmod +x *.sh
```

---

## 📈 Production Best Practices

### 1. SSL/TLS Kullanın
```bash
sudo certbot --nginx -d yourdomain.com
```

### 2. Güçlü SECRET_KEY
```bash
# Otomatik oluşturulur, değiştirmeyin
grep SECRET_KEY backend/.env
```

### 3. Rate Limiting Ayarlayın
```ini
# Production için
RATE_LIMIT_PER_MINUTE=100
RATE_LIMIT_LOGIN=3
```

### 4. CORS Kısıtlaması
```ini
# Sadece güvenilir domain'ler
CORS_ORIGINS="https://yourdomain.com"
```

### 5. Log Rotation
```bash
# Logrotate yapılandırması
sudo nano /etc/logrotate.d/wg-manager
```

### 6. Database Backup
```bash
# Cron job ekle
crontab -e
# Her gece 2:00
0 2 * * * /opt/wg-manager/backup.sh
```

### 7. Monitoring
```bash
# Health check endpoint
curl http://localhost:8001/health
```

---

## 🎯 Deployment Checklist

### Pre-Deployment
- [ ] Sistem gereksinimleri karşılanıyor
- [ ] Gerekli paketler yüklü
- [ ] MikroTik API erişimi test edildi
- [ ] Domain DNS ayarları yapıldı

### Installation
- [ ] `quick-start.sh` veya `install.sh` çalıştı
- [ ] Dependencies yüklendi
- [ ] Database oluşturuldu

### Configuration
- [ ] `.env` yapılandırıldı
- [ ] `SECRET_KEY` güvenli
- [ ] MikroTik bilgileri girildi
- [ ] CORS production domain'i içeriyor

### Production
- [ ] Frontend build oluşturuldu
- [ ] Systemd servisleri aktif
- [ ] Nginx yapılandırıldı
- [ ] SSL sertifikası kuruldu
- [ ] Firewall yapılandırıldı

### Security
- [ ] Rate limiting aktif
- [ ] Security headers yapılandırıldı
- [ ] Admin şifresi değiştirildi
- [ ] Backup stratejisi oluşturuldu

### Testing
- [ ] Health check çalışıyor
- [ ] Login başarılı
- [ ] MikroTik bağlantısı OK
- [ ] WireGuard işlemleri çalışıyor

---

## 📞 Destek ve Yardım

### Log Toplama
```bash
mkdir -p debug-info
cp backend/logs/*.log debug-info/
sudo journalctl -u wg-backend > debug-info/backend.log
sudo journalctl -u wg-frontend > debug-info/frontend.log
tar -czf debug-info.tar.gz debug-info/
```

### Yararlı Komutlar
```bash
# Sistem bilgisi
uname -a
python3 --version
node --version

# Port dinleme
sudo lsof -i :8001
sudo lsof -i :5173

# Süreç kontrolü
ps aux | grep python
ps aux | grep node

# Disk kullanımı
df -h
du -sh /opt/wg-manager

# Bellek kullanımı
free -h
```

---

## 📚 Ek Kaynaklar

- **DEPLOYMENT.md**: Kapsamlı deployment rehberi
- **SECURITY.md**: Güvenlik kontrol listesi
- **INSTALL.md**: Detaylı kurulum rehberi
- **QUICKSTART.md**: Hızlı başlangıç kılavuzu
- **API Docs**: `http://YOUR_SERVER:8001/docs`

---

## 🎉 Özet

### En Hızlı Kurulum (30 saniye)
```bash
unzip wg-manager.zip && cd wg-manager && sudo bash quick-start.sh
```

### Production Kurulum (5 dakika)
```bash
sudo bash install.sh
bash setup_environment.sh  # production seçin
sudo bash deploy.sh        # nginx: y, domain girin
sudo certbot --nginx -d yourdomain.com
```

### İlk Giriş
```
URL: http://YOUR_SERVER_IP:5173
User: admin
Pass: admin123
```

---

**Versiyon**: 1.0
**Tarih**: 23 Aralık 2025
**Lisans**: MIT

🚀 **Kolay kurulum ve iyi kullanımlar!**
