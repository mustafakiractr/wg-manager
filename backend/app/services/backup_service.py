"""
Backup Service
Database ve configuration backup/restore işlemleri
"""
import os
import shutil
import json
import subprocess
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging
from app.config import settings

logger = logging.getLogger(__name__)


class BackupService:
    """Backup ve restore işlemlerini yöneten servis"""

    def __init__(self, backup_dir: str = None):
        """
        Args:
            backup_dir: Backup dosyalarının saklanacağı dizin
        """
        if backup_dir is None:
            # Varsayılan: backend/backups/
            base_dir = Path(__file__).parent.parent.parent
            backup_dir = base_dir / "backups"

        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(parents=True, exist_ok=True)

        # Database path ve type'ı belirle
        database_url = settings.DATABASE_URL
        self.is_postgresql = database_url.startswith("postgresql")
        
        if self.is_postgresql:
            # PostgreSQL kullanılıyor
            self.db_type = "postgresql"
            # PostgreSQL connection bilgilerini parse et
            # postgresql+asyncpg://user:pass@host/dbname
            import re
            match = re.match(r'postgresql(?:\+\w+)?://([^:]+):([^@]+)@([^/]+)/(\w+)', database_url)
            if match:
                self.pg_user = match.group(1)
                self.pg_password = match.group(2)
                self.pg_host = match.group(3)
                self.pg_database = match.group(4)
            else:
                logger.warning(f"PostgreSQL URL parse edilemedi: {database_url}")
                self.pg_user = "postgres"
                self.pg_database = "wg_manager"
                self.pg_host = "localhost"
                self.pg_password = ""
            self.db_path = None
        else:
            # SQLite kullanılıyor
            self.db_type = "sqlite"
            self.db_path = Path(__file__).parent.parent.parent / "router_manager.db"
            
            # Eğer SQLite dosyası yoksa ama database_url'de belirtilmişse, onu kullan
            if not self.db_path.exists():
                # sqlite:///./router_manager.db formatından dosya yolunu al
                if database_url.startswith("sqlite"):
                    db_file = database_url.replace("sqlite:///", "").replace("./", "")
                    potential_path = Path(__file__).parent.parent.parent / db_file
                    if potential_path.exists():
                        self.db_path = potential_path

        logger.info(f"📁 Backup dizini: {self.backup_dir}")
        logger.info(f"💾 Database tipi: {self.db_type}")
        if self.db_type == "sqlite":
            logger.info(f"💾 Database path: {self.db_path}")
            logger.info(f"💾 Database exists: {self.db_path.exists() if self.db_path else False}")
        else:
            logger.info(f"💾 PostgreSQL database: {self.pg_database} @ {self.pg_host}")

    def create_database_backup(self, description: str = "") -> Dict[str, Any]:
        """
        Database backup oluşturur

        Args:
            description: Backup açıklaması

        Returns:
            Backup bilgileri
        """
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            
            if self.db_type == "postgresql":
                # PostgreSQL için pg_dump kullan
                backup_name = f"db_backup_{timestamp}.sql"
                backup_path = self.backup_dir / backup_name
                
                # pg_dump komutu
                env = os.environ.copy()
                env['PGPASSWORD'] = self.pg_password
                
                cmd = [
                    'pg_dump',
                    '-h', self.pg_host,
                    '-U', self.pg_user,
                    '-d', self.pg_database,
                    '-f', str(backup_path),
                    '--no-owner',
                    '--no-acl'
                ]
                
                logger.info(f"🔄 PostgreSQL backup başlatılıyor: {self.pg_database}")
                result = subprocess.run(cmd, env=env, capture_output=True, text=True)
                
                if result.returncode != 0:
                    raise Exception(f"pg_dump hatası: {result.stderr}")
                    
            else:
                # SQLite için dosya kopyalama
                backup_name = f"db_backup_{timestamp}.db"
                backup_path = self.backup_dir / backup_name
                
                # Database dosyasını kopyala
                if not self.db_path or not self.db_path.exists():
                    raise FileNotFoundError(f"Database dosyası bulunamadı: {self.db_path}")

                shutil.copy2(self.db_path, backup_path)
            
            # Metadata dosyası
            metadata_name = f"db_backup_{timestamp}.json"
            metadata_path = self.backup_dir / metadata_name

            # Metadata oluştur
            metadata = {
                "timestamp": timestamp,
                "datetime": datetime.now().isoformat(),
                "type": "database",
                "db_type": self.db_type,
                "description": description,
                "filename": backup_name,
                "size": backup_path.stat().st_size,
                "db_path": str(self.db_path) if self.db_type == "sqlite" else f"{self.pg_database}@{self.pg_host}"
            }

            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)

            logger.info(f"✅ Database backup oluşturuldu: {backup_name}")

            return {
                "success": True,
                "backup_name": backup_name,
                "backup_path": str(backup_path),
                "metadata": metadata
            }

        except Exception as e:
            logger.error(f"❌ Database backup hatası: {e}")
            raise

    def create_full_backup(self, description: str = "") -> Dict[str, Any]:
        """
        Tam yedek oluşturur (database + config)

        Args:
            description: Backup açıklaması

        Returns:
            Backup bilgileri
        """
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"full_backup_{timestamp}"
            backup_dir = self.backup_dir / backup_name
            backup_dir.mkdir(parents=True, exist_ok=True)

            # Database backup
            if self.db_type == "postgresql":
                # PostgreSQL için SQL dump
                db_backup_path = backup_dir / "database.sql"
                env = os.environ.copy()
                env['PGPASSWORD'] = self.pg_password
                
                cmd = [
                    'pg_dump',
                    '-h', self.pg_host,
                    '-U', self.pg_user,
                    '-d', self.pg_database,
                    '-f', str(db_backup_path),
                    '--no-owner',
                    '--no-acl'
                ]
                
                logger.info(f"🔄 PostgreSQL full backup başlatılıyor: {self.pg_database}")
                result = subprocess.run(cmd, env=env, capture_output=True, text=True)
                
                if result.returncode != 0:
                    logger.warning(f"⚠️ pg_dump hatası (devam ediliyor): {result.stderr}")
            else:
                # SQLite için dosya kopyalama
                db_backup_path = backup_dir / "database.db"
                if self.db_path and self.db_path.exists():
                    shutil.copy2(self.db_path, db_backup_path)

            # .env dosyası backup (hassas bilgiler içerir!)
            env_path = Path(__file__).parent.parent.parent / ".env"
            if env_path.exists():
                env_backup_path = backup_dir / "env.backup"
                shutil.copy2(env_path, env_backup_path)

            # Metadata
            metadata = {
                "timestamp": timestamp,
                "datetime": datetime.now().isoformat(),
                "type": "full",
                "description": description,
                "dirname": backup_name,
                "size": sum(f.stat().st_size for f in backup_dir.rglob('*') if f.is_file()),
                "files": [f.name for f in backup_dir.iterdir()]
            }

            metadata_path = backup_dir / "metadata.json"
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)

            logger.info(f"✅ Full backup oluşturuldu: {backup_name}")

            return {
                "success": True,
                "backup_name": backup_name,
                "backup_path": str(backup_dir),
                "metadata": metadata
            }

        except Exception as e:
            logger.error(f"❌ Full backup hatası: {e}")
            raise

    def list_backups(self, backup_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Mevcut backup'ları listeler

        Args:
            backup_type: Backup tipi filtresi ("database", "full", None=hepsi)

        Returns:
            Backup listesi
        """
        try:
            backups = []

            # Database backups
            if backup_type is None or backup_type == "database":
                for metadata_file in self.backup_dir.glob("db_backup_*.json"):
                    try:
                        with open(metadata_file, 'r') as f:
                            metadata = json.load(f)
                            metadata['backup_type'] = 'database'
                            backups.append(metadata)
                    except Exception as e:
                        logger.warning(f"Metadata okunamadı: {metadata_file} - {e}")

            # Full backups
            if backup_type is None or backup_type == "full":
                for backup_dir in self.backup_dir.glob("full_backup_*"):
                    if backup_dir.is_dir():
                        metadata_file = backup_dir / "metadata.json"
                        if metadata_file.exists():
                            try:
                                with open(metadata_file, 'r') as f:
                                    metadata = json.load(f)
                                    metadata['backup_type'] = 'full'
                                    backups.append(metadata)
                            except Exception as e:
                                logger.warning(f"Metadata okunamadı: {metadata_file} - {e}")

            # Tarihe göre sırala (yeniden eskiye)
            backups.sort(key=lambda x: x.get('timestamp', ''), reverse=True)

            return backups

        except Exception as e:
            logger.error(f"❌ Backup listesi hatası: {e}")
            return []

    def restore_database_backup(self, backup_name: str, create_backup_before: bool = True) -> Dict[str, Any]:
        """
        Database backup'ı geri yükler

        Args:
            backup_name: Geri yüklenecek backup dosyası adı
            create_backup_before: Geri yüklemeden önce mevcut database'i yedekle

        Returns:
            Restore sonucu
        """
        try:
            backup_path = self.backup_dir / backup_name

            if not backup_path.exists():
                raise FileNotFoundError(f"Backup dosyası bulunamadı: {backup_name}")

            # Mevcut database'i yedekle
            pre_restore_backup = None
            if create_backup_before:
                logger.info("📦 Restore öncesi mevcut database yedekleniyor...")
                pre_restore_backup = self.create_database_backup(
                    description=f"Pre-restore backup before restoring {backup_name}"
                )

            # Database'i geri yükle
            logger.info(f"♻️ Database geri yükleniyor: {backup_name}")
            
            if self.db_type == "postgresql":
                # PostgreSQL için psql ile restore
                env = os.environ.copy()
                env['PGPASSWORD'] = self.pg_password
                
                # Önce database'i temizle (drop all tables)
                drop_cmd = [
                    'psql',
                    '-h', self.pg_host,
                    '-U', self.pg_user,
                    '-d', self.pg_database,
                    '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
                ]
                
                logger.info("🗑️ Mevcut tablolar temizleniyor...")
                subprocess.run(drop_cmd, env=env, capture_output=True, text=True)
                
                # Backup'ı geri yükle
                restore_cmd = [
                    'psql',
                    '-h', self.pg_host,
                    '-U', self.pg_user,
                    '-d', self.pg_database,
                    '-f', str(backup_path)
                ]
                
                result = subprocess.run(restore_cmd, env=env, capture_output=True, text=True)
                
                if result.returncode != 0:
                    raise Exception(f"psql restore hatası: {result.stderr}")
            else:
                # SQLite için dosya kopyalama
                if not self.db_path:
                    raise Exception("SQLite database path bulunamadı")
                shutil.copy2(backup_path, self.db_path)

            logger.info(f"✅ Database başarıyla geri yüklendi")

            return {
                "success": True,
                "restored_from": backup_name,
                "pre_restore_backup": pre_restore_backup
            }

        except Exception as e:
            logger.error(f"❌ Database restore hatası: {e}")
            raise

    def restore_full_backup(self, backup_name: str, create_backup_before: bool = True) -> Dict[str, Any]:
        """
        Full backup'ı geri yükler

        Args:
            backup_name: Geri yüklenecek backup dizini adı
            create_backup_before: Geri yüklemeden önce mevcut durumu yedekle

        Returns:
            Restore sonucu
        """
        try:
            backup_path = self.backup_dir / backup_name

            if not backup_path.exists() or not backup_path.is_dir():
                raise FileNotFoundError(f"Backup dizini bulunamadı: {backup_name}")

            # Mevcut durumu yedekle
            pre_restore_backup = None
            if create_backup_before:
                logger.info("📦 Restore öncesi mevcut durum yedekleniyor...")
                pre_restore_backup = self.create_full_backup(
                    description=f"Pre-restore backup before restoring {backup_name}"
                )

            # Database'i geri yükle
            if self.db_type == "postgresql":
                db_backup_path = backup_path / "database.sql"
                if db_backup_path.exists():
                    logger.info(f"♻️ PostgreSQL database geri yükleniyor...")
                    
                    env = os.environ.copy()
                    env['PGPASSWORD'] = self.pg_password
                    
                    # Önce database'i temizle
                    drop_cmd = [
                        'psql',
                        '-h', self.pg_host,
                        '-U', self.pg_user,
                        '-d', self.pg_database,
                        '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
                    ]
                    subprocess.run(drop_cmd, env=env, capture_output=True, text=True)
                    
                    # Backup'ı geri yükle
                    restore_cmd = [
                        'psql',
                        '-h', self.pg_host,
                        '-U', self.pg_user,
                        '-d', self.pg_database,
                        '-f', str(db_backup_path)
                    ]
                    result = subprocess.run(restore_cmd, env=env, capture_output=True, text=True)
                    
                    if result.returncode != 0:
                        raise Exception(f"psql restore hatası: {result.stderr}")
            else:
                # SQLite için dosya kopyalama
                db_backup_path = backup_path / "database.db"
                if db_backup_path.exists() and self.db_path:
                    logger.info(f"♻️ SQLite database geri yükleniyor...")
                    shutil.copy2(db_backup_path, self.db_path)

            # .env dosyasını geri yükle (DİKKAT: Hassas işlem!)
            env_backup_path = backup_path / "env.backup"
            env_path = Path(__file__).parent.parent.parent / ".env"
            if env_backup_path.exists():
                logger.warning("⚠️ .env dosyası geri yükleniyor - Servis yeniden başlatılmalı!")
                shutil.copy2(env_backup_path, env_path)

            logger.info(f"✅ Full backup başarıyla geri yüklendi")

            return {
                "success": True,
                "restored_from": backup_name,
                "pre_restore_backup": pre_restore_backup,
                "requires_restart": True  # .env değiştiği için restart gerekli
            }

        except Exception as e:
            logger.error(f"❌ Full backup restore hatası: {e}")
            raise

    def delete_backup(self, backup_name: str) -> Dict[str, Any]:
        """
        Backup'ı siler

        Args:
            backup_name: Silinecek backup adı

        Returns:
            Silme sonucu
        """
        try:
            # Database backup mı?
            if backup_name.endswith('.db'):
                backup_path = self.backup_dir / backup_name
                metadata_name = backup_name.replace('.db', '.json')
                metadata_path = self.backup_dir / metadata_name

                if backup_path.exists():
                    backup_path.unlink()
                if metadata_path.exists():
                    metadata_path.unlink()

                logger.info(f"🗑️ Database backup silindi: {backup_name}")

            # Full backup mı?
            else:
                backup_path = self.backup_dir / backup_name
                if backup_path.exists() and backup_path.is_dir():
                    shutil.rmtree(backup_path)
                    logger.info(f"🗑️ Full backup silindi: {backup_name}")
                else:
                    raise FileNotFoundError(f"Backup bulunamadı: {backup_name}")

            return {
                "success": True,
                "deleted": backup_name
            }

        except Exception as e:
            logger.error(f"❌ Backup silme hatası: {e}")
            raise

    def get_backup_stats(self) -> Dict[str, Any]:
        """
        Backup istatistiklerini döner

        Returns:
            İstatistikler
        """
        try:
            backups = self.list_backups()

            total_size = 0
            for backup in backups:
                if backup['backup_type'] == 'database':
                    backup_file = self.backup_dir / backup['filename']
                    if backup_file.exists():
                        total_size += backup_file.stat().st_size
                else:  # full
                    backup_dir = self.backup_dir / backup['dirname']
                    if backup_dir.exists():
                        total_size += sum(f.stat().st_size for f in backup_dir.rglob('*') if f.is_file())

            return {
                "total_backups": len(backups),
                "database_backups": len([b for b in backups if b['backup_type'] == 'database']),
                "full_backups": len([b for b in backups if b['backup_type'] == 'full']),
                "total_size_bytes": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "backup_dir": str(self.backup_dir),
                "latest_backup": backups[0] if backups else None
            }

        except Exception as e:
            logger.error(f"❌ Backup stats hatası: {e}")
            return {
                "total_backups": 0,
                "error": str(e)
            }


# Global backup service instance
backup_service = BackupService()
