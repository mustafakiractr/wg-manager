/**
 * Two-Factor Authentication (2FA) ayarları componenti
 * Kullanıcıların 2FA'yı aktifleştirip devre dışı bırakabilecekleri panel
 */
import { useState, useEffect } from 'react'
import { Shield, Key, AlertCircle, CheckCircle, Copy, Download } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import api from '../services/api'

function TwoFactorSettings() {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState({
    enabled: false,
    has_backup_codes: false,
    backup_codes_remaining: 0,
  })

  // Setup state
  const [showSetup, setShowSetup] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [password, setPassword] = useState('')

  // Backup codes state
  const [backupCodes, setBackupCodes] = useState([])
  const [showBackupCodes, setShowBackupCodes] = useState(false)

  // 2FA durumunu yükle
  const loadStatus = async () => {
    try {
      const response = await api.get('/2fa/status')
      setStatus(response.data)
    } catch (error) {
      console.error('2FA durumu alınamadı:', error)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  // 2FA setup başlat
  const handleStartSetup = async () => {
    setLoading(true)
    try {
      const response = await api.post('/2fa/setup')
      setQrCode(response.data.qr_code)
      setSecret(response.data.secret)
      setShowSetup(true)
    } catch (error) {
      toast.error('Setup başlatılamadı: ' + (error.response?.data?.detail || error.message))
    }
    setLoading(false)
  }

  // 2FA'yı etkinleştir
  const handleEnable2FA = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await api.post('/2fa/enable', {
        code: verifyCode,
        password: password,
      })

      // Yedek kodları kaydet
      setBackupCodes(response.data.codes)
      setShowBackupCodes(true)
      setShowSetup(false)

      toast.success('2FA başarıyla etkinleştirildi!')
      await loadStatus()

      // Formu temizle
      setVerifyCode('')
      setPassword('')
    } catch (error) {
      toast.error('2FA etkinleştirilemedi: ' + (error.response?.data?.detail || error.message))
    }

    setLoading(false)
  }

  // 2FA'yı devre dışı bırak
  const handleDisable2FA = async () => {
    const confirmPassword = prompt('2FA\'yı devre dışı bırakmak için şifrenizi girin:')
    if (!confirmPassword) return

    setLoading(true)
    try {
      await api.post('/2fa/disable', { password: confirmPassword })
      toast.success('2FA devre dışı bırakıldı')
      await loadStatus()
    } catch (error) {
      toast.error('2FA devre dışı bırakılamadı: ' + (error.response?.data?.detail || error.message))
    }
    setLoading(false)
  }

  // Yeni yedek kodlar üret
  const handleRegenerateBackupCodes = async () => {
    if (!confirm('Mevcut yedek kodlar geçersiz olacak. Devam etmek istiyor musunuz?')) {
      return
    }

    setLoading(true)
    try {
      const response = await api.post('/2fa/backup-codes')
      setBackupCodes(response.data.codes)
      setShowBackupCodes(true)
      toast.success('Yeni yedek kodlar oluşturuldu')
      await loadStatus()
    } catch (error) {
      toast.error('Yedek kodlar oluşturulamadı: ' + (error.response?.data?.detail || error.message))
    }
    setLoading(false)
  }

  // Yedek kodları kopyala
  const copyBackupCodes = () => {
    const text = backupCodes.join('\n')
    navigator.clipboard.writeText(text)
    toast.success('Yedek kodlar kopyalandı')
  }

  // Yedek kodları indir
  const downloadBackupCodes = () => {
    const text = backupCodes.join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '2fa-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Yedek kodlar indirildi')
  }

  return (
    <div className="space-y-6">
      {/* Durum kartı */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className={`w-8 h-8 ${status.enabled ? 'text-green-500' : 'text-gray-400'}`} />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                İki Faktörlü Doğrulama
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {status.enabled ? 'Aktif' : 'Devre Dışı'}
              </p>
            </div>
          </div>

          {!status.enabled ? (
            <button
              onClick={handleStartSetup}
              disabled={loading}
              className="btn btn-primary"
            >
              Etkinleştir
            </button>
          ) : (
            <button
              onClick={handleDisable2FA}
              disabled={loading}
              className="btn btn-danger"
            >
              Devre Dışı Bırak
            </button>
          )}
        </div>

        {status.enabled && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Yedek Kodlar: {status.backup_codes_remaining} adet
                </p>
              </div>
              <button
                onClick={handleRegenerateBackupCodes}
                disabled={loading}
                className="btn btn-secondary btn-sm"
              >
                <Key className="w-4 h-4 mr-2" />
                Yeni Kodlar Üret
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Setup Modal */}
      {showSetup && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            2FA Kurulumu
          </h3>

          <div className="space-y-6">
            {/* Adım 1: QR kod */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                1. QR Kodu Tarayın
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Google Authenticator veya Authy gibi bir uygulama ile QR kodu tarayın
              </p>
              {qrCode && (
                <div className="flex justify-center bg-white p-4 rounded-lg">
                  <img src={qrCode} alt="2FA QR Code" className="w-64 h-64" />
                </div>
              )}
              <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Manuel giriş kodu:
                </p>
                <code className="text-sm font-mono text-gray-900 dark:text-white">
                  {secret}
                </code>
              </div>
            </div>

            {/* Adım 2: Doğrulama */}
            <form onSubmit={handleEnable2FA} className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  2. Kodu Doğrulayın
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Uygulamadaki 6 haneli kodu girin
                </p>
                <input
                  type="text"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input text-center text-2xl tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Şifrenizi Girin (Güvenlik)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 btn btn-primary"
                >
                  {loading ? 'Doğrulanıyor...' : 'Etkinleştir'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSetup(false)}
                  className="flex-1 btn btn-secondary"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Backup Codes Modal */}
      {showBackupCodes && backupCodes.length > 0 && (
        <div className="card">
          <div className="flex items-start space-x-3 mb-4">
            <AlertCircle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Yedek Kodlarınız
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Bu kodları güvenli bir yerde saklayın. Telefonunuza erişiminiz olmadığında bu kodları kullanabilirsiniz.
                Her kod sadece bir kez kullanılabilir.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {backupCodes.map((code, index) => (
              <div
                key={index}
                className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg font-mono text-center"
              >
                {code}
              </div>
            ))}
          </div>

          <div className="flex space-x-3">
            <button onClick={copyBackupCodes} className="flex-1 btn btn-secondary">
              <Copy className="w-4 h-4 mr-2" />
              Kopyala
            </button>
            <button onClick={downloadBackupCodes} className="flex-1 btn btn-secondary">
              <Download className="w-4 h-4 mr-2" />
              İndir
            </button>
            <button
              onClick={() => setShowBackupCodes(false)}
              className="flex-1 btn btn-primary"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Anladım
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default TwoFactorSettings
