# MikroTik WireGuard Yönetim Paneli - Kurulum Rehberi

## 📋 İçindekiler

- [Sistem Gereksinimleri](#sistem-gereksinimleri)
- [Hızlı Kurulum](#hızlı-kurulum-tek-komut)
- [Manuel Kurulum](#manuel-kurulum)
- [Production Deployment](#production-deployment)
- [Nginx ile Reverse Proxy](#nginx-ile-reverse-proxy)
- [SSL/TLS Sertifikası](#ssltls-sertifikası)
- [Sorun Giderme](#sorun-giderme)

---

## 🖥️ Sistem Gereksinimleri

### Minimum Gereksinimler

- **İşletim Sistemi:** Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **Python:** 3.9 veya üzeri
- **Node.js:** 16.x veya üzeri
- **RAM:** Minimum 1GB (2GB önerilir)
- **Disk:** 500MB boş alan
- **Network:** MikroTik router'a API erişimi (port 8728)

### Gerekli Yazılımlar

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install python3 python3-pip python3-venv nodejs npm git curl

# CentOS/RHEL
sudo yum install python3 python3-pip nodejs npm git curl
```

---

## 🚀 Hızlı Kurulum (Tek Komut)

### 1. Projeyi İndirin

```bash
# Git ile
git clone <repository-url> wg-manager
cd wg-manager

# Veya zip dosyasını açın
unzip wg-manager.zip
cd wg-manager
```

### 2. Otomatik Kurulum

```bash
sudo bash install.sh
```

Bu script:
- ✅ Tüm gereksinimleri kontrol eder
- ✅ Python ve Node.js bağımlılıklarını yükler
- ✅ Virtual environment oluşturur
- ✅ Veritabanını başlatır
- ✅ `.env` dosyasını oluşturur
- ✅ (Opsiyonel) Systemd servisleri oluşturur

### 3. Environment Yapılandırması

```bash
bash setup_environment.sh
```

Bu script interaktif olarak:
- MikroTik bağlantı bilgilerini sorar
- Development/Production ortamını seçtirir
- Güvenli SECRET_KEY oluşturur
- `.env` dosyasını yapılandırır

### 4. Uygulamayı Başlatın

```bash
bash start_all.sh
```

### 5. Tarayıcıdan Erişin

```
Frontend: http://YOUR_SERVER_IP:5173
Backend:  http://YOUR_SERVER_IP:8001
API Docs: http://YOUR_SERVER_IP:8001/docs
```

---

## 🔧 Manuel Kurulum

Otomatik kurulum yerine adım adım ilerlemek isterseniz:

### 1. Backend Kurulumu

```bash
cd backend

# Virtual environment oluştur
python3 -m venv venv
source venv/bin/activate

# Bağımlılıkları yükle
pip install --upgrade pip
pip install -r requirements.txt

# .env dosyası oluştur
cp .env.example .env

# Güvenli SECRET_KEY oluştur
python3 -c "import secrets; print(secrets.token_hex(32))"
# Çıktıyı .env dosyasındaki SECRET_KEY'e yapıştırın

# MikroTik bilgilerini .env'de düzenleyin
nano .env

# Veritabanını başlat
python3 -c "from app.database import init_db; init_db()"

# Servisi başlat
python3 run.py
```

### 2. Frontend Kurulumu

Yeni bir terminal'de:

```bash
cd frontend

# Bağımlılıkları yükle
npm install

# Development server başlat
npm run dev

# Veya production build
npm run build
```

---

## 🏭 Production Deployment

### Otomatik Production Deployment

```bash
sudo bash deploy.sh
```

Bu script:
- ✅ Güvenlik kontrolü yapar
- ✅ Dependencies güncellemesi yapar
- ✅ Frontend production build oluşturur
- ✅ Database backup alır
- ✅ Systemd servisleri oluşturur ve başlatır
- ✅ (Opsiyonel) Nginx yapılandırması oluşturur
- ✅ Firewall kurallarını ekler

### Manuel Production Adımları

#### 1. Environment Ayarları

```bash
# backend/.env dosyasında:
ENVIRONMENT="production"
SECRET_KEY="<güvenli-random-key>"
CORS_ORIGINS="https://yourdomain.com"
RATE_LIMIT_PER_MINUTE=100
RATE_LIMIT_LOGIN=3
ENABLE_HTTPS_REDIRECT=True
TRUSTED_HOSTS="yourdomain.com"
LOG_LEVEL="WARNING"
```

#### 2. Frontend Production Build

```bash
cd frontend
npm run build
```

#### 3. Systemd Servisleri

Backend servisi (`/etc/systemd/system/wg-backend.service`):

```ini
[Unit]
Description=MikroTik WireGuard Manager Backend
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/wg-manager/backend
Environment="PATH=/path/to/wg-manager/backend/venv/bin"
ExecStart=/path/to/wg-manager/backend/venv/bin/python /path/to/wg-manager/backend/run.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Servisleri başlat:

```bash
sudo systemctl daemon-reload
sudo systemctl start wg-backend
sudo systemctl enable wg-backend
sudo systemctl status wg-backend
```

---

## 🌐 Nginx ile Reverse Proxy

### Nginx Kurulumu

```bash
sudo apt-get install nginx certbot python3-certbot-nginx
```

### Nginx Yapılandırması

`/etc/nginx/sites-available/wg-manager`:

```nginx
upstream backend {
    server 127.0.0.1:8001;
}

server {
    listen 80;
    server_name yourdomain.com;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend (production build)
    location / {
        root /path/to/wg-manager/frontend/dist;
        try_files $uri $uri/ /index.html;
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

    # API Docs
    location /docs {
        proxy_pass http://backend;
    }

    # Health check
    location /health {
        proxy_pass http://backend;
        access_log off;
    }
}
```

Nginx'i etkinleştir:

```bash
sudo ln -s /etc/nginx/sites-available/wg-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔒 SSL/TLS Sertifikası

### Let's Encrypt ile Ücretsiz SSL

```bash
sudo certbot --nginx -d yourdomain.com

# Otomatik yenileme test et
sudo certbot renew --dry-run
```

### Manuel SSL Yapılandırması

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ... diğer ayarlar ...
}

# HTTP'den HTTPS'e yönlendir
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 🔥 Firewall Yapılandırması

### UFW (Ubuntu/Debian)

```bash
# SSH
sudo ufw allow 22/tcp

# HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Development (sadece development için)
sudo ufw allow 8001/tcp
sudo ufw allow 5173/tcp

# UFW'yi etkinleştir
sudo ufw enable
sudo ufw status
```

### firewalld (CentOS/RHEL)

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=8001/tcp
sudo firewall-cmd --reload
```

---

## 📊 Servis Yönetimi

### Durumu Kontrol Et

```bash
# Systemd ile
sudo systemctl status wg-backend
sudo systemctl status wg-frontend

# Manuel çalışan süreçler
bash status.sh
```

### Logları Görüntüle

```bash
# Systemd logları
sudo journalctl -u wg-backend -f
sudo journalctl -u wg-frontend -f

# Dosya logları
tail -f backend/logs/backend.log
tail -f frontend.log
```

### Servisleri Yönet

```bash
# Başlat
sudo systemctl start wg-backend wg-frontend

# Durdur
sudo systemctl stop wg-backend wg-frontend

# Yeniden başlat
sudo systemctl restart wg-backend wg-frontend

# Otomatik başlatmayı etkinleştir
sudo systemctl enable wg-backend wg-frontend
```

---

## 🛠️ Sorun Giderme

### Backend Başlamıyor

```bash
# Log dosyasını kontrol et
cat backend/logs/backend.log

# Port dinlemede mi?
sudo lsof -i :8001

# .env dosyası doğru mu?
cat backend/.env

# Manuel başlatma dene
cd backend
source venv/bin/activate
python run.py
```

### Frontend Başlamıyor

```bash
# Log dosyasını kontrol et
cat frontend.log

# Port dinlemede mi?
sudo lsof -i :5173

# Node modülleri eksik mi?
cd frontend
npm install

# Manuel başlatma dene
npm run dev
```

### MikroTik Bağlantı Hatası

```bash
# MikroTik API erişimi test et
telnet MIKROTIK_IP 8728

# Firewall kuralları kontrol et
# MikroTik router'da API servisinin açık olduğundan emin olun

# .env'deki bağlantı bilgilerini kontrol et
cat backend/.env | grep MIKROTIK
```

### Database Hatası

```bash
# Veritabanını sıfırla (DİKKAT: Tüm data silinir!)
cd backend
rm router_manager.db
python3 -c "from app.database import init_db; init_db()"
```

### Port Çakışması

```bash
# 8001 portunu kullanan süreci bul
sudo lsof -i :8001

# Süreci durdur
sudo kill -9 <PID>

# Veya farklı port kullan (backend/.env'de PORT değişkeni)
```

---

## 📦 Güncelleme

### Uygulamayı Güncellemek

```bash
# Servisleri durdur
sudo systemctl stop wg-backend wg-frontend

# Kodu güncelle
git pull

# Dependencies güncelle
cd backend
source venv/bin/activate
pip install -r requirements.txt
deactivate

cd ../frontend
npm install

# Servisleri başlat
sudo systemctl start wg-backend wg-frontend
```

---

## 💾 Backup ve Restore

### Manuel Backup

```bash
# Database backup
cp backend/router_manager.db backups/router_manager_$(date +%Y%m%d).db

# .env backup
cp backend/.env backups/.env_$(date +%Y%m%d)
```

### Otomatik Backup (Cron)

```bash
# Crontab düzenle
crontab -e

# Her gün saat 02:00'da backup al
0 2 * * * /path/to/wg-manager/backup.sh
```

### Restore

```bash
# Database restore
cp backups/router_manager_YYYYMMDD.db backend/router_manager.db

# Servisi yeniden başlat
sudo systemctl restart wg-backend
```

---

## 📚 Ek Kaynaklar

- **Güvenlik:** Bkz. [SECURITY.md](SECURITY.md)
- **İyileştirmeler:** Bkz. [IMPROVEMENTS_SUMMARY.md](IMPROVEMENTS_SUMMARY.md)
- **API Dökümanı:** http://YOUR_SERVER:8001/docs

---

## 🆘 Destek

Sorun yaşarsanız:

1. Log dosyalarını kontrol edin
2. Sistem gereksinimlerini doğrulayın
3. Firewall kurallarını kontrol edin
4. MikroTik API erişimini test edin

---

**Son Güncelleme:** 22 Aralık 2025
**Versiyon:** 1.0
