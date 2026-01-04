/**
 * Telegram Bildirim Ayarları Bileşeni
 * Kritik olaylar için Telegram bildirimi yapılandırması
 */
import { useState, useEffect } from 'react'
import { MessageCircle, Send, Check, X, AlertCircle, Loader2 } from 'lucide-react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'

function TelegramSettings() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [settings, setSettings] = useState({
    bot_token: '',
    chat_id: '',
    enabled: false,
    notification_categories: [],
    test_message_count: 0,
  })
  const [availableCategories, setAvailableCategories] = useState([])

  // Ayarları yükle
  useEffect(() => {
    loadSettings()
    loadCategories()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await api.get('/telegram-settings')
      if (response.data.success) {
        const s = response.data.settings
        setSettings({
          bot_token: s.bot_token || '',
          chat_id: s.chat_id || '',
          enabled: s.enabled || false,
          notification_categories: Array.isArray(s.notification_categories) 
            ? s.notification_categories 
            : JSON.parse(s.notification_categories || '[]'),
          test_message_count: s.test_message_count || 0,
        })
      }
    } catch (error) {
      console.error('Telegram ayarları yüklenemedi:', error)
      showToast('Telegram ayarları yüklenemedi', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const response = await api.get('/telegram-settings/categories')
      if (response.data.success) {
        setAvailableCategories(response.data.categories)
      }
    } catch (error) {
      console.error('Bildirim kategorileri yüklenemedi:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await api.post('/telegram-settings', {
        bot_token: settings.bot_token,
        chat_id: settings.chat_id,
        enabled: settings.enabled,
        notification_categories: settings.notification_categories,
      })

      if (response.data.success) {
        toast.success('Telegram ayarları kaydedildi')
        await loadSettings() // Yeniden yükle
      }
    } catch (error) {
      console.error('Telegram ayarları kaydedilemedi:', error)
      toast.error(
        error.response?.data?.detail || 'Telegram ayarları kaydedilemedi'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const response = await api.post('/telegram-settings/test')
      
      if (response.data.success) {
        toast.success('Test mesajı gönderildi! Telegram\'ı kontrol edin.')
        await loadSettings() // Test sayısını güncelle
      }
    } catch (error) {
      console.error('Test mesajı gönderilemedi:', error)
      toast.error(
        error.response?.data?.detail || 'Test mesajı gönderilemedi'
      )
    } finally {
      setTesting(false)
    }
  }

  const toggleCategory = (categoryId) => {
    setSettings((prev) => {
      const cats = prev.notification_categories
      const index = cats.indexOf(categoryId)
      
      if (index > -1) {
        // Kategori zaten seçili, kaldır
        return {
          ...prev,
          notification_categories: cats.filter((c) => c !== categoryId),
        }
      } else {
        // Kategori seçili değil, ekle
        return {
          ...prev,
          notification_categories: [...cats, categoryId],
        }
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <MessageCircle className="w-6 h-6 text-blue-500" />
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Telegram Bildirimleri
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Kritik sistem olayları için Telegram bildirimi yapılandırması
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, enabled: e.target.checked }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                {settings.enabled ? 'Aktif' : 'Pasif'}
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* Bot Token */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Bot Token
          </label>
          <input
            type="password"
            value={settings.bot_token}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, bot_token: e.target.value }))
            }
            placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            @BotFather'dan alacağınız bot token'ı girin
          </p>
        </div>

        {/* Chat ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Chat ID
          </label>
          <input
            type="text"
            value={settings.chat_id}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, chat_id: e.target.value }))
            }
            placeholder="-1001234567890 veya 1234567890"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Telegram kanal/grup ID'nizi veya kullanıcı ID'nizi girin
          </p>
        </div>

        {/* Bildirim Kategorileri */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Bildirim Kategorileri
          </label>
          <div className="space-y-2">
            {availableCategories.map((category) => (
              <label
                key={category.id}
                className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={settings.notification_categories.includes(category.id)}
                  onChange={() => toggleCategory(category.id)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{category.emoji}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {category.name}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {category.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* İstatistikler */}
        {settings.test_message_count > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-blue-800 dark:text-blue-300">
                Toplam {settings.test_message_count} test mesajı gönderildi
              </span>
            </div>
          </div>
        )}

        {/* Butonlar */}
        <div className="flex items-center space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleTest}
            disabled={testing || !settings.bot_token || !settings.chat_id}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Test Mesajı Gönder
              </>
            )}
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Kaydet
              </>
            )}
          </button>
        </div>

        {/* Yardım Metni */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            📖 Telegram Bot Nasıl Oluşturulur?
          </h4>
          <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
            <li>Telegram'da @BotFather botunu bulun</li>
            <li>/newbot komutunu gönderin ve talimatları izleyin</li>
            <li>Bot token'ınızı yukarıdaki alana yapıştırın</li>
            <li>Bot'unuza mesaj gönderin veya bir gruba ekleyin</li>
            <li>Chat ID'nizi öğrenmek için botu kullanın</li>
            <li>Ayarları kaydedin ve test mesajı gönderin</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default TelegramSettings
