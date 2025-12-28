/**
 * Log API servis fonksiyonları
 * Sistem log kayıtlarını getirmek için API çağrıları
 */
import api from './api'

/**
 * Log kayıtlarını getirir
 * @param {Object} params - Query parametreleri (limit, offset, username)
 */
export const getLogs = async (params = {}) => {
  const response = await api.get('/logs', { params })
  return response.data
}


