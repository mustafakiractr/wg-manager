/**
 * Trafik geçmişi servisi
 * Trafik verilerini API'den çeker
 */
import api from './api'

/**
 * Saatlik trafik verilerini getirir
 * @param {string} startDate - Başlangıç tarihi (YYYY-MM-DD)
 * @param {string} endDate - Bitiş tarihi (YYYY-MM-DD)
 * @param {number} limit - Maksimum kayıt sayısı (default: 100)
 * @param {number} offset - Atlanacak kayıt sayısı (default: 0)
 */
export const getHourlyTraffic = async (startDate, endDate, limit = 100, offset = 0) => {
  let url = '/traffic/hourly'
  const params = []
  if (startDate) params.push(`start_date=${startDate}`)
  if (endDate) params.push(`end_date=${endDate}`)
  params.push(`limit=${limit}`)
  params.push(`offset=${offset}`)
  if (params.length > 0) url += `?${params.join('&')}`
  const response = await api.get(url)
  return response.data
}

/**
 * Günlük trafik verilerini getirir
 * @param {string} startDate - Başlangıç tarihi (YYYY-MM-DD)
 * @param {string} endDate - Bitiş tarihi (YYYY-MM-DD)
 * @param {number} limit - Maksimum kayıt sayısı (default: 100)
 * @param {number} offset - Atlanacak kayıt sayısı (default: 0)
 */
export const getDailyTraffic = async (startDate, endDate, limit = 100, offset = 0) => {
  let url = '/traffic/daily'
  const params = []
  if (startDate) params.push(`start_date=${startDate}`)
  if (endDate) params.push(`end_date=${endDate}`)
  params.push(`limit=${limit}`)
  params.push(`offset=${offset}`)
  if (params.length > 0) url += `?${params.join('&')}`
  const response = await api.get(url)
  return response.data
}

/**
 * Aylık trafik verilerini getirir
 * @param {string} startDate - Başlangıç tarihi (YYYY-MM-DD)
 * @param {string} endDate - Bitiş tarihi (YYYY-MM-DD)
 * @param {number} limit - Maksimum kayıt sayısı (default: 100)
 * @param {number} offset - Atlanacak kayıt sayısı (default: 0)
 */
export const getMonthlyTraffic = async (startDate, endDate, limit = 100, offset = 0) => {
  let url = '/traffic/monthly'
  const params = []
  if (startDate) params.push(`start_date=${startDate}`)
  if (endDate) params.push(`end_date=${endDate}`)
  params.push(`limit=${limit}`)
  params.push(`offset=${offset}`)
  if (params.length > 0) url += `?${params.join('&')}`
  const response = await api.get(url)
  return response.data
}

/**
 * Yıllık trafik verilerini getirir
 * @param {string} startDate - Başlangıç tarihi (YYYY-MM-DD)
 * @param {string} endDate - Bitiş tarihi (YYYY-MM-DD)
 * @param {number} limit - Maksimum kayıt sayısı (default: 100)
 * @param {number} offset - Atlanacak kayıt sayısı (default: 0)
 */
export const getYearlyTraffic = async (startDate, endDate, limit = 100, offset = 0) => {
  let url = '/traffic/yearly'
  const params = []
  if (startDate) params.push(`start_date=${startDate}`)
  if (endDate) params.push(`end_date=${endDate}`)
  params.push(`limit=${limit}`)
  params.push(`offset=${offset}`)
  if (params.length > 0) url += `?${params.join('&')}`
  const response = await api.get(url)
  return response.data
}

/**
 * Trafik kaydı oluşturur
 */
export const recordTraffic = async (periodType) => {
  const response = await api.post(`/traffic/record?period_type=${periodType}`)
  return response.data
}

/**
 * Peer saatlik trafik verilerini getirir
 * @param {string} peerId - Peer ID
 * @param {string} interfaceName - Interface adı
 * @param {string} startDate - Başlangıç tarihi (YYYY-MM-DD)
 * @param {string} endDate - Bitiş tarihi (YYYY-MM-DD)
 * @param {number} limit - Maksimum kayıt sayısı (default: 100)
 * @param {number} offset - Atlanacak kayıt sayısı (default: 0)
 */
export const getPeerHourlyTraffic = async (peerId, interfaceName, startDate, endDate, limit = 100, offset = 0) => {
  const encodedPeerId = encodeURIComponent(peerId)
  const encodedInterface = encodeURIComponent(interfaceName)
  let url = `/traffic/peer/${encodedPeerId}/hourly?interface=${encodedInterface}&limit=${limit}&offset=${offset}`
  if (startDate) url += `&start_date=${startDate}`
  if (endDate) url += `&end_date=${endDate}`
  const response = await api.get(url)
  return response.data
}

/**
 * Peer günlük trafik verilerini getirir
 * @param {string} peerId - Peer ID
 * @param {string} interfaceName - Interface adı
 * @param {string} startDate - Başlangıç tarihi (YYYY-MM-DD)
 * @param {string} endDate - Bitiş tarihi (YYYY-MM-DD)
 * @param {number} limit - Maksimum kayıt sayısı (default: 100)
 * @param {number} offset - Atlanacak kayıt sayısı (default: 0)
 */
export const getPeerDailyTraffic = async (peerId, interfaceName, startDate, endDate, limit = 100, offset = 0) => {
  const encodedPeerId = encodeURIComponent(peerId)
  const encodedInterface = encodeURIComponent(interfaceName)
  let url = `/traffic/peer/${encodedPeerId}/daily?interface=${encodedInterface}&limit=${limit}&offset=${offset}`
  if (startDate) url += `&start_date=${startDate}`
  if (endDate) url += `&end_date=${endDate}`
  const response = await api.get(url)
  return response.data
}

/**
 * Peer aylık trafik verilerini getirir
 * @param {string} peerId - Peer ID
 * @param {string} interfaceName - Interface adı
 * @param {string} startDate - Başlangıç tarihi (YYYY-MM-DD)
 * @param {string} endDate - Bitiş tarihi (YYYY-MM-DD)
 * @param {number} limit - Maksimum kayıt sayısı (default: 100)
 * @param {number} offset - Atlanacak kayıt sayısı (default: 0)
 */
export const getPeerMonthlyTraffic = async (peerId, interfaceName, startDate, endDate, limit = 100, offset = 0) => {
  const encodedPeerId = encodeURIComponent(peerId)
  const encodedInterface = encodeURIComponent(interfaceName)
  let url = `/traffic/peer/${encodedPeerId}/monthly?interface=${encodedInterface}&limit=${limit}&offset=${offset}`
  if (startDate) url += `&start_date=${startDate}`
  if (endDate) url += `&end_date=${endDate}`
  const response = await api.get(url)
  return response.data
}

/**
 * Peer yıllık trafik verilerini getirir
 * @param {string} peerId - Peer ID
 * @param {string} interfaceName - Interface adı
 * @param {string} startDate - Başlangıç tarihi (YYYY-MM-DD)
 * @param {string} endDate - Bitiş tarihi (YYYY-MM-DD)
 * @param {number} limit - Maksimum kayıt sayısı (default: 100)
 * @param {number} offset - Atlanacak kayıt sayısı (default: 0)
 */
export const getPeerYearlyTraffic = async (peerId, interfaceName, startDate, endDate, limit = 100, offset = 0) => {
  const encodedPeerId = encodeURIComponent(peerId)
  const encodedInterface = encodeURIComponent(interfaceName)
  let url = `/traffic/peer/${encodedPeerId}/yearly?interface=${encodedInterface}&limit=${limit}&offset=${offset}`
  if (startDate) url += `&start_date=${startDate}`
  if (endDate) url += `&end_date=${endDate}`
  const response = await api.get(url)
  return response.data
}

