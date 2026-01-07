# Nginx Production Configuration

Bu klasör production nginx yapılandırmasını içerir.

## Kurulum

```bash
# 1. Config dosyasını kopyala
sudo cp nginx/wg-manager.conf /etc/nginx/sites-available/wg-manager

# 2. Symlink oluştur
sudo ln -sf /etc/nginx/sites-available/wg-manager /etc/nginx/sites-enabled/wg-manager

# 3. Default config'i kaldır (opsiyonel)
sudo rm /etc/nginx/sites-enabled/default

# 4. Config test et
sudo nginx -t

# 5. Nginx restart
sudo systemctl restart nginx
```

## SSL/HTTPS Kurulumu

```bash
# Certbot yükle
sudo apt install certbot python3-certbot-nginx

# SSL sertifikası al
sudo certbot --nginx -d yourdomain.com

# Otomatik yenileme test et
sudo certbot renew --dry-run
```

## Özellikler

- ✅ Rate limiting (API: 10 req/s, Login: 5 req/min)
- ✅ WebSocket desteği
- ✅ Security headers
- ✅ Cloudflare gerçek IP
- ✅ Static asset caching (1 yıl)
- ✅ Frontend dist/ serve
- ✅ Backend reverse proxy (port 8001)

## Notlar

- Frontend build: `bash build_frontend.sh`
- Deploy script: `bash deploy_production.sh`
- wg-frontend.service: Devre dışı (nginx kullanıyor)
