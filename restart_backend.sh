#!/bin/bash
# Script directory detection
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$SCRIPT_DIR"

echo "Backend yeniden başlatılıyor..."
cd "$PROJECT_DIR/backend"
pkill -f uvicorn 2>/dev/null
sleep 2
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8001 > logs/backend.log 2>&1 &
sleep 3
if (netstat -tlnp 2>/dev/null || ss -tlnp 2>/dev/null) | grep -q :8001; then
    echo "✅ Backend başlatıldı: http://localhost:8001"
else
    echo "✗ Backend başlatılamadı, log: tail -f $PROJECT_DIR/backend/logs/backend.log"
fi
