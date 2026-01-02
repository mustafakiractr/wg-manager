# Alembic Migration Kılavuzu

## Kurulum

Alembic zaten yapılandırılmış durumda. Database URL `.env` dosyasından otomatik alınıyor.

## Temel Komutlar

### 1. Yeni Migration Oluşturma (Autogenerate)

```bash
cd /root/wg/backend
source venv/bin/activate

# Model değişikliklerini otomatik tespit et
alembic revision --autogenerate -m "Açıklama buraya"

# Örnek:
alembic revision --autogenerate -m "Add user roles table"
```

### 2. Migration Uygulama

```bash
# En son versiyona upgrade
alembic upgrade head

# Bir önceki versiyona downgrade
alembic downgrade -1

# Belirli bir versiyona git
alembic upgrade abc123

# Tüm migration'ları geri al
alembic downgrade base
```

### 3. Migration Geçmişi

```bash
# Mevcut versiyonu göster
alembic current

# Migration geçmişini göster
alembic history

# Detaylı geçmiş
alembic history --verbose
```

### 4. Boş Migration Oluşturma (Manuel)

```bash
# Autogenerate kullanmadan boş migration
alembic revision -m "Custom migration"
```

## Migration Dosyası Yapısı

```python
"""Add user roles table

Revision ID: abc123def456
Revises: xyz789ghi012
Create Date: 2026-01-02 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'abc123def456'
down_revision = 'xyz789ghi012'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Upgrade işlemleri
    op.create_table(
        'user_roles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade() -> None:
    # Downgrade işlemleri
    op.drop_table('user_roles')
```

## En İyi Uygulamalar

1. **Her Model Değişikliği İçin Migration Oluştur**
   ```bash
   # Model'i değiştir
   # Sonra migration oluştur
   alembic revision --autogenerate -m "Update user model"
   ```

2. **Migration'ı Test Et**
   ```bash
   # Önce upgrade
   alembic upgrade head
   
   # Sonra downgrade ile geri al
   alembic downgrade -1
   
   # Tekrar upgrade
   alembic upgrade head
   ```

3. **Production'a Geçmeden Önce**
   - Tüm migration'ları development'ta test et
   - Downgrade script'lerinin çalıştığından emin ol
   - Büyük data migration'lar için backup al

4. **Migration Mesajları**
   - Açıklayıcı olsun
   - Ne değiştiğini belirt
   - Örnek: "Add email_verified column to users table"

## Veri Migration Örneği

```python
from alembic import op
import sqlalchemy as sa

def upgrade() -> None:
    # Yeni sütun ekle
    op.add_column('users', sa.Column('is_active', sa.Boolean(), default=True))
    
    # Mevcut kullanıcıları aktif yap
    op.execute("UPDATE users SET is_active = TRUE WHERE is_active IS NULL")

def downgrade() -> None:
    op.drop_column('users', 'is_active')
```

## Sorun Giderme

### "Target database is not up to date"

```bash
# Mevcut durumu kontrol et
alembic current

# Son versiyona upgrade
alembic upgrade head
```

### "Can't locate revision identified by 'xyz'"

```bash
# Migration geçmişini temizle ve yeniden başlat
# DİKKAT: Bu production'da kullanılmamalı!
alembic stamp head
```

### Database değişiklikleri tespit edilmiyor

Models'lerin `alembic/env.py` içinde import edildiğinden emin olun.
