#!/bin/bash
echo "=== Servisler Yeniden Başlatılıyor ==="

# Backend
cd /root/wg/backend
pkill -f "python.*run.py" 2>/dev/null
pkill -f uvicorn 2>/dev/null
sleep 1
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8001 > /root/wg/backend.log 2>&1 &
echo "Backend başlatıldı"

# Frontend
cd /root/wg/frontend
pkill -f vite 2>/dev/null
sleep 1
/usr/bin/npm run dev > /root/wg/frontend.log 2>&1 &
echo "Frontend başlatıldı"

sleep 4
echo ""
echo "=== Durum ==="
(netstat -tlnp 2>/dev/null || ss -tlnp 2>/dev/null) | grep -E ':(8001|5173)' && echo "✓ Her iki servis çalışıyor" || echo "✗ Servisler başlatılıyor..."
echo ""
echo "🌐 Web: http://192.168.40.38:5173"
echo "🔌 API: http://192.168.40.38:8001"
