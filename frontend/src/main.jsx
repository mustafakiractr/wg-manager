/**
 * React uygulamasının giriş noktası
 * Ana App bileşenini render eder
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Hata yakalama - geliştirme ve production için
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error)
  // Hata mesajını ekranda göster
  const rootElement = document.getElementById('root')
  if (rootElement && !rootElement.innerHTML.includes('React')) {
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: Arial; color: red; background: white;">
        <h1>JavaScript Hatası</h1>
        <p><strong>${e.message || 'Bilinmeyen hata'}</strong></p>
        <p>Lütfen Console sekmesindeki hataları kontrol edin (F12).</p>
        <pre style="background: #f0f0f0; padding: 10px; overflow: auto; font-size: 12px;">${e.error?.stack || 'Stack trace yok'}</pre>
      </div>
    `
  }
})

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason)
  // Promise rejection'ı ekranda göster
  const rootElement = document.getElementById('root')
  if (rootElement && !rootElement.innerHTML.includes('React')) {
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: Arial; color: red; background: white;">
        <h1>API Bağlantı Hatası</h1>
        <p><strong>${e.reason?.message || 'Backend bağlantısı kurulamadı'}</strong></p>
        <p>Lütfen:</p>
        <ul>
          <li>Backend servisinin çalıştığından emin olun</li>
          <li>API URL'ini kontrol edin: ${window.location.origin.replace(':5173', ':8000')}/api/v1</li>
          <li>Console sekmesindeki hataları kontrol edin (F12)</li>
        </ul>
        <pre style="background: #f0f0f0; padding: 10px; overflow: auto; font-size: 12px;">${JSON.stringify(e.reason, null, 2)}</pre>
      </div>
    `
  }
})

// Root element kontrolü
const rootElement = document.getElementById('root')
if (!rootElement) {
  console.error('Root element bulunamadı!')
} else {
  try {
    const root = ReactDOM.createRoot(rootElement)
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
    console.log('React uygulaması başlatıldı')
  } catch (error) {
    console.error('React render error:', error)
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: Arial; color: red;">
        <h1>Hata Oluştu</h1>
        <p><strong>${error.message}</strong></p>
        <pre style="background: #f0f0f0; padding: 10px; overflow: auto;">${error.stack || 'Stack trace yok'}</pre>
        <p>Lütfen Console sekmesindeki hataları kontrol edin.</p>
      </div>
    `
  }
}


