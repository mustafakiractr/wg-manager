/**
 * Telegram Bildirim Geçmişi Dashboard
 * Tüm gönderilen Telegram bildirimlerini listeler, filtreler ve istatistikleri gösterir
 */
import { useState, useEffect } from 'react'
import { MessageSquare, Send, AlertCircle, CheckCircle, RefreshCw, Filter, Calendar, TrendingUp } from 'lucide-react'
import { getTelegramLogs, getTelegramStats, resendTelegramNotification, getTelegramCategories } from '../services/telegramAPI'
import { useToast } from '../context/ToastContext'

export default function TelegramDashboard() {
  const { showToast } = useToast()
  
  // State
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [resending, setResending] = useState({})
  
  // Filters
  const [filters, setFilters] = useState({
    category: '',
    status: '',
    success: null,
    start_date: '',
    end_date: '',
  })
  
  // Pagination
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    total: 0,
  })
  
  // Load initial data
  useEffect(() => {
    loadData()
  }, [filters, pagination.offset])
  
  const loadData = async () => {
    setLoading(true)
    try {
      // Paralel olarak tüm verileri çek
      const [logsData, statsData, categoriesData] = await Promise.all([
        getTelegramLogs({ ...filters, ...pagination }),
        getTelegramStats(),
        getTelegramCategories(),
      ])
      
      setLogs(logsData.items || [])
      setPagination(prev => ({ ...prev, total: logsData.total || 0 }))
      setStats(statsData)
      setCategories(categoriesData.categories || [])
    } catch (error) {
      showToast('Veriler yüklenirken hata oluştu', 'error')
      console.error('Telegram logs yükleme hatası:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const handleResend = async (logId) => {
    setResending(prev => ({ ...prev, [logId]: true }))
    try {
      await resendTelegramNotification(logId)
      showToast('Bildirim yeniden gönderildi', 'success')
      loadData() // Refresh data
    } catch (error) {
      showToast('Bildirim gönderilemedi', 'error')
      console.error('Resend error:', error)
    } finally {
      setResending(prev => ({ ...prev, [logId]: false }))
    }
  }
  
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPagination(prev => ({ ...prev, offset: 0 })) // Reset to first page
  }
  
  const handlePageChange = (direction) => {
    setPagination(prev => ({
      ...prev,
      offset: direction === 'next' 
        ? prev.offset + prev.limit 
        : Math.max(0, prev.offset - prev.limit)
    }))
  }
  
  const clearFilters = () => {
    setFilters({
      category: '',
      status: '',
      success: null,
      start_date: '',
      end_date: '',
    })
  }
  
  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  
  const getStatusBadge = (success) => {
    if (success) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Başarılı
        </span>
      )
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          Başarısız
        </span>
      )
    }
  }
  
  const getCategoryBadge = (category) => {
    const colors = {
      peer_down: 'bg-orange-100 text-orange-800',
      peer_up: 'bg-green-100 text-green-800',
      backup_failed: 'bg-red-100 text-red-800',
      backup_success: 'bg-blue-100 text-blue-800',
      test: 'bg-purple-100 text-purple-800',
      general: 'bg-gray-100 text-gray-800',
    }
    
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[category] || 'bg-gray-100 text-gray-800'}`}>
        {category}
      </span>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <MessageSquare className="w-8 h-8 mr-3 text-blue-500" />
            Telegram Bildirim Geçmişi
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Gönderilen tüm Telegram bildirimleri ve durumları
          </p>
        </div>
        
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Yenile
        </button>
      </div>
      
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Send className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Toplam</dt>
                    <dd className="text-lg font-semibold text-gray-900">{stats.total || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Başarılı</dt>
                    <dd className="text-lg font-semibold text-green-600">{stats.successful || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-6 w-6 text-red-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Başarısız</dt>
                    <dd className="text-lg font-semibold text-red-600">{stats.failed || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <TrendingUp className="h-6 w-6 text-blue-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Başarı Oranı</dt>
                    <dd className="text-lg font-semibold text-blue-600">{stats.success_rate ? `${stats.success_rate.toFixed(1)}%` : '0%'}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex items-center mb-4">
          <Filter className="w-5 h-5 mr-2 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900">Filtreler</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="">Tümü</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          
          {/* Success Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
            <select
              value={filters.success === null ? '' : filters.success}
              onChange={(e) => handleFilterChange('success', e.target.value === '' ? null : e.target.value === 'true')}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="">Tümü</option>
              <option value="true">Başarılı</option>
              <option value="false">Başarısız</option>
            </select>
          </div>
          
          {/* Start Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            />
          </div>
          
          {/* End Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            />
          </div>
          
          {/* Clear Filters */}
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Temizle
            </button>
          </div>
        </div>
      </div>
      
      {/* Logs Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Başlık</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mesaj</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Yükleniyor...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                    Kayıt bulunamadı
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {getCategoryBadge(log.category)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {log.title}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="max-w-xs truncate" title={log.message}>
                        {log.message}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {getStatusBadge(log.success)}
                      {!log.success && log.error_message && (
                        <div className="text-xs text-red-600 mt-1" title={log.error_message}>
                          {log.error_message.substring(0, 50)}...
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {!log.success && (
                        <button
                          onClick={() => handleResend(log.id)}
                          disabled={resending[log.id]}
                          className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                          title="Yeniden gönder"
                        >
                          <RefreshCw className={`w-4 h-4 ${resending[log.id] ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => handlePageChange('prev')}
              disabled={pagination.offset === 0}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Önceki
            </button>
            <button
              onClick={() => handlePageChange('next')}
              disabled={pagination.offset + pagination.limit >= pagination.total}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Sonraki
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Toplam <span className="font-medium">{pagination.total}</span> kayıttan{' '}
                <span className="font-medium">{pagination.offset + 1}</span> -{' '}
                <span className="font-medium">{Math.min(pagination.offset + pagination.limit, pagination.total)}</span> arası gösteriliyor
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => handlePageChange('prev')}
                  disabled={pagination.offset === 0}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Önceki
                </button>
                <button
                  onClick={() => handlePageChange('next')}
                  disabled={pagination.offset + pagination.limit >= pagination.total}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Sonraki
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
