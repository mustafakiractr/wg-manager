#!/bin/bash
#
# WireGuard Manager - Otomatik Backup Script
# Bu script cron job ile çalıştırılır
#

# Environment variables
export PGPASSWORD='wg_secure_pass_2025'
export PATH=/usr/local/bin:/usr/bin:/bin

# Çalışma dizini
BACKEND_DIR="/opt/wg-manager/backend"
cd "$BACKEND_DIR" || exit 1

# Virtual environment
source venv/bin/activate || exit 1

# Log dosyası
LOG_FILE="$BACKEND_DIR/logs/scheduled_backup.log"
mkdir -p "$(dirname "$LOG_FILE")"

# Backup tipi (parametreden al, yoksa database)
BACKUP_TYPE="${1:-database}"

# Bildirim gönder mi? (parametreden al, yoksa evet)
SEND_NOTIFICATION_RAW="${2:-true}"

# Bash boolean'ını Python boolean'ına çevir
if [[ "$SEND_NOTIFICATION_RAW" == "true" ]]; then
    SEND_NOTIFICATION="True"
else
    SEND_NOTIFICATION="False"
fi

# Timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$TIMESTAMP] 🕒 Zamanlanmış backup başlatılıyor: $BACKUP_TYPE" >> "$LOG_FILE"

# Python script ile backup oluştur
python3 << EOF
import asyncio
import sys
import os

# Backend modüllerini import et
sys.path.insert(0, '$BACKEND_DIR')

from app.database.database import AsyncSessionLocal
from app.services.backup_scheduler_service import BackupSchedulerService

async def main():
    async with AsyncSessionLocal() as db:
        result = await BackupSchedulerService.create_scheduled_backup(
            db=db,
            backup_type='$BACKUP_TYPE',
            description='Scheduled $BACKUP_TYPE backup - cron job',
            send_notification=$SEND_NOTIFICATION
        )
        
        if result.get('success'):
            print(f"✅ Backup başarılı: {result.get('backup_name')}")
            print(f"📦 Boyut: {result.get('size_mb', 0):.2f} MB")
            sys.exit(0)
        else:
            print(f"❌ Backup hatası: {result.get('message')}")
            sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
EOF

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "[$TIMESTAMP] ✅ Backup tamamlandı" >> "$LOG_FILE"
else
    echo "[$TIMESTAMP] ❌ Backup başarısız (exit code: $EXIT_CODE)" >> "$LOG_FILE"
fi

exit $EXIT_CODE
