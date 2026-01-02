#!/bin/bash
echo "Backend yeniden başlatılıyor..."
cd /root/wg/backend
pkill -f uvicorn 2>/dev/null
sleep 2
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8001 > logs/backend.log 2>&1 &
sleep 3
if (netstat -tlnp 2>/dev/null || ss -tlnp 2>/dev/null) | grep -q :8001; then
    echo "✅ Backend başlatıldı: http://localhost:8001"
else
    echo "✗ Backend başlatılamadı, log: tail -f /root/wg/backend/logs/backend.log"
fi
