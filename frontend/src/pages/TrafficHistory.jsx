/**
 * Trafik Geçmişi sayfası
 * Trafik kullanım verilerini grafik olarak gösterir
 */
import { useState, useEffect } from 'react'
import {
  getHourlyTraffic,
  getDailyTraffic,
  getMonthlyTraffic,
  getYearlyTraffic,
} from '../services/trafficService'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import TrafficChart from '../components/TrafficChart'
import {
  TrendingUp,
  TrendingDown,
  Download,
  Upload,
  Calendar,
  RefreshCw,
} from 'lucide-react'

// Chart.js kayıt
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

function TrafficHistory() {
  const [periodType, setPeriodType] = useState('daily') // 'hourly', 'daily', 'monthly', 'yearly'
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [trafficData, setTrafficData] = useState([])
  const [summary, setSummary] = useState(null)
  const [limit] = useState(100) // Pagination için limit (backend default ile uyumlu)
  const [chartKey, setChartKey] = useState(0) // Chart'ı force remount için

  // Default tarih filtrelerini ayarla (performans için)
  useEffect(() => {
    const today = new Date()
    const endDateStr = today.toISOString().split('T')[0]
    
    let startDateStr = ''
    switch (periodType) {
      case 'hourly':
        // Son 7 gün
        const sevenDaysAgo = new Date(today)
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        startDateStr = sevenDaysAgo.toISOString().split('T')[0]
        break
      case 'daily':
        // Son 30 gün
        const thirtyDaysAgo = new Date(today)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        startDateStr = thirtyDaysAgo.toISOString().split('T')[0]
        break
      case 'monthly':
        // Son 12 ay
        const twelveMonthsAgo = new Date(today)
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
        startDateStr = twelveMonthsAgo.toISOString().split('T')[0]
        break
      case 'yearly':
        // Son 5 yıl
        const fiveYearsAgo = new Date(today)
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
        startDateStr = fiveYearsAgo.toISOString().split('T')[0]
        break
    }
    
    // Sadece kullanıcı manuel tarih girmemişse default değerleri kullan
    if (!startDate && !endDate) {
      setStartDate(startDateStr)
      setEndDate(endDateStr)
    }
  }, [periodType])

  // İlk yükleme
  useEffect(() => {
    loadTrafficData()
  }, [periodType, startDate, endDate])

  const loadTrafficData = async () => {
    setLoading(true)
    try {
      let response
      // Pagination ile veri çek (limit=100, backend default ile uyumlu)
      switch (periodType) {
        case 'hourly':
          response = await getHourlyTraffic(startDate || undefined, endDate || undefined, limit, 0)
          break
        case 'daily':
          response = await getDailyTraffic(startDate || undefined, endDate || undefined, limit, 0)
          break
        case 'monthly':
          response = await getMonthlyTraffic(startDate || undefined, endDate || undefined, limit, 0)
          break
        case 'yearly':
          response = await getYearlyTraffic(startDate || undefined, endDate || undefined, limit, 0)
          break
        default:
          response = await getDailyTraffic(startDate || undefined, endDate || undefined, limit, 0)
      }

      if (response.success) {
        // Verileri ters sırala (en eski en başta)
        const sortedData = [...response.data].reverse()
        setTrafficData(sortedData)
        
        // Summary değerlerini Number'a çevir (toFixed için)
        if (response.summary) {
          const normalizedSummary = {
            ...response.summary,
            total_rx_mb: Number(response.summary.total_rx_mb) || 0,
            total_tx_mb: Number(response.summary.total_tx_mb) || 0,
            total_traffic_mb: Number(response.summary.total_traffic_mb) || 0,
            avg_rx_mb: Number(response.summary.avg_rx_mb) || 0,
            avg_tx_mb: Number(response.summary.avg_tx_mb) || 0,
            record_count: Number(response.summary.record_count) || 0
          }
          setSummary(normalizedSummary)
        } else {
          setSummary(null)
        }
        
        // Chart'ı force remount et (DOM cleanup sorununu önler)
        setChartKey(prev => prev + 1)
      }
    } catch (error) {
      console.error('Trafik verisi yüklenemedi:', error)
      setTrafficData([])
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  // Tarih formatla (Türkiye saat dilimi)
  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return ''
    try {
      const date = new Date(dateTimeStr)
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      
      if (periodType === 'hourly') {
        return `${day}.${month}.${year} ${hours}:${minutes}`
      } else if (periodType === 'daily') {
        return `${day}.${month}.${year}`
      } else if (periodType === 'monthly') {
        return `${month}.${year}`
      } else {
        return `${year}`
      }
    } catch (e) {
      return dateTimeStr
    }
  }

  // Grafik verilerini hazırla (downsample ile performans optimizasyonu)
  // Çok fazla veri noktası varsa grafik için downsample yap
  const downsampleData = (data, maxPoints = 100) => {
    if (data.length <= maxPoints) return data
    const step = Math.ceil(data.length / maxPoints)
    const downsampled = []
    for (let i = 0; i < data.length; i += step) {
      downsampled.push(data[i])
    }
    // Son veriyi mutlaka ekle
    if (downsampled[downsampled.length - 1] !== data[data.length - 1]) {
      downsampled.push(data[data.length - 1])
    }
    return downsampled
  }

  const chartData = {
    labels: downsampleData(trafficData, 100).map((item) => formatDateTime(item.timestamp)),
    datasets: [
      {
        label: 'İndirme (MB)',
        data: downsampleData(trafficData, 100).map((item) => item.total_rx_mb),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Yükleme (MB)',
        data: downsampleData(trafficData, 100).map((item) => item.total_tx_mb),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: `${periodType === 'hourly' ? 'Saatlik' : periodType === 'daily' ? 'Günlük' : periodType === 'monthly' ? 'Aylık' : 'Yıllık'} Trafik Kullanımı`,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function (context) {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} MB`
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Trafik (MB)',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Zaman',
        },
      },
    },
  }

  // Byte'ı MB'ye çevir
  const formatBytes = (bytes) => {
    if (!bytes) return '0 MB'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(2)} MB`
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-0">
      {/* Sayfa başlığı */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          Trafik Geçmişi
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
          Sistem trafik kullanım verilerini görüntüleyin
        </p>
      </div>

      {/* Filtreler */}
      <div className="card p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Periyot ve Yenile - İlk satır */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
            {/* Periyot seçimi */}
            <div className="flex-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                Zaman Aralığı
              </label>
              <select
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value)}
                className="input w-full text-sm"
              >
                <option value="hourly">Saatlik</option>
                <option value="daily">Günlük</option>
                <option value="monthly">Aylık</option>
                <option value="yearly">Yıllık</option>
              </select>
            </div>

            {/* Yenile butonu - desktop'ta sağda */}
            <button
              onClick={loadTrafficData}
              disabled={loading}
              className="hidden sm:flex btn btn-primary items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Yenile
            </button>
          </div>
          
          {/* Tarih filtreleri - İkinci satır */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* Başlangıç tarihi */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                Başlangıç
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input w-full text-sm"
              />
            </div>

            {/* Bitiş tarihi */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                Bitiş
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input w-full text-sm"
              />
            </div>
          </div>

          {/* Yenile butonu - mobile'da tam genişlik */}
          <button
            onClick={loadTrafficData}
            disabled={loading}
            className="sm:hidden btn btn-primary flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>
      </div>

      {/* Özet istatistikler */}
      {summary && summary.record_count > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="card p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">İndirme</p>
                <p className="text-base sm:text-2xl font-bold text-blue-600 dark:text-blue-400 mt-0.5 sm:mt-1">
                  {(summary.total_rx_mb || 0).toFixed(1)} MB
                </p>
              </div>
              <Download className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <div className="card p-3 sm:p-4 bg-green-50 dark:bg-green-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Yükleme</p>
                <p className="text-base sm:text-2xl font-bold text-green-600 dark:text-green-400 mt-0.5 sm:mt-1">
                  {(summary.total_tx_mb || 0).toFixed(1)} MB
                </p>
              </div>
              <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <div className="card p-3 sm:p-4 bg-purple-50 dark:bg-purple-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Ort. İnd.</p>
                <p className="text-base sm:text-2xl font-bold text-purple-600 dark:text-purple-400 mt-0.5 sm:mt-1">
                  {((Number(summary.avg_rx_bytes) || 0) / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>

          <div className="card p-3 sm:p-4 bg-orange-50 dark:bg-orange-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Kayıt</p>
                <p className="text-base sm:text-2xl font-bold text-orange-600 dark:text-orange-400 mt-0.5 sm:mt-1">
                  {summary.record_count || 0}
                </p>
              </div>
              <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
      )}

      {/* Grafik */}
      <div className="card p-3 sm:p-4">
        {loading ? (
          <div className="flex items-center justify-center h-48 sm:h-96">
            <RefreshCw className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-primary-600 dark:text-primary-400" />
          </div>
        ) : trafficData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 sm:h-96 text-gray-500 dark:text-gray-400">
            <Calendar className="w-12 h-12 sm:w-16 sm:h-16 mb-3 sm:mb-4" />
            <p className="text-base sm:text-lg font-medium text-center">Henüz trafik verisi bulunamadı</p>
            <p className="text-xs sm:text-sm mt-1 sm:mt-2 text-center">Trafik verileri periyodik olarak kaydedilecek</p>
          </div>
        ) : (
          <TrafficChart 
            key={chartKey}
            data={chartData} 
            options={chartOptions}
          />
        )}
      </div>

      {/* Veri tablosu */}
      {trafficData.length > 0 && (
        <div className="card p-3 sm:p-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Detaylı Veriler
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tarih
                  </th>
                  <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                    İnd.
                  </th>
                  <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                    Yük.
                  </th>
                  <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:table-cell">
                    Toplam
                  </th>
                  <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 hidden md:table-cell">
                    Peer
                  </th>
                </tr>
              </thead>
              <tbody>
                {trafficData.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-900 dark:text-white whitespace-nowrap">
                      {formatDateTime(item.timestamp)}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-right text-blue-600 dark:text-blue-400 font-medium">
                      {item.total_rx_mb.toFixed(1)}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-right text-green-600 dark:text-green-400 font-medium">
                      {item.total_tx_mb.toFixed(1)}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-right text-gray-900 dark:text-white font-semibold hidden sm:table-cell">
                      {(item.total_rx_mb + item.total_tx_mb).toFixed(1)}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-right text-gray-600 dark:text-gray-400 hidden md:table-cell">
                      {item.active_peer_count || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default TrafficHistory

