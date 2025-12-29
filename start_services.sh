#!/bin/bash
# Servis başlatma scripti

echo "=== Router Manager Servisleri Başlatılıyor ==="

# Backend başlat
cd /root/backend
if [ ! -f "router_manager.db" ]; then
    echo "Veritabanı oluşturuluyor..."
    python3 init_db.py
fi

echo "Backend başlatılıyor (Port 8001)..."
nohup python3 run.py > logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Frontend başlat (eğer npm varsa)
cd /root/frontend
if command -v npm &> /dev/null; then
    if [ ! -d "node_modules" ]; then
        echo "Node modules yükleniyor..."
        npm install
    fi
    echo "Frontend başlatılıyor (Port 5173)..."
    nohup npm run dev > ../frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo "Frontend PID: $FRONTEND_PID"
else
    echo "⚠️  npm bulunamadı, frontend başlatılamadı"
fi

echo ""
echo "=== Servisler Başlatıldı ==="
echo "Backend:  http://localhost:8001"
echo "Frontend: http://localhost:5173"
echo ""
echo "Log dosyaları:"
echo "  Backend:  /root/backend/logs/backend.log"
echo "  Frontend: /root/frontend.log"
echo ""
echo "Servisleri durdurmak için:"
echo "  kill $BACKEND_PID"
if [ ! -z "$FRONTEND_PID" ]; then
    echo "  kill $FRONTEND_PID"
fi
