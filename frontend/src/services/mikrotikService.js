/**
 * MikroTik API servis fonksiyonları
 * Bağlantı testi ve durum kontrolü için API çağrıları
 */
import api from './api'

/**
 * MikroTik router bağlantısını test eder
 * @returns {Promise<Object>} Bağlantı test sonucu
 */
export const testConnection = async () => {
  const response = await api.get('/mikrotik/test')
  return response.data
}

/**
 * MikroTik bağlantı durumunu getirir
 * @returns {Promise<Object>} Bağlantı durumu bilgisi
 */
export const getConnectionStatus = async () => {
  const response = await api.get('/mikrotik/status')
  return response.data
}

/**
 * MikroTik bağlantı yapılandırmasını günceller
 * @param {Object} config - Güncellenecek yapılandırma bilgileri
 * @returns {Promise<Object>} Güncellenmiş yapılandırma bilgisi
 */
export const updateConnectionConfig = async (config) => {
  const response = await api.post('/mikrotik/config', config)
  return response.data
}

