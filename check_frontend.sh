#!/bin/bash
echo "=== Frontend Kontrolü ==="
echo ""

# Vite process kontrolü
if ps aux | grep -E "(vite|node.*5173)" | grep -v grep > /dev/null; then
    echo "✓ Vite process çalışıyor"
else
    echo "✗ Vite process çalışmıyor"
    echo "  Başlatılıyor..."
    cd /root/frontend
    nohup /usr/bin/npm run dev > ../frontend.log 2>&1 &
    sleep 5
fi

# Port kontrolü
if (netstat -tlnp 2>/dev/null || ss -tlnp 2>/dev/null) | grep -q :5173; then
    echo "✓ Port 5173 açık"
    echo ""
    echo "🌐 Web arayüzü: http://192.168.40.38:5173"
    echo ""
    echo "Eğer beyaz ekran görüyorsanız:"
    echo "1. Tarayıcıda F12 tuşuna basın"
    echo "2. Console sekmesine gidin"
    echo "3. Hata mesajlarını kontrol edin"
    echo "4. Network sekmesinde istekleri kontrol edin"
else
    echo "✗ Port 5173 kapalı"
    echo "  Log: tail -f /root/frontend.log"
fi
