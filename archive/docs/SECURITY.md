# Güvenlik En İyi Uygulamaları

## 🔐 Production Deployment Kontrol Listesi

### 1. Environment Variables

- [ ] `ENVIRONMENT="production"` olarak ayarlandı
- [ ] `SECRET_KEY` güçlü ve benzersiz (min 32 karakter)
- [ ] `MIKROTIK_PASSWORD` güçlü bir şifre
- [ ] `CORS_ORIGINS` sadece gerçek domain'leri içeriyor
- [ ] `TRUSTED_HOSTS` production domain'leri içeriyor
- [ ] `LOG_LEVEL="WARNING"` veya `"ERROR"` olarak ayarlandı

### 2. HTTPS Yapılandırması

- [ ] SSL/TLS sertifikası kuruldu (Let's Encrypt önerilir)
- [ ] `ENABLE_HTTPS_REDIRECT=True` ayarlandı
- [ ] `MIKROTIK_USE_TLS=True` MikroTik TLS destekliyorsa
- [ ] HTTP trafiği HTTPS'e yönlendiriliyor

### 3. Firewall Kuralları

```bash
# Sadece gerekli portları aç
ufw allow 443/tcp  # HTTPS
ufw allow 80/tcp   # HTTP (HTTPS redirect için)
ufw enable
```

### 4. Rate Limiting

- [ ] `RATE_LIMIT_PER_MINUTE` uygun değere ayarlandı (100-200)
- [ ] `RATE_LIMIT_LOGIN` düşük tutuldu (3-5)
- [ ] Login endpoint'inde brute force koruması aktif

### 5. Database Güvenliği

- [ ] Database dosyası (`router_manager.db`) düzenli yedekleniyor
- [ ] Database dosyası sadece uygulama kullanıcısı tarafından okunabilir
```bash
chmod 600 router_manager.db
```
- [ ] Production için PostgreSQL kullanımı düşünüldü

### 6. Şifre Politikaları

- [ ] Varsayılan admin şifresi değiştirildi
- [ ] Kullanıcı şifreleri minimum 8 karakter
- [ ] Şifreler bcrypt ile hash'leniyor (✅ Aktif)

### 7. JWT Token Güvenliği

- [ ] `ACCESS_TOKEN_EXPIRE_MINUTES` uygun (15-30 dakika)
- [ ] `REFRESH_TOKEN_EXPIRE_DAYS` uygun (7-14 gün)
- [ ] Token'lar HTTPS üzerinden iletiliyor

### 8. MikroTik Güvenlik

- [ ] MikroTik API kullanıcısı minimum yetkilere sahip
- [ ] MikroTik API portu (8728/8729) firewall ile korunuyor
- [ ] MikroTik şifresi veritabanında şifrelenmiş olarak saklanıyor (✅ Aktif)

### 9. Logging ve Monitoring

- [ ] Uygulama logları düzenli kontrol ediliyor
- [ ] Başarısız login denemeleri loglanıyor (✅ Aktif)
- [ ] Kritik hatalar bildirim gönderiyor
- [ ] Log dosyaları rotate ediliyor

### 10. Backup Stratejisi

- [ ] Database günlük yedekleniyor
- [ ] WireGuard konfigürasyonları yedekleniyor
- [ ] Yedekler güvenli bir yerde saklanıyor
- [ ] Yedek restore testi yapıldı

## 🛡️ Güvenlik Testleri

### SQL Injection Testi
```bash
# SQLAlchemy ORM kullanıldığı için korumalı ✅
# Ek test: Tüm input'lar validation'dan geçiyor
```

### XSS Testi
```bash
# React otomatik escape yapıyor ✅
# Ek: CSP header'ları aktif (production)
```

### CSRF Testi
```bash
# JWT token kullanılıyor, CSRF koruması gerekmiyor ✅
```

### Brute Force Testi
```bash
# Rate limiting aktif (login: 5/min) ✅
curl -X POST http://localhost:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrong"}' \
  --retry 10 --retry-delay 0
```

## 📋 Düzenli Kontroller

### Haftalık
- [ ] Log dosyalarını kontrol et
- [ ] Başarısız login denemelerini kontrol et
- [ ] Database backup'ını doğrula

### Aylık
- [ ] Dependency güncellemelerini kontrol et
- [ ] SSL sertifika geçerliliğini kontrol et
- [ ] Yedek restore testi yap

### Yıllık
- [ ] JWT SECRET_KEY'i rotate et
- [ ] Tüm kullanıcı şifrelerini sıfırlat
- [ ] Güvenlik audit yap

## 🚨 Güvenlik Olayı Müdahalesi

### Şüpheli Aktivite Tespit Edilirse

1. **Acil Aksiyonlar**
   ```bash
   # Uygulamayı durdur
   systemctl stop backend
   systemctl stop frontend

   # Database yedekle
   cp router_manager.db router_manager.db.backup.$(date +%Y%m%d-%H%M%S)

   # Logları kaydet
   cp logs/app.log logs/app.log.incident.$(date +%Y%m%d-%H%M%S)
   ```

2. **İnceleme**
   - Log dosyalarını incele
   - Başarısız login denemelerini kontrol et
   - Database'i kontrol et

3. **Kurtarma**
   - Şüpheli kullanıcıları devre dışı bırak
   - Tüm token'ları invalid et (SECRET_KEY değiştir)
   - Şifreleri sıfırlat
   - Uygulamayı güvenli konfigürasyonla başlat

## 🔗 Kaynaklar

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [MikroTik Security](https://wiki.mikrotik.com/wiki/Manual:Securing_Your_Router)

## 📞 Destek

Güvenlik açığı bulursanız lütfen hemen bildirin: security@yourdomain.com
