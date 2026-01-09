# 🔒 WireGuard Manager Panel

MikroTik RouterOS v7+ WireGuard VPN yönetimi için modern web arayüzü.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/)
[![Node.js 20+](https://img.shields.io/badge/node-20+-green.svg)](https://nodejs.org/)

## 🚀 Hızlı Başlangıç

### Production Kurulumu (Önerilen)
```bash
git clone https://github.com/mustafakiractr/wg-manager.git /opt/wg-manager
cd /opt/wg-manager
sudo bash install_production.sh
```

**Kurulum sırasında sorulacak:**
- PostgreSQL veritabanı şifresi
- Admin panel şifresi
- MikroTik bağlantı bilgileri (opsiyonel)
- Domain adı (opsiyonel)

### Hızlı Kurulum (Development)
```bash
git clone https://github.com/mustafakiractr/wg-manager.git /opt/wg-manager
cd /opt/wg-manager
sudo bash quick-start.sh
```

**İlk Giriş:** `http://sunucu-ip:5173`

## ✨ Özellikler

- 🔐 WireGuard interface & peer yönetimi
- 📊 Gerçek zamanlı dashboard & analitik
- 🔔 Telegram & email bildirimleri
- 📝 Detaylı aktivite günlüğü
- 🎯 IP pool otomasyonu
- 📱 QR kod & config üretimi
- 🎨 Modern karanlık mod arayüzü
- 🔒 JWT auth, RBAC, rate limiting

## 📚 Dokümantasyon

**Tam Dokümantasyon:** [DOCUMENTATION.md](DOCUMENTATION.md)

- ⚙️ Yapılandırma & Güvenlik
- 🛠️ Yönetim komutları
- 🚀 Performans optimizasyonu
- 📦 Yedekleme & restore
- 🔧 Sorun giderme
- 📱 API endpoints
- 📘 Proje rehberi: [PROJECT_GUIDE.md](PROJECT_GUIDE.md)

## 🔧 Yönetim

```bash
# Servis yönetimi
bash start_all.sh          # Başlat
bash restart_services.sh   # Yeniden başlat
bash status_services.sh    # Durum

# Admin şifre sıfırlama
cd backend && source venv/bin/activate
python reset_admin_password.py

# Log kontrolü
tail -f backend/logs/backend.log
journalctl -u wg-backend -f  # Production
```

## 🏗️ Mimari

- **Backend:** FastAPI + SQLAlchemy + PostgreSQL/SQLite + JWT + WebSocket
- **Frontend:** React 18 + Vite + Tailwind + Zustand
- **Infrastructure:** Systemd + Nginx + Let's Encrypt

## 📦 Production Deployment

```bash
# Otomatik deployment
sudo bash deploy.sh

# Systemd servisleri
sudo systemctl enable wg-backend wg-frontend
sudo systemctl start wg-backend wg-frontend

# Nginx + SSL kurulumu
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch: \`git checkout -b feature/amazing\`
3. Commit: \`git commit -m 'feat: Add feature'\`
4. Push: \`git push origin feature/amazing\`
5. Pull Request açın

## 📄 Lisans

MIT License - Detaylar için LICENSE dosyasına bakın.

---

**Versiyon:** 2.0 | **Son Güncelleme:** 7 Ocak 2026 | **Geliştirici:** mustafakiractr
