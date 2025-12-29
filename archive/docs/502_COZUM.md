# 502 Bad Gateway Hatası Çözümü

## Sorun
Cloudflare Tunnel 502 Bad Gateway hatası veriyor.

## Neden
Backend (port 8000) ve Frontend (port 5173) servisleri çalışmıyordu.

## Çözüm
Servisler başlatıldı. Şimdi Cloudflare Tunnel yapılandırmasını kontrol edin.

## Servis Durumu
✅ Backend: http://localhost:8000 (ÇALIŞIYOR)
✅ Frontend: http://localhost:5173 (ÇALIŞIYOR)

## Cloudflare Tunnel Yapılandırması

### Cloudflare Dashboard'da Kontrol Edin:

1. **Zero Trust Dashboard** → **Networks** → **Tunnels**
2. `mwg.sahacam.com` için kullanılan tunnel'ı seçin
3. **Public Hostname** bölümünde şu yapılandırma olmalı:

```
1. Domain: mwg.sahacam.com
   Service: http://localhost:8000
   Path: /api/*
   (ÖNCE - Backend için)

2. Domain: mwg.sahacam.com
   Service: http://localhost:5173
   Path: /*
   (SONRA - Frontend için)
```

### Önemli Notlar:

- **Path sırası kritiktir!** `/api/*` önce, `/*` sonra olmalı
- Service URL'lerinde **localhost** kullanılmalı (127.0.0.1 değil)
- Port numaraları doğru olmalı: `8000` (backend), `5173` (frontend)

## Servisleri Kalıcı Olarak Başlatma

### Backend için Systemd Servisi Oluşturma:

```bash
sudo nano /etc/systemd/system/backend.service
```

İçeriği:
```ini
[Unit]
Description=FastAPI Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/backend
Environment="PATH=/root/backend/venv/bin"
ExecStart=/root/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Servisi başlat:
```bash
sudo systemctl daemon-reload
sudo systemctl enable backend.service
sudo systemctl start backend.service
sudo systemctl status backend.service
```

### Frontend için Systemd Servisi Oluşturma:

```bash
sudo nano /etc/systemd/system/frontend.service
```

İçeriği:
```ini
[Unit]
Description=Vite Frontend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/frontend
ExecStart=/usr/bin/npm run dev
Restart=always
RestartSec=10
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
```

Servisi başlat:
```bash
sudo systemctl daemon-reload
sudo systemctl enable frontend.service
sudo systemctl start frontend.service
sudo systemctl status frontend.service
```

## Test Komutları

```bash
# Backend testi
curl http://localhost:8000/api/v1/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Frontend testi
curl http://localhost:5173/

# Cloudflare üzerinden test
curl https://mwg.sahacam.com/
curl https://mwg.sahacam.com/api/v1/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## Sorun Devam Ederse

1. **Cloudflare Tunnel loglarını kontrol edin:**
   ```bash
   journalctl -u cloudflared -f
   ```

2. **Servis loglarını kontrol edin:**
   ```bash
   # Backend
   tail -f /tmp/backend.log
   
   # Frontend
   tail -f /tmp/vite.log
   ```

3. **Portların açık olduğunu kontrol edin:**
   ```bash
   ss -tlnp | grep -E ":(5173|8000)"
   ```

4. **Cloudflare Dashboard'da tunnel durumunu kontrol edin**




