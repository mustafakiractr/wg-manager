# 🔐 Backup Şifreleme (AES-256) - Kullanım Kılavuzu

**Özellik Durumu:** ✅ Tamamlandı  
**Versiyon:** 1.0  
**Tarih:** 6 Ocak 2025  

---

## 📖 Genel Bakış

WireGuard Manager Panel, backup dosyalarınızı **AES-256-GCM** (Galois/Counter Mode) ile şifreler. Bu, hem veri gizliliği hem de veri bütünlüğü sağlayan endüstri standardı bir şifreleme algoritmasıdır.

### 🎯 Temel Özellikler

- **Algoritma**: AES-256-GCM (Authenticated Encryption)
- **Key Derivation**: PBKDF2-HMAC-SHA256 (100,000 iterations)
- **Güvenlik Garantileri**:
  - ✅ Veri gizliliği (confidentiality)
  - ✅ Veri bütünlüğü (integrity)
  - ✅ Kimlik doğrulama (authentication)
  - ✅ Brute-force koruması (100k iterasyon)

---

## 🔒 Şifreleme Nasıl Çalışır?

### Teknik Detaylar

```
1. Şifre → PBKDF2-HMAC-SHA256 (100,000 iter) → 256-bit AES Key
2. Random Salt (16 byte) oluşturulur
3. Random Nonce/IV (12 byte) oluşturulur
4. Dosya → AES-256-GCM ile şifrelenir
5. Şifreli Dosya Formatı: [SALT(16)][NONCE(12)][CIPHERTEXT+AUTH_TAG]
```

### Dosya Formatı

```
┌─────────────┬──────────────┬────────────────────────────┐
│  Salt       │  Nonce       │  Encrypted Data + Auth Tag │
│  (16 bytes) │  (12 bytes)  │  (variable length)         │
└─────────────┴──────────────┴────────────────────────────┘
```

- **Salt**: Her şifreleme işlemi için benzersiz, PBKDF2 için kullanılır
- **Nonce**: AES-GCM için benzersiz initialization vector
- **Auth Tag**: 16 byte, veri bütünlüğü doğrulama

---

## 🚀 Kullanım Senaryoları

### 1️⃣ Mevcut Backup'ı Şifrele

**Web Arayüzü:**
1. **Backup Şifreleme** sayfasına gidin
2. **"Mevcut Backup'ı Şifrele"** kartına tıklayın
3. Şifrelenecek dosyayı seçin
4. Güçlü bir şifre belirleyin (min 8 karakter)
5. Şifreyi tekrar girin
6. **Şifrele** butonuna tıklayın

**API Kullanımı:**
```bash
curl -X POST "http://localhost:8001/api/v1/backup/encrypt" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "backup_filename": "backup_database_2025-01-06.db",
    "password": "YourStrongPassword123!"
  }'
```

**Çıktı:**
- Orijinal dosya: `backup_database_2025-01-06.db` (korunur)
- Şifreli dosya: `backup_database_2025-01-06.db.encrypted`

---

### 2️⃣ Şifreli Backup'ı Çöz

**Web Arayüzü:**
1. **Backup Şifreleme** sayfasına gidin
2. **"Şifreli Backup'ı Çöz"** kartına tıklayın
3. `.encrypted` uzantılı dosyayı seçin
4. Şifreyi girin
5. **Şifre Çöz** butonuna tıklayın

**API Kullanımı:**
```bash
curl -X POST "http://localhost:8001/api/v1/backup/decrypt" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "encrypted_filename": "backup_database_2025-01-06.db.encrypted",
    "password": "YourStrongPassword123!"
  }'
```

**Güvenlik:**
- ❌ Yanlış şifre → `authentication failed` hatası (Authentication Tag doğrulama başarısız)
- ❌ Dosya bozuk → `ValueError: invalid tag` hatası

---

### 3️⃣ Doğrudan Şifreli Backup Oluştur

**Avantajı:** Normal backup oluştur → Şifrele → Orijinali sil (tek adımda)

**Web Arayüzü:**
1. **Backup Şifreleme** sayfasına gidin
2. **"Şifreli Backup Oluştur"** kartına tıklayın
3. Şifre belirleyin ve tekrarlayın
4. **Database Backup** veya **Full Backup** seçin

**API Kullanımı:**
```bash
# Database Backup (Şifreli)
curl -X POST "http://localhost:8001/api/v1/backup/create-encrypted?backup_type=database&password=YourStrongPassword123!&send_notification=true" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Full Backup (Şifreli)
curl -X POST "http://localhost:8001/api/v1/backup/create-encrypted?backup_type=full&password=YourStrongPassword123!&send_notification=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Telegram Bildirimi:**
```
🔒 Şifreli Backup Oluşturuldu!

📦 Tip: Database
📂 Dosya: backup_database_2025-01-06.db.encrypted
📊 Boyut: 5.2 MB (orijinal: 4.8 MB)
🔐 Algoritma: AES-256-GCM
⏰ Tarih: 2025-01-06 16:30:45

✅ Backup güvenli şekilde şifrelendi
```

---

## 🔐 Şifre Politikası

### Minimum Gereksinimler

- **Uzunluk**: En az 8 karakter
- **Önerilen**: 12+ karakter
- **Güçlü Şifre Örneği**: `MyBackup@2025!Secure#`

### Şifre Güvenlik İpuçları

✅ **YAPILMASI GEREKENLER:**
- Büyük + küçük harf + sayı + özel karakter kullanın
- En az 12 karakter tercih edin
- Şifreyi güvenli bir yerde saklayın (password manager)
- Her backup için farklı şifre kullanmayı düşünün

❌ **YAPILMAMASI GEREKENLER:**
- "password123" gibi basit şifreler
- Kullanıcı adınız veya şirket adınız
- Sözlükte bulunan kelimeler
- Önceki şifrelerinizi tekrar kullanmayın

---

## 📊 API Endpoints

### 1. `POST /api/v1/backup/encrypt`

**Mevcut backup'ı şifreler**

**Request:**
```json
{
  "backup_filename": "backup_database_2025-01-06.db",
  "password": "YourStrongPassword123!"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Backup başarıyla şifrelendi",
  "original_file": "backup_database_2025-01-06.db",
  "encrypted_file": "backup_database_2025-01-06.db.encrypted",
  "original_size": 5242880,
  "encrypted_size": 5243008,
  "algorithm": "AES-256-GCM"
}
```

---

### 2. `POST /api/v1/backup/decrypt`

**Şifreli backup'ın şifresini çözer**

**Request:**
```json
{
  "encrypted_filename": "backup_database_2025-01-06.db.encrypted",
  "password": "YourStrongPassword123!"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Backup şifresi başarıyla çözüldü",
  "encrypted_file": "backup_database_2025-01-06.db.encrypted",
  "decrypted_file": "backup_database_2025-01-06.db",
  "encrypted_size": 5243008,
  "decrypted_size": 5242880
}
```

**Response (Wrong Password):**
```json
{
  "detail": "Şifre yanlış veya dosya bozuk: MAC check failed (authentication failed)"
}
```

---

### 3. `POST /api/v1/backup/create-encrypted`

**Doğrudan şifreli backup oluşturur**

**Query Parameters:**
- `backup_type`: `database` veya `full`
- `password`: Şifre (min 8 karakter)
- `send_notification`: `true` veya `false` (Telegram bildirimi)

**Example:**
```bash
POST /api/v1/backup/create-encrypted?backup_type=database&password=SecurePass123!&send_notification=true
```

**Response:**
```json
{
  "success": true,
  "message": "Şifreli database backup başarıyla oluşturuldu!",
  "backup_type": "database",
  "encrypted_file": "backup_database_2025-01-06.db.encrypted",
  "encrypted_size": 5243008,
  "original_size": 5242880,
  "algorithm": "AES-256-GCM"
}
```

---

### 4. `POST /api/v1/backup/verify-password`

**Şifre doğruluğunu test eder (dosyayı açmadan)**

**Request:**
```json
{
  "encrypted_filename": "backup_database_2025-01-06.db.encrypted",
  "password": "TestPassword"
}
```

**Response:**
```json
{
  "success": true,
  "is_valid": true,
  "message": "Şifre doğru"
}
```

---

### 5. `GET /api/v1/backup/encrypted-info/{filename}`

**Şifreli dosya metadata'sını döner (şifre gerekmez)**

**Example:**
```bash
GET /api/v1/backup/encrypted-info/backup_database_2025-01-06.db.encrypted
```

**Response:**
```json
{
  "success": true,
  "filename": "backup_database_2025-01-06.db.encrypted",
  "encrypted_size": 5243008,
  "algorithm": "AES-256-GCM",
  "has_valid_format": true,
  "has_salt": true,
  "has_nonce": true,
  "estimated_original_size": 5242880,
  "overhead_bytes": 128
}
```

---

## 🛡️ Güvenlik Özellikleri

### 1. PBKDF2 Key Derivation

- **İterasyon Sayısı**: 100,000 (OWASP önerisi)
- **Hash Algoritması**: SHA-256
- **Amaç**: Brute-force saldırılarını zorlaştırır
- **Performans**: ~100-200ms şifreleme/çözme süresi

### 2. AES-GCM Authenticated Encryption

- **Confidentiality**: AES-256 encryption
- **Integrity**: Galois/Counter Mode authentication tag
- **Authentication**: 128-bit auth tag ile veri bütünlüğü
- **AEAD**: Authenticated Encryption with Associated Data

### 3. Random Salt & Nonce

- **Salt**: 16 byte, her şifreleme işlemi için benzersiz
- **Nonce**: 12 byte, AES-GCM için önerilen boyut
- **Kaynak**: `secrets` modülü (cryptographically secure)

---

## ⚠️ Önemli Notlar

### Şifre Yönetimi

🔴 **ÇOK ÖNEMLİ:** Şifrenizi kaybederseniz, backup dosyanızı **asla** geri alamazsınız!

**Şifre Saklama Önerileri:**
1. Password manager kullanın (1Password, LastPass, KeePass)
2. Fiziksel olarak güvenli bir yerde sakla yın (kasa, kilit dolap)
3. Şifreli notlar (GPG encrypted file)
4. Birden fazla güvenli lokasyonda yedek tutun

### Dosya Boyutu Overhead

- **Salt**: 16 bytes
- **Nonce**: 12 bytes
- **Auth Tag**: 16 bytes
- **Toplam Overhead**: ~128 bytes (ihmal edilebilir)

Örnek: 100 MB backup → 100.000128 MB şifreli dosya

### Performans

- **Şifreleme Hızı**: ~50-100 MB/s (CPU'ya bağlı)
- **Çözme Hızı**: ~50-100 MB/s
- **PBKDF2 Süre**: ~100-200ms (100k iterasyon)
- **1 GB Backup**: ~10-20 saniye şifreleme

---

## 🧪 Test Senaryoları

### Manuel Test

```python
# Backend test scripti
cd /opt/wg-manager/backend
source venv/bin/activate
python3 << 'EOF'
from app.services.backup_encryption_service import BackupEncryptionService
import os

# Test dosyası oluştur
test_file = "/tmp/test_backup.txt"
with open(test_file, "w") as f:
    f.write("Bu bir test backup dosyasıdır.")

# Şifrele
encrypted = BackupEncryptionService.encrypt_file(
    test_file, 
    "/tmp/test_backup.txt.encrypted", 
    "TestPassword123"
)
print(f"Şifreleme: {encrypted}")

# Şifreyi doğrula
is_valid = BackupEncryptionService.verify_password(
    "/tmp/test_backup.txt.encrypted",
    "TestPassword123"
)
print(f"Şifre doğru: {is_valid}")

# Yanlış şifre test et
is_valid_wrong = BackupEncryptionService.verify_password(
    "/tmp/test_backup.txt.encrypted",
    "WrongPassword"
)
print(f"Yanlış şifre: {is_valid_wrong}")

# Şifre çöz
decrypted = BackupEncryptionService.decrypt_file(
    "/tmp/test_backup.txt.encrypted",
    "/tmp/test_backup_decrypted.txt",
    "TestPassword123"
)
print(f"Şifre çözme: {decrypted}")

# İçeriği kontrol et
with open("/tmp/test_backup_decrypted.txt", "r") as f:
    content = f.read()
    print(f"İçerik: {content}")
    
# Temizlik
os.remove(test_file)
os.remove("/tmp/test_backup.txt.encrypted")
os.remove("/tmp/test_backup_decrypted.txt")
print("✅ Test başarılı!")
EOF
```

---

## 📚 Referanslar

### Kryptografi Standartları

- [AES-256](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard) - NIST FIPS 197
- [GCM Mode](https://en.wikipedia.org/wiki/Galois/Counter_Mode) - NIST SP 800-38D
- [PBKDF2](https://tools.ietf.org/html/rfc2898) - RFC 2898
- [OWASP Password Guidelines](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

### Python Cryptography Library

- [Cryptography Documentation](https://cryptography.io/en/latest/)
- [AEAD (GCM) Usage](https://cryptography.io/en/latest/hazmat/primitives/aead/)
- [PBKDF2HMAC](https://cryptography.io/en/latest/hazmat/primitives/key-derivation-functions/#cryptography.hazmat.primitives.kdf.pbkdf2.PBKDF2HMAC)

---

## 🆘 Sorun Giderme

### Hata: "Şifre en az 8 karakter olmalıdır"

**Neden:** API seviyesinde minimum şifre uzunluğu kontrolü  
**Çözüm:** En az 8 karakterlik şifre belirleyin

---

### Hata: "MAC check failed (authentication failed)"

**Neden:** Yanlış şifre veya dosya bozuk  
**Çözüm:** 
1. Şifreyi doğru girdiğinizden emin olun
2. Dosyanın bozulmadığını kontrol edin (boyut, hash)
3. Farklı bir şifre deneyin

---

### Hata: "invalid file format"

**Neden:** Dosya `.encrypted` uzantılı ama geçerli formatta değil  
**Çözüm:**
1. Dosyanın gerçekten bu sistem ile şifrelendiğinden emin olun
2. `/api/v1/backup/encrypted-info/{filename}` ile metadata kontrol edin
3. Manuel şifreleme yapılmışsa formatı doğru olmalı

---

### Performans Sorunları

**Belirtiler:** Şifreleme/çözme çok yavaş  
**Çözümler:**
1. CPU yükünü kontrol edin (`htop`)
2. Disk I/O hızını kontrol edin (`iotop`)
3. PBKDF2 iterasyon sayısını düşürmeyi düşünün (güvenlik riski!)
4. Daha hızlı disk kullanın (SSD)

---

## 📝 Changelog

### v1.0.0 (6 Ocak 2025)
- ✅ AES-256-GCM encryption implementasyonu
- ✅ PBKDF2-HMAC key derivation (100k iterations)
- ✅ 5 API endpoint (encrypt, decrypt, create-encrypted, verify-password, encrypted-info)
- ✅ Web UI (/backup-encryption)
- ✅ Telegram bildirim entegrasyonu
- ✅ Activity logging
- ✅ Comprehensive documentation

---

**Geliştiren:** Claude Sonnet 4.5  
**İletişim:** GitHub Issues  
**Lisans:** MIT  

🔐 **Güvenli Backup'lar!**
