# 🔐 WireGuard Manager - Güvenlik Kontrol Listesi

## ✅ Tamamlanan Güvenlik İyileştirmeleri (2025-12-25)

### 1. Dosya İzinleri
- [x] `.env` dosyası izinleri: **600** (sadece owner okuyabilir)
- [x] `.encryption_key` izinleri: **600**
- [x] Hassas bilgilere sadece root kullanıcısı erişebilir

### 2. Ağ Güvenliği
- [x] **CORS Origins**: Gereksiz originler kaldırıldı
  - Önceki: 8 origin (localhost:8001, 0.0.0.0 dahil)
  - Şimdi: 5 spesifik origin
- [x] **TRUSTED_HOSTS**: Wildcard (*) kaldırıldı
  - Şimdi: Sadece belirli hostlara izin veriliyor

### 3. Servis Yönetimi
- [x] Systemd servisleri kuruldu
- [x] Otomatik restart yapılandırıldı
- [x] Log rotasyon aktif

## ⚠️ ÖNEMLİ: Production İçin Yapılması Gerekenler

### 1. Kimlik Bilgileri (KRİTİK)

#### MikroTik Şifresi
```bash
# Şifre şu an .env dosyasında plaintext olarak duruyor
# ÖNERİ: Veritabanında şifrelenmiş olarak saklanıyor ama .env'de açık
# Çözüm: İlk kurulumdan sonra .env'den silin
cd /root/wg/backend
python3 -c "from app.config import settings; print('MikroTik şifresi veritabanında kayıtlı')"
# Sonra .env'den silin:
# sed -i 's/MIKROTIK_PASSWORD=.*/MIKROTIK_PASSWORD=""/' .env
```

#### JWT Secret Key
```bash
# Yeni SECRET_KEY oluştur
python3 -c "import secrets; print(secrets.token_hex(32))"

# .env dosyasında değiştir ve servisleri restart et
systemctl restart wg-manager-backend
```

### 2. TLS/SSL Yapılandırması

#### MikroTik API TLS
```bash
# .env dosyasında:
MIKROTIK_USE_TLS=True
```

#### HTTPS Redirect
```bash
# Production'da mutlaka aktif edin:
ENABLE_HTTPS_REDIRECT=True
```

#### SSL Sertifikaları
Nginx yapılandırmasını güncelleyin:
```bash
# /etc/nginx/sites-available/wg-manager
# Satır 37-39: Kendi domain'inizin sertifikalarını kullanın
ssl_certificate /etc/letsencrypt/live/YOURDOMAIN/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/YOURDOMAIN/privkey.pem;
```

### 3. CORS ve Host Kısıtlamaları

Production `.env`:
```bash
# Sadece production domain
CORS_ORIGINS="https://wg.mustafakirac.tr"
TRUSTED_HOSTS="wg.mustafakirac.tr"

# localhost ve IP adreslerini KALDIR
```

### 4. Rate Limiting

Şu anki ayarlar:
- API: 200 istek/dakika
- Login: 5 deneme/dakika

Production önerisi:
```bash
RATE_LIMIT_PER_MINUTE=100  # Daha sıkı
RATE_LIMIT_LOGIN=3         # Daha sıkı
```

### 5. Log Seviyesi

Development:
```bash
LOG_LEVEL="INFO"
```

Production:
```bash
LOG_LEVEL="WARNING"  # Daha az detay, daha az disk kullanımı
```

### 6. Database

Şu an: SQLite (router_manager.db)

Production için PostgreSQL önerilir:
```bash
DATABASE_URL="postgresql+asyncpg://user:password@localhost:5432/router_manager"
```

### 7. Firewall Kuralları

```bash
# Sadece gerekli portları aç
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
ufw allow 8728/tcp    # MikroTik API (sadece local ağdan)
ufw enable

# MikroTik API'yi sadece local ağdan erilebilir yap
ufw allow from 192.168.40.0/24 to any port 8728
```

## 🔍 Düzenli Güvenlik Kontrolleri

### Haftalık
- [ ] Log dosyalarını şüpheli aktivite için kontrol et
- [ ] Başarısız login denemelerini incele
- [ ] Disk kullanımını kontrol et

### Aylık
- [ ] Sistemi güncelle (`apt update && apt upgrade`)
- [ ] SSL sertifikalarının geçerliliğini kontrol et
- [ ] Backup'ları test et

### 3 Aylık
- [ ] SECRET_KEY rotasyonu
- [ ] Kullanılmayan kullanıcı hesaplarını temizle
- [ ] Güvenlik duvarı kurallarını gözden geçir

## 🚨 Acil Durum Prosedürleri

### Şüpheli Aktivite Tespit Edilirse

1. Servisleri durdur:
```bash
systemctl stop wg-manager-backend wg-manager-frontend
```

2. Logları incele:
```bash
journalctl -u wg-manager-backend --since "1 hour ago" | grep -i "error\|unauthorized"
```

3. MikroTik şifresini değiştir
4. JWT SECRET_KEY'i değiştir
5. Tüm active session'ları temizle

### Backup ve Restore

Backup:
```bash
# Database
cp /root/wg/backend/router_manager.db /root/backups/router_manager_$(date +%Y%m%d).db

# Config
tar -czf /root/backups/wg-manager-config_$(date +%Y%m%d).tar.gz /root/wg/backend/.env /etc/nginx/sites-available/wg-manager
```

## 📊 Güvenlik Metrikleri

### Mevcut Durum
- **Dosya İzinleri**: ✅ Güvenli
- **CORS**: ✅ Kısıtlanmış
- **Trusted Hosts**: ✅ Kısıtlanmış
- **TLS/SSL**: ⚠️ Development modda kapalı
- **Secret Rotation**: ⚠️ Henüz planlanmadı
- **Firewall**: ❓ Kontrol edilmedi
- **Database**: ⚠️ SQLite (production için PostgreSQL önerilir)

---

**Son Güncelleme**: 2025-12-25
**Sorumlu**: System Administrator
**Bir Sonraki İnceleme**: 2026-01-25
