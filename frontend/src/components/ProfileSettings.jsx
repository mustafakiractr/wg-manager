/**
 * Kullanıcı profil ayarları komponenti
 * Profil bilgilerini görüntüleme ve düzenleme
 */
import { useState, useEffect, useRef } from 'react'
import { User, Mail, Calendar, Shield, Save, X, Edit2, Key, Upload, Trash2, Camera } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import api from '../services/api'
import { PageLoader } from './Loading'

function ProfileSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef(null)
  const toast = useToast()

  // Profil bilgileri
  const [profile, setProfile] = useState({
    id: null,
    username: '',
    email: '',
    is_admin: false,
    avatar_url: null,
    two_factor_enabled: false,
    created_at: null,
    updated_at: null
  })

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    email: ''
  })

  // Şifre değiştirme state
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })

  // Profil bilgilerini yükle
  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const response = await api.get('/users/me')

      if (response.data.success) {
        const data = response.data.data
        setProfile(data)
        setFormData({
          username: data.username || '',
          email: data.email || ''
        })
      }
    } catch (error) {
      console.error('Profil yüklenirken hata:', error)
      toast.error('Profil bilgileri yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  // Form değişikliklerini yakala
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Şifre form değişikliklerini yakala
  const handlePasswordChange = (e) => {
    const { name, value } = e.target
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Profil güncelleme
  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      setSaving(true)
      const response = await api.put('/users/me', formData)

      if (response.data.success) {
        toast.success('Profil başarıyla güncellendi')
        await loadProfile()
        setEditing(false)
      }
    } catch (error) {
      console.error('Profil güncellenirken hata:', error)
      const message = error.response?.data?.detail || 'Profil güncellenemedi'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  // Şifre değiştirme
  const handlePasswordSubmit = async (e) => {
    e.preventDefault()

    // Şifre doğrulama
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('Yeni şifreler eşleşmiyor')
      return
    }

    if (passwordData.new_password.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır')
      return
    }

    try {
      setSaving(true)
      const response = await api.post('/users/me/change-password', {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      })

      if (response.data.success) {
        toast.success('Şifre başarıyla değiştirildi')
        setPasswordData({
          current_password: '',
          new_password: '',
          confirm_password: ''
        })
        setChangingPassword(false)
      }
    } catch (error) {
      console.error('Şifre değiştirilirken hata:', error)
      const message = error.response?.data?.detail || 'Şifre değiştirilemedi'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  // İptal
  const handleCancel = () => {
    setFormData({
      username: profile.username || '',
      email: profile.email || ''
    })
    setEditing(false)
  }

  // Avatar yükleme
  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Dosya tipi kontrolü
    if (!file.type.startsWith('image/')) {
      toast.error('Lütfen bir görsel dosyası seçin')
      return
    }

    // Dosya boyutu kontrolü (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Dosya boyutu 5MB\'dan küçük olmalıdır')
      return
    }

    try {
      setUploadingAvatar(true)

      const formData = new FormData()
      formData.append('file', file)

      const response = await api.post('/avatar/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      if (response.data.success) {
        toast.success('Profil fotoğrafı başarıyla yüklendi')
        await loadProfile()
      }
    } catch (error) {
      console.error('Avatar yükleme hatası:', error)
      const message = error.response?.data?.detail || 'Profil fotoğrafı yüklenemedi'
      toast.error(message)
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeleteAvatar = async () => {
    if (!confirm('Profil fotoğrafınızı silmek istediğinizden emin misiniz?')) {
      return
    }

    try {
      setUploadingAvatar(true)

      const response = await api.delete('/avatar/')

      if (response.data.success) {
        toast.success('Profil fotoğrafı silindi')
        await loadProfile()
      }
    } catch (error) {
      console.error('Avatar silme hatası:', error)
      const message = error.response?.data?.detail || 'Profil fotoğrafı silinemedi'
      toast.error(message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Bilinmiyor'
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getAvatarUrl = () => {
    if (profile.avatar_url) {
      // Backend URL'i tam path olarak döndürüyor
      return profile.avatar_url
    }
    return null
  }

  if (loading) {
    return <PageLoader message="Profil bilgileri yükleniyor..." />
  }

  return (
    <div className="space-y-6">
      {/* Profil Bilgileri */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Profil Bilgileri
          </h2>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="btn-secondary flex items-center space-x-2"
            >
              <Edit2 className="w-4 h-4" />
              <span>Düzenle</span>
            </button>
          )}
        </div>

        {/* Profil Fotoğrafı */}
        <div className="flex items-center space-x-6 mb-8 pb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            {getAvatarUrl() ? (
              <img
                src={getAvatarUrl()}
                alt={profile.username}
                className="w-24 h-24 rounded-full object-cover ring-4 ring-gray-100 dark:ring-gray-700"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center ring-4 ring-gray-100 dark:ring-gray-700">
                <User className="w-12 h-12 text-primary-600 dark:text-primary-400" />
              </div>
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Profil Fotoğrafı
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              JPG, PNG veya GIF. Maksimum 5MB.
            </p>
            <div className="flex space-x-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <button
                onClick={handleAvatarClick}
                disabled={uploadingAvatar}
                className="btn-secondary flex items-center space-x-2 text-sm"
              >
                <Camera className="w-4 h-4" />
                <span>{getAvatarUrl() ? 'Değiştir' : 'Yükle'}</span>
              </button>
              {getAvatarUrl() && (
                <button
                  onClick={handleDeleteAvatar}
                  disabled={uploadingAvatar}
                  className="btn-secondary flex items-center space-x-2 text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Sil</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {editing ? (
          /* Düzenleme Formu */
          <form key="edit-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <User className="w-4 h-4 inline-block mr-2" />
                Kullanıcı Adı
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                className="input"
                placeholder="Kullanıcı adınız"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Mail className="w-4 h-4 inline-block mr-2" />
                E-posta
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="input"
                placeholder="ornek@email.com"
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Kaydediliyor...' : 'Kaydet'}</span>
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="btn-secondary flex items-center space-x-2"
              >
                <X className="w-4 h-4" />
                <span>İptal</span>
              </button>
            </div>
          </form>
        ) : (
          /* Görüntüleme Modu */
          <div key="view-mode" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  <User className="w-4 h-4 inline-block mr-2" />
                  Kullanıcı Adı
                </label>
                <p className="text-gray-900 dark:text-white font-medium">
                  {profile.username}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  <Mail className="w-4 h-4 inline-block mr-2" />
                  E-posta
                </label>
                <p className="text-gray-900 dark:text-white font-medium">
                  {profile.email || 'Belirtilmemiş'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  <Shield className="w-4 h-4 inline-block mr-2" />
                  Yetki Seviyesi
                </label>
                <p className="text-gray-900 dark:text-white font-medium">
                  {profile.is_admin ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                      Yönetici
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      Kullanıcı
                    </span>
                  )}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  <Calendar className="w-4 h-4 inline-block mr-2" />
                  Kayıt Tarihi
                </label>
                <p className="text-gray-900 dark:text-white font-medium">
                  {formatDate(profile.created_at)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Şifre Değiştirme */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Şifre Değiştir
          </h2>
          {!changingPassword && (
            <button
              onClick={() => setChangingPassword(true)}
              className="btn-secondary flex items-center space-x-2"
            >
              <Key className="w-4 h-4" />
              <span>Şifre Değiştir</span>
            </button>
          )}
        </div>

        {changingPassword ? (
          <form key="password-form" onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mevcut Şifre
              </label>
              <input
                type="password"
                name="current_password"
                value={passwordData.current_password}
                onChange={handlePasswordChange}
                required
                className="input"
                placeholder="Mevcut şifreniz"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Yeni Şifre
              </label>
              <input
                type="password"
                name="new_password"
                value={passwordData.new_password}
                onChange={handlePasswordChange}
                required
                minLength={6}
                className="input"
                placeholder="Yeni şifreniz (en az 6 karakter)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Yeni Şifre (Tekrar)
              </label>
              <input
                type="password"
                name="confirm_password"
                value={passwordData.confirm_password}
                onChange={handlePasswordChange}
                required
                minLength={6}
                className="input"
                placeholder="Yeni şifrenizi tekrar girin"
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Değiştiriliyor...' : 'Şifreyi Değiştir'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setChangingPassword(false)
                  setPasswordData({
                    current_password: '',
                    new_password: '',
                    confirm_password: ''
                  })
                }}
                disabled={saving}
                className="btn-secondary flex items-center space-x-2"
              >
                <X className="w-4 h-4" />
                <span>İptal</span>
              </button>
            </div>
          </form>
        ) : (
          <p key="password-info" className="text-gray-600 dark:text-gray-400">
            Şifrenizi değiştirmek için yukarıdaki butona tıklayın.
          </p>
        )}
      </div>
    </div>
  )
}

export default ProfileSettings
