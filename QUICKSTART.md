# 🚀 Hızlı Başlangıç Kılavuzu

MikroTik WireGuard Yönetim Paneli'ni 5 dakikada kurun ve çalıştırın!

---

## ⚡ Tek Komut Kurulum

### 1. Projeyi İndirin

```bash
cd /opt
git clone <repository-url> wg-manager
cd wg-manager
```

veya

```bash
unzip wg-manager.zip
cd wg-manager
```

### 2. Kurulumu Başlatın

```bash
sudo bash install.sh
```

### 3. Bağlantı Bilgilerini Yapılandırın

```bash
bash setup_environment.sh
```

**Sorulacak bilgiler:**
- MikroTik IP Adresi (örn: 192.168.1.1)
- MikroTik API Port (varsayılan: 8728)
- MikroTik Kullanıcı Adı (örn: admin)
- MikroTik Şifresi
- Ortam (development / production)

### 4. Uygulamayı Başlatın

```bash
bash start_all.sh
```

### 5. Tarayıcıdan Erişin

```
http://YOUR_SERVER_IP:5173
```

**Varsayılan Giriş:**
- Kullanıcı adı: `admin`
- Şifre: İlk girişte belirlenir

---

## 📋 Gereksinimler

### Minimum Sistem

- **OS:** Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **CPU:** 1 core
- **RAM:** 1 GB
- **Disk:** 500 MB

### Yazılımlar

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install python3 python3-pip python3-venv nodejs npm git

# CentOS/RHEL
sudo yum install python3 python3-pip nodejs npm git
```

**Minimum Versiyonlar:**
- Python: 3.9+
- Node.js: 16.x+
- npm: 7.x+

---

## 🎯 3 Farklı Kurulum Senaryosu

### Senaryo 1: Development (Geliştirme)

**Kullanım:** Test, geliştirme, yerel kullanım

```bash
sudo bash install.sh
bash setup_environment.sh  # "development" seçin
bash start_all.sh
```

**Erişim:**
- Frontend: http://localhost:5173
- Backend: http://localhost:8001
- API Docs: http://localhost:8001/docs

---

### Senaryo 2: Production (Manuel)

**Kullanım:** Canlı ortam, manuel kontrol

```bash
# 1. Kur
sudo bash install.sh

# 2. Production environment ayarla
bash setup_environment.sh  # "production" seçin

# 3. Frontend build al
cd frontend
npm run build
cd ..

# 4. Systemd servisleri kur
sudo cp systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start wg-backend wg-frontend
sudo systemctl enable wg-backend wg-frontend
```

---

### Senaryo 3: Production (Otomatik)

**Kullanım:** Tek komutla production deployment

```bash
# 1. Önce environment yapılandır
bash setup_environment.sh  # "production" seçin

# 2. Deploy et
sudo bash deploy.sh
```

`deploy.sh` şunları yapar:
- ✅ Frontend production build
- ✅ Database backup
- ✅ Systemd servisleri
- ✅ (Opsiyonel) Nginx yapılandırması
- ✅ Firewall kuralları

---

## 🔧 Yaygın Komutlar

### Servisleri Yönet

```bash
# Durum kontrolü
bash status.sh

# Başlat
bash start_all.sh

# Durdur
pkill -f 'python.*run.py' && pkill -f 'vite'

# Yeniden başlat
bash restart_all.sh

# Logları izle
tail -f backend.log
tail -f frontend.log
```

### Systemd ile (Production)

```bash
# Durum
sudo systemctl status wg-backend wg-frontend

# Başlat
sudo systemctl start wg-backend wg-frontend

# Durdur
sudo systemctl stop wg-backend wg-frontend

# Yeniden başlat
sudo systemctl restart wg-backend wg-frontend

# Loglar
sudo journalctl -u wg-backend -f
```

---

## 🛠️ Sorun Giderme

### Backend çalışmıyor

```bash
# Log kontrolü
cat backend/logs/backend.log

# Manuel başlatma
cd backend
source venv/bin/activate
python run.py
```

### Frontend çalışmıyor

```bash
# Log kontrolü
cat frontend.log

# Manuel başlatma
cd frontend
npm run dev
```

### MikroTik bağlanamıyor

```bash
# API portu açık mı?
telnet MIKROTIK_IP 8728

# Bağlantı bilgileri doğru mu?
cat backend/.env | grep MIKROTIK
```

### Port zaten kullanımda

```bash
# 8001 portunu kim kullanıyor?
sudo lsof -i :8001

# Süreci durdur
sudo kill -9 <PID>
```

---

## 🌐 Production için SSL/HTTPS

### Nginx + Let's Encrypt

```bash
# 1. Nginx kur
sudo apt-get install nginx certbot python3-certbot-nginx

# 2. Nginx config kopyala ve düzenle
sudo cp nginx/wg-manager.conf /etc/nginx/sites-available/wg-manager
sudo nano /etc/nginx/sites-available/wg-manager
# yourdomain.com'u kendi domain'iniz ile değiştirin

# 3. Etkinleştir
sudo ln -s /etc/nginx/sites-available/wg-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 4. SSL sertifikası al
sudo certbot --nginx -d yourdomain.com

# 5. Otomatik yenileme
sudo certbot renew --dry-run
```

---

## 📊 Sistem Durumu

### Health Check

```bash
# Backend API
curl http://localhost:8001/health

# Beklenen çıktı:
# {"success":true,"status":"healthy","service":"router-manager-api"}
```

### Port Kontrolü

```bash
# Dinleyen portlar
sudo lsof -i :8001  # Backend
sudo lsof -i :5173  # Frontend
```

### Resource Kullanımı

```bash
# CPU/Memory
top -p $(pgrep -f 'python.*run.py')
top -p $(pgrep -f 'vite')
```

---

## 🔒 Güvenlik Kontrol Listesi

- [ ] SECRET_KEY değiştirildi (production)
- [ ] CORS_ORIGINS production domain'e ayarlandı
- [ ] MikroTik şifresi güçlü
- [ ] Firewall kuralları aktif (80, 443, 8001, 5173)
- [ ] SSL sertifikası kuruldu (production)
- [ ] Database backup stratejisi var
- [ ] Log rotation yapılandırıldı
- [ ] Systemd servisleri aktif
- [ ] Nginx reverse proxy kullanılıyor (production)

Detaylı güvenlik bilgisi için: [SECURITY.md](SECURITY.md)

---

## 📚 Ek Kaynaklar

| Dosya | Açıklama |
|-------|----------|
| [INSTALL.md](INSTALL.md) | Detaylı kurulum rehberi |
| [SECURITY.md](SECURITY.md) | Güvenlik kontrol listesi |
| [IMPROVEMENTS_SUMMARY.md](IMPROVEMENTS_SUMMARY.md) | Son iyileştirmeler |
| [systemd/README.md](systemd/README.md) | Systemd servisleri |
| [nginx/README.md](nginx/README.md) | Nginx yapılandırması |

---

## 🆘 Yardım

### Sorun mu yaşıyorsunuz?

1. **Logları kontrol edin**
   ```bash
   cat backend/logs/backend.log
   cat frontend.log
   ```

2. **Sistem gereksinimlerini doğrulayın**
   ```bash
   python3 --version  # 3.9+
   node --version     # 16.x+
   ```

3. **MikroTik erişimini test edin**
   ```bash
   telnet MIKROTIK_IP 8728
   ```

4. **Port çakışmasını kontrol edin**
   ```bash
   sudo lsof -i :8001
   sudo lsof -i :5173
   ```

### Hala çalışmıyor mu?

- Backend log: `backend/logs/backend.log`
- Frontend log: `frontend.log`
- Systemd log: `sudo journalctl -u wg-backend -n 100`

---

## ⚡ Özet: 5 Dakikada Kurulum

```bash
# 1. İndirin
cd /opt && git clone <repo> wg-manager && cd wg-manager

# 2. Kurun
sudo bash install.sh

# 3. Yapılandırın
bash setup_environment.sh

# 4. Başlatın
bash start_all.sh

# 5. Tarayıcıda açın
# http://YOUR_IP:5173
```

**İyi Çalışmalar! 🎉**

---

**Son Güncelleme:** 22 Aralık 2025
**Versiyon:** 1.0
