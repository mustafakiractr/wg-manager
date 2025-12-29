# 📦 Deployment Paketi Bilgileri

## Paket Detayları

**Dosya Adı**: `wg-manager-deployment.zip`
**Boyut**: 280 KB
**Dosya Sayısı**: 161 dosya
**Oluşturulma Tarihi**: 23 Aralık 2025
**SHA256 Checksum**: `518b73d536f927f2430f62b230dc86b9c22bfb4edf5a06d336e6834248ba2085`

---

## ✅ Paket İçeriği

### 📋 Kurulum Scriptleri
- ✅ `quick-start.sh` - Tek komutla kurulum (ÖNERİLEN)
- ✅ `install.sh` - Detaylı kurulum scripti
- ✅ `deploy.sh` - Production deployment scripti
- ✅ `setup_environment.sh` - Environment yapılandırma
- ✅ `start_all.sh` - Servisleri başlatma
- ✅ `restart_all.sh` - Servisleri yeniden başlatma
- ✅ `status.sh` - Durum kontrolü

### 📚 Dokümantasyon
- ✅ `README-DEPLOYMENT.md` - **ÖNCE BUNU OKUYUN**
- ✅ `DEPLOYMENT.md` - Kapsamlı deployment rehberi
- ✅ `INSTALL.md` - Detaylı kurulum rehberi
- ✅ `QUICKSTART.md` - Hızlı başlangıç kılavuzu
- ✅ `SECURITY.md` - Güvenlik kontrol listesi
- ✅ `IMPROVEMENTS_SUMMARY.md` - Yapılan iyileştirmeler
- ✅ `README.md` - Genel proje bilgileri

### 🔧 Backend (FastAPI)
- ✅ Backend kaynak kodları (`backend/app/`)
- ✅ Requirements (`backend/requirements.txt`)
- ✅ Environment template (`.env.example`)
- ✅ Database migration scriptleri
- ✅ Utility scriptler

### 🎨 Frontend (React + Vite)
- ✅ Frontend kaynak kodları (`frontend/src/`)
- ✅ Package.json ve bağımlılıklar
- ✅ Vite configuration
- ✅ Tailwind CSS configuration

### 🚀 Deployment Dosyaları
- ✅ Nginx yapılandırma örnekleri (`nginx/`)
- ✅ Systemd servis dosyaları (`systemd/`)

---

## ❌ Paket İçinde OLMAYAN Dosyalar

Aşağıdaki dosyalar/klasörler boyut optimizasyonu için pakete **dahil edilmemiştir**.
Kurulum sırasında otomatik olarak oluşturulacaktır:

- ❌ `node_modules/` - npm install ile oluşacak
- ❌ `venv/` - Python virtual environment (otomatik oluşturulacak)
- ❌ `frontend/dist/` - Production build (npm run build ile oluşacak)
- ❌ `*.db` - Database dosyaları (otomatik oluşturulacak)
- ❌ `*.log` - Log dosyaları
- ❌ `__pycache__/` - Python cache dosyaları
- ❌ `.git/` - Git repository

---

## 🚀 Kurulum Adımları

### 1. Paketi İndirin ve Açın

```bash
# Yeni sunucuya kopyalayın
scp wg-manager-deployment.zip user@new-server:/opt/

# Sunucuya bağlanın
ssh user@new-server

# Açın
cd /opt
unzip wg-manager-deployment.zip
cd wg
```

### 2. Tek Komutla Kurun

```bash
sudo bash quick-start.sh
```

**Bu kadar!** Script otomatik olarak:
- Sistem gereksinimlerini kontrol eder
- Python ve Node.js bağımlılıklarını yükler
- Virtual environment oluşturur
- Environment yapılandırması yapar
- Servisleri başlatır

### 3. Tarayıcıdan Erişin

```
http://YOUR_SERVER_IP:5173
```

**Giriş:**
- Username: `admin`
- Password: `admin123`

---

## 📊 Kurulum Süreleri

| Kurulum Tipi | Süre | Komut |
|--------------|------|-------|
| Quick Start (Development) | ~3-5 dakika | `sudo bash quick-start.sh` |
| Production (Nginx + SSL) | ~10-15 dakika | `sudo bash deploy.sh` |
| Manuel Kurulum | ~15-20 dakika | Adım adım |

---

## 🔐 Güvenlik Özellikleri

Paket aşağıdaki güvenlik özelliklerini içerir:

✅ **JWT Authentication** - Güvenli token bazlı kimlik doğrulama
✅ **2FA Support** - İki faktörlü kimlik doğrulama
✅ **Rate Limiting** - Brute force koruması
✅ **Security Headers** - XSS, Clickjacking koruması
✅ **Input Validation** - Pydantic ile otomatik validasyon
✅ **Password Encryption** - Bcrypt ile şifre hashleme
✅ **Session Management** - Güvenli oturum yönetimi
✅ **Account Lockout** - Başarısız giriş koruması

---

## ⚡ Performans Optimizasyonları

✅ **LRU Cache** - Akıllı önbellekleme sistemi
✅ **Database Indexing** - Optimize edilmiş sorgular
✅ **Frontend Build Optimization** - Vite ile hızlı build
✅ **Vendor Chunking** - Kod ayrıştırma
✅ **Tree Shaking** - Kullanılmayan kod temizleme
✅ **Lazy Loading** - İhtiyaç anında yükleme

---

## 📋 Sistem Gereksinimleri

### Minimum
- OS: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- CPU: 1 core
- RAM: 1GB
- Disk: 1GB boş alan
- Python: 3.9+
- Node.js: 16+

### Önerilen (Production)
- OS: Ubuntu 22.04 LTS
- CPU: 2+ cores
- RAM: 2GB+
- Disk: 5GB+
- Python: 3.11+
- Node.js: 18+ LTS

---

## 🎯 Desteklenen Platformlar

✅ Ubuntu 20.04, 22.04, 24.04
✅ Debian 11, 12
✅ CentOS 8, 9
✅ Rocky Linux 8, 9
✅ AlmaLinux 8, 9
⚠️ Windows (WSL2 ile)
⚠️ macOS (test edilmedi)

---

## 📦 Paket Doğrulama

Paket bütünlüğünü doğrulamak için:

```bash
# SHA256 checksum kontrolü
sha256sum -c wg-manager-deployment.zip.sha256

# Beklenen çıktı:
# wg-manager-deployment.zip: OK
```

---

## 🔄 Güncelleme

Mevcut kurulumu güncellemek için:

```bash
# 1. Yeni paketi indirin
wget https://your-server/wg-manager-deployment.zip

# 2. Mevcut kurulumu backup alın
tar -czf wg-backup-$(date +%Y%m%d).tar.gz /opt/wg-manager

# 3. Yeni paketi açın
unzip wg-manager-deployment.zip -d /opt/wg-manager-new

# 4. .env dosyasını kopyalayın
cp /opt/wg-manager/backend/.env /opt/wg-manager-new/wg/backend/

# 5. Database'i kopyalayın
cp /opt/wg-manager/backend/*.db /opt/wg-manager-new/wg/backend/

# 6. Servisleri durdurun
sudo systemctl stop wg-backend wg-frontend

# 7. Eski kurulumu yedekleyin ve yeniyi taşıyın
mv /opt/wg-manager /opt/wg-manager-old
mv /opt/wg-manager-new/wg /opt/wg-manager

# 8. Dependencies güncelleyin
cd /opt/wg-manager
sudo bash install.sh

# 9. Servisleri başlatın
sudo systemctl start wg-backend wg-frontend
```

---

## 🆘 Destek

### Sorun mu yaşıyorsunuz?

1. **README-DEPLOYMENT.md** dosyasını okuyun
2. **DEPLOYMENT.md** için detaylı rehbere bakın
3. **Sorun Giderme** bölümünü kontrol edin
4. Log dosyalarını inceleyin:
   ```bash
   cat backend/logs/backend.log
   sudo journalctl -u wg-backend -f
   ```

### Yararlı Komutlar

```bash
# Durum kontrolü
bash status.sh

# Logları görüntüle
tail -f backend/logs/backend.log

# Servisleri yeniden başlat
sudo systemctl restart wg-backend wg-frontend

# Port kontrolü
sudo lsof -i :8001
sudo lsof -i :5173
```

---

## 📚 Ek Kaynaklar

- **GitHub**: [Repository URL]
- **Dokümantasyon**: [Docs URL]
- **API Docs**: `http://YOUR_SERVER:8001/docs`
- **MikroTik API Docs**: https://help.mikrotik.com/docs/

---

## 📝 Changelog

### v1.0 (23 Aralık 2025)

**Yeni Özellikler:**
- ✅ Tek komutla kurulum scripti (`quick-start.sh`)
- ✅ Kapsamlı deployment dokümantasyonu
- ✅ Production deployment scripti
- ✅ Nginx reverse proxy desteği
- ✅ SSL/TLS sertifika desteği

**Güvenlik:**
- ✅ 2FA desteği
- ✅ Session management
- ✅ Account lockout
- ✅ Rate limiting
- ✅ Security headers

**Performans:**
- ✅ LRU cache
- ✅ Database indexing
- ✅ Frontend build optimization
- ✅ Vendor chunking

---

## ✅ Kurulum Sonrası Checklist

- [ ] Servislerin çalıştığını kontrol edin (`bash status.sh`)
- [ ] Web arayüzüne erişebildiğinizi doğrulayın
- [ ] Admin hesabı ile giriş yapın
- [ ] **ÖNEMLİ**: Admin şifresini değiştirin
- [ ] MikroTik bağlantı bilgilerini girin
- [ ] MikroTik API erişimini test edin
- [ ] WireGuard interface'lerin göründüğünü kontrol edin
- [ ] (Production) SSL sertifikası kurun
- [ ] (Production) Firewall kurallarını yapılandırın
- [ ] (Production) Backup stratejisi oluşturun
- [ ] (Production) Monitoring kurun

---

## 🎉 Önemli Notlar

1. **İlk Kurulum**: `quick-start.sh` kullanın
2. **Production**: `deploy.sh` ile deploy edin
3. **Güvenlik**: SECURITY.md dosyasını mutlaka okuyun
4. **Backup**: Düzenli backup almayı unutmayın
5. **Güncelleme**: Her zaman backup alarak güncelleyin

---

**Paket Bilgileri Özeti**
- Dosya: wg-manager-deployment.zip
- Boyut: 280 KB
- Dosya Sayısı: 161
- Checksum: 518b73d...ba2085

**İyi kullanımlar! 🚀**

---

**Hazırlayan**: MikroTik WireGuard Manager Team
**Versiyon**: 1.0
**Tarih**: 23 Aralık 2025
**Lisans**: MIT
