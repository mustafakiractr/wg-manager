"""
Avatar upload ve yönetimi API endpoint'leri
Kullanıcı profil fotoğrafı yükleme, silme ve gösterme
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any
from pathlib import Path
import os
import uuid
import shutil
from PIL import Image
import logging

from app.security.auth import get_current_user
from app.models.user import User
from app.database.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()

# Avatar ayarları
AVATAR_DIR = Path("/root/wg/backend/static/avatars")
AVATAR_DIR.mkdir(parents=True, exist_ok=True)
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
AVATAR_SIZE = (200, 200)  # Thumbnail boyutu


def validate_image(file: UploadFile) -> bool:
    """
    Yüklenen dosyanın geçerli bir görsel olup olmadığını kontrol eder
    """
    # Dosya uzantısı kontrolü
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Geçersiz dosya tipi. İzin verilen: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Content-type kontrolü
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Dosya bir görsel olmalıdır")

    return True


def generate_filename(user_id: int, extension: str) -> str:
    """
    Benzersiz dosya adı oluşturur
    """
    unique_id = uuid.uuid4().hex[:8]
    return f"user_{user_id}_{unique_id}{extension}"


def delete_old_avatar(user_id: int) -> None:
    """
    Kullanıcının eski avatar dosyalarını siler
    """
    try:
        for file_path in AVATAR_DIR.glob(f"user_{user_id}_*"):
            if file_path.is_file():
                file_path.unlink()
                logger.info(f"Eski avatar silindi: {file_path.name}")
    except Exception as e:
        logger.warning(f"Eski avatar silinirken hata: {e}")


@router.post("/upload")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Kullanıcı profil fotoğrafı yükler

    - Maksimum dosya boyutu: 5MB
    - İzin verilen formatlar: JPG, PNG, GIF, WebP
    - Otomatik resize: 200x200px
    """
    try:
        # Dosya doğrulama
        validate_image(file)

        # Dosya boyutu kontrolü
        contents = await file.read()
        file_size = len(contents)

        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"Dosya çok büyük. Maksimum: {MAX_FILE_SIZE / 1024 / 1024}MB"
            )

        # Eski avatar'ı sil
        delete_old_avatar(current_user.id)

        # Yeni dosya adı oluştur
        file_ext = Path(file.filename).suffix.lower()
        new_filename = generate_filename(current_user.id, file_ext)
        file_path = AVATAR_DIR / new_filename

        # Geçici dosyayı kaydet
        temp_path = file_path.with_suffix(file_ext + ".tmp")
        with open(temp_path, "wb") as f:
            f.write(contents)

        # Görseli yükle ve resize et
        try:
            with Image.open(temp_path) as img:
                # EXIF orientation düzelt
                if hasattr(img, '_getexif') and img._getexif():
                    from PIL import ImageOps
                    img = ImageOps.exif_transpose(img)

                # RGB'ye çevir (PNG transparency için)
                if img.mode in ('RGBA', 'LA', 'P'):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')

                # Thumbnail oluştur (aspect ratio korunur)
                img.thumbnail(AVATAR_SIZE, Image.Resampling.LANCZOS)

                # Kaydet
                img.save(file_path, 'JPEG', quality=85, optimize=True)

        except Exception as e:
            # Geçici dosyayı temizle
            if temp_path.exists():
                temp_path.unlink()
            raise HTTPException(status_code=400, detail=f"Görsel işlenemedi: {str(e)}")

        # Geçici dosyayı temizle
        if temp_path.exists():
            temp_path.unlink()

        # Veritabanını güncelle
        avatar_url = f"/api/v1/avatar/{new_filename}"
        current_user.avatar_url = avatar_url
        await db.commit()
        await db.refresh(current_user)

        logger.info(f"Avatar yüklendi: {current_user.username} -> {new_filename}")

        return {
            "success": True,
            "message": "Profil fotoğrafı başarıyla yüklendi",
            "data": {
                "avatar_url": avatar_url
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Avatar yükleme hatası: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Avatar yüklenemedi: {str(e)}")


@router.delete("/")
async def delete_avatar(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Kullanıcının profil fotoğrafını siler
    """
    try:
        if not current_user.avatar_url:
            raise HTTPException(status_code=404, detail="Profil fotoğrafı bulunamadı")

        # Dosyayı sil
        delete_old_avatar(current_user.id)

        # Veritabanını güncelle
        current_user.avatar_url = None
        await db.commit()

        logger.info(f"Avatar silindi: {current_user.username}")

        return {
            "success": True,
            "message": "Profil fotoğrafı başarıyla silindi"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Avatar silme hatası: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Avatar silinemedi: {str(e)}")


@router.get("/{filename}")
async def get_avatar(filename: str):
    """
    Avatar dosyasını serve eder
    """
    file_path = AVATAR_DIR / filename

    if not file_path.exists() or not file_path.is_file():
        # Default avatar döndür (eğer varsa)
        default_avatar = AVATAR_DIR / "default.jpg"
        if default_avatar.exists():
            return FileResponse(default_avatar, media_type="image/jpeg")
        raise HTTPException(status_code=404, detail="Avatar bulunamadı")

    # Güvenlik: Directory traversal önlemi
    if not str(file_path.resolve()).startswith(str(AVATAR_DIR.resolve())):
        raise HTTPException(status_code=403, detail="Erişim reddedildi")

    return FileResponse(file_path, media_type="image/jpeg")
