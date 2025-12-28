#!/bin/bash

#############################################
# MikroTik WireGuard Yönetim Paneli
# QUICK START - Tek Komut Kurulum
#
# Kullanım: sudo bash quick-start.sh
#############################################

set -e

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

clear

# ASCII Banner
echo -e "${CYAN}"
cat << "EOF"
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   __        _______ ____  __  __                         ║
║   \ \      / / ____|  _ \|  \/  | __ _ _ __   __ _  ___  ║
║    \ \ /\ / /|  _| | |_) | |\/| |/ _` | '_ \ / _` |/ _ \ ║
║     \ V  V / | |___|  _ <| |  | | (_| | | | | (_| |  __/ ║
║      \_/\_/  |_____|_| \_\_|  |_|\__,_|_| |_|\__, |\___| ║
║                                              |___/        ║
║                                                          ║
║        MikroTik WireGuard Yönetim Paneli v1.0           ║
║                  Quick Start Installer                   ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${GREEN}🚀 Tek komutla kurulum başlıyor...${NC}"
echo -e "${BLUE}Bu script otomatik olarak:${NC}"
echo "  ✓ Sistem gereksinimlerini kontrol edecek"
echo "  ✓ Tüm bağımlılıkları yükleyecek"
echo "  ✓ Environment yapılandırması yapacak"
echo "  ✓ Servisleri başlatacak"
echo ""

# Root kontrolü
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Bu script root yetkisi ile çalıştırılmalıdır!${NC}"
    echo -e "${YELLOW}Lütfen 'sudo bash quick-start.sh' komutunu kullanın${NC}"
    exit 1
fi

INSTALL_DIR=$(pwd)

# Kurulum onayı
echo -e "${YELLOW}Kurulum dizini: ${CYAN}$INSTALL_DIR${NC}"
read -p "$(echo -e ${GREEN}Kuruluma devam edilsin mi? [Y/n]: ${NC})" -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]] && [[ ! -z $REPLY ]]; then
    echo -e "${RED}Kurulum iptal edildi.${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}       ADIM 1/3: Sistem Kurulumu${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""

# install.sh var mı kontrol et
if [ ! -f "install.sh" ]; then
    echo -e "${RED}❌ install.sh bulunamadı!${NC}"
    echo -e "${YELLOW}Lütfen doğru dizinde olduğunuzdan emin olun.${NC}"
    exit 1
fi

# install.sh çalıştır
bash install.sh

echo ""
echo -e "${GREEN}✅ Sistem kurulumu tamamlandı!${NC}"
echo ""

# setup_environment.sh'ı çalıştır
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}       ADIM 2/3: Environment Yapılandırması${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""

if [ -f "setup_environment.sh" ]; then
    bash setup_environment.sh
else
    echo -e "${YELLOW}⚠️  setup_environment.sh bulunamadı, manuel yapılandırma gerekli${NC}"
    echo -e "${YELLOW}   Lütfen backend/.env dosyasını düzenleyin${NC}"
fi

echo ""
echo -e "${GREEN}✅ Environment yapılandırması tamamlandı!${NC}"
echo ""

# Servisleri başlat
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}       ADIM 3/3: Servisleri Başlatma${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""

read -p "$(echo -e ${YELLOW}Servisleri şimdi başlatmak istiyor musunuz? [Y/n]: ${NC})" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    echo ""
    echo -e "${CYAN}Servisler başlatılıyor...${NC}"

    # Systemd servislerini tercih et
    if systemctl list-unit-files | grep -q "wg-backend.service"; then
        echo -e "${BLUE}Systemd servisleri kullanılıyor...${NC}"
        systemctl daemon-reload
        systemctl restart wg-backend
        systemctl restart wg-frontend
        systemctl enable wg-backend wg-frontend

        sleep 3

        if systemctl is-active --quiet wg-backend && systemctl is-active --quiet wg-frontend; then
            echo -e "${GREEN}✅ Servisler başarıyla başlatıldı!${NC}"
        else
            echo -e "${YELLOW}⚠️  Servis durumu kontrol ediliyor...${NC}"
            systemctl status wg-backend --no-pager -l | head -5
            systemctl status wg-frontend --no-pager -l | head -5
        fi
    else
        # Manuel başlatma
        if [ -f "start_all.sh" ]; then
            echo -e "${BLUE}Manuel başlatma kullanılıyor...${NC}"
            bash start_all.sh &
            sleep 5

            if [ -f "status.sh" ]; then
                bash status.sh
            fi
        else
            echo -e "${YELLOW}⚠️  start_all.sh bulunamadı${NC}"
            echo -e "${YELLOW}Manuel olarak başlatmak için:${NC}"
            echo -e "${CYAN}  cd backend && source venv/bin/activate && python run.py &${NC}"
            echo -e "${CYAN}  cd frontend && npm run dev &${NC}"
        fi
    fi
else
    echo -e "${YELLOW}Servisleri manuel olarak başlatabilirsiniz:${NC}"
    echo -e "${CYAN}  bash start_all.sh${NC}"
    echo -e "${CYAN}  # veya${NC}"
    echo -e "${CYAN}  sudo systemctl start wg-backend wg-frontend${NC}"
fi

echo ""
echo ""

# Başarı mesajı
echo -e "${GREEN}"
cat << "EOF"
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║             ✅ KURULUM TAMAMLANDI! ✅                   ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Erişim bilgileri
SERVER_IP=$(hostname -I | awk '{print $1}')

echo -e "${BLUE}🌐 Erişim Bilgileri:${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${CYAN}Frontend (Web Arayüzü):${NC}"
echo -e "    ${GREEN}http://$SERVER_IP:5173${NC}"
echo ""
echo -e "  ${CYAN}Backend API:${NC}"
echo -e "    ${GREEN}http://$SERVER_IP:8001${NC}"
echo ""
echo -e "  ${CYAN}API Dokümantasyonu:${NC}"
echo -e "    ${GREEN}http://$SERVER_IP:8001/docs${NC}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Giriş bilgileri
echo -e "${YELLOW}🔐 Varsayılan Giriş Bilgileri:${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${CYAN}Kullanıcı Adı:${NC} ${MAGENTA}admin${NC}"
echo -e "  ${CYAN}Şifre:${NC}         ${MAGENTA}admin123${NC}"
echo ""
echo -e "  ${RED}⚠️  İlk girişten sonra mutlaka şifrenizi değiştirin!${NC}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Servis yönetimi
echo -e "${BLUE}🛠️  Servis Yönetimi:${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${CYAN}Durum Kontrolü:${NC}"
echo -e "    ${YELLOW}bash status.sh${NC}"
echo -e "    ${YELLOW}sudo systemctl status wg-backend wg-frontend${NC}"
echo ""
echo -e "  ${CYAN}Yeniden Başlatma:${NC}"
echo -e "    ${YELLOW}bash restart_all.sh${NC}"
echo -e "    ${YELLOW}sudo systemctl restart wg-backend wg-frontend${NC}"
echo ""
echo -e "  ${CYAN}Durdurma:${NC}"
echo -e "    ${YELLOW}sudo systemctl stop wg-backend wg-frontend${NC}"
echo ""
echo -e "  ${CYAN}Logları Görüntüleme:${NC}"
echo -e "    ${YELLOW}tail -f backend/logs/backend.log${NC}"
echo -e "    ${YELLOW}sudo journalctl -u wg-backend -f${NC}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Sonraki adımlar
echo -e "${MAGENTA}📋 Sonraki Adımlar:${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${CYAN}1.${NC} Tarayıcınızda ${GREEN}http://$SERVER_IP:5173${NC} adresini açın"
echo -e "  ${CYAN}2.${NC} Admin hesabı ile giriş yapın"
echo -e "  ${CYAN}3.${NC} Ayarlar > Hesap bölümünden şifrenizi değiştirin"
echo -e "  ${CYAN}4.${NC} MikroTik Bağlantı sayfasından router bilgilerini girin"
echo -e "  ${CYAN}5.${NC} WireGuard Interface'leri yönetmeye başlayın!"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Dokümantasyon
echo -e "${BLUE}📚 Dokümantasyon:${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${CYAN}Deployment Rehberi:${NC}     ${YELLOW}cat DEPLOYMENT.md${NC}"
echo -e "  ${CYAN}Güvenlik Rehberi:${NC}       ${YELLOW}cat SECURITY.md${NC}"
echo -e "  ${CYAN}Kurulum Detayları:${NC}      ${YELLOW}cat INSTALL.md${NC}"
echo -e "  ${CYAN}Hızlı Başlangıç:${NC}        ${YELLOW}cat QUICKSTART.md${NC}"
echo -e "  ${CYAN}İyileştirmeler:${NC}         ${YELLOW}cat IMPROVEMENTS_SUMMARY.md${NC}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Production deployment bilgisi
echo -e "${YELLOW}💡 İpuçları:${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${CYAN}•${NC} Production deployment için: ${YELLOW}sudo bash deploy.sh${NC}"
echo -e "  ${CYAN}•${NC} Nginx reverse proxy kurulumu için deploy.sh kullanın"
echo -e "  ${CYAN}•${NC} SSL/TLS için: ${YELLOW}sudo certbot --nginx -d yourdomain.com${NC}"
echo -e "  ${CYAN}•${NC} Backup stratejisi için DEPLOYMENT.md'ye bakın"
echo -e "  ${CYAN}•${NC} Güvenlik kontrol listesi için SECURITY.md'ye bakın"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Firewall uyarısı
if command -v ufw &> /dev/null; then
    if ufw status | grep -q "Status: active"; then
        echo -e "${YELLOW}⚠️  UFW Firewall aktif!${NC}"
        echo -e "${YELLOW}   Portları açmak için:${NC}"
        echo -e "${CYAN}     sudo ufw allow 5173/tcp  # Frontend${NC}"
        echo -e "${CYAN}     sudo ufw allow 8001/tcp  # Backend${NC}"
        echo ""
    fi
fi

# MikroTik bağlantı hatırlatması
echo -e "${MAGENTA}🔌 MikroTik Bağlantısı:${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${YELLOW}MikroTik router'ınızda API servisinin aktif olduğundan emin olun:${NC}"
echo -e "  ${CYAN}[admin@MikroTik] > /ip service print${NC}"
echo -e "  ${CYAN}[admin@MikroTik] > /ip service enable api${NC}"
echo ""
echo -e "  ${YELLOW}API kullanıcısına gerekli izinleri verin:${NC}"
echo -e "  ${CYAN}[admin@MikroTik] > /user group print${NC}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${GREEN}🎉 Kurulum başarıyla tamamlandı!${NC}"
echo -e "${CYAN}İyi kullanımlar! 🚀${NC}"
echo ""
