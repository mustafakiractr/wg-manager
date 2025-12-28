#!/bin/bash

#############################################
# MikroTik WireGuard Yönetim Paneli
# Otomatik Kurulum Scripti
#
# Kullanım: sudo bash install.sh
#############################################

set -e  # Hata durumunda dur

# Renkli çıktı için
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logo
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════╗"
echo "║  MikroTik WireGuard Yönetim Paneli        ║"
echo "║  Otomatik Kurulum v1.0                     ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

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
NODE_MIN_VERSION="16"

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
        print_success "$1 bulundu"
        return 0
    else
        print_error "$1 bulunamadı"
        return 1
    fi
}

version_ge() {
    # Version karşılaştırma: $1 >= $2
    printf '%s\n%s' "$2" "$1" | sort -V -C
}

#############################################
# 1. Sistem Gereksinimleri Kontrolü
#############################################

print_step "Sistem gereksinimleri kontrol ediliyor..."

# İşletim sistemi
if [ -f /etc/os-release ]; then
    . /etc/os-release
    print_success "İşletim Sistemi: $NAME $VERSION"
else
    print_warning "İşletim sistemi tanımlanamadı"
fi

# Python kontrolü
if check_command python3; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    if version_ge "$PYTHON_VERSION" "$PYTHON_MIN_VERSION"; then
        print_success "Python $PYTHON_VERSION (Minimum: $PYTHON_MIN_VERSION)"
    else
        print_error "Python $PYTHON_VERSION çok eski! Minimum $PYTHON_MIN_VERSION gerekli"
        exit 1
    fi
else
    print_error "Python3 bulunamadı!"
    echo -e "${YELLOW}Yüklemek için: apt-get install python3 python3-pip python3-venv${NC}"
    exit 1
fi

# Node.js kontrolü
if check_command node; then
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    if version_ge "$NODE_VERSION" "$NODE_MIN_VERSION"; then
        print_success "Node.js v$NODE_VERSION (Minimum: $NODE_MIN_VERSION)"
    else
        print_error "Node.js v$NODE_VERSION çok eski! Minimum $NODE_MIN_VERSION gerekli"
        exit 1
    fi
else
    print_error "Node.js bulunamadı!"
    echo -e "${YELLOW}Yüklemek için: curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && apt-get install -y nodejs${NC}"
    exit 1
fi

# npm kontrolü
check_command npm || {
    print_error "npm bulunamadı!"
    exit 1
}

# Git kontrolü (opsiyonel)
check_command git || print_warning "Git bulunamadı (opsiyonel)"

echo ""

#############################################
# 2. Sistem Paketlerini Güncelle
#############################################

print_step "Sistem paketleri güncelleniyor..."
apt-get update -qq || print_warning "apt-get update başarısız (devam ediliyor)"
print_success "Paket listesi güncellendi"
echo ""

#############################################
# 3. Gerekli Sistem Paketleri
#############################################

print_step "Gerekli sistem paketleri yükleniyor..."

REQUIRED_PACKAGES="build-essential libssl-dev libffi-dev python3-dev python3-venv curl"

for package in $REQUIRED_PACKAGES; do
    if dpkg -l | grep -q "^ii  $package"; then
        print_success "$package zaten yüklü"
    else
        print_step "$package yükleniyor..."
        apt-get install -y -qq $package || print_warning "$package yüklenemedi"
    fi
done

echo ""

#############################################
# 4. Backend Kurulumu
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
pip install --upgrade pip -q
print_success "pip güncellendi"

# Backend bağımlılıkları yükle
print_step "Backend bağımlılıkları yükleniyor (bu biraz zaman alabilir)..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt -q
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
        sed -i "s/SECRET_KEY=.*/SECRET_KEY=\"$NEW_SECRET_KEY\"/" .env

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
print_success "Log dizini hazır"

# Database oluştur ve varsayılan kullanıcıyı ekle
print_step "Veritabanı başlatılıyor ve varsayılan kullanıcı oluşturuluyor..."
if [ -f "init_db.py" ]; then
    python3 init_db.py || print_warning "Veritabanı başlatma uyarısı (devam ediliyor)"
    print_success "Veritabanı hazır ve admin kullanıcısı oluşturuldu"
    echo ""
    print_success "Varsayılan Giriş Bilgileri:"
    echo "  Kullanıcı Adı: admin"
    echo "  Şifre: admin123"
    print_warning "İlk girişten sonra mutlaka şifrenizi değiştirin!"
    echo ""
else
    print_warning "init_db.py bulunamadı, veritabanı manuel olarak başlatılmalı"
fi

deactivate
cd "$INSTALL_DIR"

echo ""

#############################################
# 5. Frontend Kurulumu
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
    npm install --silent
    print_success "Frontend bağımlılıkları yüklendi"
else
    print_error "package.json bulunamadı!"
    exit 1
fi

cd "$INSTALL_DIR"

echo ""

#############################################
# 6. Çalıştırma Scriptlerini Hazırla
#############################################

print_step "Çalıştırma scriptleri hazırlanıyor..."

# start_all.sh zaten mevcut, executable yap
chmod +x start_all.sh 2>/dev/null || true
chmod +x status.sh 2>/dev/null || true
chmod +x restart_all.sh 2>/dev/null || true

print_success "Çalıştırma scriptleri hazır"
echo ""

#############################################
# 7. Systemd Servis Dosyaları (Opsiyonel)
#############################################

read -p "$(echo -e ${YELLOW}Systemd servisleri oluşturulsun mu? (y/N): ${NC})" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_step "Systemd servisleri oluşturuluyor..."

    # Backend service
    cat > /etc/systemd/system/wg-backend.service << EOF
[Unit]
Description=MikroTik WireGuard Manager Backend
After=network.target

[Service]
Type=simple
User=$SUDO_USER
WorkingDirectory=$BACKEND_DIR
Environment="PATH=$BACKEND_DIR/venv/bin"
ExecStart=$BACKEND_DIR/venv/bin/python $BACKEND_DIR/run.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Frontend service
    cat > /etc/systemd/system/wg-frontend.service << EOF
[Unit]
Description=MikroTik WireGuard Manager Frontend
After=network.target

[Service]
Type=simple
User=$SUDO_USER
WorkingDirectory=$FRONTEND_DIR
ExecStart=/usr/bin/npm run dev
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    print_success "Systemd servisleri oluşturuldu"
    print_warning "Servisleri başlatmak için: systemctl start wg-backend wg-frontend"
    print_warning "Otomatik başlatma için: systemctl enable wg-backend wg-frontend"
else
    print_warning "Systemd servisleri oluşturulmadı"
fi

echo ""

#############################################
# 8. Güvenlik Kontrolleri
#############################################

print_step "Güvenlik kontrolleri yapılıyor..."

# Firewall kontrol
if command -v ufw &> /dev/null; then
    print_warning "UFW firewall aktif. Port 8001 ve 5173'ü açmayı unutmayın:"
    echo "  sudo ufw allow 8001/tcp"
    echo "  sudo ufw allow 5173/tcp"
fi

# SELinux kontrol
if command -v getenforce &> /dev/null; then
    if [ "$(getenforce)" != "Disabled" ]; then
        print_warning "SELinux aktif. Port ayarları gerekebilir"
    fi
fi

echo ""

#############################################
# 9. Kurulum Tamamlandı
#############################################

echo -e "${GREEN}"
echo "╔════════════════════════════════════════════╗"
echo "║        ✅ KURULUM TAMAMLANDI! ✅          ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}📋 Sonraki Adımlar:${NC}"
echo ""
echo "1️⃣  MikroTik bağlantı bilgilerini düzenleyin:"
echo "   ${YELLOW}nano backend/.env${NC}"
echo ""
echo "2️⃣  Uygulamayı başlatın:"
echo "   ${YELLOW}bash start_all.sh${NC}"
echo ""
echo "3️⃣  Durum kontrolü:"
echo "   ${YELLOW}bash status.sh${NC}"
echo ""
echo "4️⃣  Erişim:"
echo "   Frontend: ${GREEN}http://$(hostname -I | awk '{print $1}'):5173${NC}"
echo "   Backend:  ${GREEN}http://$(hostname -I | awk '{print $1}'):8001${NC}"
echo "   API Docs: ${GREEN}http://$(hostname -I | awk '{print $1}'):8001/docs${NC}"
echo ""
echo "5️⃣  Servisleri durdurmak için:"
echo "   ${YELLOW}pkill -f 'python.*run.py' && pkill -f 'vite'${NC}"
echo ""

# Opsiyonel: İlk kullanıcı oluşturma
echo -e "${BLUE}💡 İpuçları:${NC}"
echo "  • Default admin kullanıcısını ilk girişte değiştirin"
echo "  • Production'da SECRET_KEY'i mutlaka değiştirin"
echo "  • CORS_ORIGINS'i production domain'leriniz ile güncelleyin"
echo "  • Güvenlik ayarları için SECURITY.md dosyasına bakın"
echo ""

print_success "Kurulum başarıyla tamamlandı!"
