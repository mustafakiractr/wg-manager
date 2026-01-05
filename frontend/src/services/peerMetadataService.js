/**
 * Peer Metadata Service
 * Peer metadata API işlemleri
 */
import api from './api'

/**
 * Tüm peer metadata'larını getirir
 * @param {string} interfaceName - Interface'e göre filtrele (opsiyonel)
 * @param {string} groupName - Gruba göre filtrele (opsiyonel)
 * @returns {Promise<Array>} Peer metadata listesi
 */
export const getAllPeerMetadata = async (interfaceName = null, groupName = null) => {
  const params = {}
  if (interfaceName) params.interface_name = interfaceName
  if (groupName) params.group_name = groupName

  const response = await api.get('/peer-metadata', { params })
  return response.data
}

/**
 * Belirli bir peer'ın metadata'sını getirir
 * @param {string} peerId - Peer ID
 * @param {string} interfaceName - Interface adı
 * @returns {Promise<Object>} Peer metadata
 */
export const getPeerMetadata = async (peerId, interfaceName) => {
  const response = await api.get(`/peer-metadata/${peerId}/${interfaceName}`)
  return response.data
}

/**
 * Peer metadata'sını günceller
 * @param {string} peerId - Peer ID
 * @param {string} interfaceName - Interface adı
 * @param {Object} data - Güncellenecek veriler
 * @returns {Promise<Object>} Güncellenmiş metadata
 */
export const updatePeerMetadata = async (peerId, interfaceName, data) => {
  const response = await api.put(`/peer-metadata/${peerId}/${interfaceName}`, data)
  return response.data
}

/**
 * Peer metadata'sını siler
 * @param {string} peerId - Peer ID
 * @param {string} interfaceName - Interface adı
 * @returns {Promise<Object>} Silme sonucu
 */
export const deletePeerMetadata = async (peerId, interfaceName) => {
  const response = await api.delete(`/peer-metadata/${peerId}/${interfaceName}`)
  return response.data
}

/**
 * Tüm peer gruplarını getirir
 * @returns {Promise<Array>} Grup listesi
 */
export const getAllPeerGroups = async () => {
  const response = await api.get('/peer-groups')
  return response.data
}

/**
 * Birden fazla peer'ın grubunu günceller
 * @param {Array} peerIds - [(peer_id, interface_name), ...] tuple listesi
 * @param {string} groupName - Grup adı
 * @param {string} groupColor - Grup rengi (hex code)
 * @returns {Promise<Object>} Güncelleme sonucu
 */
export const bulkUpdatePeerGroup = async (peerIds, groupName, groupColor = null) => {
  const response = await api.post('/peer-metadata/bulk-group', {
    peer_ids: peerIds,
    group_name: groupName,
    group_color: groupColor
  })
  return response.data
}

/**
 * Peer'a not ekler veya günceller
 * @param {string} peerId - Peer ID
 * @param {string} interfaceName - Interface adı
 * @param {string} notes - Notlar
 * @returns {Promise<Object>} Güncellenmiş metadata
 */
export const updatePeerNotes = async (peerId, interfaceName, notes) => {
  return updatePeerMetadata(peerId, interfaceName, { notes })
}

/**
 * Peer'a etiket ekler veya günceller
 * @param {string} peerId - Peer ID
 * @param {string} interfaceName - Interface adı
 * @param {string} tags - Etiketler (virgülle ayrılmış)
 * @returns {Promise<Object>} Güncellenmiş metadata
 */
export const updatePeerTags = async (peerId, interfaceName, tags) => {
  return updatePeerMetadata(peerId, interfaceName, { tags })
}

/**
 * Peer'ın grubunu değiştirir
 * @param {string} peerId - Peer ID
 * @param {string} interfaceName - Interface adı
 * @param {string} groupName - Grup adı
 * @param {string} groupColor - Grup rengi
 * @returns {Promise<Object>} Güncellenmiş metadata
 */
export const updatePeerGroup = async (peerId, interfaceName, groupName, groupColor = null) => {
  return updatePeerMetadata(peerId, interfaceName, {
    group_name: groupName,
    group_color: groupColor
  })
}

// ==================== EXPIRY ENDPOINTS ====================

/**
 * Peer son kullanma tarihi ayarlar veya günceller
 * @param {string} peerId - Peer ID
 * @param {string} interfaceName - Interface adı
 * @param {string} expiresAt - Son kullanma tarihi (ISO format)
 * @param {string} expiryAction - Süre dolduğunda yapılacak işlem: 'disable', 'delete', 'notify_only'
 * @returns {Promise<Object>} Expiry ayar sonucu
 */
export const setPeerExpiry = async (peerId, interfaceName, expiresAt, expiryAction = 'disable') => {
  const response = await api.post('/peer-metadata/expiry', {
    peer_id: peerId,
    interface_name: interfaceName,
    expires_at: expiresAt,
    expiry_action: expiryAction
  })
  return response.data
}

/**
 * Peer son kullanma tarihini kaldırır
 * @param {string} peerId - Peer ID
 * @param {string} interfaceName - Interface adı
 * @returns {Promise<Object>} Silme sonucu
 */
export const removePeerExpiry = async (peerId, interfaceName) => {
  const response = await api.delete(`/peer-metadata/expiry/${peerId}`, {
    params: { interface_name: interfaceName }
  })
  return response.data
}

/**
 * Yakında süresi dolacak peer'ları listeler
 * @param {number} withinDays - Kaç gün içinde süresi dolacaklar (varsayılan: 7)
 * @returns {Promise<Array>} Yakında süresi dolacak peer listesi
 */
export const getExpiringPeers = async (withinDays = 7) => {
  const response = await api.get('/peer-metadata/expiry/expiring-soon', {
    params: { within_days: withinDays }
  })
  return response.data
}

/**
 * Expiry istatistiklerini getirir
 * @returns {Promise<Object>} Expiry istatistikleri
 */
export const getExpiryStats = async () => {
  const response = await api.get('/peer-metadata/expiry/stats')
  return response.data
}
