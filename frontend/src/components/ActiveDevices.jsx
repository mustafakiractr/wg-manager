/**
 * Aktif Cihazlar bileşeni
 * Kullanıcının aktif session'larını listeler ve yönetir
 */
import { useState, useEffect } from 'react'
import { Monitor, Smartphone, Tablet, MapPin, Clock, LogOut, AlertCircle } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { getSessions, revokeSession, revokeAllSessions } from '../services/sessionService'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

function ActiveDevices() {
  const toast = useToast()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState(null)

  // Session'ları yükle
  const loadSessions = async () => {
    setLoading(true)
    try {
      const data = await getSessions()
      setSessions(data.sessions || [])
    } catch (error) {
      console.error('Session\'lar yüklenemedi:', error)
      toast.error('Cihaz listesi yüklenemedi: ' + (error.response?.data?.detail || error.message))
    }
    setLoading(false)
  }

  useEffect(() => {
    loadSessions()
  }, [])

  // Device icon belirle
  const getDeviceIcon = (deviceType) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="w-5 h-5" />
      case 'tablet':
        return <Tablet className="w-5 h-5" />
      case 'desktop':
      default:
        return <Monitor className="w-5 h-5" />
    }
  }

  // Session'ı iptal et
  const handleRevokeSession = async (sessionId) => {
    if (!confirm('Bu cihazdan çıkış yapmak istediğinizden emin misiniz?')) {
      return
    }

    setRevoking(sessionId)
    try {
      await revokeSession(sessionId)
      toast.success('Oturum sonlandırıldı')
      await loadSessions()
    } catch (error) {
      console.error('Session iptal edilemedi:', error)
      toast.error('Oturum sonlandırılamadı: ' + (error.response?.data?.detail || error.message))
    }
    setRevoking(null)
  }

  // Tüm session'ları iptal et
  const handleRevokeAll = async () => {
    if (!confirm('Tüm diğer cihazlardan çıkış yapmak istediğinizden emin misiniz?')) {
      return
    }

    setLoading(true)
    try {
      await revokeAllSessions()
      toast.success('Tüm cihazlardan çıkış yapıldı')
      await loadSessions()
    } catch (error) {
      console.error('Tüm session\'lar iptal edilemedi:', error)
      toast.error('İşlem başarısız: ' + (error.response?.data?.detail || error.message))
    }
    setLoading(false)
  }

  // Zaman formatla
  const formatLastActivity = (dateString) => {
    try {
      const date = new Date(dateString)
      return formatDistanceToNow(date, { addSuffix: true, locale: tr })
    } catch (e) {
      return 'Bilinmiyor'
    }
  }

  if (loading && sessions.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Başlık ve tümünü iptal et butonu */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Aktif Cihazlar
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {sessions.length} aktif oturum
          </p>
        </div>

        {sessions.length > 1 && (
          <button
            onClick={handleRevokeAll}
            disabled={loading}
            className="btn btn-danger btn-sm"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Tüm Cihazlardan Çıkış Yap
          </button>
        )}
      </div>

      {/* Session listesi */}
      {sessions.length === 0 ? (
        <div className="card">
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Aktif oturum bulunamadı
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`card ${session.is_current ? 'border-2 border-primary-500' : ''}`}
            >
              <div className="flex items-start justify-between">
                {/* Sol: Device bilgileri */}
                <div className="flex items-start space-x-4 flex-1">
                  {/* Device icon */}
                  <div className={`p-3 rounded-lg ${
                    session.is_current
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}>
                    {getDeviceIcon(session.device_type)}
                  </div>

                  {/* Bilgiler */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {session.device_name || 'Bilinmeyen Cihaz'}
                      </h4>
                      {session.is_current && (
                        <span className="px-2 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded">
                          Bu Cihaz
                        </span>
                      )}
                    </div>

                    {/* IP ve konum */}
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                      {session.ip_address && (
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-4 h-4" />
                          <span>{session.ip_address}</span>
                        </div>
                      )}
                      {session.location && (
                        <span>{session.location}</span>
                      )}
                    </div>

                    {/* Son aktivite */}
                    <div className="flex items-center space-x-1 mt-2 text-xs text-gray-500 dark:text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>Son aktivite: {formatLastActivity(session.last_activity)}</span>
                    </div>

                    {/* Oluşturulma zamanı */}
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Oluşturuldu: {new Date(session.created_at).toLocaleString('tr-TR')}
                    </div>
                  </div>
                </div>

                {/* Sağ: İptal butonu */}
                {!session.is_current && (
                  <button
                    onClick={() => handleRevokeSession(session.id)}
                    disabled={revoking === session.id}
                    className="btn btn-secondary btn-sm ml-4"
                  >
                    {revoking === session.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                        İptal ediliyor...
                      </>
                    ) : (
                      <>
                        <LogOut className="w-4 h-4 mr-2" />
                        Oturumu Sonlandır
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bilgilendirme */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">Güvenlik İpucu</p>
            <p>
              Tanımadığınız bir cihaz görüyorsanız, hemen o oturumu sonlandırın ve şifrenizi değiştirin.
              Ayrıca iki faktörlü doğrulamayı (2FA) etkinleştirmeyi düşünün.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ActiveDevices
