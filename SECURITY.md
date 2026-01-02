# 🔐 Güvenlik Kılavuzu

## Kritik Güvenlik Gereksinimleri

### 1. Environment Dosyaları (.env)

**⚠️ ASLA git repository'ye eklemeyin!**

```bash
# ✅ DOĞRU: .env.example dosyasını şablon olarak kullanın
cp backend/.env.example backend/.env
nano backend/.env  # Gerçek değerlerle doldurun

# ✅ DOĞRU: Dosya izinlerini güvenli yapın
chmod 600 backend/.env

# ❌ YANLIŞ: .env dosyasını git'e eklemeyin
git add backend/.env  # YAPMAYIN!
```

### 2. SECRET_KEY Oluşturma

Production ortamında SECRET_KEY'i mutlaka değiştirin:

```bash
# Yeni SECRET_KEY oluştur
python3 -c "import secrets; print(secrets.token_hex(32))"

# Oluşan değeri backend/.env dosyasına ekleyin
SECRET_KEY="buraya_oluşan_değeri_yapıştırın"
```

### 3. Database Şifreleri

```bash
# PostgreSQL şifresini güçlü yapın (minimum 16 karakter)
DATABASE_URL="postgresql+asyncpg://wg_user:GÜÇLÜ_ŞİFRE_BURAYA@localhost/wg_manager"
```

### 4. HTTPS Zorunluluğu

Production ortamında HTTPS kullanımını zorunlu kılın:

```env
ENABLE_HTTPS_REDIRECT=True
MIKROTIK_USE_TLS=True
```

### 5. CORS Yapılandırması

```env
# ❌ YANLIŞ: Geliştirme ortamı URL'leri production'da
CORS_ORIGINS="http://localhost:5173,..."

# ✅ DOĞRU: Sadece gerçek domain
CORS_ORIGINS="https://yourdomain.com"
```

### 6. Database Backup Güvenliği

Backup dosyaları otomatik olarak 600 (sadece owner okuyabilir) izinleriyle oluşturulur:

```bash
# Mevcut backup'ları kontrol et
ls -la backend/backups/

# Gerekirse izinleri düzelt
chmod 600 backend/backups/*.db
chmod 600 backend/backups/*.backup
```

### 7. MikroTik Bağlantı Güvenliği

```env
# ✅ DOĞRU: TLS kullanın
MIKROTIK_USE_TLS=True
MIKROTIK_PORT=8729  # TLS port'u

# ❌ YANLIŞ: Plaintext bağlantı
MIKROTIK_USE_TLS=False
MIKROTIK_PORT=8728
```

## Güvenlik Kontrol Listesi

Production'a geçmeden önce kontrol edin:

- [ ] `.env` dosyası `.gitignore`'da
- [ ] `SECRET_KEY` değiştirildi (64 karakter hex)
- [ ] `MIKROTIK_PASSWORD` güçlü şifre
- [ ] `DATABASE_URL` güçlü şifre içeriyor
- [ ] `ENABLE_HTTPS_REDIRECT=True`
- [ ] `MIKROTIK_USE_TLS=True`
- [ ] `CORS_ORIGINS` sadece production domain'leri içeriyor
- [ ] `.env` dosya izinleri `600`
- [ ] Database dosyaları izinleri `600`
- [ ] Backup dosyaları izinleri `600`

## Güvenlik Açığı Bildirimi

Güvenlik açığı bulduysanız, lütfen public issue açmayın. Bunun yerine:

1. Proje sahibine özel mesaj gönderin
2. Detayları ve potansiyel etkiyi açıklayın
3. Mümkünse çözüm önerisi sunun

## Daha Fazla Bilgi

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security Best Practices](https://fastapi.tiangolo.com/tutorial/security/)
- [MikroTik RouterOS Security](https://help.mikrotik.com/docs/display/ROS/Securing+your+router)
