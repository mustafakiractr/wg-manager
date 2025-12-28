#!/bin/bash
# Frontend'i sürekli çalışır tutan script

while true; do
    if ! (netstat -tlnp 2>/dev/null || ss -tlnp 2>/dev/null) | grep -q :5173; then
        echo "$(date): Frontend durdu, yeniden başlatılıyor..."
        cd /root/frontend
        pkill -f vite 2>/dev/null
        sleep 2
        nohup /usr/bin/npm run dev > ../frontend.log 2>&1 &
        sleep 5
    fi
    sleep 10
done
