/**
 * IP Pool Yönetimi sayfası
 * IP havuzları oluşturma, düzenleme, silme ve IP tahsisi
 */
import { useState, useEffect } from 'react'
import {
  getIPPools,
  getIPPoolStats,
  createIPPool,
  updateIPPool,
  deleteIPPool,
  allocateIP,
  getIPAllocations,
  releaseIP,
  isValidIP,
  isValidSubnet,
  calculateIPCount,
} from '../services/ipPoolService'
import { getInterfaces } from '../services/wireguardService'
import {
  Network,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  X,
  Database,
  Activity,
  AlertCircle,
  CheckCircle,
  Server,
} from 'lucide-react'

function IPPoolManagement() {
  const [pools, setPools] = useState([])
  const [interfaces, setInterfaces] = useState([])
  const [allocations, setAllocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAllocationsModal, setShowAllocationsModal] = useState(false)
  const [selectedPool, setSelectedPool] = useState(null)
  const [poolStats, setPoolStats] = useState({})

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    interface_name: '',
    subnet: '',
    start_ip: '',
    end_ip: '',
    gateway: '',
    dns_servers: '',
    description: '',
    is_active: true,
  })

  // İlk yükleme
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadPools(),
        loadInterfaces(),
      ])
    } catch (error) {
      console.error('Veri yüklenemedi:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPools = async () => {
    try {
      const response = await getIPPools()
      setPools(response || [])

      // Her havuz için istatistikleri paralel olarak yükle
      const statsPromises = (response || []).map(async (pool) => {
        try {
          const statResponse = await getIPPoolStats(pool.id)
          return { id: pool.id, stats: statResponse.success ? statResponse.data : null }
        } catch (error) {
          console.error(`Pool ${pool.id} istatistikleri yüklenemedi:`, error)
          return { id: pool.id, stats: null }
        }
      })

      const statsResults = await Promise.all(statsPromises)
      const stats = {}
      statsResults.forEach(({ id, stats: poolStats }) => {
        if (poolStats) stats[id] = poolStats
      })
      setPoolStats(stats)
    } catch (error) {
      console.error('IP havuzları yüklenemedi:', error)
      alert('IP havuzları yüklenemedi: ' + (error.response?.data?.detail || error.message))
    }
  }

  const loadInterfaces = async () => {
    try {
      const response = await getInterfaces()
      if (response.success) {
        setInterfaces(response.data || [])
      }
    } catch (error) {
      console.error('Interface listesi yüklenemedi:', error)
    }
  }

  const loadAllocations = async (poolId) => {
    try {
      const response = await getIPAllocations(poolId, 'allocated')
      setAllocations(response || [])
    } catch (error) {
      console.error('IP tahsisleri yüklenemedi:', error)
      const errorMsg = error.response?.data?.detail
        || (typeof error.message === 'string' ? error.message : JSON.stringify(error.message))
        || 'Bilinmeyen hata'
      alert('IP tahsisleri yüklenemedi: ' + errorMsg)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      interface_name: '',
      subnet: '',
      start_ip: '',
      end_ip: '',
      gateway: '',
      dns_servers: '',
      description: '',
      is_active: true,
    })
  }

  const handleCreatePool = async (e) => {
    e.preventDefault()

    // Validasyon
    if (!formData.name || !formData.interface_name || !formData.subnet || !formData.start_ip || !formData.end_ip) {
      alert('Lütfen tüm zorunlu alanları doldurun')
      return
    }

    if (!isValidSubnet(formData.subnet)) {
      alert('Geçersiz subnet formatı (örn: 10.0.0.0/24)')
      return
    }

    if (!isValidIP(formData.start_ip) || !isValidIP(formData.end_ip)) {
      alert('Geçersiz IP adresi')
      return
    }

    if (formData.gateway && !isValidIP(formData.gateway)) {
      alert('Geçersiz gateway IP adresi')
      return
    }

    try {
      await createIPPool(formData)
      alert('IP havuzu başarıyla oluşturuldu')
      setShowCreateModal(false)
      resetForm()
      loadPools()
    } catch (error) {
      console.error('IP havuzu oluşturulamadı:', error)
      alert('IP havuzu oluşturulamadı: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleUpdatePool = async (e) => {
    e.preventDefault()

    if (!selectedPool) return

    try {
      await updateIPPool(selectedPool.id, formData)
      alert('IP havuzu başarıyla güncellendi')
      setShowEditModal(false)
      setSelectedPool(null)
      resetForm()
      loadPools()
    } catch (error) {
      console.error('IP havuzu güncellenemedi:', error)
      alert('IP havuzu güncellenemedi: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleDeletePool = async (pool) => {
    if (!confirm(`'${pool.name}' havuzunu silmek istediğinizden emin misiniz? Tüm IP tahsisleri de silinecektir.`)) {
      return
    }

    try {
      await deleteIPPool(pool.id)
      alert('IP havuzu başarıyla silindi')
      loadPools()
    } catch (error) {
      console.error('IP havuzu silinemedi:', error)
      alert('IP havuzu silinemedi: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleReleaseIP = async (allocationId) => {
    if (!confirm('Bu IP tahsisini serbest bırakmak istediğinizden emin misiniz?')) {
      return
    }

    try {
      await releaseIP(allocationId)
      alert('IP başarıyla serbest bırakıldı')
      loadAllocations(selectedPool.id)
      loadPools() // İstatistikleri güncelle
    } catch (error) {
      console.error('IP serbest bırakılamadı:', error)
      alert('IP serbest bırakılamadı: ' + (error.response?.data?.detail || error.message))
    }
  }

  const openEditModal = (pool) => {
    setSelectedPool(pool)
    setFormData({
      name: pool.name,
      interface_name: pool.interface_name,
      subnet: pool.subnet,
      start_ip: pool.start_ip,
      end_ip: pool.end_ip,
      gateway: pool.gateway || '',
      dns_servers: pool.dns_servers || '',
      description: pool.description || '',
      is_active: pool.is_active,
    })
    setShowEditModal(true)
  }

  const openAllocationsModal = async (pool) => {
    setSelectedPool(pool)
    await loadAllocations(pool.id)
    setShowAllocationsModal(true)
  }

  const getUsageColor = (percent) => {
    if (percent >= 90) return 'text-red-600 dark:text-red-400'
    if (percent >= 70) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-green-600 dark:text-green-400'
  }

  const calculateTotalIPs = () => {
    if (!formData.start_ip || !formData.end_ip) return 0
    try {
      return calculateIPCount(formData.start_ip, formData.end_ip)
    } catch {
      return 0
    }
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            IP Pool Yönetimi
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            IP havuzları oluşturun ve otomatik IP tahsisi yapın
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="btn btn-secondary flex items-center gap-1.5 sm:gap-2 text-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Yenile</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center gap-1.5 sm:gap-2 text-sm"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Yeni Havuz</span>
          </button>
        </div>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="card p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Toplam Havuz</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-0.5 sm:mt-1">
                {pools.length}
              </p>
            </div>
            <Database className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="card p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Aktif Havuz</p>
              <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400 mt-0.5 sm:mt-1">
                {pools.filter(p => p.is_active).length}
              </p>
            </div>
            <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <div className="card p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Toplam IP</p>
              <p className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400 mt-0.5 sm:mt-1">
                {Object.values(poolStats).reduce((sum, stat) => sum + (stat.total_ips || 0), 0)}
              </p>
            </div>
            <Server className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
      </div>

      {/* Havuz Listesi */}
      {loading && pools.length === 0 ? (
        <div className="card text-center py-8 sm:py-12">
          <RefreshCw className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 mx-auto mb-3 sm:mb-4 animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Yükleniyor...</p>
        </div>
      ) : pools.length === 0 ? (
        <div className="card text-center py-8 sm:py-12">
          <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
            Henüz IP havuzu oluşturulmamış
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary mx-auto text-sm"
          >
            İlk Havuzu Oluştur
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
          {pools.map((pool) => {
            const stats = poolStats[pool.id] || {}
            const usagePercent = stats.usage_percent || 0

            return (
              <div key={pool.id} className="card p-3 sm:p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`p-1.5 sm:p-2 rounded-lg ${
                      pool.is_active
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : 'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      <Network className={`w-4 h-4 sm:w-5 sm:h-5 ${
                        pool.is_active
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                        {pool.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {pool.interface_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 sm:gap-1">
                    <button
                      onClick={() => openEditModal(pool)}
                      className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      title="Düzenle"
                    >
                      <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDeletePool(pool)}
                      className="p-1.5 sm:p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      title="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Bilgiler */}
                <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Subnet:</span>
                    <span className="text-gray-900 dark:text-white font-medium truncate ml-2">{pool.subnet}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-600 dark:text-gray-400 flex-shrink-0">IP Aralığı:</span>
                    <span className="text-gray-900 dark:text-white font-medium truncate ml-2 text-right">
                      {pool.start_ip} - {pool.end_ip}
                    </span>
                  </div>
                  {pool.gateway && (
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Gateway:</span>
                      <span className="text-gray-900 dark:text-white font-medium truncate ml-2">{pool.gateway}</span>
                    </div>
                  )}
                  {pool.dns_servers && (
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-600 dark:text-gray-400">DNS:</span>
                      <span className="text-gray-900 dark:text-white font-medium truncate ml-2">{pool.dns_servers}</span>
                    </div>
                  )}
                </div>

                {/* İstatistikler */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                      Kullanım
                    </span>
                    <span className={`text-xs sm:text-sm font-bold ${getUsageColor(usagePercent)}`}>
                      {usagePercent}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 sm:h-2 mb-1.5 sm:mb-2">
                    <div
                      className={`h-1.5 sm:h-2 rounded-full transition-all ${
                        usagePercent >= 90 ? 'bg-red-600' :
                        usagePercent >= 70 ? 'bg-yellow-600' : 'bg-green-600'
                      }`}
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                    <span>{stats.allocated || 0} / {stats.total_ips || 0} IP</span>
                    <span>{stats.available || 0} Boş</span>
                  </div>
                </div>

                {/* Butonlar */}
                <div className="flex gap-2">
                  <button
                    onClick={() => openAllocationsModal(pool)}
                    className="btn btn-secondary flex-1 text-xs sm:text-sm py-1.5 sm:py-2"
                  >
                    <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                    <span className="hidden sm:inline">Tahsisleri Gör</span>
                    <span className="sm:hidden">Tahsisler</span>
                  </button>
                </div>

                {pool.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200 dark:border-gray-700 line-clamp-2">
                    {pool.description}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay items-start sm:items-center p-2 sm:p-4">
          <div className="modal-content max-w-2xl my-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">
                Yeni IP Havuzu Oluştur
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  resetForm()
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePool} className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                    Havuz Adı *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input text-sm"
                    required
                    placeholder="Ana VPN Havuzu"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                    Interface *
                  </label>
                  <select
                    value={formData.interface_name}
                    onChange={(e) => setFormData({ ...formData, interface_name: e.target.value })}
                    className="input text-sm"
                    required
                  >
                    <option value="">Interface Seçin</option>
                    {interfaces.map((iface) => (
                      <option key={iface['.id']} value={iface.name || iface['.id']}>
                        {iface.name || iface['.id']}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                    Subnet (CIDR) *
                  </label>
                  <input
                    type="text"
                    value={formData.subnet}
                    onChange={(e) => setFormData({ ...formData, subnet: e.target.value })}
                    className="input text-sm"
                    required
                    placeholder="10.0.0.0/24"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                    Gateway
                  </label>
                  <input
                    type="text"
                    value={formData.gateway}
                    onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
                    className="input text-sm"
                    placeholder="10.0.0.1"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                    Başlangıç IP *
                  </label>
                  <input
                    type="text"
                    value={formData.start_ip}
                    onChange={(e) => setFormData({ ...formData, start_ip: e.target.value })}
                    className="input text-sm"
                    required
                    placeholder="10.0.0.10"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                    Bitiş IP *
                  </label>
                  <input
                    type="text"
                    value={formData.end_ip}
                    onChange={(e) => setFormData({ ...formData, end_ip: e.target.value })}
                    className="input text-sm"
                    required
                    placeholder="10.0.0.250"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                    DNS Sunucuları (virgülle ayırın)
                  </label>
                  <input
                    type="text"
                    value={formData.dns_servers}
                    onChange={(e) => setFormData({ ...formData, dns_servers: e.target.value })}
                    className="input text-sm"
                    placeholder="8.8.8.8, 8.8.4.4"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                    Açıklama
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input text-sm"
                    rows="2"
                    placeholder="Havuz hakkında notlar..."
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                      Havuzu aktif olarak oluştur
                    </span>
                  </label>
                </div>
              </div>

              {formData.start_ip && formData.end_ip && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2 sm:p-3">
                  <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-300">
                    <strong>Toplam IP Sayısı:</strong> {calculateTotalIPs()}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    resetForm()
                  }}
                  className="btn btn-secondary flex-1 text-sm"
                >
                  İptal
                </button>
                <button type="submit" className="btn btn-primary flex-1 text-sm">
                  Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedPool && (
        <div className="modal-overlay items-start sm:items-center p-2 sm:p-4">
          <div className="modal-content max-w-2xl my-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">
                IP Havuzunu Düzenle
              </h2>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedPool(null)
                  resetForm()
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdatePool} className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                    Havuz Adı
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                    Gateway
                  </label>
                  <input
                    type="text"
                    value={formData.gateway}
                    onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
                    className="input text-sm"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                    DNS Sunucuları
                  </label>
                  <input
                    type="text"
                    value={formData.dns_servers}
                    onChange={(e) => setFormData({ ...formData, dns_servers: e.target.value })}
                    className="input text-sm"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                    Açıklama
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input text-sm"
                    rows="2"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                      Havuz aktif
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedPool(null)
                    resetForm()
                  }}
                  className="btn btn-secondary flex-1 text-sm"
                >
                  İptal
                </button>
                <button type="submit" className="btn btn-primary flex-1 text-sm">
                  Güncelle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allocations Modal */}
      {showAllocationsModal && selectedPool && (
        <div className="modal-overlay items-start sm:items-center p-2 sm:p-4">
          <div className="modal-content max-w-4xl my-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div>
                <h2 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">
                  IP Tahsisleri - <span className="truncate inline-block max-w-[150px] sm:max-w-none align-bottom">{selectedPool.name}</span>
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">
                  {allocations.length} tahsis bulundu
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAllocationsModal(false)
                  setSelectedPool(null)
                  setAllocations([])
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="overflow-x-auto max-h-64 sm:max-h-96">
              <table className="w-full min-w-[400px]">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                  <tr>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                      IP Adresi
                    </th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                      Peer
                    </th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:table-cell">
                      Tahsis Tarihi
                    </th>
                    <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                      İşlem
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center py-6 sm:py-8 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        Henüz IP tahsisi yapılmamış
                      </td>
                    </tr>
                  ) : (
                    allocations.map((allocation) => (
                      <tr key={allocation.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 sm:py-3 px-2 sm:px-4">
                          <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            {allocation.ip_address}
                          </span>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4">
                          <div>
                            <span className="text-xs sm:text-sm text-gray-900 dark:text-white truncate block max-w-[100px] sm:max-w-none">
                              {allocation.peer_name || allocation.peer_id || '-'}
                            </span>
                            {allocation.peer_public_key && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono truncate max-w-[80px] sm:max-w-none">
                                {allocation.peer_public_key.substring(0, 16)}...
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 hidden sm:table-cell">
                          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                            {new Date(allocation.allocated_at).toLocaleString('tr-TR')}
                          </span>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-right">
                          <button
                            onClick={() => handleReleaseIP(allocation.id)}
                            className="btn btn-secondary text-xs px-2 py-1 text-red-600 dark:text-red-400"
                          >
                            <span className="hidden sm:inline">Serbest Bırak</span>
                            <span className="sm:hidden">Serbest</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700 mt-3 sm:mt-4">
              <button
                onClick={() => {
                  setShowAllocationsModal(false)
                  setSelectedPool(null)
                  setAllocations([])
                }}
                className="btn btn-secondary text-sm"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default IPPoolManagement
