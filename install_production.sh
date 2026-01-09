#!/bin/bash

#############################################
# MikroTik WireGuard Yönetim Paneli
# Production Kurulum Scripti v3.0
#
# Kullanım: sudo bash install_production.sh
#
# Özellikler:
#   - İnteraktif şifre yapılandırması
#   - PostgreSQL otomatik kurulum
#   - Frontend production build
#   - Systemd servisleri
#   - Güvenlik kontrolleri
#############################################

set -e

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Değişkenler
INSTALL_DIR=$(pwd)
BACKEND_DIR="$INSTALL_DIR/backend"
FRONTEND_DIR="$INSTALL_DIR/frontend"
PYTHON_MIN_VERSION="3.9"
NODE_MIN_VERSION="20"

# Kullanıcı girişleri için değişkenler
DB_PASSWORD=""
ADMIN_PASSWORD=""
MIKROTIK_HOST=""
MIKROTIK_USER=""
MIKROTIK_PASSWORD=""
DOMAIN_NAME=""
SECRET_KEY=""

#############################################
# Fonksiyonlar
#############################################

print_banner() {
    clear
    echo -e "${CYAN}"
    cat << "EOF"
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║    ██╗    ██╗ ██████╗       ███╗   ███╗ █████╗ ███╗   ██╗     ║
║    ██║    ██║██╔════╝       ████╗ ████║██╔══██╗████╗  ██║     ║
║    ██║ █╗ ██║██║  ███╗█████╗██╔████╔██║███████║██╔██╗ ██║     ║
║    ██║███╗██║██║   ██║╚════╝██║╚██╔╝██║██╔══██║██║╚██╗██║     ║
║    ╚███╔███╔╝╚██████╔╝      ██║ ╚═╝ ██║██║  ██║██║ ╚████║     ║
║     ╚══╝╚══╝  ╚═════╝       ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝     ║
║                                                                ║
║           MikroTik WireGuard Yönetim Paneli                    ║
║              Production Installer v3.0                         ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

print_step() {
    echo -e "\n${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

check_command() {
    command -v $1 &> /dev/null
}

version_ge() {
    printf '%s\n%s' "$2" "$1" | sort -V -C
}

# Şifre validasyonu
validate_password() {
    local password=$1
    local min_length=${2:-8}

    if [ ${#password} -lt $min_length ]; then
        return 1
    fi
    return 0
}

# Güvenli şifre okuma
read_password() {
    local prompt=$1
    local var_name=$2
    local confirm=${3:-true}
    local min_length=${4:-8}

    while true; do
        echo -ne "${YELLOW}$prompt${NC}"
        read -s password
        echo

        if ! validate_password "$password" $min_length; then
            print_error "Şifre en az $min_length karakter olmalıdır!"
            continue
        fi

        if [ "$confirm" = "true" ]; then
            echo -ne "${YELLOW}Şifreyi tekrar girin: ${NC}"
            read -s password_confirm
            echo

            if [ "$password" != "$password_confirm" ]; then
                print_error "Şifreler eşleşmiyor!"
                continue
            fi
        fi

        eval "$var_name='$password'"
        break
    done
}

# Opsiyonel input okuma
read_optional() {
    local prompt=$1
    local var_name=$2
    local default=$3

    echo -ne "${YELLOW}$prompt ${CYAN}[$default]${NC}: "
    read input

    if [ -z "$input" ]; then
        eval "$var_name='$default'"
    else
        eval "$var_name='$input'"
    fi
}

#############################################
# Root Kontrolü
#############################################

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Bu script root yetkisi ile çalıştırılmalıdır!${NC}"
    echo -e "${YELLOW}Lütfen 'sudo bash install_production.sh' komutunu kullanın${NC}"
    exit 1
fi

#############################################
# Banner ve Hoşgeldin
#############################################

print_banner

echo -e "${WHITE}Bu script aşağıdaki işlemleri otomatik olarak yapacak:${NC}"
echo ""
echo -e "  ${GREEN}✓${NC} Sistem paketlerini güncelleme"
echo -e "  ${GREEN}✓${NC} Python 3.9+ kurulumu"
echo -e "  ${GREEN}✓${NC} Node.js 20+ kurulumu"
echo -e "  ${GREEN}✓${NC} PostgreSQL kurulumu ve yapılandırması"
echo -e "  ${GREEN}✓${NC} Backend bağımlılıkları"
echo -e "  ${GREEN}✓${NC} Frontend bağımlılıkları ve production build"
echo -e "  ${GREEN}✓${NC} Nginx reverse proxy yapılandırması"
echo -e "  ${GREEN}✓${NC} Systemd servisleri ve güvenlik"
echo ""

echo -e "${YELLOW}Kurulum dizini: ${CYAN}$INSTALL_DIR${NC}"
echo ""

read -p "$(echo -e ${GREEN}Kuruluma devam edilsin mi? [Y/n]: ${NC})" -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]] && [[ ! -z $REPLY ]]; then
    echo -e "${RED}Kurulum iptal edildi.${NC}"
    exit 0
fi

#############################################
# ADIM 1: İnteraktif Yapılandırma
#############################################

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${WHITE}       ADIM 1/8: Yapılandırma Bilgileri${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${CYAN}Lütfen aşağıdaki bilgileri girin. Bu bilgiler güvenli bir şekilde${NC}"
echo -e "${CYAN}yapılandırılacak ve kurulum sırasında kullanılacaktır.${NC}"
echo ""

# PostgreSQL şifresi
echo -e "${WHITE}━━━ PostgreSQL Veritabanı ━━━${NC}"
print_info "Bu şifre veritabanı bağlantısı için kullanılacak"
read_password "PostgreSQL şifresi (min 8 karakter): " DB_PASSWORD true 8
print_success "PostgreSQL şifresi ayarlandı"
echo ""

# Admin şifresi
echo -e "${WHITE}━━━ Admin Hesabı ━━━${NC}"
print_info "Web paneline giriş için kullanılacak admin şifresi"
read_password "Admin şifresi (min 8 karakter): " ADMIN_PASSWORD true 8
print_success "Admin şifresi ayarlandı"
echo ""

# MikroTik bilgileri (opsiyonel)
echo -e "${WHITE}━━━ MikroTik Bağlantısı (Opsiyonel) ━━━${NC}"
print_info "Sonradan web panelinden de yapılandırabilirsiniz"
read -p "$(echo -e ${YELLOW}MikroTik bilgilerini şimdi girmek ister misiniz? [y/N]: ${NC})" -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    read_optional "MikroTik IP adresi" MIKROTIK_HOST "192.168.88.1"
    read_optional "MikroTik kullanıcı adı" MIKROTIK_USER "admin"
    echo -ne "${YELLOW}MikroTik şifresi: ${NC}"
    read -s MIKROTIK_PASSWORD
    echo
    print_success "MikroTik bilgileri ayarlandı"
else
    MIKROTIK_HOST="192.168.88.1"
    MIKROTIK_USER="admin"
    MIKROTIK_PASSWORD=""
    print_info "MikroTik bilgileri sonradan yapılandırılacak"
fi
echo ""

# Domain bilgisi (opsiyonel)
echo -e "${WHITE}━━━ Domain Yapılandırması (Opsiyonel) ━━━${NC}"
print_info "HTTPS ve CORS için domain adı"
read_optional "Domain adı (örn: wg.example.com)" DOMAIN_NAME ""
if [ -n "$DOMAIN_NAME" ]; then
    print_success "Domain ayarlandı: $DOMAIN_NAME"
else
    print_info "Domain sonradan yapılandırılabilir"
fi
echo ""

# SECRET_KEY otomatik oluştur
print_step "Güvenli SECRET_KEY oluşturuluyor..."
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(64))" 2>/dev/null || openssl rand -hex 64)
print_success "SECRET_KEY oluşturuldu"

echo ""
echo -e "${GREEN}✅ Yapılandırma bilgileri toplandı!${NC}"
echo ""

#############################################
# ADIM 2: Sistem Bilgisi ve Güncelleme
#############################################

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${WHITE}       ADIM 2/8: Sistem Güncelleme${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

print_step "Sistem bilgileri alınıyor..."

# İşletim sistemi tespiti
if [ -f /etc/os-release ]; then
    . /etc/os-release
    print_success "İşletim Sistemi: $NAME $VERSION"
    OS_ID=$ID
else
    print_warning "İşletim sistemi tanımlanamadı"
    OS_ID="unknown"
fi

# Sistem güncelleme
print_step "Sistem paketleri güncelleniyor..."

if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get upgrade -y -qq
    print_success "Sistem paketleri güncellendi"
elif [ "$OS_ID" = "centos" ] || [ "$OS_ID" = "rhel" ] || [ "$OS_ID" = "fedora" ]; then
    yum update -y -q
    print_success "Sistem paketleri güncellendi"
else
    print_warning "Bilinmeyen işletim sistemi, manuel güncelleme gerekebilir"
fi

#############################################
# ADIM 3: Gerekli Paketlerin Kurulumu
#############################################

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${WHITE}       ADIM 3/8: Gerekli Paketler${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Python kurulumu
print_step "Python kontrolü ve kurulumu..."

if check_command python3; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    PYTHON_MAJOR_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f1,2)
    if version_ge "$PYTHON_VERSION" "$PYTHON_MIN_VERSION"; then
        print_success "Python $PYTHON_VERSION mevcut"
        # Mevcut Python için venv paketini yükle
        if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
            print_step "Python $PYTHON_MAJOR_MINOR venv paketi yükleniyor..."
            apt-get install -y -qq python3-venv python3-pip python3-dev python${PYTHON_MAJOR_MINOR}-venv 2>/dev/null || \
            apt-get install -y -qq python3-venv python3-pip python3-dev 2>/dev/null || true
            print_success "Python venv paketi yüklendi"
        fi
    else
        print_warning "Python $PYTHON_VERSION çok eski, güncelleniyor..."
        if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
            apt-get install -y -qq software-properties-common
            add-apt-repository -y ppa:deadsnakes/ppa 2>/dev/null || true
            apt-get update -qq
            apt-get install -y -qq python3.11 python3.11-venv python3.11-dev python3-pip
            update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 2>/dev/null || true
        fi
        print_success "Python güncellendi"
    fi
else
    print_step "Python yükleniyor..."
    if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
        apt-get install -y -qq software-properties-common python3 python3-venv python3-dev python3-pip
        # Yüklenen Python sürümü için venv paketi
        PYTHON_MAJOR_MINOR=$(python3 --version 2>/dev/null | grep -oP '\d+\.\d+' | head -1)
        if [ -n "$PYTHON_MAJOR_MINOR" ]; then
            apt-get install -y -qq python${PYTHON_MAJOR_MINOR}-venv 2>/dev/null || true
        fi
    elif [ "$OS_ID" = "centos" ] || [ "$OS_ID" = "rhel" ]; then
        yum install -y -q python39 python39-devel python39-pip
    fi
    print_success "Python yüklendi"
fi

# Node.js kurulumu
print_step "Node.js kontrolü ve kurulumu..."

NEED_NODE_INSTALL=false

if check_command node; then
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    if version_ge "$NODE_VERSION" "$NODE_MIN_VERSION"; then
        print_success "Node.js v$NODE_VERSION mevcut"
    else
        print_warning "Node.js v$NODE_VERSION çok eski"
        NEED_NODE_INSTALL=true
    fi
else
    NEED_NODE_INSTALL=true
fi

if [ "$NEED_NODE_INSTALL" = "true" ]; then
    print_step "Node.js 20.x LTS yükleniyor..."
    if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
        apt-get remove -y -qq nodejs npm 2>/dev/null || true
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y -qq nodejs
    elif [ "$OS_ID" = "centos" ] || [ "$OS_ID" = "rhel" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        yum install -y -q nodejs
    fi
    print_success "Node.js $(node --version) yüklendi"
fi

# npm kontrolü
if ! check_command npm; then
    print_error "npm bulunamadı! Node.js kurulumunda sorun var."
    exit 1
fi
print_success "npm $(npm --version) mevcut"

# Gerekli sistem paketleri
print_step "Gerekli sistem paketleri yükleniyor..."

if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
    # Python sürümünü tespit et ve doğru venv paketini yükle
    PYTHON_VER=$(python3 --version 2>/dev/null | grep -oP '\d+\.\d+' | head -1)
    PACKAGES="build-essential libssl-dev libffi-dev python3-dev python3-venv python3-pip curl wget git libpq-dev nginx certbot python3-certbot-nginx"

    # Python sürümüne özel venv paketi (3.11, 3.12, 3.13 vs.)
    if [ -n "$PYTHON_VER" ]; then
        PACKAGES="$PACKAGES python${PYTHON_VER}-venv"
    fi

    apt-get install -y -qq $PACKAGES 2>/dev/null || apt-get install -y -qq build-essential libssl-dev libffi-dev python3-dev python3-venv python3-pip curl wget git libpq-dev nginx
elif [ "$OS_ID" = "centos" ] || [ "$OS_ID" = "rhel" ]; then
    yum groupinstall -y -q "Development Tools"
    yum install -y -q openssl-devel libffi-devel python3-devel curl wget git postgresql-devel nginx certbot python3-certbot-nginx
fi

print_success "Sistem paketleri yüklendi"

#############################################
# ADIM 4: PostgreSQL Kurulumu
#############################################

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${WHITE}       ADIM 4/8: PostgreSQL Veritabanı${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

print_step "PostgreSQL kontrolü ve kurulumu..."

if ! check_command psql; then
    print_step "PostgreSQL yükleniyor..."
    if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
        apt-get install -y -qq postgresql postgresql-contrib
    elif [ "$OS_ID" = "centos" ] || [ "$OS_ID" = "rhel" ]; then
        yum install -y -q postgresql-server postgresql-contrib
        postgresql-setup initdb 2>/dev/null || true
    fi
    print_success "PostgreSQL yüklendi"
else
    print_success "PostgreSQL zaten kurulu: $(psql --version)"
fi

# PostgreSQL servisini başlat
print_step "PostgreSQL servisi başlatılıyor..."
systemctl enable postgresql 2>/dev/null || true
systemctl start postgresql 2>/dev/null || true
sleep 2

if systemctl is-active --quiet postgresql; then
    print_success "PostgreSQL servisi çalışıyor"
else
    print_error "PostgreSQL servisi başlatılamadı!"
    exit 1
fi

# Database ve kullanıcı oluştur
print_step "Veritabanı ve kullanıcı oluşturuluyor..."

# Mevcut kullanıcıyı sil ve yeniden oluştur (şifre güncellemesi için)
su - postgres -c "psql -c \"DROP DATABASE IF EXISTS wg_manager;\"" 2>/dev/null || true
su - postgres -c "psql -c \"DROP USER IF EXISTS wg_user;\"" 2>/dev/null || true

# Yeni kullanıcı ve database oluştur
su - postgres -c "psql -c \"CREATE USER wg_user WITH PASSWORD '$DB_PASSWORD';\"" 2>/dev/null
su - postgres -c "psql -c \"CREATE DATABASE wg_manager OWNER wg_user;\"" 2>/dev/null
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE wg_manager TO wg_user;\"" 2>/dev/null

print_success "Database 'wg_manager' ve kullanıcı 'wg_user' oluşturuldu"

# pg_hba.conf yapılandırması
print_step "PostgreSQL authentication yapılandırılıyor..."

PG_HBA_CONF=$(su - postgres -c "psql -tAc \"SHOW hba_file;\"" 2>/dev/null | tr -d '[:space:]')

if [ -f "$PG_HBA_CONF" ]; then
    # Backup al
    cp "$PG_HBA_CONF" "${PG_HBA_CONF}.backup.$(date +%Y%m%d_%H%M%S)"

    # Mevcut wg_manager satırlarını temizle
    sed -i '/wg_manager/d' "$PG_HBA_CONF"
    sed -i '/WireGuard Manager/d' "$PG_HBA_CONF"

    # Yeni authentication kuralları ekle (en üste)
    sed -i '1i# WireGuard Manager Database Authentication' "$PG_HBA_CONF"
    sed -i '2ilocal   wg_manager      wg_user                                 md5' "$PG_HBA_CONF"
    sed -i '3ihost    wg_manager      wg_user         127.0.0.1/32            md5' "$PG_HBA_CONF"
    sed -i '4ihost    wg_manager      wg_user         ::1/128                 md5' "$PG_HBA_CONF"

    # PostgreSQL'i reload et
    systemctl reload postgresql
    print_success "PostgreSQL authentication yapılandırıldı"
fi

#############################################
# ADIM 5: Backend Kurulumu
#############################################

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${WHITE}       ADIM 5/8: Backend Kurulumu${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ ! -d "$BACKEND_DIR" ]; then
    print_error "Backend dizini bulunamadı: $BACKEND_DIR"
    exit 1
fi

cd "$BACKEND_DIR"

# Virtual environment
print_step "Python virtual environment oluşturuluyor..."
rm -rf venv 2>/dev/null || true
python3 -m venv venv
print_success "Virtual environment oluşturuldu"

# Aktif et
source venv/bin/activate

# pip güncelle
print_step "pip güncelleniyor..."
pip install --upgrade pip setuptools wheel -q
print_success "pip güncellendi"

# Backend bağımlılıkları
print_step "Backend bağımlılıkları yükleniyor (bu biraz zaman alabilir)..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt -q
    print_success "Backend bağımlılıkları yüklendi"
else
    print_error "requirements.txt bulunamadı!"
    exit 1
fi

# .env dosyası oluştur
print_step ".env dosyası oluşturuluyor..."

# CORS origins hesapla
SERVER_IP=$(hostname -I | awk '{print $1}' || echo "localhost")
CORS_ORIGINS="http://localhost:5173,http://$SERVER_IP:5173,http://$SERVER_IP"

if [ -n "$DOMAIN_NAME" ]; then
    CORS_ORIGINS="$CORS_ORIGINS,http://$DOMAIN_NAME,https://$DOMAIN_NAME"
    TRUSTED_HOSTS="localhost,127.0.0.1,$SERVER_IP,$DOMAIN_NAME"
else
    TRUSTED_HOSTS="localhost,127.0.0.1,$SERVER_IP"
fi

cat > .env << EOF
# ============================================
# WireGuard Manager - Production Configuration
# Oluşturulma: $(date)
# ============================================

# Ortam
ENVIRONMENT="production"

# MikroTik Bağlantısı
MIKROTIK_HOST="$MIKROTIK_HOST"
MIKROTIK_PORT=8728
MIKROTIK_USER="$MIKROTIK_USER"
MIKROTIK_PASSWORD="$MIKROTIK_PASSWORD"
MIKROTIK_USE_TLS=False

# PostgreSQL Veritabanı
DATABASE_URL="postgresql+asyncpg://wg_user:$DB_PASSWORD@localhost/wg_manager"

# JWT Güvenlik
SECRET_KEY="$SECRET_KEY"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Rate Limiting
RATE_LIMIT_PER_MINUTE=200
RATE_LIMIT_LOGIN=5

# Güvenlik
ENABLE_HTTPS_REDIRECT=False
TRUSTED_HOSTS="$TRUSTED_HOSTS"
MAX_REQUEST_SIZE=10485760

# Logging
LOG_LEVEL="INFO"
LOG_FILE="logs/app.log"

# CORS
CORS_ORIGINS="$CORS_ORIGINS"
EOF

chmod 600 .env
print_success ".env dosyası oluşturuldu"

# Log ve backup dizinleri
mkdir -p logs backups
print_success "Log ve backup dizinleri oluşturuldu"

# Veritabanı migration
print_step "Veritabanı tabloları oluşturuluyor..."

# init_db.py'yi admin şifresi ile güncelle
if [ -f "init_db.py" ]; then
    python3 init_db.py
    print_success "Veritabanı tabloları oluşturuldu"
fi

# Admin şifresini güncelle
print_step "Admin şifresi güncelleniyor..."

python3 << PYTHON_EOF
import sys
sys.path.insert(0, '.')

import bcrypt
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# bcrypt ile doğrudan hash oluştur (passlib uyumsuzluğunu bypass)
password = "$ADMIN_PASSWORD".encode('utf-8')
salt = bcrypt.gensalt(rounds=12)
hashed_password = bcrypt.hashpw(password, salt).decode('utf-8')

# Sync engine for simple update
engine = create_engine("postgresql://wg_user:$DB_PASSWORD@localhost/wg_manager")
Session = sessionmaker(bind=engine)
session = Session()

try:
    # Admin kullanıcısını güncelle veya oluştur
    result = session.execute(text("SELECT id FROM users WHERE username = 'admin'"))
    admin = result.fetchone()

    if admin:
        session.execute(
            text("UPDATE users SET hashed_password = :pwd WHERE username = 'admin'"),
            {"pwd": hashed_password}
        )
    else:
        session.execute(
            text("""
                INSERT INTO users (username, email, hashed_password, is_active, role, created_at)
                VALUES ('admin', 'admin@localhost', :pwd, true, 'admin', NOW())
            """),
            {"pwd": hashed_password}
        )

    session.commit()
    print("Admin şifresi güncellendi")
except Exception as e:
    print(f"Hata: {e}")
    session.rollback()
finally:
    session.close()
PYTHON_EOF

print_success "Admin hesabı yapılandırıldı"

deactivate
cd "$INSTALL_DIR"

#############################################
# ADIM 6: Frontend Kurulumu
#############################################

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${WHITE}       ADIM 6/8: Frontend Kurulumu${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ ! -d "$FRONTEND_DIR" ]; then
    print_error "Frontend dizini bulunamadı: $FRONTEND_DIR"
    exit 1
fi

cd "$FRONTEND_DIR"

# .env dosyası - nginx kullanacağımız için /api prefix ile
print_step "Frontend .env dosyası oluşturuluyor..."
if [ -n "$DOMAIN_NAME" ]; then
    cat > .env << EOF
VITE_API_BASE_URL=https://$DOMAIN_NAME
EOF
else
    cat > .env << EOF
VITE_API_BASE_URL=http://$SERVER_IP
EOF
fi
print_success "Frontend .env oluşturuldu"

# Node modülleri
print_step "Frontend bağımlılıkları yükleniyor..."
rm -rf node_modules package-lock.json 2>/dev/null || true
npm install --silent 2>/dev/null
print_success "Frontend bağımlılıkları yüklendi"

# Production build
print_step "Frontend production build yapılıyor..."
npm run build
print_success "Frontend build tamamlandı"

cd "$INSTALL_DIR"

#############################################
# ADIM 7: Nginx Yapılandırması
#############################################

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${WHITE}       ADIM 7/8: Nginx Reverse Proxy${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

print_step "Nginx yapılandırılıyor..."

# Nginx kurulu mu kontrol et
if ! check_command nginx; then
    print_step "Nginx yükleniyor..."
    if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
        apt-get install -y -qq nginx
    elif [ "$OS_ID" = "centos" ] || [ "$OS_ID" = "rhel" ]; then
        yum install -y -q nginx
    fi
    print_success "Nginx yüklendi"
fi

# Nginx config dosyasını oluştur
print_step "Nginx site yapılandırması oluşturuluyor..."

# Domain varsa server_name'i ayarla
if [ -n "$DOMAIN_NAME" ]; then
    NGINX_SERVER_NAME="$DOMAIN_NAME"
else
    NGINX_SERVER_NAME="_"
fi

cat > /etc/nginx/sites-available/wg-manager << EOF
# WireGuard Manager - Production Nginx Configuration
# Auto-generated by install_production.sh

# Rate limiting zones
limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone \$binary_remote_addr zone=login_limit:10m rate=5r/m;

# Backend upstream
upstream wg_backend {
    server 127.0.0.1:8001;
    keepalive 32;
}

server {
    listen 80;
    server_name $NGINX_SERVER_NAME;

    # Cloudflare gerçek IP'yi al
    set_real_ip_from 103.21.244.0/22;
    set_real_ip_from 103.22.200.0/22;
    set_real_ip_from 103.31.4.0/22;
    set_real_ip_from 104.16.0.0/13;
    set_real_ip_from 104.24.0.0/14;
    set_real_ip_from 108.162.192.0/18;
    set_real_ip_from 131.0.72.0/22;
    set_real_ip_from 141.101.64.0/18;
    set_real_ip_from 162.158.0.0/15;
    set_real_ip_from 172.64.0.0/13;
    set_real_ip_from 173.245.48.0/20;
    set_real_ip_from 188.114.96.0/20;
    set_real_ip_from 190.93.240.0/20;
    set_real_ip_from 197.234.240.0/22;
    set_real_ip_from 198.41.128.0/17;
    real_ip_header CF-Connecting-IP;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Client body size limit
    client_max_body_size 10M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;

    # Frontend static files (React build)
    root $FRONTEND_DIR/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;

        proxy_pass http://wg_backend;
        proxy_http_version 1.1;

        # Headers
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Keepalive
        proxy_set_header Connection "";
    }

    # Login rate limiting
    location /api/v1/auth/login {
        limit_req zone=login_limit burst=3 nodelay;

        proxy_pass http://wg_backend;
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # WebSocket için özel yapılandırma
    location /api/v1/ws {
        proxy_pass http://wg_backend;
        proxy_http_version 1.1;

        # WebSocket headers
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        # Standard headers
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Timeouts for WebSocket
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # API docs
    location /docs {
        proxy_pass http://wg_backend;
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # OpenAPI JSON
    location /openapi.json {
        proxy_pass http://wg_backend;
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # ReDoc
    location /redoc {
        proxy_pass http://wg_backend;
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

print_success "Nginx site yapılandırması oluşturuldu"

# Nginx yapılandırma dizin yapısını kontrol et
print_step "Nginx siteleri yapılandırılıyor..."

# sites-available/sites-enabled yapısı var mı kontrol et
if [ -d "/etc/nginx/sites-available" ]; then
    # Debian/Ubuntu tarzı yapılandırma
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
    mkdir -p /etc/nginx/sites-enabled
    ln -sf /etc/nginx/sites-available/wg-manager /etc/nginx/sites-enabled/wg-manager
    print_success "Site symlink oluşturuldu"
else
    # CentOS/RHEL tarzı - conf.d kullan
    print_step "conf.d yapısı kullanılıyor..."
    mv /etc/nginx/sites-available/wg-manager /etc/nginx/conf.d/wg-manager.conf 2>/dev/null || true

    # Default config'i yedekle ve devre dışı bırak
    if [ -f "/etc/nginx/conf.d/default.conf" ]; then
        mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.disabled 2>/dev/null || true
    fi
fi

# nginx.conf'da sites-enabled include var mı kontrol et
if ! grep -q "sites-enabled" /etc/nginx/nginx.conf 2>/dev/null; then
    # sites-enabled include yoksa, http bloğuna ekle
    if [ -d "/etc/nginx/sites-enabled" ]; then
        if ! grep -q "include /etc/nginx/sites-enabled" /etc/nginx/nginx.conf; then
            # http bloğunun sonuna include ekle
            sed -i '/http {/a\    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf 2>/dev/null || true
        fi
    fi
fi

# Nginx config test
print_step "Nginx yapılandırması test ediliyor..."
if nginx -t 2>/dev/null; then
    print_success "Nginx yapılandırması geçerli"
else
    print_error "Nginx yapılandırma hatası!"
    nginx -t
    exit 1
fi

# Nginx'i başlat/yeniden başlat
print_step "Nginx servisi başlatılıyor..."
systemctl enable nginx 2>/dev/null || true
systemctl restart nginx

if systemctl is-active --quiet nginx; then
    print_success "Nginx servisi çalışıyor"
else
    print_error "Nginx başlatılamadı!"
    systemctl status nginx --no-pager
fi

#############################################
# ADIM 8: Systemd Servisleri
#############################################

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${WHITE}       ADIM 8/8: Backend Servis Yapılandırması${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

print_step "Systemd servisleri oluşturuluyor..."

# Backend service
cat > /etc/systemd/system/wg-backend.service << EOF
[Unit]
Description=WireGuard Manager Backend API
Documentation=https://github.com/mustafakiractr/wg-manager
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=$BACKEND_DIR
Environment="PATH=$BACKEND_DIR/venv/bin:/usr/local/bin:/usr/bin:/bin"
Environment="PYTHONPATH=$BACKEND_DIR"
ExecStart=$BACKEND_DIR/venv/bin/python $BACKEND_DIR/run.py
Restart=always
RestartSec=10
StartLimitInterval=60
StartLimitBurst=5
StandardOutput=append:$BACKEND_DIR/logs/backend.log
StandardError=append:$BACKEND_DIR/logs/backend_error.log
NoNewPrivileges=true
PrivateTmp=true
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF

print_success "wg-backend.service oluşturuldu"

# NOT: Frontend nginx tarafından sunuluyor, ayrı servis gerekmiyor

# Eski frontend servisini temizle (varsa)
systemctl stop wg-frontend 2>/dev/null || true
systemctl disable wg-frontend 2>/dev/null || true
rm -f /etc/systemd/system/wg-frontend.service 2>/dev/null || true

# Systemd reload ve servisleri başlat
print_step "Backend servisi başlatılıyor..."
systemctl daemon-reload
systemctl enable wg-backend
systemctl restart wg-backend
sleep 3

# Servis durumlarını kontrol et
BACKEND_STATUS=$(systemctl is-active wg-backend)
NGINX_STATUS=$(systemctl is-active nginx)

if [ "$BACKEND_STATUS" = "active" ] && [ "$NGINX_STATUS" = "active" ]; then
    print_success "Tüm servisler başarıyla başlatıldı!"
    echo ""
    echo -e "  ${GREEN}●${NC} wg-backend: aktif"
    echo -e "  ${GREEN}●${NC} nginx: aktif"
    echo -e "  ${GREEN}●${NC} postgresql: aktif"
else
    print_warning "Servis durumları:"
    echo "  Backend: $BACKEND_STATUS"
    echo "  Nginx: $NGINX_STATUS"
fi

#############################################
# Firewall Yapılandırması
#############################################

print_step "Firewall kontrol ediliyor..."

if check_command ufw; then
    if ufw status | grep -q "Status: active"; then
        print_step "UFW firewall kuralları ekleniyor..."
        ufw allow 80/tcp comment 'HTTP - WireGuard Manager' 2>/dev/null || true
        ufw allow 443/tcp comment 'HTTPS - WireGuard Manager' 2>/dev/null || true
        print_success "Firewall kuralları eklendi (80, 443)"
    fi
fi

#############################################
# Kurulum Tamamlandı
#############################################

echo ""
echo -e "${GREEN}"
cat << "EOF"
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║            ✅ KURULUM BAŞARIYLA TAMAMLANDI! ✅                ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${WHITE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}🌐 Erişim Bilgileri:${NC}"
echo ""
if [ -n "$DOMAIN_NAME" ]; then
    echo -e "   Web Panel:    ${GREEN}http://$DOMAIN_NAME${NC}"
    echo -e "   API Docs:     ${GREEN}http://$DOMAIN_NAME/docs${NC}"
else
    echo -e "   Web Panel:    ${GREEN}http://$SERVER_IP${NC}"
    echo -e "   API Docs:     ${GREEN}http://$SERVER_IP/docs${NC}"
fi
echo ""
echo -e "${WHITE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}🔐 Giriş Bilgileri:${NC}"
echo ""
echo -e "   Kullanıcı:    ${MAGENTA}admin${NC}"
echo -e "   Şifre:        ${MAGENTA}[Kurulumda belirlediğiniz şifre]${NC}"
echo ""
echo -e "${WHITE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}🛠️  Servis Yönetimi:${NC}"
echo ""
echo -e "   Durum:        ${YELLOW}systemctl status wg-backend nginx postgresql${NC}"
echo -e "   Yeniden:      ${YELLOW}systemctl restart wg-backend nginx${NC}"
echo -e "   Loglar:       ${YELLOW}journalctl -u wg-backend -f${NC}"
echo -e "   Nginx Log:    ${YELLOW}tail -f /var/log/nginx/error.log${NC}"
echo ""
echo -e "${WHITE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}📦 Veritabanı Bilgileri:${NC}"
echo ""
echo -e "   Host:         localhost"
echo -e "   Database:     wg_manager"
echo -e "   Kullanıcı:    wg_user"
echo -e "   Şifre:        [Kurulumda belirlediğiniz şifre]"
echo ""
echo -e "${WHITE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -z "$MIKROTIK_PASSWORD" ]; then
    echo -e "${YELLOW}⚠️  MikroTik bağlantısı yapılandırılmadı.${NC}"
    echo -e "${YELLOW}   Web panelinden Settings > MikroTik sayfasından yapılandırın.${NC}"
    echo ""
fi

if [ -n "$DOMAIN_NAME" ]; then
    echo -e "${CYAN}💡 HTTPS için Let's Encrypt sertifikası almak için:${NC}"
    echo -e "   ${YELLOW}sudo certbot --nginx -d $DOMAIN_NAME${NC}"
    echo ""
fi

echo -e "${GREEN}🎉 Kurulum başarıyla tamamlandı!${NC}"
echo ""
