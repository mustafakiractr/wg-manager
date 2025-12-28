"""
Account lockout ve Session management için database migration
- User tablosuna lockout alanları ekler
- Session tablosu oluşturur
"""
import sqlite3
import sys
import os

DB_PATH = "router_manager.db"


def migrate_database():
    """Veritabanına session ve lockout güncellemelerini ekle"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        print("🔄 Account Lockout & Session Management migration başlatılıyor...\n")

        # ========================================================================
        # User tablosuna lockout alanları ekle
        # ========================================================================
        print("📋 User tablosu güncelleniyor...")

        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]

        # failed_login_attempts
        if 'failed_login_attempts' not in columns:
            print("  ➕ failed_login_attempts kolonu ekleniyor...")
            cursor.execute("""
                ALTER TABLE users
                ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0
            """)
            print("  ✅ failed_login_attempts eklendi")
        else:
            print("  ⏭️  failed_login_attempts zaten mevcut")

        # locked_until
        if 'locked_until' not in columns:
            print("  ➕ locked_until kolonu ekleniyor...")
            cursor.execute("""
                ALTER TABLE users
                ADD COLUMN locked_until DATETIME
            """)
            print("  ✅ locked_until eklendi")
        else:
            print("  ⏭️  locked_until zaten mevcut")

        # last_failed_login
        if 'last_failed_login' not in columns:
            print("  ➕ last_failed_login kolonu ekleniyor...")
            cursor.execute("""
                ALTER TABLE users
                ADD COLUMN last_failed_login DATETIME
            """)
            print("  ✅ last_failed_login eklendi")
        else:
            print("  ⏭️  last_failed_login zaten mevcut")

        # ========================================================================
        # Session tablosu oluştur
        # ========================================================================
        print("\n📋 Session tablosu kontrol ediliyor...")

        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='sessions'
        """)
        table_exists = cursor.fetchone()

        if not table_exists:
            print("  ➕ Session tablosu oluşturuluyor...")
            cursor.execute("""
                CREATE TABLE sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    session_token VARCHAR UNIQUE NOT NULL,
                    refresh_token VARCHAR UNIQUE,
                    device_name VARCHAR,
                    device_type VARCHAR,
                    user_agent VARCHAR,
                    ip_address VARCHAR,
                    location VARCHAR,
                    is_active BOOLEAN NOT NULL DEFAULT 1,
                    remember_me BOOLEAN NOT NULL DEFAULT 0,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    last_activity DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME NOT NULL,
                    revoked_at DATETIME,
                    revoked_reason VARCHAR,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)

            # Index'ler ekle
            cursor.execute("CREATE INDEX idx_sessions_user_id ON sessions(user_id)")
            cursor.execute("CREATE INDEX idx_sessions_session_token ON sessions(session_token)")
            cursor.execute("CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token)")
            cursor.execute("CREATE INDEX idx_sessions_is_active ON sessions(is_active)")

            print("  ✅ Session tablosu oluşturuldu")
            print("  ✅ Index'ler eklendi")
        else:
            print("  ⏭️  Session tablosu zaten mevcut")

        # Değişiklikleri kaydet
        conn.commit()
        print("\n✅ Migration başarıyla tamamlandı!\n")

        # Güncel tablo yapılarını göster
        print("📋 Güncellenmiş users tablosu yapısı:")
        cursor.execute("PRAGMA table_info(users)")
        for column in cursor.fetchall():
            print(f"   - {column[1]}: {column[2]}")

        print("\n📋 Sessions tablosu yapısı:")
        cursor.execute("PRAGMA table_info(sessions)")
        for column in cursor.fetchall():
            print(f"   - {column[1]}: {column[2]}")

    except sqlite3.Error as e:
        print(f"\n❌ Migration hatası: {e}")
        sys.exit(1)
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        print(f"❌ Veritabanı dosyası bulunamadı: {DB_PATH}")
        print("   Lütfen backend dizininden çalıştırın")
        sys.exit(1)

    migrate_database()
