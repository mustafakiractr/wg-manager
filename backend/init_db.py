"""
İlk veritabanı kurulum scripti
Varsayılan admin kullanıcısı oluşturur
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.database import AsyncSessionLocal, init_db
from app.models.user import User
from app.security.auth import get_password_hash


async def create_default_user():
    """
    Varsayılan admin kullanıcısı oluşturur
    Username: admin
    Password: admin123 (değiştirilmeli!)
    """
    async with AsyncSessionLocal() as session:
        # Admin kullanıcısı var mı kontrol et
        result = await session.execute(select(User).where(User.username == "admin"))
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            print("Admin kullanıcısı zaten mevcut.")
            return
        
        # Yeni admin kullanıcısı oluştur
        admin_user = User(
            username="admin",
            email="admin@example.com",
            hashed_password=get_password_hash("admin123"),
            is_active=True,
            is_admin=True
        )
        
        session.add(admin_user)
        await session.commit()
        print("✓ Admin kullanıcısı oluşturuldu!")
        print("  Username: admin")
        print("  Password: admin123")
        print("  ⚠️  Lütfen ilk girişten sonra şifreyi değiştirin!")


async def main():
    """Ana fonksiyon"""
    print("Veritabanı başlatılıyor...")
    await init_db()
    print("Varsayılan kullanıcı oluşturuluyor...")
    await create_default_user()
    print("\n✓ Kurulum tamamlandı!")


if __name__ == "__main__":
    asyncio.run(main())


