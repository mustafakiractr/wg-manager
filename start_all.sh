#!/bin/bash
echo "=== Router Manager Servisleri Başlatılıyor ==="

# Backend başlat
cd /root/wg/backend
if [ ! -d "venv" ]; then
    echo "Virtual environment oluşturuluyor..."
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip -q
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

if [ ! -f "router_manager.db" ]; then
    echo "Veritabanı oluşturuluyor..."
    python init_db.py
fi

echo "Backend başlatılıyor (Port 8001)..."
pkill -f "python.*run.py" 2>/dev/null
sleep 1
nohup python run.py > backend_output.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Frontend kontrolü
cd /root/wg/frontend
if command -v npm &> /dev/null; then
    if [ ! -d "node_modules" ]; then
        echo "Node modules yükleniyor..."
        npm install
    fi
    echo "Frontend başlatılıyor (Port 5173)..."
    pkill -f "vite" 2>/dev/null
    sleep 1
    nohup npm run dev > /root/wg/frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo "Frontend PID: $FRONTEND_PID"
else
    echo "⚠️  npm bulunamadı, frontend başlatılamadı"
    FRONTEND_PID=""
fi

sleep 3
echo ""
echo "=== Servisler Başlatıldı ==="
echo "Backend:  http://localhost:8001"
echo "Frontend: http://localhost:5173"
echo "API Docs: http://localhost:8001/docs"
echo ""
echo "Log dosyaları:"
echo "  Backend:  /root/wg/backend/backend_output.log"
echo "  Frontend: /root/wg/frontend.log"
echo ""
echo "Servisleri durdurmak için:"
echo "  pkill -f 'python.*run.py'"
if [ ! -z "$FRONTEND_PID" ]; then
    echo "  pkill -f 'vite'"
fi
