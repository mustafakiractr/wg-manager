/**
 * Export Utility Functions
 * Veriyi CSV ve JSON formatlarına çevirip indirme fonksiyonları
 */

// Tarihi dosya ismi için formatla
const formatDateForFilename = () => {
  const now = new Date()
  return now.toISOString().replace(/[:.]/g, '-').slice(0, -5)
}

/**
 * JSON olarak export et
 * @param {Object|Array} data - Export edilecek veri
 * @param {string} filename - Dosya adı (opsiyonel)
 */
export const exportToJSON = (data, filename) => {
  const jsonString = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const defaultFilename = `export_${formatDateForFilename()}.json`
  downloadFile(url, filename || defaultFilename)

  URL.revokeObjectURL(url)
}

/**
 * CSV olarak export et
 * @param {Array} data - Export edilecek veri (array of objects)
 * @param {string} filename - Dosya adı (opsiyonel)
 * @param {Array} columns - Sütun tanımları (opsiyonel) [{ key: 'id', label: 'ID' }]
 */
export const exportToCSV = (data, filename, columns = null) => {
  if (!data || data.length === 0) {
    console.warn('Export edilecek veri yok')
    return
  }

  // Eğer columns belirtilmemişse, ilk objenin keylerini kullan
  const cols = columns || Object.keys(data[0]).map(key => ({ key, label: key }))

  // CSV header oluştur
  const header = cols.map(col => col.label).join(',')

  // CSV rows oluştur
  const rows = data.map(row => {
    return cols.map(col => {
      let value = row[col.key]

      // Null/undefined kontrolü
      if (value === null || value === undefined) {
        value = ''
      }

      // Object veya array ise stringify et
      if (typeof value === 'object') {
        value = JSON.stringify(value)
      }

      // String ise escape et
      value = String(value)

      // Virgül, tırnak veya yeni satır içeriyorsa çift tırnak içine al
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        value = `"${value.replace(/"/g, '""')}"`
      }

      return value
    }).join(',')
  })

  const csvContent = [header, ...rows].join('\n')

  // BOM (Byte Order Mark) ekle - Excel'de Türkçe karakter desteği için
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const defaultFilename = `export_${formatDateForFilename()}.csv`
  downloadFile(url, filename || defaultFilename)

  URL.revokeObjectURL(url)
}

/**
 * Dosya indir
 * @param {string} url - Blob URL
 * @param {string} filename - Dosya adı
 */
const downloadFile = (url, filename) => {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * WireGuard peer listesini CSV olarak export et
 * @param {Array} peers - Peer listesi
 * @param {string} interfaceName - Interface adı
 */
export const exportPeersToCSV = (peers, interfaceName = 'wireguard') => {
  const columns = [
    { key: 'id', label: 'Peer ID' },
    { key: 'comment', label: 'İsim' },
    { key: 'public_key', label: 'Public Key' },
    { key: 'allowed_address', label: 'Allowed Address' },
    { key: 'endpoint_address', label: 'Endpoint' },
    { key: 'endpoint_port', label: 'Port' },
    { key: 'current_endpoint_address', label: 'Güncel Endpoint' },
    { key: 'current_endpoint_port', label: 'Güncel Port' },
    { key: 'rx', label: 'RX (bytes)' },
    { key: 'tx', label: 'TX (bytes)' },
    { key: 'last_handshake', label: 'Son Handshake' },
  ]

  const filename = `wireguard_peers_${interfaceName}_${formatDateForFilename()}.csv`
  exportToCSV(peers, filename, columns)
}

/**
 * Trafik verilerini CSV olarak export et
 * @param {Array} trafficData - Trafik verileri
 * @param {string} period - Periyot (hourly, daily, monthly)
 */
export const exportTrafficToCSV = (trafficData, period = 'daily') => {
  const columns = [
    { key: 'timestamp', label: 'Tarih/Saat' },
    { key: 'rx_bytes', label: 'İndirilen (bytes)' },
    { key: 'tx_bytes', label: 'Yüklenen (bytes)' },
    { key: 'total_bytes', label: 'Toplam (bytes)' },
  ]

  const filename = `traffic_${period}_${formatDateForFilename()}.csv`
  exportToCSV(trafficData, filename, columns)
}

/**
 * Log kayıtlarını CSV olarak export et
 * @param {Array} logs - Log kayıtları
 */
export const exportLogsToCSV = (logs) => {
  const columns = [
    { key: 'timestamp', label: 'Tarih/Saat' },
    { key: 'action', label: 'İşlem' },
    { key: 'user', label: 'Kullanıcı' },
    { key: 'details', label: 'Detay' },
    { key: 'success', label: 'Başarılı' },
  ]

  const filename = `logs_${formatDateForFilename()}.csv`
  exportToCSV(logs, filename, columns)
}

/**
 * WireGuard konfigürasyonunu JSON olarak export et
 * @param {Object} config - Konfigürasyon
 */
export const exportConfigToJSON = (config) => {
  const filename = `wireguard_config_${formatDateForFilename()}.json`
  exportToJSON(config, filename)
}

export default {
  exportToJSON,
  exportToCSV,
  exportPeersToCSV,
  exportTrafficToCSV,
  exportLogsToCSV,
  exportConfigToJSON,
}
