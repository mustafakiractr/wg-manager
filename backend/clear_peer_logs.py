#!/usr/bin/env python3
"""
Peer handshake loglarını temizleme scripti
Tüm peer handshake kayıtlarını veritabanından siler
"""
import asyncio
from sqlalchemy import delete
from app.database.database import AsyncSessionLocal
from app.models.peer_handshake import PeerHandshake
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def clear_all_peer_logs():
    """
    Tüm peer handshake loglarını veritabanından siler
    """
    async with AsyncSessionLocal() as session:
        try:
            # Önce kaç kayıt olduğunu say
            from sqlalchemy import select, func
            count_result = await session.execute(
                select(func.count()).select_from(PeerHandshake)
            )
            total_count = count_result.scalar()
            
            logger.info(f"Toplam {total_count} peer handshake kaydı bulundu")
            
            if total_count == 0:
                logger.info("Silinecek kayıt yok")
                return
            
            # Tüm kayıtları sil
            delete_stmt = delete(PeerHandshake)
            result = await session.execute(delete_stmt)
            deleted_count = result.rowcount
            
            # Değişiklikleri kaydet
            await session.commit()
            
            logger.info(f"✅ {deleted_count} peer handshake kaydı başarıyla silindi")
            logger.info("Peer handshake logları temizlendi")
            
        except Exception as e:
            await session.rollback()
            logger.error(f"❌ Hata oluştu: {e}")
            raise


if __name__ == "__main__":
    print("=" * 60)
    print("Peer Handshake Logları Temizleme")
    print("=" * 60)
    print()
    print("⚠️  UYARI: Bu işlem tüm peer handshake loglarını kalıcı olarak silecektir!")
    print()
    
    # Kullanıcı onayı iste
    response = input("Devam etmek istediğinize emin misiniz? (evet/hayır): ").strip().lower()
    
    if response in ['evet', 'e', 'yes', 'y']:
        print()
        print("Loglar temizleniyor...")
        print()
        asyncio.run(clear_all_peer_logs())
        print()
        print("✅ İşlem tamamlandı!")
    else:
        print()
        print("❌ İşlem iptal edildi")

