#!/usr/bin/env python3
"""
Apply database indexes for performance optimization
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from app.database.database import AsyncSessionLocal, engine
from sqlalchemy import text

async def apply_indexes():
    """Apply performance indexes"""
    
    # Read SQL migration file
    migration_file = Path("/root/wg/backend/migrations/003_performance_indexes.sql")
    
    print(f"📖 Reading migration: {migration_file}")
    with open(migration_file, 'r') as f:
        sql_content = f.read()
    
    # Split by semicolons and filter empty statements
    statements = [s.strip() for s in sql_content.split(';') if s.strip() and not s.strip().startswith('--')]
    
    print(f"📊 Found {len(statements)} SQL statements")
    
    async with engine.begin() as conn:
        success_count = 0
        for idx, statement in enumerate(statements, 1):
            try:
                # Skip comments
                if statement.startswith('--') or not statement:
                    continue
                
                await conn.execute(text(statement))
                # Extract index name from statement
                if 'CREATE INDEX' in statement:
                    index_name = statement.split('IF NOT EXISTS')[1].split('ON')[0].strip()
                    print(f"✅ [{idx}/{len(statements)}] Created index: {index_name}")
                success_count += 1
            except Exception as e:
                print(f"⚠️  [{idx}/{len(statements)}] Warning: {str(e)[:100]}")
    
    print(f"\n🎉 Migration complete! {success_count}/{len(statements)} indexes created/verified")

if __name__ == "__main__":
    asyncio.run(apply_indexes())
