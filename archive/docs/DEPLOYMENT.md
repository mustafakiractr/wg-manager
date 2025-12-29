# 🚀 MikroTik WireGuard Yönetim Paneli - Deployment Rehberi

## 📦 Hızlı Başlangıç (Yeni Makine)

### Tek Komutla Kurulum

```bash
# 1. Zip dosyasını yeni makineye kopyalayın
scp wg-manager.zip user@new-server:/opt/

# 2. Sunucuya bağlanın
ssh user@new-server

# 3. Zip'i açın ve kurulumu başlatın
cd /opt
unzip wg-manager.zip
cd wg-manager
sudo bash quick-start.sh
```

Bu kadar! Uygulama otomatik olarak kurulup başlatılacak.

---

## 📋 Kurulum Adımları Detaylı

### 1. Sistem Hazırlığı

#### Minimum Gereksinimler
- **OS**: Ubuntu 20.04+, Debian 11+, CentOS 8+
- **CPU**: 1 core
- **RAM**: 1GB (2GB önerilir)
- **Disk**: 1GB boş alan
- **Python**: 3.9+
- **Node.js**: 16+

#### Gerekli Paketler

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-venv nodejs npm git curl build-essential

# CentOS/RHEL
sudo yum install -y python3 python3-pip nodejs npm git curl gcc
```

---

### 2. Projeyi Deploy Etme

#### A) Zip Dosyası ile (Önerilen)

```bash
# 1. Zip dosyasını hedef sunucuya kopyala
scp wg-manager.zip user@server:/opt/

# 2. Sunucuya bağlan
ssh user@server

# 3. Açma ve kurulum
cd /opt
unzip wg-manager.zip
cd wg-manager

# 4. Quick start ile otomatik kurulum
sudo bash quick-start.sh
```

#### B) Git ile

```bash
# 1. Repository'yi clone et
git clone <your-repo-url> /opt/wg-manager
cd /opt/wg-manager

# 2. Kurulumu başlat
sudo bash install.sh

# 3. Environment yapılandır
bash setup_environment.sh

# 4. Başlat
bash start_all.sh
```

---

### 3. Yapılandırma

#### Environment Ayarları

```bash
# Interaktif yapılandırma
bash setup_environment.sh
```

Bu script size soracak:
1. **Environment**: Development / Production
2. **MikroTik IP**: Router IP adresi
3. **MikroTik Port**: API portu (varsayılan: 8728)
4. **MikroTik Kullanıcı**: API erişimi olan kullanıcı
5. **MikroTik Şifre**: Kullanıcı şifresi
6. **TLS Kullanımı**: TLS aktif mi? (evet/hayır)

#### Manuel Yapılandırma

```bash
nano backend/.env
```

```ini
# Ortam
ENVIRONMENT="production"

# Güvenlik
SECRET_KEY="<otomatik-oluşturulan-güvenli-key>"

# MikroTik Bağlantı
MIKROTIK_HOST="192.168.1.1"
MIKROTIK_PORT=8728
MIKROTIK_USERNAME="admin"
MIKROTIK_PASSWORD="your-password"
MIKROTIK_USE_TLS=False

# CORS (Production için kendi domain'inizi ekleyin)
CORS_ORIGINS="http://localhost:5173,http://YOUR-SERVER-IP:5173,https://yourdomain.com"

# Rate Limiting
RATE_LIMIT_PER_MINUTE=100
RATE_LIMIT_LOGIN=3

# Database
DATABASE_URL="sqlite:///./router_manager.db"
```

---

### 4. Servis Yönetimi

#### Development Modu

```bash
# Tüm servisleri başlat
bash start_all.sh

# Durumu kontrol et
bash status.sh

# Yeniden başlat
bash restart_all.sh

# Durdur
pkill -f 'python.*run.py' && pkill -f 'vite'
```

#### Production Modu (Systemd)

```bash
# Production deployment (Systemd servisleri oluşturur)
sudo bash deploy.sh

# Servis yönetimi
sudo systemctl start wg-backend wg-frontend
sudo systemctl stop wg-backend wg-frontend
sudo systemctl restart wg-backend wg-frontend
sudo systemctl status wg-backend wg-frontend

# Otomatik başlatma
sudo systemctl enable wg-backend wg-frontend

# Logları görüntüle
sudo journalctl -u wg-backend -f
sudo journalctl -u wg-frontend -f
```

---

### 5. Nginx Reverse Proxy (Production)

#### Otomatik Kurulum

```bash
# deploy.sh script'i çalıştırırken Nginx yapılandırması oluşturma seçeneği sunulur
sudo bash deploy.sh
# "Nginx reverse proxy yapılandırması oluşturulsun mu?" -> y
```

#### Manuel Nginx Kurulumu

```bash
# Nginx kurulumu
sudo apt-get install -y nginx

# Konfigürasyon dosyası oluştur
sudo nano /etc/nginx/sites-available/wg-manager
```

```nginx
upstream backend {
    server 127.0.0.1:8001;
}

server {
    listen 80;
    server_name yourdomain.com;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend (Static Files)
    location / {
        root /opt/wg-manager/frontend/dist;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API Documentation
    location /docs {
        proxy_pass http://backend;
        proxy_set_header Host $host;
    }

    # WebSocket Support
    location /ws {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

```bash
# Enable ve reload
sudo ln -s /etc/nginx/sites-available/wg-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

### 6. SSL/TLS Sertifikası

#### Let's Encrypt (Ücretsiz)

```bash
# Certbot kurulumu
sudo apt-get install -y certbot python3-certbot-nginx

# SSL sertifikası al ve Nginx'i otomatik yapılandır
sudo certbot --nginx -d yourdomain.com

# Otomatik yenileme test
sudo certbot renew --dry-run
```

#### Manuel SSL

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/ssl/certs/your-cert.pem;
    ssl_certificate_key /etc/ssl/private/your-key.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ... rest of config ...
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

### 7. Güvenlik Yapılandırması

#### Firewall (UFW)

```bash
# UFW kurulumu ve temel kurallar
sudo apt-get install -y ufw

# SSH (değiştirdiyseniz kendi port'unuzu kullanın)
sudo ufw allow 22/tcp

# HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Development (sadece gerekirse)
sudo ufw allow 8001/tcp  # Backend API
sudo ufw allow 5173/tcp  # Frontend Dev

# UFW etkinleştir
sudo ufw enable
sudo ufw status
```

#### Production Güvenlik Kontrol Listesi

- [ ] `SECRET_KEY` güçlü ve unique
- [ ] `ENVIRONMENT="production"` ayarlandı
- [ ] `CORS_ORIGINS` sadece güvenilir domain'leri içeriyor
- [ ] Rate limiting aktif
- [ ] Firewall yapılandırıldı
- [ ] SSL/TLS sertifikası kurulu
- [ ] Database backup stratejisi oluşturuldu
- [ ] Log rotation yapılandırıldı
- [ ] MikroTik kullanıcısı sadece gerekli izinlere sahip

Detaylı güvenlik bilgileri için: [SECURITY.md](SECURITY.md)

---

### 8. Monitoring ve Logging

#### Log Dosyaları

```bash
# Backend logs
tail -f backend/logs/backend.log
sudo journalctl -u wg-backend -f

# Frontend logs
tail -f frontend.log
sudo journalctl -u wg-frontend -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

#### Health Check Endpoint

```bash
# Backend health check
curl http://localhost:8001/health

# API status
curl http://localhost:8001/api/v1/health
```

---

### 9. Backup ve Restore

#### Otomatik Backup (deploy.sh ile)

`deploy.sh` scripti her çalıştırıldığında otomatik olarak database backup alır:
- Konum: `backups/router_manager_YYYYMMDD_HHMMSS.db`
- Eski backuplar otomatik silinir (30 gün+)

#### Manuel Backup

```bash
# Database backup
mkdir -p backups
cp backend/router_manager.db backups/router_manager_$(date +%Y%m%d_%H%M%S).db

# .env backup
cp backend/.env backups/.env_$(date +%Y%m%d)

# Tüm projeyi backup
tar -czf wg-manager-backup_$(date +%Y%m%d).tar.gz \
  --exclude='node_modules' \
  --exclude='venv' \
  --exclude='*.log' \
  --exclude='__pycache__' \
  /opt/wg-manager
```

#### Cron ile Otomatik Backup

```bash
# Crontab düzenle
crontab -e

# Her gece 2:00'da backup al
0 2 * * * /opt/wg-manager/scripts/backup.sh
```

Backup scripti (`scripts/backup.sh`):

```bash
#!/bin/bash
BACKUP_DIR="/opt/wg-manager/backups"
mkdir -p "$BACKUP_DIR"
cp /opt/wg-manager/backend/router_manager.db \
   "$BACKUP_DIR/router_manager_$(date +\%Y\%m\%d_\%H\%M\%S).db"
# 30 günden eski backupları sil
find "$BACKUP_DIR" -name "router_manager_*.db" -mtime +30 -delete
```

#### Restore

```bash
# Database restore
sudo systemctl stop wg-backend
cp backups/router_manager_20241220_140000.db backend/router_manager.db
sudo systemctl start wg-backend
```

---

### 10. Güncelleme

#### Uygulama Güncellemesi

```bash
# 1. Servisleri durdur
sudo systemctl stop wg-backend wg-frontend

# 2. Backup al
cp backend/router_manager.db backups/backup_before_update.db

# 3. Kodu güncelle (git kullanıyorsanız)
git pull

# 4. Dependencies güncelle
cd backend
source venv/bin/activate
pip install -r requirements.txt
deactivate

cd ../frontend
npm install

# 5. Frontend rebuild (production)
npm run build

# 6. Servisleri başlat
sudo systemctl start wg-backend wg-frontend
```

---

## 🎯 Hızlı Referans

### Erişim URL'leri

```
# Development
Frontend:  http://SERVER_IP:5173
Backend:   http://SERVER_IP:8001
API Docs:  http://SERVER_IP:8001/docs

# Production (Nginx ile)
App:       https://yourdomain.com
API Docs:  https://yourdomain.com/docs
```

### Varsayılan Giriş

```
Username: admin
Password: admin123
```

⚠️ **İlk girişten sonra mutlaka değiştirin!**

### Önemli Komutlar

```bash
# Kurulum
sudo bash install.sh              # İlk kurulum
bash setup_environment.sh         # Environment yapılandırma
sudo bash deploy.sh               # Production deployment

# Servis Yönetimi
bash start_all.sh                 # Başlat (dev)
bash status.sh                    # Durum kontrol
bash restart_all.sh               # Yeniden başlat (dev)
sudo systemctl restart wg-backend # Yeniden başlat (prod)

# Loglar
tail -f backend/logs/backend.log  # Backend log
sudo journalctl -u wg-backend -f  # Systemd log

# Backup
sudo bash deploy.sh               # Otomatik backup alır
```

---

## 🛠️ Sorun Giderme

### "Backend başlamıyor"

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

### "MikroTik'e bağlanamıyor"

```bash
# Bağlantı testi
telnet MIKROTIK_IP 8728

# .env kontrol
cat backend/.env | grep MIKROTIK

# MikroTik API servisinin aktif olduğundan emin olun
# MikroTik'te: /ip service print
```

### "Frontend 404 hatası veriyor"

```bash
# Build kontrolü
ls -la frontend/dist

# Yeniden build
cd frontend
npm run build

# Nginx config kontrolü (production)
sudo nginx -t
```

### "Permission denied"

```bash
# Dosya izinleri
sudo chown -R $USER:$USER /opt/wg-manager

# Script izinleri
chmod +x install.sh deploy.sh setup_environment.sh
```

---

## 📊 Performans Optimizasyonu

### Production Ayarları

Backend `.env`:
```ini
ENVIRONMENT="production"
LOG_LEVEL="WARNING"
RATE_LIMIT_PER_MINUTE=100
```

### Cache Ayarları

```python
# backend/.env
CACHE_TTL=300  # 5 dakika
CACHE_MAX_SIZE=1000
```

### Database Optimizasyonu

```bash
# SQLite vacuum (database optimize)
sqlite3 backend/router_manager.db "VACUUM;"

# PostgreSQL'e geçiş (büyük deploymentlar için)
# .env.production.example dosyasına bakın
```

---

## 📚 Ek Dokümantasyon

- **Güvenlik**: [SECURITY.md](SECURITY.md)
- **İyileştirmeler**: [IMPROVEMENTS_SUMMARY.md](IMPROVEMENTS_SUMMARY.md)
- **Kurulum**: [INSTALL.md](INSTALL.md)
- **Hızlı Başlangıç**: [QUICKSTART.md](QUICKSTART.md)
- **API Dokümantasyonu**: http://YOUR_SERVER:8001/docs

---

## 🆘 Destek

### Loglar ve Debug

```bash
# Tüm logları topla
mkdir -p debug-info
cp backend/logs/*.log debug-info/
sudo journalctl -u wg-backend > debug-info/systemd-backend.log
sudo journalctl -u wg-frontend > debug-info/systemd-frontend.log
cp backend/.env debug-info/.env
tar -czf debug-info.tar.gz debug-info/
```

### Yararlı Kaynaklar

- MikroTik API Dokümantasyonu
- WireGuard Resmi Dokümantasyonu
- FastAPI Dokümantasyonu
- React + Vite Dokümantasyonu

---

**Hazırlayan**: MikroTik WireGuard Manager Team
**Versiyon**: 1.0
**Tarih**: 23 Aralık 2025
**Lisans**: MIT

---

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] Sistem gereksinimleri karşılanıyor
- [ ] Gerekli paketler yüklü (Python, Node.js)
- [ ] MikroTik API erişimi test edildi
- [ ] Domain/DNS ayarları yapıldı (production için)

### Installation
- [ ] Proje dosyaları kopyalandı
- [ ] `install.sh` başarıyla çalıştı
- [ ] Backend dependencies yüklendi
- [ ] Frontend dependencies yüklendi
- [ ] Database oluşturuldu

### Configuration
- [ ] `.env` dosyası yapılandırıldı
- [ ] `SECRET_KEY` güvenli değer ile değiştirildi
- [ ] MikroTik bağlantı bilgileri girildi
- [ ] CORS origins production domain'i içeriyor
- [ ] Environment `production` olarak ayarlandı

### Production Setup
- [ ] Frontend production build oluşturuldu
- [ ] Systemd servisleri oluşturuldu ve aktif
- [ ] Nginx reverse proxy yapılandırıldı
- [ ] SSL/TLS sertifikası kuruldu
- [ ] Firewall kuralları eklendi

### Security
- [ ] Rate limiting aktif
- [ ] Security headers yapılandırıldı
- [ ] Admin şifresi değiştirildi
- [ ] Backup stratejisi oluşturuldu
- [ ] Log rotation yapılandırıldı

### Testing
- [ ] Backend health check başarılı
- [ ] Frontend erişilebilir
- [ ] Login çalışıyor
- [ ] MikroTik bağlantısı çalışıyor
- [ ] WireGuard işlemleri test edildi

### Post-Deployment
- [ ] Monitoring kuruldu
- [ ] Backup cron job eklendi
- [ ] Documentation güncellendi
- [ ] Team'e erişim bilgileri paylaşıldı

---

🎉 **Başarılı deployment için bu checklist'i kullanın!**
