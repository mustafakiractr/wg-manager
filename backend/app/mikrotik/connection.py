"""
MikroTik RouterOS API bağlantı sınıfı
WireGuard ve diğer router işlemleri için API bağlantısı yönetir
"""
import asyncio
import logging
from typing import Optional, List, Dict, Any
# routeros_api 0.19.0 versiyonunda RouterOsApiPool kullanılıyor
from routeros_api import RouterOsApiPool
from app.config import settings
from app.utils.cache import mikrotik_cache

logger = logging.getLogger(__name__)


class MikroTikConnection:
    """
    MikroTik RouterOS API bağlantı yönetimi
    Async destekli bağlantı ve komut çalıştırma
    """
    
    def __init__(self):
        """Bağlantı bilgilerini ayarla"""
        self.host = settings.MIKROTIK_HOST
        self.port = settings.MIKROTIK_PORT
        self.username = settings.MIKROTIK_USER
        self.password = settings.MIKROTIK_PASSWORD
        self.use_tls = settings.MIKROTIK_USE_TLS
        self.connection: Optional[RouterOsApiPool] = None  # RouterOsApiPool instance
        self.api: Optional[Any] = None  # API object
    
    async def connect(self) -> bool:
        """
        MikroTik router'a bağlanır
        
        Returns:
            Bağlantı başarılıysa True
        """
        try:
            # RouterOS API blocking olduğu için thread pool'da çalıştır
            # RouterOsApiPool kullanımı
            loop = asyncio.get_event_loop()
            
            def create_connection():
                # Plaintext login kullan (bazı MikroTik versiyonlarında gerekli)
                # Önce normal login dene, başarısız olursa plaintext login dene
                try:
                    pool = RouterOsApiPool(
                        self.host,
                        username=self.username,
                        password=self.password,
                        port=self.port,
                        use_ssl=self.use_tls,
                        plaintext_login=False  # Önce normal login dene
                    )
                    api = pool.get_api()
                    return pool, api
                except Exception as e:
                    # Normal login başarısız olursa plaintext login dene
                    logger.warning(f"Normal login başarısız, plaintext login deneniyor: {e}")
                    pool = RouterOsApiPool(
                        self.host,
                        username=self.username,
                        password=self.password,
                        port=self.port,
                        use_ssl=self.use_tls,
                        plaintext_login=True  # Plaintext login dene
                    )
                    api = pool.get_api()
                    return pool, api
            
            self.connection, self.api = await loop.run_in_executor(None, create_connection)
            logger.info(f"MikroTik router'a bağlanıldı: {self.host}:{self.port}")
            return True
        except Exception as e:
            logger.error(f"MikroTik bağlantı hatası: {e}")
            self.connection = None
            self.api = None
            return False
    
    async def disconnect(self):
        """Bağlantıyı kapatır"""
        if self.connection:
            try:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, self.connection.disconnect)
                logger.info("MikroTik bağlantısı kapatıldı")
            except Exception as e:
                logger.error(f"Bağlantı kapatma hatası: {e}")
            finally:
                self.connection = None
                self.api = None
    
    async def ensure_connected(self) -> bool:
        """
        Bağlantının aktif olduğundan emin olur, değilse yeniden bağlanır
        Her cihaz yeniden başladığında otomatik bağlanır
        
        Returns:
            Bağlantı başarılıysa True
        """
        # Bağlantı bilgileri kontrolü
        if not self.host or not self.username:
            logger.error("MikroTik bağlantı bilgileri eksik (host veya username yok)")
            return False
        
        # Bağlantı varsa ve aktifse kontrol et
        if self.connection is not None and self.api is not None:
            try:
                # Basit bir test komutu çalıştırarak bağlantının aktif olduğunu doğrula
                # Eğer bağlantı kopmuşsa exception fırlatılır
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, lambda: self.api.get_resource('/system/resource').get())
                return True
            except Exception as e:
                # Bağlantı kopmuş, yeniden bağlan
                logger.warning(f"MikroTik bağlantısı kopmuş, yeniden bağlanılıyor: {e}")
                try:
                    await self.disconnect()
                except:
                    pass
                self.connection = None
                self.api = None
        
        # Bağlantı yoksa veya kopmuşsa yeniden bağlan
        logger.info(f"MikroTik'e otomatik bağlanılıyor: {self.host}:{self.port}")
        return await self.connect()
    
    async def execute_command(self, path: str, command: str = "print", **kwargs) -> List[Dict[str, Any]]:
        """
        MikroTik API komutu çalıştırır
        Retry mekanizması ve timeout desteği ile
        
        Args:
            path: API path (örn: "/interface/wireguard")
            command: Komut (print, add, set, remove, enable, disable)
            **kwargs: Komut parametreleri
        
        Returns:
            Komut sonucu (liste veya dict)
        """
        max_retries = 3  # Maksimum 3 deneme
        retry_delay = 1  # Her deneme arasında 1 saniye bekle
        
        for attempt in range(max_retries):
            try:
                # Bağlantının açık olduğundan emin ol (her komut öncesi kontrol et)
                if not await self.ensure_connected():
                    raise Exception("MikroTik router'a bağlanılamadı")
                
                loop = asyncio.get_event_loop()
                
                # API nesnesini kullan (RouterOsApiPool'dan get_api() ile alınmış)
                api = self.api
                
                if api is None:
                    raise Exception("API nesnesi bulunamadı. Bağlantı kurulmamış olabilir.")
                
                # Path'i parse et (örn: "/interface/wireguard" -> ["interface", "wireguard"])
                path_parts = [p for p in path.strip("/").split("/") if p]
                
                # Resource'a eriş - routeros-api'de get_resource metodu kullanılır
                def get_resource():
                    # get_resource metodu path string'i alır
                    resource_path = '/' + '/'.join(path_parts)
                    return api.get_resource(resource_path)
                
                resource = await loop.run_in_executor(None, get_resource)
                
                # Komutu çalıştır - kwargs dictionary olarak geçilmeli
                if command == "print":
                    # Print komutu için kwargs'ı filtrele (interface gibi)
                    # routeros-api'de interface filtresi için "?interface=name" formatı kullanılır
                    print_kwargs = {}
                    if "interface" in kwargs:
                        # Interface filtresi için query kullan
                        def execute():
                            try:
                                return list(resource.get(interface=kwargs["interface"]))
                            except Exception as e:
                                error_str = str(e)
                                # !re hatasını yakala ve daha anlaşılır hale getir
                                if "!re" in error_str or "Malformed" in error_str:
                                    logger.error(f"MikroTik API parse hatası: {e}")
                                    logger.error(f"Path: {path}, Interface: {kwargs.get('interface')}")
                                    # Bağlantıyı yeniden kurmayı dene
                                    raise Exception(f"MikroTik API yanıtı parse edilemedi. Bağlantıyı kontrol edin. Hata: {error_str}")
                                raise
                        result = await loop.run_in_executor(None, execute)
                    else:
                        # Diğer filtreler için
                        for k, v in kwargs.items():
                            if k != "interface":
                                print_kwargs[k] = v
                        if print_kwargs:
                            def execute():
                                try:
                                    return list(resource.get(**print_kwargs))
                                except Exception as e:
                                    error_str = str(e)
                                    # !re hatasını yakala ve daha anlaşılır hale getir
                                    if "!re" in error_str or "Malformed" in error_str:
                                        logger.error(f"MikroTik API parse hatası: {e}")
                                        logger.error(f"Path: {path}, Kwargs: {print_kwargs}")
                                        raise Exception(f"MikroTik API yanıtı parse edilemedi. Bağlantıyı kontrol edin. Hata: {error_str}")
                                    raise
                            result = await loop.run_in_executor(None, execute)
                        else:
                            def execute():
                                try:
                                    return list(resource.get())
                                except Exception as e:
                                    error_str = str(e)
                                    # !re hatasını yakala ve daha anlaşılır hale getir
                                    if "!re" in error_str or "Malformed" in error_str:
                                        logger.error(f"MikroTik API parse hatası: {e}")
                                        logger.error(f"Path: {path}")
                                        raise Exception(f"MikroTik API yanıtı parse edilemedi. Bağlantıyı kontrol edin. Hata: {error_str}")
                                    raise
                            result = await loop.run_in_executor(None, execute)
                elif command == "add":
                    # Add komutu için kwargs'ı logla
                    logger.info(f"🔍 MikroTik API add komutu - Path: {path}, kwargs: {kwargs}")
                    if "allowed-address" in kwargs:
                        logger.info(f"🔍 add komutu allowed-address: '{kwargs['allowed-address']}'")

                    def execute():
                        return resource.add(**kwargs)
                    result = await loop.run_in_executor(None, execute)
                elif command == "set":
                    # Set komutu için kwargs'ı logla
                    logger.info(f"🔍 MikroTik API set komutu - Path: {path}, kwargs: {kwargs}")
                    if "allowed-address" in kwargs:
                        logger.info(f"🔍 set komutu allowed-address: '{kwargs['allowed-address']}'")
                        logger.info(f"🔍 allowed-address karakter sayısı: {len(kwargs['allowed-address'])}")
                        logger.info(f"🔍 allowed-address virgül sayısı: {kwargs['allowed-address'].count(',')}")

                    def execute():
                        # MikroTik API'de set komutu için parametreleri logla
                        logger.debug(f"MikroTik set komutu parametreleri: {kwargs}")
                        try:
                            result = resource.set(**kwargs)
                            logger.info(f"✅ MikroTik set komutu başarılı - Sonuç: {result}")
                            return result
                        except Exception as e:
                            logger.error(f"❌ MikroTik set komutu hatası: {e}")
                            logger.error(f"Parametreler: {kwargs}")
                            raise
                    result = await loop.run_in_executor(None, execute)
                elif command == "remove":
                    def execute():
                        return resource.remove(**kwargs)
                    result = await loop.run_in_executor(None, execute)
                elif command == "enable":
                    def execute():
                        return resource.enable(**kwargs)
                    result = await loop.run_in_executor(None, execute)
                elif command == "disable":
                    def execute():
                        return resource.disable(**kwargs)
                    result = await loop.run_in_executor(None, execute)
                else:
                    raise ValueError(f"Bilinmeyen komut: {command}")
                
                # Sonucu dict listesine dönüştür
                if isinstance(result, list):
                    return [dict(item) if hasattr(item, '__dict__') else item for item in result]
                elif hasattr(result, '__dict__'):
                    return [dict(result)]
                else:
                    return [result] if result else []
                
            except Exception as e:
                error_msg = str(e)
                logger.error(f"MikroTik komut hatası ({path}/{command}) - Deneme {attempt + 1}/{max_retries}: {error_msg}")
                
                # "entry already exists" hatasını özel olarak işle - retry yapma
                if "entry already exists" in error_msg.lower() or "already exists" in error_msg.lower():
                    logger.warning(f"⚠️ Entry already exists hatası: {error_msg}")
                    raise Exception(f"Entry already exists: {error_msg}")
                
                # Son denemede değilse retry yap
                if attempt < max_retries - 1:
                    # "!re" veya "Malformed" hatasını özel olarak işle
                    if "!re" in error_msg or "Malformed" in error_msg or "malformed" in error_msg.lower():
                        logger.warning(f"⚠️ MikroTik API parse hatası, bağlantıyı yeniden kuruyoruz... (Deneme {attempt + 1}/{max_retries})")
                        try:
                            await self.disconnect()
                            await asyncio.sleep(retry_delay)
                            if await self.connect():
                                logger.info("✅ Bağlantı yeniden kuruldu, komutu tekrar deniyoruz...")
                                await asyncio.sleep(retry_delay)
                                continue  # Retry yap
                        except Exception as retry_error:
                            logger.error(f"❌ Bağlantı yeniden kurma hatası: {retry_error}")
                    
                    # Bağlantı veya timeout hatası varsa yeniden dene
                    if "connection" in error_msg.lower() or "timeout" in error_msg.lower() or "network" in error_msg.lower():
                        logger.warning(f"⚠️ Bağlantı/Network hatası, yeniden deniyoruz... (Deneme {attempt + 1}/{max_retries})")
                        self.connection = None
                        await asyncio.sleep(retry_delay)
                        if await self.connect():
                            await asyncio.sleep(retry_delay)
                            continue  # Retry yap
                
                # Son denemede veya retry yapılamayacak hata türünde, hata mesajını iyileştir
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                
                if "!re" in error_msg or "Malformed" in error_msg or "malformed" in error_msg.lower():
                    raise Exception(f"MikroTik API yanıtı parse edilemedi. Bu genellikle bağlantı sorunu veya MikroTik API versiyonu uyumsuzluğu nedeniyle oluşur. Lütfen bağlantıyı kontrol edin. Hata: {error_msg}")
                
                if "connection" in error_msg.lower() or "timeout" in error_msg.lower() or "network" in error_msg.lower():
                    raise Exception(f"MikroTik router'a bağlanılamadı veya yanıt alınamadı. Lütfen bağlantı ayarlarınızı kontrol edin. Hata: {error_msg}")
                
                # Diğer hatalar için olduğu gibi fırlat
                raise
    
    async def get_wireguard_interfaces(self, use_cache: bool = True) -> List[Dict[str, Any]]:
        """
        Tüm WireGuard interface'lerini getirir
        Cache'lenmiş versiyonu kullanır (10 saniye cache)
        
        Args:
            use_cache: Cache kullanılsın mı? (default: True)
        
        Returns:
            Interface listesi
        """
        cache_key = "wireguard_interfaces"
        
        # Cache'den kontrol et (eğer cache kullanılıyorsa)
        if use_cache:
            cached_result = mikrotik_cache.get(cache_key)
            if cached_result is not None:
                logger.debug("WireGuard interfaces cache'den alındı")
                return cached_result
        
        # Cache'de yok veya cache kullanılmıyor, API'den çek
        result = await self.execute_command("/interface/wireguard", "print")
        
        # Interface verilerini normalize et - key alanlarını düzelt
        # MikroTik API'den gelen key alanları farklı formatlarda gelebilir
        normalized_interfaces = []
        for interface in result:
            normalized_interface = dict(interface)  # Yeni bir dict oluştur
            
            # Debug: Tüm alanları logla
            logger.debug(f"Interface ham veri: {normalized_interface}")
            logger.debug(f"Interface tüm anahtarları: {list(normalized_interface.keys())}")
            
            # Public key normalize et - hem 'public-key' hem 'public_key' kontrolü yap
            public_key = normalized_interface.get('public-key') or normalized_interface.get('public_key') or normalized_interface.get('publicKey')
            
            # Eğer standart alanlarda bulunamadıysa, tüm alanları tarayarak bul
            if not public_key:
                for key in normalized_interface.keys():
                    key_lower = key.lower()
                    # Public key içeren tüm alanları kontrol et
                    if ('public' in key_lower and 'key' in key_lower) or key_lower == 'public-key' or key_lower == 'public_key':
                        potential_key = normalized_interface.get(key)
                        if potential_key and len(str(potential_key).strip()) > 20:  # WireGuard key'leri genelde 40+ karakter
                            public_key = potential_key
                            logger.info(f"Interface public key alternatif alandan bulundu: {key} = {public_key[:20]}...")
                            break
            
            if public_key:
                # Key'i normalize et (trim ve boşlukları temizle)
                public_key = str(public_key).strip()
                # Normalize edilmiş key'i hem 'public-key' hem 'public_key' olarak kaydet
                normalized_interface['public-key'] = public_key
                normalized_interface['public_key'] = public_key
                logger.debug(f"✅ Interface public key normalize edildi: {public_key[:20]}... (uzunluk: {len(public_key)})")
            else:
                logger.warning(f"⚠️ Interface public key bulunamadı. Interface: {normalized_interface.get('name')}, Tüm alanlar: {list(normalized_interface.keys())}")
            
            # Private key normalize et - hem 'private-key' hem 'private_key' kontrolü yap
            private_key = normalized_interface.get('private-key') or normalized_interface.get('private_key') or normalized_interface.get('privateKey')
            if private_key:
                # Key'i normalize et (trim ve boşlukları temizle)
                private_key = str(private_key).strip()
                # Normalize edilmiş key'i hem 'private-key' hem 'private_key' olarak kaydet
                normalized_interface['private-key'] = private_key
                normalized_interface['private_key'] = private_key
            
            normalized_interfaces.append(normalized_interface)

        # IP adreslerini al ve interface'lere ekle
        try:
            ip_addresses = await self.execute_command("/ip/address", "print")
            # Her interface için IP adresini bul
            for iface in normalized_interfaces:
                interface_name = iface.get('name') or iface.get('.id')
                if interface_name:
                    # Bu interface'e ait IP adreslerini bul
                    iface_ips = []
                    for ip_entry in ip_addresses:
                        # MikroTik'te interface alanı 'interface' veya 'interface' key'i ile gelir
                        ip_interface = ip_entry.get('interface') or ip_entry.get('interface-name')
                        if ip_interface == interface_name:
                            # IP adresini al (genelde "192.168.1.1/24" formatında)
                            ip_addr = ip_entry.get('address')
                            if ip_addr:
                                iface_ips.append(ip_addr)

                    # IP adresi(lerini) interface'e ekle
                    if iface_ips:
                        iface['ip-address'] = iface_ips[0]  # İlk IP'yi kullan
                        iface['ip-addresses'] = iface_ips  # Tüm IP'leri de sakla
                        logger.debug(f"Interface {interface_name} için IP adresi eklendi: {iface_ips[0]}")
                    else:
                        iface['ip-address'] = None
                        iface['ip-addresses'] = []
        except Exception as e:
            logger.warning(f"IP adresleri alınamadı: {e}")
            # Hata olsa bile devam et, sadece IP adresleri olmadan

        # Cache'le (30 saniye) - sadece cache kullanılıyorsa
        if use_cache:
            mikrotik_cache.set(cache_key, normalized_interfaces, ttl=30)

        return normalized_interfaces
    
    async def get_wireguard_peers(self, interface: str, use_cache: bool = True) -> List[Dict[str, Any]]:
        """
        Belirli bir interface'e ait peer'ları getirir
        Cache'lenmiş versiyonu kullanır (10 saniye cache)
        
        Args:
            interface: Interface adı
            use_cache: Cache kullanılsın mı? (default: True)
        
        Returns:
            Peer listesi
        """
        cache_key = f"wireguard_peers:{interface}"
        
        # Cache'den kontrol et (eğer cache kullanılıyorsa)
        if use_cache:
            cached_result = mikrotik_cache.get(cache_key)
            if cached_result is not None:
                logger.debug(f"WireGuard peers cache'den alındı: {interface}")
                return cached_result
        
        # Cache'de yok veya cache kullanılmıyor, API'den çek
        # Interface parametresini dictionary olarak geç
        peers = await self.execute_command("/interface/wireguard/peers", "print", **{"interface": interface})
        
        # Peer verilerini normalize et - key alanlarını düzelt
        # MikroTik API'den gelen key alanları farklı formatlarda gelebilir
        normalized_peers = []
        for peer in peers:
            normalized_peer = dict(peer)  # Yeni bir dict oluştur
            
            # Public key normalize et - hem 'public-key' hem 'public_key' kontrolü yap
            public_key = normalized_peer.get('public-key') or normalized_peer.get('public_key') or normalized_peer.get('publicKey')
            if public_key:
                # Key'i normalize et (trim ve boşlukları temizle)
                public_key = str(public_key).strip()
                # Normalize edilmiş key'i hem 'public-key' hem 'public_key' olarak kaydet
                normalized_peer['public-key'] = public_key
                normalized_peer['public_key'] = public_key
            
            # Private key normalize et - hem 'private-key' hem 'private_key' kontrolü yap
            private_key = normalized_peer.get('private-key') or normalized_peer.get('private_key') or normalized_peer.get('privateKey')
            if private_key:
                # Key'i normalize et (trim ve boşlukları temizle)
                private_key = str(private_key).strip()
                # Normalize edilmiş key'i hem 'private-key' hem 'private_key' olarak kaydet
                normalized_peer['private-key'] = private_key
                normalized_peer['private_key'] = private_key
            
            # Preshared key normalize et
            preshared_key = normalized_peer.get('preshared-key') or normalized_peer.get('preshared_key') or normalized_peer.get('presharedKey')
            if preshared_key:
                preshared_key = str(preshared_key).strip()
                normalized_peer['preshared-key'] = preshared_key
                normalized_peer['preshared_key'] = preshared_key

            # Endpoint address normalize et
            endpoint_addr = normalized_peer.get('current-endpoint-address') or normalized_peer.get('endpoint-address') or normalized_peer.get('endpoint_address')
            if endpoint_addr:
                normalized_peer['current-endpoint-address'] = endpoint_addr
                normalized_peer['endpoint-address'] = endpoint_addr

            # Endpoint port normalize et
            endpoint_port = normalized_peer.get('current-endpoint-port') or normalized_peer.get('endpoint-port') or normalized_peer.get('endpoint_port')
            if endpoint_port:
                normalized_peer['current-endpoint-port'] = endpoint_port
                normalized_peer['endpoint-port'] = endpoint_port

            # Endpoint (birleşik string) oluştur - current-endpoint yoksa elle oluştur
            if not normalized_peer.get('endpoint'):
                if endpoint_addr and endpoint_port and endpoint_port not in [0, '0']:
                    normalized_peer['endpoint'] = f"{endpoint_addr}:{endpoint_port}"
                elif endpoint_addr:
                    normalized_peer['endpoint'] = endpoint_addr

            # Disabled alanını normalize et (boolean'a çevir)
            # MikroTik'ten "true"/"false" string veya true/false boolean olarak gelebilir
            disabled_value = normalized_peer.get('disabled')
            if disabled_value is not None:
                if isinstance(disabled_value, str):
                    # String ise "true" veya "false" kontrolü yap
                    normalized_peer['disabled'] = disabled_value.lower() in ('true', 'yes', '1')
                elif isinstance(disabled_value, bool):
                    # Boolean ise olduğu gibi kullan
                    normalized_peer['disabled'] = disabled_value
                else:
                    # Diğer tipler için boolean'a çevir
                    normalized_peer['disabled'] = bool(disabled_value)
            else:
                # disabled None ise varsayılan olarak False (aktif)
                normalized_peer['disabled'] = False

            normalized_peers.append(normalized_peer)
        
        # Peer verilerini logla (debug için)
        if normalized_peers:
            logger.debug(f"Interface {interface} için {len(normalized_peers)} peer bulundu")
            for peer in normalized_peers[:1]:  # İlk peer'ı logla
                logger.debug(f"Peer örneği: {list(peer.keys())}")
                if 'public-key' in peer:
                    logger.debug(f"public-key değeri: {peer['public-key'][:20]}... (uzunluk: {len(peer['public-key'])})")
                if 'last-handshake' in peer:
                    logger.debug(f"last-handshake değeri: {peer['last-handshake']} (tip: {type(peer['last-handshake'])})")
                if 'endpoint' in peer:
                    logger.debug(f"endpoint değeri: {peer['endpoint']}")
                if 'current-endpoint-address' in peer:
                    logger.debug(f"current-endpoint-address: {peer['current-endpoint-address']}")
                if 'current-endpoint-port' in peer:
                    logger.debug(f"current-endpoint-port: {peer['current-endpoint-port']}")
        
        # Cache'le (30 saniye) - sadece cache kullanılıyorsa
        if use_cache:
            mikrotik_cache.set(cache_key, normalized_peers, ttl=30)
        
        return normalized_peers
    
    async def add_wireguard_peer(self, interface: str, public_key: str, **kwargs) -> Dict[str, Any]:
        """
        Yeni WireGuard peer ekler
        Peer eklendikten sonra ilgili cache'leri temizler
        
        Args:
            interface: Interface adı
            public_key: Peer public key
            **kwargs: Diğer peer parametreleri (allowed-address, comment, vb.)
        
        Returns:
            Oluşturulan peer bilgisi
        """
        # Public key'i normalize et (trim ve boşlukları temizle)
        public_key_normalized = str(public_key).strip()
        if not public_key_normalized:
            raise ValueError("Public key boş olamaz")
        
        # MikroTik API parametreleri dictionary olarak geçilmeli (tire içeren isimler için)
        # NOT: MTU ve Endpoint parametreleri MikroTik WireGuard API'sinde peer seviyesinde desteklenmediği için çıkarılmalı
        if "mtu" in kwargs:
            del kwargs["mtu"]
        if "endpoint" in kwargs:
            del kwargs["endpoint"]
        
        # Private key'i MikroTik'e gönder
        # Kullanıcı talebi: Private key parametresini MikroTik API'ye gönder
        # Not: Eğer MikroTik bu parametreyi desteklemiyorsa hata alınabilir
        # Private key kwargs'ta kalacak ve MikroTik'e gönderilecek
        
        params = {"interface": interface, "public-key": public_key_normalized}
        params.update(kwargs)

        # Ek güvenlik: params içinde de MTU ve Endpoint olabilir, onları çıkar
        if "mtu" in params:
            del params["mtu"]
        if "endpoint" in params:
            del params["endpoint"]
        # Private key parametresi MikroTik'e gönderilecek (kullanıcı talebi)

        logger.info(f"Peer ekleniyor: interface={interface}, public_key={public_key_normalized[:20]}...")
        logger.info(f"🔍 MikroTik API'ye gönderilecek params: {params}")

        # allowed-address değerini logla
        if "allowed-address" in params:
            logger.info(f"🔍 allowed-address değeri: '{params['allowed-address']}'")
            logger.info(f"🔍 allowed-address tipi: {type(params['allowed-address'])}")

        result = await self.execute_command(
            "/interface/wireguard/peers",
            "add",
            **params
        )

        # DEBUG: Result'u logla
        logger.info(f"🔍 MikroTik add command result: {result}, type: {type(result)}")

        # Peer eklendikten sonra cache'i temizle
        mikrotik_cache.invalidate_pattern(f"wireguard_peers:{interface}")
        mikrotik_cache.clear("wireguard_interfaces")

        # MikroTik add komutu boş liste döndürüyor, peer ID'yi almak için
        # yeni eklenen peer'ı public key ile bulmalıyız
        logger.info(f"✅ Peer eklendi. Public key ile aranıyor: {public_key_normalized[:20]}...")

        # Yeni eklenen peer'ı public key ile bul
        try:
            # Cache'i bypass et - peer'ları doğrudan API'den çek
            peers = await self.execute_command(
                "/interface/wireguard/peers",
                "print",
                interface=interface
            )

            # Public key ile peer'ı bul
            for p in peers:
                peer_public_key = p.get('public-key') or p.get('public_key')
                if peer_public_key:
                    peer_public_key_normalized = str(peer_public_key).strip()
                    if peer_public_key_normalized == public_key_normalized:
                        peer = dict(p)
                        # Public key normalize et
                        peer['public-key'] = public_key_normalized
                        peer['public_key'] = public_key_normalized
                        peer_id = peer.get('.id') or peer.get('id')
                        logger.info(f"✅ Peer bulundu: ID={peer_id}, Public Key={public_key_normalized[:20]}...")
                        return peer

            logger.warning(f"⚠️ Yeni eklenen peer bulunamadı: Public Key={public_key_normalized[:20]}...")
        except Exception as e:
            logger.error(f"❌ Yeni peer bilgisi alınamadı: {e}")
            import traceback
            logger.error(traceback.format_exc())

        # Fallback: En azından public key'i döndür
        return {'public-key': public_key_normalized, 'public_key': public_key_normalized}
    
    async def update_wireguard_peer(self, peer_id: str, interface: str = None, **kwargs) -> Dict[str, Any]:
        """
        WireGuard peer'ı günceller
        
        Args:
            peer_id: Peer ID (.id field)
            interface: Interface adı (opsiyonel, bazı durumlarda gerekli)
            **kwargs: Güncellenecek parametreler
        
        Returns:
            Güncellenmiş peer bilgisi
        """
        # Bağlantının açık olduğundan emin ol
        await self.ensure_connected()
        
        # Eğer interface belirtilmişse, peer'ı bulmak için önce listeleme yap
        if interface:
            peers = await self.get_wireguard_peers(interface)
            target_peer = None
            
            logger.info(f"Peer arama: Aranan ID={peer_id}, Interface={interface}, Mevcut peer sayısı={len(peers)}")
            if peers:
                # MikroTik API'den gelen peer verilerinde hem 'id' hem '.id' olabilir
                logger.info(f"Mevcut peer ID'leri: {[str(p.get('id') or p.get('.id', 'YOK')) for p in peers]}")
                logger.info(f"İlk peer örneği: {peers[0]}")
                logger.info(f"İlk peer'ın tüm anahtarları: {list(peers[0].keys())}")
            
            # Peer ID None veya boş ise, tüm peer'ları döndür (ilk peer'ı kullan)
            if not peer_id or peer_id == 'None' or peer_id == 'undefined' or peer_id == 'null':
                logger.warning(f"Peer ID geçersiz: {peer_id}. Tüm peer'lar listeleniyor.")
                if peers and len(peers) > 0:
                    target_peer = peers[0]
                    logger.warning(f"İlk peer kullanılıyor: {target_peer.get('.id')}")
                else:
                    raise Exception(f"Peer bulunamadı. Interface: {interface}, Peer sayısı: {len(peers)}")
            else:
                # Peer ID eşleştirmesi - farklı formatları kontrol et
                peer_id_variants = [peer_id, str(peer_id)]
                if str(peer_id).startswith("*"):
                    peer_id_variants.append(str(peer_id)[1:])  # *5 -> 5
                
                for p in peers:
                    # MikroTik API'den gelen peer verilerinde hem 'id' hem '.id' olabilir
                    # Önce 'id' kontrolü yap (MikroTik API genelde 'id' kullanır)
                    peer_dot_id = p.get("id") or p.get(".id")
                    if peer_dot_id is None:
                        # Tüm anahtarları kontrol et
                        for key in p.keys():
                            if key == 'id' or key == '.id' or (key.endswith('id') and not key.startswith('endpoint')):
                                peer_dot_id = p.get(key)
                                if peer_dot_id:
                                    logger.debug(f"Alternatif ID anahtarı bulundu: {key}={peer_dot_id}")
                                    break
                        if peer_dot_id is None:
                            continue
                    
                    peer_dot_id_str = str(peer_dot_id)
                    logger.debug(f"Karşılaştırma: Aranan={peer_id}, Mevcut={peer_dot_id_str}")
                    
                    # Direkt eşleşme
                    if peer_dot_id_str in peer_id_variants or peer_dot_id in peer_id_variants:
                        target_peer = p
                        logger.info(f"Peer direkt eşleşme ile bulundu: {peer_dot_id_str}")
                        break
                    
                    # * karakterini kaldırarak karşılaştırma
                    peer_dot_id_normalized = peer_dot_id_str.lstrip("*")
                    for variant in peer_id_variants:
                        variant_normalized = str(variant).lstrip("*")
                        if peer_dot_id_normalized == variant_normalized:
                            target_peer = p
                            logger.info(f"Peer normalize edilmiş eşleşme ile bulundu: {peer_dot_id_normalized} == {variant_normalized}")
                            break
                    
                    if target_peer:
                        break
                
                if not target_peer:
                    # Peer bulunamadıysa, tüm peer'ları göster ve hata fırlat
                    error_msg = f"Peer bulunamadı (ID: {peer_id}, Interface: {interface}). Mevcut peer sayısı: {len(peers)}"
                    if peers:
                        # MikroTik API'den gelen peer verilerinde hem 'id' hem '.id' olabilir
                        error_msg += f"\nMevcut peer ID'leri: {[str(p.get('id') or p.get('.id', 'YOK')) for p in peers]}"
                        error_msg += f"\nİlk peer'ın tüm anahtarları: {list(peers[0].keys())}"
                        # Son çare: İlk peer'ı kullan
                        if len(peers) == 1:
                            logger.warning(f"Peer eşleştirmesi yapılamadı ama sadece bir peer var, onu kullanıyoruz.")
                            target_peer = peers[0]
                        else:
                            raise Exception(error_msg)
                    else:
                        raise Exception(error_msg)
            
            if target_peer:
                # Gerçek peer ID'yi kullan - MikroTik API'de hem 'id' hem '.id' olabilir
                # Önce 'id' kontrolü yap (MikroTik API genelde 'id' kullanır)
                peer_id = target_peer.get("id") or target_peer.get(".id")
                if peer_id is None:
                    # Peer ID hala None ise, tüm anahtarları kontrol et
                    for key in target_peer.keys():
                        if key == 'id' or key == '.id' or (key.endswith('id') and not key.startswith('endpoint')):
                            peer_id = target_peer.get(key)
                            if peer_id:
                                logger.info(f"Alternatif ID anahtarından peer ID bulundu: {key}={peer_id}")
                                break
                    if peer_id is None:
                        raise Exception(f"Peer bulundu ama ID None. Interface: {interface}, Peer keys: {list(target_peer.keys())}")
                logger.info(f"Peer bulundu, gerçek ID kullanılıyor: {peer_id}")
            else:
                raise Exception(f"Peer bulunamadı (ID: {peer_id}, Interface: {interface})")
        
        # Peer ID kontrolü - None veya geçersiz ise hata fırlat
        if peer_id is None or peer_id == 'None' or peer_id == 'undefined' or peer_id == 'null':
            raise Exception(f"Peer ID geçersiz: {peer_id}. Interface: {interface}. Lütfen sayfayı yenileyin.")
        
        # MikroTik API'de set komutu için .id parametresi doğru formatta olmalı
        # routeros-api kütüphanesinde .id parametresi direkt olarak geçilir
        params = {}
        
        # Peer ID'yi string'e çevir (MikroTik API string bekler)
        peer_id_str = str(peer_id).strip()
        
        # Geçersiz değer kontrolü
        if peer_id_str == "None" or peer_id_str == "" or peer_id_str == "undefined" or peer_id_str == "null":
            raise Exception(f"Geçersiz Peer ID: '{peer_id_str}'. Interface: {interface}. Lütfen sayfayı yenileyin.")
        
        params[".id"] = peer_id_str
        logger.info(f"Peer ID kullanılıyor: '{peer_id_str}'")
        
        # Interface parametresi eklenmemeli (set komutunda sadece .id yeterli)
        # Ancak bazı durumlarda interface parametresi gerekebilir
        # if interface:
        #     params["interface"] = interface  # Interface parametresi set komutunda kullanılmaz
        
        # kwargs'daki parametreleri ekle (disabled gibi)
        for key, value in kwargs.items():
            # disabled parametresi için özel işlem
            if key == "disabled":
                # MikroTik RouterOS API'de disabled parametresi string olarak geçilmeli
                # routeros-api kütüphanesi string bekler ("yes"/"no" veya "true"/"false")
                if isinstance(value, bool):
                    # Boolean ise string'e çevir (MikroTik "yes"/"no" bekler)
                    params[key] = "yes" if value else "no"
                    logger.info(f"Disabled boolean'dan string'e çevrildi: {value} -> '{params[key]}'")
                elif isinstance(value, str):
                    # String ise normalize et
                    value_lower = value.lower()
                    if value_lower in ("true", "yes", "1"):
                        params[key] = "yes"
                    elif value_lower in ("false", "no", "0"):
                        params[key] = "no"
                    else:
                        params[key] = value  # Olduğu gibi kullan
                    logger.info(f"Disabled string normalize edildi: '{value}' -> '{params[key]}'")
                else:
                    # Diğer tipler için boolean'a çevir sonra string'e
                    bool_value = bool(value)
                    params[key] = "yes" if bool_value else "no"
                    logger.info(f"Disabled diğer tipten string'e çevrildi: {value} -> '{params[key]}'")
                logger.info(f"Disabled parametresi final: '{params[key]}' (tip: {type(params[key])})")
            else:
                params[key] = value
        
        logger.info(f"Peer güncelleme parametreleri: {params}")
        logger.info(f"Peer ID: {peer_id_str}, Interface: {interface}, Disabled: {kwargs.get('disabled')}")
        
        try:
            result = await self.execute_command(
                "/interface/wireguard/peers",
                "set",
                **params
            )
            logger.info(f"Peer güncelleme başarılı. Sonuç: {result}")
            
            # Peer güncellendikten sonra cache'i temizle
            if interface:
                mikrotik_cache.invalidate_pattern(f"wireguard_peers:{interface}")
            
            return result[0] if result else {}
        except Exception as e:
            logger.error(f"Peer güncelleme hatası: {e}")
            logger.error(f"Kullanılan parametreler: {params}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
    
    async def delete_wireguard_peer(self, peer_id: str, interface: str = None) -> bool:
        """
        WireGuard peer'ı siler
        
        Args:
            peer_id: Peer ID (.id field)
            interface: Interface adı (opsiyonel, peer bulmak için kullanılır)
            
        Returns:
            Silme başarılıysa True
        """
        await self.ensure_connected()
        
        # Eğer interface belirtilmişse, peer'ı bulmak için önce listeleme yap
        if interface:
            peers = await self.get_wireguard_peers(interface)
            target_peer = None
            
            logger.info(f"Peer silme: Aranan ID={peer_id}, Interface={interface}, Mevcut peer sayısı={len(peers)}")
            if peers:
                logger.info(f"Mevcut peer ID'leri: {[str(p.get('id') or p.get('.id', 'YOK')) for p in peers]}")
            
            # Peer ID eşleştirmesi - farklı formatları kontrol et
            peer_id_variants = [peer_id, str(peer_id)]
            if str(peer_id).startswith("*"):
                peer_id_variants.append(str(peer_id)[1:])  # *5 -> 5
            
            for p in peers:
                # MikroTik API'den gelen peer verilerinde hem 'id' hem '.id' olabilir
                peer_dot_id = p.get("id") or p.get(".id")
                if peer_dot_id is None:
                    # Tüm anahtarları kontrol et
                    for key in p.keys():
                        if key == 'id' or key == '.id' or (key.endswith('id') and not key.startswith('endpoint')):
                            peer_dot_id = p.get(key)
                            if peer_dot_id:
                                logger.debug(f"Alternatif ID anahtarı bulundu: {key}={peer_dot_id}")
                                break
                    if peer_dot_id is None:
                        continue
                
                peer_dot_id_str = str(peer_dot_id)
                logger.debug(f"Karşılaştırma: Aranan={peer_id}, Mevcut={peer_dot_id_str}")
                
                # Direkt eşleşme
                if peer_dot_id_str in peer_id_variants or peer_dot_id in peer_id_variants:
                    target_peer = p
                    logger.info(f"Peer direkt eşleşme ile bulundu: {peer_dot_id_str}")
                    break
                
                # * karakterini kaldırarak karşılaştırma
                peer_dot_id_normalized = peer_dot_id_str.lstrip("*")
                for variant in peer_id_variants:
                    variant_normalized = str(variant).lstrip("*")
                    if peer_dot_id_normalized == variant_normalized:
                        target_peer = p
                        logger.info(f"Peer normalize edilmiş eşleşme ile bulundu: {peer_dot_id_normalized} == {variant_normalized}")
                        break
                
                if target_peer:
                    break
            
            if target_peer:
                # Gerçek peer ID'yi kullan - MikroTik API'de hem 'id' hem '.id' olabilir
                peer_id = target_peer.get("id") or target_peer.get(".id")
                if peer_id is None:
                    # Peer ID hala None ise, tüm anahtarları kontrol et
                    for key in target_peer.keys():
                        if key == 'id' or key == '.id' or (key.endswith('id') and not key.startswith('endpoint')):
                            peer_id = target_peer.get(key)
                            if peer_id:
                                logger.info(f"Alternatif ID anahtarından peer ID bulundu: {key}={peer_id}")
                                break
                    if peer_id is None:
                        raise Exception(f"Peer bulundu ama ID None. Interface: {interface}, Peer keys: {list(target_peer.keys())}")
                logger.info(f"Peer bulundu, gerçek ID kullanılıyor: {peer_id}")
            else:
                raise Exception(f"Peer bulunamadı (ID: {peer_id}, Interface: {interface})")
        
        # Peer ID kontrolü - None veya geçersiz ise hata fırlat
        if peer_id is None or peer_id == 'None' or peer_id == 'undefined' or peer_id == 'null':
            raise Exception(f"Peer ID geçersiz: {peer_id}. Interface: {interface}. Lütfen sayfayı yenileyin.")
        
        # MikroTik API'de remove komutu için .id parametresi kullanılır
        # routeros-api kütüphanesinde .id parametresi direkt olarak geçilir
        peer_id_str = str(peer_id).strip()
        
        # Geçersiz değer kontrolü
        if peer_id_str == "None" or peer_id_str == "" or peer_id_str == "undefined" or peer_id_str == "null":
            raise Exception(f"Geçersiz Peer ID: '{peer_id_str}'. Interface: {interface}. Lütfen sayfayı yenileyin.")
        
        logger.info(f"Peer silme: Peer ID='{peer_id_str}', Interface={interface}")
        
        try:
            # MikroTik API'de remove komutu için .id parametresi kullanılır
            # routeros-api kütüphanesinde .id parametresi direkt olarak geçilir
            result = await self.execute_command(
                "/interface/wireguard/peers",
                "remove",
                **{".id": peer_id_str}
            )
            logger.info(f"Peer silme başarılı. Sonuç: {result}")
            
            # Peer silindikten sonra cache'i temizle
            if interface:
                mikrotik_cache.invalidate_pattern(f"wireguard_peers:{interface}")
            
            return True
        except Exception as e:
            logger.error(f"Peer silme hatası: {e}")
            logger.error(f"Kullanılan Peer ID: {peer_id_str}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
    
    async def toggle_interface(self, interface_name: str, enable: bool) -> bool:
        """
        Interface'i aç/kapat
        Interface durumu değiştiğinde cache'i temizler
        
        Args:
            interface_name: Interface adı
            enable: True ise aç, False ise kapat
        
        Returns:
            İşlem başarılıysa True
        """
        command = "enable" if enable else "disable"
        await self.execute_command("/interface", command, **{"=.id": interface_name})
        
        # Interface durumu değiştiğinde cache'i temizle
        mikrotik_cache.clear("wireguard_interfaces")
        mikrotik_cache.invalidate_pattern(f"wireguard_peers:{interface_name}")
        
        return True
    
    async def add_wireguard_interface(self, name: str, listen_port: int = None, mtu: int = None, private_key: str = None, **kwargs) -> Dict[str, Any]:
        """
        Yeni WireGuard interface ekler (RouterOS 7+)
        
        Args:
            name: Interface adı
            listen_port: Dinleme portu (opsiyonel, varsayılan: otomatik)
            mtu: MTU değeri (opsiyonel, varsayılan: 1420)
            private_key: Private key (opsiyonel, otomatik oluşturulabilir)
            **kwargs: Diğer parametreler
        
        Returns:
            Oluşturulan interface bilgisi
        """
        # Bağlantının açık olduğundan emin ol
        await self.ensure_connected()
        
        # Interface adı kontrolü
        if not name or not name.strip():
            raise ValueError("Interface adı boş olamaz")
        
        name = name.strip()
        
        # Mevcut interface'leri kontrol et - aynı isimde interface var mı?
        existing_interfaces = await self.get_wireguard_interfaces(use_cache=False)
        for existing_iface in existing_interfaces:
            existing_name = existing_iface.get('name') or existing_iface.get('.id')
            if existing_name == name:
                raise Exception(f"'{name}' adında bir interface zaten mevcut!")
        
        # Parametreleri hazırla
        params = {"name": name}
        
        # Listen port - belirtilmemişse varsayılan port kullan
        if listen_port:
            params["listen-port"] = str(listen_port)
        else:
            # Varsayılan port: 51820 veya mevcut portlardan bir sonraki
            default_port = 51820
            used_ports = []
            for iface in existing_interfaces:
                port = iface.get('listen-port')
                if port:
                    try:
                        used_ports.append(int(port))
                    except:
                        pass
            
            # Kullanılmayan bir port bul
            while default_port in used_ports:
                default_port += 1
            
            params["listen-port"] = str(default_port)
        
        # MTU - belirtilmemişse varsayılan 1420
        if mtu:
            params["mtu"] = str(mtu)
        else:
            params["mtu"] = "1420"
        
        # Private key - belirtilmişse kullan, yoksa otomatik oluştur
        if private_key:
            private_key = str(private_key).strip()
            # Public key'i private key'den türet (wg pubkey komutu ile)
            try:
                import subprocess
                pub_result = subprocess.run(
                    ['wg', 'pubkey'],
                    input=private_key,
                    capture_output=True,
                    text=True,
                    check=True
                )
                public_key = pub_result.stdout.strip()
                params["public-key"] = public_key
            except:
                # wg komutu yoksa veya hata olursa, private key'i direkt kullan
                # MikroTik otomatik olarak public key'i oluşturacak
                logger.warning("Public key oluşturulamadı, MikroTik otomatik oluşturacak")
        else:
            # Private key belirtilmemişse, MikroTik otomatik oluşturacak
            logger.info("Private key belirtilmedi, MikroTik otomatik oluşturacak")
        
        # Diğer parametreleri ekle
        for key, value in kwargs.items():
            if value is not None:
                params[key] = str(value)
        
        logger.info(f"WireGuard interface ekleniyor: name={name}, listen-port={params.get('listen-port')}, mtu={params.get('mtu')}")
        
        # Interface ekle
        result = await self.execute_command(
            "/interface/wireguard",
            "add",
            **params
        )
        
        # Interface eklendikten sonra cache'i temizle
        mikrotik_cache.clear("wireguard_interfaces")
        
        # Sonucu normalize et
        if result:
            interface = dict(result[0]) if isinstance(result[0], dict) else result[0]
            return interface
        
        return {}

    async def add_ip_address(self, address: str, interface: str, **kwargs) -> Dict[str, Any]:
        """
        Interface'e IP adresi ekler

        Args:
            address: IP adresi (CIDR formatında, örn: 192.168.200.1/24)
            interface: Interface adı
            **kwargs: Diğer parametreler

        Returns:
            Oluşturulan IP adresi bilgisi
        """
        # Bağlantının açık olduğundan emin ol
        await self.ensure_connected()

        # Parametreleri hazırla
        params = {
            "address": address,
            "interface": interface
        }

        # Diğer parametreleri ekle
        for key, value in kwargs.items():
            if value is not None:
                params[key] = str(value)

        logger.info(f"IP adresi ekleniyor: address={address}, interface={interface}")

        # IP adresi ekle
        result = await self.execute_command(
            "/ip/address",
            "add",
            **params
        )

        logger.info(f"IP adresi başarıyla eklendi: {address} -> {interface}")

        return result if result else {}

    async def update_wireguard_interface(self, interface_name: str, **kwargs) -> Dict[str, Any]:
        """
        WireGuard interface'i günceller
        
        Args:
            interface_name: Interface adı veya ID
            **kwargs: Güncellenecek parametreler (listen-port, mtu, comment, vb.)
        
        Returns:
            Güncellenmiş interface bilgisi
        """
        # Bağlantının açık olduğundan emin ol
        await self.ensure_connected()
        
        # Interface'i bul
        interfaces = await self.get_wireguard_interfaces(use_cache=False)
        target_interface = None
        
        for iface in interfaces:
            iface_name = iface.get('name') or iface.get('.id')
            if iface_name == interface_name:
                target_interface = iface
                break
        
        if not target_interface:
            raise Exception(f"Interface bulunamadı: {interface_name}")
        
        # Interface ID'yi al
        interface_id = target_interface.get('.id') or target_interface.get('id') or interface_name
        
        # Parametreleri hazırla
        params = {".id": str(interface_id)}
        
        # Güncellenecek parametreleri ekle
        for key, value in kwargs.items():
            if value is not None:
                # MikroTik API'de bazı parametreler tire ile yazılır
                mikrotik_key = key.replace('_', '-')
                params[mikrotik_key] = str(value)
        
        logger.info(f"WireGuard interface güncelleniyor: {interface_name}, Parametreler: {list(params.keys())}")
        
        # Interface güncelle
        result = await self.execute_command(
            "/interface/wireguard",
            "set",
            **params
        )
        
        # Interface güncellendikten sonra cache'i temizle
        mikrotik_cache.clear("wireguard_interfaces")
        
        # Sonucu normalize et
        if result:
            interface = dict(result[0]) if isinstance(result[0], dict) else result[0]
            return interface
        
        return {}
    
    async def delete_wireguard_interface(self, interface_name: str) -> bool:
        """
        WireGuard interface'i siler
        Interface'e atanmış IP adreslerini de otomatik olarak siler

        Args:
            interface_name: Interface adı veya ID

        Returns:
            Silme başarılıysa True
        """
        # Bağlantının açık olduğundan emin ol
        await self.ensure_connected()

        # Interface'i bul
        interfaces = await self.get_wireguard_interfaces(use_cache=False)
        target_interface = None

        for iface in interfaces:
            iface_name = iface.get('name') or iface.get('.id')
            if iface_name == interface_name:
                target_interface = iface
                break

        if not target_interface:
            raise Exception(f"Interface bulunamadı: {interface_name}")

        # Interface ID'yi al
        interface_id = target_interface.get('.id') or target_interface.get('id') or interface_name

        logger.info(f"WireGuard interface siliniyor: {interface_name} (ID: {interface_id})")

        # Önce interface'e atanmış IP adreslerini sil
        try:
            ip_addresses = await self.execute_command("/ip/address", "print")
            deleted_ips = []

            for ip_entry in ip_addresses:
                # Bu IP adresi silinecek interface'e ait mi kontrol et
                ip_interface = ip_entry.get('interface') or ip_entry.get('interface-name')
                if ip_interface == interface_name:
                    ip_id = ip_entry.get('.id') or ip_entry.get('id')
                    ip_address = ip_entry.get('address')

                    if ip_id:
                        logger.info(f"IP adresi siliniyor: {ip_address} ({ip_id})")
                        await self.execute_command(
                            "/ip/address",
                            "remove",
                            **{".id": str(ip_id)}
                        )
                        deleted_ips.append(ip_address)

            if deleted_ips:
                logger.info(f"Toplam {len(deleted_ips)} IP adresi silindi: {', '.join(deleted_ips)}")
        except Exception as e:
            logger.warning(f"IP adresleri silinirken hata oluştu (devam ediliyor): {e}")

        # Interface sil
        await self.execute_command(
            "/interface/wireguard",
            "remove",
            **{".id": str(interface_id)}
        )

        logger.info(f"WireGuard interface başarıyla silindi: {interface_name}")

        # Interface silindikten sonra cache'i temizle
        mikrotik_cache.clear("wireguard_interfaces")
        mikrotik_cache.invalidate_pattern(f"wireguard_peers:{interface_name}")

        return True

    async def add_ip_route(self, dst_address: str, gateway: str, **kwargs) -> Dict[str, Any]:
        """
        MikroTik'e IP route ekler

        Args:
            dst_address: Hedef adres (CIDR formatında, örn: 192.168.30.0/24)
            gateway: Gateway IP adresi (örn: 192.168.100.4)
            **kwargs: Diğer parametreler (comment, distance, vb.)

        Returns:
            Oluşturulan route bilgisi
        """
        # Bağlantının açık olduğundan emin ol
        await self.ensure_connected()

        # Parametreleri hazırla
        params = {
            "dst-address": dst_address,
            "gateway": gateway
        }

        # Diğer parametreleri ekle
        for key, value in kwargs.items():
            if value is not None:
                params[key] = str(value)

        logger.info(f"IP route ekleniyor: dst-address={dst_address}, gateway={gateway}")

        # Önce aynı route'un var olup olmadığını kontrol et
        try:
            existing_routes = await self.execute_command("/ip/route", "print")
            for route in existing_routes:
                if route.get("dst-address") == dst_address and route.get("gateway") == gateway:
                    logger.info(f"⚠️ Route zaten mevcut: {dst_address} via {gateway}")
                    return route
        except Exception as e:
            logger.warning(f"Mevcut route'lar kontrol edilemedi: {e}")

        # Route ekle
        try:
            result = await self.execute_command(
                "/ip/route",
                "add",
                **params
            )

            logger.info(f"✅ IP route başarıyla eklendi: {dst_address} via {gateway}")
            return result[0] if result else {}
        except Exception as e:
            # "already exists" hatası özel olarak işle
            if "already exists" in str(e).lower():
                logger.warning(f"⚠️ Route zaten mevcut: {dst_address} via {gateway}")
                return {"dst-address": dst_address, "gateway": gateway}
            raise

    async def get_ip_routes(self, **kwargs) -> List[Dict[str, Any]]:
        """
        MikroTik'ten IP route'ları getirir

        Args:
            **kwargs: Filtre parametreleri (dst-address, gateway, vb.)

        Returns:
            Route listesi
        """
        await self.ensure_connected()

        if kwargs:
            routes = await self.execute_command("/ip/route", "print", **kwargs)
        else:
            routes = await self.execute_command("/ip/route", "print")

        return routes

    async def get_interface_subnets(self) -> List[str]:
        """
        MikroTik'teki tüm interface'lere atanmış subnet'leri getirir

        Returns:
            Subnet listesi (örn: ["192.168.100.0/24", "10.0.0.0/8"])
        """
        await self.ensure_connected()

        try:
            import ipaddress

            # Tüm IP adreslerini al
            ip_addresses = await self.execute_command("/ip/address", "print")

            subnets = []
            for ip_entry in ip_addresses:
                address = ip_entry.get('address')  # "192.168.100.1/24" formatında
                if address:
                    try:
                        # IP adresinden subnet'i çıkar
                        network = ipaddress.ip_network(address, strict=False)
                        subnet_str = str(network)  # "192.168.100.0/24"
                        if subnet_str not in subnets:
                            subnets.append(subnet_str)
                            logger.debug(f"Interface subnet bulundu: {subnet_str} (IP: {address})")
                    except Exception as e:
                        logger.warning(f"IP adresi parse edilemedi: {address}, Hata: {e}")

            logger.info(f"📋 MikroTik'te toplam {len(subnets)} farklı subnet bulundu")
            return subnets
        except Exception as e:
            logger.error(f"❌ Interface subnet'leri alınamadı: {e}")
            return []

    async def delete_ip_route(self, dst_address: str = None, gateway: str = None, route_id: str = None) -> bool:
        """
        MikroTik'ten IP route siler

        Args:
            dst_address: Hedef adres (CIDR formatında, örn: 192.168.30.0/24)
            gateway: Gateway IP adresi (örn: 192.168.100.4)
            route_id: Route ID (dst_address ve gateway yerine direkt ID verilebilir)

        Returns:
            Silme başarılıysa True
        """
        await self.ensure_connected()

        if route_id:
            # Direkt ID ile sil
            logger.info(f"IP route siliniyor (ID): {route_id}")
            try:
                await self.execute_command("/ip/route", "remove", **{".id": route_id})
                logger.info(f"✅ IP route silindi (ID): {route_id}")
                return True
            except Exception as e:
                logger.error(f"❌ IP route silinemedi (ID: {route_id}): {e}")
                return False
        elif dst_address and gateway:
            # dst-address ve gateway ile route'u bul ve sil
            logger.info(f"IP route aranıyor: {dst_address} via {gateway}")
            try:
                routes = await self.execute_command("/ip/route", "print")
                for route in routes:
                    if route.get("dst-address") == dst_address and route.get("gateway") == gateway:
                        route_id = route.get(".id") or route.get("id")
                        if route_id:
                            logger.info(f"IP route bulundu, siliniyor: {route_id}")
                            await self.execute_command("/ip/route", "remove", **{".id": route_id})
                            logger.info(f"✅ IP route silindi: {dst_address} via {gateway}")
                            return True
                logger.warning(f"⚠️ IP route bulunamadı: {dst_address} via {gateway}")
                return False
            except Exception as e:
                logger.error(f"❌ IP route silinemedi ({dst_address} via {gateway}): {e}")
                return False
        elif dst_address:
            # Sadece dst-address ile route'u bul ve sil
            logger.info(f"IP route aranıyor (dst-address): {dst_address}")
            try:
                routes = await self.execute_command("/ip/route", "print")
                deleted_count = 0
                for route in routes:
                    if route.get("dst-address") == dst_address:
                        route_id = route.get(".id") or route.get("id")
                        if route_id:
                            logger.info(f"IP route bulundu, siliniyor: {route_id}")
                            await self.execute_command("/ip/route", "remove", **{".id": route_id})
                            deleted_count += 1
                if deleted_count > 0:
                    logger.info(f"✅ {deleted_count} IP route silindi: {dst_address}")
                    return True
                else:
                    logger.warning(f"⚠️ IP route bulunamadı: {dst_address}")
                    return False
            except Exception as e:
                logger.error(f"❌ IP route silinemedi ({dst_address}): {e}")
                return False
        else:
            logger.error("❌ Route silmek için dst_address, gateway veya route_id gerekli")
            return False


# Global connection instance
mikrotik_conn = MikroTikConnection()


