/**
 * Aktivite Logları sayfası
 * Kullanıcı ve sistem işlemlerinin geçmişi
 */
import { useState, useEffect } from 'react'
import { Activity, Filter, Download, RefreshCw, Clock, User, Tag, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { PageLoader } from '../components/Loading'

function ActivityLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    category: '',
    action: '',
    success: '',
    start_date: '',
    end_date: '',
  })
  const [stats, setStats] = useState(null)
  const toast = useToast()

  // Logları yükle
  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = {
        limit: 100,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
      }
      const response = await api.get('/activity-logs', { params })
      if (response.data.success) {
        setLogs(response.data.data || [])
      }
    } catch (error) {
      toast.error('Loglar yüklenemedi')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // İstatistikleri yükle
  const fetchStats = async () => {
    try {
      const response = await api.get('/activity-logs/stats', {
        params: { hours: 24 }
      })
      if (response.data.success) {
        setStats(response.data.data)
      }
    } catch (error) {
      console.error('İstatistikler yüklenemedi:', error)
    }
  }

  useEffect(() => {
    fetchLogs()
    fetchStats()
  }, [filters])

  // Sonuç ikonu
  const getSuccessIcon = (success) => {
    if (success === 'success') return <CheckCircle className="w-4 h-4 text-green-500" />
    if (success === 'error') return <XCircle className="w-4 h-4 text-red-500" />
    return <AlertCircle className="w-4 h-4 text-yellow-500" />
  }

  // Kategori rengi
  const getCategoryColor = (category) => {
    const colors = {
      auth: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
      wireguard: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
      user: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
      mikrotik: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
      system: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400',
    }
    return colors[category] || colors.system
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Aktivite Geçmişi
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Kullanıcı ve sistem işlemlerinin detaylı kaydı
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            fetchLogs()
            fetchStats()
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Yenile</span>
        </button>
      </div>

      {/* İstatistikler */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">Toplam İşlem</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {stats.total}
            </div>
            <div className="text-xs text-gray-400 mt-1">Son 24 saat</div>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">Başarılı</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
              {stats.by_success?.success || 0}
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">Hatalı</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
              {stats.by_success?.error || 0}
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">Kategoriler</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {Object.keys(stats.by_category || {}).length}
            </div>
          </div>
        </div>
      )}

      {/* Filtreler */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-500" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Filtreler</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
          >
            <option value="">Tüm Kategoriler</option>
            <option value="auth">Auth</option>
            <option value="wireguard">WireGuard</option>
            <option value="user">Kullanıcı</option>
            <option value="mikrotik">MikroTik</option>
            <option value="system">Sistem</option>
          </select>

          <select
            value={filters.success}
            onChange={(e) => setFilters({ ...filters, success: e.target.value })}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
          >
            <option value="">Tüm Sonuçlar</option>
            <option value="success">Başarılı</option>
            <option value="failure">Başarısız</option>
            <option value="error">Hata</option>
          </select>

          <input
            type="date"
            value={filters.start_date}
            onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
            placeholder="Başlangıç tarihi"
          />

          <input
            type="date"
            value={filters.end_date}
            onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
            placeholder="Bitiş tarihi"
          />

          <button
            onClick={() => setFilters({ category: '', action: '', success: '', start_date: '', end_date: '' })}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition-colors"
          >
            Temizle
          </button>
        </div>
      </div>

      {/* Log listesi */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="p-12">
            <PageLoader message="Loglar yükleniyor..." />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Kayıt bulunamadı</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Zaman</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kullanıcı</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kategori</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksiyon</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Açıklama</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sonuç</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(log.created_at).toLocaleString('tr-TR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {log.username || 'System'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(log.category)}`}>
                        {log.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                        {log.action}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {log.description}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-1">
                        {getSuccessIcon(log.success)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default ActivityLogs
