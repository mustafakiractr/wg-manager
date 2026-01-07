"""
Encryption/Decryption utilities
MikroTik şifrelerini güvenli şekilde saklamak için
"""
from cryptography.fernet import Fernet
from typing import Optional
import os
from pathlib import Path

# Encryption key - proje ana dizininde saklanacak (portable)
BACKEND_DIR = Path(__file__).parent.parent.parent  # /root/wg/backend
ENCRYPTION_KEY_FILE = BACKEND_DIR / ".encryption_key"

def get_or_create_key() -> bytes:
    """Encryption key'i döner veya yeni oluşturur"""
    if os.path.exists(ENCRYPTION_KEY_FILE):
        with open(ENCRYPTION_KEY_FILE, 'rb') as f:
            return f.read()
    else:
        key = Fernet.generate_key()
        with open(ENCRYPTION_KEY_FILE, 'wb') as f:
            f.write(key)
        os.chmod(ENCRYPTION_KEY_FILE, 0o600)  # Sadece owner okuyabilir
        return key

# Cipher instance
_cipher = None

def get_cipher() -> Fernet:
    """Cipher instance'ı döner (lazy initialization)"""
    global _cipher
    if _cipher is None:
        key = get_or_create_key()
        _cipher = Fernet(key)
    return _cipher

def encrypt_password(password: str) -> str:
    """
    Şifreyi şifreler
    Args:
        password: Plain text şifre
    Returns:
        Şifrelenmiş string
    """
    if not password:
        return ""
    cipher = get_cipher()
    encrypted = cipher.encrypt(password.encode())
    return encrypted.decode()

def decrypt_password(encrypted: str) -> str:
    """
    Şifreyi çözer
    Args:
        encrypted: Şifrelenmiş string
    Returns:
        Plain text şifre
    """
    if not encrypted:
        return ""
    cipher = get_cipher()
    decrypted = cipher.decrypt(encrypted.encode())
    return decrypted.decode()
