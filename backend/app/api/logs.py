"""
Log API endpoint'leri
Sistem log kayıtlarını görüntüleme
"""
from fastapi import APIRouter, Depends, Query
from typing import List
from app.security.auth import get_current_user
from app.models.user import User
from app.database.database import get_db
from app.services.log_service import get_logs
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()


class LogEntryResponse(BaseModel):
    """Log kayıt yanıt modeli"""
    id: int
    username: str
    action: str
    details: str | None
    ip_address: str | None
    created_at: datetime
    
    class Config:
        from_attributes = True


@router.get("/logs")
async def get_log_entries(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    username: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Log kayıtlarını listeler
    """
    logs = await get_logs(db, limit=limit, offset=offset, username=username)
    
    return {
        "success": True,
        "data": [LogEntryResponse.model_validate(log) for log in logs],
        "limit": limit,
        "offset": offset
    }


