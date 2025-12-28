"""
Two-Factor Authentication (2FA) yardımcı fonksiyonları
TOTP (Time-based One-Time Password) ve yedek kod yönetimi
"""
import pyotp
import secrets
import json
import hashlib
from typing import List, Tuple
from io import BytesIO
import qrcode
import base64


def generate_totp_secret() -> str:
    """
    Yeni bir TOTP secret key üretir

    Returns:
        Base32 encoded secret key
    """
    return pyotp.random_base32()


def get_totp_uri(secret: str, username: str, issuer: str = "WireGuard Manager") -> str:
    """
    TOTP URI oluşturur (QR kod için)

    Args:
        secret: TOTP secret key
        username: Kullanıcı adı
        issuer: Uygulama adı

    Returns:
        otpauth:// URI string
    """
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=username, issuer_name=issuer)


def generate_qr_code(uri: str) -> str:
    """
    URI'den QR kod oluşturur ve base64 string döner

    Args:
        uri: TOTP URI

    Returns:
        Base64 encoded PNG image
    """
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(uri)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    # Image'ı BytesIO'ya kaydet ve base64'e çevir
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)

    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{img_base64}"


def verify_totp_code(secret: str, code: str, valid_window: int = 1) -> bool:
    """
    TOTP kodunu doğrular

    Args:
        secret: TOTP secret key
        code: Kullanıcının girdiği 6 haneli kod
        valid_window: Kaç zaman dilimi öncesi/sonrası kabul edilsin (varsayılan 1 = ±30 saniye)

    Returns:
        Kod geçerliyse True
    """
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=valid_window)


def generate_backup_codes(count: int = 10) -> Tuple[List[str], List[str]]:
    """
    Yedek kodlar üretir

    Args:
        count: Kaç adet kod üretilecek

    Returns:
        Tuple (plain_codes, hashed_codes)
        - plain_codes: Kullanıcıya gösterilecek kodlar
        - hashed_codes: Veritabanında saklanacak hash'ler
    """
    plain_codes = []
    hashed_codes = []

    for _ in range(count):
        # 8 karakterlik kod üret (xxxx-xxxx formatında)
        code = secrets.token_hex(4)
        formatted_code = f"{code[:4]}-{code[4:]}"
        plain_codes.append(formatted_code)

        # Hash'le ve sakla
        hashed = hashlib.sha256(formatted_code.encode()).hexdigest()
        hashed_codes.append(hashed)

    return plain_codes, hashed_codes


def verify_backup_code(code: str, hashed_codes_json: str) -> Tuple[bool, str]:
    """
    Yedek kodu doğrular ve kullanılmışsa listeden çıkarır

    Args:
        code: Kullanıcının girdiği yedek kod
        hashed_codes_json: JSON string olarak hash'lenmiş kodlar

    Returns:
        Tuple (is_valid, updated_json)
        - is_valid: Kod geçerliyse True
        - updated_json: Güncellenmiş kod listesi (kullanılan kod çıkarılmış)
    """
    try:
        hashed_codes = json.loads(hashed_codes_json)
    except (json.JSONDecodeError, TypeError):
        return False, hashed_codes_json

    # Girilen kodu hash'le
    code_hash = hashlib.sha256(code.encode()).hexdigest()

    # Hash listesinde var mı kontrol et
    if code_hash in hashed_codes:
        # Kullanılan kodu listeden çıkar
        hashed_codes.remove(code_hash)
        updated_json = json.dumps(hashed_codes)
        return True, updated_json

    return False, hashed_codes_json


def has_backup_codes(backup_codes_json: str) -> bool:
    """
    Kullanıcının kullanılabilir yedek kodu var mı kontrol eder

    Args:
        backup_codes_json: JSON string olarak hash'lenmiş kodlar

    Returns:
        Kullanılabilir kod varsa True
    """
    try:
        codes = json.loads(backup_codes_json)
        return len(codes) > 0
    except (json.JSONDecodeError, TypeError):
        return False
