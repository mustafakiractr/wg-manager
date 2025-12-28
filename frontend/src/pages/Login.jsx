/**
 * Login sayfası bileşeni
 * Kullanıcı girişi için form
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useToast } from '../context/ToastContext'
import { Network } from 'lucide-react'

function Login() {
  const navigate = useNavigate()
  const { login, verify2FA, isAuthenticated, requires2FA } = useAuthStore()
  const toast = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [show2FA, setShow2FA] = useState(false)

  // Zaten giriş yapmışsa dashboard'a yönlendir
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  // Form submit handler
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await login(username, password)

    if (result.success) {
      if (result.requires2FA) {
        // 2FA gerekli, kod girme ekranına geç
        setShow2FA(true)
        toast.info('2FA kodu girmeniz gerekiyor')
      } else {
        // Normal login
        toast.success('Giriş başarılı! Yönlendiriliyorsunuz...')
        navigate('/dashboard')
      }
    } else {
      const errorMessage = result.message || 'Giriş başarısız'
      setError(errorMessage)
      toast.error(errorMessage)
    }

    setLoading(false)
  }

  // 2FA kod doğrulama handler
  const handle2FASubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await verify2FA(twoFactorCode)

    if (result.success) {
      toast.success('2FA doğrulama başarılı! Yönlendiriliyorsunuz...')
      navigate('/dashboard')
    } else {
      const errorMessage = result.message || '2FA doğrulama başarısız'
      setError(errorMessage)
      toast.error(errorMessage)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        {/* Logo ve başlık */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full mb-4">
            <Network className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Router Manager
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            MikroTik Yönetim Paneli
          </p>
        </div>

        {/* Login formu */}
        <div className="card">
          {!show2FA ? (
            // Normal login form
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Hata mesajı */}
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Kullanıcı adı */}
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Kullanıcı Adı
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input"
                  placeholder="admin"
                  required
                  autoFocus
                />
              </div>

              {/* Şifre */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Şifre
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  required
                />
              </div>

              {/* Remember Me */}
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                >
                  Beni hatırla (30 gün)
                </label>
              </div>

              {/* Giriş butonu */}
              <button
                type="submit"
                disabled={loading}
                className="w-full btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </button>
            </form>
          ) : (
            // 2FA verification form
            <form onSubmit={handle2FASubmit} className="space-y-6">
              <div className="text-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  İki Faktörlü Doğrulama
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Authenticator uygulamanızdaki 6 haneli kodu girin
                </p>
              </div>

              {/* Hata mesajı */}
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* 2FA kodu */}
              <div>
                <label
                  htmlFor="twoFactorCode"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Doğrulama Kodu
                </label>
                <input
                  id="twoFactorCode"
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input text-center text-2xl tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                  autoFocus
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Yedek kodunuzu da kullanabilirsiniz (xxxx-xxxx formatında)
                </p>
              </div>

              {/* Doğrula butonu */}
              <button
                type="submit"
                disabled={loading}
                className="w-full btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Doğrulanıyor...' : 'Doğrula'}
              </button>

              {/* Geri dön */}
              <button
                type="button"
                onClick={() => {
                  setShow2FA(false)
                  setTwoFactorCode('')
                  setError('')
                }}
                className="w-full btn btn-secondary"
              >
                Geri Dön
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login


