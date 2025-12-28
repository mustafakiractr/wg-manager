"""
Uygulama başlatma scripti
Development için uvicorn server'ı başlatır
"""
import uvicorn
from app.config import settings
from dotenv import load_dotenv

if __name__ == "__main__":
    load_dotenv() # .env dosyasını yükle
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8001,
        reload=False,  # Manuel restart
        log_level=settings.LOG_LEVEL.lower()
    )


