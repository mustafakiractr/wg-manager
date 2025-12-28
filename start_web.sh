#!/bin/bash
cd /root/backend
source venv/bin/activate
pkill -f "python.*run.py" 2>/dev/null
sleep 1
nohup python run.py > logs/backend.log 2>&1 &
echo "Backend başlatıldı"

cd /root/frontend
pkill -f "vite" 2>/dev/null
sleep 1
/usr/bin/npm run dev > ../frontend.log 2>&1 &
echo "Frontend başlatıldı"

sleep 3
echo ""
echo "=== 🌐 WEB ARAYÜZÜ HAZIR ==="
echo "Web: http://192.168.40.38:5173"
echo "API: http://192.168.40.38:8001"
echo "Docs: http://192.168.40.38:8001/docs"
