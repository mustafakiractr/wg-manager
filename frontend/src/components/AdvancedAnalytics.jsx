/**
 * Gelişmiş Analytics Component
 * Detaylı istatistikler ve grafikler
 */
import { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { Calendar, TrendingUp, Users, Activity, Download, Upload } from 'lucide-react'
import { Spinner } from './Loading'

// Chart.js kayıt
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const AdvancedAnalytics = ({ peers = [], trafficData = [] }) => {
  const [timeRange, setTimeRange] = useState('24h') // '24h', '7d', '30d'
  const [loading, setLoading] = useState(false)

  // Formatters
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // Peer trafik dağılımı verisi
  const getPeerTrafficDistribution = () => {
    if (!peers || peers.length === 0) {
      return {
        labels: ['Veri yok'],
        datasets: [{
          data: [1],
          backgroundColor: ['#e5e7eb'],
        }]
      }
    }

    const sortedPeers = [...peers]
      .sort((a, b) => {
        const aTotal = (a.rx || 0) + (a.tx || 0)
        const bTotal = (b.rx || 0) + (b.tx || 0)
        return bTotal - aTotal
      })
      .slice(0, 10) // En çok trafik kullanan 10 peer

    const labels = sortedPeers.map(p => p.comment || p.id || 'Bilinmeyen')
    const data = sortedPeers.map(p => ((p.rx || 0) + (p.tx || 0)) / (1024 * 1024)) // MB

    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
      '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
    ]

    return {
      labels,
      datasets: [{
        label: 'Toplam Trafik (MB)',
        data,
        backgroundColor: colors,
        borderWidth: 0,
      }]
    }
  }

  // RX/TX karşılaştırma verisi
  const getRxTxComparison = () => {
    if (!peers || peers.length === 0) {
      return {
        labels: ['Veri yok'],
        datasets: []
      }
    }

    const sortedPeers = [...peers]
      .sort((a, b) => {
        const aTotal = (a.rx || 0) + (a.tx || 0)
        const bTotal = (b.rx || 0) + (b.tx || 0)
        return bTotal - aTotal
      })
      .slice(0, 10)

    const labels = sortedPeers.map(p => p.comment || p.id || 'Bilinmeyen')
    const rxData = sortedPeers.map(p => (p.rx || 0) / (1024 * 1024)) // MB
    const txData = sortedPeers.map(p => (p.tx || 0) / (1024 * 1024)) // MB

    return {
      labels,
      datasets: [
        {
          label: 'İndirilen (MB)',
          data: rxData,
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1,
        },
        {
          label: 'Yüklenen (MB)',
          data: txData,
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
          borderColor: 'rgb(16, 185, 129)',
          borderWidth: 1,
        },
      ]
    }
  }

  // Aktif/Pasif peer dağılımı
  const getPeerStatusDistribution = () => {
    if (!peers || peers.length === 0) {
      return {
        labels: ['Veri yok'],
        datasets: [{
          data: [1],
          backgroundColor: ['#e5e7eb'],
        }]
      }
    }

    const activePeers = peers.filter(p => p.disabled === 'false' || !p.disabled).length
    const inactivePeers = peers.length - activePeers

    return {
      labels: ['Aktif Peer', 'Pasif Peer'],
      datasets: [{
        data: [activePeers, inactivePeers],
        backgroundColor: [
          'rgba(16, 185, 129, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderColor: [
          'rgb(16, 185, 129)',
          'rgb(239, 68, 68)',
        ],
        borderWidth: 2,
      }]
    }
  }

  // Chart seçenekleri
  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
          padding: 15,
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        displayColors: true,
      }
    }
  }

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
      }
    },
    scales: {
      x: {
        ticks: {
          color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280',
        },
        grid: {
          color: document.documentElement.classList.contains('dark') ? 'rgba(75, 85, 99, 0.2)' : 'rgba(229, 231, 235, 0.5)',
        }
      },
      y: {
        ticks: {
          color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280',
        },
        grid: {
          color: document.documentElement.classList.contains('dark') ? 'rgba(75, 85, 99, 0.2)' : 'rgba(229, 231, 235, 0.5)',
        }
      }
    }
  }

  // İstatistik kartları
  const totalRx = peers.reduce((sum, p) => sum + (p.rx || 0), 0)
  const totalTx = peers.reduce((sum, p) => sum + (p.tx || 0), 0)
  const activePeerCount = peers.filter(p => p.disabled === 'false' || !p.disabled).length

  return (
    <div className="space-y-6">
      {/* Zaman aralığı seçici */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Gelişmiş Analitik
        </h2>
        <div className="flex gap-2">
          {['24h', '7d', '30d'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                timeRange === range
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {range === '24h' ? '24 Saat' : range === '7d' ? '7 Gün' : '30 Gün'}
            </button>
          ))}
        </div>
      </div>

      {/* Özet İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Aktif Peer</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {activePeerCount}/{peers.length}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Download className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Toplam İndirilen</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatBytes(totalRx)}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Upload className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Toplam Yüklenen</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatBytes(totalTx)}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Toplam Trafik</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatBytes(totalRx + totalTx)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grafikler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Peer Trafik Dağılımı */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            En Çok Trafik Kullanan Peer'lar
          </h3>
          <div className="h-80">
            <Doughnut data={getPeerTrafficDistribution()} options={doughnutOptions} />
          </div>
        </div>

        {/* Aktif/Pasif Dağılımı */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Peer Durum Dağılımı
          </h3>
          <div className="h-80">
            <Doughnut data={getPeerStatusDistribution()} options={doughnutOptions} />
          </div>
        </div>

        {/* RX/TX Karşılaştırma */}
        <div className="card lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            İndirilen / Yüklenen Trafik Karşılaştırması
          </h3>
          <div className="h-80">
            <Bar data={getRxTxComparison()} options={barOptions} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdvancedAnalytics
