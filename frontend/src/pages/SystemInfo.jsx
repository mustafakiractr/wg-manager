/**
 * Sistem Bilgisi Sayfası
 * CPU, RAM, Disk, Timezone ayarları ve sistem güncellemeleri
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import {
  Server,
  Cpu,
  HardDrive,
  Clock,
  RefreshCw,
  Download,
  Power,
  AlertTriangle,
  CheckCircle,
  Activity,
  Calendar
} from 'lucide-react'

export default function SystemInfo() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  
  const [systemInfo, setSystemInfo] = useState(null)
  const [availableTimezones, setAvailableTimezones] = useState([])
  const [selectedTimezone, setSelectedTimezone] = useState('')
  const [timezoneSearch, setTimezoneSearch] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [changingTimezone, setChangingTimezone] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Saat formatlama fonksiyonu
  const formatTime = useCallback((date, timezone) => {
    try {
      return new Intl.DateTimeFormat('sv-SE', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date).replace(' ', ' ')
    } catch {
      return date.toISOString().slice(0, 19).replace('T', ' ')
    }
  }, [])

  useEffect(() => {
    fetchSystemInfo()
    fetchTimezones()

    // Her 10 saniyede bir sistem bilgisini güncelle
    const systemInterval = setInterval(fetchSystemInfo, 10000)

    // Her saniye saati güncelle
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => {
      clearInterval(systemInterval)
      clearInterval(timeInterval)
    }
  }, [])

  const fetchSystemInfo = async () => {
    try {
      const response = await api.get('/system/info')
      setSystemInfo(response.data.data)
      setLoading(false)
    } catch (error) {
      console.error('Sistem bilgisi alınamadı:', error)
      showToast('Sistem bilgisi alınamadı', 'error')
      setLoading(false)
    }
  }

  const fetchTimezones = async () => {
    try {
      const response = await api.get('/system/timezones')
      setAvailableTimezones(response.data.data || [])
    } catch (error) {
      console.error('Timezone listesi alınamadı:', error)
      showToast('Timezone listesi alınamadı', 'error')
    }
  }

  // Timezone'ları filtrele (useMemo ile optimize et)
  const filteredTimezones = useMemo(() => {
    if (!Array.isArray(availableTimezones)) return []
    
    return availableTimezones.filter((tz) => {
      const matchesSearch = tz.label?.toLowerCase().includes(timezoneSearch.toLowerCase()) ||
                           tz.value?.toLowerCase().includes(timezoneSearch.toLowerCase())
      const matchesRegion = !selectedRegion || tz.region === selectedRegion
      return matchesSearch && matchesRegion
    })
  }, [availableTimezones, timezoneSearch, selectedRegion])

  // Bölgeleri (region) al (useMemo ile optimize et)
  const regions = useMemo(() => {
    if (!Array.isArray(availableTimezones)) return []
    
    const uniqueRegions = [...new Set(availableTimezones.map(tz => tz.region).filter(Boolean))]
    return uniqueRegions.sort()
  }, [availableTimezones])

  const handleChangeTimezone = async () => {
    if (!selectedTimezone) {
      showToast('Lütfen bir timezone seçin', 'error')
      return
    }

    if (!confirm(`Sistem timezone'u ${selectedTimezone} olarak değiştirilecek. Onaylıyor musunuz?`)) {
      return
    }

    setChangingTimezone(true)
    try {
      const response = await api.post('/system/timezone', {
        timezone: selectedTimezone
      })
      
      showToast(response.data.message, 'success')
      fetchSystemInfo()
      setSelectedTimezone('')
    } catch (error) {
      console.error('Timezone değiştirilemedi:', error)
      showToast(error.response?.data?.detail || 'Timezone değiştirilemedi', 'error')
    } finally {
      setChangingTimezone(false)
    }
  }

  const handleUpdate = async () => {
    if (!confirm('Paket listesi güncellenecek (apt update). Devam edilsin mi?')) {
      return
    }

    setUpdating(true)
    try {
      const response = await api.post('/system/update')
      showToast(response.data.message, 'success')
    } catch (error) {
      console.error('Update başarısız:', error)
      showToast(error.response?.data?.detail || 'Update başarısız', 'error')
    } finally {
      setUpdating(false)
    }
  }

  const handleUpgrade = async () => {
    if (!confirm('⚠️ DİKKAT: Sistem paketleri yükseltilecek (apt upgrade). Bu işlem 5-10 dakika sürebilir. Devam edilsin mi?')) {
      return
    }

    setUpgrading(true)
    try {
      const response = await api.post('/system/upgrade')
      showToast(response.data.message, 'success')
    } catch (error) {
      console.error('Upgrade başarısız:', error)
      showToast(error.response?.data?.detail || 'Upgrade başarısız', 'error')
    } finally {
      setUpgrading(false)
    }
  }

  const handleReboot = async () => {
    if (!confirm('⚠️ UYARI: Sistem yeniden başlatılacak! Tüm bağlantılar kopacak. Onaylıyor musunuz?')) {
      return
    }

    try {
      const response = await api.post('/system/reboot')
      showToast(response.data.message, 'warning')
      
      // 5 saniye sonra login sayfasına yönlendir
      setTimeout(() => {
        navigate('/login')
      }, 5000)
    } catch (error) {
      console.error('Reboot başarısız:', error)
      showToast(error.response?.data?.detail || 'Reboot başarısız', 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!systemInfo) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <p className="text-gray-600">Sistem bilgisi yüklenemedi</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Server className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sistem Bilgisi</h1>
            <p className="text-sm text-gray-600">Sunucu durumu ve sistem yönetimi</p>
          </div>
        </div>
        
        <button
          onClick={fetchSystemInfo}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Yenile</span>
        </button>
      </div>

      {/* Sistem Kaynakları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CPU */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Cpu className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">CPU</h2>
            </div>
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {systemInfo.cpu.percent.toFixed(1)}%
            </span>
          </div>
          
          <div className="space-y-2">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  systemInfo.cpu.percent > 80 ? 'bg-red-600' :
                  systemInfo.cpu.percent > 60 ? 'bg-yellow-600' :
                  'bg-green-600'
                }`}
                style={{ width: `${systemInfo.cpu.percent}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {systemInfo.cpu.count} Çekirdek
            </p>
          </div>
        </div>

        {/* RAM */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bellek (RAM)</h2>
            </div>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {systemInfo.memory.percent.toFixed(1)}%
            </span>
          </div>
          
          <div className="space-y-2">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  systemInfo.memory.percent > 80 ? 'bg-red-600' :
                  systemInfo.memory.percent > 60 ? 'bg-yellow-600' :
                  'bg-green-600'
                }`}
                style={{ width: `${systemInfo.memory.percent}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {systemInfo.memory.used_gb.toFixed(2)} GB / {systemInfo.memory.total_gb.toFixed(2)} GB
            </p>
          </div>
        </div>

        {/* Disk */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <HardDrive className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Disk</h2>
            </div>
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {systemInfo.disk.percent.toFixed(1)}%
            </span>
          </div>
          
          <div className="space-y-2">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  systemInfo.disk.percent > 80 ? 'bg-red-600' :
                  systemInfo.disk.percent > 60 ? 'bg-yellow-600' :
                  'bg-green-600'
                }`}
                style={{ width: `${systemInfo.disk.percent}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {systemInfo.disk.used_gb.toFixed(2)} GB / {systemInfo.disk.total_gb.toFixed(2)} GB
            </p>
          </div>
        </div>
      </div>

      {/* İşletim Sistemi ve Uptime */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* İşletim Sistemi */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-900 dark:text-white">
            <Server className="h-5 w-5 mr-2 text-gray-600 dark:text-gray-400" />
            İşletim Sistemi
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Sistem:</span>
              <span className="font-medium text-gray-900 dark:text-white">{systemInfo.os.system}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Sürüm:</span>
              <span className="font-medium text-gray-900 dark:text-white">{systemInfo.os.release}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Mimari:</span>
              <span className="font-medium text-gray-900 dark:text-white">{systemInfo.os.machine}</span>
            </div>
          </div>
        </div>

        {/* Uptime */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-900 dark:text-white">
            <Calendar className="h-5 w-5 mr-2 text-gray-600 dark:text-gray-400" />
            Çalışma Süresi
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Gün:</span>
              <span className="font-medium text-gray-900 dark:text-white">{systemInfo.uptime.days}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Saat:</span>
              <span className="font-medium text-gray-900 dark:text-white">{systemInfo.uptime.hours}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Dakika:</span>
              <span className="font-medium text-gray-900 dark:text-white">{systemInfo.uptime.minutes}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Timezone Ayarları */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-900 dark:text-white">
          <Clock className="h-5 w-5 mr-2 text-gray-600 dark:text-gray-400" />
          Saat Dilimi (Timezone) Ayarları
        </h2>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Mevcut Timezone</label>
              <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg font-medium text-gray-900 dark:text-white">
                {systemInfo.timezone.current}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                <span className="inline-flex items-center">
                  Sistem Saati
                  <span className="ml-2 inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                </span>
              </label>
              <div className="px-4 py-2 bg-green-50 dark:bg-green-900/30 rounded-lg font-mono font-medium text-green-800 dark:text-green-300">
                {formatTime(currentTime, systemInfo.timezone.current)}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                <span className="inline-flex items-center">
                  Türkiye Saati (UTC+3)
                  <span className="ml-2 inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                </span>
              </label>
              <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg font-mono font-medium text-blue-800 dark:text-blue-300">
                {formatTime(currentTime, 'Europe/Istanbul')}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Timezone Değiştir</label>
            
            {/* Arama ve Filtre */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
              <input
                type="text"
                placeholder="Timezone ara (örn: Istanbul, Tokyo, New York)..."
                value={timezoneSearch}
                onChange={(e) => setTimezoneSearch(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tüm Bölgeler</option>
                {regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>

            {/* Timezone Dropdown */}
            <div className="flex space-x-2">
              <select
                value={selectedTimezone}
                onChange={(e) => setSelectedTimezone(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                size="1"
              >
                <option value="">Timezone seçin... ({filteredTimezones.length} sonuç)</option>
                {filteredTimezones.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleChangeTimezone}
                disabled={!selectedTimezone || changingTimezone}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 whitespace-nowrap"
              >
                {changingTimezone ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Değiştiriliyor...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Uygula</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sistem Güncellemeleri */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-900 dark:text-white">
          <Download className="h-5 w-5 mr-2 text-gray-600 dark:text-gray-400" />
          Sistem Güncellemeleri
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-start space-x-4">
            <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Sistem güncellemeleri önemlidir ancak işlem sırasında servisler etkilenebilir.
                Güncelleme öncesi yedek almanız önerilir.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleUpdate}
              disabled={updating}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {updating ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Güncelleniyor...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5" />
                  <span>Paket Listesini Güncelle (apt update)</span>
                </>
              )}
            </button>

            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {upgrading ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Yükseltiliyor...</span>
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  <span>Paketleri Yükselt (apt upgrade)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sistem Yeniden Başlatma */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-900 dark:text-white">
          <Power className="h-5 w-5 mr-2 text-red-600 dark:text-red-400" />
          Sistem Yönetimi
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-start space-x-4">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                ⚠️ <strong>UYARI:</strong> Sistem yeniden başlatıldığında tüm bağlantılar kopacak
                ve servisler geçici olarak kullanılamaz hale gelecektir.
              </p>
            </div>
          </div>

          <button
            onClick={handleReboot}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
          >
            <Power className="h-5 w-5" />
            <span>Sistemi Yeniden Başlat</span>
          </button>
        </div>
      </div>
    </div>
  )
}
