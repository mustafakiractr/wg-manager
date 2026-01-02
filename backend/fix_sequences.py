#!/usr/bin/env python3
"""
PostgreSQL sequence düzeltme scripti
Duplicate key hatalarını önlemek için tüm sequence'leri güncel max ID'ye ayarlar
"""
import asyncio
from app.database.database import AsyncSessionLocal
from sqlalchemy import text


async def fix_all_sequences():
    """Tüm tablo sequence'lerini düzelt"""
    async with AsyncSessionLocal() as db:
        # Tüm tablolar
        tables = [
            'log_entries',
            'users',
            'activity_logs',
            'notifications',
            'sessions',
            'ip_pools',
            'ip_allocations',
            'peer_templates',
            'peer_metadata',
            'peer_keys',
            'peer_handshake_logs',
            'peer_traffic_logs',
            'traffic_logs',
            'mikrotik_settings',
            'sync_status'
        ]
        
        print("=" * 60)
        print("PostgreSQL Sequence Düzeltme")
        print("=" * 60)
        
        for table in tables:
            try:
                # Max ID'yi bul
                max_id_query = text(f"SELECT COALESCE(MAX(id), 0) FROM {table}")
                result = await db.execute(max_id_query)
                max_id = result.scalar()
                
                # Sequence adını oluştur
                seq_name = f"{table}_id_seq"
                
                # Sequence'i düzelt
                fix_query = text(f"SELECT setval('{seq_name}', :max_id, true)")
                await db.execute(fix_query, {"max_id": max(max_id, 1)})
                
                print(f"✅ {table:30s} → sequence set to {max_id}")
                
            except Exception as e:
                error_msg = str(e)
                if "does not exist" in error_msg:
                    print(f"⏭️  {table:30s} → tablo yok (atlandı)")
                else:
                    print(f"❌ {table:30s} → HATA: {error_msg[:50]}")
        
        await db.commit()
        print("=" * 60)
        print("✅ Tüm sequence'ler düzeltildi!")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(fix_all_sequences())
