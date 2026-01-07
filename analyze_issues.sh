#!/bin/bash

# ============================================
# KURULUM SORUNLARI ANALIZ
# ============================================

echo "===================================================================="
echo "           KURULUM SORUNLARI ANALIZ EDILIYOR                        "
echo "===================================================================="
echo ""

echo "--------------------------------------------------------------------"
echo "1. HARD-CODED PATH KONTROLU"
echo "--------------------------------------------------------------------"
echo ""
echo "Backend'de /root/wg path'i ariyorum..."
grep -r "/root/wg" backend/ --include="*.py" 2>/dev/null | head -n 10 || echo "  OK - Hard-coded path yok"

echo ""
echo "Shell scriptlerde hard-coded path ariyorum..."
grep -r "/root/wg" *.sh 2>/dev/null | grep -v "^Binary" | head -n 10 || echo "  OK - Hard-coded path yok"

echo ""
echo "--------------------------------------------------------------------"
echo "2. ENVIRONMENT VARIABLES KONTROLU"
echo "--------------------------------------------------------------------"
echo ""
if [ -f backend/.env ]; then
    echo "OK - backend/.env mevcut"
    echo "  Kritik degiskenler:"
    grep -E "^SECRET_KEY=" backend/.env 2>/dev/null | sed 's/=.*/=***/' || echo "  UYARI - SECRET_KEY yok"
    grep -E "^DATABASE_URL=" backend/.env 2>/dev/null | sed 's/=.*/=***/' || echo "  UYARI - DATABASE_URL yok"
    grep -E "^MIKROTIK_HOST=" backend/.env 2>/dev/null | sed 's/=.*/=***/' || echo "  UYARI - MIKROTIK_HOST yok"
else
    echo "HATA - backend/.env BULUNAMADI!"
    echo "  -> Bu en yaygin kurulum sorunudur"
fi

echo ""
if [ -f frontend/.env ]; then
    echo "OK - frontend/.env mevcut"
    grep -E "^VITE_" frontend/.env 2>/dev/null || echo "  UYARI - VITE_ degiskenleri yok"
else
    echo "HATA - frontend/.env BULUNAMADI!"
fi

echo ""
echo "--------------------------------------------------------------------"
echo "3. DATABASE PATH KONTROLU"
echo "--------------------------------------------------------------------"
echo ""
if [ -f backend/.env ]; then
    DB_URL=$(grep "^DATABASE_URL=" backend/.env | cut -d'=' -f2)
    echo "Database URL: $DB_URL"
    
    if [[ "$DB_URL" == sqlite* ]]; then
        DB_FILE=$(echo "$DB_URL" | sed 's|sqlite:///./||' | sed 's|sqlite:///||')
        echo "SQLite dosyasi: $DB_FILE"
        
        if [ -f "backend/$DB_FILE" ]; then
            echo "  OK - Database dosyasi mevcut"
            ls -lh "backend/$DB_FILE"
        else
            echo "  HATA - Database dosyasi bulunamadi: backend/$DB_FILE"
        fi
    fi
fi

echo ""
echo "--------------------------------------------------------------------"
echo "4. PYTHON/NODE VERSIYON KONTROLU"
echo "--------------------------------------------------------------------"
echo ""
PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
echo "Python version: $PYTHON_VERSION"
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

if [ "$PYTHON_MAJOR" -ge 3 ] && [ "$PYTHON_MINOR" -ge 9 ]; then
    echo "  OK - Python 3.9+"
else
    echo "  HATA - Python 3.9+ gerekli (Mevcut: $PYTHON_VERSION)"
fi

echo ""
NODE_VERSION=$(node --version 2>&1 | sed 's/v//')
echo "Node version: $NODE_VERSION"
NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1)

if [ "$NODE_MAJOR" -ge 20 ]; then
    echo "  OK - Node 20+"
else
    echo "  HATA - Node 20+ gerekli (Mevcut: $NODE_VERSION)"
fi

echo ""
echo "--------------------------------------------------------------------"
echo "5. PORT KULLANIM KONTROLU"
echo "--------------------------------------------------------------------"
echo ""
for port in 8001 5173; do
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        echo "UYARI - Port $port kulanimda:"
        netstat -tuln 2>/dev/null | grep ":$port "
    else
        echo "OK - Port $port musait"
    fi
done

echo ""
echo "--------------------------------------------------------------------"
echo "6. SERVIS DURUMU"
echo "--------------------------------------------------------------------"
echo ""
for service in wg-backend wg-frontend; do
    if systemctl is-active $service &>/dev/null; then
        echo "OK - $service: $(systemctl is-active $service)"
    else
        echo "INFO - $service: Systemd service yok"
    fi
done

echo ""
echo "--------------------------------------------------------------------"
echo "7. KRITIK DOSYALAR"
echo "--------------------------------------------------------------------"
echo ""
critical_files=(
    "backend/app/main.py"
    "backend/run.py"
    "backend/requirements.txt"
    "frontend/package.json"
    "quick-start.sh"
)

for file in "${critical_files[@]}"; do
    if [ -f "$file" ]; then
        echo "OK - $file"
    else
        echo "HATA - $file (EKSIK!)"
    fi
done

echo ""
echo "===================================================================="
echo "EN YAYGIN KURULUM SORUNLARI"
echo "===================================================================="
echo ""
echo "1. .env dosyasi eksik veya yanlis yapilandirilmis"
echo "   Cozum: bash setup_environment.sh"
echo ""
echo "2. Python/Node versiyonu uyumsuz"
echo "   Python 3.9+ ve Node 20+ gerekli"
echo ""
echo "3. Database dosyasi yolu yanlis"
echo "   SQLite icin: sqlite:///./router_manager.db"
echo ""
echo "4. Port cakismasi"
echo "   8001 ve 5173 portlari musait olmali"
echo ""
echo "5. MikroTik baglanti ayarlari yanlis"
echo "   .env'de MIKROTIK_HOST ve MIKROTIK_PORT dogru olmali"
echo ""
echo "===================================================================="
echo ""
