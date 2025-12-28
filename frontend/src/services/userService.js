/**
 * Kullanıcı yönetimi servisi
 * Kullanıcı CRUD işlemleri ve şifre değiştirme
 */
import api from './api'

/**
 * Tüm kullanıcıları getirir
 */
export const getUsers = async () => {
  const response = await api.get('/users/')
  return response.data
}

/**
 * Yeni kullanıcı oluşturur
 */
export const createUser = async (userData) => {
  const response = await api.post('/users/', userData)
  return response.data
}

/**
 * Kullanıcı bilgilerini günceller
 */
export const updateUser = async (userId, userData) => {
  const response = await api.put(`/users/${userId}`, userData)
  return response.data
}

/**
 * Kullanıcıyı siler
 */
export const deleteUser = async (userId) => {
  const response = await api.delete(`/users/${userId}`)
  return response.data
}

/**
 * Kullanıcı şifresini değiştirir (kendi şifresi için)
 */
export const changePassword = async (userId, currentPassword, newPassword) => {
  const response = await api.post(`/users/${userId}/change-password`, {
    current_password: currentPassword,
    new_password: newPassword
  })
  return response.data
}

/**
 * Admin tarafından kullanıcı şifresini değiştirir
 */
export const changePasswordByAdmin = async (userId, newPassword) => {
  const response = await api.post(`/users/${userId}/change-password-admin`, {
    new_password: newPassword
  })
  return response.data
}

