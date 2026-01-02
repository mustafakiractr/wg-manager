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
    <div className="space-y-6">
      {/* Sayfa başlığı */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Trafik Geçmişi
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Sistem trafik kullanım verilerini görüntüleyin
        </p>
      </div>

      {/* Filtreler */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          {/* Periyot seçimi */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Zaman Aralığı
            </label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
              className="input w-full"
            >
              <option value="hourly">Saatlik Trafik</option>
              <option value="daily">Günlük Trafik</option>
              <option value="monthly">Aylık Trafik</option>
              <option value="yearly">Yıllık Trafik</option>
            </select>
          </div>

          {/* Başlangıç tarihi */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Başlangıç Tarihi
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input w-full"
            />
          </div>

          {/* Bitiş tarihi */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Bitiş Tarihi
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input w-full"
            />
          </div>

          {/* Yenile butonu */}
          <button
            onClick={loadTrafficData}
            disabled={loading}
            className="btn btn-primary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>
      </div>

      {/* Özet istatistikler */}
      {summary && summary.record_count > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Toplam İndirme</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {(summary.total_rx_mb || 0).toFixed(2)} MB
                </p>
              </div>
              <Download className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <div className="card bg-green-50 dark:bg-green-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Toplam Yükleme</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {(summary.total_tx_mb || 0).toFixed(2)} MB
                </p>
              </div>
              <Upload className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <div className="card bg-purple-50 dark:bg-purple-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Ortalama İndirme</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                  {((Number(summary.avg_rx_bytes) || 0) / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>

          <div className="card bg-orange-50 dark:bg-orange-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Kayıt Sayısı</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                  {summary.record_count || 0}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
      )}

      {/* Grafik */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <RefreshCw className="w-8 h-8 animate-spin text-primary-600 dark:text-primary-400" />
          </div>
        ) : trafficData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 text-gray-500 dark:text-gray-400">
            <Calendar className="w-16 h-16 mb-4" />
            <p className="text-lg font-medium">Henüz trafik verisi bulunamadı</p>
            <p className="text-sm mt-2">Trafik verileri periyodik olarak kaydedilecek</p>
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
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Detaylı Veriler
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tarih/Saat
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    İndirme (MB)
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Yükleme (MB)
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Toplam (MB)
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Aktif Peer
                  </th>
                </tr>
              </thead>
              <tbody>
                {trafficData.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {formatDateTime(item.timestamp)}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-blue-600 dark:text-blue-400 font-medium">
                      {item.total_rx_mb.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-green-600 dark:text-green-400 font-medium">
                      {item.total_tx_mb.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-white font-semibold">
                      {(item.total_rx_mb + item.total_tx_mb).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-gray-600 dark:text-gray-400">
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

