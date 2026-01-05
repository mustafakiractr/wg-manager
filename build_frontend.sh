#!/bin/bash

###############################################################################
# WireGuard Manager - Frontend Build & Deploy Script
# Bu script frontend'i build eder ve production'a deploy eder
###############################################################################

set -e  # Hata durumunda dur

# Renkli output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Klasör tanımlamaları
FRONTEND_DIR="/root/wg/frontend"
BUILD_DIR="/root/wg/frontend/dist"
DEPLOY_DIR="/var/www/wg-manager"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  WireGuard Manager - Frontend Build & Deploy${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Frontend klasörüne git
echo -e "${YELLOW}📂 Frontend klasörüne geçiliyor...${NC}"
cd "$FRONTEND_DIR"

# Build işlemini başlat
echo -e "${YELLOW}🔨 Frontend build ediliyor...${NC}"
echo ""

if npm run build; then
    echo ""
    echo -e "${GREEN}✅ Build başarılı!${NC}"
else
    echo ""
    echo -e "${RED}❌ Build başarısız oldu!${NC}"
    exit 1
fi

# Build klasörünü kontrol et
if [ ! -d "$BUILD_DIR" ]; then
    echo -e "${RED}❌ Build klasörü bulunamadı: $BUILD_DIR${NC}"
    exit 1
fi

# Deploy klasörünü oluştur (yoksa)
echo -e "${YELLOW}📁 Deploy klasörü hazırlanıyor...${NC}"
mkdir -p "$DEPLOY_DIR"

# Eski dosyaları temizle
echo -e "${YELLOW}🗑️  Eski dosyalar temizleniyor...${NC}"
rm -rf "$DEPLOY_DIR"/*

# Yeni dosyaları kopyala
echo -e "${YELLOW}📦 Yeni dosyalar kopyalanıyor...${NC}"
cp -r "$BUILD_DIR"/* "$DEPLOY_DIR"/

# Dosya sayısını kontrol et
FILE_COUNT=$(find "$DEPLOY_DIR" -type f | wc -l)
echo -e "${GREEN}✅ $FILE_COUNT dosya kopyalandı${NC}"

# Dosya izinlerini ayarla
echo -e "${YELLOW}🔐 Dosya izinleri ayarlanıyor...${NC}"
chown -R root:root "$DEPLOY_DIR"
chmod -R 755 "$DEPLOY_DIR"
find "$DEPLOY_DIR" -type f -exec chmod 644 {} \;

# Nginx'i test et
echo -e "${YELLOW}🧪 Nginx konfigürasyonu test ediliyor...${NC}"
if nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✅ Nginx konfigürasyonu geçerli${NC}"
    
    # Nginx'i reload et
    echo -e "${YELLOW}🔄 Nginx reload ediliyor...${NC}"
    systemctl reload nginx
    echo -e "${GREEN}✅ Nginx başarıyla reload edildi${NC}"
else
    echo -e "${RED}❌ Nginx konfigürasyonu hatalı!${NC}"
    nginx -t
    exit 1
fi

# Build bilgilerini göster
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Frontend başarıyla build edildi ve deploy edildi!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📊 Build İstatistikleri:${NC}"
echo -e "   📁 Build klasörü: $BUILD_DIR"
echo -e "   📦 Deploy klasörü: $DEPLOY_DIR"
echo -e "   📄 Toplam dosya: $FILE_COUNT"
echo ""
echo -e "${BLUE}🌐 Test URL'leri:${NC}"
echo -e "   🔗 Frontend: http://localhost/"
echo -e "   🔗 Health: http://localhost/health"
echo -e "   🔗 API: http://localhost/api/v1/"
echo ""
echo -e "${GREEN}🎉 Frontend hazır! Tarayıcıdan test edebilirsiniz.${NC}"
echo ""
