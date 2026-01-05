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
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-0">
      {/* Sayfa başlığı */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Sistem Logları
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Kullanıcı işlemleri ve sistem olayları
          </p>
        </div>
        <button
          onClick={() => loadLogs(true)}
          disabled={loading}
          className="btn btn-secondary flex items-center justify-center gap-1.5 sm:gap-2 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Yenile</span>
        </button>
      </div>

      {/* Log listesi */}
      <div className="card">
        {loading && logs.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <RefreshCw className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 mx-auto mb-3 sm:mb-4 animate-spin" />
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">Yükleniyor...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">Henüz log kaydı yok</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tarih
                  </th>
                  <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                    Kullanıcı
                  </th>
                  <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                    İşlem
                  </th>
                  <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 hidden md:table-cell">
                    Detaylar
                  </th>
                  <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:table-cell">
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
                    <td className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm text-gray-900 dark:text-white">
                      <span className="whitespace-nowrap">
                        {format(new Date(log.created_at), 'dd.MM.yy HH:mm')}
                      </span>
                      {/* Mobile: IP ve Detaylar */}
                      <div className="sm:hidden mt-1 text-xs text-gray-500">
                        {log.ip_address || '-'}
                      </div>
                    </td>
                    <td className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm text-gray-900 dark:text-white font-medium">
                      <span className="truncate max-w-[60px] sm:max-w-none block">{log.username}</span>
                    </td>
                    <td className="py-2 sm:py-3 px-3 sm:px-4">
                      <span
                        className={`text-xs sm:text-sm font-medium ${getActionColor(log.action)}`}
                      >
                        {log.action}
                      </span>
                      {/* Mobile: Detaylar */}
                      <div className="md:hidden mt-1 text-xs text-gray-500 line-clamp-1">
                        {log.details || '-'}
                      </div>
                    </td>
                    <td className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">
                      <span className="line-clamp-2">{log.details || '-'}</span>
                    </td>
                    <td className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-mono hidden sm:table-cell">
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
          <div className="mt-3 sm:mt-4 flex justify-center">
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

