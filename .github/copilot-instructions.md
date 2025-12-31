# 🤖 AI Copilot Talimatları - WireGuard Manager

Bu belge, AI kodlama ajanlarını WireGuard Manager Panel kod tabanı içinde verimli geliştirme için rehberlik eder.

## Proje Özeti

**WireGuard Manager Panel**, MikroTik RouterOS v7+ WireGuard VPN yönetimi için modern bir web arayüzüdür. FastAPI backend ile React frontend'i birleştirerek dashboard, peer yönetimi, IP havuzu ve gerçek zamanlı izleme sağlar.

- **Backend**: FastAPI (Python 3.9+) async SQLAlchemy ORM ile
- **Frontend**: React 18 + Vite, Zustand state management ile  
- **Entegrasyonlar**: MikroTik RouterOS API, WebSocket gerçek zamanlı güncellemeler
- **Ana Portlar**: Backend 8001, Frontend 5173

## Mimari Özeti

### Hizmet Sınırları

**Backend** (`/backend/app/`)
- **API Rotaları** (`/api/`): 18+ modüler router (auth, wireguard, users, notifications, vb.)
- **Modeller** (`/models/`): SQLAlchemy ORM sınıfları (User, WireGuardInterface, Peer, IPAllocation, vb.)
- **MikroTik Entegrasyonu** (`/mikrotik/connection.py`): RouterOS API için global singleton bağlantı yöneticisi
- **WebSocket** (`/websocket/`): `ConnectionManager` aracılığıyla gerçek zamanlı güncellemeler
- **Hizmetler** (`/services/`): İş mantığı (peer_handshake_service, traffic_scheduler, notification_service)
- **Güvenlik** (`/security/`): JWT kimlik doğrulaması, parola şifrelemesi, 2FA ve TOTP

**Frontend** (`/frontend/src/`)
- **Depo** (`/store/authStore.js`): Zustand state (auth, user, tokens) - TEK gerçeklik kaynağı
- **Hizmetler** (`/services/`): Axios tabanlı API istemcileri + WebSocket tüketicisi
- **Sayfalar** (`/pages/`): Rota haritasındaki bileşenler (Dashboard, WireGuardInterfaces, vb.)
- **Bileşenler** (`/components/`): Yeniden kullanılabilir UI (Layout, formlar, kartlar)
- **Bağlam** (`/context/`): React Context for ToastProvider, NotificationProvider

### Veri Akışı Deseni

```
MikroTik RouterOS ←→ Backend API ←→ Frontend UI
                     ↓
                  WebSocket (gerçek zamanlı)
                     ↓
                   Peer durumu, bildirimler
```

1. **Backend**, `mikrotik_conn` aracılığıyla MikroTik'e bağlanır (async librouteros wrapper)
2. **API**, WireGuard işlemlerini yürütür, aktiviteleri kaydeder, WebSocket güncellemelerini yayınlar
3. **Frontend**, canlı panolar için WebSocket `ConnectionManager` aracılığıyla güncellemeleri alır
4. **Bildirimler**, kullanıcı_id başına WebSocket üzerinden async olarak iletilir

## Kritik Desenler & Kurallar

### Backend Desenleri

**API Rota Yapısı** - Tüm routerlar bu deseni izler:
```python
# backend/app/api/wireguard.py
router = APIRouter()

@router.post("/peers/{interface}/create")
async def create_peer(
    interface: str,
    peer_data: PeerCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. MikroTik bağlantısını doğrula
    if not mikrotik_conn.is_connected:
        raise HTTPException(status_code=503, detail="MikroTik not connected")
    
    # 2. MikroTik işlemini çalıştır (async)
    result = await mikrotik_conn.add_peer(...)
    
    # 3. Aktiviteyi kaydet
    await create_log(db, user_id=current_user.id, action="peer_created", details={...})
    
    # 4. Gerçek zamanlı güncellemeleri gönder
    await notify_peer_created(...)
    
    # 5. Yanıtı döndür
    return {"success": True, "peer_id": result['peer_id']}
```

**Async Veritabanı Deseni** - Her zaman `AsyncSession` kullan:
```python
from app.database.database import AsyncSessionLocal, get_db
from sqlalchemy import select

# Rotta içinde: db = Depends(get_db)
async with db:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
```

**MikroTik Bağlantısı** - Global singleton, başlangıçta lazy-initialized:
```python
# backend/app/mikrotik/connection.py
mikrotik_conn = MikroTikConnection()  # Global instance

# Uygulama başlangıçta (main.py lifespan):
await mikrotik_conn.connect()  # DB ayarlarından yükle, hatada otomatik yeniden dene
```

**Bildirim Sistemi** - Async bildirim iletimi için arka plan görev deseni:
```python
# API yanıtını engellemeyen kullanıcı_id başına WebSocket bildirimlerini gönder
await notify_peer_created(
    db=db,
    peer_name="client1",
    interface="wg0",
    user_id=current_user.id
)
# background_tasks.add_task() aracılığıyla arka planda çalışır
```

### Frontend Desenleri

**State Yönetimi** - Zustand store auth için tek gerçeklik kaynağıdır:
```javascript
// frontend/src/store/authStore.js
import { create } from 'zustand'

const useAuthStore = create((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  login: async (username, password) => {
    const response = await api.post('/auth/login', {...})
    set({ accessToken: response.data.access_token, ... })
  },
  refreshAccessToken: async () => { ... },
}))

// Bileşenlerde kullanım:
const { accessToken, user } = useAuthStore()
```

**API İstemcisi** - Interceptor'larla tek axios instance:
```javascript
// frontend/src/services/api.js
const api = axios.create({ baseURL: "/api/v1" })

// Zustand'dan Bearer token otomatik ekle
api.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${useAuthStore.getState().accessToken}`
  return config
})

// 401'de refresh token ile otomatik yeniden dene
api.interceptors.response.use(response => response, async (error) => {
  if (error.response.status === 401) {
    await useAuthStore.getState().refreshAccessToken()
    return api(error.config)
  }
})
```

**WebSocket Tüketicisi** - Panolar için gerçek zamanlı güncellemeler:
```javascript
// frontend/src/services/websocket.js
const ws = new WebSocket(`wss://host/api/v1/ws/interface/${interfaceName}`)
ws.onmessage = (event) => {
  const update = JSON.parse(event.data)
  // Bileşen state veya Zustand güncelle
  setInterfaceStats(update.stats)
}
```

**Bileşen Düzeni** - Tüm sayfalar Layout içinde sarılı (header, sidebar):
```javascript
// App.jsx routing
<Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
  <Route path="dashboard" element={<Dashboard />} />
  <Route path="wireguard/:interfaceName" element={<WireGuardInterfaceDetail />} />
  // ... 10+ daha fazla rota
</Route>
```

## Geliştirici İş Akışları

### Kurulum & Geliştirme

**İlk kurulum:**
```bash
# Tüm bağımlılıkları kur (Python/Node otomatik tespit eder)
sudo bash install.sh

# Environment yapılandır (MikroTik bağlantısı için interaktif istemler)
bash setup_environment.sh

# Her iki hizmeti de başlat (backend:8001, frontend:5173)
bash start_all.sh
```

**Backend geliştirme:**
```bash
cd backend
source venv/bin/activate
python run.py  # FastAPI + Uvicorn on 8001

# Veya otomatik yeniden yükleme ile debug modunda
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

**Frontend geliştirme:**
```bash
cd frontend
npm install  # İlk seferinde
npm run dev  # Vite dev server on 5173 (HMR etkinleştirildi)

# Production build
npm run build  # Dağıtım için dist/ oluşturur
```

### Test & Hata Ayıklama

**Backend test scripti** - API'nin yanıt verip vermediğini doğrular:
```bash
bash TEST-BACKEND.sh  # venv, DB, MikroTik bağlantısını kontrol eder
```

**Logları görüntüle:**
```bash
# Geliştirme
tail -f backend/logs/backend.log
tail -f frontend.log

# Production (systemd)
sudo journalctl -u wg-backend -f
sudo journalctl -u wg-frontend -f
```

**Servis durumunu kontrol et:**
```bash
bash status.sh  # Portları, pid'leri, hızlı sağlık kontrolü gösterir
```

**Yaygın debug desenleri:**
- **401 Kimlik Doğrulama Hataları**: .env'de JWT SECRET_KEY'i kontrol et, token yenileme mantığını doğrula
- **MikroTik bağlantısı başarısız olur**: Veritabanında host/port/username'i doğrula (MikroTikSettings tablosu)
- **CORS hataları**: .env'de CORS_ORIGINS'i kontrol et, frontend kaynağını eklemelisin
- **WebSocket düşüyor**: Ağı kontrol et, ws endpoint'inin çalıştığını doğrula (app/api/websocket.py)

### Dağıtım

**Hızlı production kurulum:**
```bash
# Production için yapılandır
bash setup_environment.sh  # "production"ı seç

# Tam dağıtım (systemd, nginx isteğe bağlı, yedekler)
sudo bash deploy.sh
```

**Systemd servis yönetimi:**
```bash
sudo systemctl start wg-backend wg-frontend
sudo systemctl restart wg-backend
sudo systemctl stop wg-backend
```

## Kritik Uygulama Detayları

### Veritabanı Şeması

Bağıntılarla temel tablolar:
- **users**: id, username, email, hashed_password, is_admin, 2fa_enabled
- **wireguard_interfaces**: id, name, address, listen_port, status (on/off)
- **wireguard_peers**: id, interface_id, public_key, allowed_ips, status
- **ip_allocations**: id, pool_id, peer_id, assigned_ip (IP atamalarını izler)
- **activity_logs**: id, user_id, action, details, timestamp (audit trail)
- **sessions**: id, user_id, token, expires_at (çoklu oturum desteği)
- **notifications**: id, user_id, category, message (WebSocket iletimi)

Göçleri çalıştır: `alembic upgrade head` (gerekirse)

### Kimlik Doğrulama Akışı

1. **Login**: POST `/auth/login` → username/password doğrular
2. **2FA Kontrolü**: Etkinse, `requires_2fa: true` + `pending_token` döndürür
3. **2FA Doğrulaması**: POST `/auth/verify-2fa` TOTP kodu ile
4. **Token Yanıtı**: `access_token` (30 dakika) + `refresh_token` (7 gün)
5. **Yenileme**: POST `/auth/refresh` → yeni access_token süre dolmadan önce
6. **Oturum Takibi**: Güvenlik için DB'de saklanır (kullanıcı başına maks. 5 oturum)

### Hız Sınırlaması & Güvenlik

- **Varsayılan**: 200 istek/dakika (`RATE_LIMIT_PER_MINUTE` ile yapılandırılabilir)
- **Login endpoint**: 5 denemesi/dakika (brute-force koruması)
- **Hesap kilitleme**: 5 başarısız deneme → 15 dakika kilitleme
- **HTTPS yönlendir**: `ENABLE_HTTPS_REDIRECT=true` ile production'da etkinleştir

## Entegrasyon Noktaları

### MikroTik API (librouteros)

- RouterOS API binary protokolü etrafında async wrapper
- Metodlar: `add_interface()`, `add_peer()`, `get_peers()`, `remove_peer()`
- Hata işleme: Geçici hatalar için yeniden deneme mantığı, zarif bozulma
- Örnek: [backend/app/mikrotik/connection.py](../backend/app/mikrotik/connection.py)

### Dış Bağımlılıklar

- **routeros-api** (0.19.0): MikroTik RouterOS API istemcisi
- **pyotp** (2.9.0): 2FA için TOTP
- **qrcode** (7.4.2): Peer config QR kodu oluşturma
- **slowapi** (0.1.9): Hız sınırlaması
- **chart.js**: Frontend trafik grafikleri

## Yaygın Sorunlar & Çözümler

| Sorun | Kök Neden | Çözüm |
|-------|-----------|--------|
| **502 Bad Gateway** | Backend çöktü veya yanıt vermiyor | `systemctl status wg-backend` kontrol et, logları görüntüle, yeniden başlat |
| **Frontend 404 hatası (dağıtımdan sonra)** | dist/ eksik veya nginx yanlış yapılandırılmış | `npm run build` çalıştır, nginx config'i kontrol et |
| **"MikroTik not connected"** | .env config eksik veya bağlantı başarısız | `bash setup_environment.sh` çalıştır, host/port erişebilir mi kontrol et |
| **WebSocket takılı kalıyor** | Ağ timeout veya server çöktü | Firewall kontrol et, backend yeniden başlat, ws endpoint kontrol et |
| **Database locked (SQLite)** | Çok fazla process aynı anda yazıyor | Production'da PostgreSQL kullan, SQLite'a WAL modu ekle |
| **CORS "Access-Control-Allow-Origin"** | Frontend origin CORS_ORIGINS'de yok | `.env` CORS_ORIGINS'i güncelle, frontend URL'sini ekle |

## Bilmeniz Gereken Ana Dosyalar

| Dosya | Amaç |
|-------|-------|
| [backend/app/main.py](../backend/app/main.py) | Uygulama başlangıcı, lifespan hook'ları, middleware kurulumu |
| [backend/app/api/wireguard.py](../backend/app/api/wireguard.py) | WireGuard interface & peer endpoint'leri (2800+ satır, ana özellik) |
| [backend/app/config.py](../backend/app/config.py) | Pydantic ayarları, env var doğrulaması |
| [backend/app/mikrotik/connection.py](../backend/app/mikrotik/connection.py) | MikroTik bağlantı yöneticisi |
| [backend/app/websocket/connection_manager.py](../backend/app/websocket/connection_manager.py) | WebSocket yayın mantığı |
| [frontend/src/store/authStore.js](../frontend/src/store/authStore.js) | Auth state için tek gerçeklik kaynağı |
| [frontend/src/services/api.js](../frontend/src/services/api.js) | Interceptor'lı Axios istemcisi |
| [frontend/src/App.jsx](../frontend/src/App.jsx) | Rota tanımları, protected routes |
| [backend/.env.example](../backend/.env.example) | Gerekli env var template'i |
| [PROJECT_GUIDE.md](../PROJECT_GUIDE.md) | Türkçe kapsamlı dokümantasyon |

## Değişiklik Yapmadan Önce Kontrol Etmeli Olduğunuz Alanlar

Kritik bölümleri değiştirmeden önce şunları anla:
- **Kimlik doğrulama akışı**: Güvenliği ve kullanıcı erişimini etkiler
- **MikroTik bağlantı yaşam döngüsü**: Başlatma, yeniden bağlanma, hata işleme
- **Veritabanı migrations**: Şema değişiklikleri dağıtımı etkiler
- **API kontratı**: Breaking changes frontend'i etkiler
- **WebSocket protokolü**: Mesaj format değişiklikleri gerçek zamanlı özellik kırar

Önemli değişiklikler için [PROJECT_GUIDE.md](../PROJECT_GUIDE.md) dosyasındaki güvenlik, dağıtım ve test bölümlerine bakın.
