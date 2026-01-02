"""
İlk veritabanı kurulum scripti
Varsayılan admin kullanıcısı ve MikroTik ayarları oluşturur
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.database import AsyncSessionLocal, init_db
from app.models.user import User
from app.models.settings import MikroTikSettings
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


async def create_default_mikrotik_settings():
    """
    Varsayılan MikroTik ayarları oluşturur
    Bu ayarlar panel üzerinden güncellenmelidir
    """
    async with AsyncSessionLocal() as session:
        # MikroTik ayarları var mı kontrol et
        result = await session.execute(select(MikroTikSettings).where(MikroTikSettings.id == 1))
        existing_settings = result.scalar_one_or_none()
        
        if existing_settings:
            print("MikroTik ayarları zaten mevcut.")
            return
        
        # Varsayılan MikroTik ayarları oluştur (placeholder değerler)
        # Kullanıcı bu değerleri panel üzerinden güncelleyecek
        default_settings = MikroTikSettings(
            id=1,
            host="192.168.1.1",  # Placeholder
            port=8728,
            username="admin",  # Placeholder
            password="",  # Placeholder (boş)
            use_tls=False
        )
        
        session.add(default_settings)
        await session.commit()
        print("✓ Varsayılan MikroTik ayarları oluşturuldu!")
        print("  Host: 192.168.1.1 (placeholder)")
        print("  Port: 8728")
        print("  ⚠️  Lütfen panel üzerinden gerçek MikroTik bilgilerini girin!")


async def main():
    """Ana fonksiyon"""
    print("Veritabanı başlatılıyor...")
    await init_db()
    print("Varsayılan kullanıcı oluşturuluyor...")
    await create_default_user()
    print("Varsayılan MikroTik ayarları oluşturuluyor...")
    await create_default_mikrotik_settings()
    print("\n✓ Kurulum tamamlandı!")
    print("\n📋 Sonraki Adımlar:")
    print("1. Backend'i başlatın: bash start_backend.sh")
    print("2. Frontend'i başlatın: bash start_web.sh")
    print("3. Tarayıcıda http://localhost:5173 adresine gidin")
    print("4. admin/admin123 ile giriş yapın")
    print("5. MikroTik Bağlantı sayfasından gerçek bağlantı bilgilerini girin")
    print("6. Şifrenizi değiştirin!")


if __name__ == "__main__":
    asyncio.run(main())


