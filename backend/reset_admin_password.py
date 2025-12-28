"""
Reset admin password to admin123
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.database.database import AsyncSessionLocal
from app.models.user import User
from app.security.auth import get_password_hash

async def main():
    async with AsyncSessionLocal() as session:
        # Get admin user
        result = await session.execute(select(User).where(User.username == "admin"))
        admin = result.scalar_one_or_none()

        if not admin:
            print("❌ Admin user not found")
            return

        # Hash new password
        new_hash = get_password_hash("admin123")
        print(f"New hash: {new_hash}")

        # Update password
        await session.execute(
            update(User)
            .where(User.id == admin.id)
            .values(hashed_password=new_hash)
        )
        await session.commit()

        print("✅ Admin password reset to 'admin123'")

if __name__ == "__main__":
    asyncio.run(main())
