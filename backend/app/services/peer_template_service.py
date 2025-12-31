"""
Peer Template Service
Peer şablonları yönetimi için iş mantığı
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc
from app.models.peer_template import PeerTemplate
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.utils.datetime_helper import utcnow
import logging

logger = logging.getLogger(__name__)


class PeerTemplateService:
    """Peer template yönetim servisi"""

    @staticmethod
    async def create_template(
        db: AsyncSession,
        name: str,
        description: Optional[str] = None,
        allowed_address: Optional[str] = "auto",
        endpoint_address: Optional[str] = None,
        endpoint_port: Optional[int] = None,
        persistent_keepalive: Optional[int] = 0,
        preshared_key: Optional[str] = None,
        group_name: Optional[str] = None,
        group_color: Optional[str] = None,
        tags: Optional[str] = None,
        notes_template: Optional[str] = None
    ) -> PeerTemplate:
        """
        Yeni peer şablonu oluşturur

        Args:
            db: Database session
            name: Şablon adı
            description: Şablon açıklaması
            allowed_address: IP adresi veya "auto"
            endpoint_address: Endpoint adresi
            endpoint_port: Endpoint portu
            persistent_keepalive: Keepalive süresi
            preshared_key: Preshared key flag
            group_name: Varsayılan grup
            group_color: Varsayılan grup rengi
            tags: Varsayılan etiketler
            notes_template: Not şablonu

        Returns:
            Oluşturulan PeerTemplate objesi
        """
        # Aynı isimde şablon var mı kontrol et
        existing = await db.execute(
            select(PeerTemplate).where(PeerTemplate.name == name)
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"'{name}' isimli şablon zaten mevcut")

        template = PeerTemplate(
            name=name,
            description=description,
            allowed_address=allowed_address,
            endpoint_address=endpoint_address,
            endpoint_port=endpoint_port,
            persistent_keepalive=persistent_keepalive,
            preshared_key=preshared_key,
            group_name=group_name,
            group_color=group_color,
            tags=tags,
            notes_template=notes_template
        )

        db.add(template)
        await db.flush()  # ID almak için flush yap, commit get_db() dependency'sinde yapılacak
        await db.refresh(template)

        logger.info(f"Peer şablonu oluşturuldu: {name}")
        return template

    @staticmethod
    async def get_template(db: AsyncSession, template_id: int) -> Optional[PeerTemplate]:
        """Şablon ID'sine göre şablonu getirir"""
        result = await db.execute(
            select(PeerTemplate).where(PeerTemplate.id == template_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_template_by_name(db: AsyncSession, name: str) -> Optional[PeerTemplate]:
        """Şablon adına göre şablonu getirir"""
        result = await db.execute(
            select(PeerTemplate).where(PeerTemplate.name == name)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_all_templates(
        db: AsyncSession,
        is_active: Optional[bool] = None
    ) -> List[PeerTemplate]:
        """
        Tüm şablonları getirir

        Args:
            db: Database session
            is_active: Aktif/pasif filtreleme (opsiyonel)

        Returns:
            PeerTemplate listesi
        """
        query = select(PeerTemplate)

        if is_active is not None:
            query = query.where(PeerTemplate.is_active == is_active)

        # Kullanım sayısına göre sırala (en çok kullanılanlar önce)
        query = query.order_by(desc(PeerTemplate.usage_count), desc(PeerTemplate.created_at))

        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def update_template(
        db: AsyncSession,
        template_id: int,
        **update_data
    ) -> PeerTemplate:
        """
        Şablon bilgilerini günceller

        Args:
            db: Database session
            template_id: Şablon ID
            **update_data: Güncellenecek alanlar

        Returns:
            Güncellenmiş PeerTemplate objesi
        """
        template = await PeerTemplateService.get_template(db, template_id)
        if not template:
            raise ValueError(f"Şablon bulunamadı: ID {template_id}")

        # Güncelle
        for key, value in update_data.items():
            if hasattr(template, key) and value is not None:
                setattr(template, key, value)

        await db.flush()  # Değişiklikleri flush et, commit get_db() dependency'sinde yapılacak
        await db.refresh(template)

        logger.info(f"Peer şablonu güncellendi: {template.name}")
        return template

    @staticmethod
    async def delete_template(db: AsyncSession, template_id: int) -> bool:
        """
        Şablonu siler

        Args:
            db: Database session
            template_id: Şablon ID

        Returns:
            Başarılı ise True
        """
        template = await PeerTemplateService.get_template(db, template_id)
        if not template:
            return False

        await db.delete(template)
        # Commit işlemi get_db() dependency'sinde yapılacak

        logger.info(f"Peer şablonu silindi: {template.name}")
        return True

    @staticmethod
    async def increment_usage(db: AsyncSession, template_id: int) -> None:
        """
        Şablonun kullanım sayısını artırır ve son kullanım zamanını günceller

        Args:
            db: Database session
            template_id: Şablon ID
        """
        template = await PeerTemplateService.get_template(db, template_id)
        if template:
            template.usage_count = (template.usage_count or 0) + 1
            template.last_used_at = utcnow()
            # Commit get_db() dependency'sinde yapılacak

    @staticmethod
    async def toggle_active(db: AsyncSession, template_id: int) -> PeerTemplate:
        """
        Şablonun aktif/pasif durumunu değiştirir

        Args:
            db: Database session
            template_id: Şablon ID

        Returns:
            Güncellenmiş PeerTemplate objesi
        """
        template = await PeerTemplateService.get_template(db, template_id)
        if not template:
            raise ValueError(f"Şablon bulunamadı: ID {template_id}")

        template.is_active = not template.is_active
        await db.flush()  # Değişiklikleri flush et, commit get_db() dependency'sinde yapılacak
        await db.refresh(template)

        logger.info(f"Peer şablonu durumu değiştirildi: {template.name} -> {'aktif' if template.is_active else 'pasif'}")
        return template

    @staticmethod
    def prepare_peer_data_from_template(
        template: PeerTemplate,
        override_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Şablondan peer verisi hazırlar

        Args:
            template: PeerTemplate objesi
            override_data: Üzerine yazılacak veriler (opsiyonel)

        Returns:
            Peer oluşturma için hazır veri dict'i
        """
        peer_data = {}

        # Template'ten verileri al
        if template.allowed_address:
            peer_data['allowed_address'] = template.allowed_address
        if template.endpoint_address:
            peer_data['endpoint_address'] = template.endpoint_address
        if template.endpoint_port:
            peer_data['endpoint_port'] = template.endpoint_port
        if template.persistent_keepalive is not None:
            peer_data['persistent_keepalive'] = template.persistent_keepalive
        if template.preshared_key:
            peer_data['preshared_key'] = template.preshared_key

        # Metadata
        metadata = {}
        if template.group_name:
            metadata['group_name'] = template.group_name
        if template.group_color:
            metadata['group_color'] = template.group_color
        if template.tags:
            metadata['tags'] = template.tags

        # Not şablonunu işle (değişkenleri değiştir)
        if template.notes_template:
            notes = template.notes_template
            notes = notes.replace('{date}', datetime.now().strftime('%Y-%m-%d'))
            notes = notes.replace('{datetime}', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
            metadata['notes'] = notes

        if metadata:
            peer_data['metadata'] = metadata

        # Override data ile üzerine yaz
        if override_data:
            peer_data.update(override_data)

        return peer_data
