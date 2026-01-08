/**
 * Dashboard sayfası
 * Aktif peer'ları listeler ve gerçek zamanlı istatistikleri gösterir
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getInterfaces, getPeers, getPeerLogs } from '../services/wireguardService'
import { getDashboardStats, getIPPoolUsage, getRecentActivities, getPeerGroupDistribution, getExpiringPeers } from '../services/dashboardService'
import {
  getPeerHourlyTraffic,
  getPeerDailyTraffic,
  getPeerMonthlyTraffic,
  getPeerYearlyTraffic,
} from '../services/trafficService'
import wanTrafficService from '../services/wanTrafficService'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
import { Line } from 'react-chartjs-2'

// Chart.js bileşenlerini kaydet
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
import {
  Network,
  Users,
  Activity,
  AlertCircle,
  Download,
  Upload,
  Search,
  RefreshCw,
  ArrowUpDown,
  Filter,
  MoreVertical,
  ArrowRight,
  Clock,
  Wifi,
  FileText,
  X,
  TrendingUp,
  Calendar,
  RefreshCw as RefreshCwIcon,
  Database,
  FileCode,
  Zap,
  BarChart3,
  Settings,
  Eye,
  EyeOff,
  Info,
  GripVertical,
} from 'lucide-react'

// Sürüklenebilir Widget Container bileşeni
function SortableWidget({ id, children, isVisible }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  if (!isVisible) return null

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Sürükleme tutamacı */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
        title="Sürükleyerek taşı"
      >
        <GripVertical className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      </div>
      {children}
    </div>
  )
}

// Widget Ayarları Modal içindeki sürüklenebilir öğe bileşeni
function SortableWidgetItem({ id, widget, isVisible, onToggle }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  }

  const Icon = widget.icon

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
        isVisible
          ? 'bg-primary-100 dark:bg-primary-900/30 border-2 border-primary-500'
          : 'bg-gray-100 dark:bg-gray-700 border-2 border-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Sürükleme tutamacı */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
          title="Sürükleyerek sırala"
        >
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
        <Icon className={`w-5 h-5 ${isVisible ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}`} />
        <span className={`font-medium ${isVisible ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
          {widget.label}
        </span>
      </div>
      <button
        onClick={onToggle}
        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
        title={isVisible ? 'Gizle' : 'Göster'}
      >
        {isVisible ? (
          <Eye className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        ) : (
          <EyeOff className="w-5 h-5 text-gray-400" />
        )}
      </button>
    </div>
  )
}

function Dashboard() {
  const [interfaces, setInterfaces] = useState([])
  const [allPeers, setAllPeers] = useState([]) // Tüm aktif peer'lar
  const [refreshRate, setRefreshRate] = useState(10) // Saniye cinsinden (performans için 10 saniye)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('lastActivity') // 'lastActivity', 'name', 'rx', 'tx'
  const [isRefreshing, setIsRefreshing] = useState(false) // Arka plan yenileme durumu (yenileme butonu için)
  const [showLogsModal, setShowLogsModal] = useState(false) // Log modal durumu
  const [selectedPeer, setSelectedPeer] = useState(null) // Seçili peer
  const [peerLogs, setPeerLogs] = useState([]) // Peer logları
  const [loadingLogs, setLoadingLogs] = useState(false) // Log yükleme durumu
  const [logSummary, setLogSummary] = useState(null) // Log özeti
  const [startDate, setStartDate] = useState('') // Başlangıç tarihi
  const [endDate, setEndDate] = useState('') // Bitiş tarihi
  const [logLimit] = useState(100) // Peer log pagination limit
  const [logOffset, setLogOffset] = useState(0) // Peer log pagination offset
  const [showTrafficModal, setShowTrafficModal] = useState(false) // Trafik modal durumu
  const [trafficPeriodType, setTrafficPeriodType] = useState('daily') // Trafik periyot tipi
  const [trafficStartDate, setTrafficStartDate] = useState('') // Trafik başlangıç tarihi
  const [trafficEndDate, setTrafficEndDate] = useState('') // Trafik bitiş tarihi
  const [peerTrafficData, setPeerTrafficData] = useState([]) // Peer trafik verileri
  const [peerTrafficSummary, setPeerTrafficSummary] = useState(null) // Peer trafik özeti
  const [loadingTraffic, setLoadingTraffic] = useState(false) // Trafik yükleme durumu
  const [loadingPeers, setLoadingPeers] = useState(true) // Peer'lar yükleniyor mu?
  const [showPeerDetailsModal, setShowPeerDetailsModal] = useState(false) // Peer detay modal durumu
  const [showWidgetSettings, setShowWidgetSettings] = useState(false) // Widget ayarları modal durumu

  // Widget görünürlük ayarları - localStorage'dan yükle
  const [widgetVisibility, setWidgetVisibility] = useState(() => {
    const saved = localStorage.getItem('dashboardWidgets')
    return saved ? JSON.parse(saved) : {
      stats: true,
      trafficCharts: true,
      wanTraffic: true, // WAN Traffic Widget - YENİ
      activePeers: true,
      ipPoolUsage: true,
      recentActivities: true,
      peerGroups: true,
      expiringPeers: true
    }
  })

  // Widget sırası - localStorage'dan yükle
  const defaultWidgetOrder = ['stats', 'trafficCharts', 'wanTraffic', 'peerGroups', 'expiringPeers', 'ipPoolUsage', 'recentActivities', 'activePeers']
  const [widgetOrder, setWidgetOrder] = useState(() => {
    const saved = localStorage.getItem('dashboardWidgetOrder')
    return saved ? JSON.parse(saved) : defaultWidgetOrder
  })

  // DnD sensörleri
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px hareket edince sürükleme başlar
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Sürükleme bittiğinde
  const handleDragEnd = (event) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      setWidgetOrder((items) => {
        const oldIndex = items.indexOf(active.id)
        const newIndex = items.indexOf(over.id)
        const newOrder = arrayMove(items, oldIndex, newIndex)
        localStorage.setItem('dashboardWidgetOrder', JSON.stringify(newOrder))
        return newOrder
      })
    }
  }

  const [peerGroupData, setPeerGroupData] = useState([]) // Grup dağılımı
  const [expiringPeersData, setExpiringPeersData] = useState({ expired: [], expiring: [], total: 0 }) // Expiring peers
  const [stats, setStats] = useState({
    totalInterfaces: 0,
    totalPeers: 0,
    activeInterfaces: 0,
    activePeers: 0,
    totalRx: 0, // Toplam indirilen veri
    totalTx: 0, // Toplam yüklenen veri
  })
  const [dashboardStats, setDashboardStats] = useState(null) // Backend'den gelen genel istatistikler
  const [ipPoolUsage, setIPPoolUsage] = useState([]) // IP Pool kullanım detayları
  const [recentActivities, setRecentActivities] = useState([]) // Son aktiviteler
  const [trafficHistory, setTrafficHistory] = useState({
    rx: [], // Son 20 RX değeri
    tx: [], // Son 20 TX değeri
    timestamps: [], // Zaman damgaları
  })
  const [wanTraffic, setWanTraffic] = useState({
    interfaceName: null,
    rxBytes: 0,
    txBytes: 0,
    rxRate: 0,
    txRate: 0,
    totalBytes: 0,
    running: false,
    history: {
      rx: [],
      tx: [],
      timestamps: []
    }
  })

  // WAN traffic rate hesaplaması için önceki değerleri tut
  const prevWANTraffic = useRef({ rxBytes: 0, txBytes: 0, timestamp: Date.now() })

  // loadData fonksiyonunu useCallback ile tanımla (useEffect'lerden önce)
  const loadData = useCallback(async (showLoading = false) => {
    try {
      // Sadece manuel yenileme butonuna basıldığında isRefreshing'i true yap
      if (showLoading) {
        setIsRefreshing(true) // Manuel yenileme için
      }
      
      const interfacesRes = await getInterfaces()
      const interfacesData = interfacesRes.data || []

      // Tüm interface'lerden peer'ları paralel olarak topla (performans için)
      const peerPromises = interfacesData.map(async (iface) => {
        try {
          const interfaceName = iface.name || iface['.id']
          const peersRes = await getPeers(interfaceName)
          const peers = peersRes.data || []
          
          // Peer'ları normalize et
          const normalizedPeers = peers.map((p) => {
            // MikroTik'ten gelen disabled değerini normalize et
            let disabled = p.disabled
            if (disabled === undefined || disabled === null) {
              disabled = false  // Varsayılan olarak aktif
            } else if (typeof disabled === 'string') {
              disabled = disabled.toLowerCase() === 'true' || disabled.toLowerCase() === 'yes'
            } else if (typeof disabled === 'boolean') {
              disabled = disabled
            } else {
              disabled = Boolean(disabled)
            }
            
            // Peer ID'yi normalize et
            const peerId = p.id || p['.id'] || p['*id']
            
            return {
              ...p,
              id: peerId,
              disabled: disabled,
              interfaceName: iface.name || iface['.id'],
              interfaceId: iface['.id'],
            }
          })
          
          return normalizedPeers
        } catch (error) {
          console.error(`Peer listesi alınamadı: ${iface.name}`, error)
          return []
        }
      })

      // Tüm peer'ları paralel olarak yükle
      const allPeersArrays = await Promise.all(peerPromises)
      const allPeersData = allPeersArrays.flat()

      // İstatistikleri hesapla
      const totalPeers = allPeersData.length
      const activePeersData = allPeersData.filter((p) => !p.disabled)
      const activePeers = activePeersData.length
      
      let totalRx = 0
      let totalTx = 0
      activePeersData.forEach((p) => {
        const rxBytes = parseInt(p['rx-bytes'] || p.rx || 0)
        const txBytes = parseInt(p['tx-bytes'] || p.tx || 0)
        totalRx += rxBytes
        totalTx += txBytes
      })

      setInterfaces(interfacesData)
      setAllPeers(activePeersData) // Sadece aktif peer'ları set et
      setStats({
        totalInterfaces: interfacesData.length,
        totalPeers,
        activeInterfaces: interfacesData.filter((i) => i.running).length,
        activePeers,
        totalRx,
        totalTx,
      })

      // Trafik geçmişini güncelle (son 20 veri noktası)
      setTrafficHistory((prev) => {
        const now = new Date()
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`

        const newRx = [...prev.rx, totalRx / (1024 * 1024)] // MB cinsinden
        const newTx = [...prev.tx, totalTx / (1024 * 1024)] // MB cinsinden
        const newTimestamps = [...prev.timestamps, timeStr]

        // Son 20 veriyi tut
        const maxDataPoints = 20
        return {
          rx: newRx.slice(-maxDataPoints),
          tx: newTx.slice(-maxDataPoints),
          timestamps: newTimestamps.slice(-maxDataPoints),
        }
      })
    } catch (error) {
      console.error('Veri yükleme hatası:', error)
    } finally {
      setLoadingPeers(false) // Peer yükleme tamamlandı
      if (showLoading) {
        setIsRefreshing(false) // Manuel yenileme tamamlandı
      }
    }
  }, [])

  // Dashboard istatistiklerini yükle
  const loadDashboardData = useCallback(async () => {
    try {
      // Genel istatistikleri al
      const statsRes = await getDashboardStats()
      if (statsRes.success) {
        setDashboardStats(statsRes.data)
      }

      // IP Pool kullanım verilerini al
      const ipPoolRes = await getIPPoolUsage()
      if (ipPoolRes.success) {
        setIPPoolUsage(ipPoolRes.data)
      }

      // Son aktiviteleri al
      const activitiesRes = await getRecentActivities(10)
      if (activitiesRes.success) {
        setRecentActivities(activitiesRes.data)
      }

      // Grup dağılımını al
      try {
        const groupRes = await getPeerGroupDistribution()
        if (groupRes.success) {
          setPeerGroupData(groupRes.data)
        }
      } catch (err) {
        console.log('Grup dağılımı alınamadı:', err)
      }

      // Süresi dolacak peer'ları al
      try {
        const expiringRes = await getExpiringPeers(7)
        if (expiringRes.success) {
          setExpiringPeersData(expiringRes.data)
        }
      } catch (err) {
        console.log('Expiring peers alınamadı:', err)
      }
    } catch (error) {
      console.error('Dashboard verileri yüklenemedi:', error)
    }
  }, [])

  // WAN Traffic verilerini yükle
  const loadWANTrafficData = useCallback(async () => {
    try {
      const res = await wanTrafficService.getWANTraffic()
      if (res.success && res.data) {
        const data = res.data
        const currentTime = Date.now()

        // Rate hesapla (bytes farkı / zaman farkı)
        const prev = prevWANTraffic.current
        const timeDiffSec = (currentTime - prev.timestamp) / 1000

        let rxRate = 0
        let txRate = 0

        if (timeDiffSec > 0 && prev.rxBytes > 0) {
          // Bytes farkını al ve saniyede byte hesapla
          const rxDiff = data.rx_bytes - prev.rxBytes
          const txDiff = data.tx_bytes - prev.txBytes

          rxRate = rxDiff / timeDiffSec  // bytes/sec
          txRate = txDiff / timeDiffSec  // bytes/sec

          // Negatif değerleri sıfırla (counter reset olmuş olabilir)
          if (rxRate < 0) rxRate = 0
          if (txRate < 0) txRate = 0
        }

        // Şimdiki değerleri kaydet (bir sonraki hesaplama için)
        prevWANTraffic.current = {
          rxBytes: data.rx_bytes,
          txBytes: data.tx_bytes,
          timestamp: currentTime
        }

        // Geçmiş veriye ekle (grafik için)
        setWanTraffic((prev) => {
          const now = new Date()
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

          // Rate değerlerini bytes/sec'den MB/sec'e çevir (grafik için)
          const rxRateMB = rxRate / (1024 * 1024)
          const txRateMB = txRate / (1024 * 1024)

          const newRxHistory = [...prev.history.rx, rxRateMB]
          const newTxHistory = [...prev.history.tx, txRateMB]
          const newTimestamps = [...prev.history.timestamps, timeStr]

          // Son 20 veriyi tut
          const maxDataPoints = 20

          return {
            interfaceName: data.interface_name,
            rxBytes: data.rx_bytes || 0,
            txBytes: data.tx_bytes || 0,
            rxRate: rxRate,  // bytes/sec
            txRate: txRate,  // bytes/sec
            totalBytes: data.total_bytes || 0,
            running: data.running || false,
            history: {
              rx: newRxHistory.slice(-maxDataPoints),
              tx: newTxHistory.slice(-maxDataPoints),
              timestamps: newTimestamps.slice(-maxDataPoints)
            }
          }
        })
      }
    } catch (error) {
      console.error('WAN trafik verileri yüklenemedi:', error)
    }
  }, [])

  // İlk yükleme - sessizce yükle
  useEffect(() => {
    loadData(false) // İlk yüklemede de sessizce yükle
    loadDashboardData() // Dashboard istatistiklerini yükle
    loadWANTrafficData() // WAN traffic verilerini yükle
  }, [loadData, loadDashboardData, loadWANTrafficData])

  // Yenileme sıklığı değiştiğinde interval'i güncelle - performans için minimum 10 saniye
  useEffect(() => {
    // Belirlenen sıklıkta sessizce yenile (loading gösterme)
    // Minimum 10 saniye (performans için)
    const minRefreshRate = Math.max(refreshRate, 10)
    const interval = setInterval(() => {
      loadData(false) // Arka planda sessizce yükle
      loadWANTrafficData() // WAN traffic'i de yenile
    }, minRefreshRate * 1000)
    return () => clearInterval(interval)
  }, [refreshRate, loadData, loadWANTrafficData])

  // Widget görünürlük ayarlarını localStorage'a kaydet
  useEffect(() => {
    localStorage.setItem('dashboardWidgets', JSON.stringify(widgetVisibility))
  }, [widgetVisibility])

  // Widget görünürlük toggle fonksiyonu
  const toggleWidget = (widgetName) => {
    setWidgetVisibility(prev => ({
      ...prev,
      [widgetName]: !prev[widgetName]
    }))
  }

  // Peer detaylarını göster
  const handleShowPeerDetails = (peer) => {
    setSelectedPeer(peer)
    setShowPeerDetailsModal(true)
  }

  // Byte'ı okunabilir formata çevir - useCallback ile optimize edildi
  const formatBytes = useCallback((bytes) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(4)) + ' ' + sizes[i]
  }, [])

  // MikroTik'ten gelen zaman formatını parse et (örn: "20s", "5m", "2h", "1d", "5m50s" veya timestamp) - useCallback ile optimize edildi
  const parseMikroTikTime = useCallback((timeStr) => {
    if (!timeStr || timeStr === '0' || timeStr === '' || timeStr === 'never' || timeStr === '0s') {
      return null
    }
    
    // String'e çevir
    timeStr = String(timeStr).trim()
    
    // Göreceli zaman formatı kontrolü (örn: "20s", "5m", "2h", "1d", "5m50s", "2h30m")
    // Önce karmaşık formatları kontrol et (örn: "5m50s", "2h30m")
    let totalSeconds = 0
    
    // "5m50s" formatı
    const minutesSecondsMatch = timeStr.match(/^(\d+)m\s*(\d+)s$/)
    if (minutesSecondsMatch) {
      const minutes = parseInt(minutesSecondsMatch[1])
      const seconds = parseInt(minutesSecondsMatch[2])
      totalSeconds = minutes * 60 + seconds
      if (totalSeconds > 0) {
        return totalSeconds
      }
    }
    
    // "2h30m" formatı
    const hoursMinutesMatch = timeStr.match(/^(\d+)h\s*(\d+)m$/)
    if (hoursMinutesMatch) {
      const hours = parseInt(hoursMinutesMatch[1])
      const minutes = parseInt(hoursMinutesMatch[2])
      totalSeconds = hours * 3600 + minutes * 60
      if (totalSeconds > 0) {
        return totalSeconds
      }
    }
    
    // "1d2h" formatı
    const daysHoursMatch = timeStr.match(/^(\d+)d\s*(\d+)h$/)
    if (daysHoursMatch) {
      const days = parseInt(daysHoursMatch[1])
      const hours = parseInt(daysHoursMatch[2])
      totalSeconds = days * 86400 + hours * 3600
      if (totalSeconds > 0) {
        return totalSeconds
      }
    }
    
    // "2h30m15s" formatı
    const hoursMinutesSecondsMatch = timeStr.match(/^(\d+)h\s*(\d+)m\s*(\d+)s?$/)
    if (hoursMinutesSecondsMatch) {
      const hours = parseInt(hoursMinutesSecondsMatch[1])
      const minutes = parseInt(hoursMinutesSecondsMatch[2])
      const seconds = parseInt(hoursMinutesSecondsMatch[3]) || 0
      totalSeconds = hours * 3600 + minutes * 60 + seconds
      if (totalSeconds > 0) {
        return totalSeconds
      }
    }
    
    // "1d2h30m" formatı
    const daysHoursMinutesMatch = timeStr.match(/^(\d+)d\s*(\d+)h\s*(\d+)m$/)
    if (daysHoursMinutesMatch) {
      const days = parseInt(daysHoursMinutesMatch[1])
      const hours = parseInt(daysHoursMinutesMatch[2])
      const minutes = parseInt(daysHoursMinutesMatch[3])
      totalSeconds = days * 86400 + hours * 3600 + minutes * 60
      if (totalSeconds > 0) {
        return totalSeconds
      }
    }
    
    
    // Basit göreceli zaman formatı kontrolü (örn: "20s", "5m", "2h", "1d")
    const relativeTimeMatch = timeStr.match(/^(\d+)([smhd])$/)
    if (relativeTimeMatch) {
      const value = parseInt(relativeTimeMatch[1])
      const unit = relativeTimeMatch[2]
      
      let seconds = 0
      switch (unit) {
        case 's':
          seconds = value
          break
        case 'm':
          seconds = value * 60
          break
        case 'h':
          seconds = value * 3600
          break
        case 'd':
          seconds = value * 86400
          break
        default:
          return null
      }
      
      return seconds
    }
    
    // Timestamp formatı kontrolü
    try {
      const timestamp = new Date(timeStr)
      if (!isNaN(timestamp.getTime())) {
        const now = new Date()
        const diffMs = now - timestamp
        const diffSec = Math.floor(diffMs / 1000)
        // Negatif değerler geçersiz (gelecek zaman)
        return diffSec >= 0 ? diffSec : null
      }
    } catch (e) {
      // Timestamp parse edilemedi
    }
    
    return null
  }, [])

  // Son aktivite zamanını hesapla ve online/offline durumunu belirle - useCallback ile optimize edildi
  const getLastActivity = useCallback((peer) => {
    // Önce peer'ın disabled durumunu kontrol et
    let disabled = peer.disabled
    if (disabled === undefined || disabled === null) {
      disabled = false
    } else if (typeof disabled === 'string') {
      disabled = disabled.toLowerCase() === 'true' || disabled.toLowerCase() === 'yes'
    } else if (typeof disabled === 'boolean') {
      disabled = disabled
    } else {
      disabled = Boolean(disabled)
    }
    
    // Eğer peer disabled ise, offline olarak göster
    if (disabled) {
      return { text: 'Pasif', isOnline: false, seconds: null }
    }
    
    // MikroTik'ten gelen verilerde farklı alan adları olabilir
    const lastHandshake = peer['last-handshake'] || peer['last-handshake-time'] || peer.lastHandshake
    
    if (!lastHandshake || lastHandshake === '0' || lastHandshake === '' || lastHandshake === 'never' || lastHandshake === '0s') {
      return { text: 'Bağlı değil', isOnline: false, seconds: null }
    }
    
    try {
      // MikroTik'ten gelen zaman formatını parse et
      const diffSec = parseMikroTikTime(lastHandshake)
      
      if (diffSec === null || diffSec < 0) {
        return { text: 'Bilinmiyor', isOnline: false, seconds: null }
      }
      
      // 90 saniyeden fazla süre geçtiyse offline kabul et (backend ile uyumlu)
      const isOnline = diffSec < 90
      
      let text = ''
      if (diffSec < 60) {
        text = `${diffSec} saniye önce`
      } else if (diffSec < 3600) {
        const minutes = Math.floor(diffSec / 60)
        const seconds = diffSec % 60
        text = `${minutes}:${seconds.toString().padStart(2, '0')} önce`
      } else if (diffSec < 86400) {
        const hours = Math.floor(diffSec / 3600)
        const minutes = Math.floor((diffSec % 3600) / 60)
        text = `${hours}:${minutes.toString().padStart(2, '0')} önce`
      } else {
        const days = Math.floor(diffSec / 86400)
        const hours = Math.floor((diffSec % 86400) / 3600)
        text = `${days} gün ${hours} saat önce`
      }
      
      return { text, isOnline, seconds: diffSec }
    } catch (e) {
      console.error('Zaman parse hatası:', e, 'lastHandshake:', lastHandshake, 'peer:', peer)
      return { text: 'Bilinmiyor', isOnline: false, seconds: null }
    }
  }, [parseMikroTikTime])

  // Bağlantı süresini hesapla (son handshake'ten itibaren - MikroTik'te ilk handshake bilgisi yok) - useCallback ile optimize edildi
  const getConnectionDuration = useCallback((peer) => {
    // MikroTik'ten gelen verilerde farklı alan adları olabilir
    const lastHandshake = peer['last-handshake'] || peer['last-handshake-time'] || peer.lastHandshake
    
    if (!lastHandshake || lastHandshake === '0' || lastHandshake === '' || lastHandshake === 'never') {
      return null
    }
    
    try {
      // MikroTik'ten gelen zaman formatını parse et
      const diffSec = parseMikroTikTime(lastHandshake)
      
      if (diffSec === null || diffSec < 0) {
        return null
      }
      
      // Son handshake'ten itibaren geçen süreyi göster (bağlantı süresi olarak)
      if (diffSec < 60) {
        return `${diffSec} saniye`
      } else if (diffSec < 3600) {
        const minutes = Math.floor(diffSec / 60)
        return `${minutes} dakika`
      } else if (diffSec < 86400) {
        const hours = Math.floor(diffSec / 3600)
        const minutes = Math.floor((diffSec % 3600) / 60)
        return `${hours} saat ${minutes} dakika`
      } else {
        const days = Math.floor(diffSec / 86400)
        const hours = Math.floor((diffSec % 86400) / 3600)
        return `${days} gün ${hours} saat`
      }
    } catch (e) {
      console.error('Bağlantı süresi hesaplama hatası:', e, 'lastHandshake:', lastHandshake)
      return null
    }
  }, [parseMikroTikTime])

  // Peer'ları önceden işle ve cache'le - performans için
  const processedPeers = useMemo(() => {
    return allPeers.map((peer) => {
      const lastActivity = getLastActivity(peer)
      const connectionDuration = getConnectionDuration(peer)
      const rxBytes = parseInt(peer['rx-bytes'] || peer.rx || 0)
      const txBytes = parseInt(peer['tx-bytes'] || peer.tx || 0)
      const endpoint = peer['endpoint-address'] || peer.endpoint || peer['current-endpoint-address'] || 'Bağlı değil'
      const endpointPort = peer['endpoint-port'] || peer['current-endpoint-port'] || ''
      // Port değeri 0 veya "0" ise gösterme (geçersiz port)
      const fullEndpoint = (endpointPort && endpointPort !== '0' && endpointPort !== 0) ? `${endpoint}:${endpointPort}` : endpoint
      const name = peer.comment || peer.name || `Peer ${peer.id || peer['.id'] || ''}`
      const publicKey = peer['public-key'] || 'N/A'
      const allowedAddress = peer['allowed-address'] || 'N/A'
      
      return {
        ...peer,
        _processed: {
          lastActivity,
          connectionDuration,
          rxBytes,
          txBytes,
          fullEndpoint,
          name,
          publicKey,
          allowedAddress,
          // Arama için normalize edilmiş değerler
          _searchText: `${name} ${fullEndpoint} ${publicKey} ${allowedAddress}`.toLowerCase()
        }
      }
    })
  }, [allPeers, getLastActivity, getConnectionDuration])

  // Peer'ları filtrele ve sırala - useMemo ile optimize edildi
  const filteredPeers = useMemo(() => {
    let filtered = processedPeers

    // Arama filtresi - önceden hazırlanmış search text kullan
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter((p) => {
        return p._processed._searchText.includes(term)
      })
    }

    // Sıralama - önceden hesaplanmış değerleri kullan
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a._processed.name.localeCompare(b._processed.name)
        case 'rx':
          return b._processed.rxBytes - a._processed.rxBytes
        case 'tx':
          return b._processed.txBytes - a._processed.txBytes
        case 'lastActivity':
        default:
          return (b._processed.lastActivity.seconds || 0) - (a._processed.lastActivity.seconds || 0)
      }
    })

    return sorted
  }, [processedPeers, searchTerm, sortBy])

  // Peer trafik geçmişini göster
  const handleShowPeerTraffic = async (peerId, interfaceName, peerName) => {
    setSelectedPeer({ peerId, interfaceName, peerName })
    setShowTrafficModal(true)
    setTrafficPeriodType('daily')
    setTrafficStartDate('')
    setTrafficEndDate('')
    await loadPeerTrafficData(peerId, interfaceName, 'daily', '', '')
  }

  // Peer trafik verilerini yükle
  const loadPeerTrafficData = async (peerId, interfaceName, periodType, startDate, endDate) => {
    setLoadingTraffic(true)
    try {
      let response
      switch (periodType) {
        case 'hourly':
          response = await getPeerHourlyTraffic(peerId, interfaceName, startDate || undefined, endDate || undefined)
          break
        case 'daily':
          response = await getPeerDailyTraffic(peerId, interfaceName, startDate || undefined, endDate || undefined)
          break
        case 'monthly':
          response = await getPeerMonthlyTraffic(peerId, interfaceName, startDate || undefined, endDate || undefined)
          break
        case 'yearly':
          response = await getPeerYearlyTraffic(peerId, interfaceName, startDate || undefined, endDate || undefined)
          break
        default:
          response = await getPeerDailyTraffic(peerId, interfaceName, startDate || undefined, endDate || undefined)
      }

      if (response.success) {
        const sortedData = [...response.data].reverse()
        setPeerTrafficData(sortedData)
        setPeerTrafficSummary(response.summary)
      }
    } catch (error) {
      console.error('Peer trafik verisi yüklenemedi:', error)
      setPeerTrafficData([])
      setPeerTrafficSummary(null)
    } finally {
      setLoadingTraffic(false)
    }
  }

  // Peer trafik filtreleme
  const handleFilterPeerTraffic = async () => {
    if (selectedPeer) {
      await loadPeerTrafficData(selectedPeer.peerId, selectedPeer.interfaceName, trafficPeriodType, trafficStartDate, trafficEndDate)
    }
  }

  // Peer loglarını göster
  const handleShowPeerLogs = async (peerId, interfaceName) => {
    if (!peerId) {
      alert('Peer ID bulunamadı.')
      return
    }
    
    setSelectedPeer({ peerId, interfaceName })
    setShowLogsModal(true)
    
    // Default tarih filtreleri (son 7 gün)
    const today = new Date()
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const defaultStartDate = sevenDaysAgo.toISOString().split('T')[0]
    const defaultEndDate = today.toISOString().split('T')[0]
    
    setStartDate(defaultStartDate)
    setEndDate(defaultEndDate)
    setLogOffset(0) // Pagination'ı sıfırla
    
    setLoadingLogs(true)
    
    try {
      // Pagination ile logları çek (limit=100)
      const result = await getPeerLogs(peerId, interfaceName, defaultStartDate, defaultEndDate, logLimit, 0)
      if (result.success) {
        setPeerLogs(result.data || [])
        setLogSummary(result.summary || null)
      } else {
        alert('Loglar alınamadı: ' + (result.message || 'Bilinmeyen hata'))
        setPeerLogs([])
        setLogSummary(null)
      }
    } catch (error) {
      console.error('Log yükleme hatası:', error)
      alert('Loglar alınamadı: ' + (error.response?.data?.detail || error.message))
      setPeerLogs([])
      setLogSummary(null)
    } finally {
      setLoadingLogs(false)
    }
  }

  // Tarih filtresi ile logları yeniden yükle
  const handleFilterLogs = async () => {
    if (!selectedPeer) return
    
    setLoadingLogs(true)
    setLogOffset(0) // Filtreleme yapıldığında pagination'ı sıfırla
    
    try {
      const result = await getPeerLogs(
        selectedPeer.peerId, 
        selectedPeer.interfaceName,
        startDate || undefined,
        endDate || undefined,
        logLimit,
        0
      )
      if (result.success) {
        setPeerLogs(result.data || [])
        setLogSummary(result.summary || null)
      } else {
        alert('Loglar alınamadı: ' + (result.message || 'Bilinmeyen hata'))
      }
    } catch (error) {
      console.error('Log filtreleme hatası:', error)
      alert('Loglar filtrelenemedi: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLoadingLogs(false)
    }
  }
  
  // Daha fazla log yükle (pagination)
  const loadMoreLogs = async () => {
    if (!selectedPeer || loadingLogs) return
    
    setLoadingLogs(true)
    try {
      const newOffset = logOffset + logLimit
      const result = await getPeerLogs(
        selectedPeer.peerId,
        selectedPeer.interfaceName,
        startDate || undefined,
        endDate || undefined,
        logLimit,
        newOffset
      )
      if (result.success && result.data && result.data.length > 0) {
        setPeerLogs([...peerLogs, ...result.data])
        setLogOffset(newOffset)
      }
    } catch (error) {
      console.error('Daha fazla log yükleme hatası:', error)
    } finally {
      setLoadingLogs(false)
    }
  }

  // Tarih formatla (Türkiye saat dilimi - UTC+3)
  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return 'Bilinmiyor'
    try {
      let date
      
      // ISO formatında timezone bilgisi var mı kontrol et
      if (dateTimeStr.includes('+') || dateTimeStr.includes('Z')) {
        // ISO formatında timezone bilgisi var
        date = new Date(dateTimeStr)
      } else {
        // Timezone bilgisi yok, Türkiye saat dilimi (UTC+3) olarak kabul et
        // SQLite'dan gelen datetime'ı parse et ve UTC+3 olarak kabul et
        date = new Date(dateTimeStr + '+03:00')
      }
      
      // Türkiye saat dilimi (UTC+3) için offset uygula
      const turkeyOffset = 3 * 60 // UTC+3 dakika cinsinden
      const localTime = new Date(date.getTime() + (date.getTimezoneOffset() + turkeyOffset) * 60000)
      
      const day = String(localTime.getDate()).padStart(2, '0')
      const month = String(localTime.getMonth() + 1).padStart(2, '0')
      const year = localTime.getFullYear()
      const hours = String(localTime.getHours()).padStart(2, '0')
      const minutes = String(localTime.getMinutes()).padStart(2, '0')
      const seconds = String(localTime.getSeconds()).padStart(2, '0')
      return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`
    } catch (e) {
      console.error('Tarih formatlama hatası:', e, dateTimeStr)
      return dateTimeStr
    }
  }

  // İstatistik kartları - useMemo ile optimize edildi
  const statCards = useMemo(() => [
    {
      title: 'Toplam Interface',
      value: stats.totalInterfaces,
      icon: Network,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      title: 'Aktif Interface',
      value: stats.activeInterfaces,
      icon: Activity,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      title: 'Toplam Peer',
      value: stats.totalPeers,
      icon: Users,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
    {
      title: 'Online Peer',
      value: stats.activePeers,
      icon: Activity,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
  ], [stats])

  return (
    <div className="space-y-6">
      {/* Sayfa başlığı */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            WireGuard aktif peer'ları ve istatistikleri
          </p>
        </div>
        <button
          onClick={() => setShowWidgetSettings(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors w-full sm:w-auto"
          title="Widget Görünürlük Ayarları"
        >
          <Settings className="w-5 h-5" />
          <span>Ayarlar</span>
        </button>
      </div>

      {/* Genel Bakış Kartları */}
      {widgetVisibility.stats && dashboardStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {/* IP Pool Kartı */}
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 font-medium truncate">
                  IP Pool Kullanımı
                </p>
                <p className="text-xl sm:text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1 sm:mt-2">
                  {dashboardStats.ip_pool.usage_percent}%
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 hidden sm:block">
                  {dashboardStats.ip_pool.allocated_ips} / {dashboardStats.ip_pool.total_ips} IP
                </p>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-blue-200 dark:bg-blue-700/50 flex-shrink-0">
                <Database className="w-5 h-5 sm:w-6 sm:h-6 text-blue-700 dark:text-blue-300" />
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5 sm:h-2">
                <div
                  className="bg-blue-600 dark:bg-blue-400 h-1.5 sm:h-2 rounded-full transition-all duration-500"
                  style={{ width: `${dashboardStats.ip_pool.usage_percent}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Peer Templates Kartı */}
          <div className="card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-purple-700 dark:text-purple-300 font-medium truncate">
                  Peer Şablonları
                </p>
                <p className="text-xl sm:text-3xl font-bold text-purple-900 dark:text-purple-100 mt-1 sm:mt-2">
                  {dashboardStats.templates.total_templates}
                </p>
                {dashboardStats.templates.most_used_template && (
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 truncate hidden sm:block">
                    En çok: {dashboardStats.templates.most_used_template.name}
                  </p>
                )}
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-purple-200 dark:bg-purple-700/50 flex-shrink-0">
                <FileCode className="w-5 h-5 sm:w-6 sm:h-6 text-purple-700 dark:text-purple-300" />
              </div>
            </div>
          </div>

          {/* Kullanıcılar Kartı */}
          <div className="card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-green-700 dark:text-green-300 font-medium truncate">
                  Aktif Kullanıcılar
                </p>
                <p className="text-xl sm:text-3xl font-bold text-green-900 dark:text-green-100 mt-1 sm:mt-2">
                  {dashboardStats.users.active_users}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 hidden sm:block">
                  Toplam: {dashboardStats.users.total_users}
                </p>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-green-200 dark:bg-green-700/50 flex-shrink-0">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-green-700 dark:text-green-300" />
              </div>
            </div>
          </div>

          {/* Son 24 Saat Aktivite Kartı */}
          <div className="card bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-orange-700 dark:text-orange-300 font-medium truncate">
                  Son 24 Saat
                </p>
                <p className="text-xl sm:text-3xl font-bold text-orange-900 dark:text-orange-100 mt-1 sm:mt-2">
                  {dashboardStats.activity.last_24h}
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 hidden sm:block">
                  Toplam Aktivite
                </p>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-orange-200 dark:bg-orange-700/50 flex-shrink-0">
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-orange-700 dark:text-orange-300" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* İstatistik kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className="card">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                    {stat.title}
                  </p>
                  <p className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1 sm:mt-2">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-2 sm:p-3 rounded-lg ${stat.bgColor} flex-shrink-0`}>
                  <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Gerçek Zamanlı Veri Kullanımı Grafikleri */}
      {widgetVisibility.trafficCharts && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              Gelen Veri
            </h3>
            <span className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatBytes(stats.totalRx)}
            </span>
          </div>
          <div className="h-48">
            {trafficHistory.rx.length > 0 ? (
              <Line
                data={{
                  labels: trafficHistory.timestamps,
                  datasets: [
                    {
                      label: 'İndirme (MB)',
                      data: trafficHistory.rx,
                      borderColor: 'rgb(59, 130, 246)',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      fill: true,
                      tension: 0.4,
                      pointRadius: 3,
                      pointHoverRadius: 5,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      mode: 'index',
                      intersect: false,
                      callbacks: {
                        label: function (context) {
                          return `${context.parsed.y.toFixed(2)} MB`
                        },
                      },
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function (value) {
                          return value.toFixed(1) + ' MB'
                        },
                      },
                    },
                    x: {
                      ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                      },
                    },
                  },
                }}
              />
            ) : (
              <div className="h-full bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Veri toplanıyor...
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              Gönderilen Veri
            </h3>
            <span className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
              {formatBytes(stats.totalTx)}
            </span>
          </div>
          <div className="h-48">
            {trafficHistory.tx.length > 0 ? (
              <Line
                data={{
                  labels: trafficHistory.timestamps,
                  datasets: [
                    {
                      label: 'Yükleme (MB)',
                      data: trafficHistory.tx,
                      borderColor: 'rgb(34, 197, 94)',
                      backgroundColor: 'rgba(34, 197, 94, 0.1)',
                      fill: true,
                      tension: 0.4,
                      pointRadius: 3,
                      pointHoverRadius: 5,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      mode: 'index',
                      intersect: false,
                      callbacks: {
                        label: function (context) {
                          return `${context.parsed.y.toFixed(2)} MB`
                        },
                      },
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function (value) {
                          return value.toFixed(1) + ' MB'
                        },
                      },
                    },
                    x: {
                      ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                      },
                    },
                  },
                }}
              />
            ) : (
              <div className="h-full bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Veri toplanıyor...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* WAN Traffic Widget */}
      {widgetVisibility.wanTraffic && (
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Network className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              WAN Trafiği
            </h3>
            <span className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
              {wanTraffic.interfaceName || 'N/A'}
            </span>
          </div>

          {/* Anlık Değerler */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Download className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm text-blue-700 dark:text-blue-300">İndirme</p>
                <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                  {formatBytes(wanTraffic.rxBytes)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Upload className="w-8 h-8 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm text-green-700 dark:text-green-300">Yükleme</p>
                <p className="text-xl font-bold text-green-900 dark:text-green-100">
                  {formatBytes(wanTraffic.txBytes)}
                </p>
              </div>
            </div>
          </div>

          {/* Tarihsel Grafik */}
          <div className="h-48">
            {wanTraffic.history.rx.length > 0 ? (
              <Line
                data={{
                  labels: wanTraffic.history.timestamps,
                  datasets: [
                    {
                      label: 'İndirme Hızı (MB/s)',
                      data: wanTraffic.history.rx,
                      borderColor: 'rgb(59, 130, 246)',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      fill: true,
                      tension: 0.4,
                      pointRadius: 2,
                      pointHoverRadius: 4,
                    },
                    {
                      label: 'Yükleme Hızı (MB/s)',
                      data: wanTraffic.history.tx,
                      borderColor: 'rgb(34, 197, 94)',
                      backgroundColor: 'rgba(34, 197, 94, 0.1)',
                      fill: true,
                      tension: 0.4,
                      pointRadius: 2,
                      pointHoverRadius: 4,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: true,
                      position: 'top',
                    },
                    tooltip: {
                      mode: 'index',
                      intersect: false,
                      callbacks: {
                        label: function (context) {
                          return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} MB/s`
                        },
                      },
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function (value) {
                          return value.toFixed(1) + ' MB/s'
                        },
                      },
                    },
                    x: {
                      ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                      },
                    },
                  },
                }}
              />
            ) : (
              <div className="h-full bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Veri toplanıyor...
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Online Peer'lar */}
      {widgetVisibility.activePeers && (
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Online Peer'lar
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Şu anda bağlı olan cihazlar
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
              {loadingPeers ? '...' : filteredPeers.filter(p => p._processed.lastActivity.isOnline).length}
            </span>
            <Wifi className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
        </div>

        {loadingPeers ? (
          <div className="text-center py-8">
            <RefreshCw className="w-12 h-12 text-primary-600 dark:text-primary-400 mx-auto mb-3 animate-spin" />
            <p className="text-gray-500 dark:text-gray-400">Online peer'lar yükleniyor...</p>
          </div>
        ) : filteredPeers.filter(p => p._processed.lastActivity.isOnline).length === 0 ? (
          <div className="text-center py-8">
            <Wifi className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Şu anda aktif peer yok</p>
          </div>
        ) : (
          <>
            {/* Mobil Kart Görünümü */}
            <div className="md:hidden grid grid-cols-1 gap-3">
              {filteredPeers
                .filter(p => p._processed.lastActivity.isOnline)
                .map((peer, index) => (
                  <div
                    key={peer.id || peer['.id'] || index}
                    onClick={() => handleShowPeerDetails(peer)}
                    className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="font-medium text-gray-900 dark:text-white text-sm">
                          {peer._processed.name}
                        </span>
                      </div>
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                        {peer._processed.lastActivity.text}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {peer._processed.allowedAddress}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <Download className="w-3 h-3 text-blue-500" />
                        <span className="text-gray-700 dark:text-gray-300">{formatBytes(peer._processed.rxBytes)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Upload className="w-3 h-3 text-green-500" />
                        <span className="text-gray-700 dark:text-gray-300">{formatBytes(peer._processed.txBytes)}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            
            {/* Desktop Tablo Görünümü */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Peer Adı
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      IP Adresi
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 hidden lg:table-cell">
                      Endpoint
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      İndirme
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Yükleme
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Son İletişim
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPeers
                    .filter(p => p._processed.lastActivity.isOnline)
                    .map((peer, index) => (
                      <tr
                        key={peer.id || peer['.id'] || index}
                        onClick={() => handleShowPeerDetails(peer)}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {peer._processed.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                          {peer._processed.allowedAddress}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                          {peer._processed.fullEndpoint}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Download className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {formatBytes(peer._processed.rxBytes)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Upload className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {formatBytes(peer._processed.txBytes)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                            {peer._processed.lastActivity.text}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      )}

      {/* IP Pool Kullanım Detayları ve Son Aktiviteler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* IP Pool Kullanım Detayları */}
        {widgetVisibility.ipPoolUsage && ipPoolUsage.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  IP Pool Kullanım Detayları
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Tüm havuzların kullanım durumu
                </p>
              </div>
              <BarChart3 className="w-6 h-6 text-gray-400" />
            </div>
            <div className="space-y-4">
              {ipPoolUsage.map((pool) => (
                <div key={pool.pool_id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {pool.pool_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {pool.interface_name} - {pool.subnet}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {pool.usage_percent}%
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {pool.allocated} / {pool.total_ips}
                      </p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        pool.usage_percent >= 90
                          ? 'bg-red-500'
                          : pool.usage_percent >= 70
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${pool.usage_percent}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Son Aktiviteler Timeline */}
        {widgetVisibility.recentActivities && recentActivities.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Son Aktiviteler
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Son 10 işlem
                </p>
              </div>
              <Clock className="w-6 h-6 text-gray-400" />
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      activity.action === 'create' ? 'bg-green-500' :
                      activity.action === 'delete' ? 'bg-red-500' :
                      activity.action === 'update' ? 'bg-blue-500' :
                      'bg-gray-500'
                    }`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {activity.username}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      <span className="font-medium">{activity.action}</span> - {activity.resource_type}
                      {activity.resource_name && (
                        <span className="text-gray-500 dark:text-gray-500"> : {activity.resource_name}</span>
                      )}
                    </p>
                    {activity.timestamp && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {new Date(activity.timestamp).toLocaleString('tr-TR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grup Dağılımı ve Süresi Dolacak Peer'lar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Peer Grup Dağılımı */}
        {widgetVisibility.peerGroups && peerGroupData.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Peer Grup Dağılımı
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Gruplara göre peer sayıları
                </p>
              </div>
              <Users className="w-6 h-6 text-gray-400" />
            </div>
            <div className="space-y-3">
              {peerGroupData.slice(0, 8).map((group, idx) => {
                const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B', '#EF4444', '#3B82F6', '#10B981']
                const color = colors[idx % colors.length]
                const total = peerGroupData.reduce((sum, g) => sum + g.count, 0)
                const percentage = total > 0 ? Math.round((group.count / total) * 100) : 0
                
                return (
                  <div key={group.group_name} className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    ></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {group.group_name}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                          {group.count} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%`, backgroundColor: color }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {peerGroupData.length > 8 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
                  +{peerGroupData.length - 8} daha fazla grup
                </p>
              )}
            </div>
          </div>
        )}

        {/* Süresi Dolacak Peer'lar */}
        {widgetVisibility.expiringPeers && expiringPeersData.total > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Süre Uyarıları
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Süresi dolmuş ve dolacak peer'lar
                </p>
              </div>
              <div className="flex items-center gap-2">
                {expiringPeersData.expired_count > 0 && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    {expiringPeersData.expired_count} Dolmuş
                  </span>
                )}
                {expiringPeersData.expiring_count > 0 && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    {expiringPeersData.expiring_count} Dolacak
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {expiringPeersData.expired.slice(0, 5).map((peer) => (
                <Link
                  key={peer.peer_id}
                  to={`/wireguard/${peer.interface_name}`}
                  className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-red-700 dark:text-red-400 truncate">
                      {peer.public_key?.substring(0, 20)}...
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-500">
                      {peer.interface_name} {peer.group_name && `• ${peer.group_name}`}
                    </p>
                  </div>
                  <span className="text-xs text-red-600 dark:text-red-500 ml-2">
                    {new Date(peer.expiry_date).toLocaleDateString('tr-TR')}
                  </span>
                </Link>
              ))}
              {expiringPeersData.expiring.slice(0, 5).map((peer) => (
                <Link
                  key={peer.peer_id}
                  to={`/wireguard/${peer.interface_name}`}
                  className="flex items-center justify-between p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 truncate">
                      {peer.public_key?.substring(0, 20)}...
                    </p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-500">
                      {peer.interface_name} {peer.group_name && `• ${peer.group_name}`}
                    </p>
                  </div>
                  <span className="text-xs text-yellow-600 dark:text-yellow-500 ml-2">
                    {new Date(peer.expiry_date).toLocaleDateString('tr-TR')}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tüm Peer Listesi */}
      <div className="card">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
              Tüm Peer'lar
            </h2>
            <button className="px-2 sm:px-3 py-1 rounded-lg bg-green-600 text-white text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
              <Users className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Aktif Eşler</span> ({filteredPeers.length})
            </button>
          </div>
          
          {/* Kontrol Butonları - Mobil Optimize */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                const sortOptions = ['lastActivity', 'name', 'rx', 'tx']
                const currentIndex = sortOptions.indexOf(sortBy)
                const nextIndex = (currentIndex + 1) % sortOptions.length
                setSortBy(sortOptions[nextIndex])
              }}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              title={`Sırala: ${sortBy === 'lastActivity' ? 'Son Aktivite' : sortBy === 'name' ? 'İsim' : sortBy === 'rx' ? 'İndirme' : 'Yükleme'}`}
            >
              <ArrowUpDown className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">Yenileme:</span>
              <select
                value={refreshRate}
                onChange={(e) => setRefreshRate(Number(e.target.value))}
                className="px-2 sm:px-3 py-1 rounded-lg bg-blue-600 text-white text-xs sm:text-sm font-medium border-0 focus:ring-2 focus:ring-blue-300"
              >
                <option value={10}>10s</option>
                <option value={30}>30s</option>
                <option value={60}>1dk</option>
                <option value={120}>2dk</option>
                <option value={300}>5dk</option>
              </select>
            </div>
            
            <button
              onClick={() => loadData(false)}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Yenile"
            >
              <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            
            <div className="flex-1 min-w-0 sm:flex-none">
              <div className="relative">
                <Search className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-auto pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <button className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hidden sm:block">
              <Download className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hidden sm:block">
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        {filteredPeers.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
              {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz aktif peer bulunamadı'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPeers.map((peer, index) => {
              // Önceden işlenmiş verileri kullan (performans için)
              const { lastActivity, connectionDuration, rxBytes, txBytes, fullEndpoint, name, publicKey, allowedAddress } = peer._processed

              return (
                <div
                  key={peer['.id'] || peer.id || index}
                  className="p-3 sm:p-5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Başlık ve Durum */}
                      <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${
                          lastActivity.isOnline 
                            ? 'bg-green-500 animate-pulse' 
                            : 'bg-gray-400'
                        }`}></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white truncate">
                              {name}
                            </p>
                            <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${
                              lastActivity.isOnline
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}>
                              {lastActivity.isOnline ? 'Online' : 'Offline'}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                            {fullEndpoint}
                          </p>
                        </div>
                      </div>
                      
                      {/* Peer Bilgileri */}
                      <div className="grid grid-cols-1 gap-2 sm:gap-4 mt-3 sm:mt-4">
                        <div className="hidden sm:block space-y-2">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Genel Anahtar
                          </p>
                          <p className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all bg-gray-50 dark:bg-gray-900/50 p-2 rounded">
                            {publicKey.substring(0, 44)}...
                          </p>
                        </div>
                        <div className="space-y-1 sm:space-y-2">
                          <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            IP Adresi
                          </p>
                          <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                            {allowedAddress}
                          </p>
                        </div>
                      </div>

                      {/* İstatistikler */}
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          <div className="p-1 sm:p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                            <Download className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">İndirme</p>
                            <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">
                              {formatBytes(rxBytes)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="p-1 sm:p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30">
                            <Upload className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Yükleme</p>
                            <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">
                              {formatBytes(txBytes)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="p-1 sm:p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                            <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-purple-600 dark:text-purple-400" />
                          </div>
                  <div>
                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Son Aktivite</p>
                            <p className={`text-xs sm:text-sm font-semibold ${
                              lastActivity.isOnline 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-gray-600 dark:text-gray-400'
                            }`}>
                              {lastActivity.text}
                            </p>
                          </div>
                        </div>
                        {connectionDuration && (
                          <div className="flex items-center gap-2">
                            <div className="p-1 sm:p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                              <Wifi className="w-3 h-3 sm:w-4 sm:h-4 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Bağlantı</p>
                              <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">
                                {connectionDuration}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Aksiyon Butonları */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-shrink-0 mt-4 sm:mt-0">
                      <button
                        onClick={() => {
                          const peerId = peer.id || peer['.id']
                          if (!peerId) {
                            alert('Peer ID bulunamadı.')
                            return
                          }
                          handleShowPeerLogs(peerId, peer.interfaceName)
                        }}
                        className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs sm:text-sm font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-1 sm:gap-2"
                        title="Peer Logları"
                      >
                        <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Loglar</span>
                      </button>
                      <button
                        onClick={() => {
                          const peerId = peer.id || peer['.id']
                          if (!peerId) {
                            alert('Peer ID bulunamadı.')
                            return
                          }
                          handleShowPeerTraffic(peerId, peer.interfaceName, peer.comment || peer.name)
                        }}
                        className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1 sm:gap-2"
                        title="Peer Trafik Geçmişi"
                      >
                        <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Trafik</span>
                      </button>
                      <Link
                        to={`/wireguard/${peer.interfaceName}`}
                        className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs sm:text-sm font-medium hover:bg-primary-700 transition-colors text-center"
                      >
                        Detay
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Peer Logları Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                  Peer Logları
                </h2>
                {selectedPeer && (
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                    <span className="hidden sm:inline">Arayüz: </span>{selectedPeer.interfaceName}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setShowLogsModal(false)
                  setSelectedPeer(null)
                  setPeerLogs([])
                  setLogSummary(null)
                  setStartDate('')
                  setEndDate('')
                }}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Tarih Filtreleri ve İstatistikler */}
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                    Başlangıç
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                    Bitiş
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="flex items-end col-span-2 sm:col-span-1">
                  <button
                    onClick={handleFilterLogs}
                    className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Filtrele
                  </button>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setStartDate('')
                      setEndDate('')
                      handleFilterLogs()
                    }}
                    className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Temizle
                  </button>
                </div>
              </div>
              
              {/* İstatistikler */}
              {logSummary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg">
                    <p className="text-xs text-gray-600 dark:text-gray-400">Online Olaylar</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">{logSummary.total_online_events || 0}</p>
                  </div>
                  <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-lg">
                    <p className="text-xs text-gray-600 dark:text-gray-400">Offline Olaylar</p>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-400">{logSummary.total_offline_events || 0}</p>
                  </div>
                  <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-lg">
                    <p className="text-xs text-gray-600 dark:text-gray-400">Kopma Sayısı</p>
                    <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{logSummary.disconnections || 0}</p>
                  </div>
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
                    <p className="text-xs text-gray-600 dark:text-gray-400">Toplam Olay</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{logSummary.total_events || 0}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingLogs ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-primary-600 dark:text-primary-400" />
                  <p className="text-gray-500 dark:text-gray-400">Kayıtlar yükleniyor...</p>
                </div>
              ) : peerLogs.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">Henüz kayıt bulunamadı</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {peerLogs.map((log, index) => (
                    <div
                      key={log.id || index}
                      className={`p-4 rounded-lg border ${
                        log.is_online
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              log.is_online ? 'bg-green-500' : 'bg-red-500'
                            }`}
                          ></div>
                          <div>
                            <p
                              className={`font-semibold ${
                                log.is_online
                                  ? 'text-green-700 dark:text-green-400'
                                  : 'text-red-700 dark:text-red-400'
                              }`}
                            >
                              {log.is_online ? '🟢 Çevrimiçi' : '🔴 Çevrimdışı'}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {log.event_time ? formatDateTime(log.event_time) : 'Bilinmiyor'}
                            </p>
                          </div>
                        </div>
                        {log.last_handshake_value && (
                          <div className="text-right">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Son Bağlantı</p>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {log.last_handshake_value}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
            ))}
          </div>
        )}
      </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Toplam {peerLogs.length} kayıt gösteriliyor
                </p>
                {peerLogs.length >= logLimit && (
                  <button
                    onClick={loadMoreLogs}
                    disabled={loadingLogs}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loadingLogs ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Yükleniyor...
                      </>
                    ) : (
                      'Daha Fazla Yükle'
                    )}
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setShowLogsModal(false)
                  setSelectedPeer(null)
                  setPeerLogs([])
                  setLogSummary(null)
                  setStartDate('')
                  setEndDate('')
                  setLogOffset(0)
                }}
                className="px-4 py-2 rounded-lg bg-gray-600 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Peer Trafik Geçmişi Modal */}
      {showTrafficModal && selectedPeer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-6xl h-full sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start sm:items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex-1 min-w-0 pr-2">
                <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                  Peer Trafik Geçmişi
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                  <span className="hidden sm:inline">Peer: {selectedPeer.peerName} | Arayüz: {selectedPeer.interfaceName}</span>
                  <span className="sm:hidden">{selectedPeer.peerName}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setShowTrafficModal(false)
                  setSelectedPeer(null)
                  setPeerTrafficData([])
                  setPeerTrafficSummary(null)
                  setTrafficStartDate('')
                  setTrafficEndDate('')
                }}
                className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Filtreler */}
            <div className="p-3 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                    Zaman Aralığı
                  </label>
                  <select
                    value={trafficPeriodType}
                    onChange={(e) => {
                      setTrafficPeriodType(e.target.value)
                      loadPeerTrafficData(selectedPeer.peerId, selectedPeer.interfaceName, e.target.value, trafficStartDate, trafficEndDate)
                    }}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="hourly">Saatlik</option>
                    <option value="daily">Günlük</option>
                    <option value="monthly">Aylık</option>
                    <option value="yearly">Yıllık</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                    Başlangıç
                  </label>
                  <input
                    type="date"
                    value={trafficStartDate}
                    onChange={(e) => setTrafficStartDate(e.target.value)}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                    Bitiş
                  </label>
                  <input
                    type="date"
                    value={trafficEndDate}
                    onChange={(e) => setTrafficEndDate(e.target.value)}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1 flex items-end gap-2">
                  <button
                    onClick={handleFilterPeerTraffic}
                    className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1 sm:gap-2"
                  >
                    <RefreshCwIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loadingTraffic ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Filtrele</span>
                    <span className="sm:hidden">Ara</span>
                  </button>
                  <button
                    onClick={() => {
                      setTrafficStartDate('')
                      setTrafficEndDate('')
                      loadPeerTrafficData(selectedPeer.peerId, selectedPeer.interfaceName, trafficPeriodType, '', '')
                    }}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <span className="hidden sm:inline">Temizle</span>
                    <span className="sm:hidden">Sıfırla</span>
                  </button>
                </div>
              </div>

              {/* Özet İstatistikler */}
              {peerTrafficSummary && peerTrafficSummary.record_count > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mt-3 sm:mt-4">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-2 sm:p-3 rounded-lg">
                    <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">Toplam İndirme</p>
                    <p className="text-base sm:text-2xl font-bold text-blue-700 dark:text-blue-400">{peerTrafficSummary.total_rx_mb.toFixed(2)} MB</p>
                  </div>
                  <div className="bg-green-100 dark:bg-green-900/30 p-2 sm:p-3 rounded-lg">
                    <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">Toplam Yükleme</p>
                    <p className="text-base sm:text-2xl font-bold text-green-700 dark:text-green-400">{peerTrafficSummary.total_tx_mb.toFixed(2)} MB</p>
                  </div>
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-2 sm:p-3 rounded-lg">
                    <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">Ortalama İndirme</p>
                    <p className="text-base sm:text-2xl font-bold text-purple-700 dark:text-purple-400">{(peerTrafficSummary.avg_rx_bytes / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                  <div className="bg-orange-100 dark:bg-orange-900/30 p-2 sm:p-3 rounded-lg">
                    <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">Kayıt Sayısı</p>
                    <p className="text-base sm:text-2xl font-bold text-orange-700 dark:text-orange-400">{peerTrafficSummary.record_count}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Grafik */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6">
              {loadingTraffic ? (
                <div className="flex items-center justify-center h-64 sm:h-96">
                  <RefreshCwIcon className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-primary-600 dark:text-primary-400" />
                </div>
              ) : peerTrafficData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 sm:h-96 text-gray-500 dark:text-gray-400">
                  <TrendingUp className="w-12 h-12 sm:w-16 sm:h-16 mb-3 sm:mb-4" />
                  <p className="text-sm sm:text-lg font-medium text-center">Henüz trafik verisi bulunamadı</p>
                  <p className="text-xs sm:text-sm mt-1 sm:mt-2 text-center">Trafik verileri periyodik olarak kaydedilecek</p>
                </div>
              ) : (
                <div className="h-64 sm:h-96 mb-4 sm:mb-6">
                  <Line
                    data={{
                      labels: peerTrafficData.map((item) => {
                        const date = new Date(item.timestamp)
                        const day = String(date.getDate()).padStart(2, '0')
                        const month = String(date.getMonth() + 1).padStart(2, '0')
                        const year = date.getFullYear()
                        const hours = String(date.getHours()).padStart(2, '0')
                        const minutes = String(date.getMinutes()).padStart(2, '0')
                        
                        if (trafficPeriodType === 'hourly') {
                          return `${day}.${month}.${year} ${hours}:${minutes}`
                        } else if (trafficPeriodType === 'daily') {
                          return `${day}.${month}.${year}`
                        } else if (trafficPeriodType === 'monthly') {
                          return `${month}.${year}`
                        } else {
                          return `${year}`
                        }
                      }),
                      datasets: [
                        {
                          label: 'İndirme (MB)',
                          data: peerTrafficData.map((item) => item.rx_mb),
                          borderColor: 'rgb(59, 130, 246)',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          fill: true,
                          tension: 0.4,
                        },
                        {
                          label: 'Yükleme (MB)',
                          data: peerTrafficData.map((item) => item.tx_mb),
                          borderColor: 'rgb(34, 197, 94)',
                          backgroundColor: 'rgba(34, 197, 94, 0.1)',
                          fill: true,
                          tension: 0.4,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top',
                        },
                        title: {
                          display: true,
                          text: `${trafficPeriodType === 'hourly' ? 'Saatlik' : trafficPeriodType === 'daily' ? 'Günlük' : trafficPeriodType === 'monthly' ? 'Aylık' : 'Yıllık'} Trafik Kullanımı`,
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
                    }}
                  />
                </div>
              )}

              {/* Veri Tablosu */}
              {peerTrafficData.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Detaylı Veriler
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Tarih/Saat</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">İndirme (MB)</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Yükleme (MB)</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Toplam (MB)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {peerTrafficData.map((item) => {
                          const date = new Date(item.timestamp)
                          const day = String(date.getDate()).padStart(2, '0')
                          const month = String(date.getMonth() + 1).padStart(2, '0')
                          const year = date.getFullYear()
                          const hours = String(date.getHours()).padStart(2, '0')
                          const minutes = String(date.getMinutes()).padStart(2, '0')
                          
                          let dateStr = ''
                          if (trafficPeriodType === 'hourly') {
                            dateStr = `${day}.${month}.${year} ${hours}:${minutes}`
                          } else if (trafficPeriodType === 'daily') {
                            dateStr = `${day}.${month}.${year}`
                          } else if (trafficPeriodType === 'monthly') {
                            dateStr = `${month}.${year}`
                          } else {
                            dateStr = `${year}`
                          }
                          
                          return (
                            <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{dateStr}</td>
                              <td className="py-3 px-4 text-sm text-right text-blue-600 dark:text-blue-400 font-medium">{item.rx_mb.toFixed(2)}</td>
                              <td className="py-3 px-4 text-sm text-right text-green-600 dark:text-green-400 font-medium">{item.tx_mb.toFixed(2)}</td>
                              <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-white font-semibold">{(item.rx_mb + item.tx_mb).toFixed(2)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Peer Detay Modal */}
      {showPeerDetailsModal && selectedPeer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Peer Detayları
              </h2>
              <button
                onClick={() => setShowPeerDetailsModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Peer Adı</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedPeer._processed?.name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">IP Adresi</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedPeer._processed?.allowedAddress || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Endpoint</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedPeer._processed?.fullEndpoint || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Public Key</p>
                    <p className="font-mono text-xs text-gray-900 dark:text-white break-all">
                      {selectedPeer._processed?.publicKey || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Interface</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedPeer.interfaceName || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Durum</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${selectedPeer._processed?.lastActivity.isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                      <span className={`font-medium ${selectedPeer._processed?.lastActivity.isOnline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {selectedPeer._processed?.lastActivity.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Son İletişim</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedPeer._processed?.lastActivity.text || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Bağlantı Süresi</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedPeer._processed?.connectionDuration || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Veri Kullanımı
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="card bg-blue-50 dark:bg-blue-900/20">
                    <div className="flex items-center gap-3">
                      <Download className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                      <div>
                        <p className="text-sm text-blue-700 dark:text-blue-300">İndirme</p>
                        <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                          {formatBytes(selectedPeer._processed?.rxBytes || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="card bg-green-50 dark:bg-green-900/20">
                    <div className="flex items-center gap-3">
                      <Upload className="w-8 h-8 text-green-600 dark:text-green-400" />
                      <div>
                        <p className="text-sm text-green-700 dark:text-green-300">Yükleme</p>
                        <p className="text-xl font-bold text-green-900 dark:text-green-100">
                          {formatBytes(selectedPeer._processed?.txBytes || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Widget Ayarları Modal */}
      {showWidgetSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Dashboard Widget Ayarları
              </h2>
              <button
                onClick={() => setShowWidgetSettings(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Widget'ları sürükleyerek sıralayın, tıklayarak göster/gizle
              </p>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
                  {widgetOrder.map((widgetKey) => {
                    const widgetInfo = {
                      stats: { label: 'İstatistik Kartları', icon: BarChart3 },
                      trafficCharts: { label: 'Trafik Grafikleri', icon: TrendingUp },
                      wanTraffic: { label: 'WAN Traffic', icon: Network },
                      activePeers: { label: 'Online Peer\'lar', icon: Wifi },
                      ipPoolUsage: { label: 'IP Pool Kullanımı', icon: Database },
                      recentActivities: { label: 'Son Aktiviteler', icon: Clock },
                      peerGroups: { label: 'Grup Dağılımı', icon: Users },
                      expiringPeers: { label: 'Süre Uyarıları', icon: AlertCircle }
                    }[widgetKey]

                    if (!widgetInfo) return null

                    return (
                      <SortableWidgetItem
                        key={widgetKey}
                        id={widgetKey}
                        widget={{ key: widgetKey, ...widgetInfo }}
                        isVisible={widgetVisibility[widgetKey]}
                        onToggle={() => toggleWidget(widgetKey)}
                      />
                    )
                  })}
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
