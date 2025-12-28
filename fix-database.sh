#!/bin/bash

#############################################
# Veritabanı Düzeltme Scripti
# Varsayılan admin kullanıcısını oluşturur
#
# Kullanım: bash fix-database.sh
#############################################

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════╗"
echo "║   Veritabanı Düzeltme Scripti             ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

INSTALL_DIR=$(pwd)
BACKEND_DIR="$INSTALL_DIR/backend"

# Backend dizini kontrolü
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}❌ Backend dizini bulunamadı: $BACKEND_DIR${NC}"
    echo -e "${YELLOW}Lütfen proje ana dizininde çalıştırın${NC}"
    exit 1
fi

cd "$BACKEND_DIR"

# Virtual environment kontrolü
if [ ! -d "venv" ]; then
    echo -e "${RED}❌ Virtual environment bulunamadı!${NC}"
    echo -e "${YELLOW}Önce 'sudo bash install.sh' çalıştırın${NC}"
    exit 1
fi

# Virtual environment'ı aktif et
echo -e "${BLUE}▶ Virtual environment aktif ediliyor...${NC}"
source venv/bin/activate

# Eksik bağımlılıkları kontrol et ve yükle
echo -e "${BLUE}▶ Bağımlılıklar kontrol ediliyor...${NC}"
if ! python3 -c "import email_validator" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  email-validator yükleniyor...${NC}"
    pip install email-validator>=2.0.0 -q
    echo -e "${GREEN}✅ email-validator yüklendi${NC}"
fi

# requirements.txt varsa ve güncel değilse güncelle
if [ -f "requirements.txt" ]; then
    if ! grep -q "email-validator" requirements.txt; then
        echo -e "${YELLOW}⚠️  requirements.txt güncelleniyor...${NC}"
        pip install -r requirements.txt -q
        echo -e "${GREEN}✅ Bağımlılıklar güncellendi${NC}"
    fi
fi

# init_db.py kontrolü
if [ ! -f "init_db.py" ]; then
    echo -e "${RED}❌ init_db.py bulunamadı!${NC}"
    exit 1
fi

# Veritabanını başlat ve kullanıcı oluştur
echo -e "${BLUE}▶ Veritabanı başlatılıyor ve admin kullanıcısı oluşturuluyor...${NC}"
python3 init_db.py

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════════╗"
    echo "║        ✅ BAŞARILI! ✅                    ║"
    echo "╚════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo -e "${GREEN}✅ Veritabanı düzeltildi!${NC}"
    echo ""
    echo -e "${BLUE}🔐 Varsayılan Giriş Bilgileri:${NC}"
    echo -e "  Kullanıcı Adı: ${GREEN}admin${NC}"
    echo -e "  Şifre:         ${GREEN}admin123${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  İlk girişten sonra mutlaka şifrenizi değiştirin!${NC}"
    echo ""
    echo -e "${BLUE}Servisleri yeniden başlatmak için:${NC}"
    echo -e "  ${YELLOW}bash restart_all.sh${NC}"
    echo ""
else
    echo -e "${RED}❌ Hata oluştu!${NC}"
    exit 1
fi

deactivate
