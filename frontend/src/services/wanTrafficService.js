/**
 * WAN Traffic Service
 * MikroTik WAN interface trafik istatistikleri
 */
import api from './api'

const wanTrafficService = {
  /**
   * WAN interface trafik bilgilerini getirir
   * @returns {Promise} WAN traffic data
   */
  async getWANTraffic() {
    try {
      const response = await api.get('/mikrotik/wan-traffic')
      return response.data
    } catch (error) {
      console.error('WAN trafik bilgisi alınamadı:', error)
      throw error
    }
  }
}

export default wanTrafficService
