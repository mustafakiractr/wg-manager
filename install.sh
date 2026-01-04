#!/bin/bash

#############################################
# MikroTik WireGuard Yönetim Paneli
# Otomatik Kurulum Scripti v2.0
#
# Kullanım: sudo bash install.sh
# Tüm bağımlılıkları otomatik yükler
#############################################

set -e  # Hata durumunda dur

# Renkli çıktı için
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logo
echo -e "${BLUE}╔════════════════════════════════════════════╗"
echo "║                                            ║"
echo "║   ██╗  ██╗██╗██████╗  █████╗  ██████╗      ║"
echo "║   ██║ ██╔╝██║██╔══██╗██╔══██╗██╔════╝      ║"
echo "║   █████╔╝ ██║██████╔╝███████║██║           ║"
echo "║   ██╔═██╗ ██║██╔══██╗██╔══██║██║           ║"
echo "║   ██║  ██╗██║██║  ██║██║  ██║╚██████╗      ║"
echo "║   ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝      ║"
echo "║                                            ║"
echo "║     MikroTik WireGuard Panel Installer     ║"
echo "╚════════════════════════════════════════════╝"


# Root kontrolü
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Bu script root yetkisi ile çalıştırılmalıdır!${NC}"
    echo -e "${YELLOW}Lütfen 'sudo bash install.sh' komutunu kullanın${NC}"
    exit 1
fi

# Değişkenler
INSTALL_DIR=$(pwd)
BACKEND_DIR="$INSTALL_DIR/backend"
FRONTEND_DIR="$INSTALL_DIR/frontend"
PYTHON_MIN_VERSION="3.9"
NODE_MIN_VERSION="20"

echo -e "${BLUE}📍 Kurulum dizini: $INSTALL_DIR${NC}"
echo ""

#############################################
# Fonksiyonlar
#############################################

print_step() {
    echo -e "${BLUE}▶ $1${NC}"
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

check_command() {
    if command -v $1 &> /dev/null; then
        return 0
    else
        return 1
    fi
}

version_ge() {
    # Version karşılaştırma: $1 >= $2
    printf '%s\n%s' "$2" "$1" | sort -V -C
}

#############################################
# 0. Sistem Bilgisi
#############################################

print_step "Sistem bilgileri alınıyor..."

# İşletim sistemi
if [ -f /etc/os-release ]; then
    . /etc/os-release
    print_success "İşletim Sistemi: $NAME $VERSION"
    OS_ID=$ID
else
    print_warning "İşletim sistemi tanımlanamadı"
    OS_ID="unknown"
fi

echo ""

#############################################
# 1. Sistem Paketlerini Güncelle
#############################################

print_step "Sistem paketleri güncelleniyor..."

if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
    apt-get update -qq && apt-get upgrade -y -qq
    print_success "Sistem paketleri güncellendi"
elif [ "$OS_ID" = "centos" ] || [ "$OS_ID" = "rhel" ] || [ "$OS_ID" = "fedora" ]; then
    yum update -y -q
    print_success "Sistem paketleri güncellendi"
else
    print_warning "Bilinmeyen işletim sistemi, manuel güncelleme gerekebilir"
fi

echo ""

#############################################
# 2. Python 3.9+ Kurulumu
#############################################

print_step "Python kontrolü ve kurulumu..."

if check_command python3; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    if version_ge "$PYTHON_VERSION" "$PYTHON_MIN_VERSION"; then
        print_success "Python $PYTHON_VERSION mevcut"
    else
        print_warning "Python $PYTHON_VERSION çok eski, güncelleniyor..."
        if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
            apt-get install -y -qq software-properties-common
            add-apt-repository -y ppa:deadsnakes/ppa
            apt-get update -qq
            apt-get install -y -qq python3.11 python3.11-venv python3.11-dev
            update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1
            print_success "Python 3.11 yüklendi"
        fi
    fi
else
    print_step "Python yükleniyor..."
    if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
        apt-get install -y -qq software-properties-common
        add-apt-repository -y ppa:deadsnakes/ppa
        apt-get update -qq
        apt-get install -y -qq python3.11 python3.11-venv python3.11-dev python3-pip
        update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1
        print_success "Python 3.11 yüklendi"
    elif [ "$OS_ID" = "centos" ] || [ "$OS_ID" = "rhel" ]; then
        yum install -y -q python39 python39-devel python39-pip
        print_success "Python 3.9 yüklendi"
    else
        print_error "Python otomatik yüklenemedi. Manuel olarak yükleyin."
        exit 1
    fi
fi

# pip kontrolü ve kurulumu
if ! check_command pip3; then
    print_step "pip yükleniyor..."
    if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
        apt-get install -y -qq python3-pip
    elif [ "$OS_ID" = "centos" ] || [ "$OS_ID" = "rhel" ]; then
        yum install -y -q python3-pip
    fi
    print_success "pip yüklendi"
fi

echo ""

#############################################
# 3. Node.js ve npm Kurulumu
#############################################

print_step "Node.js kontrolü ve kurulumu..."

if check_command node; then
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    if version_ge "$NODE_VERSION" "$NODE_MIN_VERSION"; then
        print_success "Node.js v$NODE_VERSION mevcut"
        
        # npm kontrolü - Node.js kurulu olsa bile npm olmayabilir
        if ! check_command npm; then
            print_warning "Node.js mevcut ama npm bulunamadı, düzeltiliyor..."
            if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
                curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
                apt-get install -y -qq nodejs
                print_success "npm düzeltildi"
            fi
        fi
    else
        print_warning "Node.js v$NODE_VERSION çok eski, güncelleniyor..."
        # Eski Node.js'i kaldır ve yeni yükle
        if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
            apt-get remove -y -qq nodejs npm || true
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt-get install -y -qq nodejs
            print_success "Node.js 20.x yüklendi"
        fi
    fi
else
    print_step "Node.js yükleniyor (Node.js 20.x LTS)..."
    if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y -qq nodejs
        print_success "Node.js 20.x yüklendi"
    elif [ "$OS_ID" = "centos" ] || [ "$OS_ID" = "rhel" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        yum install -y -q nodejs
        print_success "Node.js 20.x yüklendi"
    else
        print_error "Node.js otomatik yüklenemedi. Manuel olarak yükleyin:"
        echo "https://nodejs.org/en/download/"
        exit 1
    fi
fi

# npm kontrolü ve kurulumu
if ! check_command npm; then
    print_warning "npm bulunamadı, yeniden yükleniyor..."
    
    if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
        # Node'u tamamen kaldır ve nodesource'tan yeniden yükle
        print_step "Node.js ve npm yeniden yükleniyor..."
        apt-get remove -y -qq nodejs npm || true
        apt-get autoremove -y -qq || true
        
        # nodesource repository ekle ve yükle
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y -qq nodejs
        
        # npm kontrolü
        if check_command npm; then
            print_success "Node.js ve npm başarıyla yüklendi"
        else
            print_error "npm hala yüklenemedi! Manuel kurulum gerekiyor:"
            echo ""
            echo "Çalıştırın:"
            echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -"
            echo "  apt install -y nodejs"
            exit 1
        fi
    elif [ "$OS_ID" = "centos" ] || [ "$OS_ID" = "rhel" ]; then
        # Node'u tamamen kaldır ve nodesource'tan yeniden yükle
        yum remove -y -q nodejs npm || true
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        yum install -y -q nodejs
    else
        print_error "npm otomatik yüklenemedi!"
        echo ""
        echo "Manuel olarak Node.js ve npm yükleyin:"
        echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -"
        echo "  apt install -y nodejs"
        exit 1
    fi
fi

print_success "npm $(npm --version) mevcut"

echo ""

#############################################
# 4. Gerekli Sistem Paketleri
#############################################

print_step "Gerekli sistem paketleri yükleniyor..."

if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
    REQUIRED_PACKAGES="build-essential libssl-dev libffi-dev python3-dev python3-venv curl wget git sqlite3 libpq-dev"

    for package in $REQUIRED_PACKAGES; do
        if ! dpkg -l | grep -q "^ii  $package"; then
            print_step "$package yükleniyor..."
            apt-get install -y -qq $package || print_warning "$package yüklenemedi"
        fi
    done
elif [ "$OS_ID" = "centos" ] || [ "$OS_ID" = "rhel" ]; then
    yum groupinstall -y -q "Development Tools"
    yum install -y -q openssl-devel libffi-devel python3-devel curl wget git sqlite postgresql-devel
fi

print_success "Sistem paketleri yüklendi"
echo ""

#############################################
# 5. PostgreSQL Kurulumu ve Yapılandırma
#############################################

print_step "PostgreSQL kontrolü ve kurulumu..."

if check_command psql; then
    print_success "PostgreSQL zaten kurulu"
else
    print_step "PostgreSQL yükleniyor (PostgreSQL 15+)..."
    if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
        # PostgreSQL official repository ekle
        apt-get install -y -qq postgresql-common
        /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y 2>/dev/null || true
        apt-get update -qq
        apt-get install -y -qq postgresql postgresql-contrib
        print_success "PostgreSQL yüklendi"
    elif [ "$OS_ID" = "centos" ] || [ "$OS_ID" = "rhel" ]; then
        yum install -y -q postgresql-server postgresql-contrib
        postgresql-setup initdb
        print_success "PostgreSQL yüklendi"
    fi
fi

# PostgreSQL servisini başlat
if ! systemctl is-active --quiet postgresql; then
    print_step "PostgreSQL servisi başlatılıyor..."
    systemctl enable postgresql
    systemctl start postgresql
    sleep 2
    print_success "PostgreSQL servisi başlatıldı"
fi

# Database ve kullanıcı oluştur
print_step "PostgreSQL database ve kullanıcı oluşturuluyor..."

# Database zaten var mı kontrol et
DB_EXISTS=$(su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='wg_manager';\"" 2>/dev/null || echo "")

if [ "$DB_EXISTS" = "1" ]; then
    print_success "Database wg_manager zaten mevcut"
else
    # Kullanıcı oluştur
    su - postgres -c "psql -c \"CREATE USER wg_user WITH PASSWORD 'wg_secure_pass_2025';\"" 2>/dev/null || print_warning "User zaten mevcut olabilir"
    
    # Database oluştur
    su - postgres -c "createdb -O wg_user wg_manager" 2>/dev/null || print_warning "Database zaten mevcut olabilir"
    
    # İzinleri ayarla
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE wg_manager TO wg_user;\"" 2>/dev/null
    
    print_success "Database wg_manager ve kullanıcı wg_user oluşturuldu"
fi

# pg_hba.conf için local authentication ayarla (eğer henüz ayarlanmadıysa)
PG_HBA_CONF=$(su - postgres -c "psql -tAc \"SHOW hba_file;\"" 2>/dev/null | tr -d '[:space:]')

if [ -f "$PG_HBA_CONF" ]; then
    # local için md5 authentication ekle (eğer yoksa)
    if ! grep -q "local.*wg_manager.*wg_user.*md5" "$PG_HBA_CONF"; then
        # Backup al
        cp "$PG_HBA_CONF" "${PG_HBA_CONF}.backup.$(date +%Y%m%d_%H%M%S)"
        
        # wg_manager için local md5 authentication ekle (en üste)
        sed -i '1i# WireGuard Manager Database Authentication' "$PG_HBA_CONF"
        sed -i '2ilocal   wg_manager      wg_user                                 md5' "$PG_HBA_CONF"
        
        # PostgreSQL'i reload et
        systemctl reload postgresql
        print_success "PostgreSQL authentication yapılandırıldı"
    else
        print_success "PostgreSQL authentication zaten yapılandırılmış"
    fi
fi

echo ""

#############################################
# 6. Backend Kurulumu
#############################################

print_step "Backend kurulumu başlatılıyor..."

if [ ! -d "$BACKEND_DIR" ]; then
    print_error "Backend dizini bulunamadı: $BACKEND_DIR"
    exit 1
fi

cd "$BACKEND_DIR"

# Virtual environment oluştur
if [ ! -d "venv" ]; then
    print_step "Python virtual environment oluşturuluyor..."
    python3 -m venv venv
    print_success "Virtual environment oluşturuldu"
else
    print_success "Virtual environment mevcut"
fi

# Virtual environment'ı aktif et
source venv/bin/activate

# pip güncelle
print_step "pip güncelleniyor..."
pip install --upgrade pip setuptools wheel -q
print_success "pip güncellendi"

# Backend bağımlılıkları yükle
print_step "Backend bağımlılıkları yükleniyor (bu biraz zaman alabilir)..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
    print_success "Backend bağımlılıkları yüklendi"
else
    print_error "requirements.txt bulunamadı!"
    exit 1
fi

# .env dosyası oluştur
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        print_step ".env dosyası oluşturuluyor..."
        cp .env.example .env

        # Güvenli SECRET_KEY oluştur
        NEW_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")

        # Platform uyumlu sed kullan
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/SECRET_KEY=.*/SECRET_KEY=\"$NEW_SECRET_KEY\"/" .env
        else
            sed -i "s/SECRET_KEY=.*/SECRET_KEY=\"$NEW_SECRET_KEY\"/" .env
        fi

        print_success ".env dosyası oluşturuldu ve SECRET_KEY güncellendi"
        print_warning "MikroTik bağlantı bilgilerini .env dosyasından düzenleyin!"
    else
        print_warning ".env.example bulunamadı, manuel olarak .env oluşturun"
    fi
else
    print_success ".env dosyası mevcut"
fi

# Log dizini oluştur
mkdir -p logs
mkdir -p backups
print_success "Log ve backup dizinleri hazır"

# .env'de DATABASE_URL kontrolü - PostgreSQL mu SQLite mi?
DB_TYPE=$(grep "^DATABASE_URL=" .env | grep -o "postgresql\|sqlite" | head -1)

if [ "$DB_TYPE" = "postgresql" ]; then
    print_step "PostgreSQL yapılandırması tespit edildi"
    print_warning "⚠️  PostgreSQL kullanıyorsanız setup_postgresql.sh scriptini çalıştırmalısınız!"
    echo ""
    echo "  Şimdi çalıştırmak için:"
    echo "  ${YELLOW}cd $INSTALL_DIR && sudo bash setup_postgresql.sh${NC}"
    echo ""
    echo "  Veya manuel kurulum için KURULUM_POSTGRESQL.md dosyasını okuyun"
    echo ""
fi

# Database oluştur ve varsayılan kullanıcıyı ekle
print_step "Veritabanı başlatılıyor ve varsayılan kullanıcı oluşturuluyor..."
if [ -f "init_db.py" ]; then
    if [ "$DB_TYPE" = "sqlite" ] || [ -z "$DB_TYPE" ]; then
        # SQLite için direkt çalıştır
        python3 init_db.py || print_warning "Veritabanı başlatma uyarısı (devam ediliyor)"
        print_success "Veritabanı hazır ve admin kullanıcısı oluşturuldu"
    else
        # PostgreSQL için uyarı ver
        print_warning "PostgreSQL tespit edildi - önce setup_postgresql.sh çalıştırın!"
        print_warning "Sonra: cd backend && source venv/bin/activate && python init_db.py"
    fi
    echo ""
    print_success "📋 Varsayılan Giriş Bilgileri:"
    echo "  Kullanıcı Adı: ${GREEN}admin${NC}"
    echo "  Şifre: ${GREEN}admin123${NC}"
    print_warning "⚠️  İlk girişten sonra mutlaka şifrenizi değiştirin!"
    echo ""
else
    print_warning "init_db.py bulunamadı, veritabanı manuel olarak başlatılmalı"
fi

deactivate
cd "$INSTALL_DIR"

echo ""

#############################################
# 7. Frontend Kurulumu
#############################################

print_step "Frontend kurulumu başlatılıyor..."

if [ ! -d "$FRONTEND_DIR" ]; then
    print_error "Frontend dizini bulunamadı: $FRONTEND_DIR"
    exit 1
fi

cd "$FRONTEND_DIR"

# Node modüllerini yükle
print_step "Frontend bağımlılıkları yükleniyor (bu biraz zaman alabilir)..."
if [ -f "package.json" ]; then
    # npm kontrolü (bir kez daha)
    if ! check_command npm; then
        print_error "npm bulunamadı!"
        echo ""
        echo "npm'i yüklemek için:"
        echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -"
        echo "  sudo apt install -y nodejs"
        exit 1
    fi
    
    # npm cache temizle
    npm cache clean --force 2>/dev/null || true

    # Bağımlılıkları yükle
    if npm install; then
        print_success "Frontend bağımlılıkları yüklendi"
    else
        print_error "Frontend bağımlılıkları yüklenemedi!"
        echo ""
        echo "Hata ayıklama:"
        echo "  cd $FRONTEND_DIR"
        echo "  rm -rf node_modules package-lock.json"
        echo "  npm install --verbose"
        exit 1
    fi
else
    print_error "package.json bulunamadı!"
    exit 1
fi

# Build için gerekli araçları kontrol et
if ! check_command npx; then
    print_warning "npx bulunamadı, npm ile yeniden denenecek"
fi

cd "$INSTALL_DIR"

echo ""

#############################################
# 8. Çalıştırma Scriptlerini Hazırla
#############################################

print_step "Çalıştırma scriptleri hazırlanıyor..."

# Tüm scriptleri executable yap
for script in *.sh; do
    [ -f "$script" ] && chmod +x "$script"
done

print_success "Çalıştırma scriptleri hazır"
echo ""

#############################################
# 9. Systemd Servis Dosyaları (Opsiyonel)
#############################################

if [ ! -f "/.dockerenv" ] && [ -d "/etc/systemd/system" ]; then
    read -p "$(echo -e ${YELLOW}Systemd servisleri oluşturulsun mu? \(y/N\): ${NC})" -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_step "Systemd servisleri oluşturuluyor..."

        # Backend service
        cat > /etc/systemd/system/wg-manager-backend.service << EOF
[Unit]
Description=WireGuard Manager Backend API
After=network.target

[Service]
Type=simple
User=${SUDO_USER:-$USER}
WorkingDirectory=$BACKEND_DIR
Environment="PATH=$BACKEND_DIR/venv/bin:/usr/bin:/bin"
ExecStart=$BACKEND_DIR/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

        # Frontend service (development mode)
        cat > /etc/systemd/system/wg-manager-frontend.service << EOF
[Unit]
Description=WireGuard Manager Frontend
After=network.target wg-manager-backend.service

[Service]
Type=simple
User=${SUDO_USER:-$USER}
WorkingDirectory=$FRONTEND_DIR
Environment="PATH=/usr/bin:/bin"
ExecStart=/usr/bin/npm run dev -- --host 0.0.0.0
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

        systemctl daemon-reload
        print_success "Systemd servisleri oluşturuldu"
        echo ""
        print_warning "📝 Servisleri başlatmak için:"
        echo "  sudo systemctl start wg-manager-backend"
        echo "  sudo systemctl start wg-manager-frontend"
        echo ""
        print_warning "📝 Otomatik başlatma için:"
        echo "  sudo systemctl enable wg-manager-backend"
        echo "  sudo systemctl enable wg-manager-frontend"
        echo ""
    else
        print_warning "Systemd servisleri oluşturulmadı"
    fi
fi

echo ""

#############################################
# 10. Güvenlik Kontrolleri
#############################################

print_step "Güvenlik kontrolleri yapılıyor..."

# Firewall kontrol
if check_command ufw && ufw status | grep -q "Status: active"; then
    print_warning "🔥 UFW firewall aktif. Portları açmak için:"
    echo "  sudo ufw allow 8001/tcp comment 'WireGuard Manager Backend'"
    echo "  sudo ufw allow 5173/tcp comment 'WireGuard Manager Frontend'"
    echo ""
fi

# SELinux kontrol
if check_command getenforce; then
    if [ "$(getenforce)" != "Disabled" ]; then
        print_warning "🔒 SELinux aktif. Port ayarları gerekebilir"
    fi
fi

echo ""

#############################################
# 11. Kurulum Tamamlandı
#############################################

echo -e "${GREEN}"
echo "╔════════════════════════════════════════════╗"
echo "║        ✅ KURULUM TAMAMLANDI! ✅          ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}📋 Sonraki Adımlar:${NC}"
echo ""
echo "1️⃣  Uygulamayı başlatın:"
echo "   ${YELLOW}bash start_all.sh${NC}"
echo ""
echo "2️⃣  Tarayıcıdan panele giriş yapın:"
SERVER_IP=$(hostname -I | awk '{print $1}' || echo "localhost")
echo "   Frontend:  ${GREEN}http://$SERVER_IP:5173${NC}"
echo "   Username:  ${YELLOW}admin${NC}"
echo "   Password:  ${YELLOW}admin123${NC}"
echo ""
echo "3️⃣  MikroTik bağlantı bilgilerini panelden girin:"
echo "   ${GREEN}Settings → MikroTik Bağlantı${NC} sayfasından"
echo "   - Router IP adresi"
echo "   - API port (varsayılan: 8728)"
echo "   - Kullanıcı adı ve şifre"
echo ""
echo "4️⃣  Durum kontrolü:"
echo "   ${YELLOW}bash status.sh${NC}"
echo ""
echo "5️⃣  Diğer erişim adresleri:"
echo "   Backend:   ${GREEN}http://$SERVER_IP:8001${NC}"
echo "   API Docs:  ${GREEN}http://$SERVER_IP:8001/docs${NC}"
echo ""

# Opsiyonel: İpuçları
echo -e "${BLUE}💡 Önemli Güvenlik Notları:${NC}"
echo "  • ${YELLOW}İlk girişte admin şifresini mutlaka değiştirin${NC}"
echo "  • Production'da ENVIRONMENT=production ayarlayın"
echo "  • HTTPS kullanın (nginx/apache reverse proxy)"
echo "  • Firewall kurallarını düzenleyin"
echo "  • Düzenli yedekleme yapın"
echo ""

print_success "🎉 Kurulum başarıyla tamamlandı!"
echo ""
echo -e "${BLUE}📚 Daha fazla bilgi için:${NC}"
echo "  • README.md"
echo "  • PROJECT_GUIDE.md"
echo "  • https://github.com/mustafakiractr/wg-manager"
echo ""
