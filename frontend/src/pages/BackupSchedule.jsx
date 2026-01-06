/**
 * Backup Schedule Yönetim Sayfası
 * Otomatik backup zamanlaması ve retention policy yönetimi
 */
import { useState, useEffect } from 'react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { 
  Clock, 
  Calendar, 
  Database, 
  HardDrive, 
  PlayCircle, 
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Settings
} from 'lucide-react'

export default function BackupSchedule() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [scheduleSettings, setScheduleSettings] = useState(null)
  const [nextBackups, setNextBackups] = useState(null)
  const [runningBackup, setRunningBackup] = useState(false)
  const [applyingRetention, setApplyingRetention] = useState(false)

  // Sayfa yüklendiğinde ayarları çek
  useEffect(() => {
    fetchScheduleData()
  }, [])

  const fetchScheduleData = async () => {
    try {
      setLoading(true)
      
      // Schedule ayarlarını ve sonraki backup zamanlarını paralel çek
      const [settingsRes, nextRes] = await Promise.all([
        api.get('/backup/schedule/settings'),
        api.get('/backup/schedule/next')
      ])

      setScheduleSettings(settingsRes.data)
      setNextBackups(nextRes.data)
    } catch (error) {
      console.error('Schedule verisi alınamadı:', error)
      toast.error('Schedule bilgileri yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  // Manuel backup çalıştır
  const runManualBackup = async (backupType, sendNotification = false) => {
    try {
      setRunningBackup(true)
      
      const response = await api.post('/backup/schedule/run', null, {
        params: { backup_type: backupType, send_notification: sendNotification }
      })

      if (response.data.success) {
        toast.success(
          `✅ ${backupType === 'database' ? 'Database' : 'Full'} backup başarıyla oluşturuldu`
        )
        
        // Sonraki backup zamanlarını güncelle
        await fetchScheduleData()
      }
    } catch (error) {
      console.error('Manuel backup hatası:', error)
      const errorMsg = error.response?.data?.detail || 'Backup oluşturulamadı'
      toast.error(`❌ Hata: ${errorMsg}`)
    } finally {
      setRunningBackup(false)
    }
  }

  // Retention policy uygula
  const applyRetentionPolicy = async (backupType = null) => {
    try {
      setApplyingRetention(true)
      
      const params = backupType ? { backup_type: backupType } : {}
      const response = await api.post('/backup/retention/apply', null, { params })

      if (response.data.success) {
        const { deleted_count, deleted_size_mb } = response.data
        toast.success(
          `🗑️ Retention policy uygulandı: ${deleted_count} backup silindi (${deleted_size_mb.toFixed(2)} MB)`
        )
      }
    } catch (error) {
      console.error('Retention policy hatası:', error)
      toast.error('Retention policy uygulanamadı')
    } finally {
      setApplyingRetention(false)
    }
  }

  // Tarih formatla
  const formatDateTime = (dateString) => {
    if (!dateString) return 'Bilinmiyor'
    
    try {
      const date = new Date(dateString)
      return new Intl.DateTimeFormat('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'long'
      }).format(date)
    } catch (error) {
      return dateString
    }
  }

  // Zaman farkı hesapla (kaç saat/gün kaldı)
  const getTimeUntil = (dateString) => {
    if (!dateString) return ''
    
    try {
      const targetDate = new Date(dateString)
      const now = new Date()
      const diffMs = targetDate - now
      
      if (diffMs < 0) return 'Geçmiş'
      
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffHours / 24)
      
      if (diffDays > 0) {
        return `${diffDays} gün ${diffHours % 24} saat kaldı`
      } else {
        return `${diffHours} saat kaldı`
      }
    } catch (error) {
      return ''
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Otomatik Backup Zamanlama</h1>
          <p className="text-gray-600 mt-1">
            Zamanlanmış backup işlemlerini yönetin ve retention policy uygulayın
          </p>
        </div>
        <button
          onClick={fetchScheduleData}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
        >
          <RefreshCw className="w-4 h-4" />
          Yenile
        </button>
      </div>

      {/* Sonraki Backup Zamanları */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Database Backup */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500 rounded-lg">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Günlük Database Backup</h3>
                <p className="text-sm text-gray-600">Her gün 02:00</p>
              </div>
            </div>
          </div>
          
          {nextBackups?.next_database_backup && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Calendar className="w-4 h-4" />
                <span>{formatDateTime(nextBackups.next_database_backup)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                <Clock className="w-4 h-4" />
                <span>{getTimeUntil(nextBackups.next_database_backup)}</span>
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-blue-200">
            <button
              onClick={() => runManualBackup('database', false)}
              disabled={runningBackup}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition"
            >
              <PlayCircle className="w-4 h-4" />
              {runningBackup ? 'Çalıştırılıyor...' : 'Manuel Çalıştır'}
            </button>
          </div>
        </div>

        {/* Full Backup */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500 rounded-lg">
                <HardDrive className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Haftalık Full Backup</h3>
                <p className="text-sm text-gray-600">Her Pazar 03:00</p>
              </div>
            </div>
          </div>
          
          {nextBackups?.next_full_backup && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Calendar className="w-4 h-4" />
                <span>{formatDateTime(nextBackups.next_full_backup)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
                <Clock className="w-4 h-4" />
                <span>{getTimeUntil(nextBackups.next_full_backup)}</span>
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-purple-200">
            <button
              onClick={() => runManualBackup('full', false)}
              disabled={runningBackup}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg transition"
            >
              <PlayCircle className="w-4 h-4" />
              {runningBackup ? 'Çalıştırılıyor...' : 'Manuel Çalıştır'}
            </button>
          </div>
        </div>
      </div>

      {/* Retention Policy */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Trash2 className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Retention Policy</h2>
              <p className="text-sm text-gray-600">Eski backup'ları otomatik temizleme</p>
            </div>
          </div>

          {scheduleSettings?.retention_policy && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Database Backups</span>
                  <Database className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {scheduleSettings.retention_policy.database} gün
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Full Backups</span>
                  <HardDrive className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {scheduleSettings.retention_policy.full} gün
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">WireGuard Config</span>
                  <Settings className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {scheduleSettings.retention_policy.wireguard} gün
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => applyRetentionPolicy()}
              disabled={applyingRetention}
              className="flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg transition"
            >
              <Trash2 className="w-5 h-5" />
              {applyingRetention ? 'Uygulanıyor...' : 'Retention Policy Uygula'}
            </button>

            <button
              onClick={() => applyRetentionPolicy('database')}
              disabled={applyingRetention}
              className="flex items-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg transition"
            >
              <Database className="w-5 h-5" />
              Sadece Database
            </button>

            <button
              onClick={() => applyRetentionPolicy('full')}
              disabled={applyingRetention}
              className="flex items-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg transition"
            >
              <HardDrive className="w-5 h-5" />
              Sadece Full
            </button>
          </div>
        </div>
      </div>

      {/* Cron Schedule Info */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-green-500 rounded-lg">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-2">Otomatik Backup Aktif</h3>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-green-600" />
                <span><strong>02:00</strong> - Günlük database backup</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-green-600" />
                <span><strong>03:00</strong> - Haftalık full backup (Pazar)</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-green-600" />
                <span><strong>04:00</strong> - Otomatik retention policy</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bilgi Notu */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 mb-1">Bilgi</h4>
            <p className="text-sm text-blue-800">
              Otomatik backup'lar cron job ile çalışmaktadır. Manuel backup çalıştırmak 
              zamanlanmış backup'ları etkilemez. Retention policy her gün otomatik olarak 
              04:00'da çalışır, ancak buradan manuel olarak da uygulayabilirsiniz.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
