#!/bin/bash
# Log rotation kurulum scripti

set -e

# Script directory detection
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$SCRIPT_DIR"

echo "🔄 Log Rotation Kurulumu Başlıyor..."

# logrotate kurulu mu kontrol et
if ! command -v logrotate &> /dev/null; then
    echo "⚠️  logrotate kurulu değil. Kuruluyor..."
    apt-get update && apt-get install -y logrotate
fi

# Konfigürasyon dosyasını kopyala
echo "📝 Logrotate konfigürasyonu kopyalanıyor..."
sudo cp "$PROJECT_DIR/backend/logrotate.conf" /etc/logrotate.d/wireguard-manager
sudo chmod 644 /etc/logrotate.d/wireguard-manager

# Syntax kontrolü
echo "✅ Konfigürasyon syntax kontrolü..."
sudo logrotate -d /etc/logrotate.d/wireguard-manager

echo "✅ Log rotation kurulumu tamamlandı!"
echo ""
echo "Manuel test için:"
echo "  sudo logrotate -f /etc/logrotate.d/wireguard-manager"
echo ""
echo "Log dosyalarını görmek için:"
echo "  ls -lah $PROJECT_DIR/backend/logs/"
