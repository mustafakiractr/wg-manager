/**
 * Peer Template Service
 * Peer şablon API işlemleri
 */
import api from './api'

/**
 * Tüm peer şablonlarını getirir
 * @param {boolean} isActive - Aktif/pasif filtrele (opsiyonel)
 * @returns {Promise<Array>} Peer şablon listesi
 */
export const getAllTemplates = async (isActive = null) => {
  const params = {}
  if (isActive !== null) params.is_active = isActive

  const response = await api.get('/peer-templates', { params })
  return response.data
}

/**
 * Belirli bir peer şablonunu getirir
 * @param {number} templateId - Şablon ID
 * @returns {Promise<Object>} Peer şablon
 */
export const getTemplate = async (templateId) => {
  const response = await api.get(`/peer-templates/${templateId}`)
  return response.data
}

/**
 * Yeni peer şablonu oluşturur
 * @param {Object} data - Şablon verisi
 * @returns {Promise<Object>} Oluşturulan şablon
 */
export const createTemplate = async (data) => {
  const response = await api.post('/peer-templates', data)
  return response.data
}

/**
 * Peer şablonunu günceller
 * @param {number} templateId - Şablon ID
 * @param {Object} data - Güncellenecek veriler
 * @returns {Promise<Object>} Güncellenmiş şablon
 */
export const updateTemplate = async (templateId, data) => {
  const response = await api.put(`/peer-templates/${templateId}`, data)
  return response.data
}

/**
 * Peer şablonunu siler
 * @param {number} templateId - Şablon ID
 * @returns {Promise<Object>} Silme sonucu
 */
export const deleteTemplate = async (templateId) => {
  const response = await api.delete(`/peer-templates/${templateId}`)
  return response.data
}

/**
 * Peer şablonunu aktif/pasif yapar
 * @param {number} templateId - Şablon ID
 * @returns {Promise<Object>} Güncelleme sonucu
 */
export const toggleTemplateActive = async (templateId) => {
  const response = await api.post(`/peer-templates/${templateId}/toggle`)
  return response.data
}

/**
 * Şablondan oluşturulacak peer verilerini önizler
 * @param {number} templateId - Şablon ID
 * @returns {Promise<Object>} Önizleme verisi
 */
export const previewTemplate = async (templateId) => {
  const response = await api.get(`/peer-templates/${templateId}/preview`)
  return response.data
}
