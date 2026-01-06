/**
 * Backup Şifreleme - AES-256 Encryption UI
 * Backup dosyalarını şifrele/çöz
 */
import { useState, useEffect } from 'react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import {
  Shield,
  Lock,
  Unlock,
  FileKey,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Info
} from 'lucide-react'

export default function BackupEncryption() {
  const [loading, setLoading] = useState(false)
  const [backups, setBackups] = useState([])
  const [selectedBackup, setSelectedBackup] = useState(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [operation, setOperation] = useState(null) // 'encrypt', 'decrypt', 'create'
  const toast = useToast()

  useEffect(() => {
    fetchBackups()
  }, [])

  const fetchBackups = async () => {
    try {
      setLoading(true)
      const response = await api.get('/backup/list')
      if (response.data.success) {
        setBackups(response.data.backups || [])
      }
    } catch (error) {
      console.error('Backup listesi alınamadı:', error)
      toast.error('Backup listesi alınamadı')
    } finally {
      setLoading(false)
    }
  }

  const handleEncrypt = async () => {
    if (!selectedBackup) {
      toast.warning('Lütfen bir backup dosyası seçin')
      return
    }

    if (password.length < 8) {
      toast.warning('Şifre en az 8 karakter olmalıdır')
      return
    }

    if (password !== confirmPassword) {
      toast.warning('Şifreler eşleşmiyor')
      return
    }

    try {
      setLoading(true)
      const response = await api.post('/backup/encrypt', {
        backup_filename: selectedBackup.filename,
        password: password
      })

      if (response.data.success) {
        toast.success(`✅ Backup başarıyla şifrelendi: ${response.data.encrypted_file}`)
        setPassword('')
        setConfirmPassword('')
        setSelectedBackup(null)
        fetchBackups()
      }
    } catch (error) {
      console.error('Şifreleme hatası:', error)
      toast.error(error.response?.data?.detail || 'Şifreleme başarısız')
    } finally {
      setLoading(false)
    }
  }

  const handleDecrypt = async () => {
    if (!selectedBackup) {
      toast.warning('Lütfen şifreli bir backup dosyası seçin')
      return
    }

    if (!password) {
      toast.warning('Lütfen şifre girin')
      return
    }

    try {
      setLoading(true)
      const response = await api.post('/backup/decrypt', {
        encrypted_filename: selectedBackup.filename,
        password: password
      })

      if (response.data.success) {
        toast.success(`✅ Backup şifresi başarıyla çözüldü: ${response.data.decrypted_file}`)
        setPassword('')
        setSelectedBackup(null)
        fetchBackups()
      }
    } catch (error) {
      console.error('Şifre çözme hatası:', error)
      const errorMsg = error.response?.data?.detail || 'Şifre çözme başarısız'
      if (errorMsg.includes('authentication failed') || errorMsg.includes('yanlış')) {
        toast.error('❌ Şifre yanlış veya dosya bozuk')
      } else {
        toast.error(errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreateEncrypted = async (backupType) => {
    if (password.length < 8) {
      toast.warning('Şifre en az 8 karakter olmalıdır')
      return
    }

    if (password !== confirmPassword) {
      toast.warning('Şifreler eşleşmiyor')
      return
    }

    try {
      setLoading(true)
      const response = await api.post(`/backup/create-encrypted?backup_type=${backupType}&password=${encodeURIComponent(password)}&send_notification=true`)

      if (response.data.success) {
        toast.success(`✅ Şifreli ${backupType} backup oluşturuldu!`)
        setPassword('')
        setConfirmPassword('')
        setOperation(null)
        fetchBackups()
      }
    } catch (error) {
      console.error('Şifreli backup oluşturma hatası:', error)
      toast.error(error.response?.data?.detail || 'Şifreli backup oluşturulamadı')
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A'
    const mb = bytes / (1024 * 1024)
    return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(2)} KB`
  }

  const isEncryptedFile = (filename) => {
    return filename && filename.endsWith('.encrypted')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-8 h-8 text-indigo-600" />
            Backup Şifreleme
          </h1>
          <p className="text-gray-600 mt-1">
            Backup dosyalarınızı AES-256-GCM ile şifreleyin
          </p>
        </div>
        <button
          onClick={fetchBackups}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          Yenile
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-2">🔐 Şifreleme Bilgileri:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>Algoritma:</strong> AES-256-GCM (Authenticated Encryption)</li>
              <li><strong>Key Derivation:</strong> PBKDF2-HMAC-SHA256 (100,000 iterations)</li>
              <li><strong>Minimum Şifre:</strong> 8 karakter (daha uzun önerilir)</li>
              <li><strong>Güvenlik:</strong> Salt + Nonce + Authentication Tag</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Operation Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setOperation('encrypt')}
          className={`p-6 rounded-lg border-2 transition ${
            operation === 'encrypt'
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 hover:border-green-300'
          }`}
        >
          <Lock className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900">Mevcut Backup'ı Şifrele</h3>
          <p className="text-sm text-gray-600 mt-1">Var olan backup dosyasını şifreleyin</p>
        </button>

        <button
          onClick={() => setOperation('decrypt')}
          className={`p-6 rounded-lg border-2 transition ${
            operation === 'decrypt'
              ? 'border-orange-500 bg-orange-50'
              : 'border-gray-200 hover:border-orange-300'
          }`}
        >
          <Unlock className="w-12 h-12 text-orange-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900">Şifreli Backup'ı Çöz</h3>
          <p className="text-sm text-gray-600 mt-1">Şifreli dosyanın şifresini çözün</p>
        </button>

        <button
          onClick={() => setOperation('create')}
          className={`p-6 rounded-lg border-2 transition ${
            operation === 'create'
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 hover:border-indigo-300'
          }`}
        >
          <FileKey className="w-12 h-12 text-indigo-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900">Şifreli Backup Oluştur</h3>
          <p className="text-sm text-gray-600 mt-1">Doğrudan şifreli backup alın</p>
        </button>
      </div>

      {/* Operation Panel */}
      {operation && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          {/* Encrypt Mode */}
          {operation === 'encrypt' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Lock className="w-5 h-5 text-green-600" />
                Backup Şifreleme
              </h2>

              {/* File Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Şifrelenecek Backup Dosyası:
                </label>
                <select
                  value={selectedBackup?.filename || ''}
                  onChange={(e) => {
                    const backup = backups.find(b => b.filename === e.target.value)
                    setSelectedBackup(backup)
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Dosya seçin...</option>
                  {backups.filter(b => !isEncryptedFile(b.filename)).map(backup => (
                    <option key={backup.filename} value={backup.filename}>
                      {backup.filename} ({formatFileSize(backup.size)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Password Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Şifre (min 8 karakter):
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="********"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Şifre Tekrar:
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="********"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleEncrypt}
                  disabled={loading || !selectedBackup || !password || !confirmPassword}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Lock className="w-5 h-5" />
                  )}
                  Şifrele
                </button>

                <button
                  onClick={() => {
                    setOperation(null)
                    setPassword('')
                    setConfirmPassword('')
                    setSelectedBackup(null)
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  İptal
                </button>
              </div>
            </div>
          )}

          {/* Decrypt Mode */}
          {operation === 'decrypt' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Unlock className="w-5 h-5 text-orange-600" />
                Backup Şifre Çözme
              </h2>

              {/* File Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Şifreli Backup Dosyası:
                </label>
                <select
                  value={selectedBackup?.filename || ''}
                  onChange={(e) => {
                    const backup = backups.find(b => b.filename === e.target.value)
                    setSelectedBackup(backup)
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Şifreli dosya seçin...</option>
                  {backups.filter(b => isEncryptedFile(b.filename)).map(backup => (
                    <option key={backup.filename} value={backup.filename}>
                      {backup.filename} ({formatFileSize(backup.size)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Şifre:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="********"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleDecrypt}
                  disabled={loading || !selectedBackup || !password}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Unlock className="w-5 h-5" />
                  )}
                  Şifre Çöz
                </button>

                <button
                  onClick={() => {
                    setOperation(null)
                    setPassword('')
                    setSelectedBackup(null)
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  İptal
                </button>
              </div>
            </div>
          )}

          {/* Create Encrypted Mode */}
          {operation === 'create' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileKey className="w-5 h-5 text-indigo-600" />
                Şifreli Backup Oluştur
              </h2>

              {/* Password Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Şifre (min 8 karakter):
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="********"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Şifre Tekrar:
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="********"
                  />
                </div>
              </div>

              {/* Backup Type Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => handleCreateEncrypted('database')}
                  disabled={loading || !password || !confirmPassword}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <FileKey className="w-5 h-5" />
                  )}
                  Database Backup (Şifreli)
                </button>

                <button
                  onClick={() => handleCreateEncrypted('full')}
                  disabled={loading || !password || !confirmPassword}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <FileKey className="w-5 h-5" />
                  )}
                  Full Backup (Şifreli)
                </button>
              </div>

              <button
                onClick={() => {
                  setOperation(null)
                  setPassword('')
                  setConfirmPassword('')
                }}
                className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                İptal
              </button>
            </div>
          )}
        </div>
      )}

      {/* Backup Files List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Backup Dosyaları</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {backups.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>Henüz backup dosyası yok</p>
            </div>
          ) : (
            backups.map((backup) => (
              <div key={backup.filename} className="px-6 py-4 hover:bg-gray-50 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isEncryptedFile(backup.filename) ? (
                      <Lock className="w-5 h-5 text-orange-600" />
                    ) : (
                      <FileKey className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{backup.filename}</p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(backup.size)} • {backup.created}
                      </p>
                    </div>
                  </div>
                  {isEncryptedFile(backup.filename) && (
                    <span className="px-3 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full">
                      🔐 Şifreli
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
