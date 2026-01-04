"""
Pagination utility
API pagination için yardımcı fonksiyonlar ve sınıflar
"""
from typing import TypeVar, Generic, List
from pydantic import BaseModel, Field

T = TypeVar('T')


class PaginationParams(BaseModel):
    """
    API pagination parametreleri
    
    Usage:
        @router.get("/items")
        async def get_items(
            pagination: PaginationParams = Depends(),
            db: AsyncSession = Depends(get_db),
        ):
            ...
    """
    limit: int = Field(default=50, ge=1, le=500, description="Maksimum kayıt sayısı")
    offset: int = Field(default=0, ge=0, description="Başlangıç offset'i")
    
    @property
    def skip(self) -> int:
        """Offset alias (SQLAlchemy .offset() için)"""
        return self.offset


class PaginatedResponse(BaseModel, Generic[T]):
    """
    Paginated API yanıtı
    
    Generic type kullanımı:
        PaginatedResponse[ActivityLog]
        PaginatedResponse[Notification]
    """
    success: bool = True
    data: List[T]
    pagination: dict
    
    @classmethod
    def create(
        cls,
        data: List[T],
        total: int,
        limit: int,
        offset: int,
    ):
        """
        Paginated response oluştur
        
        Args:
            data: Sayfa verisi
            total: Toplam kayıt sayısı
            limit: Sayfa boyutu
            offset: Başlangıç offset'i
        """
        return cls(
            success=True,
            data=data,
            pagination={
                "total": total,
                "limit": limit,
                "offset": offset,
                "count": len(data),
                "has_next": (offset + len(data)) < total,
                "has_prev": offset > 0,
                "next_offset": offset + limit if (offset + len(data)) < total else None,
                "prev_offset": max(0, offset - limit) if offset > 0 else None,
            }
        )


def paginate_query(query, limit: int, offset: int):
    """
    SQLAlchemy query'sine pagination uygula
    
    Args:
        query: SQLAlchemy select() query
        limit: Sayfa boyutu (max 500)
        offset: Başlangıç offset'i
    
    Returns:
        Paginated query
    
    Example:
        query = select(User)
        query = paginate_query(query, limit=50, offset=0)
        result = await db.execute(query)
    """
    # Limit kontrolü (max 500)
    if limit > 500:
        limit = 500
    if limit < 1:
        limit = 1
    
    # Offset kontrolü
    if offset < 0:
        offset = 0
    
    return query.limit(limit).offset(offset)
