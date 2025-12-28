/**
 * Session management API servisi
 * Aktif oturumları yönetme işlemleri
 */
import api from './api'

/**
 * Kullanıcının aktif session'larını getirir
 */
export const getSessions = async () => {
  const response = await api.get('/sessions')
  return response.data
}

/**
 * Belirli bir session'ı iptal eder
 * @param {number} sessionId - Session ID
 */
export const revokeSession = async (sessionId) => {
  const response = await api.post('/sessions/revoke', {
    session_id: sessionId
  })
  return response.data
}

/**
 * Tüm session'ları iptal eder (mevcut hariç)
 */
export const revokeAllSessions = async () => {
  const response = await api.post('/sessions/revoke-all')
  return response.data
}

/**
 * Session siler (revoke ile aynı)
 * @param {number} sessionId - Session ID
 */
export const deleteSession = async (sessionId) => {
  const response = await api.delete(`/sessions/${sessionId}`)
  return response.data
}
