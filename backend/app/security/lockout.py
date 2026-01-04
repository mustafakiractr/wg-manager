"""
Account lockout yardımcı fonksiyonları
Brute-force saldırılarına karşı hesap kilitleme
"""
from datetime import datetime, timedelta
from typing import Tuple, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update
from app.models.user import User
from app.config import settings
from app.utils.datetime_helper import utcnow
import logging

logger = logging.getLogger(__name__)

# Telegram bildirimi için lazy import
_telegram_service = None

def get_telegram_service():
    """Telegram service'i lazy import eder"""
    global _telegram_service
    if _telegram_service is None:
        from app.services.telegram_notification_service import TelegramNotificationService
        _telegram_service = TelegramNotificationService
    return _telegram_service


def is_account_locked(user: User) -> Tuple[bool, Optional[datetime]]:
    """
    Hesap kilitli mi kontrol eder

    Args:
        user: User modeli

    Returns:
        Tuple (is_locked, locked_until)
    """
    if not user.locked_until:
        return False, None

    # Lock süresi doldu mu?
    now = utcnow()
    if user.locked_until > now:
        return True, user.locked_until

    # Süre dolduysa kilitli değil
    return False, None


async def record_failed_login(db: AsyncSession, user: User) -> Tuple[bool, Optional[datetime]]:
    """
    Başarısız login denemesini kaydeder
    Gerekirse hesabı kilitler

    Args:
        db: Database session
        user: User modeli

    Returns:
        Tuple (is_now_locked, locked_until)
    """
    now = utcnow()

    # Başarısız deneme sayısını artır
    new_attempts = user.failed_login_attempts + 1

    # Maksimum denemeyi aştı mı?
    if new_attempts >= settings.MAX_FAILED_LOGIN_ATTEMPTS:
        # Hesabı kilitle
        locked_until = now + timedelta(minutes=settings.ACCOUNT_LOCKOUT_DURATION_MINUTES)

        await db.execute(
            update(User)
            .where(User.id == user.id)
            .values(
                failed_login_attempts=new_attempts,
                last_failed_login=now,
                locked_until=locked_until
            )
        )
        await db.commit()
        
        # Telegram bildirimi gönder (async, non-blocking)
        try:
            TelegramService = get_telegram_service()
            await TelegramService.send_critical_event(
                db=db,
                event_type="login_failed",
                title="🔒 Hesap Kilitlendi",
                description=f"**{user.username}** hesabı çok fazla başarısız giriş denemesi nedeniyle kilitlendi",
                details=f"Başarısız deneme sayısı: {new_attempts}\nKilitlenme süresi: {settings.ACCOUNT_LOCKOUT_DURATION_MINUTES} dakika\nKilit açılma zamanı: {locked_until.strftime('%Y-%m-%d %H:%M:%S')}"
            )
            logger.info(f"Telegram bildirimi gönderildi: login_failed - {user.username}")
        except Exception as telegram_error:
            # Telegram hatası lockout işlemini etkilemez
            logger.error(f"Telegram bildirimi gönderilemedi: {telegram_error}")

        return True, locked_until
    else:
        # Sadece sayacı artır
        await db.execute(
            update(User)
            .where(User.id == user.id)
            .values(
                failed_login_attempts=new_attempts,
                last_failed_login=now
            )
        )
        await db.commit()

        return False, None


async def reset_failed_login_attempts(db: AsyncSession, user: User):
    """
    Başarılı login sonrası başarısız deneme sayacını sıfırlar

    Args:
        db: Database session
        user: User modeli
    """
    await db.execute(
        update(User)
        .where(User.id == user.id)
        .values(
            failed_login_attempts=0,
            locked_until=None,
            last_failed_login=None
        )
    )
    await db.commit()


async def unlock_account(db: AsyncSession, user: User):
    """
    Hesabın kilidini manuel olarak açar (admin işlemi)

    Args:
        db: Database session
        user: User modeli
    """
    await db.execute(
        update(User)
        .where(User.id == user.id)
        .values(
            failed_login_attempts=0,
            locked_until=None,
            last_failed_login=None
        )
    )
    await db.commit()


def get_remaining_lockout_time(user: User) -> Optional[int]:
    """
    Kalan kilitleme süresini dakika cinsinden döner

    Args:
        user: User modeli

    Returns:
        Kalan süre (dakika) veya None
    """
    if not user.locked_until:
        return None

    now = utcnow()
    if user.locked_until <= now:
        return None

    remaining = user.locked_until - now
    return int(remaining.total_seconds() / 60) + 1  # Yukarı yuvarla
