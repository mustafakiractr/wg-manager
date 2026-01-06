/**
 * WireGuard API servis fonksiyonları
 * Interface ve peer yönetimi için API çağrıları
 */
import api from './api'

/**
 * Tüm WireGuard interface'lerini getirir
 */
export const getInterfaces = async () => {
  const response = await api.get('/wg/interfaces')
  return response.data
}

/**
 * Belirli bir interface'in detaylarını getirir
 * @param {string} name - Interface adı
 */
export const getInterface = async (name) => {
  const response = await api.get(`/wg/interface/${name}`)
  return response.data
}

/**
 * Interface'i aç/kapat
 * @param {string} name - Interface adı
 * @param {boolean} enable - True ise aç, False ise kapat
 */
export const toggleInterface = async (name, enable) => {
  const response = await api.post(`/wg/interface/${name}/toggle?enable=${enable}`)
  return response.data
}

/**
 * Yeni WireGuard interface ekler
 * @param {Object} interfaceData - Interface bilgileri {name, listen_port, mtu, private_key, comment}
 */
export const addInterface = async (interfaceData) => {
  const response = await api.post('/wg/interface/add', interfaceData)
  return response.data
}

/**
 * WireGuard interface'i günceller
 * @param {string} name - Interface adı
 * @param {Object} interfaceData - Güncellenecek bilgiler {listen_port, mtu, comment}
 */
export const updateInterface = async (name, interfaceData) => {
  const response = await api.post(`/wg/interface/${name}/update`, interfaceData)
  return response.data
}

/**
 * WireGuard interface'i siler
 * @param {string} name - Interface adı
 */
export const deleteInterface = async (name) => {
  const response = await api.delete(`/wg/interface/${name}`)
  return response.data
}

/**
 * Belirli bir interface'e ait peer'ları getirir
 * @param {string} interfaceName - Interface adı
 */
export const getPeers = async (interfaceName) => {
  const response = await api.get(`/wg/peers/${interfaceName}`)
  return response.data
}

/**
 * Yeni peer ekler
 * @param {Object} peerData - Peer bilgileri
 */
export const addPeer = async (peerData) => {
  const response = await api.post('/wg/peer/add', peerData)
  return response.data
}

/**
 * Peer'ı günceller
 * @param {string} peerId - Peer ID
 * @param {Object} peerData - Güncellenecek bilgiler
 */
export const updatePeer = async (peerId, peerData) => {
  const response = await api.post(`/wg/peer/${peerId}/update`, peerData)
  return response.data
}

/**
 * Peer'ı aktif/pasif yapar
 * @param {string} peerId - Peer ID
 * @param {string} interfaceName - Interface adı
 * @param {boolean} currentDisabled - Mevcut disabled durumu (true=pasif, false=aktif)
 */
export const togglePeer = async (peerId, interfaceName, currentDisabled) => {
  // LOJİK: currentDisabled true ise peer pasif → aktif et (enable=true)
  //        currentDisabled false ise peer aktif → pasif et (enable=false)
  const enable = currentDisabled  // Doğru lojik: currentDisabled direkt enable olur
  
  console.log('togglePeer API çağrısı:', {
    peerId,
    interfaceName,
    currentDisabled,
    enable,
    url: `/wg/peer/${encodeURIComponent(peerId)}/toggle?interface=${encodeURIComponent(interfaceName)}&enable=${enable}`
  })
  
  const response = await api.post(`/wg/peer/${encodeURIComponent(peerId)}/toggle?interface=${encodeURIComponent(interfaceName)}&enable=${enable}`)
  return response.data
}

/**
 * Peer'ı siler
 * @param {string} peerId - Peer ID
 * @param {string} interfaceName - Interface adı
 */
export const deletePeer = async (peerId, interfaceName) => {
  // Peer ID ve interface adını encode et (URL'de özel karakterler için)
  const encodedPeerId = encodeURIComponent(peerId)
  const encodedInterface = encodeURIComponent(interfaceName)
  const response = await api.delete(`/wg/peer/${encodedPeerId}?interface=${encodedInterface}`)
  return response.data
}

/**
 * Peer için QR kod oluşturur
 * @param {string} peerId - Peer ID
 * @param {string} interfaceName - Interface adı
 */
export const getPeerQRCode = async (peerId, interfaceName) => {
  // Peer ID'yi encode et (URL'de özel karakterler için)
  const encodedPeerId = encodeURIComponent(peerId)
  const encodedInterface = encodeURIComponent(interfaceName)
  const response = await api.get(`/wg/peer/${encodedPeerId}/qrcode?interface=${encodedInterface}`)
  return response.data
}

/**
 * WireGuard özel ve genel anahtar çifti oluşturur
 */
export const generateKeys = async () => {
  const response = await api.get('/wg/generate-keys')
  return response.data
}

/**
 * Peer loglarını getirir (online/offline zamanları)
 * @param {string} peerId - Peer ID
 * @param {string} interfaceName - Interface adı
 * @param {string} startDate - Başlangıç tarihi (YYYY-MM-DD) (opsiyonel)
 * @param {string} endDate - Bitiş tarihi (YYYY-MM-DD) (opsiyonel)
 * @param {number} limit - Maksimum kayıt sayısı (default: 100)
 * @param {number} offset - Atlanacak kayıt sayısı (default: 0)
 */
export const getPeerLogs = async (peerId, interfaceName, startDate, endDate, limit = 100, offset = 0) => {
  const encodedPeerId = encodeURIComponent(peerId)
  const encodedInterface = encodeURIComponent(interfaceName)
  const params = new URLSearchParams()
  params.append('interface', encodedInterface)
  params.append('limit', limit.toString())
  params.append('offset', offset.toString())
  if (startDate) params.append('start_date', startDate)
  if (endDate) params.append('end_date', endDate)
  const response = await api.get(`/wg/peer/${encodedPeerId}/logs?${params.toString()}`)
  return response.data
}


