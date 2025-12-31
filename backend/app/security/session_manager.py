"""
Session management yardımcı fonksiyonları
Multi-device session tracking ve yönetimi
"""
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_
from app.models.session import Session
from app.models.user import User
from app.config import settings
from app.utils.datetime_helper import utcnow, utc_timestamp
import secrets
import hashlib
from user_agents import parse


def generate_session_token() -> str:
    """
    Güvenli session token üretir

    Returns:
        Unique session token
    """
    # 32 byte random + timestamp
    random_part = secrets.token_urlsafe(32)
    timestamp = str(utcnow().timestamp())
    combined = f"{random_part}_{timestamp}"

    # SHA256 hash
    return hashlib.sha256(combined.encode()).hexdigest()


def parse_user_agent(user_agent_string: str) -> Dict[str, str]:
    """
    User agent string'i parse eder

    Args:
        user_agent_string: HTTP User-Agent header

    Returns:
        Dict with device info
    """
    ua = parse(user_agent_string)

    # Device type
    if ua.is_mobile:
        device_type = "mobile"
    elif ua.is_tablet:
        device_type = "tablet"
    elif ua.is_pc:
        device_type = "desktop"
    else:
        device_type = "unknown"

    # Device name
    browser = f"{ua.browser.family} {ua.browser.version_string}".strip()
    os = f"{ua.os.family} {ua.os.version_string}".strip()
    device_name = f"{browser} on {os}"

    return {
        "device_name": device_name,
        "device_type": device_type,
        "browser": ua.browser.family,
        "os": ua.os.family,
    }


async def create_session(
    db: AsyncSession,
    user_id: int,
    ip_address: str,
    user_agent: str,
    remember_me: bool = False,
    refresh_token: Optional[str] = None
) -> Session:
    """
    Yeni session oluşturur

    Args:
        db: Database session
        user_id: User ID
        ip_address: Client IP
        user_agent: User agent string
        remember_me: Extended session?
        refresh_token: Refresh token (opsiyonel)

    Returns:
        Session modeli
    """
    # Session token üret
    session_token = generate_session_token()

    # User agent parse
    device_info = parse_user_agent(user_agent)

    # Expiration time
    if remember_me:
        expires_at = utcnow() + timedelta(days=settings.SESSION_REMEMBER_ME_DAYS)
    else:
        expires_at = utcnow() + timedelta(minutes=settings.SESSION_EXPIRE_MINUTES)

    # Session oluştur
    new_session = Session(
        user_id=user_id,
        session_token=session_token,
        refresh_token=refresh_token,
        device_name=device_info["device_name"],
        device_type=device_info["device_type"],
        user_agent=user_agent,
        ip_address=ip_address,
        is_active=True,
        remember_me=remember_me,
        expires_at=expires_at,
    )

    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)

    # Maksimum session sayısını kontrol et
    await cleanup_old_sessions(db, user_id)

    return new_session


async def get_session_by_token(db: AsyncSession, session_token: str) -> Optional[Session]:
    """
    Token ile session bulur

    Args:
        db: Database session
        session_token: Session token

    Returns:
        Session modeli veya None
    """
    result = await db.execute(
        select(Session).where(
            and_(
                Session.session_token == session_token,
                Session.is_active == True
            )
        )
    )
    return result.scalar_one_or_none()


async def update_session_activity(db: AsyncSession, session_id: int):
    """
    Session'ın last_activity zamanını günceller

    Args:
        db: Database session
        session_id: Session ID
    """
    await db.execute(
        update(Session)
        .where(Session.id == session_id)
        .values(last_activity=utcnow())
    )
    await db.commit()


async def revoke_session(
    db: AsyncSession,
    session_id: int,
    reason: str = "user_logout"
):
    """
    Session'ı iptal eder

    Args:
        db: Database session
        session_id: Session ID
        reason: Revoke nedeni
    """
    await db.execute(
        update(Session)
        .where(Session.id == session_id)
        .values(
            is_active=False,
            revoked_at=utcnow(),
            revoked_reason=reason
        )
    )
    await db.commit()


async def revoke_all_user_sessions(
    db: AsyncSession,
    user_id: int,
    except_session_id: Optional[int] = None,
    reason: str = "user_logout_all"
):
    """
    Kullanıcının tüm session'larını iptal eder

    Args:
        db: Database session
        user_id: User ID
        except_session_id: Bu session hariç (current session)
        reason: Revoke nedeni
    """
    query = update(Session).where(Session.user_id == user_id)

    if except_session_id:
        query = query.where(Session.id != except_session_id)

    await db.execute(
        query.values(
            is_active=False,
            revoked_at=utcnow(),
            revoked_reason=reason
        )
    )
    await db.commit()


async def get_active_sessions(db: AsyncSession, user_id: int) -> List[Session]:
    """
    Kullanıcının aktif session'larını döner

    Args:
        db: Database session
        user_id: User ID

    Returns:
        Session listesi
    """
    result = await db.execute(
        select(Session)
        .where(
            and_(
                Session.user_id == user_id,
                Session.is_active == True,
                Session.expires_at > utcnow()
            )
        )
        .order_by(Session.last_activity.desc())
    )
    return result.scalars().all()


async def cleanup_old_sessions(db: AsyncSession, user_id: int):
    """
    Eski ve expired session'ları temizler
    Maksimum session sayısını aşarsa en eski'leri siler

    Args:
        db: Database session
        user_id: User ID
    """
    # Expired session'ları deaktive et
    await db.execute(
        update(Session)
        .where(
            and_(
                Session.user_id == user_id,
                Session.expires_at <= utcnow(),
                Session.is_active == True
            )
        )
        .values(
            is_active=False,
            revoked_at=utcnow(),
            revoked_reason="expired"
        )
    )

    # Aktif session'ları al
    active_sessions = await get_active_sessions(db, user_id)

    # Maksimum sayıyı aşıyorsa en eskileri sil
    if len(active_sessions) > settings.MAX_ACTIVE_SESSIONS_PER_USER:
        sessions_to_remove = active_sessions[settings.MAX_ACTIVE_SESSIONS_PER_USER:]
        for session in sessions_to_remove:
            await revoke_session(db, session.id, reason="max_sessions_exceeded")

    await db.commit()


async def cleanup_all_expired_sessions(db: AsyncSession):
    """
    Tüm expired session'ları temizler (cronjob için)

    Args:
        db: Database session
    """
    await db.execute(
        update(Session)
        .where(
            and_(
                Session.expires_at <= utcnow(),
                Session.is_active == True
            )
        )
        .values(
            is_active=False,
            revoked_at=utcnow(),
            revoked_reason="expired"
        )
    )
    await db.commit()
