"""
Activity Log Service
Aktivite log kayıtlarını oluşturma ve sorgulama servisi
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_
from app.models.activity_log import ActivityLog
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import logging
import json

logger = logging.getLogger(__name__)


class ActivityLogService:
    """Aktivite log işlemleri için servis sınıfı"""

    @staticmethod
    async def log_activity(
        db: AsyncSession,
        action: str,
        category: str,
        description: str,
        user_id: Optional[int] = None,
        username: Optional[str] = None,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        extra_data: Optional[Dict[str, Any]] = None,
        success: str = 'success',
        error_message: Optional[str] = None,
    ) -> ActivityLog:
        """
        Yeni aktivite log kaydı oluştur

        Args:
            db: Database session
            action: Aksiyon adı (örn: 'login', 'create_peer')
            category: Kategori (örn: 'auth', 'wireguard')
            description: İnsan okunabilir açıklama
            user_id: Kullanıcı ID (opsiyonel)
            username: Kullanıcı adı (opsiyonel)
            target_type: Hedef nesne tipi (opsiyonel)
            target_id: Hedef nesne ID (opsiyonel)
            ip_address: İstek IP adresi (opsiyonel)
            user_agent: User agent string (opsiyonel)
            extra_data: Ek bilgiler (opsiyonel, dict)
            success: Sonuç durumu ('success', 'failure', 'error')
            error_message: Hata mesajı (opsiyonel)

        Returns:
            ActivityLog: Oluşturulan log kaydı
        """
        try:
            # Extra data'yı JSON'a çevir
            extra_data_json = json.dumps(extra_data) if extra_data else None

            log_entry = ActivityLog(
                user_id=user_id,
                username=username,
                action=action,
                category=category,
                description=description,
                target_type=target_type,
                target_id=target_id,
                ip_address=ip_address,
                user_agent=user_agent,
                extra_data=extra_data_json,
                success=success,
                error_message=error_message,
            )

            db.add(log_entry)
            await db.commit()
            await db.refresh(log_entry)

            logger.info(f"Activity logged: {action} by {username or 'system'}")
            return log_entry

        except Exception as e:
            logger.error(f"Failed to log activity: {e}")
            await db.rollback()
            raise

    @staticmethod
    async def get_logs(
        db: AsyncSession,
        limit: int = 50,
        offset: int = 0,
        user_id: Optional[int] = None,
        category: Optional[str] = None,
        action: Optional[str] = None,
        success: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """
        Aktivite loglarını getir (filtreleme ile)

        Args:
            db: Database session
            limit: Maksimum kayıt sayısı
            offset: Başlangıç offset'i
            user_id: Kullanıcıya göre filtrele (opsiyonel)
            category: Kategoriye göre filtrele (opsiyonel)
            action: Aksiyona göre filtrele (opsiyonel)
            success: Sonuca göre filtrele (opsiyonel)
            start_date: Başlangıç tarihi (opsiyonel)
            end_date: Bitiş tarihi (opsiyonel)

        Returns:
            List[Dict]: Log kayıtları
        """
        try:
            # Base query
            query = select(ActivityLog)

            # Filtreler
            conditions = []

            if user_id:
                conditions.append(ActivityLog.user_id == user_id)

            if category:
                conditions.append(ActivityLog.category == category)

            if action:
                conditions.append(ActivityLog.action == action)

            if success:
                conditions.append(ActivityLog.success == success)

            if start_date:
                conditions.append(ActivityLog.created_at >= start_date)

            if end_date:
                conditions.append(ActivityLog.created_at <= end_date)

            # Filtreleri uygula
            if conditions:
                query = query.where(and_(*conditions))

            # Sıralama ve limit
            query = query.order_by(desc(ActivityLog.created_at)).limit(limit).offset(offset)

            result = await db.execute(query)
            logs = result.scalars().all()

            return [log.to_dict() for log in logs]

        except Exception as e:
            logger.error(f"Failed to get activity logs: {e}")
            raise

    @staticmethod
    async def get_log_count(
        db: AsyncSession,
        user_id: Optional[int] = None,
        category: Optional[str] = None,
        action: Optional[str] = None,
        success: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> int:
        """
        Aktivite log sayısını getir (filtreleme ile)

        Returns:
            int: Toplam log sayısı
        """
        try:
            query = select(ActivityLog)

            # Filtreler
            conditions = []

            if user_id:
                conditions.append(ActivityLog.user_id == user_id)

            if category:
                conditions.append(ActivityLog.category == category)

            if action:
                conditions.append(ActivityLog.action == action)

            if success:
                conditions.append(ActivityLog.success == success)

            if start_date:
                conditions.append(ActivityLog.created_at >= start_date)

            if end_date:
                conditions.append(ActivityLog.created_at <= end_date)

            if conditions:
                query = query.where(and_(*conditions))

            result = await db.execute(query)
            logs = result.scalars().all()

            return len(logs)

        except Exception as e:
            logger.error(f"Failed to count activity logs: {e}")
            raise

    @staticmethod
    async def get_recent_activity(
        db: AsyncSession,
        limit: int = 10,
        hours: int = 24,
    ) -> List[Dict[str, Any]]:
        """
        Son X saatteki aktiviteleri getir

        Args:
            db: Database session
            limit: Maksimum kayıt sayısı
            hours: Kaç saat geriye git

        Returns:
            List[Dict]: Son aktiviteler
        """
        try:
            start_date = datetime.utcnow() - timedelta(hours=hours)

            query = (
                select(ActivityLog)
                .where(ActivityLog.created_at >= start_date)
                .order_by(desc(ActivityLog.created_at))
                .limit(limit)
            )

            result = await db.execute(query)
            logs = result.scalars().all()

            return [log.to_dict() for log in logs]

        except Exception as e:
            logger.error(f"Failed to get recent activity: {e}")
            raise

    @staticmethod
    async def cleanup_old_logs(
        db: AsyncSession,
        days: int = 90,
    ) -> int:
        """
        Eski logları temizle (opsiyonel bakım işlemi)

        Args:
            db: Database session
            days: Kaç günden eski logları sil

        Returns:
            int: Silinen kayıt sayısı
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)

            query = select(ActivityLog).where(ActivityLog.created_at < cutoff_date)
            result = await db.execute(query)
            old_logs = result.scalars().all()

            count = len(old_logs)

            for log in old_logs:
                db.delete(log)  # session.delete() is synchronous in SQLAlchemy 2.0

            await db.commit()

            logger.info(f"Cleaned up {count} old activity logs (older than {days} days)")
            return count

        except Exception as e:
            logger.error(f"Failed to cleanup old logs: {e}")
            await db.rollback()
            raise
