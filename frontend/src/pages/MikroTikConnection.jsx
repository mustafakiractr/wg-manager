/**
 * MikroTik Bağlantı Test Sayfası
 * Router bağlantısını test eder ve durum bilgilerini gösterir
 */
import { useState, useEffect } from 'react'
import { testConnection, getConnectionStatus, updateConnectionConfig } from '../services/mikrotikService'
import { 
  Wifi, 
  WifiOff, 
  CheckCircle, 
  XCircle, 
  Loader, 
  RefreshCw,
  Server,
  Shield,
  Settings,
  Save,
  Edit2,
  X
} from 'lucide-react'

function MikroTikConnection() {
  const [testing, setTesting] = useState(false) // Test işlemi devam ediyor mu?
  const [connectionStatus, setConnectionStatus] = useState(null) // Bağlantı durumu bilgisi
  const [testResult, setTestResult] = useState(null) // Test sonucu
  const [loading, setLoading] = useState(true) // İlk yükleme durumu
  const [editing, setEditing] = useState(false) // Düzenleme modu aktif mi?
  const [saving, setSaving] = useState(false) // Kaydetme işlemi devam ediyor mu?
  const [formData, setFormData] = useState({ // Form verileri
    host: '',
    port: 8728,
    username: '',
    password: '',
    use_tls: false
  })

  // Sayfa yüklendiğinde durum bilgisini al
  useEffect(() => {
    loadStatus()
  }, [])

  // Durum bilgisi yüklendiğinde form verilerini güncelle
  useEffect(() => {
    if (connectionStatus) {
      setFormData({
        host: connectionStatus.host || '',
        port: connectionStatus.port || 8728,
        username: connectionStatus.username || '',
        password: connectionStatus.password === '***' ? '' : connectionStatus.password || '', // Şifre maskelenmişse boş bırak
        use_tls: connectionStatus.use_tls || false
      })
    }
  }, [connectionStatus])

  /**
   * Bağlantı durum bilgisini yükler (bağlantı kurmadan)
   */
  const loadStatus = async () => {
    try {
      setLoading(true)
      const status = await getConnectionStatus()
      setConnectionStatus(status)
    } catch (error) {
      console.error('Durum bilgisi alınamadı:', error)
      setConnectionStatus({
        success: false,
        message: 'Durum bilgisi alınamadı'
      })
    } finally {
      setLoading(false)
    }
  }

  /**
   * MikroTik router bağlantısını test eder
   */
  const handleTest = async () => {
    try {
      setTesting(true)
      setTestResult(null)
      
      // Test endpoint'ini çağır
      const result = await testConnection()
      setTestResult(result)
      
      // Test sonrası durum bilgisini yenile
      await loadStatus()
    } catch (error) {
      console.error('Bağlantı testi hatası:', error)
      setTestResult({
        success: false,
        connected: false,
        message: error.response?.data?.detail || 'Bağlantı testi başarısız oldu',
        host: connectionStatus?.host || 'Bilinmiyor',
        port: connectionStatus?.port || 'Bilinmiyor'
      })
    } finally {
      setTesting(false)
    }
  }

  /**
   * Form verilerini günceller
   */
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value) || 0 : value)
    }))
  }

  /**
   * Düzenleme modunu açar/kapatır
   */
  const handleEditToggle = () => {
    if (editing) {
      // İptal edildiğinde mevcut değerlere geri dön
      if (connectionStatus) {
        setFormData({
          host: connectionStatus.host || '',
          port: connectionStatus.port || 8728,
          username: connectionStatus.username || '',
          password: '',
          use_tls: connectionStatus.use_tls || false
        })
      }
    }
    setEditing(!editing)
  }

  /**
   * Yapılandırmayı kaydeder
   */
  const handleSave = async () => {
    try {
      setSaving(true)
      
      // Sadece doldurulmuş alanları gönder
      const updateData = {}
      if (formData.host) updateData.host = formData.host
      if (formData.port) updateData.port = formData.port
      if (formData.username) updateData.username = formData.username
      if (formData.password) updateData.password = formData.password
      updateData.use_tls = formData.use_tls
      
      console.log('Kaydedilecek veri:', updateData)
      console.log('API endpoint:', '/mikrotik/config')
      
      const result = await updateConnectionConfig(updateData)
      
      console.log('Kayıt sonucu:', result)
      
      // Başarılı kayıt sonrası durumu yenile
      await loadStatus()
      setEditing(false)
      setTestResult(null) // Test sonucunu temizle
      
      // Başarı mesajı göster
      alert('Yapılandırma başarıyla kaydedildi!')
    } catch (error) {
      console.error('Kaydetme hatası:', error)
      console.error('Hata detayları:', {
        message: error.message,
        response: error.response,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method
      })
      
      // Daha detaylı hata mesajı
      let errorMessage = 'Bilinmeyen hata'
      
      if (error.response) {
        // Sunucu yanıt verdi
        errorMessage = error.response.data?.detail || error.response.data?.message || `Sunucu hatası: ${error.response.status}`
      } else if (error.request) {
        // İstek gönderildi ama yanıt alınamadı (Network Error)
        const fullURL = error.config ? `${error.config.baseURL}${error.config.url}` : 'unknown'
        errorMessage = `Sunucuya bağlanılamadı (${fullURL}). Lütfen backend'in çalıştığından emin olun.`
      } else {
        // İstek hazırlanırken hata oluştu
        errorMessage = error.message || 'Bilinmeyen hata'
      }
      
      alert('Kaydetme hatası: ' + errorMessage)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-0">
      {/* Sayfa başlığı */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          MikroTik Bağlantı Testi
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
          Router bağlantısını test edin ve durum bilgilerini görüntüleyin
        </p>
      </div>

      {/* Bağlantı Yapılandırması Kartı */}
      <div className="card p-3 sm:p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-base sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2">
            <Server className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Bağlantı Yapılandırması</span>
            <span className="sm:hidden">Yapılandırma</span>
          </h2>
          <div className="flex items-center gap-1 sm:gap-2">
            {!editing && (
              <button
                onClick={handleEditToggle}
                className="p-1.5 sm:p-2 rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                title="Düzenle"
              >
                <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
            <button
              onClick={loadStatus}
              disabled={loading || editing}
              className="p-1.5 sm:p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              title="Yenile"
            >
              <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-6 sm:py-8">
            <Loader className="w-6 h-6 sm:w-8 sm:h-8 text-primary-600 dark:text-primary-400 animate-spin mx-auto" />
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2">Yükleniyor...</p>
          </div>
        ) : editing ? (
          /* Düzenleme Modu - Form */
          <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* Host */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  Host (IP Adresi)
                </label>
                <input
                  type="text"
                  name="host"
                  value={formData.host}
                  onChange={handleInputChange}
                  placeholder="192.168.1.1"
                  className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Port */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  Port
                </label>
                <input
                  type="number"
                  name="port"
                  value={formData.port}
                  onChange={handleInputChange}
                  placeholder="8728"
                  className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Kullanıcı Adı */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  Kullanıcı Adı
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="admin"
                  className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Şifre */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  Şifre
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Şifre girin"
                  className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* TLS Checkbox */}
            <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <input
                type="checkbox"
                name="use_tls"
                id="use_tls"
                checked={formData.use_tls}
                onChange={handleInputChange}
                className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <label htmlFor="use_tls" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">TLS/SSL Kullan (Güvenli Bağlantı)</span>
                <span className="sm:hidden">TLS/SSL Kullan</span>
              </label>
            </div>

            {/* Butonlar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleEditToggle}
                disabled={saving}
                className="px-3 sm:px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 flex items-center justify-center"
              >
                <X className="w-4 h-4 mr-1.5 sm:mr-2" />
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.host || !formData.username}
                className="px-3 sm:px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 sm:gap-2"
              >
                {saving ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Kaydediliyor...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Kaydet</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : connectionStatus ? (
          /* Görüntüleme Modu */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Host:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate ml-2">
                  {connectionStatus.host || 'Ayarlanmamış'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Port:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {connectionStatus.port || 'Ayarlanmamış'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Kullanıcı:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate ml-2">
                  {connectionStatus.username || 'Ayarlanmamış'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Şifre:</span>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {connectionStatus.password === '***' ? '••••••••' : 'Ayarlanmamış'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">TLS:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {connectionStatus.use_tls ? (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      Aktif
                    </span>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">Pasif</span>
                  )}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-center mt-3 md:mt-0">
              <div className={`p-4 sm:p-6 rounded-lg ${
                connectionStatus.configured 
                  ? 'bg-green-100 dark:bg-green-900/30' 
                  : 'bg-yellow-100 dark:bg-yellow-900/30'
              }`}>
                {connectionStatus.configured ? (
                  <div className="text-center">
                    <Settings className="w-10 h-10 sm:w-12 sm:h-12 text-green-600 dark:text-green-400 mx-auto mb-2" />
                    <p className="text-xs sm:text-sm font-medium text-green-700 dark:text-green-300">
                      Yapılandırılmış
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Settings className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-600 dark:text-yellow-400 mx-auto mb-2" />
                    <p className="text-xs sm:text-sm font-medium text-yellow-700 dark:text-yellow-300">
                      Yapılandırma Eksik
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 sm:py-8 text-gray-500 dark:text-gray-400 text-sm">
            Durum bilgisi alınamadı
          </div>
        )}
      </div>

      {/* Test Butonu ve Sonuç Kartı */}
      <div className="card p-3 sm:p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-base sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2">
            <Wifi className="w-4 h-4 sm:w-5 sm:h-5" />
            Bağlantı Testi
          </h2>
        </div>

        {/* Test Butonu */}
        <div className="mb-4 sm:mb-6">
          <button
            onClick={handleTest}
            disabled={testing || !connectionStatus?.configured}
            className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm sm:text-base font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {testing ? (
              <>
                <Loader className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                <span>Test Ediliyor...</span>
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Bağlantıyı Test Et</span>
              </>
            )}
          </button>
          {!connectionStatus?.configured && (
            <p className="text-xs sm:text-sm text-yellow-600 dark:text-yellow-400 mt-2">
              Bağlantı ayarları yapılandırılmamış. Lütfen önce yapılandırmayı tamamlayın.
            </p>
          )}
        </div>

        {/* Test Sonucu */}
        {testResult && (
          <div className={`p-4 sm:p-6 rounded-lg border-2 ${
            testResult.connected
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-start gap-3 sm:gap-4">
              {testResult.connected ? (
                <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
              ) : (
                <XCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
              )}
              <div className="flex-1 min-w-0">
                <h3 className={`text-base sm:text-lg font-semibold mb-1.5 sm:mb-2 ${
                  testResult.connected
                    ? 'text-green-900 dark:text-green-100'
                    : 'text-red-900 dark:text-red-100'
                }`}>
                  {testResult.connected ? 'Bağlantı Başarılı!' : 'Bağlantı Başarısız!'}
                </h3>
                <p className={`text-sm mb-3 sm:mb-4 ${
                  testResult.connected
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-red-700 dark:text-red-300'
                }`}>
                  {testResult.message}
                </p>
                
                {/* Bağlantı Detayları */}
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                    Bağlantı Bilgileri:
                  </p>
                  <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Host:</span>
                      <span className="font-mono text-gray-900 dark:text-white truncate ml-2">
                        {testResult.host}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Port:</span>
                      <span className="font-mono text-gray-900 dark:text-white">
                        {testResult.port || testResult.port === 0 ? (testResult.port || 8728) : '8728 (varsayılan)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sistem Bilgileri (Bağlantı başarılıysa) */}
                {testResult.connected && testResult.details?.system_info && (
                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                      Router Bilgileri:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 text-xs sm:text-sm">
                      {testResult.details.system_info['board-name'] && (
                        <div className="flex justify-between sm:block">
                          <span className="text-gray-600 dark:text-gray-400">Model: </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {testResult.details.system_info['board-name']}
                          </span>
                        </div>
                      )}
                      {testResult.details.system_info['version'] && (
                        <div className="flex justify-between sm:block">
                          <span className="text-gray-600 dark:text-gray-400">Versiyon: </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {testResult.details.system_info['version']}
                          </span>
                        </div>
                      )}
                      {testResult.details.system_info['cpu'] && (
                        <div className="flex justify-between sm:block">
                          <span className="text-gray-600 dark:text-gray-400">CPU: </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {testResult.details.system_info['cpu']}
                          </span>
                        </div>
                      )}
                      {testResult.details.system_info['uptime'] && (
                        <div className="flex justify-between sm:block">
                          <span className="text-gray-600 dark:text-gray-400">Uptime: </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {testResult.details.system_info['uptime']}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Hata Detayları (Bağlantı başarısızsa) */}
                {!testResult.connected && testResult.details?.error && (
                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs sm:text-sm font-medium text-red-700 dark:text-red-300 mb-1.5 sm:mb-2">
                      Hata Detayı:
                    </p>
                    <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-mono bg-red-100 dark:bg-red-900/30 p-2 rounded break-words">
                      {testResult.details.error}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Test yapılmadıysa bilgi mesajı */}
        {!testResult && !testing && (
          <div className="text-center py-6 sm:py-8 text-gray-500 dark:text-gray-400">
            <WifiOff className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
            <p className="text-sm">Bağlantıyı test etmek için yukarıdaki butona tıklayın</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default MikroTikConnection

