/**
 * IP Pool API servis fonksiyonları
 * IP havuzu yönetimi ve IP tahsisi için API çağrıları
 */
import api from './api'

// ==================== IP Pool Management ====================

/**
 * Tüm IP havuzlarını getirir
 * @param {string} interfaceName - Interface'e göre filtrele (opsiyonel)
 * @param {boolean} isActive - Aktiflik durumuna göre filtrele (opsiyonel)
 */
export const getIPPools = async (interfaceName = null, isActive = null) => {
  const params = {}
  if (interfaceName) params.interface_name = interfaceName
  if (isActive !== null) params.is_active = isActive

  const response = await api.get('/ip-pools', { params })
  return response.data
}

/**
 * Belirli bir IP havuzunu getirir
 * @param {number} poolId - Pool ID
 */
export const getIPPool = async (poolId) => {
  const response = await api.get(`/ip-pools/${poolId}`)
  return response.data
}

/**
 * IP havuzu istatistiklerini getirir
 * @param {number} poolId - Pool ID
 */
export const getIPPoolStats = async (poolId) => {
  const response = await api.get(`/ip-pools/${poolId}/stats`)
  return response.data
}

/**
 * Yeni IP havuzu oluşturur
 * @param {Object} poolData - Havuz bilgileri
 * @param {string} poolData.name - Havuz adı
 * @param {string} poolData.interface_name - Interface adı
 * @param {string} poolData.subnet - Alt ağ (örn: 10.0.0.0/24)
 * @param {string} poolData.start_ip - Başlangıç IP
 * @param {string} poolData.end_ip - Bitiş IP
 * @param {string} poolData.gateway - Gateway IP (opsiyonel)
 * @param {string} poolData.dns_servers - DNS sunucuları (opsiyonel)
 * @param {string} poolData.description - Açıklama (opsiyonel)
 * @param {boolean} poolData.is_active - Havuz aktif mi? (varsayılan: true)
 */
export const createIPPool = async (poolData) => {
  const response = await api.post('/ip-pools', poolData)
  return response.data
}

/**
 * IP havuzunu günceller
 * @param {number} poolId - Pool ID
 * @param {Object} poolData - Güncellenecek alanlar
 */
export const updateIPPool = async (poolId, poolData) => {
  const response = await api.put(`/ip-pools/${poolId}`, poolData)
  return response.data
}

/**
 * IP havuzunu siler (tüm tahsisler de silinir)
 * @param {number} poolId - Pool ID
 */
export const deleteIPPool = async (poolId) => {
  const response = await api.delete(`/ip-pools/${poolId}`)
  return response.data
}

// ==================== IP Allocation ====================

/**
 * IP tahsis eder (manuel veya otomatik)
 * @param {number} poolId - Pool ID
 * @param {Object} allocationData - Tahsis bilgileri
 * @param {string} allocationData.peer_id - Peer ID (opsiyonel)
 * @param {string} allocationData.peer_public_key - Peer public key (opsiyonel)
 * @param {string} allocationData.peer_name - Peer adı (opsiyonel)
 * @param {string} allocationData.ip_address - Manuel IP (boş ise otomatik)
 * @param {string} allocationData.notes - Notlar (opsiyonel)
 */
export const allocateIP = async (poolId, allocationData) => {
  const response = await api.post(`/ip-pools/${poolId}/allocate`, allocationData)
  return response.data
}

/**
 * IP tahsislerini listeler
 * @param {number} poolId - Pool ID'ye göre filtrele (opsiyonel)
 * @param {string} status - Duruma göre filtrele (allocated, released, reserved)
 * @param {string} peerId - Peer ID'ye göre filtrele (opsiyonel)
 */
export const getIPAllocations = async (poolId = null, status = null, peerId = null) => {
  const params = {}
  if (poolId) params.pool_id = poolId
  if (status) params.status = status
  if (peerId) params.peer_id = peerId

  const response = await api.get('/ip-pools/allocations', { params })
  return response.data
}

/**
 * Peer ID'ye göre aktif IP tahsisini getirir
 * @param {string} peerId - Peer ID
 */
export const getIPAllocationByPeer = async (peerId) => {
  const response = await api.get(`/ip-pools/allocations/peer/${peerId}`)
  return response.data
}

/**
 * IP tahsisini serbest bırakır
 * @param {number} allocationId - Allocation ID
 */
export const releaseIP = async (allocationId) => {
  const response = await api.delete(`/ip-pools/allocations/${allocationId}`)
  return response.data
}

// ==================== Helper Functions ====================

/**
 * IP havuzu kullanım yüzdesini hesaplar
 * @param {Object} stats - Pool stats objesi
 * @returns {number} Kullanım yüzdesi (0-100)
 */
export const calculateUsagePercent = (stats) => {
  if (!stats || !stats.total_ips || stats.total_ips === 0) return 0
  return Math.round((stats.allocated / stats.total_ips) * 100)
}

/**
 * IP formatını doğrular
 * @param {string} ip - IP adresi
 * @returns {boolean} Geçerli ise true
 */
export const isValidIP = (ip) => {
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  return ipRegex.test(ip)
}

/**
 * Subnet formatını doğrular (CIDR notation)
 * @param {string} subnet - Subnet (örn: 10.0.0.0/24)
 * @returns {boolean} Geçerli ise true
 */
export const isValidSubnet = (subnet) => {
  const subnetRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:[0-9]|[1-2][0-9]|3[0-2])$/
  return subnetRegex.test(subnet)
}

/**
 * IP adresini sayıya çevirir (karşılaştırma için)
 * @param {string} ip - IP adresi
 * @returns {number} IP'nin sayısal değeri
 */
export const ipToNumber = (ip) => {
  const parts = ip.split('.')
  return (parseInt(parts[0]) << 24) + (parseInt(parts[1]) << 16) +
         (parseInt(parts[2]) << 8) + parseInt(parts[3])
}

/**
 * İki IP arasındaki farkı hesaplar
 * @param {string} startIp - Başlangıç IP
 * @param {string} endIp - Bitiş IP
 * @returns {number} IP sayısı
 */
export const calculateIPCount = (startIp, endIp) => {
  return ipToNumber(endIp) - ipToNumber(startIp) + 1
}

/**
 * DNS sunucularını array'e çevirir
 * @param {string} dnsString - Virgülle ayrılmış DNS string'i
 * @returns {Array} DNS array'i
 */
export const parseDNSServers = (dnsString) => {
  if (!dnsString) return []
  return dnsString.split(',').map(dns => dns.trim()).filter(dns => dns.length > 0)
}

/**
 * DNS array'ini string'e çevirir
 * @param {Array} dnsArray - DNS array'i
 * @returns {string} Virgülle ayrılmış DNS string'i
 */
export const stringifyDNSServers = (dnsArray) => {
  if (!Array.isArray(dnsArray)) return ''
  return dnsArray.filter(dns => dns && dns.trim().length > 0).join(', ')
}
