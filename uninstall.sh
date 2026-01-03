#!/bin/bash
# WireGuard Manager Panel - Kaldırma Scripti
# Tüm bileşenleri güvenli şekilde kaldırır

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory detection
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$SCRIPT_DIR"

# Functions
print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                                                            ║${NC}"
    echo -e "${BLUE}║         ${RED}⚠️  WIREGUARD MANAGER KALDIRMA${BLUE}  ⚠️          ║${NC}"
    echo -e "${BLUE}║                                                            ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

confirm() {
    local message="$1"
    echo -e "${YELLOW}${message}${NC}"
    read -p "Devam etmek için 'EVET' yazın (İptal için Enter): " response
    if [ "$response" = "EVET" ]; then
        return 0
    else
        return 1
    fi
}

# Ana header
print_header

echo -e "${RED}Bu script şunları kaldıracak:${NC}"
echo "  • Backend ve Frontend servisleri"
echo "  • Systemd service dosyaları"
echo "  • Virtual environment (Python)"
echo "  • Node modules (Frontend)"
echo "  • Log dosyaları (opsiyonel)"
echo "  • Veritabanı (opsiyonel)"
echo "  • Tüm proje dosyaları (opsiyonel)"
echo ""
print_warning "Bu işlem GERİ ALINAMAZ!"
echo ""

# Ana onay
if ! confirm "Kaldırma işlemine devam etmek istiyor musunuz?"; then
    echo -e "${GREEN}İşlem iptal edildi.${NC}"
    exit 0
fi

echo ""
print_info "Kaldırma başlıyor... Kurulum dizini: $PROJECT_DIR"
echo ""

#############################################
# 1. Servisleri Durdur
#############################################
print_info "1/7: Çalışan servisler durduruluyor..."

# Port kontrolü yaparak servisleri durdur
if command -v pkill &> /dev/null; then
    pkill -f "uvicorn.*app.main:app" 2>/dev/null && print_success "Backend servisi durduruldu" || true
    pkill -f "vite" 2>/dev/null && print_success "Frontend servisi durduruldu" || true
    pkill -f "npm run dev" 2>/dev/null || true
fi

# Systemd servisleri durdur (varsa)
if systemctl is-active --quiet wg-backend 2>/dev/null; then
    sudo systemctl stop wg-backend
    print_success "Systemd backend servisi durduruldu"
fi

if systemctl is-active --quiet wg-frontend 2>/dev/null; then
    sudo systemctl stop wg-frontend
    print_success "Systemd frontend servisi durduruldu"
fi

sleep 2

#############################################
# 2. Systemd Service Dosyalarını Kaldır
#############################################
print_info "2/7: Systemd service dosyaları kaldırılıyor..."

if [ -f "/etc/systemd/system/wg-backend.service" ]; then
    sudo systemctl disable wg-backend 2>/dev/null || true
    sudo rm -f /etc/systemd/system/wg-backend.service
    print_success "wg-backend.service kaldırıldı"
fi

if [ -f "/etc/systemd/system/wg-frontend.service" ]; then
    sudo systemctl disable wg-frontend 2>/dev/null || true
    sudo rm -f /etc/systemd/system/wg-frontend.service
    print_success "wg-frontend.service kaldırıldı"
fi

if [ -f "/etc/systemd/system/router-manager-backend.service" ]; then
    sudo systemctl disable router-manager-backend 2>/dev/null || true
    sudo rm -f /etc/systemd/system/router-manager-backend.service
    print_success "router-manager-backend.service kaldırıldı"
fi

if [ -f "/etc/systemd/system/router-manager-frontend.service" ]; then
    sudo systemctl disable router-manager-frontend 2>/dev/null || true
    sudo rm -f /etc/systemd/system/router-manager-frontend.service
    print_success "router-manager-frontend.service kaldırıldı"
fi

# Systemd reload
sudo systemctl daemon-reload 2>/dev/null || true

#############################################
# 3. Logrotate Konfigürasyonunu Kaldır
#############################################
print_info "3/7: Logrotate konfigürasyonu kaldırılıyor..."

if [ -f "/etc/logrotate.d/wireguard-manager" ]; then
    sudo rm -f /etc/logrotate.d/wireguard-manager
    print_success "Logrotate konfigürasyonu kaldırıldı"
fi

#############################################
# 4. Virtual Environment ve Node Modules
#############################################
print_info "4/7: Virtual environment ve node modules kaldırılıyor..."

if [ -d "$PROJECT_DIR/backend/venv" ]; then
    rm -rf "$PROJECT_DIR/backend/venv"
    print_success "Backend virtual environment kaldırıldı"
fi

if [ -d "$PROJECT_DIR/frontend/node_modules" ]; then
    rm -rf "$PROJECT_DIR/frontend/node_modules"
    print_success "Frontend node_modules kaldırıldı"
fi

if [ -f "$PROJECT_DIR/frontend/package-lock.json" ]; then
    rm -f "$PROJECT_DIR/frontend/package-lock.json"
fi

#############################################
# 5. Log Dosyaları (Opsiyonel)
#############################################
echo ""
if confirm "Log dosyalarını da silmek istiyor musunuz? (Sorun giderme için saklamak isteyebilirsiniz)"; then
    print_info "5/7: Log dosyaları kaldırılıyor..."
    
    if [ -d "$PROJECT_DIR/backend/logs" ]; then
        rm -rf "$PROJECT_DIR/backend/logs"
        print_success "Backend log dosyaları kaldırıldı"
    fi
    
    if [ -d "$PROJECT_DIR/logs" ]; then
        rm -rf "$PROJECT_DIR/logs"
        print_success "Ana dizin log dosyaları kaldırıldı"
    fi
    
    # Tek dosyalar
    rm -f "$PROJECT_DIR/backend.log" 2>/dev/null || true
    rm -f "$PROJECT_DIR/frontend.log" 2>/dev/null || true
    rm -f "$PROJECT_DIR/frontend_error.log" 2>/dev/null || true
    rm -f "$PROJECT_DIR/backend/backend_output.log" 2>/dev/null || true
else
    print_info "5/7: Log dosyaları saklanıyor..."
fi

#############################################
# 6. Veritabanı ve Yedekler (Opsiyonel)
#############################################
echo ""
if confirm "⚠️  Veritabanı ve yedekleri SİLMEK istiyor musunuz? (VERİ KAYBI OLACAK!)"; then
    print_info "6/7: Veritabanı ve yedekler kaldırılıyor..."
    
    # SQLite database
    if [ -f "$PROJECT_DIR/backend/router_manager.db" ]; then
        rm -f "$PROJECT_DIR/backend/router_manager.db"
        rm -f "$PROJECT_DIR/backend/router_manager.db-*" 2>/dev/null || true
        print_success "SQLite veritabanı kaldırıldı"
    fi
    
    # Backup dizini
    if [ -d "$PROJECT_DIR/backend/backups" ]; then
        rm -rf "$PROJECT_DIR/backend/backups"
        print_success "Yedek dosyaları kaldırıldı"
    fi
    
    if [ -d "$PROJECT_DIR/backups" ]; then
        rm -rf "$PROJECT_DIR/backups"
    fi
    
    # PostgreSQL - sadece bilgilendirme
    if grep -q "postgresql" "$PROJECT_DIR/backend/.env" 2>/dev/null; then
        echo ""
        print_warning "PostgreSQL veritabanı tespit edildi!"
        echo -e "${YELLOW}PostgreSQL veritabanını manuel olarak kaldırmalısınız:${NC}"
        echo "  sudo -u postgres psql -c \"DROP DATABASE wg_manager;\""
        echo "  sudo -u postgres psql -c \"DROP USER wg_user;\""
        echo ""
    fi
else
    print_info "6/7: Veritabanı ve yedekler saklanıyor..."
fi

#############################################
# 7. Tüm Proje Dosyalarını Kaldır (Opsiyonel)
#############################################
echo ""
if confirm "⚠️⚠️⚠️  TÜM PROJE DOSYALARINI ($PROJECT_DIR) SİLMEK istiyor musunuz? (KALICI OLARAK SİLİNECEK!)"; then
    print_info "7/7: Tüm proje dosyaları kaldırılıyor..."
    
    cd /
    rm -rf "$PROJECT_DIR"
    
    print_success "Tüm proje dosyaları kaldırıldı: $PROJECT_DIR"
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║          ✅ KALDIRMA TAMAMLANDI ✅                         ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║  WireGuard Manager tamamen kaldırıldı.                    ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    print_info "7/7: Proje dosyaları saklanıyor..."
fi

#############################################
# Özet
#############################################
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}║          ✅ KALDIRMA TAMAMLANDI ✅                         ║${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Kaldırılanlar:${NC}"
echo "  ✅ Backend ve Frontend servisleri durduruldu"
echo "  ✅ Systemd service dosyaları kaldırıldı"
echo "  ✅ Virtual environment ve node_modules kaldırıldı"

if [ -d "$PROJECT_DIR/backend/logs" ] || [ -d "$PROJECT_DIR/logs" ]; then
    echo "  📁 Log dosyaları saklandı: $PROJECT_DIR/logs/"
fi

if [ -f "$PROJECT_DIR/backend/router_manager.db" ] || [ -d "$PROJECT_DIR/backend/backups" ]; then
    echo "  📁 Veritabanı ve yedekler saklandı"
fi

echo "  📁 Proje dosyaları saklandı: $PROJECT_DIR"
echo ""
echo -e "${YELLOW}Manuel olarak temizlemek için:${NC}"
echo "  rm -rf $PROJECT_DIR"
echo ""
echo -e "${CYAN}Yeniden kurmak için:${NC}"
echo "  git clone <repository-url> $PROJECT_DIR"
echo "  cd $PROJECT_DIR && sudo bash install.sh"
echo ""
