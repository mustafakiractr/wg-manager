/**
 * Dashboard API servis fonksiyonları
 * Dashboard istatistikleri ve genel bakış için API çağrıları
 */
import api from './api'

/**
 * Dashboard genel istatistiklerini getirir
 * - IP Pool istatistikleri
 * - Peer Template istatistikleri
 * - Kullanıcı istatistikleri
 * - Aktivite sayısı (son 24 saat)
 */
export const getDashboardStats = async () => {
  const response = await api.get('/dashboard/stats')
  return response.data
}

/**
 * Tüm IP Pool'ların kullanım detaylarını getirir
 * Her pool için: isim, toplam IP, tahsis edilmiş IP, kullanılabilir IP, yüzde
 */
export const getIPPoolUsage = async () => {
  const response = await api.get('/dashboard/ip-pool-usage')
  return response.data
}

/**
 * Son aktiviteleri listeler
 * @param {number} limit - Kaç aktivite getirilecek (default: 10)
 */
export const getRecentActivities = async (limit = 10) => {
  const response = await api.get('/dashboard/recent-activities', {
    params: { limit }
  })
  return response.data
}

/**
 * Peer Template kullanım istatistiklerini getirir
 * Her template için: isim, kullanım sayısı, son kullanım tarihi
 */
export const getTemplateStats = async () => {
  const response = await api.get('/dashboard/template-stats')
  return response.data
}
