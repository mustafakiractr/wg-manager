#!/bin/bash
#
# WireGuard Manager - Backup Schedule Kurulumu
# Otomatik backup için cron job ve log rotation ayarları
#

set -e

echo "🕒 Backup Schedule Kurulumu Başlatılıyor..."

# Root kontrolü
if [[ $EUID -ne 0 ]]; then
   echo "❌ Bu script root olarak çalıştırılmalı (sudo)"
   exit 1
fi

# Backup script'ine execute izni ver
BACKEND_DIR="/opt/wg-manager/backend"
BACKUP_SCRIPT="$BACKEND_DIR/scheduled_backup.sh"

if [ -f "$BACKUP_SCRIPT" ]; then
    chmod +x "$BACKUP_SCRIPT"
    echo "✅ Backup script'ine execute izni verildi"
else
    echo "❌ Backup script bulunamadı: $BACKUP_SCRIPT"
    exit 1
fi

# Cron job'ları ekle
echo ""
echo "📅 Cron Job'ları Yapılandırılıyor..."

# Mevcut crontab'ı yedekle
crontab -l > /tmp/crontab_backup_$(date +%Y%m%d_%H%M%S).txt 2>/dev/null || true

# Yeni crontab içeriği
CRONTAB_CONTENT=$(cat <<EOF
# WireGuard Manager - Otomatik Backup Schedule
# Günlük database backup - Her gün 02:00
0 2 * * * $BACKUP_SCRIPT database true >> $BACKEND_DIR/logs/cron_backup.log 2>&1

# Haftalık full system backup - Her Pazar 03:00
0 3 * * 0 $BACKUP_SCRIPT full true >> $BACKEND_DIR/logs/cron_backup.log 2>&1

# Retention policy - Her gün 04:00 (eski backup'ları temizle)
0 4 * * * $BACKEND_DIR/venv/bin/python3 -c "import asyncio; from app.services.backup_scheduler_service import BackupSchedulerService; asyncio.run(BackupSchedulerService.apply_retention_policy())" >> $BACKEND_DIR/logs/cron_retention.log 2>&1

EOF
)

# Mevcut crontab'a ekle (duplicate kontrolü ile)
(crontab -l 2>/dev/null | grep -v "WireGuard Manager - Otomatik Backup" || true; echo "$CRONTAB_CONTENT") | crontab -

echo "✅ Cron job'ları eklendi:"
echo ""
echo "   📅 Günlük Database Backup:  Her gün 02:00"
echo "   📅 Haftalık Full Backup:    Her Pazar 03:00"
echo "   🗑️  Retention Policy:        Her gün 04:00"
echo ""

# Log dosyaları oluştur
mkdir -p "$BACKEND_DIR/logs"
touch "$BACKEND_DIR/logs/cron_backup.log"
touch "$BACKEND_DIR/logs/cron_retention.log"
touch "$BACKEND_DIR/logs/scheduled_backup.log"

# Log dosyalarına izin ver
chmod 644 "$BACKEND_DIR/logs/cron_backup.log"
chmod 644 "$BACKEND_DIR/logs/cron_retention.log"
chmod 644 "$BACKEND_DIR/logs/scheduled_backup.log"

echo "✅ Log dosyaları oluşturuldu"
echo ""

# Logrotate yapılandırması
LOGROTATE_CONF="/etc/logrotate.d/wg-manager-backup"

cat > "$LOGROTATE_CONF" <<EOF
$BACKEND_DIR/logs/cron_backup.log
$BACKEND_DIR/logs/cron_retention.log
$BACKEND_DIR/logs/scheduled_backup.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 root root
    sharedscripts
}
EOF

echo "✅ Logrotate yapılandırması oluşturuldu: $LOGROTATE_CONF"
echo ""

# Test çalıştırması (opsiyonel)
echo "🧪 Test Backup Çalıştırılsın mı? (y/n)"
read -r RESPONSE

if [[ "$RESPONSE" == "y" || "$RESPONSE" == "Y" ]]; then
    echo ""
    echo "🧪 Test database backup başlatılıyor..."
    $BACKUP_SCRIPT database false
    
    if [ $? -eq 0 ]; then
        echo "✅ Test başarılı!"
    else
        echo "❌ Test başarısız!"
    fi
fi

echo ""
echo "🎉 Backup Schedule Kurulumu Tamamlandı!"
echo ""
echo "📋 Kurulum Özeti:"
echo "   - Günlük database backup (02:00)"
echo "   - Haftalık full backup (Pazar 03:00)"
echo "   - Otomatik retention policy (04:00)"
echo "   - Log rotation (30 gün)"
echo ""
echo "📊 Log Dosyaları:"
echo "   - Backup: $BACKEND_DIR/logs/cron_backup.log"
echo "   - Retention: $BACKEND_DIR/logs/cron_retention.log"
echo "   - Scheduled: $BACKEND_DIR/logs/scheduled_backup.log"
echo ""
echo "🔍 Cron Job Kontrolü:"
echo "   crontab -l | grep 'WireGuard Manager'"
echo ""
echo "🧪 Manuel Test:"
echo "   sudo $BACKUP_SCRIPT database true"
echo ""
