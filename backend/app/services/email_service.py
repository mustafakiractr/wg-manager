"""
Email gönderim servisi
SMTP ile email gönderme ve template yönetimi
"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.email_settings import EmailSettings, EmailLog
from app.utils.crypto import encrypt_password, decrypt_password

logger = logging.getLogger(__name__)


class EmailService:
    """Email gönderim ve yönetim servisi"""
    
    @staticmethod
    async def get_settings(db: AsyncSession) -> Optional[EmailSettings]:
        """Email ayarlarını getir"""
        result = await db.execute(select(EmailSettings).where(EmailSettings.id == 1))
        return result.scalar_one_or_none()
    
    @staticmethod
    async def save_settings(
        db: AsyncSession,
        smtp_host: str,
        smtp_port: int,
        smtp_username: str,
        smtp_password: str,
        from_email: str,
        from_name: str = "WireGuard Manager",
        smtp_use_tls: bool = True,
        smtp_use_ssl: bool = False,
        enabled: bool = False,
        recipient_emails: Optional[str] = None,
        **notification_prefs
    ) -> EmailSettings:
        """Email ayarlarını kaydet"""
        settings = await EmailService.get_settings(db)
        
        # Şifreyi encrypt et
        encrypted_password = encrypt_password(smtp_password)
        
        if settings:
            # Güncelle
            settings.smtp_host = smtp_host
            settings.smtp_port = smtp_port
            settings.smtp_username = smtp_username
            settings.smtp_password = encrypted_password
            settings.smtp_use_tls = smtp_use_tls
            settings.smtp_use_ssl = smtp_use_ssl
            settings.from_email = from_email
            settings.from_name = from_name
            settings.enabled = enabled
            settings.recipient_emails = recipient_emails
            settings.updated_at = datetime.utcnow()
            
            # Notification tercihleri
            for key, value in notification_prefs.items():
                if hasattr(settings, key):
                    setattr(settings, key, value)
        else:
            # Yeni oluştur
            settings = EmailSettings(
                smtp_host=smtp_host,
                smtp_port=smtp_port,
                smtp_username=smtp_username,
                smtp_password=encrypted_password,
                smtp_use_tls=smtp_use_tls,
                smtp_use_ssl=smtp_use_ssl,
                from_email=from_email,
                from_name=from_name,
                enabled=enabled,
                recipient_emails=recipient_emails,
                **notification_prefs
            )
            db.add(settings)
        
        await db.flush()
        return settings
    
    @staticmethod
    async def send_email(
        db: AsyncSession,
        to_email: str,
        subject: str,
        html_body: str,
        event_type: Optional[str] = None,
        event_data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Email gönder
        
        Args:
            db: Database session
            to_email: Alıcı email
            subject: Email başlığı
            html_body: HTML içerik
            event_type: Olay tipi (log için)
            event_data: Olay verisi (log için)
        
        Returns:
            bool: Başarılı ise True
        """
        settings = await EmailService.get_settings(db)
        
        if not settings or not settings.enabled:
            logger.warning("Email ayarları bulunamadı veya kapalı")
            return False
        
        try:
            # SMTP bağlantısı oluştur
            smtp_password = decrypt_password(settings.smtp_password)
            
            # Email mesajı oluştur
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{settings.from_name} <{settings.from_email}>"
            msg['To'] = to_email
            
            # HTML kısmı ekle
            html_part = MIMEText(html_body, 'html')
            msg.attach(html_part)
            
            # SMTP ile gönder
            if settings.smtp_use_ssl:
                server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port)
            else:
                server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
                if settings.smtp_use_tls:
                    server.starttls()
            
            server.login(settings.smtp_username, smtp_password)
            server.send_message(msg)
            server.quit()
            
            # Log kaydet
            email_log = EmailLog(
                recipient=to_email,
                subject=subject,
                status="sent",
                event_type=event_type,
                event_data=str(event_data) if event_data else None,
                sent_at=datetime.utcnow()
            )
            db.add(email_log)
            await db.flush()
            
            logger.info(f"✅ Email gönderildi: {to_email} - {subject}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Email gönderme hatası: {e}")
            
            # Hata log kaydet
            email_log = EmailLog(
                recipient=to_email,
                subject=subject,
                status="failed",
                error_message=str(e),
                event_type=event_type,
                sent_at=datetime.utcnow()
            )
            db.add(email_log)
            await db.flush()
            
            return False
    
    @staticmethod
    async def send_test_email(db: AsyncSession, test_email: str) -> Dict[str, Any]:
        """Test email gönder"""
        html_body = """
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #2563eb;">🎉 Email Ayarları Test Başarılı!</h2>
            <p>Bu bir test emailidir.</p>
            <p><strong>WireGuard Manager</strong> email servisi doğru çalışıyor.</p>
            <hr>
            <p style="color: #666; font-size: 12px;">
                Bu email otomatik olarak gönderilmiştir.
            </p>
        </body>
        </html>
        """
        
        success = await EmailService.send_email(
            db=db,
            to_email=test_email,
            subject="WireGuard Manager - Test Email",
            html_body=html_body,
            event_type="test_email"
        )
        
        # Test sonucunu kaydet
        settings = await EmailService.get_settings(db)
        if settings:
            settings.last_test_sent = datetime.utcnow()
            settings.last_test_status = "success" if success else "failed"
            await db.flush()
        
        return {
            "success": success,
            "message": "Test email başarıyla gönderildi" if success else "Test email gönderilemedi"
        }
    
    @staticmethod
    def get_email_template(template_name: str, **kwargs) -> str:
        """Email template'lerini döndür"""
        templates = {
            "backup_success": """
            <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #10b981;">✅ Backup Başarılı</h2>
                <p>Backup işlemi başarıyla tamamlandı.</p>
                <ul>
                    <li><strong>Dosya:</strong> {filename}</li>
                    <li><strong>Boyut:</strong> {size}</li>
                    <li><strong>Tarih:</strong> {date}</li>
                </ul>
                <p>Backup dosyası güvenli şekilde kaydedildi.</p>
            </body>
            </html>
            """,
            
            "backup_failure": """
            <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #ef4444;">❌ Backup Başarısız</h2>
                <p>Backup işlemi sırasında hata oluştu.</p>
                <ul>
                    <li><strong>Hata:</strong> {error}</li>
                    <li><strong>Tarih:</strong> {date}</li>
                </ul>
                <p>Lütfen sistem loglarını kontrol edin.</p>
            </body>
            </html>
            """,
            
            "peer_added": """
            <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #2563eb;">🆕 Yeni Peer Eklendi</h2>
                <p>Sisteme yeni bir peer eklendi.</p>
                <ul>
                    <li><strong>Peer Adı:</strong> {peer_name}</li>
                    <li><strong>Interface:</strong> {interface}</li>
                    <li><strong>IP:</strong> {ip_address}</li>
                    <li><strong>Tarih:</strong> {date}</li>
                </ul>
            </body>
            </html>
            """,
            
            "peer_deleted": """
            <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #f59e0b;">🗑️ Peer Silindi</h2>
                <p>Sistemden bir peer silindi.</p>
                <ul>
                    <li><strong>Peer Adı:</strong> {peer_name}</li>
                    <li><strong>Interface:</strong> {interface}</li>
                    <li><strong>Tarih:</strong> {date}</li>
                </ul>
            </body>
            </html>
            """,
            
            "system_alert": """
            <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #dc2626;">⚠️ Sistem Uyarısı</h2>
                <p><strong>{alert_title}</strong></p>
                <p>{alert_message}</p>
                <ul>
                    <li><strong>Tarih:</strong> {date}</li>
                </ul>
            </body>
            </html>
            """
        }
        
        template = templates.get(template_name, "<p>{message}</p>")
        return template.format(**kwargs)
    
    @staticmethod
    async def send_notification(
        db: AsyncSession,
        event_type: str,
        subject: str,
        template_data: Dict[str, Any]
    ) -> bool:
        """
        Notification email gönder
        
        Args:
            db: Database session
            event_type: Olay tipi (backup_success, peer_added, vb.)
            subject: Email başlığı
            template_data: Template verileri
        
        Returns:
            bool: Başarılı ise True
        """
        settings = await EmailService.get_settings(db)
        
        if not settings or not settings.enabled or not settings.recipient_emails:
            return False
        
        # Event type için notification açık mı kontrol et
        notification_enabled = False
        if event_type == "backup_success" and settings.notify_backup_success:
            notification_enabled = True
        elif event_type == "backup_failure" and settings.notify_backup_failure:
            notification_enabled = True
        elif event_type == "peer_added" and settings.notify_peer_added:
            notification_enabled = True
        elif event_type == "peer_deleted" and settings.notify_peer_deleted:
            notification_enabled = True
        elif event_type == "system_alert" and settings.notify_system_alerts:
            notification_enabled = True
        
        if not notification_enabled:
            logger.debug(f"Notification disabled for event: {event_type}")
            return False
        
        # Template oluştur
        html_body = EmailService.get_email_template(event_type, **template_data)
        
        # Tüm alıcılara gönder
        recipients = [email.strip() for email in settings.recipient_emails.split(",") if email.strip()]
        
        success_count = 0
        for recipient in recipients:
            if await EmailService.send_email(db, recipient, subject, html_body, event_type, template_data):
                success_count += 1
        
        return success_count > 0
