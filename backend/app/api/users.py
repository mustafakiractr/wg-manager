"""
Kullanıcı yönetimi API endpoint'leri
Kullanıcı ekleme, düzenleme, silme ve şifre değiştirme işlemleri
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, EmailStr, field_validator
from app.security.auth import get_current_user
from app.models.user import User
from app.database.database import get_db
from sqlalchemy import select
from passlib.context import CryptContext
from app.utils.activity_logger import log_user_action
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserCreate(BaseModel):
    """Yeni kullanıcı oluşturma modeli"""
    username: str
    email: Optional[EmailStr] = None
    password: str  # Min 6, max 72 karakter
    is_admin: bool = False
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Şifre en az 6 karakter olmalıdır')
        if len(v.encode('utf-8')) > 72:
            raise ValueError('Şifre en fazla 72 karakter olabilir')
        return v


class UserUpdate(BaseModel):
    """Kullanıcı güncelleme modeli"""
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    is_admin: Optional[bool] = None


class PasswordChange(BaseModel):
    """Şifre değiştirme modeli"""
    current_password: str
    new_password: str  # Min 6, max 72 karakter
    
    @field_validator('new_password')
    @classmethod
    def validate_new_password(cls, v):
        if len(v) < 6:
            raise ValueError('Şifre en az 6 karakter olmalıdır')
        if len(v.encode('utf-8')) > 72:
            raise ValueError('Şifre en fazla 72 karakter olabilir')
        return v


class PasswordChangeByAdmin(BaseModel):
    """Admin tarafından şifre değiştirme modeli"""
    new_password: str  # Min 6, max 72 karakter
    
    @field_validator('new_password')
    @classmethod
    def validate_new_password(cls, v):
        if len(v) < 6:
            raise ValueError('Şifre en az 6 karakter olmalıdır')
        if len(v.encode('utf-8')) > 72:
            raise ValueError('Şifre en fazla 72 karakter olabilir')
        return v


@router.get("/me")
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Mevcut kullanıcının profil bilgilerini döndürür
    """
    return {
        "success": True,
        "data": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "is_admin": current_user.is_admin,
            "avatar_url": current_user.avatar_url,
            "two_factor_enabled": current_user.two_factor_enabled,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
            "updated_at": current_user.updated_at.isoformat() if current_user.updated_at else None,
        }
    }


@router.put("/me")
async def update_current_user_profile(
    request: Request,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Mevcut kullanıcının profil bilgilerini günceller
    Admin durumunu değiştiremez (güvenlik)
    """
    try:
        # Admin durumunu değiştirmeye çalışıyorsa hata ver
        if user_data.is_admin is not None:
            raise HTTPException(
                status_code=403,
                detail="Kendi admin durumunuzu değiştiremezsiniz"
            )

        # Kullanıcı adı kontrolü (değiştiriliyorsa)
        if user_data.username and user_data.username != current_user.username:
            result = await db.execute(select(User).where(User.username == user_data.username))
            existing_user = result.scalar_one_or_none()
            if existing_user:
                raise HTTPException(status_code=400, detail="Bu kullanıcı adı zaten kullanılıyor")
            current_user.username = user_data.username

        # Email kontrolü (değiştiriliyorsa)
        if user_data.email is not None:
            if user_data.email and user_data.email != current_user.email:
                result = await db.execute(select(User).where(User.email == user_data.email))
                existing_email = result.scalar_one_or_none()
                if existing_email:
                    raise HTTPException(status_code=400, detail="Bu email adresi zaten kullanılıyor")
            current_user.email = user_data.email

        await db.commit()
        await db.refresh(current_user)

        logger.info(f"Kullanıcı profili güncellendi: {current_user.username} (ID: {current_user.id})")

        # Activity log
        await log_user_action(db, request, "update_profile", f"Kullanıcı '{current_user.username}' profil bilgilerini güncelledi", current_user, str(current_user.id))

        return {
            "success": True,
            "message": "Profil başarıyla güncellendi",
            "data": {
                "id": current_user.id,
                "username": current_user.username,
                "email": current_user.email,
                "is_admin": current_user.is_admin,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Profil güncelleme hatası: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Profil güncellenemedi: {str(e)}")


@router.post("/me/change-password")
async def change_own_password(
    request: Request,
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Mevcut kullanıcının kendi şifresini değiştirir
    """
    try:
        # Şifre uzunluk kontrolü
        if len(password_data.new_password) < 6:
            raise HTTPException(status_code=400, detail="Şifre en az 6 karakter olmalıdır")
        password_bytes = password_data.new_password.encode('utf-8')
        if len(password_bytes) > 72:
            raise HTTPException(status_code=400, detail="Şifre en fazla 72 byte olabilir")

        # Mevcut şifreyi kontrol et
        if not pwd_context.verify(password_data.current_password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Mevcut şifre yanlış")

        # Yeni şifreyi hash'le ve kaydet
        from app.security.auth import get_password_hash
        current_user.hashed_password = get_password_hash(password_data.new_password)
        await db.commit()

        logger.info(f"Kullanıcı şifresini değiştirdi: {current_user.username}")

        # Activity log
        await log_user_action(db, request, "change_password", f"Kullanıcı '{current_user.username}' şifresini değiştirdi", current_user, str(current_user.id))

        return {
            "success": True,
            "message": "Şifre başarıyla değiştirildi"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Şifre değiştirme hatası: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Şifre değiştirilemedi: {str(e)}")


@router.get("/")
async def get_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Tüm kullanıcıları listeler
    """
    try:
        result = await db.execute(select(User))
        users = result.scalars().all()
        
        # Şifreleri gizle
        users_data = []
        for user in users:
            users_data.append({
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "is_admin": user.is_admin,
                "created_at": user.created_at.isoformat() if user.created_at else None,
            })
        
        return {
            "success": True,
            "data": users_data
        }
    except Exception as e:
        logger.error(f"Kullanıcı listesi alınamadı: {e}")
        raise HTTPException(status_code=500, detail=f"Kullanıcı listesi alınamadı: {str(e)}")


@router.post("/")
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Yeni kullanıcı oluşturur
    Sadece admin kullanıcılar yeni kullanıcı oluşturabilir
    """
    try:
        # Sadece admin kullanıcılar yeni kullanıcı oluşturabilir
        if not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Bu işlem için admin yetkisi gereklidir")
        
        # Kullanıcı adı kontrolü
        result = await db.execute(select(User).where(User.username == user_data.username))
        existing_user = result.scalar_one_or_none()
        if existing_user:
            raise HTTPException(status_code=400, detail="Bu kullanıcı adı zaten kullanılıyor")
        
        # Email kontrolü (eğer email verilmişse)
        if user_data.email:
            result = await db.execute(select(User).where(User.email == user_data.email))
            existing_email = result.scalar_one_or_none()
            if existing_email:
                raise HTTPException(status_code=400, detail="Bu email adresi zaten kullanılıyor")
        
        # Şifre uzunluk kontrolü (min 6, max 72 byte)
        if len(user_data.password) < 6:
            raise HTTPException(status_code=400, detail="Şifre en az 6 karakter olmalıdır")
        password_bytes = user_data.password.encode('utf-8')
        if len(password_bytes) > 72:
            raise HTTPException(status_code=400, detail="Şifre en fazla 72 byte olabilir (yaklaşık 72 karakter)")
        
        # Yeni kullanıcı oluştur
        # Bcrypt için şifreyi güvenli şekilde hash'le
        # get_password_hash fonksiyonu zaten 72 byte kontrolü yapıyor
        from app.security.auth import get_password_hash
        hashed_password = get_password_hash(user_data.password)
        new_user = User(
            username=user_data.username,
            email=user_data.email,
            hashed_password=hashed_password,
            is_admin=user_data.is_admin
        )
        
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        
        logger.info(f"Yeni kullanıcı oluşturuldu: {new_user.username} (Admin: {new_user.is_admin})")
        
        return {
            "success": True,
            "message": "Kullanıcı başarıyla oluşturuldu",
            "data": {
                "id": new_user.id,
                "username": new_user.username,
                "email": new_user.email,
                "is_admin": new_user.is_admin,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Kullanıcı oluşturma hatası: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Kullanıcı oluşturulamadı: {str(e)}")


@router.put("/{user_id}")
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Kullanıcı bilgilerini günceller
    Sadece admin kullanıcılar diğer kullanıcıları güncelleyebilir
    Kullanıcılar kendi bilgilerini güncelleyebilir (admin durumu hariç)
    """
    try:
        # Kullanıcıyı bul
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        # Yetki kontrolü: Admin değilse sadece kendi bilgilerini güncelleyebilir
        if not current_user.is_admin and current_user.id != user_id:
            raise HTTPException(status_code=403, detail="Bu işlem için admin yetkisi gereklidir")
        
        # Admin durumunu sadece admin kullanıcılar değiştirebilir
        if user_data.is_admin is not None and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Admin durumunu değiştirmek için admin yetkisi gereklidir")
        
        # Kullanıcı adı kontrolü (değiştiriliyorsa)
        if user_data.username and user_data.username != user.username:
            result = await db.execute(select(User).where(User.username == user_data.username))
            existing_user = result.scalar_one_or_none()
            if existing_user:
                raise HTTPException(status_code=400, detail="Bu kullanıcı adı zaten kullanılıyor")
            user.username = user_data.username
        
        # Email kontrolü (değiştiriliyorsa)
        if user_data.email and user_data.email != user.email:
            result = await db.execute(select(User).where(User.email == user_data.email))
            existing_email = result.scalar_one_or_none()
            if existing_email:
                raise HTTPException(status_code=400, detail="Bu email adresi zaten kullanılıyor")
            user.email = user_data.email
        
        # Admin durumunu güncelle (sadece admin kullanıcılar)
        if user_data.is_admin is not None and current_user.is_admin:
            user.is_admin = user_data.is_admin
        
        await db.commit()
        await db.refresh(user)
        
        logger.info(f"Kullanıcı güncellendi: {user.username} (ID: {user_id})")
        
        return {
            "success": True,
            "message": "Kullanıcı başarıyla güncellendi",
            "data": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "is_admin": user.is_admin,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Kullanıcı güncelleme hatası: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Kullanıcı güncellenemedi: {str(e)}")


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Kullanıcıyı siler
    Sadece admin kullanıcılar kullanıcı silebilir
    Kullanıcılar kendilerini silemez
    """
    try:
        # Sadece admin kullanıcılar kullanıcı silebilir
        if not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Bu işlem için admin yetkisi gereklidir")
        
        # Kullanıcıyı bul
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        # Kullanıcı kendini silemez
        if current_user.id == user_id:
            raise HTTPException(status_code=400, detail="Kendi hesabınızı silemezsiniz")
        
        # Kullanıcıyı sil
        db.delete(user)  # session.delete() is synchronous in SQLAlchemy 2.0
        await db.commit()
        
        logger.info(f"Kullanıcı silindi: {user.username} (ID: {user_id})")
        
        return {
            "success": True,
            "message": "Kullanıcı başarıyla silindi"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Kullanıcı silme hatası: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Kullanıcı silinemedi: {str(e)}")


@router.post("/{user_id}/change-password")
async def change_password(
    user_id: int,
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Kullanıcı şifresini değiştirir
    Kullanıcılar kendi şifrelerini değiştirebilir (mevcut şifre gerekli)
    Admin kullanıcılar herhangi bir kullanıcının şifresini değiştirebilir (mevcut şifre gerekmez)
    """
    try:
        # Kullanıcıyı bul
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        # Yetki kontrolü
        is_own_account = current_user.id == user_id
        is_admin = current_user.is_admin
        
        if not is_own_account and not is_admin:
            raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")
        
        # Şifre uzunluk kontrolü (min 6, max 72 byte)
        if len(password_data.new_password) < 6:
            raise HTTPException(status_code=400, detail="Şifre en az 6 karakter olmalıdır")
        password_bytes = password_data.new_password.encode('utf-8')
        if len(password_bytes) > 72:
            raise HTTPException(status_code=400, detail="Şifre en fazla 72 byte olabilir (yaklaşık 72 karakter)")
        
        # Kendi şifresini değiştiriyorsa mevcut şifreyi kontrol et
        if is_own_account and not is_admin:
            if not pwd_context.verify(password_data.current_password, user.hashed_password):
                raise HTTPException(status_code=400, detail="Mevcut şifre yanlış")
        
        # Yeni şifreyi hash'le ve kaydet
        # get_password_hash fonksiyonu zaten 72 byte kontrolü yapıyor
        from app.security.auth import get_password_hash
        user.hashed_password = get_password_hash(password_data.new_password)
        await db.commit()
        await db.refresh(user)
        
        logger.info(f"Kullanıcı şifresi değiştirildi: {user.username} (ID: {user_id})")
        
        return {
            "success": True,
            "message": "Şifre başarıyla değiştirildi"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Şifre değiştirme hatası: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Şifre değiştirilemedi: {str(e)}")


@router.post("/{user_id}/change-password-admin")
async def change_password_by_admin(
    user_id: int,
    password_data: PasswordChangeByAdmin,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Admin tarafından kullanıcı şifresini değiştirir
    Sadece admin kullanıcılar bu işlemi yapabilir
    Mevcut şifre gerekmez
    """
    try:
        # Sadece admin kullanıcılar bu işlemi yapabilir
        if not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Bu işlem için admin yetkisi gereklidir")
        
        # Kullanıcıyı bul
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        # Şifre uzunluk kontrolü (min 6, max 72 byte)
        if len(password_data.new_password) < 6:
            raise HTTPException(status_code=400, detail="Şifre en az 6 karakter olmalıdır")
        password_bytes = password_data.new_password.encode('utf-8')
        if len(password_bytes) > 72:
            raise HTTPException(status_code=400, detail="Şifre en fazla 72 byte olabilir (yaklaşık 72 karakter)")
        
        # Yeni şifreyi hash'le ve kaydet
        # get_password_hash fonksiyonu zaten 72 byte kontrolü yapıyor
        from app.security.auth import get_password_hash
        user.hashed_password = get_password_hash(password_data.new_password)
        await db.commit()
        await db.refresh(user)
        
        logger.info(f"Admin tarafından kullanıcı şifresi değiştirildi: {user.username} (ID: {user_id})")
        
        return {
            "success": True,
            "message": "Şifre başarıyla değiştirildi"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Şifre değiştirme hatası: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Şifre değiştirilemedi: {str(e)}")

