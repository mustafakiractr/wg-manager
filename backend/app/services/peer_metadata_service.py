"""
Peer Metadata Service
Peer metadata yönetimi için iş mantığı
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from app.models.peer_metadata import PeerMetadata
from typing import Optional, List, Dict, Any
import logging
import json

logger = logging.getLogger(__name__)


class PeerMetadataService:
    """Peer metadata yönetim servisi"""

    @staticmethod
    async def get_or_create_metadata(
        db: AsyncSession,
        peer_id: str,
        interface_name: str,
        public_key: Optional[str] = None
    ) -> PeerMetadata:
        """
        Peer metadata'sını getirir, yoksa oluşturur

        Args:
            db: Database session
            peer_id: Peer ID
            interface_name: Interface adı
            public_key: Public key (opsiyonel)

        Returns:
            PeerMetadata objesi
        """
        # Önce var olanı kontrol et
        result = await db.execute(
            select(PeerMetadata).where(
                and_(
                    PeerMetadata.peer_id == peer_id,
                    PeerMetadata.interface_name == interface_name
                )
            )
        )
        metadata = result.scalar_one_or_none()

        if not metadata:
            # Yoksa oluştur
            metadata = PeerMetadata(
                peer_id=peer_id,
                interface_name=interface_name,
                public_key=public_key
            )
            db.add(metadata)
            await db.commit()
            await db.refresh(metadata)
            logger.info(f"Peer metadata oluşturuldu: {peer_id}")

        return metadata

    @staticmethod
    async def update_metadata(
        db: AsyncSession,
        peer_id: str,
        interface_name: str,
        group_name: Optional[str] = None,
        group_color: Optional[str] = None,
        tags: Optional[str] = None,
        notes: Optional[str] = None,
        custom_fields: Optional[Dict] = None
    ) -> PeerMetadata:
        """
        Peer metadata'sını günceller

        Args:
            db: Database session
            peer_id: Peer ID
            interface_name: Interface adı
            group_name: Grup adı
            group_color: Grup rengi
            tags: Etiketler (virgülle ayrılmış)
            notes: Notlar
            custom_fields: Özel alanlar (dict)

        Returns:
            Güncellenmiş PeerMetadata objesi
        """
        metadata = await PeerMetadataService.get_or_create_metadata(
            db, peer_id, interface_name
        )

        # Güncelleme
        if group_name is not None:
            metadata.group_name = group_name
        if group_color is not None:
            metadata.group_color = group_color
        if tags is not None:
            metadata.tags = tags
        if notes is not None:
            metadata.notes = notes
        if custom_fields is not None:
            metadata.custom_fields = json.dumps(custom_fields)

        await db.commit()
        await db.refresh(metadata)

        logger.info(f"Peer metadata güncellendi: {peer_id}")
        return metadata

    @staticmethod
    async def get_metadata(
        db: AsyncSession,
        peer_id: str,
        interface_name: str
    ) -> Optional[PeerMetadata]:
        """Peer metadata'sını getirir"""
        result = await db.execute(
            select(PeerMetadata).where(
                and_(
                    PeerMetadata.peer_id == peer_id,
                    PeerMetadata.interface_name == interface_name
                )
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_all_metadata(
        db: AsyncSession,
        interface_name: Optional[str] = None,
        group_name: Optional[str] = None
    ) -> List[PeerMetadata]:
        """
        Tüm peer metadata'larını getirir

        Args:
            db: Database session
            interface_name: Interface'e göre filtrele (opsiyonel)
            group_name: Gruba göre filtrele (opsiyonel)

        Returns:
            PeerMetadata listesi
        """
        query = select(PeerMetadata)

        if interface_name:
            query = query.where(PeerMetadata.interface_name == interface_name)
        if group_name:
            query = query.where(PeerMetadata.group_name == group_name)

        query = query.order_by(PeerMetadata.created_at.desc())

        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_all_groups(db: AsyncSession) -> List[Dict[str, Any]]:
        """
        Tüm grupları ve peer sayılarını getirir

        Returns:
            Grup bilgileri listesi
        """
        result = await db.execute(
            select(
                PeerMetadata.group_name,
                PeerMetadata.group_color
            ).where(
                PeerMetadata.group_name.isnot(None)
            ).distinct()
        )

        groups = []
        for row in result.fetchall():
            group_name, group_color = row

            # Bu gruptaki peer sayısını say
            count_result = await db.execute(
                select(PeerMetadata).where(
                    PeerMetadata.group_name == group_name
                )
            )
            peer_count = len(count_result.scalars().all())

            groups.append({
                'name': group_name,
                'color': group_color or '#6B7280',  # Default gray
                'peer_count': peer_count
            })

        return groups

    @staticmethod
    async def delete_metadata(
        db: AsyncSession,
        peer_id: str,
        interface_name: str
    ) -> bool:
        """
        Peer metadata'sını siler

        Args:
            db: Database session
            peer_id: Peer ID
            interface_name: Interface adı

        Returns:
            Başarılı ise True
        """
        metadata = await PeerMetadataService.get_metadata(db, peer_id, interface_name)
        if not metadata:
            return False

        db.delete(metadata)  # session.delete() is synchronous in SQLAlchemy 2.0
        await db.commit()

        logger.info(f"Peer metadata silindi: {peer_id}")
        return True

    @staticmethod
    async def bulk_update_group(
        db: AsyncSession,
        peer_ids: List[tuple],  # List of (peer_id, interface_name) tuples
        group_name: str,
        group_color: Optional[str] = None
    ) -> int:
        """
        Birden fazla peer'ın grubunu günceller

        Args:
            db: Database session
            peer_ids: (peer_id, interface_name) tuple listesi
            group_name: Grup adı
            group_color: Grup rengi

        Returns:
            Güncellenen peer sayısı
        """
        count = 0
        for peer_id, interface_name in peer_ids:
            try:
                await PeerMetadataService.update_metadata(
                    db, peer_id, interface_name,
                    group_name=group_name,
                    group_color=group_color
                )
                count += 1
            except Exception as e:
                logger.error(f"Peer metadata güncelleme hatası ({peer_id}): {e}")

        logger.info(f"{count} peer'ın grubu güncellendi: {group_name}")
        return count
