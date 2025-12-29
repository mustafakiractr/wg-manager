#!/bin/bash
# Port kontrol scripti

echo "=== Port Durumu ==="
echo ""

# Port 8001 (Backend)
if command -v netstat &> /dev/null; then
    netstat -tlnp 2>/dev/null | grep :8001 && echo "✓ Backend (8001) çalışıyor" || echo "✗ Backend (8001) çalışmıyor"
elif command -v ss &> /dev/null; then
    ss -tlnp 2>/dev/null | grep :8001 && echo "✓ Backend (8001) çalışıyor" || echo "✗ Backend (8001) çalışmıyor"
else
    echo "Port kontrolü için netstat/ss bulunamadı"
fi

# Port 5173 (Frontend)
if command -v netstat &> /dev/null; then
    netstat -tlnp 2>/dev/null | grep :5173 && echo "✓ Frontend (5173) çalışıyor" || echo "✗ Frontend (5173) çalışmıyor"
elif command -v ss &> /dev/null; then
    ss -tlnp 2>/dev/null | grep :5173 && echo "✓ Frontend (5173) çalışıyor" || echo "✗ Frontend (5173) çalışmıyor"
fi

echo ""
echo "=== Erişim Bilgileri ==="
echo "Backend API:  http://192.168.40.38:8001"
echo "Frontend Web: http://192.168.40.38:5173"
echo "API Docs:     http://192.168.40.38:8001/docs"
