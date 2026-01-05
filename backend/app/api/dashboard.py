"""
Dashboard API
Genel bakış istatistikleri ve dashboard için endpoint'ler
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from datetime import datetime, timedelta
from app.utils.datetime_helper import utcnow
from typing import Dict, Any, List
import logging

from app.database.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.ip_pool import IPPool, IPAllocation
from app.models.peer_template import PeerTemplate
from app.models.activity_log import ActivityLog
from app.services.ip_pool_service import IPPoolService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/dashboard/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Dashboard genel istatistikleri

    Returns:
        - Toplam IP Pool sayısı
        - Toplam tahsis edilmiş IP sayısı
        - Toplam kullanılabilir IP sayısı
        - IP Pool kullanım yüzdesi
        - Toplam Peer Template sayısı
        - En çok kullanılan template
        - Toplam kullanıcı sayısı
        - Son 24 saatteki aktivite sayısı
    """
    try:
        stats = {}

        # IP Pool istatistikleri
        pools = await IPPoolService.get_pools(db)
        total_pools = len(pools)
        total_ips = 0
        allocated_ips = 0

        for pool in pools:
            pool_stats = await IPPoolService.get_pool_stats(db, pool.id)
            total_ips += pool_stats.get('total_ips', 0)
            allocated_ips += pool_stats.get('allocated', 0)

        available_ips = total_ips - allocated_ips
        ip_usage_percent = (allocated_ips / total_ips * 100) if total_ips > 0 else 0

        stats['ip_pool'] = {
            'total_pools': total_pools,
            'total_ips': total_ips,
            'allocated_ips': allocated_ips,
            'available_ips': available_ips,
            'usage_percent': round(ip_usage_percent, 2)
        }

        # Peer Template istatistikleri
        result = await db.execute(select(func.count(PeerTemplate.id)))
        total_templates = result.scalar() or 0

        # En çok kullanılan template
        result = await db.execute(
            select(PeerTemplate)
            .order_by(desc(PeerTemplate.usage_count))
            .limit(1)
        )
        most_used_template = result.scalar_one_or_none()

        stats['templates'] = {
            'total_templates': total_templates,
            'most_used_template': {
                'name': most_used_template.name if most_used_template else None,
                'usage_count': most_used_template.usage_count if most_used_template else 0
            } if most_used_template else None
        }

        # Kullanıcı istatistikleri
        result = await db.execute(select(func.count(User.id)))
        total_users = result.scalar() or 0

        result = await db.execute(
            select(func.count(User.id)).where(User.is_active == True)
        )
        active_users = result.scalar() or 0

        stats['users'] = {
            'total_users': total_users,
            'active_users': active_users
        }

        # Aktivite istatistikleri (son 24 saat)
        twenty_four_hours_ago = utcnow() - timedelta(hours=24)
        result = await db.execute(
            select(func.count(ActivityLog.id)).where(
                ActivityLog.created_at >= twenty_four_hours_ago
            )
        )
        activities_24h = result.scalar() or 0

        stats['activity'] = {
            'last_24h': activities_24h
        }

        return {
            'success': True,
            'data': stats
        }

    except Exception as e:
        logger.error(f"Dashboard stats error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/ip-pool-usage")
async def get_ip_pool_usage(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Tüm IP Pool'ların kullanım detayları

    Returns:
        Her pool için: isim, toplam IP, tahsis edilmiş IP, kullanılabilir IP, yüzde
    """
    try:
        pools = await IPPoolService.get_pools(db, is_active=True)
        usage_data = []

        for pool in pools:
            pool_stats = await IPPoolService.get_pool_stats(db, pool.id)
            usage_data.append({
                'pool_id': pool.id,
                'pool_name': pool.name,
                'interface_name': pool.interface_name,
                'subnet': pool.subnet,
                'total_ips': pool_stats.get('total_ips', 0),
                'allocated': pool_stats.get('allocated', 0),
                'available': pool_stats.get('available', 0),
                'usage_percent': pool_stats.get('usage_percent', 0)
            })

        return {
            'success': True,
            'data': usage_data
        }

    except Exception as e:
        logger.error(f"IP Pool usage error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/recent-activities")
async def get_recent_activities(
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Son aktiviteleri listeler

    Args:
        limit: Kaç aktivite getirilecek (default: 10)

    Returns:
        Son aktiviteler listesi
    """
    try:
        result = await db.execute(
            select(ActivityLog)
            .order_by(desc(ActivityLog.created_at))
            .limit(limit)
        )
        activities = result.scalars().all()

        activity_list = []
        for activity in activities:
            activity_list.append({
                'id': activity.id,
                'user_id': activity.user_id,
                'username': activity.username,
                'action': activity.action,
                'category': activity.category,
                'description': activity.description,
                'target_type': activity.target_type,
                'target_id': activity.target_id,
                'ip_address': activity.ip_address,
                'created_at': activity.created_at.isoformat() if activity.created_at else None,
                'success': activity.success
            })

        return {
            'success': True,
            'data': activity_list
        }

    except Exception as e:
        logger.error(f"Recent activities error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/template-stats")
async def get_template_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Peer Template kullanım istatistikleri

    Returns:
        Her template için: isim, kullanım sayısı, son kullanım tarihi
    """
    try:
        result = await db.execute(
            select(PeerTemplate)
            .order_by(desc(PeerTemplate.usage_count))
        )
        templates = result.scalars().all()

        template_stats = []
        for template in templates:
            template_stats.append({
                'id': template.id,
                'name': template.name,
                'usage_count': template.usage_count,
                'last_used_at': template.last_used_at.isoformat() if template.last_used_at else None,
                'is_active': template.is_active
            })

        return {
            'success': True,
            'data': template_stats
        }

    except Exception as e:
        logger.error(f"Template stats error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/peer-groups")
async def get_peer_group_distribution(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Peer grup dağılımı istatistikleri

    Returns:
        Gruplara göre peer sayıları
    """
    try:
        from app.models.peer_metadata import PeerMetadata

        # Grup dağılımını hesapla
        result = await db.execute(
            select(PeerMetadata.group_name, func.count(PeerMetadata.id).label('count'))
            .group_by(PeerMetadata.group_name)
        )
        group_counts = result.all()

        distribution = []
        no_group_count = 0

        for group_name, count in group_counts:
            if group_name and group_name.strip():
                distribution.append({
                    'group_name': group_name,
                    'count': count
                })
            else:
                no_group_count += count

        # Grubu olmayan peer'ları da ekle
        if no_group_count > 0:
            distribution.append({
                'group_name': 'Grupsuz',
                'count': no_group_count
            })

        # Sayıya göre sırala
        distribution.sort(key=lambda x: x['count'], reverse=True)

        return {
            'success': True,
            'data': distribution
        }

    except Exception as e:
        logger.error(f"Peer group distribution error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/expiring-peers")
async def get_expiring_peers(
    days: int = 7,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Süresi dolacak ve dolmuş peer'ları listeler

    Args:
        days: Kaç gün içinde süresi dolacak peer'lar (default: 7)

    Returns:
        Süresi dolacak/dolmuş peer listesi
    """
    try:
        from app.models.peer_metadata import PeerMetadata

        now = utcnow()
        future_date = now + timedelta(days=days)

        # Süresi dolmuş peer'lar
        result_expired = await db.execute(
            select(PeerMetadata)
            .where(
                and_(
                    PeerMetadata.expires_at.isnot(None),
                    PeerMetadata.expires_at < now
                )
            )
            .order_by(PeerMetadata.expires_at)
        )
        expired_peers = result_expired.scalars().all()

        # Süresi dolacak peer'lar (önümüzdeki X gün)
        result_expiring = await db.execute(
            select(PeerMetadata)
            .where(
                and_(
                    PeerMetadata.expires_at.isnot(None),
                    PeerMetadata.expires_at >= now,
                    PeerMetadata.expires_at <= future_date
                )
            )
            .order_by(PeerMetadata.expires_at)
        )
        expiring_peers = result_expiring.scalars().all()

        def peer_to_dict(peer, status):
            return {
                'peer_id': peer.peer_id,
                'public_key': peer.public_key,
                'interface_name': peer.interface_name,
                'group_name': peer.group_name,
                'expires_at': peer.expires_at.isoformat() if peer.expires_at else None,
                'status': status
            }

        expired_list = [peer_to_dict(p, 'expired') for p in expired_peers]
        expiring_list = [peer_to_dict(p, 'expiring') for p in expiring_peers]

        return {
            'success': True,
            'data': {
                'expired': expired_list,
                'expiring': expiring_list,
                'expired_count': len(expired_list),
                'expiring_count': len(expiring_list),
                'total': len(expired_list) + len(expiring_list)
            }
        }

    except Exception as e:
        logger.error(f"Expiring peers error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
