# MikroTik Router Yönetim Paneli

MikroTik RouterOS v7 cihazlarını yönetmek için modern bir web arayüzü. WireGuard interface ve peer yönetimi yapabilirsiniz.

## 🚀 Özellikler

- **WireGuard Yönetimi**: Interface ve peer ekleme, düzenleme, silme
- **QR Kod Oluşturma**: Peer konfigürasyonları için QR kod
- **Gerçek Zamanlı İstatistikler**: Trafik ve durum bilgileri
- **Kullanıcı Yönetimi**: JWT tabanlı authentication
- **Log Sistemi**: Tüm işlemlerin kaydı
- **Karanlık Mod**: Modern ve göz yormayan arayüz
- **Responsive Tasarım**: Mobil ve desktop uyumlu

## 📋 Gereksinimler

- Python 3.9+
- Node.js 18+
- MikroTik RouterOS v7+
- PostgreSQL (opsiyonel, SQLite varsayılan)

## 🛠️ Kurulum

### Backend Kurulumu

```bash
cd backend

# Virtual environment oluştur
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# veya
venv\Scripts\activate  # Windows

# Bağımlılıkları yükle
pip install -r requirements.txt

# .env dosyasını oluştur
cp .env.example .env
# .env dosyasını düzenle ve MikroTik bilgilerini gir

# Veritabanını başlat ve varsayılan kullanıcıyı oluştur
python init_db.py

# Backend'i başlat
python run.py
```

Backend varsayılan olarak `http://localhost:8000` adresinde çalışacak.

### Frontend Kurulumu

```bash
cd frontend

# Bağımlılıkları yükle
npm install

# .env dosyasını oluştur
cp .env.example .env
# API URL'ini kontrol et (varsayılan: http://localhost:8000/api/v1)

# Development server'ı başlat
npm run dev
```

Frontend varsayılan olarak `http://localhost:5173` adresinde çalışacak.

## 🔐 Varsayılan Giriş Bilgileri

- **Username**: `admin`
- **Password**: `admin123`

⚠️ **ÖNEMLİ**: İlk girişten sonra şifreyi mutlaka değiştirin!

## 📁 Proje Yapısı

```
.
├── backend/
│   ├── app/
│   │   ├── api/          # API endpoint'leri
│   │   ├── mikrotik/     # MikroTik bağlantı sınıfı
│   │   ├── services/     # İş mantığı servisleri
│   │   ├── models/       # Veritabanı modelleri
│   │   ├── database/     # Veritabanı yapılandırması
│   │   ├── security/     # JWT ve güvenlik
│   │   └── utils/        # Yardımcı fonksiyonlar
│   ├── logs/             # Log dosyaları
│   ├── requirements.txt  # Python bağımlılıkları
│   └── run.py            # Uygulama başlatma
│
└── frontend/
    ├── src/
    │   ├── components/   # React bileşenleri
    │   ├── pages/        # Sayfa bileşenleri
    │   ├── services/     # API servisleri
    │   ├── store/        # Zustand state yönetimi
    │   └── App.jsx       # Ana uygulama
    └── package.json      # Node.js bağımlılıkları
```

## 🔌 API Endpoint'leri

### Authentication
- `POST /api/v1/auth/login` - Kullanıcı girişi
- `POST /api/v1/auth/refresh` - Token yenileme
- `GET /api/v1/auth/me` - Mevcut kullanıcı bilgisi

### WireGuard
- `GET /api/v1/wg/interfaces` - Tüm interface'leri listele
- `GET /api/v1/wg/interface/{name}` - Interface detayı
- `POST /api/v1/wg/interface/{name}/toggle` - Interface aç/kapat
- `GET /api/v1/wg/peers/{interface}` - Peer listesi
- `POST /api/v1/wg/peer/add` - Peer ekle
- `POST /api/v1/wg/peer/{peer_id}/update` - Peer güncelle
- `DELETE /api/v1/wg/peer/{peer_id}` - Peer sil
- `GET /api/v1/wg/peer/{peer_id}/qrcode` - QR kod oluştur

### Logs
- `GET /api/v1/logs` - Log kayıtlarını listele

## 🐳 Production Deployment

### Backend (Systemd Service)

`/etc/systemd/system/router-manager.service`:

```ini
[Unit]
Description=Router Manager API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/backend
Environment="PATH=/path/to/backend/venv/bin"
ExecStart=/path/to/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

### Frontend (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📝 Notlar

- MikroTik API portu varsayılan olarak 8728'dir (TLS için 8729)
- SQLite varsayılan veritabanıdır, production için PostgreSQL önerilir
- Tüm API endpoint'leri JWT token gerektirir (login hariç)
- Loglar `backend/logs/app.log` dosyasına yazılır

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 🆘 Destek

Sorunlar için GitHub Issues kullanın.


