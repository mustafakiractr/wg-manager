"""
QR kod oluşturma yardımcı fonksiyonları
WireGuard peer konfigürasyonları için QR kod üretir
"""
import qrcode
import io
import base64
from typing import Optional


def generate_qrcode(data: str) -> Optional[str]:
    """
    Verilen metni QR kod olarak oluşturur ve base64 string olarak döner
    
    Args:
        data: QR kodda gösterilecek metin (WireGuard config)
    
    Returns:
        Base64 encoded PNG görüntüsü veya None
    """
    try:
        # QR kod oluşturucu yapılandırması
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        
        # Veriyi ekle
        qr.add_data(data)
        qr.make(fit=True)
        
        # Görüntü oluştur
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Base64'e dönüştür
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        return f"data:image/png;base64,{img_str}"
    except Exception as e:
        print(f"QR kod oluşturma hatası: {e}")
        return None


