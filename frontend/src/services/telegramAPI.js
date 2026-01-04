/**
 * Telegram Notification Logs API Client
 * Telegram bildirim geçmişi için API istekleri
 */
import api from './api'

/**
 * Telegram bildirim loglarını getirir (pagination ve filtreleme ile)
 * @param {Object} params - Filtre parametreleri
 * @param {string} params.category - Kategori filtresi (peer_down, backup_failed, vb.)
 * @param {string} params.status - Durum filtresi (sent/failed)
 * @param {boolean} params.success - Başarı durumu filtresi
 * @param {string} params.start_date - Başlangıç tarihi (ISO format)
 * @param {string} params.end_date - Bitiş tarihi (ISO format)
 * @param {number} params.limit - Sayfa başına kayıt (default: 50)
 * @param {number} params.offset - Atlanacak kayıt sayısı (default: 0)
 * @returns {Promise} API yanıtı
 */
export const getTelegramLogs = async (params = {}) => {
  try {
    const response = await api.get('/telegram-logs', { params })
    return response.data
  } catch (error) {
    console.error('Telegram logs alınırken hata:', error)
    throw error
  }
}

/**
 * Telegram bildirim istatistiklerini getirir
 * @returns {Promise} İstatistikler (total, successful, failed, success_rate, by_category, recent_24h)
 */
export const getTelegramStats = async () => {
  try {
    const response = await api.get('/telegram-logs/stats')
    return response.data
  } catch (error) {
    console.error('Telegram istatistikleri alınırken hata:', error)
    throw error
  }
}

/**
 * Başarısız Telegram bildirimini yeniden gönderir
 * @param {number} logId - Log ID
 * @returns {Promise} Sonuç
 */
export const resendTelegramNotification = async (logId) => {
  try {
    const response = await api.post(`/telegram-logs/${logId}/resend`)
    return response.data
  } catch (error) {
    console.error('Telegram bildirimi yeniden gönderilirken hata:', error)
    throw error
  }
}

/**
 * Benzersiz kategori listesini getirir
 * @returns {Promise} Kategori listesi
 */
export const getTelegramCategories = async () => {
  try {
    const response = await api.get('/telegram-logs/categories')
    return response.data
  } catch (error) {
    console.error('Telegram kategorileri alınırken hata:', error)
    throw error
  }
}
