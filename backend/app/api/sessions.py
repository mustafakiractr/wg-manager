"""
Session management API endpoint'leri
Kullanıcı oturumlarını listeleme, iptal etme
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.database.database import get_db
from app.models.user import User
from app.models.session import Session
from app.security.auth import get_current_user
from app.security.session_manager import (
    get_active_sessions,
    revoke_session,
    revoke_all_user_sessions
)
from app.utils.ip_helper import get_client_ip

router = APIRouter()


async def get_current_session(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Optional[Session]:
    """
    İstekteki Authorization header ve kullanıcı bilgisinden mevcut session'ı bulur
    """
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "Unknown")

    # Kullanıcının aktif session'larını al
    sessions = await get_active_sessions(db, current_user.id)

    # IP ve user agent match olan en son session'ı bul
    for session in sessions:
        if session.ip_address == client_ip and session.user_agent == user_agent:
            return session

    # Bulunamazsa, en son güncellenen session'ı döndür (fallback)
    if sessions:
        return sessions[0]

    return None


# ============================================================================
# Response Models
# ============================================================================

class SessionResponse(BaseModel):
    """Session bilgisi yanıtı"""
    id: int
    device_name: str
    device_type: str
    ip_address: str
    location: str | None
    is_current: bool
    created_at: datetime
    last_activity: datetime
    expires_at: datetime


class SessionListResponse(BaseModel):
    """Session listesi yanıtı"""
    sessions: List[SessionResponse]
    total: int


class RevokeSessionRequest(BaseModel):
    """Session iptal isteği"""
    session_id: int


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/sessions", response_model=SessionListResponse)
async def get_user_sessions(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Kullanıcının aktif session'larını listeler
    """
    sessions = await get_active_sessions(db, current_user.id)

    # Mevcut session'ı belirle
    current_session = await get_current_session(request, db, current_user)
    current_session_id = current_session.id if current_session else None

    session_list = [
        SessionResponse(
            id=session.id,
            device_name=session.device_name or "Unknown Device",
            device_type=session.device_type or "unknown",
            ip_address=session.ip_address or "Unknown",
            location=session.location,
            is_current=(session.id == current_session_id),
            created_at=session.created_at,
            last_activity=session.last_activity,
            expires_at=session.expires_at
        )
        for session in sessions
    ]

    return SessionListResponse(
        sessions=session_list,
        total=len(session_list)
    )


@router.post("/sessions/revoke")
async def revoke_user_session(
    data: RevokeSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Belirli bir session'ı iptal eder
    """
    # Session kullanıcıya ait mi kontrol et
    sessions = await get_active_sessions(db, current_user.id)
    session_ids = [s.id for s in sessions]

    if data.session_id not in session_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session bulunamadı"
        )

    await revoke_session(db, data.session_id, reason="user_revoke")

    return {"success": True, "message": "Session iptal edildi"}


@router.post("/sessions/revoke-all")
async def revoke_all_sessions(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Kullanıcının tüm session'larını iptal eder (mevcut hariç)
    """
    # Mevcut session'ı belirle ve koru
    current_session = await get_current_session(request, db, current_user)
    current_session_id = current_session.id if current_session else None

    await revoke_all_user_sessions(
        db,
        current_user.id,
        except_session_id=current_session_id,
        reason="user_revoke_all"
    )

    return {"success": True, "message": "Tüm session'lar iptal edildi"}


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Session'ı siler (revoke ile aynı, farklı HTTP method)
    """
    # Session kullanıcıya ait mi kontrol et
    sessions = await get_active_sessions(db, current_user.id)
    session_ids = [s.id for s in sessions]

    if session_id not in session_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session bulunamadı"
        )

    await revoke_session(db, session_id, reason="user_delete")

    return {"success": True, "message": "Session silindi"}
