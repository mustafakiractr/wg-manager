"""
Verify admin password hash
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.database import AsyncSessionLocal
from app.models.user import User
from app.security.auth import verify_password

async def main():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.username == "admin"))
        admin = result.scalar_one_or_none()

        if not admin:
            print("❌ Admin user not found")
            return

        print(f"Username: {admin.username}")
        print(f"Hash: {admin.hashed_password}")
        print(f"Hash length: {len(admin.hashed_password)}")

        # Try different passwords
        passwords_to_test = ["admin123", "admin", "password", "12345678"]

        for pwd in passwords_to_test:
            is_valid = verify_password(pwd, admin.hashed_password)
            print(f"Password '{pwd}': {'✅ MATCH' if is_valid else '❌ no match'}")

if __name__ == "__main__":
    asyncio.run(main())
