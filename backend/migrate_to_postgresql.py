#!/usr/bin/env python3
"""
SQLite'dan PostgreSQL'e veri taşıma scripti
Mevcut SQLite veritabanındaki tüm verileri PostgreSQL'e kopyalar
"""
import asyncio
import json
import sys
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import Session

# SQLite bağlantısı (sync)
SQLITE_URL = "sqlite:///./router_manager.db"

# PostgreSQL bağlantısı (async)
POSTGRESQL_URL = "postgresql+asyncpg://wg_user:wg_secure_pass_2025@localhost/wg_manager"

print("=" * 60)
print("SQLite → PostgreSQL Migration Script")
print("=" * 60)
print()

# Sırayla migrate edilecek tablolar (foreign key sırasına göre)
TABLES = [
    "users",
    "mikrotik_settings",
    "sessions",
    # "wireguard_interfaces",  # Dinamik, migrate edilmeyecek
    # "wireguard_peers",  # Dinamik, migrate edilmeyecek
    "ip_pools",
    "ip_allocations",
    "peer_handshakes",
    "traffic_logs",
    "peer_traffic_logs",
    "peer_keys",
    "notifications",
    "activity_logs",
    "log_entries",
    "peer_metadata",
    "peer_templates",
]

async def migrate_table(sqlite_engine, pg_engine, table_name):
    """Bir tabloyu SQLite'dan PostgreSQL'e kopyalar"""
    print(f"📋 Migrating table: {table_name}")
    
    # SQLite'dan veriyi oku (sync)
    with Session(sqlite_engine) as sqlite_session:
        result = sqlite_session.execute(text(f"SELECT * FROM {table_name}"))
        rows = result.fetchall()
        columns = result.keys()
        
        if not rows:
            print(f"   ⚠️  {table_name} - Tablo boş, atlanıyor")
            return 0
        
        # PostgreSQL'e yaz (async)
        async with pg_engine.begin() as conn:
            # Tüm satırları dict'e çevir ve veri tiplerini düzelt
            data = []
            for row in rows:
                row_dict = dict(zip(columns, row))
                
                # Boolean dönüşümleri (SQLite 0/1 → PostgreSQL true/false)
                for key, value in row_dict.items():
                    if key in ['is_active', 'is_admin', 'use_tls', 'two_factor_enabled', 
                               'is_online', 'read', 'remember_me']:
                        row_dict[key] = bool(value) if value is not None else False
                    # Datetime dönüşümleri (string → datetime)
                    elif key in ['created_at', 'updated_at', 'expires_at', 'revoked_at',
                                 'locked_until', 'last_failed_login', 'last_activity', 
                                 'allocated_at', 'released_at', 'first_seen', 'last_updated',
                                 'event_time', 'timestamp', 'read_at', 'last_used_at']:
                        if value and isinstance(value, str):
                            from datetime import datetime
                            try:
                                # ISO format datetime parse et
                                row_dict[key] = datetime.fromisoformat(value.replace(' ', 'T'))
                            except (ValueError, AttributeError, Exception) as e:
                                print(f"  ⚠️  Datetime parse hatası: {value}, Hata: {e}")
                                row_dict[key] = None
                
                data.append(row_dict)
            
            # Batch insert
            placeholders = ", ".join([f":{col}" for col in columns])
            insert_query = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"
            
            try:
                await conn.execute(text(insert_query), data)
                print(f"   ✅ {table_name} - {len(data)} satır migrate edildi")
                return len(data)
            except Exception as e:
                print(f"   ❌ {table_name} - Hata: {e}")
                # Detaylı hata için ilk satırı göster
                if data:
                    print(f"   Örnek veri: {list(data[0].keys())[:5]}")
                return 0

async def create_postgresql_schema(pg_engine):
    """PostgreSQL'de şemayı oluştur"""
    print("🔧 PostgreSQL şeması oluşturuluyor...")
    
    # App modüllerini import et (tablolar otomatik oluşsun)
    sys.path.insert(0, "/root/wg/backend")
    from app.database.database import Base
    from app.models import (
        user, log_entry, settings, peer_handshake, traffic_log,
        peer_traffic_log, peer_key, notification, ip_pool,
        activity_log, peer_metadata, peer_template, session
    )
    
    async with pg_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("   ✅ Şema oluşturuldu")

async def verify_migration(sqlite_engine, pg_engine):
    """Migration'ı doğrula"""
    print()
    print("🔍 Migration doğrulaması yapılıyor...")
    print()
    
    results = []
    
    for table in TABLES:
        # SQLite count
        with Session(sqlite_engine) as sqlite_session:
            sqlite_count = sqlite_session.execute(
                text(f"SELECT COUNT(*) FROM {table}")
            ).scalar()
        
        # PostgreSQL count
        async with pg_engine.begin() as conn:
            pg_count = await conn.scalar(
                text(f"SELECT COUNT(*) FROM {table}")
            )
        
        match = "✅" if sqlite_count == pg_count else "❌"
        results.append({
            "table": table,
            "sqlite": sqlite_count,
            "postgresql": pg_count,
            "match": match
        })
        
        print(f"{match} {table:25} SQLite: {sqlite_count:5} → PostgreSQL: {pg_count:5}")
    
    print()
    total_match = all(r["match"] == "✅" for r in results if r["sqlite"] > 0)
    if total_match:
        print("✅ Tüm tablolar başarıyla migrate edildi!")
    else:
        print("⚠️  Bazı tablolarda uyumsuzluk var, lütfen kontrol edin.")
    
    return results

async def main():
    """Ana migration fonksiyonu"""
    
    # SQLite bağlantısı (sync)
    print("📂 SQLite bağlantısı kuruluyor...")
    sqlite_engine = create_engine(SQLITE_URL)
    print("   ✅ SQLite bağlandı")
    
    # PostgreSQL bağlantısı (async)
    print("🐘 PostgreSQL bağlantısı kuruluyor...")
    pg_engine = create_async_engine(POSTGRESQL_URL, echo=False)
    print("   ✅ PostgreSQL bağlandı")
    print()
    
    # PostgreSQL şemasını oluştur
    await create_postgresql_schema(pg_engine)
    print()
    
    # Her tabloyu migrate et
    print("📦 Tablolar migrate ediliyor...")
    print()
    
    total_rows = 0
    for table in TABLES:
        try:
            count = await migrate_table(sqlite_engine, pg_engine, table)
            total_rows += count
        except Exception as e:
            print(f"   ❌ {table} - Kritik hata: {e}")
            continue
    
    print()
    print(f"📊 Toplam {total_rows} satır migrate edildi")
    
    # Doğrulama
    await verify_migration(sqlite_engine, pg_engine)
    
    # Kaynakları temizle
    await pg_engine.dispose()
    sqlite_engine.dispose()
    
    print()
    print("=" * 60)
    print("✅ Migration tamamlandı!")
    print("=" * 60)
    print()
    print("📝 Sonraki adımlar:")
    print("1. backend/.env dosyasında DATABASE_URL'i güncelle:")
    print('   DATABASE_URL="postgresql+asyncpg://wg_user:wg_secure_pass_2025@localhost/wg_manager"')
    print("2. Backend servisi yeniden başlat:")
    print("   systemctl restart wg-backend")
    print()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Migration iptal edildi.")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Migration hatası: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
