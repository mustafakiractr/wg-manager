# Router Manager Backend

FastAPI tabanlı MikroTik Router yönetim API'si.

## Kurulum

```bash
# Virtual environment oluştur
python3 -m venv venv
source venv/bin/activate

# Bağımlılıkları yükle
pip install -r requirements.txt

# .env dosyasını oluştur ve düzenle
cp .env.example .env

# Veritabanını başlat
python init_db.py

# Uygulamayı başlat
python run.py
```

## Yapılandırma

`.env` dosyasında şu ayarları yapın:

- `MIKROTIK_HOST`: MikroTik router IP adresi
- `MIKROTIK_PORT`: API portu (8728 veya 8729)
- `MIKROTIK_USER`: Router kullanıcı adı
- `MIKROTIK_PASSWORD`: Router şifresi
- `SECRET_KEY`: JWT için güçlü bir secret key

## API Dokümantasyonu

Uygulama çalıştıktan sonra:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc


