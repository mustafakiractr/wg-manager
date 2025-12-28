#!/bin/bash

#############################################
# Backend Test Scripti
# Backend'in düzgün çalışıp çalışmadığını test eder
#############################################

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════╗"
echo "║   Backend Test Scripti                     ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

BACKEND_DIR="$(pwd)/backend"

if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}❌ Backend dizini bulunamadı${NC}"
    exit 1
fi

cd "$BACKEND_DIR"

if [ ! -d "venv" ]; then
    echo -e "${RED}❌ Virtual environment bulunamadı${NC}"
    exit 1
fi

source venv/bin/activate

echo -e "${BLUE}▶ Python paketleri kontrol ediliyor...${NC}"
echo ""

# Test 1: email-validator
echo -n "  • email-validator: "
if python3 -c "import email_validator" 2>/dev/null; then
    VERSION=$(python3 -c "import email_validator; print(email_validator.__version__)" 2>/dev/null || echo "?")
    echo -e "${GREEN}✅ ($VERSION)${NC}"
else
    echo -e "${RED}❌ EKSIK${NC}"
fi

# Test 2: pydantic
echo -n "  • pydantic: "
if python3 -c "import pydantic" 2>/dev/null; then
    VERSION=$(python3 -c "import pydantic; print(pydantic.__version__)" 2>/dev/null)
    echo -e "${GREEN}✅ ($VERSION)${NC}"
else
    echo -e "${RED}❌ EKSIK${NC}"
fi

# Test 3: fastapi
echo -n "  • fastapi: "
if python3 -c "import fastapi" 2>/dev/null; then
    VERSION=$(python3 -c "import fastapi; print(fastapi.__version__)" 2>/dev/null)
    echo -e "${GREEN}✅ ($VERSION)${NC}"
else
    echo -e "${RED}❌ EKSIK${NC}"
fi

# Test 4: EmailStr import
echo -n "  • EmailStr import: "
if python3 -c "from pydantic import EmailStr" 2>/dev/null; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌ BAŞARISIZ${NC}"
fi

echo ""
echo -e "${BLUE}▶ .env dosyası kontrol ediliyor...${NC}"
if [ -f ".env" ]; then
    echo -e "  ${GREEN}✅ .env dosyası mevcut${NC}"
else
    echo -e "  ${RED}❌ .env dosyası bulunamadı${NC}"
fi

echo ""
echo -e "${BLUE}▶ Veritabanı kontrol ediliyor...${NC}"
if [ -f "router_manager.db" ]; then
    echo -e "  ${GREEN}✅ Veritabanı dosyası mevcut${NC}"

    # Admin kullanıcısı var mı?
    USER_COUNT=$(python3 -c "
import sqlite3
conn = sqlite3.connect('router_manager.db')
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM users WHERE username = \"admin\"')
count = cursor.fetchone()[0]
print(count)
conn.close()
" 2>/dev/null || echo "0")

    if [ "$USER_COUNT" -gt 0 ]; then
        echo -e "  ${GREEN}✅ Admin kullanıcısı mevcut${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Admin kullanıcısı bulunamadı${NC}"
        echo -e "  ${YELLOW}   Çözüm: bash fix-database.sh${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠️  Veritabanı dosyası bulunamadı${NC}"
    echo -e "  ${YELLOW}   Çözüm: bash fix-database.sh${NC}"
fi

echo ""
echo -e "${BLUE}▶ Backend import testi...${NC}"
if python3 -c "from app.main import app" 2>/dev/null; then
    echo -e "  ${GREEN}✅ Backend başarıyla import edildi${NC}"
else
    echo -e "  ${RED}❌ Backend import hatası${NC}"
    echo -e "  ${YELLOW}Hata detayı:${NC}"
    python3 -c "from app.main import app" 2>&1 | head -10
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Test tamamlandı!                         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"

deactivate
