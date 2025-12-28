"""
Logging yardımcı fonksiyonları
Uygulama genelinde tutarlı log formatı sağlar
"""
import logging
import os
from logging.handlers import RotatingFileHandler
from app.config import settings


def setup_logger():
    """
    Logger yapılandırması
    Hem konsola hem dosyaya log yazar
    """
    # Log klasörünü oluştur
    log_dir = os.path.dirname(settings.LOG_FILE)
    if log_dir and not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    # Logger formatı
    log_format = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Root logger'ı yapılandır
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper()))
    
    # Konsol handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(log_format)
    root_logger.addHandler(console_handler)
    
    # Dosya handler (rotating - dosya büyüdükçe yeni dosya oluşturur)
    file_handler = RotatingFileHandler(
        settings.LOG_FILE,
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5
    )
    file_handler.setFormatter(log_format)
    root_logger.addHandler(file_handler)


