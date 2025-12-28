/**
 * Log sayfası
 * Sistem log kayıtlarını görüntüler
 */
import { useState, useEffect } from 'react'
import { getLogs } from '../services/logService'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

function Logs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [limit] = useState(100) // Pagination limit
  const [offset, setOffset] = useState(0) // Pagination offset

  // Logları yükle
  useEffect(() => {
    loadLogs()
    // Performans için yenileme sıklığını 30 saniyeye çıkar (önceden 10 saniyeydi)
    const interval = setInterval(loadLogs, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadLogs = async (resetOffset = false) => {
    try {
      const currentOffset = resetOffset ? 0 : offset
      const response = await getLogs({ limit, offset: currentOffset })
      if (resetOffset || currentOffset === 0) {
        setLogs(response.data || [])
        setOffset(0)
      } else {
        // Daha fazla log yükleme (infinite scroll için)
        setLogs([...logs, ...(response.data || [])])
      }
    } catch (error) {
      console.error('Log listesi alınamadı:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // Daha fazla log yükle
  const loadMoreLogs = () => {
    if (loading) return
    setOffset(offset + limit)
    loadLogs(false)
  }

  // Action'a göre renk ve ikon
  const getActionColor = (action) => {
    if (action.includes('login')) return 'text-blue-600 dark:text-blue-400'
    if (action.includes('add')) return 'text-green-600 dark:text-green-400'
    if (action.includes('delete')) return 'text-red-600 dark:text-red-400'
    if (action.includes('update')) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  return (
    <div className="space-y-6">
      {/* Sayfa başlığı */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Sistem Logları
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Kullanıcı işlemleri ve sistem olayları
          </p>
        </div>
        <button
          onClick={() => loadLogs(true)}
          disabled={loading}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Yenile
        </button>
      </div>

      {/* Log listesi */}
      <div className="card">
        {loading && logs.length === 0 ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-4 animate-spin" />
            <p className="text-gray-500 dark:text-gray-400">Yükleniyor...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Henüz log kaydı yok</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tarih
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Kullanıcı
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    İşlem
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Detaylar
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    IP
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {format(new Date(log.created_at), 'dd.MM.yyyy HH:mm:ss')}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white font-medium">
                      {log.username}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-sm font-medium ${getActionColor(log.action)}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {log.details || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {log.ip_address || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination - Daha fazla log yükle butonu */}
        {logs.length >= limit && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={loadMoreLogs}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Yükleniyor...
                </>
              ) : (
                'Daha Fazla Yükle'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Logs

