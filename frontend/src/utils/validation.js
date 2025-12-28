/**
 * Form Validasyon Utility Fonksiyonları
 * Yaygın validasyon kuralları ve helper fonksiyonlar
 */

// IP adresi validasyonu
export const validateIP = (ip) => {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipRegex.test(ip)) {
    return { valid: false, message: 'Geçerli bir IP adresi giriniz (örn: 192.168.1.1)' }
  }

  const parts = ip.split('.')
  for (const part of parts) {
    const num = parseInt(part, 10)
    if (num < 0 || num > 255) {
      return { valid: false, message: 'IP adresindeki her sayı 0-255 arasında olmalıdır' }
    }
  }

  return { valid: true }
}

// CIDR notasyonu validasyonu
export const validateCIDR = (cidr) => {
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
  if (!cidrRegex.test(cidr)) {
    return { valid: false, message: 'Geçerli bir CIDR notasyonu giriniz (örn: 192.168.1.0/24)' }
  }

  const [ip, prefix] = cidr.split('/')
  const ipValidation = validateIP(ip)
  if (!ipValidation.valid) {
    return ipValidation
  }

  const prefixNum = parseInt(prefix, 10)
  if (prefixNum < 0 || prefixNum > 32) {
    return { valid: false, message: 'CIDR prefix 0-32 arasında olmalıdır' }
  }

  return { valid: true }
}

// Port validasyonu
export const validatePort = (port) => {
  const portNum = parseInt(port, 10)
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return { valid: false, message: 'Port numarası 1-65535 arasında olmalıdır' }
  }
  return { valid: true }
}

// Email validasyonu
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Geçerli bir email adresi giriniz' }
  }
  return { valid: true }
}

// WireGuard public/private key validasyonu
export const validateWGKey = (key) => {
  // WireGuard keyler base64 encoded 44 karakterlik stringlerdir
  const keyRegex = /^[A-Za-z0-9+/]{43}=$/
  if (!keyRegex.test(key)) {
    return { valid: false, message: 'Geçerli bir WireGuard key giriniz (44 karakter, base64)' }
  }
  return { valid: true }
}

// Boş alan kontrolü
export const validateRequired = (value, fieldName = 'Bu alan') => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return { valid: false, message: `${fieldName} zorunludur` }
  }
  return { valid: true }
}

// Minimum uzunluk kontrolü
export const validateMinLength = (value, minLength, fieldName = 'Alan') => {
  if (value && value.length < minLength) {
    return { valid: false, message: `${fieldName} en az ${minLength} karakter olmalıdır` }
  }
  return { valid: true }
}

// Maximum uzunluk kontrolü
export const validateMaxLength = (value, maxLength, fieldName = 'Alan') => {
  if (value && value.length > maxLength) {
    return { valid: false, message: `${fieldName} en fazla ${maxLength} karakter olmalıdır` }
  }
  return { valid: true }
}

// Sayısal değer aralık kontrolü
export const validateRange = (value, min, max, fieldName = 'Değer') => {
  const num = parseFloat(value)
  if (isNaN(num)) {
    return { valid: false, message: `${fieldName} sayısal bir değer olmalıdır` }
  }
  if (num < min || num > max) {
    return { valid: false, message: `${fieldName} ${min} ile ${max} arasında olmalıdır` }
  }
  return { valid: true }
}

// Tüm validasyon kurallarını çalıştır
export const runValidations = (value, rules) => {
  for (const rule of rules) {
    const result = rule(value)
    if (!result.valid) {
      return result
    }
  }
  return { valid: true }
}

// Form validasyon helper
export const validateForm = (formData, validationRules) => {
  const errors = {}
  let isValid = true

  Object.keys(validationRules).forEach((field) => {
    const rules = validationRules[field]
    const value = formData[field]
    const result = runValidations(value, rules)

    if (!result.valid) {
      errors[field] = result.message
      isValid = false
    }
  })

  return { isValid, errors }
}

export default {
  validateIP,
  validateCIDR,
  validatePort,
  validateEmail,
  validateWGKey,
  validateRequired,
  validateMinLength,
  validateMaxLength,
  validateRange,
  runValidations,
  validateForm,
}
