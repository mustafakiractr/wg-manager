#!/bin/bash

# ============================================
# PostgreSQL Kurulum ve Yapılandırma Script'i
# WireGuard Manager Panel için
# ============================================

set -e  # Hata durumunda dur

echo "============================================"
echo "PostgreSQL Kurulum ve Yapılandırma"
echo "============================================"
echo ""

# Root kontrolü
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Bu script root olarak çalıştırılmalıdır: sudo bash setup_postgresql.sh"
    exit 1
fi

# PostgreSQL kurulu mu kontrol et
if ! command -v psql &> /dev/null; then
    echo "📦 PostgreSQL kurulu değil, yükleniyor..."
    
    # OS tespiti
    if [ -f /etc/debian_version ]; then
        # Debian/Ubuntu
        apt-get update
        apt-get install -y postgresql postgresql-contrib
    elif [ -f /etc/redhat-release ]; then
        # RHEL/CentOS/Fedora
        dnf install -y postgresql-server postgresql-contrib
        postgresql-setup --initdb
    else
        echo "❌ Desteklenmeyen işletim sistemi"
        exit 1
    fi
    
    # PostgreSQL servisini başlat
    systemctl enable postgresql
    systemctl start postgresql
    
    echo "✅ PostgreSQL yüklendi"
else
    echo "✅ PostgreSQL zaten kurulu"
fi

# PostgreSQL servisini kontrol et
if ! systemctl is-active --quiet postgresql; then
    echo "🔄 PostgreSQL servisi başlatılıyor..."
    systemctl start postgresql
fi

echo ""
echo "============================================"
echo "Veritabanı Yapılandırması"
echo "============================================"
echo ""

# Script'in çalıştırıldığı dizini tespit et
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

# Backend dizininin var olduğunu kontrol et
if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ HATA: Backend dizini bulunamadı: $BACKEND_DIR"
    echo "   Script'i proje ana dizininde çalıştırın (örn: /opt/wg-manager/ veya /root/wg/)"
    exit 1
fi

echo "📁 Kurulum dizini: $SCRIPT_DIR"
echo "📁 Backend dizini: $BACKEND_DIR"
echo ""

# .env dosyasından mevcut ayarları oku (varsa)
ENV_FILE="$BACKEND_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    echo "📄 Mevcut .env dosyası bulundu, ayarlar okunuyor..."
    
    # DATABASE_URL'den kullanıcı adı ve şifreyi çıkar
    DB_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"')
    
    if [[ $DB_URL == postgresql* ]]; then
        # postgresql+asyncpg://wg_user:password@localhost/wg_manager
        DB_USER=$(echo "$DB_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
        DB_PASS=$(echo "$DB_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
        DB_NAME=$(echo "$DB_URL" | sed -n 's/.*@[^/]*\/\([^?]*\).*/\1/p')
        
        echo "✅ Ayarlar okundu:"
        echo "   Kullanıcı: $DB_USER"
        echo "   Veritabanı: $DB_NAME"
    else
        echo "⚠️  .env dosyasında SQLite yapılandırması var, PostgreSQL yapılandırması yapılacak"
        DB_USER=""
    fi
fi

# Eğer .env'den okuyamadıysak, varsayılan değerleri kullan veya kullanıcıdan iste
if [ -z "$DB_USER" ]; then
    echo ""
    read -p "PostgreSQL kullanıcı adı [wg_user]: " DB_USER
    DB_USER=${DB_USER:-wg_user}
    
    read -p "PostgreSQL veritabanı adı [wg_manager]: " DB_NAME
    DB_NAME=${DB_NAME:-wg_manager}
    
    # Güçlü şifre oluştur
    DB_PASS=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-24)
    echo "🔐 Otomatik şifre oluşturuldu: $DB_PASS"
fi

echo ""
echo "============================================"
echo "PostgreSQL Kullanıcı ve Veritabanı Oluşturma"
echo "============================================"
echo ""

# PostgreSQL kullanıcısı oluştur
echo "👤 PostgreSQL kullanıcısı oluşturuluyor: $DB_USER"
sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" || {
    echo "⚠️  Kullanıcı zaten var, şifre güncelleniyor..."
    sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';"
}

# Veritabanı oluştur
echo "🗄️  Veritabanı oluşturuluyor: $DB_NAME"
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" || {
    echo "⚠️  Veritabanı zaten var, owner güncelleniyor..."
    sudo -u postgres psql -c "ALTER DATABASE $DB_NAME OWNER TO $DB_USER;"
}

# Yetkileri ver
echo "🔑 Yetkiler veriliyor..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# PostgreSQL 15+ için ek yetkiler (schema permissions)
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -d $DB_NAME -c "GRANT CREATE ON SCHEMA public TO $DB_USER;" 2>/dev/null || true

echo ""
echo "✅ PostgreSQL yapılandırması tamamlandı!"
echo ""

# .env dosyasını güncelle
echo "============================================"
echo ".env Dosyası Güncelleme"
echo "============================================"
echo ""

if [ ! -f "$ENV_FILE" ]; then
    echo "📝 .env dosyası oluşturuluyor..."
    
    # .env.example dosyasını kontrol et
    if [ -f "$BACKEND_DIR/.env.example" ]; then
        cp "$BACKEND_DIR/.env.example" "$ENV_FILE"
    else
        echo "⚠️  .env.example bulunamadı, yeni .env dosyası oluşturuluyor..."
        touch "$ENV_FILE"
    fi
fi

# DATABASE_URL'i güncelle
NEW_DB_URL="postgresql+asyncpg://${DB_USER}:${DB_PASS}@localhost/${DB_NAME}"

if grep -q "^DATABASE_URL=" "$ENV_FILE"; then
    # Mevcut satırı güncelle (hem PostgreSQL hem SQLite satırları olabilir)
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"$NEW_DB_URL\"|" "$ENV_FILE"
    # SQLite satırını yorum yap
    sed -i 's|^DATABASE_URL="sqlite:|# DATABASE_URL="sqlite:|' "$ENV_FILE"
else
    # Yeni satır ekle
    echo "DATABASE_URL=\"$NEW_DB_URL\"" >> "$ENV_FILE"
fi

# .env dosyasının doğru oluşturulduğunu kontrol et
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ HATA: .env dosyası oluşturulamadı: $ENV_FILE"
    exit 1
fi

if ! grep -q "DATABASE_URL=" "$ENV_FILE"; then
    echo "❌ HATA: DATABASE_URL .env dosyasında bulunamadı"
    exit 1
fi

echo "✅ .env dosyası güncellendi: $ENV_FILE"
echo "✅ DATABASE_URL doğrulandı"
echo ""

# Veritabanı bağlantısını test et
echo "============================================"
echo "Bağlantı Testi"
echo "============================================"
echo ""

if sudo -u postgres psql -U $DB_USER -d $DB_NAME -c "SELECT version();" &> /dev/null; then
    echo "✅ PostgreSQL bağlantısı başarılı!"
else
    echo "⚠️  Bağlantı testi başarısız, ancak yapılandırma tamamlandı"
fi

echo ""
echo "============================================"
echo "Kurulum Bilgileri"
echo "============================================"
echo ""
echo "Veritabanı: $DB_NAME"
echo "Kullanıcı: $DB_USER"
echo "Şifre: $DB_PASS"
echo "Connection String: $NEW_DB_URL"
echo ""
echo "⚠️  Bu bilgileri güvenli bir yerde saklayın!"
echo ""

# Şifre bilgisini dosyaya kaydet
CREDS_FILE="$BACKEND_DIR/postgresql_credentials.txt"
cat > "$CREDS_FILE" << EOF
PostgreSQL Bağlantı Bilgileri
=============================
Veritabanı: $DB_NAME
Kullanıcı: $DB_USER
Şifre: $DB_PASS
Connection String: $NEW_DB_URL

Oluşturulma: $(date)
EOF

chmod 600 "$CREDS_FILE"
echo "💾 Bağlantı bilgileri kaydedildi: $CREDS_FILE"
echo ""

echo "============================================"
echo "Sonraki Adımlar"
echo "============================================"
echo ""
echo "1. Veritabanı tablolarını oluşturun:"
echo "   cd $BACKEND_DIR"
echo "   source venv/bin/activate"
echo "   python init_db.py"
echo ""
echo "2. Backend'i başlatın:"
echo "   cd $SCRIPT_DIR"
echo "   bash start_backend.sh"
echo ""
echo "✅ PostgreSQL kurulumu tamamlandı!"
