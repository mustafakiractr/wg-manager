/**
 * Ana layout bileşeni
 * Sidebar, topbar ve sayfa içeriğini içerir
 */
import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../services/api'
import {
  LayoutDashboard,
  Network,
  FileText,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  Wifi,
  Power,
  PowerOff,
  TrendingUp,
  Users,
  Settings as SettingsIcon,
  User,
  Database,
  Layers,
  Archive,
  Clock,
  Shield,
} from 'lucide-react'
import NotificationDropdown from './NotificationDropdown'

function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Sistem temasını algıla
  const getSystemTheme = () => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  }
  
  // Tema tercihi: localStorage'dan oku, yoksa sistem temasını kullan
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('darkMode')
    if (stored !== null) {
      return stored === 'true'
    }
    return getSystemTheme()
  })
  
  const [mikrotikConnected, setMikrotikConnected] = useState(false)
  const [checkingConnection, setCheckingConnection] = useState(false)
  const [userProfile, setUserProfile] = useState(null)

  // Karanlık mod değiştiğinde HTML'e class ekle
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('darkMode', 'true')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('darkMode', 'false')
    }
  }, [darkMode])

  // Kullanıcı profil bilgilerini yükle (avatar dahil)
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await api.get('/users/me')
        if (response.data.success) {
          setUserProfile(response.data.data)
        }
      } catch (error) {
        console.error('Kullanıcı profili yüklenemedi:', error)
      }
    }
    fetchUserProfile()
  }, [])

  // MikroTik bağlantı durumunu kontrol et
  const checkMikrotikStatus = async () => {
    try {
      const response = await api.get('/mikrotik/status')
      if (response.data.success) {
        setMikrotikConnected(response.data.connected || false)
      }
    } catch (error) {
      console.error('MikroTik durum kontrolü hatası:', error)
      setMikrotikConnected(false)
    }
  }

  // MikroTik bağlantısını aç/kapat
  const toggleMikrotikConnection = async () => {
    setCheckingConnection(true)
    try {
      if (mikrotikConnected) {
        // Bağlantıyı kapatmak için test endpoint'ini çağır (bağlantıyı kapatır)
        // Ancak backend'de bağlantıyı kapatma endpoint'i yok, bu yüzden sadece durumu kontrol edelim
        await checkMikrotikStatus()
      } else {
        // Bağlantıyı açmak için test endpoint'ini çağır
        const response = await api.get('/mikrotik/test')
        if (response.data.success && response.data.connected) {
          setMikrotikConnected(true)
        } else {
          setMikrotikConnected(false)
        }
      }
    } catch (error) {
      console.error('MikroTik bağlantı hatası:', error)
      setMikrotikConnected(false)
    } finally {
      setCheckingConnection(false)
    }
  }

  // İlk yüklemede ve periyodik olarak bağlantı durumunu kontrol et
  useEffect(() => {
    // Sayfa yüklendiğinde hemen kontrol et
    checkMikrotikStatus()
    // Her 10 saniyede bir durumu kontrol et
    const interval = setInterval(checkMikrotikStatus, 10000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  // MikroTik bağlantısı kopmuşsa otomatik yeniden bağlanmayı dene
  useEffect(() => {
    if (!mikrotikConnected && !checkingConnection) {
      // Bağlantı yoksa ve kontrol yapılmıyorsa, 30 saniye sonra tekrar dene
      const retryTimeout = setTimeout(() => {
        toggleMikrotikConnection()
      }, 30000) // 30 saniye bekle
      return () => clearTimeout(retryTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mikrotikConnected, checkingConnection])

  // Menü öğeleri
  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/wireguard', icon: Network, label: 'WireGuard' },
    { path: '/ip-pools', icon: Database, label: 'IP Pool' },
    { path: '/peer-templates', icon: Layers, label: 'Peer Şablonları' },
    { path: '/mikrotik', icon: Wifi, label: 'MikroTik Bağlantı' },
    { path: '/logs', icon: FileText, label: 'Loglar' },
    { path: '/traffic', icon: TrendingUp, label: 'Trafik Geçmişi' },
    { path: '/users', icon: Users, label: 'Kullanıcılar' },
    { path: '/activity', icon: Power, label: 'Aktivite Geçmişi' },
    { path: '/backup', icon: Archive, label: 'Backup Yönetimi' },
    { path: '/settings', icon: SettingsIcon, label: 'Ayarlar' },
  ]

  // Aktif menü öğesini kontrol et
  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard'
    }
    return location.pathname.startsWith(path)
  }

  // Avatar URL'ini al
  const getAvatarUrl = () => {
    if (!userProfile?.avatar_url) return null
    // Backend'den gelen URL zaten /api/v1/avatar/* formatında
    // Vite proxy otomatik olarak backend'e yönlendirir
    return userProfile.avatar_url
  }

  // Profil sayfasına git
  const handleAvatarClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('Avatar clicked, navigating to /settings')
    navigate('/settings')
    setSidebarOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar - Mobilde overlay, desktop'ta sabit */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="h-full flex flex-col">
          {/* Logo ve başlık */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">
              Router Manager
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              MikroTik Yönetim
            </p>
          </div>

          {/* Menü */}
          <nav className="flex-1 p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive(item.path)
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Kullanıcı bilgisi ve çıkış */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            {/* Avatar ve profil bilgisi */}
            <Link
              to="/settings"
              onClick={() => setSidebarOpen(false)}
              className="mb-3 px-4 py-3 flex items-center gap-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors block"
            >
              {/* Avatar */}
              <div className="flex-shrink-0">
                {getAvatarUrl() ? (
                  <img
                    src={getAvatarUrl()}
                    alt="Profil"
                    className="w-12 h-12 rounded-full object-cover border-2 border-primary-200 dark:border-primary-700"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900 border-2 border-primary-200 dark:border-primary-700 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  </div>
                )}
              </div>
              {/* Kullanıcı bilgileri */}
              <div className="flex-1 min-w-0 text-sm">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {userProfile?.username || user?.username}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {userProfile?.email || user?.email || 'Kullanıcı'}
                </p>
              </div>
            </Link>
            {/* Çıkış butonu */}
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Çıkış Yap</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay - Mobilde sidebar açıkken */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Ana içerik alanı */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Mobil menü butonu */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {sidebarOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>

              {/* Sayfa başlığı */}
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {menuItems.find((item) => isActive(item.path))?.label || 'Dashboard'}
              </h2>

              {/* Sağ üst köşe butonları */}
              <div className="flex items-center gap-2">
                {/* Bildirimler */}
                <NotificationDropdown />

                {/* MikroTik bağlantı durumu ve toggle butonu */}
                <button
                  onClick={toggleMikrotikConnection}
                  disabled={checkingConnection}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                    mikrotikConnected
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                  } ${checkingConnection ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={mikrotikConnected ? 'MikroTik Bağlı - Tıklayarak yeniden bağlan' : 'MikroTik Bağlı Değil - Tıklayarak bağlan'}
                >
                  {checkingConnection ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      <span>Bağlanıyor...</span>
                    </>
                  ) : (
                    <>
                      {mikrotikConnected ? (
                        <>
                          <Power className="w-4 h-4" />
                          <span className="hidden sm:inline">ON</span>
                        </>
                      ) : (
                        <>
                          <PowerOff className="w-4 h-4" />
                          <span className="hidden sm:inline">OFF</span>
                        </>
                      )}
                    </>
                  )}
                  {/* Durum göstergesi nokta */}
                  <span
                    className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                      mikrotikConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                    }`}
                  ></span>
                </button>

                {/* Karanlık mod toggle */}
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 group"
                  title={darkMode ? 'Aydınlık Tema' : 'Karanlık Tema'}
                >
                  {darkMode ? (
                    <Sun className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <Moon className="w-5 h-5 text-indigo-500" />
                  )}
                  {/* Tooltip */}
                  <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs font-medium text-white bg-gray-900 dark:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {darkMode ? 'Aydınlık Tema' : 'Karanlık Tema'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Sayfa içeriği */}
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout


