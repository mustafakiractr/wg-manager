"""
2FA için veritabanı migration scripti
Users tablosuna 2FA kolonlarını ekler
"""
import sqlite3
import sys
import os

# Backend dizinini Python path'e ekle
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

DB_PATH = "router_manager.db"


def migrate_database():
    """Veritabanına 2FA kolonlarını ekle"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        print("🔄 2FA migration başlatılıyor...")

        # Mevcut kolonları kontrol et
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]

        # two_factor_enabled kolonu yoksa ekle
        if 'two_factor_enabled' not in columns:
            print("  ➕ two_factor_enabled kolonu ekleniyor...")
            cursor.execute("""
                ALTER TABLE users
                ADD COLUMN two_factor_enabled BOOLEAN NOT NULL DEFAULT 0
            """)
            print("  ✅ two_factor_enabled eklendi")
        else:
            print("  ⏭️  two_factor_enabled zaten mevcut")

        # totp_secret kolonu yoksa ekle
        if 'totp_secret' not in columns:
            print("  ➕ totp_secret kolonu ekleniyor...")
            cursor.execute("""
                ALTER TABLE users
                ADD COLUMN totp_secret VARCHAR
            """)
            print("  ✅ totp_secret eklendi")
        else:
            print("  ⏭️  totp_secret zaten mevcut")

        # backup_codes kolonu yoksa ekle
        if 'backup_codes' not in columns:
            print("  ➕ backup_codes kolonu ekleniyor...")
            cursor.execute("""
                ALTER TABLE users
                ADD COLUMN backup_codes VARCHAR
            """)
            print("  ✅ backup_codes eklendi")
        else:
            print("  ⏭️  backup_codes zaten mevcut")

        # Değişiklikleri kaydet
        conn.commit()
        print("\n✅ 2FA migration başarıyla tamamlandı!")

        # Güncel tablo yapısını göster
        cursor.execute("PRAGMA table_info(users)")
        print("\n📋 Güncellenmiş users tablosu yapısı:")
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
        print("   Lütfen backend dizininden çalıştırın: python migrate_2fa.py")
        sys.exit(1)

    migrate_database()
