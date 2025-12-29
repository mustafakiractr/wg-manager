# Systemd Service Dosyaları

Bu klasör, uygulamayı systemd servisi olarak çalıştırmak için gerekli dosyaları içerir.

## Kurulum

### 1. Service Dosyalarını Kopyala

```bash
sudo cp systemd/wg-backend.service /etc/systemd/system/
sudo cp systemd/wg-frontend.service /etc/systemd/system/
```

### 2. Systemd'yi Yenile

```bash
sudo systemctl daemon-reload
```

### 3. Servisleri Başlat

```bash
sudo systemctl start wg-backend
sudo systemctl start wg-frontend
```

### 4. Otomatik Başlatmayı Etkinleştir

```bash
sudo systemctl enable wg-backend
sudo systemctl enable wg-frontend
```

## Servis Yönetimi

### Durum Kontrol

```bash
sudo systemctl status wg-backend
sudo systemctl status wg-frontend
```

### Durdur

```bash
sudo systemctl stop wg-backend
sudo systemctl stop wg-frontend
```

### Yeniden Başlat

```bash
sudo systemctl restart wg-backend
sudo systemctl restart wg-frontend
```

### Logları Görüntüle

```bash
# Canlı log takibi
sudo journalctl -u wg-backend -f
sudo journalctl -u wg-frontend -f

# Son 100 satır
sudo journalctl -u wg-backend -n 100
sudo journalctl -u wg-frontend -n 100
```

## Önemli Notlar

- Service dosyalarındaki path'leri kendi sistemınıza göre düzenleyin
- `User` ve `Group` değerlerini uygun kullanıcı ile değiştirin
- Production ortamı için frontend'i `serve` paketi ile static serve edin
- Log dosyalarının oluşturulabildiğinden emin olun

## Production İçin Öneriler

1. **Frontend:** `serve -s dist -l 5173` ile static build serve edin
2. **User:** Root yerine dedicated user kullanın (www-data önerilir)
3. **Logs:** Log rotation kurun (`journalctl`)
4. **Security:** Service hardening ayarları ekleyin
5. **Reverse Proxy:** SSL/TLS için Caddy veya Traefik kullanın
