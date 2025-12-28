"""
Güvenli SECRET_KEY oluşturma scripti
Kriptografik olarak güvenli random key üretir
"""
import secrets
import os

def generate_secret_key():
    """64 karakterlik güvenli hex key oluştur"""
    return secrets.token_hex(32)

def update_env_file():
    """
    .env dosyasındaki SECRET_KEY'i günceller
    """
    env_path = os.path.join(os.path.dirname(__file__), '.env')

    # Yeni key oluştur
    new_key = generate_secret_key()

    # .env dosyasını oku
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            lines = f.readlines()

        # SECRET_KEY satırını bul ve güncelle
        updated = False
        for i, line in enumerate(lines):
            if line.startswith('SECRET_KEY='):
                lines[i] = f'SECRET_KEY="{new_key}"\n'
                updated = True
                break

        # Eğer SECRET_KEY yoksa ekle
        if not updated:
            lines.append(f'SECRET_KEY="{new_key}"\n')

        # Dosyaya yaz
        with open(env_path, 'w') as f:
            f.writelines(lines)

        print("✅ SECRET_KEY başarıyla güncellendi!")
        print(f"📝 Yeni key: {new_key[:20]}...{new_key[-20:]}")
        print(f"📁 Dosya: {env_path}")
    else:
        print(f"❌ .env dosyası bulunamadı: {env_path}")
        print(f"💡 Yeni key oluşturuldu: {new_key}")
        print("Bu key'i .env dosyanıza SECRET_KEY değişkeni olarak ekleyin.")

if __name__ == '__main__':
    update_env_file()
