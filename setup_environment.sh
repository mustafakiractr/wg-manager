#!/bin/bash

#############################################
# Environment Setup Script
# MikroTik bağlantı bilgilerini interaktif olarak yapılandırır
#############################################

set -e

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════╗"
echo "║  Environment Yapılandırma                  ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

# .env dosya yolu
ENV_FILE="backend/.env"

# .env.example'dan kopyala
if [ ! -f "$ENV_FILE" ]; then
    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example "$ENV_FILE"
        echo -e "${GREEN}✅ .env dosyası oluşturuldu${NC}"
    else
        echo -e "${RED}❌ .env.example bulunamadı!${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${YELLOW}MikroTik Router Bağlantı Bilgileri:${NC}"
echo ""

# MikroTik bilgilerini al
read -p "MikroTik IP Adresi [192.168.1.1]: " MIKROTIK_HOST
MIKROTIK_HOST=${MIKROTIK_HOST:-192.168.1.1}

read -p "MikroTik API Port [8728]: " MIKROTIK_PORT
MIKROTIK_PORT=${MIKROTIK_PORT:-8728}

read -p "MikroTik Kullanıcı Adı [admin]: " MIKROTIK_USER
MIKROTIK_USER=${MIKROTIK_USER:-admin}

read -s -p "MikroTik Şifresi: " MIKROTIK_PASSWORD
echo ""

read -p "TLS Kullan? (true/false) [False]: " MIKROTIK_USE_TLS
MIKROTIK_USE_TLS=${MIKROTIK_USE_TLS:-False}

echo ""
echo -e "${YELLOW}Uygulama Ayarları:${NC}"
echo ""

# Environment seç
echo "Ortam seçin:"
echo "  1) Development (geliştirme)"
echo "  2) Production (canlı)"
read -p "Seçim [1]: " ENV_CHOICE
ENV_CHOICE=${ENV_CHOICE:-1}

if [ "$ENV_CHOICE" = "2" ]; then
    ENVIRONMENT="production"

    # Production için domain iste
    read -p "Domain adınız (örn: wg.yourdomain.com): " DOMAIN

    # CORS origins ayarla
    CORS_ORIGINS="https://$DOMAIN,https://www.$DOMAIN,http://$DOMAIN"

    # Rate limiting daha sıkı
    RATE_LIMIT_PER_MINUTE=100
    RATE_LIMIT_LOGIN=3

    echo -e "${YELLOW}⚠️  Production modu seçildi${NC}"
    echo -e "${YELLOW}⚠️  HTTPS redirect ve güvenlik ayarlarını kontrol edin${NC}"
else
    ENVIRONMENT="development"
    CORS_ORIGINS="http://localhost:5173,http://localhost:3000"
    RATE_LIMIT_PER_MINUTE=200
    RATE_LIMIT_LOGIN=5
fi

# Güvenli SECRET_KEY oluştur
echo ""
echo -e "${BLUE}🔐 Güvenli SECRET_KEY oluşturuluyor...${NC}"
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")

# .env dosyasını güncelle
echo ""
echo -e "${BLUE}📝 .env dosyası güncelleniyor...${NC}"

sed -i "s|ENVIRONMENT=.*|ENVIRONMENT=\"$ENVIRONMENT\"|" "$ENV_FILE"
sed -i "s|MIKROTIK_HOST=.*|MIKROTIK_HOST=\"$MIKROTIK_HOST\"|" "$ENV_FILE"
sed -i "s|MIKROTIK_PORT=.*|MIKROTIK_PORT=$MIKROTIK_PORT|" "$ENV_FILE"
sed -i "s|MIKROTIK_USER=.*|MIKROTIK_USER=\"$MIKROTIK_USER\"|" "$ENV_FILE"
sed -i "s|MIKROTIK_PASSWORD=.*|MIKROTIK_PASSWORD=\"$MIKROTIK_PASSWORD\"|" "$ENV_FILE"
sed -i "s|MIKROTIK_USE_TLS=.*|MIKROTIK_USE_TLS=$MIKROTIK_USE_TLS|" "$ENV_FILE"
sed -i "s|SECRET_KEY=.*|SECRET_KEY=\"$SECRET_KEY\"|" "$ENV_FILE"
sed -i "s|CORS_ORIGINS=.*|CORS_ORIGINS=\"$CORS_ORIGINS\"|" "$ENV_FILE"
sed -i "s|RATE_LIMIT_PER_MINUTE=.*|RATE_LIMIT_PER_MINUTE=$RATE_LIMIT_PER_MINUTE|" "$ENV_FILE"
sed -i "s|RATE_LIMIT_LOGIN=.*|RATE_LIMIT_LOGIN=$RATE_LIMIT_LOGIN|" "$ENV_FILE"

# PostgreSQL DATABASE_URL ayarla (Production-ready)
sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"postgresql+asyncpg://wg_user:wg_secure_pass_2025@localhost/wg_manager\"|" "$ENV_FILE"

# SQLite satırını yorum satırı yap (eski satır varsa)
if grep -q "^DATABASE_URL=.*sqlite" "$ENV_FILE"; then
    sed -i 's|^\(DATABASE_URL=.*sqlite.*\)|# \1  # SQLite (geliştirme için)|' "$ENV_FILE"
fi

# Frontend .env dosyasını oluştur
FRONTEND_ENV_FILE="frontend/.env"
if [ ! -f "$FRONTEND_ENV_FILE" ]; then
    if [ -f "frontend/.env.example" ]; then
        cp frontend/.env.example "$FRONTEND_ENV_FILE"
        echo -e "${GREEN}✅ Frontend .env dosyası oluşturuldu${NC}"
    fi
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ✅ Yapılandırma Tamamlandı! ✅        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BLUE}📋 Yapılandırma Özeti:${NC}"
echo "  Environment:     $ENVIRONMENT"
echo "  MikroTik Host:   $MIKROTIK_HOST:$MIKROTIK_PORT"
echo "  MikroTik User:   $MIKROTIK_USER"
echo "  Rate Limit:      $RATE_LIMIT_PER_MINUTE req/min"
echo "  CORS Origins:    $CORS_ORIGINS"
echo ""

echo -e "${YELLOW}💡 Sonraki Adımlar:${NC}"
echo "  1. Uygulamayı başlatın: bash start_all.sh"
echo "  2. Tarayıcıdan erişin: http://$(hostname -I | awk '{print $1}'):5173"
echo ""

if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${RED}⚠️  PRODUCTION UYARILARI:${NC}"
    echo "  • SSL/TLS sertifikası kurun (Let's Encrypt önerilir)"
    echo "  • Firewall kurallarını yapılandırın"
    echo "  • Database backup stratejisi oluşturun"
    echo "  • SECURITY.md dosyasındaki kontrol listesini uygulayın"
    echo ""
fi

echo -e "${GREEN}✅ Setup tamamlandı!${NC}"
