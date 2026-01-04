#!/usr/bin/env python3
"""
Telegram Settings Migration
Creates telegram_settings table in the database
"""
import asyncio
import sys
import os

# Proje root'unu Python path'e ekle
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.database import AsyncSessionLocal
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def run_migration():
    """Migration'ı çalıştır"""
    try:
        # Migration SQL'i oku
        migration_file = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "migrations",
            "004_telegram_settings.sql"
        )
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        # SQL'i statement'lara ayır
        statements = [s.strip() for s in migration_sql.split(';') if s.strip() and not s.strip().startswith('--')]
        
        async with AsyncSessionLocal() as session:
            async with session.begin():
                for statement in statements:
                    if statement:
                        logger.info(f"Executing: {statement[:100]}...")
                        await session.execute(text(statement))
                
                await session.commit()
        
        logger.info("✅ Telegram settings migration başarıyla tamamlandı!")
        return True
    
    except Exception as e:
        logger.error(f"❌ Migration hatası: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False


if __name__ == "__main__":
    success = asyncio.run(run_migration())
    sys.exit(0 if success else 1)
