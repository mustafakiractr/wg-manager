/**
 * Kullanıcı Yönetimi sayfası
 * Kullanıcı listesi, ekleme, düzenleme, silme ve şifre değiştirme
 */
import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  changePasswordByAdmin,
} from '../services/userService'
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Key,
  Search,
  RefreshCw,
  Shield,
  ShieldCheck,
  X,
  Eye,
  EyeOff,
} from 'lucide-react'

function UsersPage() {
  const { user: currentUser } = useAuthStore()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    is_admin: false,
  })

  // İlk yükleme
  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await getUsers()
      if (response.success) {
        setUsers(response.data || [])
      }
    } catch (error) {
      console.error('Kullanıcı listesi yüklenemedi:', error)
      alert('Kullanıcı listesi yüklenemedi: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      is_admin: false,
    })
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  const handleAddUser = async (e) => {
    e.preventDefault()
    
    if (!formData.username || !formData.password) {
      alert('Kullanıcı adı ve şifre zorunludur')
      return
    }
    
    if (formData.password !== formData.confirmPassword) {
      alert('Şifreler eşleşmiyor')
      return
    }
    
    if (formData.password.length < 6) {
      alert('Şifre en az 6 karakter olmalıdır')
      return
    }
    
    try {
      await createUser({
        username: formData.username,
        email: formData.email || undefined,
        password: formData.password,
        is_admin: formData.is_admin,
      })
      alert('Kullanıcı başarıyla oluşturuldu')
      setShowAddModal(false)
      resetForm()
      await loadUsers()
    } catch (error) {
      alert('Kullanıcı oluşturulamadı: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleEditUser = async (e) => {
    e.preventDefault()
    
    if (!selectedUser) return
    
    try {
      await updateUser(selectedUser.id, {
        username: formData.username,
        email: formData.email || undefined,
        is_admin: formData.is_admin,
      })
      alert('Kullanıcı başarıyla güncellendi')
      setShowEditModal(false)
      setSelectedUser(null)
      resetForm()
      await loadUsers()
    } catch (error) {
      alert('Kullanıcı güncellenemedi: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) return
    
    try {
      await deleteUser(userId)
      alert('Kullanıcı başarıyla silindi')
      await loadUsers()
    } catch (error) {
      alert('Kullanıcı silinemedi: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    
    if (!formData.password || !formData.confirmPassword) {
      alert('Şifre alanları zorunludur')
      return
    }
    
    if (formData.password !== formData.confirmPassword) {
      alert('Şifreler eşleşmiyor')
      return
    }
    
    if (!formData.password || formData.password.length < 6) {
      alert('Şifre en az 6 karakter olmalıdır')
      return
    }
    
    if (formData.password.length > 72) {
      alert('Şifre en fazla 72 karakter olabilir')
      return
    }
    
    if (!selectedUser) return
    
    try {
      await changePasswordByAdmin(selectedUser.id, formData.password)
      alert('Şifre başarıyla değiştirildi')
      setShowPasswordModal(false)
      setSelectedUser(null)
      resetForm()
    } catch (error) {
      alert('Şifre değiştirilemedi: ' + (error.response?.data?.detail || error.message))
    }
  }

  const openEditModal = (user) => {
    setSelectedUser(user)
    setFormData({
      username: user.username,
      email: user.email || '',
      password: '',
      confirmPassword: '',
      is_admin: user.is_admin || false,
    })
    setShowEditModal(true)
  }

  const openPasswordModal = (user) => {
    setSelectedUser(user)
    setFormData({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      is_admin: false,
    })
    setShowPasswordModal(true)
  }

  // Filtreleme
  const filteredUsers = users.filter((user) => {
    const term = searchTerm.toLowerCase()
    return (
      user.username.toLowerCase().includes(term) ||
      (user.email && user.email.toLowerCase().includes(term))
    )
  })

  // Sadece admin kullanıcılar kullanıcı yönetimi yapabilir
  if (!currentUser?.is_admin) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
          <p className="text-sm sm:text-lg font-medium text-gray-900 dark:text-white px-4">
            Bu sayfaya erişim için admin yetkisi gereklidir
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-0">
      {/* Sayfa başlığı */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Kullanıcı Yönetimi
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Kullanıcıları yönetin, ekleyin, düzenleyin ve silin
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadUsers}
            disabled={loading}
            className="btn btn-secondary flex items-center gap-1.5 sm:gap-2 text-sm px-3 py-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Yenile</span>
          </button>
          <button
            onClick={() => {
              resetForm()
              setShowAddModal(true)
            }}
            className="btn btn-primary flex items-center gap-1.5 sm:gap-2 text-sm px-3 py-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Kullanıcı Ekle</span>
            <span className="sm:hidden">Ekle</span>
          </button>
        </div>
      </div>

      {/* Arama */}
      <div className="card p-3 sm:p-4">
        <div className="relative">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Kullanıcı adı veya email ile ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-9 sm:pl-10 text-sm"
          />
        </div>
      </div>

      {/* Kullanıcı listesi */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-48 sm:h-64">
            <RefreshCw className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-primary-600 dark:text-primary-400" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-6 sm:py-8">
            <Users className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz kullanıcı bulunamadı'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                    Kullanıcı Adı
                  </th>
                  <th className="hidden sm:table-cell text-left py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email
                  </th>
                  <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                    Yetki
                  </th>
                  <th className="hidden md:table-cell text-left py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                    Oluşturulma
                  </th>
                  <th className="text-right py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-2 sm:py-3 px-3 sm:px-4">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="font-medium text-xs sm:text-sm text-gray-900 dark:text-white truncate max-w-[100px] sm:max-w-none">
                          {user.username}
                        </span>
                        {user.id === currentUser?.id && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 flex-shrink-0">
                            (Siz)
                          </span>
                        )}
                      </div>
                      {/* Show email on mobile */}
                      <div className="sm:hidden text-xs text-gray-500 mt-0.5 truncate">
                        {user.email || '-'}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      <span className="truncate block max-w-[150px]">{user.email || '-'}</span>
                    </td>
                    <td className="py-2 sm:py-3 px-3 sm:px-4">
                      {user.is_admin ? (
                        <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                          <ShieldCheck className="w-3 h-3" />
                          <span className="hidden sm:inline">Admin</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400">
                          <Shield className="w-3 h-3" />
                          <span className="hidden sm:inline">Kullanıcı</span>
                        </span>
                      )}
                    </td>
                    <td className="hidden md:table-cell py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString('tr-TR')
                        : '-'}
                    </td>
                    <td className="py-2 sm:py-3 px-3 sm:px-4">
                      <div className="flex items-center justify-end gap-1 sm:gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-blue-600 dark:text-blue-400"
                          title="Düzenle"
                        >
                          <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={() => openPasswordModal(user)}
                          className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-green-600 dark:text-green-400"
                          title="Şifre Değiştir"
                        >
                          <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        {user.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-1.5 sm:p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400"
                            title="Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Kullanıcı Ekleme Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-4 sm:p-6 my-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                Yeni Kullanıcı Ekle
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  resetForm()
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  Kullanıcı Adı *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="input text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  Şifre *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input pr-10 text-sm"
                    required
                    minLength={6}
                    maxLength={72}
                    placeholder="En az 6, en fazla 72 karakter"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  Şifre Tekrar *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="input pr-10 text-sm"
                    required
                    minLength={6}
                    maxLength={72}
                    placeholder="En az 6, en fazla 72 karakter"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_admin}
                    onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                    Admin Yetkisi
                  </span>
                </label>
              </div>

              <div className="flex gap-2 pt-3 sm:pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    resetForm()
                  }}
                  className="flex-1 btn btn-secondary text-sm"
                >
                  İptal
                </button>
                <button type="submit" className="flex-1 btn btn-primary text-sm">
                  Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Kullanıcı Düzenleme Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-4 sm:p-6 my-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                Kullanıcı Düzenle
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedUser(null)
                  resetForm()
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  Kullanıcı Adı *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="input text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_admin}
                    onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                    Admin Yetkisi
                  </span>
                </label>
              </div>

              <div className="flex gap-2 pt-3 sm:pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedUser(null)
                    resetForm()
                  }}
                  className="flex-1 btn btn-secondary text-sm"
                >
                  İptal
                </button>
                <button type="submit" className="flex-1 btn btn-primary text-sm">
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Şifre Değiştirme Modal */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-4 sm:p-6 my-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                Şifre Değiştir
              </h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false)
                  setSelectedUser(null)
                  resetForm()
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-3 sm:mb-4">
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                Kullanıcı: <span className="font-medium">{selectedUser.username}</span>
              </p>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  Yeni Şifre *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input pr-10 text-sm"
                    required
                    minLength={6}
                    maxLength={72}
                    placeholder="En az 6, en fazla 72 karakter"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  Yeni Şifre Tekrar *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="input pr-10 text-sm"
                    required
                    minLength={6}
                    maxLength={72}
                    placeholder="En az 6, en fazla 72 karakter"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-3 sm:pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false)
                    setSelectedUser(null)
                    resetForm()
                  }}
                  className="flex-1 btn btn-secondary text-sm"
                >
                  İptal
                </button>
                <button type="submit" className="flex-1 btn btn-primary text-sm">
                  Değiştir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default UsersPage

