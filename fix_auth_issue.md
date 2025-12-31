# 401 Authentication Hatası Çözümü

## Problem
PostgreSQL migration sonrası eski JWT token'lar geçersiz. Frontend localStorage'da eski token'lar kalmış.

## Çözümler

### ✅ Çözüm 1: Frontend'de localStorage Temizle (EN KOLAY)

Browser console'da:
```javascript
localStorage.clear()
location.reload()
```

Sonra tekrar login ol.

### ✅ Çözüm 2: Yeni Login Sayfası Ekle - Token Kontrolü

Backend'de token validation'ı güçlendir:
- Expired token'ları otomatik reddet
- Frontend'de 401 gelince localStorage'ı temizle

### ✅ Çözüm 3: Database Session Temizle

PostgreSQL'de eski session'ları sil:
```sql
DELETE FROM sessions WHERE expires_at < NOW();
```

## İmplementasyon

Frontend api.js'de 401 handling'i düzelt:
```javascript
if (error?.response?.status === 401) {
  // Logout ve localStorage temizle
  useAuthStore.getState().logout()
  window.location.href = '/login'
  return Promise.reject(error)
}
```
