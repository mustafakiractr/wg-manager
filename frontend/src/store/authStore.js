/**
 * Zustand ile authentication state yönetimi
 * Kullanıcı giriş durumu ve token yönetimi
 */
import { create } from 'zustand'
import api from '../services/api'

// Ortak ortam bayrağı: sadece geliştirme (npm run dev) ortamında true olur
// NOT: Bu değişken sayesinde production ortamında gereksiz log'ları kapatıp uygulamayı daha hafif ve stabil hale getiriyoruz
const isDev = import.meta.env.DEV

// Basit localStorage persist implementasyonu (zustand/middleware yerine)
const useAuthStore = create(
    (set) => ({
      // State
      isAuthenticated: false,
      user: null,
      accessToken: null,
      refreshToken: null,
      requires2FA: false,  // 2FA gerekli mi?
      pendingToken: null,  // 2FA için geçici token

      // Actions
      /**
       * Kullanıcı girişi yapar
       * @param {string} username - Kullanıcı adı
       * @param {string} password - Şifre
       */
      login: async (username, password) => {
        try {
          // API base URL'i kontrol et (api.js'den al)
          const apiBaseUrl = api.defaults.baseURL // Axios'un o an kullanacağı temel API adresini okuyoruz
          if (isDev) {
            console.log('API Base URL:', apiBaseUrl) // Geliştirme ortamında hangi API adresine gittiğimizi görmek için log
            console.log('Login isteği gönderiliyor:', { username, url: `${apiBaseUrl}/auth/login` }) // Gönderilen login isteğini debug etmek için
          }
          
          const response = await api.post('/auth/login', { username, password }) // Backend login endpoint'ine istek atıyoruz
          if (isDev) {
            console.log('Login yanıtı:', response.data) // Geliştirmede gelen yanıtı detaylı görmek için
          }

          // 2FA gerekli mi kontrol et
          if (response.data.requires_2fa) {
            set({
              requires2FA: true,
              pendingToken: response.data.pending_token,
            })
            return { success: true, requires2FA: true }
          }

          const { access_token, refresh_token } = response.data
          
          // Token'ları önce state'e kaydet (API interceptor'ın token'ı gönderebilmesi için)
          set({
            isAuthenticated: true,
            accessToken: access_token,
            refreshToken: refresh_token,
          })
          
          // Kullanıcı bilgilerini al (token artık state'de, interceptor otomatik ekleyecek)
          try {
            if (isDev) console.log('Kullanıcı bilgileri alınıyor...') // Sadece geliştirme ortamında kullanıcı bilgisi isteğini logluyoruz
            const userResponse = await api.get('/auth/me') // /auth/me endpoint'inden oturum açan kullanıcının detaylarını alıyoruz
            if (isDev) console.log('Kullanıcı bilgileri alındı:', userResponse.data) // Gelen kullanıcı verisini debug amaçlı gösteriyoruz
            set({ user: userResponse.data.user })
          } catch (userError) {
            // Kullanıcı bilgileri alınırken hata olursa, detayları sadece geliştirme ortamında logla
            if (isDev) {
              console.error('Kullanıcı bilgileri alınamadı:', userError)
              console.error('Kullanıcı bilgileri hatası detayları:', {
                message: userError.message,
                code: userError.code,
                status: userError.response?.status,
                data: userError.response?.data,
                url: userError.config?.url,
                baseURL: userError.config?.baseURL,
                headers: userError.config?.headers
              })
            }
            // Kullanıcı bilgileri alınamasa bile login başarılı sayılabilir
            // Token'lar kaydedildi, kullanıcı bilgileri sonra alınabilir
          }
          
          return { success: true }
        } catch (error) {
          // Login sırasında oluşan hatayı sadece geliştirme ortamında ayrıntılı logla
          if (isDev) {
            console.error('Login hatası:', error)
            console.error('Hata detayları:', {
              message: error.message,
              code: error.code,
              response: error.response?.data,
              status: error.response?.status,
              statusText: error.response?.statusText,
              url: error.config?.url,
              baseURL: error.config?.baseURL,
              fullURL: error.config ? `${error.config.baseURL}${error.config.url}` : 'unknown',
              isNetworkError: !error.response && error.request,
              isDNSError: error.code === 'ERR_NAME_NOT_RESOLVED' || error.message?.includes('ERR_NAME_NOT_RESOLVED'),
              isTimeout: error.code === 'ECONNABORTED' || error.message?.includes('timeout'),
              fullURL: error.config ? `${error.config.baseURL}${error.config.url}` : 'unknown',
              request: error.request ? 'Request gönderildi ama yanıt alınamadı' : 'Request gönderilemedi',
              isNetworkError: !error.response && error.request,
              isTimeout: error.code === 'ECONNABORTED' || error.message?.includes('timeout')
            })
          }
          
          // Daha detaylı hata mesajı
          let errorMessage = 'Giriş başarısız'

          // Account lockout kontrolü (HTTP 423)
          if (error.response?.status === 423) {
            errorMessage = error.response.data?.detail || 'Hesap geçici olarak kilitlendi'
          }
          // DNS hatası kontrolü
          else if (error.code === 'ERR_NAME_NOT_RESOLVED' || error.message?.includes('ERR_NAME_NOT_RESOLVED')) {
            errorMessage = 'DNS çözümlemesi yapılamadı. Lütfen domain adresini kontrol edin veya IP adresi üzerinden erişmeyi deneyin.'
          } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            errorMessage = 'Bağlantı zaman aşımına uğradı. Lütfen bağlantınızı kontrol edin.'
          } else if (error.response) {
            // Sunucu yanıt verdi
            errorMessage = error.response.data?.detail || error.response.data?.message || `Sunucu hatası: ${error.response.status}`
          } else if (error.request) {
            // İstek gönderildi ama yanıt alınamadı
            const fullURL = error.config ? `${error.config.baseURL}${error.config.url}` : 'unknown'
            errorMessage = `Sunucuya bağlanılamadı (${fullURL}). Lütfen bağlantınızı kontrol edin.`
          } else {
            // İstek hazırlanırken hata oluştu
            errorMessage = error.message || 'Giriş başarısız'
          }
          
          return {
            success: false,
            message: errorMessage,
          }
        }
      },

      /**
       * 2FA kodunu doğrular ve giriş tamamlar
       * @param {string} code - 2FA kodu
       */
      verify2FA: async (code) => {
        const { pendingToken } = useAuthStore.getState()
        if (!pendingToken) {
          return { success: false, message: 'Geçici token bulunamadı' }
        }

        try {
          const response = await api.post('/auth/verify-2fa', {
            pending_token: pendingToken,
            code,
          })

          const { access_token, refresh_token } = response.data

          // Token'ları kaydet
          set({
            isAuthenticated: true,
            accessToken: access_token,
            refreshToken: refresh_token,
            requires2FA: false,
            pendingToken: null,
          })

          // Kullanıcı bilgilerini al
          try {
            const userResponse = await api.get('/auth/me')
            set({ user: userResponse.data.user })
          } catch (userError) {
            if (isDev) console.error('Kullanıcı bilgileri alınamadı:', userError)
          }

          return { success: true }
        } catch (error) {
          if (isDev) console.error('2FA doğrulama hatası:', error)

          let errorMessage = '2FA doğrulama başarısız'
          if (error.response?.data?.detail) {
            errorMessage = error.response.data.detail
          } else if (error.response?.status === 401) {
            errorMessage = 'Geçersiz 2FA kodu'
          }

          return { success: false, message: errorMessage }
        }
      },

      /**
       * Kullanıcı çıkışı yapar
       */
      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
          accessToken: null,
          refreshToken: null,
          requires2FA: false,
          pendingToken: null,
        })
      },

      /**
       * Token'ı yeniler
       */
      refreshAccessToken: async () => {
        const { refreshToken } = useAuthStore.getState()
        if (!refreshToken) return false

        try {
          const response = await api.post('/auth/refresh', {
            refresh_token: refreshToken,
          })
          const { access_token, refresh_token } = response.data
          
          set({
            accessToken: access_token,
            refreshToken: refresh_token,
          })
          
          return true
        } catch (error) {
          // Refresh token geçersizse çıkış yap
          useAuthStore.getState().logout()
          return false
        }
      },

      /**
       * Kullanıcı bilgilerini günceller
       */
      setUser: (user) => set({ user }),
    })
)

// LocalStorage ile senkronizasyon
if (typeof window !== 'undefined') {
  try {
    // Başlangıçta localStorage'dan yükle
    const stored = localStorage.getItem('auth-storage')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        if (data && typeof data === 'object') {
          useAuthStore.setState({
            isAuthenticated: data.isAuthenticated || false,
            user: data.user || null,
            accessToken: data.accessToken || null,
            refreshToken: data.refreshToken || null,
            requires2FA: data.requires2FA || false,
            pendingToken: data.pendingToken || null,
          })
        }
      } catch (e) {
        console.error('Auth storage parse error:', e)
        localStorage.removeItem('auth-storage')
      }
    }
    
    // State değiştiğinde localStorage'a kaydet
    useAuthStore.subscribe((state) => {
      try {
        localStorage.setItem('auth-storage', JSON.stringify({
          isAuthenticated: state.isAuthenticated,
          user: state.user,
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
          requires2FA: state.requires2FA,
          pendingToken: state.pendingToken,
        }))
      } catch (e) {
        console.error('Auth storage save error:', e)
      }
    })
  } catch (e) {
    console.error('Auth storage init error:', e)
  }
}

// Hem default hem named export
export default useAuthStore
export { useAuthStore }

