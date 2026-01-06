"""
Backup Şifreleme Servisi
AES-256-GCM ile backup dosyalarını şifreler/çözer
"""
import os
import base64
import hashlib
import logging
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from typing import Tuple, Optional

logger = logging.getLogger(__name__)


class BackupEncryptionService:
    """
    Backup dosyalarını AES-256-GCM ile şifreler/çözer
    
    Özellikler:
    - AES-256-GCM şifreleme (authenticated encryption)
    - PBKDF2 ile key derivation (100,000 iterations)
    - Random salt ve nonce (IV) kullanımı
    - Integrity verification (GCM mode)
    """
    
    # Şifreleme sabitleri
    SALT_SIZE = 16  # 16 bytes = 128 bits
    NONCE_SIZE = 12  # 12 bytes = 96 bits (GCM için önerilen)
    KEY_SIZE = 32  # 32 bytes = 256 bits
    PBKDF2_ITERATIONS = 100000  # OWASP önerisi
    
    # Şifreli dosya formatı:
    # [SALT (16 bytes)][NONCE (12 bytes)][ENCRYPTED_DATA][AUTH_TAG (16 bytes)]
    # GCM mode authentication tag'ı otomatik ekler (son 16 byte)
    
    @staticmethod
    def derive_key(password: str, salt: bytes) -> bytes:
        """
        Şifreden AES-256 anahtarı türetir (PBKDF2)
        
        Args:
            password: Kullanıcı şifresi
            salt: Random salt (16 bytes)
        
        Returns:
            32 byte AES-256 anahtarı
        """
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=BackupEncryptionService.KEY_SIZE,
            salt=salt,
            iterations=BackupEncryptionService.PBKDF2_ITERATIONS,
        )
        key = kdf.derive(password.encode('utf-8'))
        return key
    
    @staticmethod
    def encrypt_file(input_path: str, output_path: str, password: str) -> dict:
        """
        Dosyayı AES-256-GCM ile şifreler
        
        Args:
            input_path: Şifrelenecek dosya yolu
            output_path: Şifreli dosya çıktı yolu
            password: Şifreleme şifresi
        
        Returns:
            {
                "success": bool,
                "encrypted_file": str,
                "original_size": int,
                "encrypted_size": int,
                "salt": str (base64),
                "algorithm": "AES-256-GCM"
            }
        
        Raises:
            FileNotFoundError: Input dosyası bulunamadı
            ValueError: Şifre boş
            Exception: Şifreleme hatası
        """
        try:
            # Validasyon
            if not os.path.exists(input_path):
                raise FileNotFoundError(f"Input dosyası bulunamadı: {input_path}")
            
            if not password or len(password.strip()) == 0:
                raise ValueError("Şifre boş olamaz")
            
            # Dosyayı oku
            with open(input_path, 'rb') as f:
                plaintext = f.read()
            
            original_size = len(plaintext)
            
            # Random salt ve nonce oluştur
            salt = os.urandom(BackupEncryptionService.SALT_SIZE)
            nonce = os.urandom(BackupEncryptionService.NONCE_SIZE)
            
            # Şifreden key türet
            key = BackupEncryptionService.derive_key(password, salt)
            
            # AES-GCM ile şifrele
            aesgcm = AESGCM(key)
            ciphertext = aesgcm.encrypt(nonce, plaintext, None)
            # ciphertext = encrypted_data + auth_tag (16 bytes)
            
            # Şifreli dosyayı yaz: [salt][nonce][ciphertext+tag]
            with open(output_path, 'wb') as f:
                f.write(salt)
                f.write(nonce)
                f.write(ciphertext)
            
            encrypted_size = os.path.getsize(output_path)
            
            logger.info(
                f"✅ Dosya şifrelendi: {os.path.basename(input_path)} "
                f"({original_size} → {encrypted_size} bytes)"
            )
            
            return {
                "success": True,
                "encrypted_file": output_path,
                "original_size": original_size,
                "encrypted_size": encrypted_size,
                "salt": base64.b64encode(salt).decode('utf-8'),
                "algorithm": "AES-256-GCM",
                "iterations": BackupEncryptionService.PBKDF2_ITERATIONS
            }
        
        except FileNotFoundError as e:
            logger.error(f"❌ Dosya bulunamadı: {e}")
            raise
        except ValueError as e:
            logger.error(f"❌ Validasyon hatası: {e}")
            raise
        except Exception as e:
            logger.error(f"❌ Şifreleme hatası: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise Exception(f"Şifreleme başarısız: {str(e)}")
    
    @staticmethod
    def decrypt_file(input_path: str, output_path: str, password: str) -> dict:
        """
        Şifreli dosyayı çözer
        
        Args:
            input_path: Şifreli dosya yolu
            output_path: Çözülmüş dosya çıktı yolu
            password: Şifre çözme şifresi
        
        Returns:
            {
                "success": bool,
                "decrypted_file": str,
                "encrypted_size": int,
                "decrypted_size": int
            }
        
        Raises:
            FileNotFoundError: Şifreli dosya bulunamadı
            ValueError: Şifre yanlış veya dosya bozuk
            Exception: Şifre çözme hatası
        """
        try:
            # Validasyon
            if not os.path.exists(input_path):
                raise FileNotFoundError(f"Şifreli dosya bulunamadı: {input_path}")
            
            if not password or len(password.strip()) == 0:
                raise ValueError("Şifre boş olamaz")
            
            # Şifreli dosyayı oku
            with open(input_path, 'rb') as f:
                encrypted_data = f.read()
            
            encrypted_size = len(encrypted_data)
            
            # Minimum boyut kontrolü
            min_size = BackupEncryptionService.SALT_SIZE + BackupEncryptionService.NONCE_SIZE + 16
            if encrypted_size < min_size:
                raise ValueError(
                    f"Dosya çok küçük veya bozuk (min {min_size} bytes, mevcut {encrypted_size} bytes)"
                )
            
            # Salt, nonce ve ciphertext'i ayır
            salt = encrypted_data[:BackupEncryptionService.SALT_SIZE]
            nonce = encrypted_data[
                BackupEncryptionService.SALT_SIZE:
                BackupEncryptionService.SALT_SIZE + BackupEncryptionService.NONCE_SIZE
            ]
            ciphertext = encrypted_data[
                BackupEncryptionService.SALT_SIZE + BackupEncryptionService.NONCE_SIZE:
            ]
            
            # Şifreden key türet
            key = BackupEncryptionService.derive_key(password, salt)
            
            # AES-GCM ile çöz
            try:
                aesgcm = AESGCM(key)
                plaintext = aesgcm.decrypt(nonce, ciphertext, None)
            except Exception as decrypt_error:
                # GCM authentication başarısız = yanlış şifre veya bozuk dosya
                logger.error(f"❌ Şifre çözme hatası: {decrypt_error}")
                raise ValueError(
                    "Şifre yanlış veya dosya bozuk (authentication failed)"
                )
            
            # Çözülmüş dosyayı yaz
            with open(output_path, 'wb') as f:
                f.write(plaintext)
            
            decrypted_size = len(plaintext)
            
            logger.info(
                f"✅ Dosya şifresi çözüldü: {os.path.basename(input_path)} "
                f"({encrypted_size} → {decrypted_size} bytes)"
            )
            
            return {
                "success": True,
                "decrypted_file": output_path,
                "encrypted_size": encrypted_size,
                "decrypted_size": decrypted_size
            }
        
        except FileNotFoundError as e:
            logger.error(f"❌ Dosya bulunamadı: {e}")
            raise
        except ValueError as e:
            logger.error(f"❌ Şifre çözme hatası: {e}")
            raise
        except Exception as e:
            logger.error(f"❌ Genel hata: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise Exception(f"Şifre çözme başarısız: {str(e)}")
    
    @staticmethod
    def verify_password(encrypted_file_path: str, password: str) -> bool:
        """
        Şifrenin doğru olup olmadığını kontrol eder (test decryption)
        
        Args:
            encrypted_file_path: Şifreli dosya yolu
            password: Test edilecek şifre
        
        Returns:
            True = şifre doğru, False = şifre yanlış
        """
        try:
            import tempfile
            
            # Geçici dosyaya çözmeyi dene
            with tempfile.NamedTemporaryFile(delete=True) as tmp:
                BackupEncryptionService.decrypt_file(
                    encrypted_file_path,
                    tmp.name,
                    password
                )
            return True
        except ValueError:
            # Authentication failed = yanlış şifre
            return False
        except Exception as e:
            logger.error(f"Şifre doğrulama hatası: {e}")
            return False
    
    @staticmethod
    def get_file_info(encrypted_file_path: str) -> dict:
        """
        Şifreli dosya hakkında bilgi verir (şifre çözmeden)
        
        Args:
            encrypted_file_path: Şifreli dosya yolu
        
        Returns:
            {
                "encrypted_size": int,
                "algorithm": "AES-256-GCM",
                "has_salt": bool,
                "has_nonce": bool,
                "estimated_original_size": int
            }
        """
        try:
            if not os.path.exists(encrypted_file_path):
                raise FileNotFoundError(f"Dosya bulunamadı: {encrypted_file_path}")
            
            file_size = os.path.getsize(encrypted_file_path)
            
            # Minimum boyut kontrolü
            min_size = BackupEncryptionService.SALT_SIZE + BackupEncryptionService.NONCE_SIZE + 16
            has_valid_format = file_size >= min_size
            
            # Tahmini orijinal boyut (salt + nonce + auth_tag çıkar)
            overhead = BackupEncryptionService.SALT_SIZE + BackupEncryptionService.NONCE_SIZE + 16
            estimated_size = max(0, file_size - overhead)
            
            return {
                "encrypted_size": file_size,
                "algorithm": "AES-256-GCM",
                "has_valid_format": has_valid_format,
                "has_salt": file_size >= BackupEncryptionService.SALT_SIZE,
                "has_nonce": file_size >= BackupEncryptionService.SALT_SIZE + BackupEncryptionService.NONCE_SIZE,
                "estimated_original_size": estimated_size,
                "overhead_bytes": overhead
            }
        
        except Exception as e:
            logger.error(f"Dosya bilgisi alınamadı: {e}")
            raise
