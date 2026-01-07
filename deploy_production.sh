#!/bin/bash

###############################################################################
# Production Deployment Script
# Nginx ile production deployment
###############################################################################

set -e

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

${NC}"echo -e "${BLUE}╔═════════════════════════════════════
echo -e "${BLUE}║  Production Deployment (Nginx)            ║${NC}"
{NC}"echo -e "${BLUE}╚
echo ""

# 1. Frontend build
echo -e "${YELLOW}� Frontend build ediliyor...${NC}"
cd frontend
npm run build
echo -e "${GREEN}✅ Build tamamlandı${NC}"
echo ""

# 2. Nginx config kontrolü
echo -e "${YELLOW}🔍 Nginx config test ediliyor...${NC}"
sudo nginx -t
echo -e "${GREEN}✅ Nginx config OK${NC}"
echo ""

# 3. Servisleri ayarla
echo -e "${YELLOW}⚙️  Servisler yapılandırılıyor...${NC}"

# wg-frontend.service'i durdur (nginx kullanıyoruz)
if systemctl is-active --quiet wg-frontend; then
    echo "  • wg-frontend.service durduruluyor..."
    sudo systemctl stop wg-frontend
    sudo systemctl disable wg-frontend
fi

# wg-backend.service aktif mi kontrol et
if ! systemctl is-active --quiet wg-backend; then
    echo "  • wg-backend.service başlatılıyor..."
    sudo systemctl start wg-backend
    sudo systemctl enable wg-backend
fi

# nginx restart
echo "  • nginx restart..."
sudo systemctl restart nginx
echo -e "${GREEN}✅ Servisler hazır${NC}"
echo ""

# 4. Durum kontrolü
echo "  • nginx:      $(systemctl is-active nginx)"echo -e "${BLUE}
echo "  • wg-backend: $(systemctl is-active wg-backend)"
echo "  • wg-frontend: disabled (nginx kullanılıyor)"
echo ""

# 5. Port kontrolü
echo -e "${BLUE}🌐 Port Durumu:${NC}"
ss -tlnp | grep -E ":(80|443|8001)" || echo "  Port dinleme bilgisi yok"
echo ""

echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Production Deployment Tamamlandı!  ✅  ║${NC}"
{NC}"echo -e "${GREEN}╚═════════
echo ""
echo -e "${BLUE}🌐 Erişim:${NC}"
echo "  • Frontend: http://sunucu-ip/"
echo "  • Backend:  http://sunucu-ip/api/v1/"
echo "  • Docs:     http://sunucu-ip/docs"
echo ""
echo -e "${YELLOW}💡 SSL/HTTPS için:${NC}"
echo "  sudo apt install certbot python3-certbot-nginx"
echo "  sudo certbot --nginx -d yourdomain.com"
echo ""
