# SSL Sertifikası Kurulum Notları

## Sorun
Cloudflare proxy modu aktif olduğu için Let's Encrypt doğrulaması başarısız oluyor.

## Çözüm 1: Cloudflare DNS Ayarları (Önerilen)

1. Cloudflare Dashboard'a giriş yapın: https://dash.cloudflare.com
2. `sahacam.com` domain'ini seçin
3. DNS sekmesine gidin
4. `wgmik.sahacam.com` kaydını bulun
5. **Proxied** (turuncu bulut) ikonuna tıklayın ve **DNS Only** (gri bulut) yapın
6. Birkaç dakika bekleyin (DNS yayılımı için)
7. Sunucuda şu komutu çalıştırın:
   ```bash
   certbot --nginx -d wgmik.sahacam.com --non-interactive --agree-tos --email admin@sahacam.com --redirect
   ```
8. SSL sertifikası alındıktan sonra Cloudflare'de tekrar **Proxied** yapabilirsiniz

## Çözüm 2: Cloudflare Origin Certificate (Alternatif)

Cloudflare Origin Certificate kullanarak SSL yapılandırması yapabilirsiniz:

1. Cloudflare Dashboard > SSL/TLS > Origin Server
2. "Create Certificate" butonuna tıklayın
3. Sertifikayı indirin ve sunucuya yükleyin
4. Nginx yapılandırmasını güncelleyin

## Çözüm 3: Standalone Mode (Geçici)

Nginx'i geçici olarak durdurup standalone mode ile sertifika alın:

```bash
systemctl stop nginx
certbot certonly --standalone -d wgmik.sahacam.com --non-interactive --agree-tos --email admin@sahacam.com
systemctl start nginx
```

## Mevcut Durum

- ✅ Nginx kurulu ve yapılandırılmış
- ✅ Frontend çalışıyor (port 5173)
- ✅ Backend çalışıyor (port 8000)
- ✅ Reverse proxy yapılandırılmış
- ⚠️ SSL sertifikası henüz alınamadı (Cloudflare proxy nedeniyle)

## Test

SSL sertifikası alındıktan sonra test edin:
```bash
curl -I https://wgmik.sahacam.com
```

