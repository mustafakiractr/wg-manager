# 🔒 WireGuard Manager Panel

MikroTik RouterOS v7+ WireGuard VPN için modern web tabanlı yönetim arayüzü.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/)
[![Node.js 20+](https://img.shields.io/badge/node-20+-green.svg)](https://nodejs.org/)

---

## ✨ Özellikler

- 🔐 **WireGuard Yönetimi** - Arayüz ve peer oluşturma, düzenleme, silme
- 📊 **Panel & Analitik** - Gerçek zamanlı trafik istatistikleri ve izleme
- 🔔 **Bildirim Sistemi** - Gerçek zamanlı uyarılar ve bildirimler
- 📝 **Aktivite Günlüğü** - Tüm işlemlerin tam denetim kaydı
- 🎯 **IP Havuzu Yönetimi** - Şablonlarla otomatik IP tahsisi
- 📱 **QR Kod Üretimi** - Kolay mobil cihaz yapılandırması
- 🎨 **Modern Arayüz** - Karanlık mod, duyarlı tasarım, sezgisel arayüz
- 🔒 **Güvenli** - JWT kimlik doğrulama, rol tabanlı erişim kontrolü, hız sınırlama

---

## 🚀 Hızlı Başlangıç

### Ön Gereksinimler

**Sistem Gereksinimleri:**
- Ubuntu 20.04+ / Debian 11+ / CentOS 8+ (veya benzer Linux)
- Minimum 1GB RAM (2GB önerilir)
- 1GB disk alanı
- API etkin MikroTik RouterOS v7+

**Not:** Python 3.9+, Node.js 20+ ve diğer tüm bağımlılıklar kurulum scripti tarafından **otomatik olarak yüklenecektir**!

### Kurulum

```bash
# Repository'yi klonlayın
git clone https://github.com/mustafakiractr/wg-manager.git /opt/wg-manager
cd /opt/wg-manager

# SEÇENEK 1: Hızlı Başlangıç (Önerilen - Her şeyi otomatik yükler)
sudo bash quick-start.sh

# SEÇENEK 2: Manuel Kurulum
sudo bash install.sh  # Python, Node.js, npm ve tüm bağımlılıkları otomatik yükler
nano backend/.env     # MikroTik bağlantısını yapılandırın
bash start_all.sh     # Servisleri başlatın
```

### Uygulamaya Erişim

```
URL: http://localhost:5173
Kullanıcı Adı: admin
Şifre: admin123
```

⚠️ **İlk girişten sonra varsayılan şifreyi hemen değiştirin!**

---

## 📖 Dokümantasyon

Kapsamlı dokümantasyon için lütfen şu dosyalara bakın:

- **[PROJECT_GUIDE.md](PROJECT_GUIDE.md)** - Kurulum, yapılandırma, API dokümanları ve sorun gidermeyi içeren tam kılavuz
- **[Backend API Dokümantasyonu](#)** - Çalışırken `/docs` endpoint'inde mevcut
- **[Arşivlenmiş Dokümantasyon](archive/docs/)** - Geçmiş dokümanlar ve özel kılavuzlar

---

## 🏗️ Teknoloji Yığını

**Backend:**
- FastAPI (Python 3.9+)
- SQLAlchemy (async ORM)
- PostgreSQL / SQLite
- JWT Kimlik Doğrulama

**Frontend:**
- React 18 + Vite
- Tailwind CSS
- Zustand (durum yönetimi)
- React Router v6

**Altyapı:**
- MikroTik RouterOS API
- WebSocket (gerçek zamanlı güncellemeler)
- Systemd servisleri

---

## 📁 Proje Yapısı

```
wg-manager/
├── backend/              # FastAPI uygulaması
│   ├── app/
│   │   ├── api/         # API endpoint'leri
│   │   ├── models/      # Veritabanı modelleri
│   │   ├── services/    # İş mantığı
│   │   └── main.py      # Uygulama giriş noktası
│   └── requirements.txt
│
├── frontend/            # React uygulaması
│   ├── src/
│   │   ├── components/  # React bileşenleri
│   │   ├── pages/       # Sayfa bileşenleri
│   │   └── App.jsx
│   └── package.json
│
├── archive/             # Arşivlenmiş dokümantasyon
├── systemd/             # Servis yapılandırmaları
├── README.md           # Bu dosya
└── PROJECT_GUIDE.md    # Tam dokümantasyon
```

---

## 🔧 Geliştirme

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🔐 Güvenlik

- JWT tabanlı kimlik doğrulama
- Rol tabanlı erişim kontrolü (RBAC)
- Hassas endpoint'lerde hız sınırlama
- Aktivite kaydı ve denetim izi
- Bcrypt şifre hashleme
- CORS koruması
- HTTPS desteği

Güvenlik en iyi uygulamaları için [PROJECT_GUIDE.md](PROJECT_GUIDE.md#security) dosyasına bakın.

---

## 📊 Ekran Görüntüleri

### Panel
WireGuard arayüzleri, peer'lar ve trafik istatistiklerinin gerçek zamanlı izlenmesi.

### WireGuard Yönetimi
QR kod üretimi ile kolay arayüz ve peer yönetimi.

### Aktivite Günlükleri
Tüm sistem işlemlerinin tam denetim kaydı.

---

## 🛠️ Production Dağıtımı

### Systemd Servisleri

**Backend Servisi:**
```bash
# Backend'i etkinleştir ve başlat
sudo systemctl enable router-manager-backend
sudo systemctl start router-manager-backend
sudo systemctl status router-manager-backend
```

**Frontend Servisi:**
```bash
# Statik dosya sunumu için serve yükle
npm install -g serve

# Frontend'i etkinleştir ve başlat
sudo systemctl enable router-manager-frontend
sudo systemctl start router-manager-frontend
sudo systemctl status router-manager-frontend
```

**Uygulamaya erişim:**
- Frontend: http://sunucunuz:5173
- Backend API: http://sunucunuz:8000
- API Dokümanları: http://sunucunuz:8000/docs

Tam dağıtım kılavuzu için [PROJECT_GUIDE.md](PROJECT_GUIDE.md#deployment) dosyasına bakın.

---

## 🐛 Sorun Giderme

### Yaygın Sorunlar

**Backend başlamıyor:**
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

**MikroTik bağlantısı başarısız:**
```bash
# MikroTik API servisini kontrol edin
/ip service print
/ip service set api disabled=no
```

**Frontend CORS hataları:**
```bash
# backend/.env dosyasında CORS_ORIGINS'i kontrol edin
CORS_ORIGINS=["http://localhost:5173"]
```

Daha fazla sorun giderme yardımı için [PROJECT_GUIDE.md](PROJECT_GUIDE.md#troubleshooting) dosyasına bakın.

---

## 📝 API Dokümantasyonu

Backend çalışırken interaktif API dokümantasyonu mevcut:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

Detaylı API dokümantasyonu için [PROJECT_GUIDE.md](PROJECT_GUIDE.md#api-documentation) dosyasına bakın.

---

## 🤝 Katkıda Bulunma

1. Repository'yi fork edin
2. Özellik dalı oluşturun (`git checkout -b feature/harika-ozellik`)
3. Değişikliklerinizi commit edin (`git commit -m 'feat: Harika özellik ekle'`)
4. Dalı push edin (`git push origin feature/harika-ozellik`)
5. Pull Request açın

---

## 📄 Lisans

Bu proje MIT Lisansı altında lisanslanmıştır - detaylar için [LICENSE](LICENSE) dosyasına bakın.

---

## 🙏 Teşekkürler

- [MikroTik](https://mikrotik.com/) - RouterOS ve API
- [WireGuard](https://www.wireguard.com/) - Hızlı, modern VPN protokolü
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [React](https://react.dev/) - UI kütüphanesi

---

## 📞 Destek

Sorunlar ve sorular için:
- 📋 [GitHub Issues](https://github.com/mustafakiractr/wg-manager/issues)
- 📖 Dokümantasyon: [PROJECT_GUIDE.md](PROJECT_GUIDE.md)

---

**FastAPI ve React ile ❤️ ile yapılmıştır**
