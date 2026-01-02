# 🚀 Yeni Makineye Hızlı Kurulum

## PostgreSQL Şifre Hatası Çözümü

Eğer `init_db.py` çalıştırırken şu hatayı alıyorsanız:
```
asyncpg.exceptions.InvalidPasswordError: password authentication failed for user "wg_user"
```

Bu, PostgreSQL kullanıcısı ve veritabanının henüz oluşturulmamış olmasından kaynaklanır.

---

## ⚡ Otomatik Kurulum (Önerilen)

### Adım 1: PostgreSQL'i Kur ve Yapılandır
```bash
sudo bash setup_postgresql.sh
```

Bu script:
- ✅ PostgreSQL'i yükler (kurulu değilse)
- ✅ `wg_user` kullanıcısını oluşturur
- ✅ `wg_manager` veritabanını oluşturur
- ✅ Güçlü şifre oluşturur
- ✅ `.env` dosyasını otomatik günceller
- ✅ Bağlantı bilgilerini `postgresql_credentials.txt` dosyasına kaydeder

### Adım 2: Veritabanı Tablolarını Oluştur
```bash
cd /root/wg/backend
source venv/bin/activate
python init_db.py
```

### Adım 3: Servisleri Başlat
```bash
bash /root/wg/start_all.sh
```

---

## 🔧 Manuel Kurulum

Eğer manuel olarak kurmak istiyorsanız:

### 1. PostgreSQL'i Yükle
```bash
# Debian/Ubuntu
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# RHEL/CentOS/Fedora
sudo dnf install -y postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
```

### 2. PostgreSQL Servisini Başlat
```bash
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 3. Kullanıcı ve Veritabanı Oluştur
```bash
# PostgreSQL kullanıcısı oluştur
sudo -u postgres psql -c "CREATE USER wg_user WITH PASSWORD 'güçlü_şifre_buraya';"

# Veritabanı oluştur
sudo -u postgres psql -c "CREATE DATABASE wg_manager OWNER wg_user;"

# Yetkileri ver
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE wg_manager TO wg_user;"

# PostgreSQL 15+ için ek yetkiler
sudo -u postgres psql -d wg_manager -c "GRANT ALL ON SCHEMA public TO wg_user;"
```

### 4. .env Dosyasını Güncelle
```bash
cd /root/wg/backend
nano .env
```

`DATABASE_URL` satırını güncelleyin:
```
DATABASE_URL="postgresql+asyncpg://wg_user:güçlü_şifre_buraya@localhost/wg_manager"
```

---

## 🐛 Sorun Giderme

### Hata: "password authentication failed"
**Çözüm:** `setup_postgresql.sh` script'ini çalıştırın veya şifreyi manuel olarak düzeltin.

### Hata: "database does not exist"
**Çözüm:** 
```bash
sudo -u postgres psql -c "CREATE DATABASE wg_manager OWNER wg_user;"
```

### Hata: "role does not exist"
**Çözüm:**
```bash
sudo -u postgres psql -c "CREATE USER wg_user WITH PASSWORD 'şifre';"
```

### PostgreSQL Bağlantı Testi
```bash
# Bağlantıyı test et
sudo -u postgres psql -U wg_user -d wg_manager -c "SELECT version();"
```

---

## 📝 SQLite Kullanmak İsterseniz

Eğer PostgreSQL yerine SQLite kullanmak isterseniz, `.env` dosyasını şu şekilde güncelleyin:

```bash
# PostgreSQL satırını yorum yapın
# DATABASE_URL="postgresql+asyncpg://..."

# SQLite satırını aktif edin
DATABASE_URL="sqlite:///./router_manager.db"
```

**Not:** SQLite production ortamı için önerilmez, sadece development için kullanın.

---

## 🔐 Güvenlik Notları

1. **Güçlü Şifre Kullanın:** 
   ```bash
   # Güçlü şifre oluştur
   openssl rand -base64 24
   ```

2. **Dosya İzinleri:**
   ```bash
   chmod 600 /root/wg/backend/.env
   chmod 600 /root/wg/backend/postgresql_credentials.txt
   ```

3. **Firewall Ayarları:** PostgreSQL'i sadece localhost'tan erişilebilir yapın.

---

## 📚 Daha Fazla Bilgi

Detaylı kurulum için: [PROJECT_GUIDE.md](PROJECT_GUIDE.md)
