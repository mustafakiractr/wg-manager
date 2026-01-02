# Test Yapısı

## Dizin Yapısı

```
tests/
├── conftest.py          # Pytest fixtures ve yapılandırma
├── unit/                # Unit testler
│   └── test_*.py
├── integration/         # Entegrasyon testleri
│   └── test_*.py
└── api/                 # API endpoint testleri
    └── test_*.py
```

## Testleri Çalıştırma

```bash
# Tüm testleri çalıştır
pytest

# Sadece unit testler
pytest tests/unit/

# Sadece API testleri
pytest tests/api/

# Coverage raporu ile
pytest --cov=app --cov-report=html

# Belirli bir test dosyası
pytest tests/unit/test_crypto.py

# Belirli bir test fonksiyonu
pytest tests/unit/test_crypto.py::TestCrypto::test_encrypt_decrypt_password

# Verbose mod
pytest -v

# Markers ile
pytest -m unit           # Sadece unit testler
pytest -m "not slow"     # Yavaş testleri atla
```

## Test Yazma Kuralları

1. **Dosya İsimlendirme**: `test_*.py`
2. **Class İsimlendirme**: `Test*`
3. **Fonksiyon İsimlendirme**: `test_*`
4. **Async Testler**: `@pytest.mark.asyncio` kullan
5. **Markers**: Testleri kategorize et (`@pytest.mark.unit`, `@pytest.mark.api`)

## Fixtures

Ortak fixtures `conftest.py` dosyasında tanımlı:

- `test_db`: Test veritabanı session'ı
- `client`: HTTP test client
- `mock_mikrotik_connection`: Mock MikroTik bağlantısı

## Coverage Hedefi

Minimum %50 code coverage hedeflenmiştir.
