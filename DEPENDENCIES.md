# 📦 Bağımlılıklar - WireGuard Manager

**Versiyon:** 1.0  
**Son Güncelleme:** 31 Aralık 2024

---

## 🎯 Genel Bakış

Bu dokümantasyon, WireGuard Manager Panel'in çalışması için gerekli tüm yazılım bağımlılıklarını listeler. **Kurulum scriptleri (`install.sh`) tüm bu bağımlılıkları otomatik olarak yükler.**

---

## 🖥️ Sistem Gereksinimleri

### İşletim Sistemi
- ✅ Ubuntu 20.04+ / Debian 11+
- ✅ CentOS 8+ / RHEL 8+
- ✅ Fedora 34+

### Minimum Donanım
- **RAM:** 1GB (2GB önerilir)
- **Disk:** 1GB boş alan
- **CPU:** 1 çekirdek (2+ önerilir)

---

## 🔧 Otomatik Yüklenen Bağımlılıklar

### 1. Programlama Dilleri

#### Python 3.9+
**Kurulum:** Otomatik (install.sh)
- Ubuntu/Debian: Python 3.11 (deadsnakes PPA)
- CentOS/RHEL: Python 3.9
- **Kullanım:** FastAPI backend

**Paketler:**
```
python3.11 / python39
python3.11-venv / python39-venv
python3.11-dev / python39-devel
python3-pip
```

#### Node.js 20.x LTS
**Kurulum:** Otomatik (NodeSource repository)
- Ubuntu/Debian: deb.nodesource.com
- CentOS/RHEL: rpm.nodesource.com
- **Kullanım:** React frontend (Vite)

**Paketler:**
```
nodejs (v20.x)
npm (v10.x)
```

---

### 2. Veritabanı

#### PostgreSQL 15+
**Kurulum:** Otomatik (install.sh) - **Production Varsayılan**
- Ubuntu/Debian: PostgreSQL APT Repository
- CentOS/RHEL: postgresql-server

**Yapılandırma (Otomatik):**
- Database: `wg_manager`
- User: `wg_user`
- Password: `wg_secure_pass_2025`
- Authentication: MD5 (pg_hba.conf)

**Paketler:**
```bash
# Ubuntu/Debian
postgresql
postgresql-contrib
libpq-dev  # psycopg2 için gerekli

# CentOS/RHEL
postgresql-server
postgresql-contrib
postgresql-devel  # psycopg2 için gerekli
```

**Port:** 5432 (varsayılan)

#### SQLite (Opsiyonel)
**Kurulum:** Sistem paketi olarak yüklenir
- **Kullanım:** Geliştirme ortamı (production'da PostgreSQL önerilir)

---

### 3. Sistem Paketleri

#### Build Araçları
**Kurulum:** Otomatik

**Ubuntu/Debian:**
```bash
build-essential     # GCC, make, vb.
libssl-dev          # OpenSSL headers
libffi-dev          # Foreign Function Interface
python3-dev         # Python headers
python3-venv        # Virtual environment
libpq-dev           # PostgreSQL headers (psycopg2)
```

**CentOS/RHEL:**
```bash
Development Tools   # GCC, make, vb.
openssl-devel       # OpenSSL headers
libffi-devel        # Foreign Function Interface
python3-devel       # Python headers
postgresql-devel    # PostgreSQL headers
```

#### Yardımcı Araçlar
```bash
curl                # HTTP istemcisi
wget                # Dosya indirme
git                 # Version control
sqlite3             # SQLite CLI (opsiyonel)
```

---

### 4. Python Paketleri (Backend)

**Kurulum:** `pip install -r requirements.txt` (otomatik)

#### Framework & Server
```python
fastapi==0.104.1              # Modern web framework
uvicorn[standard]==0.24.0     # ASGI server
```

#### Database & ORM
```python
sqlalchemy>=2.0.31            # Async ORM
alembic==1.12.1               # Database migration
psycopg2-binary>=2.9.9        # PostgreSQL adapter (binary)
asyncpg>=0.29.0               # Async PostgreSQL driver
aiosqlite==0.19.0             # Async SQLite driver
```

#### Authentication & Security
```python
python-jose[cryptography]==3.3.0  # JWT tokens
passlib[bcrypt]==1.7.4            # Password hashing
pyotp==2.9.0                      # 2FA (TOTP)
slowapi==0.1.9                    # Rate limiting
```

#### Configuration & Validation
```python
python-dotenv==1.0.0          # .env dosyası desteği
pydantic>=2.8.0               # Data validation
pydantic-settings>=2.1.0      # Settings management
email-validator>=2.0.0        # Email doğrulama
```

#### MikroTik Integration
```python
routeros-api==0.19.0          # MikroTik RouterOS API client
```

#### File Handling
```python
python-multipart==0.0.6       # Form data handling
aiofiles==23.2.1              # Async file I/O
```

#### QR Code Generation
```python
qrcode[pil]==7.4.2            # QR kod oluşturma
Pillow>=11.0.0                # Image processing
```

#### Utilities
```python
user-agents==2.2.0            # User agent parsing
```

**Toplam:** ~21 ana paket + bağımlılıkları

---

### 5. Node.js Paketleri (Frontend)

**Kurulum:** `npm install` (otomatik)

#### Framework & Build
```json
"react": "^18.3.1"              // UI framework
"react-dom": "^18.3.1"          // React DOM renderer
"vite": "^5.0.8"                // Build tool & dev server
```

#### Routing & State
```json
"react-router-dom": "^6.21.1"   // Client-side routing
"zustand": "^4.4.7"             // State management
```

#### HTTP & WebSocket
```json
"axios": "^1.6.5"               // HTTP client
```

#### UI Components & Icons
```json
"lucide-react": "^0.303.0"      // Icon library
```

#### Styling
```json
"tailwindcss": "^3.4.0"         // CSS framework
"autoprefixer": "^10.4.16"      // CSS post-processor
"postcss": "^8.4.33"            // CSS transformer
```

#### Charts & Visualization
```json
"chart.js": "^4.4.1"            // Charting library
"react-chartjs-2": "^5.2.0"     // React wrapper for Chart.js
```

**Toplam:** ~10 ana paket + 200+ bağımlılık

---

## 🚀 Kurulum Süreci

### Tek Komut Kurulum
```bash
sudo bash quick-start.sh
```

**Adımlar (Otomatik):**
1. ✅ Sistem paketleri güncelleme
2. ✅ Python 3.11 kurulumu (Ubuntu/Debian)
3. ✅ Node.js 20.x kurulumu (NodeSource)
4. ✅ PostgreSQL 15+ kurulumu
5. ✅ PostgreSQL database ve user oluşturma
6. ✅ Sistem paketleri (build-essential, libpq-dev, vb.)
7. ✅ Backend virtual environment oluşturma
8. ✅ Backend bağımlılıkları (pip install)
9. ✅ Frontend bağımlılıkları (npm install)
10. ✅ Environment yapılandırması (MikroTik bilgileri)
11. ✅ Systemd servisleri (opsiyonel)

**Süre:** ~5-10 dakika (internet hızına bağlı)

---

## 🔍 Bağımlılık Doğrulama

### Manuel Kontrol

```bash
# Python versiyonu
python3 --version  # ≥3.9

# Node.js versiyonu
node --version     # ≥20.0

# PostgreSQL versiyonu
psql --version     # ≥15.0

# npm versiyonu
npm --version      # ≥10.0

# PostgreSQL servisi
systemctl status postgresql

# Database kontrolü
sudo -u postgres psql -c "\l" | grep wg_manager
```

### Script ile Kontrol
```bash
bash TEST-BACKEND.sh
```

---

## 📝 Production Notları

### Önerilen Yapılandırma
- ✅ PostgreSQL kullanın (SQLite production'da yetersiz)
- ✅ HTTPS/TLS etkinleştirin (nginx/apache reverse proxy)
- ✅ Firewall kurallarını yapılandırın (ufw/iptables)
- ✅ Düzenli database yedeklemesi
- ✅ Log rotation ayarları

### Performans İyileştirmeleri
- PostgreSQL shared_buffers: 256MB+
- PostgreSQL max_connections: 100
- Backend worker sayısı: 4 (uvicorn --workers 4)
- Frontend production build: `npm run build`

---

## 🆘 Sorun Giderme

### PostgreSQL Bağlantı Hatası
```bash
# pg_hba.conf kontrolü
sudo cat /etc/postgresql/*/main/pg_hba.conf | grep wg_manager

# Servisi yeniden başlat
sudo systemctl restart postgresql
```

### Python Paket Kurulum Hatası
```bash
# libpq-dev eksik olabilir
sudo apt-get install libpq-dev  # Ubuntu/Debian
sudo yum install postgresql-devel  # CentOS/RHEL
```

### Node.js Versiyon Hatası
```bash
# Node.js 20.x kurulumu
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs
```

---

## 📚 Referanslar

- [FastAPI Dokümantasyonu](https://fastapi.tiangolo.com/)
- [React Dokümantasyonu](https://react.dev/)
- [PostgreSQL Dokümantasyonu](https://www.postgresql.org/docs/)
- [MikroTik API Dokümantasyonu](https://help.mikrotik.com/docs/display/ROS/API)
- [WireGuard Dokümantasyonu](https://www.wireguard.com/quickstart/)

---

**Son Güncelleme:** 31 Aralık 2024  
**Geliştirici:** Claude Sonnet 4.5  
**Repository:** https://github.com/mustafakiractr/wg-manager
