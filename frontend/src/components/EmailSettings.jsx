/**
 * Email Bildirim Ayarları Bileşeni
 * SMTP yapılandırması ve bildirim tercihleri
 */
import { useState, useEffect } from 'react'
import { 
  Mail, 
  Server, 
  Lock, 
  Send, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Settings,
  Bell,
  Shield
} from 'lucide-react'
import api from '../services/api'
import { toast } from 'react-hot-toast'

function EmailSettings() {
  // State
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingSend, setTestingSend] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [activeSection, setActiveSection] = useState('smtp') // 'smtp' veya 'notifications'
  
  // Form state
  const [settings, setSettings] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    from_email: '',
    from_name: 'WireGuard Manager',
    smtp_use_tls: true,
    smtp_use_ssl: false,
    enabled: false,
    recipient_emails: '',
    notify_backup_success: true,
    notify_backup_failure: true,
    notify_peer_added: false,
    notify_peer_deleted: false,
    notify_peer_expired: true,
    notify_system_alerts: true
  })

  // Email ayarlarını yükle
  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await api.get('/email/settings')
      if (response.data.success && response.data.data) {
        setSettings(prev => ({
          ...prev,
          ...response.data.data,
          smtp_password: '' // Şifreyi gösterme
        }))
      }
    } catch (error) {
      console.error('Email ayarları yüklenemedi:', error)
      toast.error('Email ayarları yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  // Ayarları kaydet
  const handleSave = async (e) => {
    e.preventDefault()
    
    // Validasyon
    if (settings.enabled) {
      if (!settings.smtp_host || !settings.smtp_username || !settings.from_email) {
        toast.error('SMTP ayarları eksik. Lütfen tüm zorunlu alanları doldurun.')
        return
      }
    }

    try {
      setSaving(true)
      const response = await api.post('/email/settings', settings)
      if (response.data.success) {
        toast.success('Email ayarları başarıyla kaydedildi')
        setSettings(prev => ({ ...prev, smtp_password: '' }))
      }
    } catch (error) {
      console.error('Email ayarları kaydedilemedi:', error)
      toast.error(error.response?.data?.detail || 'Email ayarları kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  // Test email gönder
  const handleTestEmail = async () => {
    if (!testEmail) {
      toast.error('Lütfen bir test email adresi girin')
      return
    }

    try {
      setTestingSend(true)
      const response = await api.post('/email/test', { test_email: testEmail })
      if (response.data.success) {
        toast.success('Test email başarıyla gönderildi!')
      } else {
        toast.error(response.data.message || 'Test email gönderilemedi')
      }
    } catch (error) {
      console.error('Test email gönderilemedi:', error)
      toast.error(error.response?.data?.detail || 'Test email gönderilemedi')
    } finally {
      setTestingSend(false)
    }
  }

  // Form input değişikliği
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Yükleniyor...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Mail className="w-6 h-6 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Email Bildirimleri
          </h2>
        </div>
        <div className={`
          px-3 py-1 rounded-full text-sm font-medium
          ${settings.enabled 
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }
        `}>
          {settings.enabled ? 'Aktif' : 'Devre Dışı'}
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveSection('smtp')}
          className={`
            py-2 px-4 border-b-2 font-medium text-sm
            ${activeSection === 'smtp'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }
          `}
        >
          <Server className="w-4 h-4 inline-block mr-2" />
          SMTP Ayarları
        </button>
        <button
          onClick={() => setActiveSection('notifications')}
          className={`
            py-2 px-4 border-b-2 font-medium text-sm
            ${activeSection === 'notifications'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }
          `}
        >
          <Bell className="w-4 h-4 inline-block mr-2" />
          Bildirim Tercihleri
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* SMTP Ayarları Section */}
        {activeSection === 'smtp' && (
          <div className="space-y-6">
            {/* Aktif/Pasif Toggle */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Email Bildirimleri
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Email bildirimleri etkinleştir veya devre dışı bırak
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="enabled"
                    checked={settings.enabled || false}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>

            {/* SMTP Server Ayarları */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                <Server className="w-5 h-5 inline-block mr-2" />
                SMTP Sunucu Ayarları
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SMTP Host */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SMTP Sunucu *
                  </label>
                  <input
                    type="text"
                    name="smtp_host"
                    value={settings.smtp_host || ''}
                    onChange={handleChange}
                    placeholder="smtp.gmail.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* SMTP Port */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Port *
                  </label>
                  <input
                    type="number"
                    name="smtp_port"
                    value={settings.smtp_port || 587}
                    onChange={handleChange}
                    placeholder="587"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* SMTP Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Kullanıcı Adı *
                  </label>
                  <input
                    type="email"
                    name="smtp_username"
                    value={settings.smtp_username || ''}
                    onChange={handleChange}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* SMTP Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Şifre / App Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="smtp_password"
                      value={settings.smtp_password || ''}
                      onChange={handleChange}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Gmail için App Password kullanın
                  </p>
                </div>
              </div>

              {/* TLS/SSL Seçenekleri */}
              <div className="flex space-x-6 mt-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="smtp_use_tls"
                    checked={settings.smtp_use_tls || false}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">TLS Kullan</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="smtp_use_ssl"
                    checked={settings.smtp_use_ssl || false}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">SSL Kullan</span>
                </label>
              </div>
            </div>

            {/* Gönderen Bilgileri */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                <Mail className="w-5 h-5 inline-block mr-2" />
                Gönderen Bilgileri
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Gönderen Email *
                  </label>
                  <input
                    type="email"
                    name="from_email"
                    value={settings.from_email || ''}
                    onChange={handleChange}
                    placeholder="noreply@example.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Gönderen Adı
                  </label>
                  <input
                    type="text"
                    name="from_name"
                    value={settings.from_name || ''}
                    onChange={handleChange}
                    placeholder="WireGuard Manager"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              {/* Alıcı Email'leri */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bildirim Alıcıları
                </label>
                <input
                  type="text"
                  name="recipient_emails"
                  value={settings.recipient_emails || ''}
                  onChange={handleChange}
                  placeholder="admin@example.com, team@example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Virgülle ayırarak birden fazla email adresi ekleyebilirsiniz
                </p>
              </div>
            </div>

            {/* Test Email Gönderimi */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                <Send className="w-5 h-5 inline-block mr-2" />
                Test Email Gönder
              </h3>
              
              <div className="flex space-x-4">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={testingSend || !settings.enabled}
                  className={`
                    px-4 py-2 rounded-lg font-medium flex items-center space-x-2
                    ${settings.enabled
                      ? 'bg-primary-600 hover:bg-primary-700 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  {testingSend ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Gönderiliyor...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Test Gönder</span>
                    </>
                  )}
                </button>
              </div>
              {!settings.enabled && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  Test email göndermek için önce email bildirimlerini etkinleştirin
                </p>
              )}
            </div>
          </div>
        )}

        {/* Bildirim Tercihleri Section */}
        {activeSection === 'notifications' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
              <Bell className="w-5 h-5 inline-block mr-2" />
              Bildirim Tercihleri
            </h3>
            
            <div className="space-y-4">
              {/* Backup Success */}
              <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Yedekleme Başarılı</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Yedekleme tamamlandığında bildirim al</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="notify_backup_success"
                    checked={settings.notify_backup_success || false}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                </label>
              </div>

              {/* Backup Failure */}
              <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Yedekleme Hatası</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Yedekleme başarısız olduğunda bildirim al</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="notify_backup_failure"
                    checked={settings.notify_backup_failure || false}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600"></div>
                </label>
              </div>

              {/* Peer Added */}
              <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Yeni Peer Eklendi</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Yeni peer eklendiğinde bildirim al</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="notify_peer_added"
                    checked={settings.notify_peer_added || false}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {/* Peer Deleted */}
              <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Peer Silindi</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Peer silindiğinde bildirim al</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="notify_peer_deleted"
                    checked={settings.notify_peer_deleted || false}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {/* Peer Expired */}
              <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Peer Süresi Doldu</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Peer süresi dolduğunda bildirim al</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="notify_peer_expired"
                    checked={settings.notify_peer_expired || false}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {/* System Alerts */}
              <div className="flex items-center justify-between py-3">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Sistem Uyarıları</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Kritik sistem uyarıları için bildirim al</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="notify_system_alerts"
                    checked={settings.notify_system_alerts || false}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600"></div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Kaydet Butonu */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Kaydediliyor...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Kaydet</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default EmailSettings
