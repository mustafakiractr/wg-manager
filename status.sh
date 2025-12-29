#!/bin/bash
echo "=== Router Manager Durum Kontrolü ==="
echo ""

# Backend kontrolü
if (netstat -tlnp 2>/dev/null || ss -tlnp 2>/dev/null) | grep -q :8001; then
    echo "✓ Backend çalışıyor (Port 8001)"
    echo "  http://localhost:8001"
    echo "  http://localhost:8001/docs"
else
    echo "✗ Backend çalışmıyor"
    echo "  Başlatmak için: cd /root/backend && source venv/bin/activate && python run.py"
fi

echo ""

# Frontend kontrolü
if (netstat -tlnp 2>/dev/null || ss -tlnp 2>/dev/null) | grep -q :5173; then
    echo "✓ Frontend çalışıyor (Port 5173)"
    echo "  http://localhost:5173"
else
    echo "✗ Frontend çalışmıyor"
    if command -v npm &> /dev/null; then
        echo "  Başlatmak için: cd /root/frontend && npm run dev"
    else
        echo "  npm yüklü değil, önce npm kurulumu gerekli"
    fi
fi

echo ""
echo "=== Log Dosyaları ==="
echo "Backend:  tail -f /root/backend/logs/backend.log"
echo "Frontend: tail -f /root/frontend.log"
