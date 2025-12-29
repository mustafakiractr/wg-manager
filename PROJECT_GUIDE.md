# 📘 WireGuard Manager Panel - Proje Rehberi

**Versiyon:** 1.0
**Son Güncelleme:** 29 Aralık 2024

---

## 📖 İçindekiler

1. [Proje Hakkında](#proje-hakkında)
2. [Hızlı Başlangıç](#hızlı-başlangıç)
3. [Kurulum & Deployment](#kurulum--deployment)
4. [Yapılandırma](#yapılandırma)
5. [Güvenlik](#güvenlik)
6. [API Dokümantasyonu](#api-dokümantasyonu)
7. [Sorun Giderme](#sorun-giderme)
8. [Geliştirici Notları](#geliştirici-notları)

---

## 🎯 Proje Hakkında

### Genel Bakış

MikroTik Router Yönetim Paneli, MikroTik RouterOS v7+ cihazlarını yönetmek için geliştirilmiş modern bir web arayüzüdür. WireGuard VPN interface ve peer yönetimini kolaylaştırır.

### Temel Özellikler

✅ **WireGuard Yönetimi**
- Interface oluşturma, düzenleme ve silme
- Peer (client) yönetimi
- QR kod ile kolay bağlantı
- IP Pool otomasyonu

✅ **Dashboard & Analytics**
- Gerçek zamanlı trafik istatistikleri
- Interface ve peer durumu
- Sistem sağlık monitörü
- Grafik ve görselleştirmeler

✅ **Bildirim Sistemi**
- Gerçek zamanlı bildirimler
- Kategori bazlı filtreleme
- Okundu işaretleme

✅ **Aktivite Geçmişi**
- Tüm sistem işlemlerinin kaydı
- Detaylı audit trail
- Kullanıcı bazlı izleme

✅ **IP Pool Yönetimi**
- Otomatik IP dağıtımı
- Pool şablonları
- "auto" keyword desteği

✅ **Peer Templates**
- Hızlı peer oluşturma
- Önceden tanımlı yapılandırmalar
- Toplu işlem desteği

✅ **Güvenlik**
- JWT tabanlı kimlik doğrulama
- Role-based access control (RBAC)
- Rate limiting
- Activity logging

### Teknoloji Yığını

**Backend:**
- Python 3.9+
- FastAPI (async/await)
- SQLAlchemy (async ORM)
- PostgreSQL / SQLite
- JWT Authentication

**Frontend:**
- React 18
- Vite
- Tailwind CSS
- Zustand (state management)
- React Router v6
- Lucide Icons

**Infrastructure:**
- MikroTik RouterOS API
- WebSocket (real-time)
- Systemd services
- Nginx (production)

---

## ⚡ Hızlı Başlangıç

### Ön Gereksinimler

```bash
# Sistem gereksinimleri
- OS: Ubuntu 20.04+, Debian 11+, CentOS 8+
- Python 3.9+
- Node.js 18+
- MikroTik RouterOS v7+
- 1GB RAM (2GB önerilir)
- 1GB disk alanı
```

### Tek Komut Kurulum

```bash
# 1. Projeyi klonlayın
git clone <repository-url> /opt/wg-manager
cd /opt/wg-manager

# 2. Kurulum scriptini çalıştırın
sudo bash install.sh

# 3. Ortam değişkenlerini yapılandırın
bash setup_environment.sh

# 4. Servisleri başlatın
bash start_all.sh
```

### İlk Giriş

```
URL: http://localhost:5173
Kullanıcı: admin
Şifre: admin123

⚠️ İlk girişten sonra şifreyi mutlaka değiştirin!
```

---

## 🚀 Kurulum & Deployment

### Development Kurulumu

#### Backend

```bash
cd backend

# Virtual environment oluştur
python3 -m venv venv
source venv/bin/activate

# Bağımlılıkları yükle
pip install -r requirements.txt

# .env dosyasını yapılandır
cp .env.example .env
nano .env

# Veritabanını başlat
python init_db.py

# Backend'i başlat
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend

```bash
cd frontend

# Bağımlılıkları yükle
npm install

# .env dosyasını yapılandır
cp .env.example .env
nano .env

# Development server'ı başlat
npm run dev
```

### Production Deployment

#### 1. Systemd Services

**Backend Service** (`/etc/systemd/system/router-manager-backend.service`):

```ini
[Unit]
Description=WireGuard Manager API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/wg-manager/backend
Environment="PATH=/opt/wg-manager/backend/venv/bin"
ExecStart=/opt/wg-manager/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

**Frontend Build:**

```bash
cd frontend
npm run build

# dist/ klasörü Nginx ile servis edilir
```

#### 2. Nginx Yapılandırması

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Frontend
    location / {
        root /opt/wg-manager/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

#### 3. SSL Sertifikası (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

#### 4. Servisleri Başlatma

```bash
# Servisleri etkinleştir
sudo systemctl enable router-manager-backend
sudo systemctl enable nginx

# Servisleri başlat
sudo systemctl start router-manager-backend
sudo systemctl start nginx

# Durumu kontrol et
sudo systemctl status router-manager-backend
sudo systemctl status nginx
```

---

## ⚙️ Yapılandırma

### Backend Environment Variables

`backend/.env` dosyası:

```bash
# Uygulama
ENVIRONMENT=production
DEBUG=False
SECRET_KEY=your-very-secret-key-min-32-characters

# Veritabanı
DATABASE_URL=sqlite:///./router_manager.db
# veya PostgreSQL için:
# DATABASE_URL=postgresql+asyncpg://user:pass@localhost/dbname

# MikroTik Bağlantısı
MIKROTIK_HOST=192.168.1.1
MIKROTIK_PORT=8728
MIKROTIK_USERNAME=admin
MIKROTIK_PASSWORD=your-mikrotik-password
MIKROTIK_USE_TLS=False

# JWT
JWT_SECRET_KEY=another-very-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
CORS_ORIGINS=["https://your-domain.com"]

# Rate Limiting
RATE_LIMIT_PER_MINUTE=100
RATE_LIMIT_LOGIN=5

# Logging
LOG_LEVEL=INFO
LOG_FILE=logs/app.log
```

### Frontend Environment Variables

`frontend/.env` dosyası:

```bash
# API URL
VITE_API_URL=http://localhost:8000/api/v1

# Production için:
# VITE_API_URL=https://your-domain.com/api/v1

# WebSocket URL
VITE_WS_URL=ws://localhost:8000/ws

# Production için:
# VITE_WS_URL=wss://your-domain.com/ws
```

### MikroTik Yapılandırması

```routeros
# API servisini etkinleştir
/ip service
set api disabled=no port=8728

# API kullanıcısı oluştur (önerilir)
/user add name=api-user group=full password=strong-password

# TLS kullanmak için (önerilir):
/ip service
set api-ssl disabled=no port=8729
```

---

## 🔐 Güvenlik

### Production Kontrol Listesi

#### 1. Environment Variables
- [ ] `ENVIRONMENT="production"` ayarlandı
- [ ] `SECRET_KEY` güçlü ve benzersiz (min 32 karakter)
- [ ] `MIKROTIK_PASSWORD` güçlü şifre
- [ ] `CORS_ORIGINS` sadece gerçek domain'leri içeriyor
- [ ] `DEBUG=False` ayarlandı

#### 2. HTTPS Yapılandırması
- [ ] SSL/TLS sertifikası kuruldu
- [ ] HTTP trafiği HTTPS'e yönlendiriliyor
- [ ] `MIKROTIK_USE_TLS=True` (MikroTik destekliyorsa)

#### 3. Firewall
```bash
# UFW yapılandırması
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

#### 4. Rate Limiting
- [ ] `RATE_LIMIT_PER_MINUTE` ayarlandı (100-200)
- [ ] `RATE_LIMIT_LOGIN` düşük (3-5)
- [ ] Login brute force koruması aktif

#### 5. Database
- [ ] Düzenli yedekleme yapılıyor
- [ ] Database dosyası izinleri doğru (`chmod 600`)
- [ ] Production için PostgreSQL kullanılıyor

#### 6. Şifre Politikaları
- [ ] Varsayılan admin şifresi değiştirildi
- [ ] Minimum şifre uzunluğu: 8 karakter
- [ ] Şifreler bcrypt ile hash'leniyor ✅

#### 7. Logging & Monitoring
- [ ] Activity logging aktif
- [ ] Başarısız login denemeleri izleniyor
- [ ] Kritik işlemler loglanıyor

### Güvenlik En İyi Uygulamaları

**1. Kullanıcı Yönetimi:**
- İlk kurulumda admin şifresini değiştirin
- Gereksiz kullanıcıları silin
- Her kullanıcıya minimum gerekli yetkileri verin

**2. Network Güvenliği:**
- MikroTik API'ye sadece güvenilir IP'lerden erişim
- VPN üzerinden yönetim tercih edin
- Firewall kurallarını düzenli gözden geçirin

**3. Uygulama Güvenliği:**
- Düzenli güncelleme yapın
- Bağımlılıkları güncel tutun (`pip list --outdated`)
- Security patch'leri hızlıca uygulayın

**4. Veri Güvenliği:**
- Düzenli veritabanı yedeği
- Yedekleri farklı lokasyonda saklayın
- Yedekleri şifreleyerek saklayın

---

## 📡 API Dokümantasyonu

### Authentication

#### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}

Response:
{
  "access_token": "eyJ0eXAi...",
  "refresh_token": "eyJ0eXAi...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

#### Refresh Token
```http
POST /api/v1/auth/refresh
Authorization: Bearer {refresh_token}

Response:
{
  "access_token": "eyJ0eXAi...",
  "token_type": "bearer"
}
```

### WireGuard Management

#### List Interfaces
```http
GET /api/v1/wg/interfaces
Authorization: Bearer {access_token}

Response:
[
  {
    "name": "wg0",
    "listen_port": 51820,
    "public_key": "...",
    "disabled": false,
    "peer_count": 5
  }
]
```

#### Get Interface Details
```http
GET /api/v1/wg/interface/{name}
Authorization: Bearer {access_token}
```

#### Toggle Interface
```http
POST /api/v1/wg/interface/{name}/toggle
Authorization: Bearer {access_token}
```

#### List Peers
```http
GET /api/v1/wg/peers/{interface}
Authorization: Bearer {access_token}

Response:
[
  {
    "id": ".id*1",
    "public_key": "...",
    "allowed_address": "10.10.1.2/32",
    "current_endpoint": "1.2.3.4:51820",
    "last_handshake": "2024-12-29T10:00:00",
    "rx": 1024000,
    "tx": 2048000,
    "comment": "Mobile Device"
  }
]
```

#### Create Peer
```http
POST /api/v1/wg/peer/add
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "interface": "wg0",
  "allowed_address": "10.10.1.10/32",
  "comment": "New Device"
}

Response:
{
  "success": true,
  "peer_id": ".id*5",
  "public_key": "...",
  "private_key": "...",
  "config": "..."
}
```

#### Delete Peer
```http
DELETE /api/v1/wg/peer/{peer_id}
Authorization: Bearer {access_token}
```

#### Generate QR Code
```http
GET /api/v1/wg/peer/{peer_id}/qrcode
Authorization: Bearer {access_token}

Response: PNG image (QR code)
```

### Activity Logs

#### Get Logs
```http
GET /api/v1/activity-logs
Authorization: Bearer {access_token}
Query Parameters:
  - limit: int (default: 50, max: 500)
  - offset: int (default: 0)
  - user_id: int (optional)
  - category: str (optional: auth, user, wireguard, mikrotik, system)
  - action: str (optional)
  - success: str (optional: success, failure, error)
  - start_date: datetime (optional)
  - end_date: datetime (optional)
```

#### Get Recent Activity
```http
GET /api/v1/activity-logs/recent
Authorization: Bearer {access_token}
Query Parameters:
  - limit: int (default: 10)
  - hours: int (default: 24)
```

### Notifications

#### Get Notifications
```http
GET /api/v1/notifications
Authorization: Bearer {access_token}
```

#### Get Unread Count
```http
GET /api/v1/notifications/unread-count
Authorization: Bearer {access_token}
```

#### Mark as Read
```http
POST /api/v1/notifications/{id}/read
Authorization: Bearer {access_token}
```

---

## 🔧 Sorun Giderme

### Yaygın Sorunlar ve Çözümleri

#### 1. Backend Başlamıyor

**Hata:** `ModuleNotFoundError`
```bash
# Çözüm: Virtual environment'ı aktifleştir ve bağımlılıkları yükle
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

**Hata:** `Database locked`
```bash
# Çözüm: Database dosyasını kontrol et
ls -l backend/router_manager.db
# İzinleri düzelt
chmod 644 backend/router_manager.db
```

#### 2. MikroTik Bağlantı Hatası

**Hata:** `Connection refused`
```bash
# MikroTik'te API servisinin açık olduğunu kontrol et
/ip service print
# API servisini etkinleştir
/ip service set api disabled=no
```

**Hata:** `Login failed`
```bash
# Kullanıcı adı ve şifreyi kontrol et
# .env dosyasındaki bilgileri gözden geçir
nano backend/.env
```

#### 3. Frontend Çalışmıyor

**Hata:** `CORS error`
```bash
# Backend'de CORS ayarlarını kontrol et
# backend/.env dosyasında:
CORS_ORIGINS=["http://localhost:5173"]
```

**Hata:** `API connection failed`
```bash
# Frontend .env dosyasında API URL'i kontrol et
nano frontend/.env
# VITE_API_URL doğru olmalı
```

#### 4. WebSocket Bağlantı Sorunu

```bash
# Nginx yapılandırmasını kontrol et
# /ws endpoint'i için upgrade header'ları eklenmiş olmalı

# Backend loglarını kontrol et
tail -f backend/logs/app.log

# Frontend console'da WebSocket durumunu kontrol et
```

#### 5. Servis Yeniden Başlatma

```bash
# Tüm servisleri yeniden başlat
bash restart_services.sh

# Sadece backend
sudo systemctl restart router-manager-backend

# Sadece frontend (production)
sudo systemctl restart nginx

# Development modunda
# Backend: Ctrl+C ile durdur, tekrar başlat
# Frontend: Ctrl+C ile durdur, npm run dev
```

#### 6. Log Kontrolü

```bash
# Backend logları
tail -f backend/logs/app.log

# Systemd servis logları
sudo journalctl -u router-manager-backend -f

# Nginx logları
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Veritabanı Sorunları

#### Database Reset

```bash
cd backend
source venv/bin/activate

# Mevcut database'i yedekle
cp router_manager.db router_manager.db.backup

# Yeni database oluştur
python init_db.py
```

#### Database Migration

```bash
# Alembic ile migration (gelecek özellik)
# Şu an için manuel SQL çalıştırma:
sqlite3 backend/router_manager.db < migration.sql
```

---

## 💻 Geliştirici Notları

### Proje Yapısı

```
wg-manager/
├── backend/
│   ├── app/
│   │   ├── api/              # API endpoints
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── wireguard.py
│   │   │   ├── activity_logs.py
│   │   │   └── notifications.py
│   │   ├── models/           # Database models
│   │   │   ├── user.py
│   │   │   ├── activity_log.py
│   │   │   ├── notification.py
│   │   │   └── ip_pool.py
│   │   ├── services/         # Business logic
│   │   │   ├── activity_log_service.py
│   │   │   ├── notification_service.py
│   │   │   └── wireguard_service.py
│   │   ├── mikrotik/         # MikroTik API client
│   │   ├── database/         # Database config
│   │   ├── security/         # Auth & security
│   │   ├── utils/            # Utilities
│   │   ├── websocket/        # WebSocket handlers
│   │   └── main.py           # FastAPI app
│   ├── logs/
│   ├── requirements.txt
│   └── init_db.py
│
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── Layout.jsx
│   │   │   ├── NotificationDropdown.jsx
│   │   │   └── ...
│   │   ├── pages/            # Page components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── WireGuardInterfaces.jsx
│   │   │   ├── ActivityLogs.jsx
│   │   │   └── ...
│   │   ├── services/         # API services
│   │   ├── store/            # Zustand stores
│   │   ├── context/          # React contexts
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── archive/                  # Arşivlenmiş dokümantasyon
├── systemd/                  # Systemd service files
├── README.md                 # Proje özeti
└── PROJECT_GUIDE.md         # Bu dosya
```

### Development Workflow

#### 1. Feature Development

```bash
# 1. Yeni branch oluştur
git checkout -b feature/new-feature

# 2. Backend değişiklikleri
cd backend
source venv/bin/activate
# Kod yaz, test et

# 3. Frontend değişiklikleri
cd ../frontend
# Kod yaz, test et

# 4. Commit ve push
git add .
git commit -m "feat: Add new feature"
git push origin feature/new-feature
```

#### 2. Testing

```bash
# Backend testleri (gelecek özellik)
cd backend
pytest

# Frontend testleri
cd frontend
npm run test

# E2E testleri (gelecek özellik)
npm run test:e2e
```

#### 3. Code Style

**Backend (Python):**
```bash
# Black formatter
black app/

# Flake8 linter
flake8 app/

# Type checking
mypy app/
```

**Frontend (JavaScript):**
```bash
# ESLint
npm run lint

# Prettier
npm run format
```

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user',
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT 1,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Activity Logs Table
```sql
CREATE TABLE activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    action TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    extra_data TEXT,
    success TEXT DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### Notifications Table
```sql
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### API Response Formats

#### Success Response
```json
{
  "success": true,
  "data": { /* ... */ },
  "message": "Operation successful"
}
```

#### Error Response
```json
{
  "detail": "Error message",
  "status_code": 400
}
```

#### Paginated Response
```json
{
  "items": [ /* ... */ ],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

### Önemli Notlar

1. **Async/Await**: Tüm database işlemleri async
2. **Error Handling**: Try-catch blokları ile hata yönetimi
3. **Logging**: Her kritik işlem loglanmalı
4. **Security**: Tüm endpoint'ler JWT ile korunmalı (auth hariç)
5. **Rate Limiting**: Brute force koruması için rate limit
6. **CORS**: Production'da sadece güvenilir origin'lere izin

---

## 📚 Referanslar

### Dokümantasyon
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [MikroTik API Documentation](https://help.mikrotik.com/docs/display/ROS/API)
- [WireGuard Documentation](https://www.wireguard.com/quickstart/)

### Kütüphaneler
- [SQLAlchemy](https://docs.sqlalchemy.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Zustand](https://github.com/pmndrs/zustand)
- [React Router](https://reactrouter.com/)

### Araçlar
- [Let's Encrypt](https://letsencrypt.org/)
- [Nginx](https://nginx.org/en/docs/)
- [Systemd](https://systemd.io/)

---

## 📝 Changelog

### v1.0.0 (29 Aralık 2024)
- ✅ WireGuard interface ve peer yönetimi
- ✅ Dashboard & Analytics
- ✅ IP Pool yönetimi
- ✅ Peer Templates
- ✅ Bildirim sistemi
- ✅ Aktivite geçmişi
- ✅ Kullanıcı yönetimi
- ✅ JWT authentication
- ✅ WebSocket desteği

---

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'feat: Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request açın

---

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

---

## 🆘 Destek

Sorular ve sorunlar için:
- GitHub Issues
- Email: support@example.com

---

**Son güncelleme:** 29 Aralık 2024
**Geliştirici:** Claude Sonnet 4.5
