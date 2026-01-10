/**
 * WireGuard Interface detay sayfası
 * Interface'e ait peer'ları listeler ve yönetir
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getInterface,
  getPeers,
  addPeer,
  updatePeer,
  deletePeer,
  getPeerQRCode,
  toggleInterface,
  togglePeer,
  generateKeys,
} from '../services/wireguardService'
import api from '../services/api'
import {
  getAllTemplates,
  previewTemplate,
} from '../services/peerTemplateService'
import {
  getAllPeerMetadata,
  setPeerExpiry,
  updatePeerMetadata,
} from '../services/peerMetadataService'
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  QrCode,
  Power,
  RefreshCw,
  Copy,
  Check,
  Search,
  Filter,
  Users,
  UserCheck,
  UserX,
  Settings,
  X,
  Eye,
  EyeOff,
  Download,
  FileText,
  Layers,
  CheckCircle,
  Save,
  Database,
  Clock,
  Calendar,
  Tag,
} from 'lucide-react'

function WireGuardInterfaceDetail() {
  const { interfaceName } = useParams()
  const navigate = useNavigate()
  const [interfaceData, setInterfaceData] = useState(null)
  const [peers, setPeers] = useState([])
  const [peerPrivateKeys, setPeerPrivateKeys] = useState({}) // Peer ID -> Private Key mapping (MikroTik'te saklanmaz)
  const [loading, setLoading] = useState(true)
  const [addingPeer, setAddingPeer] = useState(false) // Peer ekleme loading state'i
  const [showAddModal, setShowAddModal] = useState(false)
  const [allowedIPs, setAllowedIPs] = useState([]) // Düzenleme için allowed IP listesi
  const [newIP, setNewIP] = useState('') // Yeni eklenecek IP
  const [showQRModal, setShowQRModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [qrData, setQrData] = useState(null)
  const [configData, setConfigData] = useState(null)
  const [editingPeer, setEditingPeer] = useState(null)
  const [copied, setCopied] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // 'all', 'active', 'inactive', 'online'
  const [filterGroup, setFilterGroup] = useState('all') // 'all' veya grup adı
  const [filterTag, setFilterTag] = useState('') // Etiket filtresi
  const [togglingPeer, setTogglingPeer] = useState(null)

  // Import modal state'leri
  const [showImportModal, setShowImportModal] = useState(false)
  const [importingPeer, setImportingPeer] = useState(null)
  const [importPrivateKey, setImportPrivateKey] = useState('')
  const [importing, setImporting] = useState(false)
  const [importSelectedTemplate, setImportSelectedTemplate] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    private_key: '',
    public_key: '',
    allowed_address: '',
    comment: '',
    persistent_keepalive: '',
    dns: '',
    endpoint_allowed_address: '',
    endpoint_address: '',
    endpoint_port: '',
    preshared_key: '',
    mtu: '',
    expires_at: '',  // Son kullanma tarihi (ISO format)
    expiry_action: 'disable',  // 'disable', 'delete', 'notify_only'
    // Grup ve Etiketleme
    group_name: '',
    group_color: '#6366F1',  // Varsayılan renk (indigo)
    tags: '',
    notes: '',
  })
  
  // Toplu ekleme modu
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkCount, setBulkCount] = useState(1)
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Toplu işlemler için seçili peer'lar
  const [selectedPeers, setSelectedPeers] = useState(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)

  // IP Pool state'leri
  const [poolInfo, setPoolInfo] = useState(null)
  const [loadingPool, setLoadingPool] = useState(false)

  // Template yönetimi için
  const [availableTemplates, setAvailableTemplates] = useState([]) // Mevcut şablonlar
  const [selectedTemplate, setSelectedTemplate] = useState(null) // Seçili şablon

  // Verileri yükle - useCallback ile optimize edildi
  // Peer data normalize fonksiyonu - Memoize edildi (performans)
  const normalizePeerData = useCallback((peer) => {
    const peerId = peer['.id'] || peer.id || peer['*1'] || `peer-${Date.now()}-${Math.random()}`

    let disabled = peer.disabled
    if (disabled === undefined || disabled === null) {
      disabled = false
    } else if (typeof disabled === 'string') {
      disabled = disabled.toLowerCase() === 'true'
    } else {
      disabled = Boolean(disabled)
    }

    // saved_in_db kontrolü - undefined ise false kabul et
    const savedInDb = peer.saved_in_db === true

    return {
      ...peer,
      '.id': peerId,
      disabled: disabled,
      saved_in_db: savedInDb
    }
  }, [])

  const loadData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true)
      }
      const [ifaceRes, peersRes, metadataRes] = await Promise.all([
        getInterface(interfaceName),
        getPeers(interfaceName),
        getAllPeerMetadata(interfaceName).catch(() => []), // Metadata yoksa boş array döndür
      ])
      setInterfaceData(ifaceRes)

      // Metadata'yı peer_id'ye göre indeksle
      const metadataMap = {}
      if (Array.isArray(metadataRes)) {
        metadataRes.forEach(meta => {
          if (meta.peer_id) {
            metadataMap[meta.peer_id] = meta
          }
        })
      }

      // Peer data'yı normalize et ve metadata ile birleştir
      const peersData = (peersRes || []).map(peer => {
        const normalizedPeer = normalizePeerData(peer)
        const peerId = normalizedPeer.id || normalizedPeer['.id']
        
        // Metadata varsa peer'a ekle
        if (peerId && metadataMap[peerId]) {
          const meta = metadataMap[peerId]
          normalizedPeer.expires_at = meta.expires_at
          normalizedPeer.expiry_action = meta.expiry_action
          normalizedPeer.group_name = meta.group_name
          normalizedPeer.group_color = meta.group_color
          normalizedPeer.tags = meta.tags
          normalizedPeer.notes = meta.notes
        }
        
        return normalizedPeer
      })
      setPeers(peersData)
    } catch (error) {
      console.error('Veri yükleme hatası:', error)
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || error.message.includes('Network')) {
        console.warn('⚠️ Network hatası - Veri yüklenemedi.')
      }
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }, [interfaceName, normalizePeerData])

  // Şablonları yükle
  const loadTemplates = async () => {
    try {
      const templates = await getAllTemplates(true) // Sadece aktif şablonlar
      setAvailableTemplates(templates)
      console.log('✅ Şablonlar yüklendi:', templates.length)
    } catch (error) {
      console.error('Şablon yükleme hatası:', error)
    }
  }

  useEffect(() => {
    loadData() // İlk yükleme
    
    // Auto-refresh 60 saniyeye çıkarıldı (performans optimizasyonu)
    // Sadece sayfa görünürken refresh yap
    let interval = null
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Sayfa gizlendiğinde interval'ı temizle
        if (interval) {
          clearInterval(interval)
          interval = null
        }
      } else {
        // Sayfa görünür hale geldiğinde interval'ı başlat
        if (!interval) {
          loadData(false) // Hemen bir kez yükle (loading gösterme)
          interval = setInterval(() => loadData(false), 60000) // 60 saniyede bir refresh
        }
      }
    }
    
    // Sayfa görünürlük değişikliğini dinle
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // İlk interval'ı başlat - 60 saniye
    interval = setInterval(() => loadData(false), 60000)
    
    return () => {
      if (interval) {
        clearInterval(interval)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadData])

  // Modal açıldığında şablonları yükle
  useEffect(() => {
    if (showAddModal || showImportModal || editingPeer) {
      loadTemplates()
    }
  }, [showAddModal, showImportModal, editingPeer])

  // IP adresi validasyonu - useCallback ile optimize edildi
  const validateIP = useCallback((ip) => {
    if (!ip) return false

    // Virgülle ayrılmış birden fazla IP desteği
    const addresses = ip.split(',').map(addr => addr.trim())

    // Her IP adresini ayrı ayrı doğrula
    for (const addr of addresses) {
      // CIDR formatı kontrolü (örn: 192.168.1.1/32 veya 192.168.1.0/24)
      const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
      if (!cidrRegex.test(addr)) return false

      const parts = addr.split('/')
      const ipParts = parts[0].split('.')

      // IP adresi kontrolü
      for (let part of ipParts) {
        const num = parseInt(part)
        if (num < 0 || num > 255) return false
      }

      // CIDR kontrolü
      if (parts.length === 2) {
        const cidr = parseInt(parts[1])
        if (cidr < 0 || cidr > 32) return false
      }
    }

    return true
  }, [])

  // Sonraki IP adresini hesapla - useCallback ile optimize edildi
  const getNextIP = useCallback((currentIP) => {
    if (!currentIP) return '10.0.0.2/32'
    
    // Mevcut peer'ların IP'lerini al
    const ips = peers
      .map(p => p['allowed-address'])
      .filter(ip => ip && validateIP(ip))
      .map(ip => {
        const [ipPart, cidr] = ip.split('/')
        const parts = ipPart.split('.').map(Number)
        return { parts, cidr: cidr || '32' }
      })
      .sort((a, b) => {
        for (let i = 0; i < 4; i++) {
          if (a.parts[i] !== b.parts[i]) return a.parts[i] - b.parts[i]
        }
        return 0
      })
    
    if (ips.length === 0) return '10.0.0.2/32'
    
    // Son IP'yi al ve bir artır
    const lastIP = ips[ips.length - 1]
    const newParts = [...lastIP.parts]
    
    // Son okteti artır
    newParts[3]++
    if (newParts[3] > 255) {
      newParts[3] = 2
      newParts[2]++
      if (newParts[2] > 255) {
        newParts[2] = 0
        newParts[1]++
        if (newParts[1] > 255) {
          newParts[1] = 0
          newParts[0]++
        }
      }
    }
    
    return `${newParts.join('.')}/${lastIP.cidr}`
  }, [peers, validateIP])

  // MikroTik'ten gelen zaman formatını parse et ve saniyeye çevir
  const parseMikroTikTime = useCallback((timeStr) => {
    if (!timeStr || timeStr === '0' || timeStr === '' || timeStr === 'never' || timeStr === '0s') {
      return null
    }

    timeStr = String(timeStr).trim()

    // "5m50s" formatı
    const minutesSecondsMatch = timeStr.match(/^(\d+)m\s*(\d+)s$/)
    if (minutesSecondsMatch) {
      return parseInt(minutesSecondsMatch[1]) * 60 + parseInt(minutesSecondsMatch[2])
    }

    // "2h30m" formatı
    const hoursMinutesMatch = timeStr.match(/^(\d+)h\s*(\d+)m$/)
    if (hoursMinutesMatch) {
      return parseInt(hoursMinutesMatch[1]) * 3600 + parseInt(hoursMinutesMatch[2]) * 60
    }

    // Basit format (örn: "20s", "5m", "2h", "1d")
    const relativeTimeMatch = timeStr.match(/^(\d+)([smhd])$/)
    if (relativeTimeMatch) {
      const value = parseInt(relativeTimeMatch[1])
      const unit = relativeTimeMatch[2]

      switch (unit) {
        case 's': return value
        case 'm': return value * 60
        case 'h': return value * 3600
        case 'd': return value * 86400
        default: return null
      }
    }

    return null
  }, [])

  // Peer'ın online olup olmadığını kontrol et
  const isPeerOnline = useCallback((peer) => {
    if (peer.disabled) return false

    const lastHandshake = peer['last-handshake'] || peer['last-handshake-time'] || peer.lastHandshake
    if (!lastHandshake || lastHandshake === '0' || lastHandshake === '' || lastHandshake === 'never' || lastHandshake === '0s') {
      return false
    }

    const diffSec = parseMikroTikTime(lastHandshake)
    if (diffSec === null || diffSec < 0) return false

    // 90 saniyeden fazla süre geçtiyse offline
    return diffSec < 90
  }, [parseMikroTikTime])

  // Peer ekle
  const handleAddPeer = async (e) => {
    e.preventDefault()
    
    // Validasyon
    if (!formData.public_key.trim()) {
      alert('Genel Anahtar (Public Key) zorunludur')
      return
    }

    if (!formData.allowed_address.trim()) {
      alert('İzin Verilen IP Adresleri zorunludur')
      return
    }

    setAddingPeer(true)

    // "auto" değeri varsa IP Pool'dan IP al
    let finalIP = formData.allowed_address.trim()
    if (finalIP.toLowerCase() === 'auto') {
      try {
        const nextIP = await fetchNextAvailableIP()
        if (!nextIP) {
          setAddingPeer(false)
          alert('IP Pool\'dan IP alınamadı. Lütfen manuel IP girin.')
          return
        }
        finalIP = nextIP
      } catch (error) {
        setAddingPeer(false)
        alert('IP Pool\'dan IP alınırken hata oluştu: ' + error.message)
        return
      }
    }

    if (!validateIP(finalIP)) {
      setAddingPeer(false)
      alert('Geçersiz IP adresi formatı. Örnek: 192.168.1.1/32')
      return
    }

    // Public key duplicate kontrolü (performans için ön kontrol)
    const publicKeyTrimmed = formData.public_key.trim()
    const existingPeer = peers.find(p => {
      const existingPublicKey = p['public-key'] || p.public_key
      return existingPublicKey && existingPublicKey.trim() === publicKeyTrimmed
    })
    
    if (existingPeer) {
      const peerId = existingPeer['.id'] || existingPeer.id || 'N/A'
      const peerComment = existingPeer.comment || existingPeer.name || 'N/A'
      if (!confirm(`⚠️ Bu public key ile peer zaten mevcut!\n\nPeer ID: ${peerId}\nComment: ${peerComment}\n\nYine de eklemek istiyor musunuz?`)) {
        return
      }
    }
    
    // Peer data hazırlama
    const peerData = {
      interface: interfaceName,
      public_key: formData.public_key.trim(),
      allowed_address: finalIP,
      comment: formData.comment.trim() || (formData.name.trim() || undefined),
      persistent_keepalive: formData.persistent_keepalive.trim() || undefined,
    }
    
    // Advanced options
    if (formData.dns.trim()) peerData.dns = formData.dns.trim()
    // Endpoint'e Erişim İçin İzin Verilen IP Adresleri - varsayılan 192.168.46.1/32
    if (formData.endpoint_allowed_address.trim()) {
      peerData.endpoint_allowed_address = formData.endpoint_allowed_address.trim()
    } else {
      peerData.endpoint_allowed_address = "192.168.46.1/32"
    }
    if (formData.endpoint_address.trim()) peerData.endpoint_address = formData.endpoint_address.trim()
    if (formData.endpoint_port) peerData.endpoint_port = parseInt(formData.endpoint_port)
    if (formData.preshared_key.trim()) peerData.preshared_key = formData.preshared_key.trim()
    if (formData.mtu) peerData.mtu = parseInt(formData.mtu)
    
    // Private key kontrolü - QR kod ve config için gerekli
    if (!formData.private_key || !formData.private_key.trim()) {
      const confirmGenerate = confirm('Özel Anahtar (Private Key) girilmedi. QR kod ve config dosyası oluşturmak için private key gereklidir.\n\nOtomatik olarak oluşturulsun mu?')
      if (confirmGenerate) {
        await handleGenerateKeys()
        // Anahtarlar oluşturulduktan sonra tekrar dene
        if (!formData.private_key || !formData.private_key.trim()) {
          setAddingPeer(false)
          alert('Private key oluşturulamadı. Lütfen manuel olarak girin.')
          return
        }
      } else {
        alert('Private key girilmedi. Peer eklenecek ancak QR kod ve config dosyası oluşturulamayacak.')
      }
    }

    // Private key'i mutlaka ekle (QR kod ve config için gerekli)
    if (formData.private_key && formData.private_key.trim()) {
      peerData.private_key = formData.private_key.trim()
      console.log('📤 Peer eklenirken private key gönderiliyor (veritabanına kaydedilecek):', {
        private_key_length: peerData.private_key.length,
        public_key_preview: peerData.public_key.substring(0, 20) + '...'
      })
    }
    
    // Template ID ekle (kullanım istatistikleri için)
    if (selectedTemplate) {
      peerData.template_id = selectedTemplate.id
      console.log('📊 Template kullanıldı, ID backend\'e gönderiliyor:', selectedTemplate.id)
    }

    // Expiry bilgilerini ekle (son kullanma tarihi)
    let expiryData = null
    if (formData.expires_at) {
      expiryData = {
        expires_at: new Date(formData.expires_at).toISOString(),
        expiry_action: formData.expiry_action || 'disable'
      }
      console.log('⏰ Expiry bilgisi backend\'e gönderilecek:', expiryData)
    }

    // Debug: Gönderilecek peerData'yı logla
    console.log('📤 Gönderilecek peerData:', {
      interface: peerData.interface,
      public_key: peerData.public_key.substring(0, 20) + '...',
      private_key: peerData.private_key ? peerData.private_key.substring(0, 20) + '...' : 'YOK',
      allowed_address: peerData.allowed_address,
      template_id: peerData.template_id || 'YOK',
      expiry: expiryData || 'YOK'
    })

    try {
        const response = await addPeer(peerData)
        
        // Başarılı yanıt kontrolü
        if (response.success) {
          setShowAddModal(false)
          resetForm()
          
          // Performans optimizasyonu: Tüm listeyi yeniden çekmek yerine, sadece eklenen peer'ı ekle
          // Cache temizlendiği için bir sonraki çağrıda güncel veri gelecek
          // Şimdilik sadece cache'i temizlemek için bir kez çekiyoruz (cache otomatik temizleniyor)
          // Ancak UI'ı güncellemek için eklenen peer'ı direkt ekleyebiliriz
          if (response.data) {
            const newPeer = response.data
            const peerId = newPeer['.id'] || newPeer.id || newPeer['*1'] || `peer-${Date.now()}-${Math.random()}`
            let disabled = newPeer.disabled
            if (disabled === undefined || disabled === null) {
              disabled = false
            } else if (typeof disabled === 'string') {
              disabled = disabled.toLowerCase() === 'true'
            } else if (typeof disabled === 'boolean') {
              disabled = disabled
            } else {
              disabled = Boolean(disabled)
            }
            
            // Private key'i sakla (MikroTik'te saklanmaz, sadece config dosyası için)
            if (response.private_key) {
              setPeerPrivateKeys(prev => ({
                ...prev,
                [peerId]: response.private_key
              }))
            }
            
            // Expiry bilgisini kaydet (peer eklendikten sonra)
            if (expiryData && peerId) {
              try {
                await setPeerExpiry(
                  peerId,
                  interfaceName,
                  expiryData.expires_at,
                  expiryData.expiry_action
                )
                console.log('✅ Expiry bilgisi kaydedildi:', expiryData)
              } catch (expiryError) {
                console.error('⚠️ Expiry bilgisi kaydedilemedi:', expiryError)
                // Peer ekleme başarılı, sadece expiry kaydedilemedi - uyarı göster
                console.warn('Peer eklendi ancak son kullanma tarihi kaydedilemedi')
              }
            }
            
            // Grup/Etiket/Notlar bilgilerini kaydet (peer eklendikten sonra)
            if ((formData.group_name || formData.tags || formData.notes) && peerId) {
              try {
                await updatePeerMetadata(peerId, interfaceName, {
                  group_name: formData.group_name || null,
                  group_color: formData.group_color || '#6366F1',
                  tags: formData.tags || null,
                  notes: formData.notes || null,
                })
                console.log('✅ Grup/Etiket/Notlar kaydedildi:', {
                  group_name: formData.group_name,
                  tags: formData.tags,
                  notes: formData.notes?.substring(0, 50) + '...'
                })
              } catch (metadataError) {
                console.error('⚠️ Grup/Etiket/Notlar kaydedilemedi:', metadataError)
                // Peer ekleme başarılı, sadece metadata kaydedilemedi
                console.warn('Peer eklendi ancak grup/etiket bilgileri kaydedilemedi')
              }
            }
            
            // Yeni peer'ı listeye ekle (performans için tüm listeyi yeniden çekmek yerine)
            setPeers(prevPeers => {
              // Aynı peer zaten varsa ekleme (duplicate kontrolü)
              const existingPeer = prevPeers.find(p => {
                const pId = p['.id'] || p.id || p['*1']
                return pId === peerId
              })
              if (existingPeer) {
                return prevPeers // Zaten varsa değişiklik yapma
              }
              // Yeni peer'ı başa ekle
              return [{ ...newPeer, '.id': peerId, disabled }, ...prevPeers]
            })
          } else {
            // Yanıtta peer data yoksa, sadece cache'i temizlemek için bir kez çek
            // Cache otomatik temizlendiği için bu hızlı olacak
            const peersRes = await getPeers(interfaceName)
            const peersData = (peersRes.data || []).map(peer => {
              const peerId = peer['.id'] || peer.id || peer['*1'] || `peer-${Date.now()}-${Math.random()}`
              let disabled = peer.disabled
              if (disabled === undefined || disabled === null) {
                disabled = false
              } else if (typeof disabled === 'string') {
                disabled = disabled.toLowerCase() === 'true'
              } else if (typeof disabled === 'boolean') {
                disabled = disabled
              } else {
                disabled = Boolean(disabled)
              }
              return { ...peer, '.id': peerId, disabled }
            })
            setPeers(peersData)
          }
        }
      } catch (error) {
      // Hata mesajını daha anlaşılır hale getir
      let errorMessage = 'Peer eklenemedi: '
      
      // Network Error kontrolü
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || error.message.includes('Network')) {
        errorMessage = 'Bağlantı hatası: Backend sunucusuna erişilemiyor.\n\n'
        errorMessage += 'Lütfen kontrol edin:\n'
        errorMessage += '1. Backend sunucusu çalışıyor mu?\n'
        errorMessage += '2. API URL doğru mu?\n'
        errorMessage += '3. CORS ayarları doğru mu?\n'
        errorMessage += `\nAPI URL: ${error.config?.baseURL || 'Bilinmiyor'}`
        alert('❌ ' + errorMessage)
        console.error('Network Error detayları:', {
          code: error.code,
          message: error.message,
          config: error.config,
          request: error.request
        })
        return
      }
      
      if (error.response?.data?.detail) {
        errorMessage += error.response.data.detail
      } else if (error.response?.data?.message) {
        errorMessage += error.response.data.message
      } else if (error.message) {
        errorMessage += error.message
      } else {
        errorMessage += 'Bilinmeyen hata'
      }
      
      // "entry already exists" hatasını özel olarak işle
      if (errorMessage.includes('already exists') || errorMessage.includes('zaten mevcut')) {
        alert('⚠️ ' + errorMessage + '\n\nLütfen farklı bir public key kullanın veya mevcut peer\'ı kontrol edin.')
      } else if (error.response?.status === 503) {
        // Service Unavailable - MikroTik bağlantı sorunu
        alert('❌ ' + errorMessage + '\n\nMikroTik router\'a bağlanılamıyor. Lütfen bağlantı ayarlarını kontrol edin.')
      } else {
        alert('❌ ' + errorMessage)
      }
      console.error('Peer ekleme hatası:', error)
      console.error('Hata detayları:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: error.config,
        code: error.code,
        message: error.message,
        request: error.request
      })
    } finally {
      setAddingPeer(false)
    }
  }

  // Toplu peer ekle
  const handleBulkAdd = async () => {
    if (!formData.public_key.trim()) {
      alert('Genel Anahtar (Public Key) zorunludur')
      return
    }

    if (!formData.allowed_address.trim()) {
      alert('İzin Verilen IP Adresleri zorunludur')
      return
    }

    setAddingPeer(true)

    // "auto" değeri varsa IP Pool'dan IP al
    let finalIP = formData.allowed_address.trim()
    if (finalIP.toLowerCase() === 'auto') {
      try {
        const nextIP = await fetchNextAvailableIP()
        if (!nextIP) {
          setAddingPeer(false)
          alert('IP Pool\'dan IP alınamadı. Lütfen manuel IP girin.')
          return
        }
        finalIP = nextIP
      } catch (error) {
        setAddingPeer(false)
        alert('IP Pool\'dan IP alınırken hata oluştu: ' + error.message)
        return
      }
    }

    if (!validateIP(finalIP)) {
      setAddingPeer(false)
      alert('Geçersiz IP adresi formatı. Örnek: 192.168.1.1/32')
      return
    }
    
    // NOT: Toplu eklemede aynı public key kullanılıyor, bu bir güvenlik sorunu olabilir
    // Gelecekte her peer için farklı anahtar çifti oluşturulmalı
    const publicKeyTrimmed = formData.public_key.trim()
    const existingPeer = peers.find(p => {
      const existingPublicKey = p['public-key'] || p.public_key
      return existingPublicKey && existingPublicKey.trim() === publicKeyTrimmed
    })
    
    if (existingPeer) {
      const peerId = existingPeer['.id'] || existingPeer.id || 'N/A'
      const peerComment = existingPeer.comment || existingPeer.name || 'N/A'
      if (!confirm(`⚠️ Bu public key ile peer zaten mevcut!\n\nPeer ID: ${peerId}\nComment: ${peerComment}\n\nToplu eklemede aynı public key kullanılacak. Devam etmek istiyor musunuz?`)) {
        return
      }
    }
    
    try {
      let currentIP = finalIP
      const baseName = formData.name.trim() || 'peer'

      for (let i = 0; i < bulkCount; i++) {
          // Her peer için yeni key çifti oluştur (toplu eklemede)
          let peerPublicKey = formData.public_key.trim()
          let peerPrivateKey = formData.private_key ? formData.private_key.trim() : null

          // Eğer private key yoksa veya ilk peer ise yeni key çifti oluştur
          if (!peerPrivateKey || i === 0) {
            try {
              const keyResult = await generateKeys()
              if (keyResult.success && keyResult.private_key && keyResult.public_key) {
                peerPrivateKey = keyResult.private_key.trim()
                peerPublicKey = keyResult.public_key.trim()
                console.log(`🔑 Peer ${i + 1} için anahtarlar oluşturuldu`)
              }
            } catch (keyError) {
              console.error(`Anahtar oluşturma hatası (peer ${i + 1}):`, keyError)
              // Hata olursa mevcut key'leri kullan
            }
          }

          const peerData = {
            interface: interfaceName,
            public_key: peerPublicKey,
            allowed_address: currentIP,
            comment: `${baseName}-${i + 1}`,
            persistent_keepalive: formData.persistent_keepalive.trim() || undefined,
          }

          // Private key'i mutlaka ekle (QR kod ve config için gerekli)
          if (peerPrivateKey && peerPrivateKey.trim()) {
            peerData.private_key = peerPrivateKey.trim()
          }

          // Advanced options
          if (formData.dns.trim()) peerData.dns = formData.dns.trim()
          // Endpoint'e Erişim İçin İzin Verilen IP Adresleri - varsayılan 192.168.46.1/32
          if (formData.endpoint_allowed_address.trim()) {
            peerData.endpoint_allowed_address = formData.endpoint_allowed_address.trim()
          } else {
            peerData.endpoint_allowed_address = "192.168.46.1/32"
          }
          if (formData.endpoint_address.trim()) peerData.endpoint_address = formData.endpoint_address.trim()
          if (formData.endpoint_port) peerData.endpoint_port = parseInt(formData.endpoint_port)
          if (formData.preshared_key.trim()) peerData.preshared_key = formData.preshared_key.trim()
          if (formData.mtu) peerData.mtu = parseInt(formData.mtu)

          // Template ID ekle (kullanım istatistikleri için)
          if (selectedTemplate) {
            peerData.template_id = selectedTemplate.id
          }

        const response = await addPeer(peerData)
        
        // Başarılı eklenen peer'ları topla (performans için)
        if (response.success && response.data) {
          const newPeer = response.data
          const peerId = newPeer['.id'] || newPeer.id || newPeer['*1'] || `peer-${Date.now()}-${Math.random()}`
          let disabled = newPeer.disabled
          if (disabled === undefined || disabled === null) {
            disabled = false
          } else if (typeof disabled === 'string') {
            disabled = disabled.toLowerCase() === 'true'
          } else if (typeof disabled === 'boolean') {
            disabled = disabled
          } else {
            disabled = Boolean(disabled)
          }
          
          // Yeni peer'ı listeye ekle
          setPeers(prevPeers => {
            const existingPeer = prevPeers.find(p => {
              const pId = p['.id'] || p.id || p['*1']
              return pId === peerId
            })
            if (existingPeer) {
              return prevPeers
            }
            return [{ ...newPeer, '.id': peerId, disabled }, ...prevPeers]
          })
        }
        
        // Sonraki IP'yi hesapla
        currentIP = getNextIP(currentIP)
      }
      
      setShowAddModal(false)
      resetForm()
      // Cache temizlendiği için liste zaten güncel, sadece başarı mesajı göster
      alert(`${bulkCount} peer başarıyla eklendi!`)
    } catch (error) {
      alert('Toplu ekleme hatası: ' + (error.response?.data?.detail || error.message))
    } finally {
      setAddingPeer(false)
    }
  }

  // Formu sıfırla
  const resetForm = () => {
      setFormData({
      name: '',
      private_key: '',
        public_key: '',
        allowed_address: '',
        comment: '',
        persistent_keepalive: '',
      dns: '',
      endpoint_allowed_address: '',
      endpoint_address: '',
      endpoint_port: '',
      preshared_key: '',
      mtu: '',
      expires_at: '',
      expiry_action: 'disable',
      // Grup ve Etiketleme
      group_name: '',
      group_color: '#6366F1',
      tags: '',
      notes: '',
    })
    setBulkMode(false)
    setBulkCount(1)
    setShowPrivateKey(false)
    setShowAdvanced(false)
    setSelectedTemplate(null)
  }

  // Şablon seçildiğinde formu doldur
  const handleTemplateSelect = async (templateId) => {
    if (!templateId) {
      setSelectedTemplate(null)
      return
    }

    try {
      const template = availableTemplates.find(t => t.id === parseInt(templateId))
      setSelectedTemplate(template)

      // Template verilerini forma doldur
      const preview = await previewTemplate(templateId)
      const peerData = preview.peer_data

      setFormData(prev => ({
        ...prev,
        allowed_address: peerData.allowed_address || '',
        persistent_keepalive: peerData.persistent_keepalive || '',
        preshared_key: peerData.preshared_key || '',
        dns: peerData.dns || '',
        endpoint_allowed_address: peerData.endpoint_allowed_address || '',
        endpoint_address: template.endpoint_address || '',
        endpoint_port: template.endpoint_port || '',
        mtu: peerData.mtu || '',
      }))

      alert(`"${template.name}" şablonu seçildi. Formu kontrol edip gerekirse değişiklik yapabilirsiniz.`)
    } catch (error) {
      console.error('Şablon yükleme hatası:', error)
      alert('Şablon yüklenirken hata oluştu: ' + error.message)
    }
  }

  // Otomatik anahtar oluştur
  const handleGenerateKeys = async () => {
    try {
      console.log('🔑 Anahtar oluşturma isteği gönderiliyor...')
      const result = await generateKeys()
      
      if (result.success && result.private_key && result.public_key) {
        // State'i güncelle - anahtarları doğru şekilde set et
        setFormData(prev => ({
          ...prev,
          private_key: result.private_key.trim(), // Trim edilmiş değeri kullan
          public_key: result.public_key.trim(),   // Trim edilmiş değeri kullan
        }))
        setShowPrivateKey(true) // Anahtarları göster
        console.log('✅ Anahtarlar oluşturuldu - Private Key (ilk 20):', result.private_key.substring(0, 20) + '...')
        console.log('✅ Anahtarlar oluşturuldu - Public Key (ilk 20):', result.public_key.substring(0, 20) + '...')
        alert('Anahtarlar başarıyla oluşturuldu!')
      } else {
        alert('Anahtar oluşturma başarısız: Geçersiz yanıt')
        console.error('❌ Anahtar oluşturma yanıtı:', result)
      }
    } catch (error) {
      console.error('❌ Anahtar oluşturma hatası:', error)
      
      // Network Error kontrolü
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || error.message.includes('Network')) {
        let errorMessage = 'Bağlantı hatası: Backend sunucusuna erişilemiyor.\n\n'
        errorMessage += 'Lütfen kontrol edin:\n'
        errorMessage += '1. Backend sunucusu çalışıyor mu?\n'
        errorMessage += '2. API URL doğru mu?\n'
        errorMessage += '3. CORS ayarları doğru mu?\n'
        errorMessage += `\nAPI URL: ${error.config?.baseURL || 'Bilinmiyor'}`
        errorMessage += `\nEndpoint: ${error.config?.url || 'Bilinmiyor'}`
        alert('❌ ' + errorMessage)
        console.error('Network Error detayları:', {
          code: error.code,
          message: error.message,
          config: error.config,
          request: error.request
        })
      } else {
        // Diğer hatalar
        let errorMessage = 'Anahtar oluşturma hatası: '
        if (error.response?.data?.detail) {
          errorMessage += error.response.data.detail
        } else if (error.response?.data?.message) {
          errorMessage += error.response.data.message
        } else if (error.message) {
          errorMessage += error.message
        } else {
          errorMessage += 'Bilinmeyen hata'
        }
        alert('❌ ' + errorMessage)
        console.error('Hata detayları:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          config: error.config
        })
      }
    }
  }

  // IP Pool'dan sıradaki boş IP'yi getir
  const fetchNextAvailableIP = async () => {
    try {
      setLoadingPool(true)
      const response = await api.get(`/wg/next-available-ip/${interfaceName}`)

      if (response.data.success && response.data.has_pool) {
        setPoolInfo(response.data)

        if (response.data.next_ip) {
          console.log('✅ IP Pool\'dan IP alındı:', response.data.next_ip)
          return response.data.next_ip
        } else {
          console.warn('⚠️ Pool dolu, boş IP yok')
          return null
        }
      } else {
        setPoolInfo(null)
        console.log('ℹ️ Bu interface için IP pool yok')
        return null
      }
    } catch (error) {
      console.error('❌ IP pool hatası:', error)
      setPoolInfo(null)
      return null
    } finally {
      setLoadingPool(false)
    }
  }

  // Peer düzenle (MikroTik'ten fresh data çek)
  const handleEditPeer = async (peer) => {
    try {
      console.log('🔍 Peer düzenleme başladı, MikroTik\'ten fresh data çekiliyor...')
      console.log('🔍 Peer ID:', peer['.id'] || peer.id)

      // MikroTik'ten tüm peer'ları fresh çek (cache kullanma)
      const peersRes = await getPeers(interfaceName)
      const freshPeers = peersRes.data || []

      // İlgili peer'ı bul
      const peerId = peer['.id'] || peer.id
      const freshPeer = freshPeers.find(p => (p['.id'] || p.id) === peerId)

      if (!freshPeer) {
        console.error('❌ Peer bulunamadı:', peerId)
        alert('Peer bulunamadı. Lütfen sayfayı yenileyin.')
        return
      }

      console.log('✅ Fresh peer verisi alındı:', freshPeer)
      console.log('🔍 Fresh allowed-address:', freshPeer['allowed-address'])

      // Peer'ın mevcut template'ini al (database'den)
      let currentTemplateId = null
      try {
        const templateResponse = await api.get(`/wg/peer/${peerId}/template?interface=${interfaceName}`)
        currentTemplateId = templateResponse.data?.template_id || null
        console.log('📋 Peer template bilgisi:', currentTemplateId)
      } catch (templateErr) {
        console.log('⚠️ Peer template bilgisi alınamadı (normal, import edilmiş peer olabilir):', templateErr)
      }

      // Allowed address'leri parse et
      const allowedAddressStr = freshPeer['allowed-address'] || ''
      const ips = allowedAddressStr
        .split(',')
        .map(ip => ip.trim())
        .filter(ip => ip.length > 0)

      setAllowedIPs(ips)
      setNewIP('')

      const editData = {
        ...freshPeer,
        // MikroTik'ten gelen tire içeren anahtarları alt tire ile normalize et
        allowed_address: freshPeer['allowed-address'] || '',
        persistent_keepalive: freshPeer['persistent-keepalive'] || '',
        comment: freshPeer.comment || '',
        disabled: freshPeer.disabled || false,
        name: freshPeer.name || '',
        template_id: currentTemplateId,  // Template ID'yi ekle
        private_key: '',  // Private key başlangıçta boş, kullanıcı isterse dolduracak
        // Grup ve Etiket bilgileri (peers state'inden al - loadData'da merge edildi)
        group_name: peer.group_name || '',
        group_color: peer.group_color || '#6366F1',
        tags: peer.tags || '',
        notes: peer.notes || '',
        // Expiry bilgileri (peers state'inden al - loadData'da merge edildi)
        expires_at: peer.expires_at ? new Date(peer.expires_at).toISOString().slice(0, 16) : '',
        expiry_action: peer.expiry_action || 'disable',
      }
      
      // Database'den private key'i al (eğer kayıtlıysa)
      try {
        const peerKeyResponse = await api.get(`/wg/peer/${peerId}/private-key?interface=${interfaceName}`)
        if (peerKeyResponse.data && peerKeyResponse.data.private_key) {
          editData.private_key = peerKeyResponse.data.private_key
          console.log('✅ Private key database\'den alındı')
        }
      } catch (error) {
        console.log('ℹ️ Private key database\'de bulunamadı (yeni peer için normal)')
      }
      
      console.log('🔍 Normalize edilmiş editData:', editData)
      console.log('🔍 Parsed allowed IPs:', ips)
      setEditingPeer(editData)
    } catch (error) {
      console.error('❌ Peer düzenleme hatası:', error)
      alert('Peer bilgileri alınamadı: ' + (error.response?.data?.detail || error.message))
    }
  }

  // Peer güncelle
  const handleUpdatePeer = async (peerId) => {
    // Peer ID kontrolü
    if (!peerId || peerId === 'undefined' || peerId === 'null' || peerId === undefined || peerId === null) {
      alert('Peer ID bulunamadı. Lütfen sayfayı yenileyin.')
      console.error('Peer ID:', peerId, 'editingPeer:', editingPeer)
      return
    }

    // Allowed IPs'leri birleştir
    const combinedAllowedAddress = allowedIPs.join(', ')

    // Allowed address validasyonu
    if (combinedAllowedAddress && !validateIP(combinedAllowedAddress)) {
      alert('⚠️ Geçersiz IP adresi formatı!\n\nLütfen geçerli bir IP/CIDR formatı girin.\nÖrnek: 192.168.1.1/32 veya 192.168.1.1/32, 192.168.2.0/24')
      return
    }

    // Interface name kontrolü
    if (!interfaceName) {
      console.error('❌ Interface name bulunamadı! useParams():', { interfaceName })
      alert('❌ Hata: Interface adı bulunamadı. Lütfen sayfayı yenileyin.')
      return
    }

    try {
      const updateData = {
        allowed_address: combinedAllowedAddress,
        comment: editingPeer.comment,
        persistent_keepalive: editingPeer.persistent_keepalive,
        disabled: editingPeer.disabled,
        interface: interfaceName,  // Interface adını gönder (allowed_address birleştirme için)
        private_key: editingPeer.private_key || undefined,  // Private key varsa gönder
      }
      console.log('📤 Peer güncelleme - Peer ID:', peerId)
      console.log('📤 Peer güncelleme - Interface:', interfaceName)
      console.log('📤 Peer güncelleme - Allowed IPs:', allowedIPs)
      console.log('📤 Peer güncelleme - Combined allowed_address:', combinedAllowedAddress)
      console.log('📤 Peer güncelleme - Private key:', editingPeer.private_key ? 'VAR' : 'YOK')
      console.log('📤 Peer güncelleme - Gönderilen data:', updateData)

      await updatePeer(peerId, updateData)

      // Template güncelleme (eğer değiştiyse)
      try {
        const templateId = editingPeer.template_id || null
        console.log('📋 Template güncelleniyor:', templateId, 'Tip:', typeof templateId)
        
        // Query string oluştur - null ise boş string gönder
        const queryParams = new URLSearchParams({
          interface: interfaceName,
        })
        
        // template_id null değilse ekle
        if (templateId !== null) {
          queryParams.append('template_id', templateId.toString())
        }
        
        console.log('📋 Template update URL:', `/wg/peer/${peerId}/update-template?${queryParams.toString()}`)
        await api.post(`/wg/peer/${peerId}/update-template?${queryParams.toString()}`)
        console.log('✅ Template başarıyla güncellendi')
      } catch (templateError) {
        console.error('❌ Template güncellenemedi:', templateError)
        // Template hatası peer güncellemesini engellemez, sadece uyarı göster
        alert('⚠️ Peer güncellendi ancak template güncellenemedi: ' + (templateError.response?.data?.detail || 'Bilinmeyen hata'))
      }

      // Expiry güncelleme (eğer değiştiyse)
      try {
        if (editingPeer.expires_at) {
          await setPeerExpiry(
            peerId,
            interfaceName,
            new Date(editingPeer.expires_at).toISOString(),
            editingPeer.expiry_action || 'disable'
          )
          console.log('✅ Expiry başarıyla güncellendi')
        } else if (editingPeer.expires_at === '' || editingPeer.expires_at === null) {
          // Expiry kaldırıldıysa, API'den sil (eğer önceden vardıysa)
          // Şimdilik skip - removePeerExpiry kullanılabilir
          console.log('ℹ️ Expiry tarihi boş - değişiklik yapılmadı')
        }
      } catch (expiryError) {
        console.error('❌ Expiry güncellenemedi:', expiryError)
        // Expiry hatası peer güncellemesini engellemez
      }

      // Grup, etiket ve notları güncelle (metadata)
      try {
        if (editingPeer.group_name || editingPeer.tags || editingPeer.notes) {
          await updatePeerMetadata(peerId, interfaceName, {
            group_name: editingPeer.group_name || null,
            group_color: editingPeer.group_color || null,
            tags: editingPeer.tags || null,
            notes: editingPeer.notes || null
          })
          console.log('✅ Metadata (grup/etiket/not) başarıyla güncellendi')
        }
      } catch (metadataError) {
        console.error('❌ Metadata güncellenemedi:', metadataError)
        // Metadata hatası peer güncellemesini engellemez
      }

      console.log('✅ Peer başarıyla güncellendi')
      setEditingPeer(null)
      setAllowedIPs([])
      setNewIP('')
      loadData()
    } catch (error) {
      console.error('❌ Peer güncelleme hatası:', error)
      alert('Peer güncellenemedi: ' + (error.response?.data?.detail || error.message))
    }
  }

  // Peer sil
  const handleDeletePeer = async (peerId) => {
    if (!peerId || peerId === 'undefined' || peerId === 'null') {
      alert('Peer ID bulunamadı. Lütfen sayfayı yenileyin.')
      console.error('Peer ID:', peerId, 'Interface:', interfaceName)
      return
    }
    if (!confirm('Bu peer\'ı silmek istediğinizden emin misiniz?')) return

    try {
      await deletePeer(peerId, interfaceName)
      loadData()
    } catch (error) {
      console.error('Peer silme hatası:', error)
      alert('Peer silinemedi: ' + (error.response?.data?.detail || error.message))
    }
  }

  // QR kod göster
  const handleShowQR = async (peerId) => {
    if (!peerId || peerId === 'undefined' || peerId === 'null') {
      alert('Peer ID bulunamadı. Lütfen sayfayı yenileyin.')
      console.error('Peer ID:', peerId, 'Interface:', interfaceName)
      return
    }
    try {
      // Private key'i query parameter olarak gönder (MikroTik'te saklanmaz)
      const privateKey = peerPrivateKeys[peerId]
      let url = `/wg/peer/${encodeURIComponent(peerId)}/qrcode?interface=${encodeURIComponent(interfaceName)}`
      if (privateKey) {
        url += `&private_key=${encodeURIComponent(privateKey)}`
      }
      
      const response = await api.get(url)
      setQrData(response.data)
      setShowQRModal(true)
    } catch (error) {
      console.error('QR kod hatası:', error)
      alert('QR kod oluşturulamadı: ' + (error.response?.data?.detail || error.message))
    }
  }

  // Config dosyası göster/indir
  const handleShowConfig = async (peerId) => {
    if (!peerId || peerId === 'undefined' || peerId === 'null') {
      alert('Peer ID bulunamadı. Lütfen sayfayı yenileyin.')
      console.error('Peer ID:', peerId, 'Interface:', interfaceName)
      return
    }
    try {
      // Peer ID'yi encode et (URL'de özel karakterler için)
      const encodedPeerId = encodeURIComponent(peerId)
      
      // Private key'i query parameter olarak gönder (MikroTik'te saklanmaz)
      const privateKey = peerPrivateKeys[peerId]
      let url = `/wg/peer/${encodedPeerId}/config?interface=${encodeURIComponent(interfaceName)}`
      if (privateKey) {
        url += `&private_key=${encodeURIComponent(privateKey)}`
      }
      
      const response = await api.get(url)
      setConfigData(response.data)
      setShowConfigModal(true)
    } catch (error) {
      console.error('Config dosyası hatası:', error)
      
      // Network Error kontrolü
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || error.message.includes('Network')) {
        let errorMessage = 'Bağlantı hatası: Backend sunucusuna erişilemiyor.\n\n'
        errorMessage += 'Lütfen kontrol edin:\n'
        errorMessage += '1. Backend sunucusu çalışıyor mu?\n'
        errorMessage += '2. API URL doğru mu?\n'
        errorMessage += '3. CORS ayarları doğru mu?\n'
        errorMessage += `\nAPI URL: ${error.config?.baseURL || 'Bilinmiyor'}`
        errorMessage += `\nEndpoint: ${error.config?.url || 'Bilinmiyor'}`
        alert('❌ ' + errorMessage)
        console.error('Network Error detayları:', {
          code: error.code,
          message: error.message,
          config: error.config,
          request: error.request
        })
        return
      }
      
      // Timeout hatası kontrolü
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout') || error.message.includes('Timeout')) {
        let errorMessage = 'Zaman aşımı hatası: İstek çok uzun sürdü.\n\n'
        errorMessage += 'Lütfen kontrol edin:\n'
        errorMessage += '1. MikroTik router\'a bağlantı var mı?\n'
        errorMessage += '2. Network bağlantısı stabil mi?\n'
        errorMessage += '3. MikroTik API servisi çalışıyor mu?\n'
        errorMessage += `\nAPI URL: ${error.config?.baseURL || 'Bilinmiyor'}`
        errorMessage += `\nEndpoint: ${error.config?.url || 'Bilinmiyor'}`
        alert('⏱️ ' + errorMessage)
        console.error('Timeout Error detayları:', {
          code: error.code,
          message: error.message,
          config: error.config,
          request: error.request
        })
        return
      }
      
      // Diğer hatalar
      let errorMessage = 'Config dosyası alınamadı: '
      if (error.response?.data?.detail) {
        errorMessage += error.response.data.detail
      } else if (error.response?.data?.message) {
        errorMessage += error.response.data.message
      } else if (error.message) {
        errorMessage += error.message
      } else {
        errorMessage += 'Bilinmeyen hata'
      }
      
      // 503 Service Unavailable hatası için özel mesaj
      if (error.response?.status === 503) {
        errorMessage = 'MikroTik router\'a bağlanılamadı veya yanıt alınamadı.\n\n'
        errorMessage += 'Lütfen kontrol edin:\n'
        errorMessage += '1. MikroTik router çalışıyor mu?\n'
        errorMessage += '2. Bağlantı ayarları doğru mu?\n'
        errorMessage += '3. MikroTik API servisi aktif mi?\n'
        if (error.response?.data?.detail) {
          errorMessage += `\nDetay: ${error.response.data.detail}`
        }
      }
      
      alert('❌ ' + errorMessage)
      console.error('Hata detayları:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: error.config,
        code: error.code,
        message: error.message
      })
    }
  }

  // Config dosyasını indir
  const handleDownloadConfig = (config, peerName) => {
    const blob = new Blob([config], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${peerName || 'peer'}.conf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Peer import et
  const handleOpenImportModal = (peer) => {
    setImportingPeer(peer)
    setImportPrivateKey('')
    setImportSelectedTemplate('')
    setShowImportModal(true)
  }

  const handleImportPeer = async () => {
    if (!importPrivateKey.trim()) {
      alert('Lütfen private key girin')
      return
    }

    if (!importingPeer) {
      alert('İçe aktarılacak peer bulunamadı')
      return
    }

    try {
      setImporting(true)
      const peerId = importingPeer['.id'] || importingPeer.id

      const requestData = {
        peer_id: peerId,
        interface_name: interfaceName,
        private_key: importPrivateKey.trim()
      }

      // Template seçildi mi?
      if (importSelectedTemplate) {
        requestData.template_id = parseInt(importSelectedTemplate)
      }

      const response = await api.post('/wg/peer/import', requestData)

      if (response.data.success) {
        alert('Peer başarıyla kaydedildi!')
        setShowImportModal(false)
        setImportingPeer(null)
        setImportPrivateKey('')
        setImportSelectedTemplate('')
        // Peer listesini yenile
        await loadData()
      }
    } catch (error) {
      console.error('Peer import hatası:', error)
      alert('Peer kaydedilemedi: ' + (error.response?.data?.detail || error.message))
    } finally {
      setImporting(false)
    }
  }

  // Config kopyala
  const handleCopyConfig = async (config) => {
    try {
      // Modern clipboard API'yi dene
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(config)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
      } else {
        // Fallback: Eski yöntem (textarea kullanarak)
        const textarea = document.createElement('textarea')
        textarea.value = config
        textarea.style.position = 'fixed'
        textarea.style.left = '-999999px'
        textarea.style.top = '-999999px'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        try {
          document.execCommand('copy')
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch (err) {
          console.error('Kopyalama hatası:', err)
          alert('Kopyalama başarısız. Lütfen config dosyasını manuel olarak kopyalayın.')
        }
        document.body.removeChild(textarea)
      }
    } catch (err) {
      console.error('Kopyalama hatası:', err)
      // Fallback: Eski yöntem
      const textarea = document.createElement('textarea')
      textarea.value = config
      textarea.style.position = 'fixed'
      textarea.style.left = '-999999px'
      textarea.style.top = '-999999px'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err2) {
        console.error('Kopyalama hatası:', err2)
        alert('Kopyalama başarısız. Lütfen config dosyasını manuel olarak kopyalayın.')
      }
      document.body.removeChild(textarea)
    }
  }

  // Interface aç/kapat
  const handleToggleInterface = async () => {
    try {
      const isRunning = interfaceData?.running
      await toggleInterface(interfaceName, !isRunning)
      loadData()
    } catch (error) {
      alert('Interface durumu değiştirilemedi: ' + (error.response?.data?.detail || error.message))
    }
  }

  // Peer aktif/pasif yap
  const handleTogglePeer = async (peerId, currentDisabled) => {
    // Peer ID kontrolü - daha kapsamlı
    if (!peerId || peerId === 'undefined' || peerId === 'null' || peerId === undefined || peerId === null) {
      alert('Peer ID bulunamadı. Lütfen sayfayı yenileyin.')
      console.error('Peer ID:', peerId, 'Interface:', interfaceName, 'Current Disabled:', currentDisabled)
      return
    }

    // Peer ID'yi string'e çevir ve temizle
    const cleanPeerId = String(peerId).trim()
    if (!cleanPeerId || cleanPeerId === 'undefined' || cleanPeerId === 'null' || cleanPeerId === 'None') {
      alert('Geçersiz Peer ID. Lütfen sayfayı yenileyin.')
      console.error('Temizlenmiş Peer ID:', cleanPeerId)
      return
    }

    // currentDisabled değerini normalize et (boolean olmalı)
    // currentDisabled true ise peer pasif, false ise aktif
    const isDisabled = currentDisabled === true || currentDisabled === 'true' || currentDisabled === 'True' || currentDisabled === 'yes' || currentDisabled === 'Yes'

    console.log('Toggle peer:', {
      originalPeerId: peerId,
      cleanPeerId,
      interfaceName,
      currentDisabled,
      isDisabled,
      willEnable: !isDisabled
    })

    try {
      setTogglingPeer(cleanPeerId)
      
      // Optimistic update: UI'ı hemen güncelle (API yanıtı beklenmeden)
      setPeers(prevPeers => prevPeers.map(p => {
        const pId = p['.id'] || p.id
        if (pId === cleanPeerId) {
          return { ...p, disabled: !isDisabled }
        }
        return p
      }))
      
      await togglePeer(cleanPeerId, interfaceName, isDisabled)
      // Toggle başarılı - spinner'ı hemen kaldır
      setTogglingPeer(null)
      
      // Arka planda verileri yenile (UI zaten güncellendi)
      loadData()
    } catch (error) {
      console.error('Peer toggle hatası:', error)
      console.error('Hata detayları:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      })
      // Hata durumunda optimistic update'i geri al
      setPeers(prevPeers => prevPeers.map(p => {
        const pId = p['.id'] || p.id
        if (pId === cleanPeerId) {
          return { ...p, disabled: isDisabled }
        }
        return p
      }))
      alert('Peer durumu değiştirilemedi: ' + (error.response?.data?.detail || error.message))
      setTogglingPeer(null)
    }
  }

  // Toplu işlem: Peer seçimi toggle
  const handleSelectPeer = (peerId) => {
    const newSelected = new Set(selectedPeers)
    if (newSelected.has(peerId)) {
      newSelected.delete(peerId)
    } else {
      newSelected.add(peerId)
    }
    setSelectedPeers(newSelected)
  }

  // Toplu işlem: Tümünü seç/kaldır
  const handleSelectAll = () => {
    if (selectedPeers.size === filteredPeers.length) {
      setSelectedPeers(new Set())
    } else {
      setSelectedPeers(new Set(filteredPeers.map(p => p['.id'])))
    }
  }

  // Toplu işlem: Seçili peer'ları aktif et
  const handleBulkEnable = async () => {
    if (selectedPeers.size === 0) return
    if (!confirm(`${selectedPeers.size} peer'ı aktif etmek istediğinize emin misiniz?`)) return

    setBulkProcessing(true)
    let successCount = 0
    let errorCount = 0

    for (const peerId of selectedPeers) {
      try {
        const peer = peers.find(p => p['.id'] === peerId)
        if (peer && peer.disabled) {
          await togglePeer(peerId, interfaceName, true) // true = currently disabled
          successCount++
        }
      } catch (error) {
        console.error(`Peer ${peerId} aktif edilemedi:`, error)
        errorCount++
      }
    }

    setBulkProcessing(false)
    setSelectedPeers(new Set())
    await loadData()
    alert(`İşlem tamamlandı:\n✓ Başarılı: ${successCount}\n✗ Hatalı: ${errorCount}`)
  }

  // Toplu işlem: Seçili peer'ları pasif et
  const handleBulkDisable = async () => {
    if (selectedPeers.size === 0) return
    if (!confirm(`${selectedPeers.size} peer'ı pasif etmek istediğinize emin misiniz?`)) return

    setBulkProcessing(true)
    let successCount = 0
    let errorCount = 0

    for (const peerId of selectedPeers) {
      try {
        const peer = peers.find(p => p['.id'] === peerId)
        if (peer && !peer.disabled) {
          await togglePeer(peerId, interfaceName, false) // false = currently active
          successCount++
        }
      } catch (error) {
        console.error(`Peer ${peerId} pasif edilemedi:`, error)
        errorCount++
      }
    }

    setBulkProcessing(false)
    setSelectedPeers(new Set())
    await loadData()
    alert(`İşlem tamamlandı:\n✓ Başarılı: ${successCount}\n✗ Hatalı: ${errorCount}`)
  }

  // Toplu işlem: Seçili peer'ları sil
  const handleBulkDelete = async () => {
    if (selectedPeers.size === 0) return
    if (!confirm(`${selectedPeers.size} peer'ı silmek istediğinize emin misiniz? Bu işlem geri alınamaz!`)) return

    setBulkProcessing(true)
    let successCount = 0
    let errorCount = 0

    for (const peerId of selectedPeers) {
      try {
        await deletePeer(peerId, interfaceName)
        successCount++
      } catch (error) {
        console.error(`Peer ${peerId} silinemedi:`, error)
        errorCount++
      }
    }

    setBulkProcessing(false)
    setSelectedPeers(new Set())
    await loadData()
    alert(`İşlem tamamlandı:\n✓ Başarılı: ${successCount}\n✗ Hatalı: ${errorCount}`)
  }

  // Toplu işlem: Seçili peer'lara grup ata
  const handleBulkSetGroup = async (groupName, groupColor) => {
    if (selectedPeers.size === 0) return

    setBulkProcessing(true)
    let successCount = 0
    let errorCount = 0

    for (const peerId of selectedPeers) {
      try {
        await updatePeerMetadata(peerId, interfaceName, {
          group_name: groupName || null,
          group_color: groupColor || '#6366F1',
        })
        successCount++
      } catch (error) {
        console.error(`Peer ${peerId} grup atanamadı:`, error)
        errorCount++
      }
    }

    setBulkProcessing(false)
    setSelectedPeers(new Set())
    await loadData()
    alert(`Grup atama tamamlandı:\n✓ Başarılı: ${successCount}\n✗ Hatalı: ${errorCount}`)
  }

  // Toplu işlem: Seçili peer'lara etiket ekle
  const handleBulkAddTags = async (newTags) => {
    if (selectedPeers.size === 0 || !newTags.trim()) return

    setBulkProcessing(true)
    let successCount = 0
    let errorCount = 0

    for (const peerId of selectedPeers) {
      try {
        const peer = peers.find(p => p['.id'] === peerId)
        const existingTags = peer?.tags || ''
        const allTags = existingTags ? `${existingTags}, ${newTags}` : newTags
        
        await updatePeerMetadata(peerId, interfaceName, {
          tags: allTags,
        })
        successCount++
      } catch (error) {
        console.error(`Peer ${peerId} etiket eklenemedi:`, error)
        errorCount++
      }
    }

    setBulkProcessing(false)
    setSelectedPeers(new Set())
    await loadData()
    alert(`Etiket ekleme tamamlandı:\n✓ Başarılı: ${successCount}\n✗ Hatalı: ${errorCount}`)
  }

  // Filtrelenmiş ve aranmış peer'ları al - useMemo ile optimize edildi
  const filteredPeers = useMemo(() => {
    let filtered = peers

    // Durum filtresi
    if (filterStatus === 'active') {
      filtered = filtered.filter(p => !p.disabled)
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter(p => p.disabled)
    } else if (filterStatus === 'online') {
      filtered = filtered.filter(p => isPeerOnline(p))
    }

    // Grup filtresi
    if (filterGroup && filterGroup !== 'all') {
      if (filterGroup === 'no-group') {
        filtered = filtered.filter(p => !p.group_name || p.group_name.trim() === '')
      } else {
        filtered = filtered.filter(p => p.group_name === filterGroup)
      }
    }

    // Etiket filtresi
    if (filterTag && filterTag.trim()) {
      const tagToSearch = filterTag.toLowerCase().trim()
      filtered = filtered.filter(p => {
        if (!p.tags) return false
        const peerTags = p.tags.toLowerCase().split(',').map(t => t.trim())
        return peerTags.some(t => t.includes(tagToSearch))
      })
    }

    // Arama filtresi
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(p =>
        (p['public-key'] && p['public-key'].toLowerCase().includes(term)) ||
        (p.comment && p.comment.toLowerCase().includes(term)) ||
        (p['allowed-address'] && p['allowed-address'].toLowerCase().includes(term)) ||
        (p.group_name && p.group_name.toLowerCase().includes(term)) ||
        (p.tags && p.tags.toLowerCase().includes(term))
      )
    }

    return filtered
  }, [peers, filterStatus, filterGroup, filterTag, searchTerm, isPeerOnline])

  // Mevcut grupları hesapla (filtre dropdown için)
  const availableGroups = useMemo(() => {
    const groups = new Set()
    peers.forEach(p => {
      if (p.group_name && p.group_name.trim()) {
        groups.add(p.group_name.trim())
      }
    })
    return Array.from(groups).sort()
  }, [peers])

  // Mevcut etiketleri hesapla (filtre dropdown için)
  const availableTags = useMemo(() => {
    const tags = new Set()
    peers.forEach(p => {
      if (p.tags) {
        p.tags.split(',').forEach(tag => {
          const trimmed = tag.trim()
          if (trimmed) tags.add(trimmed)
        })
      }
    })
    return Array.from(tags).sort()
  }, [peers])

  // İstatistikler - useMemo ile optimize edildi
  const stats = useMemo(() => ({
    total: peers.length,
    active: peers.filter(p => !p.disabled).length,
    inactive: peers.filter(p => p.disabled).length,
    online: peers.filter(p => isPeerOnline(p)).length
  }), [peers, isPeerOnline])

  if (loading && !interfaceData) {
    return (
      <div className="card text-center py-12">
        <RefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-4 animate-spin" />
        <p className="text-gray-500 dark:text-gray-400">Yükleniyor...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Geri butonu ve başlık */}
      <div className="flex items-center gap-2 sm:gap-4">
        <button
          onClick={() => navigate('/wireguard')}
          className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
            {interfaceName}
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1 hidden sm:block">
            Interface detayları ve peer yönetimi
          </p>
        </div>
        <button
          onClick={handleToggleInterface}
          className={`btn flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2 ${
            interfaceData?.running ? 'btn-secondary' : 'btn-primary'
          }`}
        >
          <Power className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">{interfaceData?.running ? 'Kapat' : 'Aç'}</span>
        </button>
      </div>

      {/* Interface bilgileri */}
      <div className="card p-3 sm:p-4">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
          Interface Bilgileri
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 block">Durum:</span>
            <span
              className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                interfaceData?.running
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}
            >
              {interfaceData?.running ? 'Aktif' : 'Pasif'}
            </span>
          </div>
          <div>
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 block">Port:</span>
            <span className="text-sm sm:text-base text-gray-900 dark:text-white font-medium mt-1 block">
              {interfaceData?.['listen-port'] || 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 block">MTU:</span>
            <span className="text-sm sm:text-base text-gray-900 dark:text-white font-medium mt-1 block">
              {interfaceData?.mtu || 'N/A'}
            </span>
          </div>
          {interfaceData?.['public-key'] && (
            <div className="col-span-2 md:col-span-1">
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 block">Public Key:</span>
              <span className="text-xs sm:text-sm text-gray-900 dark:text-white font-mono mt-1 block truncate">
                {interfaceData['public-key'].substring(0, 20)}...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Peer istatistikleri */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="card p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Toplam</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-0.5 sm:mt-1">
                {stats.total}
              </p>
            </div>
            <Users className="w-5 h-5 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <div className="card p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Aktif</p>
              <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400 mt-0.5 sm:mt-1">
                {stats.active}
              </p>
            </div>
            <UserCheck className="w-5 h-5 sm:w-8 sm:h-8 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <div className="card p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Pasif</p>
              <p className="text-lg sm:text-2xl font-bold text-red-600 dark:text-red-400 mt-0.5 sm:mt-1">
                {stats.inactive}
              </p>
            </div>
            <UserX className="w-5 h-5 sm:w-8 sm:h-8 text-red-600 dark:text-red-400" />
          </div>
        </div>
      </div>

      {/* Peer listesi */}
      <div className="card p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 relative z-10">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              Peer'lar ({peers.length})
              {selectedPeers.size > 0 && (
                <span className="ml-2 text-xs sm:text-sm text-primary-600 dark:text-primary-400">
                  ({selectedPeers.size} seçili)
                </span>
              )}
            </h2>

            <div className="flex gap-2">
              <button
                onClick={loadData}
                className="btn btn-secondary flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2"
              >
                <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Yenile</span>
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="btn btn-primary flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Peer Ekle</span>
              </button>
            </div>
          </div>

          {/* Arama ve filtre */}
          <div className="flex flex-col sm:flex-row gap-2 flex-1 relative z-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-9 sm:pl-10 text-sm"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input text-sm min-w-[120px]"
            >
              <option value="all">Tümü ({stats.total})</option>
              <option value="active">Aktif ({stats.active})</option>
              <option value="inactive">Pasif ({stats.inactive})</option>
              <option value="online">Online ({stats.online})</option>
            </select>
            {/* Grup filtresi */}
            {availableGroups.length > 0 && (
              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="input text-sm min-w-[130px]"
              >
                <option value="all">Tüm Gruplar</option>
                <option value="no-group">Grupsuz</option>
                {availableGroups.map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            )}
            {/* Etiket filtresi */}
            {availableTags.length > 0 && (
              <select
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                className="input text-sm min-w-[120px]"
              >
                <option value="">Tüm Etiketler</option>
                {availableTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            )}
          </div>
          {/* Aktif filtreler göstergesi */}
          {(filterGroup !== 'all' || filterTag) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-500 dark:text-gray-400">Filtreler:</span>
              {filterGroup !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                  Grup: {filterGroup === 'no-group' ? 'Grupsuz' : filterGroup}
                  <button onClick={() => setFilterGroup('all')} className="hover:text-purple-900 dark:hover:text-purple-100">×</button>
                </span>
              )}
              {filterTag && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                  Etiket: {filterTag}
                  <button onClick={() => setFilterTag('')} className="hover:text-blue-900 dark:hover:text-blue-100">×</button>
                </span>
              )}
              <button
                onClick={() => { setFilterGroup('all'); setFilterTag(''); }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
              >
                Temizle
              </button>
            </div>
          )}
        </div>

        {/* Toplu işlem butonları */}
        {selectedPeers.size > 0 && (
          <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 w-full sm:w-auto mb-1 sm:mb-0">
                Toplu İşlemler:
              </span>
              <button
                onClick={handleBulkEnable}
                disabled={bulkProcessing}
                className="btn text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
              >
                <Power className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                <span className="hidden sm:inline">Aktif Et</span> ({selectedPeers.size})
              </button>
              <button
                onClick={handleBulkDisable}
                disabled={bulkProcessing}
                className="btn text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white disabled:opacity-50"
              >
                <Power className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                <span className="hidden sm:inline">Pasif Et</span> ({selectedPeers.size})
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkProcessing}
                className="btn text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                <span className="hidden sm:inline">Sil</span> ({selectedPeers.size})
              </button>
              {/* Grup Atama Dropdown */}
              <div className="relative group">
                <button
                  disabled={bulkProcessing}
                  className="btn text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                >
                  <Tag className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="hidden sm:inline">Grup Ata</span>
                </button>
                <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 hidden group-hover:block">
                  <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                    <button
                      onClick={() => handleBulkSetGroup('', '')}
                      className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                    >
                      Grubu Kaldır
                    </button>
                    {availableGroups.map(group => (
                      <button
                        key={group}
                        onClick={() => handleBulkSetGroup(group, '#6366F1')}
                        className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        {group}
                      </button>
                    ))}
                    <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
                      <input
                        type="text"
                        placeholder="Yeni grup adı..."
                        className="w-full text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            handleBulkSetGroup(e.target.value.trim(), '#6366F1')
                            e.target.value = ''
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              {/* Etiket Ekleme */}
              <div className="relative group">
                <button
                  disabled={bulkProcessing}
                  className="btn text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  <Tag className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="hidden sm:inline">Etiket Ekle</span>
                </button>
                <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 hidden group-hover:block">
                  <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                    {availableTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => handleBulkAddTags(tag)}
                        className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        {tag}
                      </button>
                    ))}
                    <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
                      <input
                        type="text"
                        placeholder="Yeni etiket..."
                        className="w-full text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            handleBulkAddTags(e.target.value.trim())
                            e.target.value = ''
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedPeers(new Set())}
                disabled={bulkProcessing}
                className="btn btn-secondary text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 ml-auto"
              >
                <span className="hidden sm:inline">Seçimi</span> Temizle
              </button>
            </div>
          </div>
        )}

        {peers.length === 0 ? (
          <div className="text-center py-6 sm:py-8 text-sm sm:text-base text-gray-500 dark:text-gray-400">
            Henüz peer eklenmemiş
          </div>
        ) : filteredPeers.length === 0 ? (
          <div className="text-center py-6 sm:py-8 text-sm sm:text-base text-gray-500 dark:text-gray-400">
            Arama kriterlerine uygun peer bulunamadı
          </div>
        ) : (
          <>
            {/* Mobile Peer Cards - Sadece mobilde görünür */}
            <div className="lg:hidden space-y-3">
              {filteredPeers.map((peer) => {
                const peerId = peer['.id'] || peer.id;
                const publicKey = peer['public-key'] || peer['public_key'] || '';
                const allowedAddress = peer['allowed-address'] || peer['allowed_address'] || 'N/A';
                const comment = peer.comment || peer.name || '-';
                const isDisabled = peer.disabled === true || peer.disabled === 'true';
                const isOnline = !isDisabled && peer['last-handshake'] && peer['last-handshake'] !== 'N/A' && peer['last-handshake'] !== '0';
                
                return (
                  <div
                    key={peerId}
                    className={`p-3 rounded-lg border ${
                      selectedPeers.has(peerId)
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedPeers.has(peerId)}
                        onChange={() => handleSelectPeer(peerId)}
                        className="w-4 h-4 mt-1 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                            isDisabled
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                              : isOnline
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                          }`}>
                            {isDisabled ? 'Pasif' : isOnline ? 'Online' : 'Offline'}
                          </span>
                          {peer.saved_in_db && (
                            <span className="text-green-500" title="DB'de kayıtlı">
                              <Database className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {comment !== '-' && (
                            <span className="font-medium text-gray-900 dark:text-white block truncate">{comment}</span>
                          )}
                          <span className="font-mono truncate block">{publicKey.substring(0, 20)}...</span>
                        </div>
                        
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          IP: <span className="font-mono">{allowedAddress}</span>
                        </div>
                        
                        {/* Grup ve Etiketler - Mobil */}
                        {(peer.group_name || peer.tags) && (
                          <div className="flex flex-wrap items-center gap-1 mt-2">
                            {peer.group_name && (
                              <span 
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border"
                                style={{ 
                                  borderColor: peer.group_color || '#6366F1',
                                  color: peer.group_color || '#6366F1',
                                  backgroundColor: `${peer.group_color || '#6366F1'}15`
                                }}
                              >
                                {peer.group_name}
                              </span>
                            )}
                            {peer.tags && peer.tags.split(',').map((tag, idx) => (
                              <span 
                                key={idx}
                                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                              >
                                #{tag.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {/* Süre Sonu - Mobil */}
                        {peer.expiry_date && (
                          <div className="mt-1 text-[10px]">
                            {new Date(peer.expiry_date) < new Date() ? (
                              <span className="text-red-500">⏰ Süresi doldu</span>
                            ) : new Date(peer.expiry_date) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) ? (
                              <span className="text-yellow-500">⏰ {new Date(peer.expiry_date).toLocaleDateString('tr-TR')}</span>
                            ) : (
                              <span className="text-gray-400">⏰ {new Date(peer.expiry_date).toLocaleDateString('tr-TR')}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <button
                        onClick={() => handleTogglePeer(peerId, peer.disabled)}
                        className={`p-1.5 rounded ${isDisabled ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'}`}
                        title={isDisabled ? 'Aktif Et' : 'Pasif Et'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(peer)}
                        className="p-1.5 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        title="Düzenle"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {peer.saved_in_db && (
                        <>
                          <button
                            onClick={() => handleShowQRCode(peer)}
                            className="p-1.5 rounded text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                            title="QR Kod"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleShowConfig(peer)}
                            className="p-1.5 rounded text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                            title="Config"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {!peer.saved_in_db && (
                        <button
                          onClick={() => handleOpenImportModal(peer)}
                          className="p-1.5 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          title="DB'ye Kaydet"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeletePeer(peer)}
                        className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 ml-auto"
                        title="Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table - Sadece masaüstünde görünür */}
            <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 w-12">
                    <input
                      type="checkbox"
                      checked={selectedPeers.size === filteredPeers.length && filteredPeers.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Public Key
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Allowed Address
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Comment
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Durum
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPeers.map((peer) => (
                  <tr
                    key={peer['.id']}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedPeers.has(peer['.id'])}
                        onChange={() => handleSelectPeer(peer['.id'])}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <code className="text-xs text-gray-900 dark:text-white font-mono break-all">
                          {peer['public-key']?.substring(0, 32)}...
                      </code>
                        {peer['.id'] && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            ID: {peer['.id']}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900 dark:text-white">
                      {peer['allowed-address'] || '-'}
                        </span>
                        {peer['persistent-keepalive'] && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Keepalive: {peer['persistent-keepalive']}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900 dark:text-white">
                      {peer.comment || '-'}
                        </span>
                        {/* Grup ve Etiketler */}
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {peer.group_name && (
                            <span
                              className="px-1.5 py-0.5 rounded text-xs font-medium"
                              style={{
                                backgroundColor: peer.group_color ? `${peer.group_color}20` : '#6366f120',
                                color: peer.group_color || '#6366f1',
                                border: `1px solid ${peer.group_color || '#6366f1'}40`
                              }}
                            >
                              {peer.group_name}
                            </span>
                          )}
                          {peer.tags && peer.tags.split(',').filter(t => t.trim()).slice(0, 2).map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                            >
                              #{tag.trim()}
                            </span>
                          ))}
                          {peer.tags && peer.tags.split(',').filter(t => t.trim()).length > 2 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              +{peer.tags.split(',').filter(t => t.trim()).length - 2}
                            </span>
                          )}
                        </div>
                        {peer['endpoint'] && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-all">
                            {peer['endpoint'].replace(/:0$/, '')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          peer.disabled
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}
                      >
                        {peer.disabled ? 'Pasif' : 'Aktif'}
                      </span>
                      {/* Expiry badge - metadata'dan alınacak */}
                      {peer.expires_at && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${
                          new Date(peer.expires_at) < new Date()
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : new Date(peer.expires_at) < new Date(Date.now() + 24 * 60 * 60 * 1000)
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          <Clock className="w-3 h-3" />
                          {new Date(peer.expires_at) < new Date()
                            ? 'Süresi Doldu'
                            : new Date(peer.expires_at).toLocaleDateString('tr-TR')}
                        </span>
                      )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        {peer['.id'] ? (
                          <>
                            <button
                              onClick={() => {
                                const peerId = peer['.id'] || peer.id || peer['*id']
                                if (!peerId) {
                                  alert('Peer ID bulunamadı. Lütfen sayfayı yenileyin.')
                                  console.error('Peer ID yok:', peer)
                                  return
                                }
                                handleTogglePeer(peerId, peer.disabled)
                              }}
                              disabled={togglingPeer === (peer['.id'] || peer.id || peer['*id'])}
                              className={`p-2 rounded ${
                                peer.disabled
                                  ? 'hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400'
                                  : 'hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                              }`}
                              title={peer.disabled ? 'Aktif Et' : 'Pasif Et'}
                            >
                              {togglingPeer === peer['.id'] ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Power className="w-4 h-4" />
                              )}
                            </button>

                        {/* DB'de kayıtlı değilse Import butonu göster */}
                        {peer.saved_in_db !== true && (
                          <button
                            onClick={() => handleOpenImportModal(peer)}
                            className="p-2 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded text-primary-600 dark:text-primary-400"
                            title="Veritabanına Kaydet (Private Key Gerekli)"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => handleShowQR(peer['.id'])}
                          className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-blue-600 dark:text-blue-400 ${
                            peer.saved_in_db !== true ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          title={peer.saved_in_db !== true ? 'QR Kod (Önce kaydet)' : 'QR Kod'}
                          disabled={peer.saved_in_db !== true}
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                            <button
                              onClick={() => handleShowConfig(peer['.id'])}
                              className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-green-600 dark:text-green-400 ${
                                peer.saved_in_db !== true ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              title={peer.saved_in_db !== true ? 'Config Dosyası (Önce kaydet)' : 'Config Dosyası'}
                              disabled={peer.saved_in_db !== true}
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                        <button
                          onClick={() => handleEditPeer(peer)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          title="Düzenle (MikroTik'ten güncel veri çeker)"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePeer(peer['.id'])}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-gray-400">ID yok</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Peer ekleme modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-3 sm:p-6 my-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-base sm:text-xl font-semibold text-gray-900 dark:text-white">
              Yeni Peer Ekle
            </h3>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  resetForm()
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toplu Ekleme Modu */}
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-2 sm:mb-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="bulkMode"
                    checked={bulkMode}
                    onChange={(e) => setBulkMode(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="bulkMode" className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    Toplu Ekle
                  </label>
                </div>
                {bulkMode && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Adet:</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={bulkCount}
                      onChange={(e) => setBulkCount(parseInt(e.target.value) || 1)}
                      className="w-16 sm:w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
              {bulkMode && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Toplu ekleme yaparsanız eşlerin isimleri otomatik olarak oluşturulacak ve İzin Verilen IP adresi mevcut olan bir sonraki IP olarak tanımlanacak.
                </p>
              )}
            </div>

            {/* Şablon Seçimi - Her zaman göster */}
            <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" />
                Şablondan Oluştur (Opsiyonel)
              </label>
              {availableTemplates.length > 0 ? (
                <>
                  <select
                    value={selectedTemplate?.id || ''}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    className="input text-sm"
                  >
                    <option value="">Şablon kullanma</option>
                    {availableTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.usage_count || 0} kullanım)
                      </option>
                    ))}
                  </select>
                  {selectedTemplate && (
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Şablon seçildi. Formu kontrol edip gerekirse düzenleyebilirsiniz.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <select
                    disabled
                    className="input text-sm bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60"
                  >
                    <option>Henüz şablon oluşturulmamış</option>
                  </select>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                    💡 "Şablonlar" menüsünden yeni şablon oluşturabilirsiniz
                  </p>
                </>
              )}
            </div>

            <form onSubmit={bulkMode ? (e) => { e.preventDefault(); handleBulkAdd(); } : handleAddPeer} className="space-y-3 sm:space-y-4">
              {/* Ad */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                  Ad {bulkMode && '(Otomatik oluşturulacak)'}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input text-sm"
                  placeholder="peer-1"
                  disabled={bulkMode}
                />
              </div>

              {/* Özel Anahtar */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 mb-1 sm:mb-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                    Özel Anahtar (QR Kodu için zorunlu)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateKeys}
                      className="text-xs px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700"
                    >
                      Oluştur
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      {showPrivateKey ? 'Gizle' : 'Göster'}
                    </button>
                  </div>
                </div>
                <input
                  type={showPrivateKey ? "text" : "password"}
                  value={formData.private_key}
                  onChange={(e) => setFormData({ ...formData, private_key: e.target.value })}
                  className="input font-mono text-xs sm:text-sm"
                  placeholder="••••••••••••••••••••••••••••••••••••••••••••"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Kendi anahtarınızı kullanın veya otomatik oluşturun
                </p>
              </div>

              {/* Genel Anahtar */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 mb-1 sm:mb-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                    Genel Anahtar (Zorunlu) *
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateKeys}
                    className="text-xs px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 w-fit"
                  >
                    Oluştur
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.public_key}
                  onChange={(e) => setFormData({ ...formData, public_key: e.target.value })}
                  className="input font-mono text-xs sm:text-sm"
                  placeholder="Genel anahtarınızı girin veya otomatik oluşturun"
                  required
                />
              </div>

              {/* İzin Verilen IP Adresleri */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 mb-1 sm:mb-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                    İzin Verilen IP Adresleri *
                  </label>
                  <button
                    type="button"
                    onClick={fetchNextAvailableIP}
                    disabled={loadingPool || bulkMode}
                    className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1 w-fit"
                  >
                    {loadingPool ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span className="hidden sm:inline">Yükleniyor...</span>
                      </>
                    ) : (
                      <>
                        Sıradaki IP
                      </>
                    )}
                  </button>
                </div>
                <div className="space-y-2">
                <input
                  type="text"
                  value={formData.allowed_address}
                    onChange={(e) => {
                      const value = e.target.value
                      setFormData({ ...formData, allowed_address: value })
                    }}
                    className={`input font-mono text-xs sm:text-sm ${
                      formData.allowed_address && formData.allowed_address.toLowerCase() !== 'auto' && !validateIP(formData.allowed_address)
                        ? 'border-red-500 dark:border-red-500'
                        : ''
                    }`}
                    placeholder="192.168.46.14/32 veya 'auto'"
                    required
                  />
                  {formData.allowed_address && formData.allowed_address.toLowerCase() !== 'auto' && !validateIP(formData.allowed_address) && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Geçersiz IP formatı. Örnek: 192.168.46.14/32 veya 'auto' yazarak otomatik tahsis
                    </p>
                  )}
                  {formData.allowed_address && formData.allowed_address.toLowerCase() === 'auto' && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      🔄 Otomatik IP tahsisi - Backend IP Pool'dan sıradaki boş IP kullanılacak
                    </p>
                  )}
                  {formData.allowed_address && formData.allowed_address.toLowerCase() !== 'auto' && validateIP(formData.allowed_address) && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      ✓ IP Adresi/CIDR geçerli: {formData.allowed_address}
                    </p>
                  )}
                  {/* IP Pool Bilgisi */}
                  {poolInfo && poolInfo.has_pool && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                      <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                        📊 IP Pool: {poolInfo.pool_info.name}
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        <span className="hidden sm:inline">Range: {poolInfo.pool_info.range} |</span>
                        Kullanılabilir: {poolInfo.pool_info.stats.available}/{poolInfo.pool_info.stats.total_ips}
                        ({poolInfo.pool_info.stats.usage_percent}% dolu)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Advanced Options Toggle */}
              <div className="pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
                >
                  <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Advanced Options</span>
                  <span className="sm:hidden">Gelişmiş</span>
                  {showAdvanced ? '▼' : '▶'}
                </button>
              </div>

              {/* Advanced Options */}
              {showAdvanced && (
                <div className="space-y-3 sm:space-y-4 pl-3 sm:pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                  {/* DNS */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                      DNS
                    </label>
                    <input
                      type="text"
                      value={formData.dns}
                      onChange={(e) => setFormData({ ...formData, dns: e.target.value })}
                  className="input text-sm"
                      placeholder="1.1.1.1"
                />
              </div>

                  {/* Endpoint için İzin Verilen IP Adresleri */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                      Endpoint İzin Verilen IP'ler
                </label>
                <input
                  type="text"
                      value={formData.endpoint_allowed_address}
                      onChange={(e) => setFormData({ ...formData, endpoint_allowed_address: e.target.value })}
                      className="input font-mono text-xs sm:text-sm"
                      placeholder="192.168.46.0/24"
                    />
                  </div>

                  {/* Pre-shared Key */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                      Ön Paylaşımlı Anahtar
                    </label>
                    <input
                      type="text"
                      value={formData.preshared_key}
                      onChange={(e) => setFormData({ ...formData, preshared_key: e.target.value })}
                      className="input font-mono text-xs sm:text-sm"
                      placeholder="Pre-shared key"
                    />
                  </div>

                  {/* MTU */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                      MTU
                    </label>
                    <input
                      type="number"
                      min="1280"
                      max="1500"
                      value={formData.mtu}
                      onChange={(e) => setFormData({ ...formData, mtu: e.target.value })}
                  className="input text-sm"
                      placeholder="1420"
                />
              </div>

                  {/* Persistent Keepalive */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                      Sürekli Oturum Süresi
                </label>
                <input
                  type="text"
                  value={formData.persistent_keepalive}
                      onChange={(e) => setFormData({ ...formData, persistent_keepalive: e.target.value })}
                  className="input text-sm"
                  placeholder="25s"
                />
              </div>

                  {/* Son Kullanma Tarihi */}
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-orange-500" />
                      Son Kullanma Tarihi
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.expires_at}
                      onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                      className="input text-sm"
                      min={new Date().toISOString().slice(0, 16)}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Boş bırakılırsa süresiz olur
                    </p>
                  </div>

                  {/* Son Kullanma Eylemi */}
                  {formData.expires_at && (
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                        Süre Dolduğunda
                      </label>
                      <select
                        value={formData.expiry_action}
                        onChange={(e) => setFormData({ ...formData, expiry_action: e.target.value })}
                        className="input text-sm"
                      >
                        <option value="disable">Devre Dışı Bırak</option>
                        <option value="delete">Sil</option>
                        <option value="notify_only">Sadece Bildir</option>
                      </select>
                    </div>
                  )}

                  {/* Grup ve Etiketler Bölümü */}
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-purple-500" />
                      Grup ve Etiketler
                    </h4>
                    
                    {/* Grup Adı ve Rengi */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Grup Adı
                        </label>
                        <input
                          type="text"
                          value={formData.group_name}
                          onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
                          className="input text-sm"
                          placeholder="Örn: Ofis, Mobil, Sunucular..."
                          maxLength={100}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Grup Rengi
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={formData.group_color}
                            onChange={(e) => setFormData({ ...formData, group_color: e.target.value })}
                            className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
                          />
                          <span className="text-xs text-gray-500">{formData.group_color}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Etiketler */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Etiketler
                      </label>
                      <input
                        type="text"
                        value={formData.tags}
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                        className="input text-sm"
                        placeholder="vpn, mobil, yedek (virgülle ayırın)"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Birden fazla etiket için virgül kullanın
                      </p>
                    </div>
                    
                    {/* Notlar */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Notlar
                      </label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className="input text-sm resize-none"
                        placeholder="Bu peer hakkında ek notlar..."
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Comment (Basit mod için) */}
              {!showAdvanced && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                    Comment
                  </label>
                  <input
                    type="text"
                    value={formData.comment}
                    onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                    className="input text-sm"
                    placeholder="Açıklama"
                  />
                </div>
              )}

              {/* Butonlar */}
              <div className="flex gap-2 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    resetForm()
                  }}
                  disabled={addingPeer}
                  className="flex-1 btn btn-secondary text-sm"
                >
                  İptal
                </button>
                <button 
                  type="submit" 
                  disabled={addingPeer}
                  className="flex-1 btn btn-primary flex items-center justify-center gap-2 text-sm"
                >
                  {addingPeer ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                      <span className="hidden sm:inline">Ekleniyor...</span>
                    </>
                  ) : (
                    bulkMode ? `${bulkCount} Peer Ekle` : 'Ekle'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Peer düzenleme modal */}
      {editingPeer && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-3 sm:p-6 my-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
              Peer Düzenle
            </h3>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                  Allowed Addresses
                </label>

                {/* Mevcut IP'ler - Chip/Tag olarak gösterim */}
                {allowedIPs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2 sm:mb-3 p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    {allowedIPs.map((ip, index) => (
                      <div
                        key={index}
                        className="inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs sm:text-sm font-medium"
                      >
                        <span className="truncate max-w-[120px] sm:max-w-none">{ip}</span>
                        <button
                          onClick={() => {
                            const newIPs = allowedIPs.filter((_, i) => i !== index)
                            setAllowedIPs(newIPs)
                          }}
                          className="ml-1 hover:bg-blue-200 dark:hover:bg-blue-800/50 rounded-full p-0.5"
                          title="Kaldır"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Yeni IP ekleme */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newIP}
                    onChange={(e) => setNewIP(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const trimmedIP = newIP.trim()
                        if (trimmedIP) {
                          // IP formatını kontrol et
                          if (trimmedIP.includes('/')) {
                            // CIDR notasyonu var
                            if (!allowedIPs.includes(trimmedIP)) {
                              setAllowedIPs([...allowedIPs, trimmedIP])
                              setNewIP('')
                            } else {
                              alert('Bu IP zaten ekli!')
                            }
                          } else {
                            alert('Lütfen CIDR notasyonu ile girin (örn: 192.168.1.1/32)')
                          }
                        }
                      }
                    }}
                    className="input flex-1 text-sm"
                    placeholder="Yeni IP ekle (örn: 10.0.0.5/32)"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmedIP = newIP.trim()
                      if (trimmedIP) {
                        // IP formatını kontrol et
                        if (trimmedIP.includes('/')) {
                          // CIDR notasyonu var
                          if (!allowedIPs.includes(trimmedIP)) {
                            setAllowedIPs([...allowedIPs, trimmedIP])
                            setNewIP('')
                          } else {
                            alert('Bu IP zaten ekli!')
                          }
                        } else {
                          alert('Lütfen CIDR notasyonu ile girin (örn: 192.168.1.1/32)')
                        }
                      }
                    }}
                    className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 sm:mt-2">
                  💡 Her IP'yi chip olarak görebilir, X ile kaldırabilir veya yeni IP ekleyebilirsiniz.
                </p>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                  Comment
                </label>
                <input
                  type="text"
                  value={editingPeer.comment || ''}
                  onChange={(e) =>
                    setEditingPeer({ ...editingPeer, comment: e.target.value })
                  }
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                  Private Key
                </label>
                <input
                  type="text"
                  value={editingPeer.private_key || ''}
                  onChange={(e) =>
                    setEditingPeer({ ...editingPeer, private_key: e.target.value })
                  }
                  className="input font-mono text-xs sm:text-sm"
                  placeholder="Peer'ın private key'i (opsiyonel)"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  🔑 QR kod ve config dosyası için gereklidir.
                </p>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                  Persistent Keepalive
                </label>
                <input
                  type="text"
                  value={editingPeer.persistent_keepalive || ''}
                  onChange={(e) =>
                    setEditingPeer({
                      ...editingPeer,
                      persistent_keepalive: e.target.value,
                    })
                  }
                  className="input text-sm"
                  placeholder="25s"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  NAT arkasındaki client'lar için önerilir
                </p>
              </div>
              {/* Grup ve Etiketler */}
              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs sm:text-sm font-medium text-indigo-800 dark:text-indigo-300">
                    Grup ve Etiketler
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Grup
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editingPeer.group_name || ''}
                        onChange={(e) =>
                          setEditingPeer({ ...editingPeer, group_name: e.target.value })
                        }
                        className="input text-sm flex-1"
                        placeholder="Çalışanlar, VIP..."
                      />
                      <input
                        type="color"
                        value={editingPeer.group_color || '#6366f1'}
                        onChange={(e) =>
                          setEditingPeer({ ...editingPeer, group_color: e.target.value })
                        }
                        className="w-10 h-10 rounded cursor-pointer border border-gray-300 dark:border-gray-600"
                        title="Grup rengi"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Etiketler
                    </label>
                    <input
                      type="text"
                      value={editingPeer.tags || ''}
                      onChange={(e) =>
                        setEditingPeer({ ...editingPeer, tags: e.target.value })
                      }
                      className="input text-sm w-full"
                      placeholder="vip, production, test"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Virgülle ayırın
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Notlar
                  </label>
                  <textarea
                    value={editingPeer.notes || ''}
                    onChange={(e) =>
                      setEditingPeer({ ...editingPeer, notes: e.target.value })
                    }
                    className="input text-sm w-full"
                    rows={2}
                    placeholder="Peer hakkında notlar..."
                  />
                </div>
              </div>
              {/* Template Seçimi */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                  Şablon
                </label>
                {availableTemplates.length > 0 ? (
                  <>
                    <select
                      value={editingPeer.template_id || ''}
                      onChange={(e) =>
                        setEditingPeer({ ...editingPeer, template_id: e.target.value ? parseInt(e.target.value) : null })
                      }
                      className="input text-sm"
                    >
                      <option value="">Şablon seçmeyin</option>
                      {availableTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Peer için şablon seçebilirsiniz
                    </p>
                  </>
                ) : (
                  <>
                    <select
                      disabled
                      className="input bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60 text-sm"
                    >
                      <option>Henüz şablon oluşturulmamış</option>
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      💡 "Şablonlar" sayfasından yeni şablon oluşturabilirsiniz
                    </p>
                  </>
                )}
              </div>
              {/* Son Kullanma Tarihi (Expiry) */}
              <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs sm:text-sm font-medium text-amber-800 dark:text-amber-300">
                    Son Kullanma Tarihi
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Tarih
                    </label>
                    <input
                      type="datetime-local"
                      value={editingPeer.expires_at ? editingPeer.expires_at.slice(0, 16) : ''}
                      onChange={(e) =>
                        setEditingPeer({ ...editingPeer, expires_at: e.target.value })
                      }
                      className="input text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Süre Dolduğunda
                    </label>
                    <select
                      value={editingPeer.expiry_action || 'disable'}
                      onChange={(e) =>
                        setEditingPeer({ ...editingPeer, expiry_action: e.target.value })
                      }
                      className="input text-sm w-full"
                    >
                      <option value="disable">Devre Dışı Bırak</option>
                      <option value="delete">Sil</option>
                      <option value="notify_only">Sadece Bildir</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-2">
                  ⏰ Boş bırakılırsa süresiz olarak aktif kalır
                </p>
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingPeer.disabled || false}
                    onChange={(e) =>
                      setEditingPeer({ ...editingPeer, disabled: e.target.checked })
                    }
                    className="rounded"
                  />
                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                    Pasif
                  </span>
                </label>
              </div>
              <div className="flex gap-2 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setEditingPeer(null)}
                  className="flex-1 btn btn-secondary text-sm"
                >
                  İptal
                </button>
                <button
                  onClick={() => handleUpdatePeer(editingPeer['.id'] || editingPeer.id)}
                  className="flex-1 btn btn-primary text-sm"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR kod modal */}
      {showQRModal && qrData && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-3 sm:p-6 my-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              WireGuard Config QR Kodu
            </h3>
              <button
                onClick={() => {
                  setShowQRModal(false)
                  setQrData(null)
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-3 sm:gap-4">
              <img src={qrData.qrcode} alt="QR Code" className="w-48 h-48 sm:w-64 sm:h-64" />
              <div className="w-full">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                    Config:
                  </label>
                  <button
                    onClick={() => handleCopyConfig(qrData.config)}
                    className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Kopyalandı!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Kopyala</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={qrData.config}
                  readOnly
                  className="input font-mono text-xs h-28 sm:h-32 resize-none"
                />
              </div>
              <button
                onClick={() => {
                  setShowQRModal(false)
                  setQrData(null)
                }}
                className="w-full btn btn-secondary text-sm"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Config Dosyası Modal */}
      {showConfigModal && configData && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-3 sm:p-6 my-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                Peer Configuration File
              </h3>
              <button
                onClick={() => {
                  setShowConfigModal(false)
                  setConfigData(null)
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                    Configuration:
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyConfig(configData.config)}
                      className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">Kopyalandı!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">Kopyala</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDownloadConfig(configData.config, configData.peer?.comment || 'peer')}
                      className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700"
                    >
                      <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">İndir</span>
                    </button>
                  </div>
                </div>
                <textarea
                  value={configData.config}
                  readOnly
                  className="w-full p-2 sm:p-3 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900 text-xs font-mono"
                  rows={12}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3 sm:mt-4">
              <button
                onClick={() => {
                  setShowConfigModal(false)
                  setConfigData(null)
                }}
                className="flex-1 btn btn-secondary text-sm"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && importingPeer && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-3 sm:p-6 my-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                Peer'ı Veritabanına Kaydet
              </h3>
              <button
                onClick={() => {
                  setShowImportModal(false)
                  setImportingPeer(null)
                  setImportPrivateKey('')
                  setImportSelectedTemplate('')
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-3 sm:mb-4">
                  Bu peer'ı veritabanına kaydetmek için private key girin.
                </p>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-300 font-medium">
                    Peer Bilgileri:
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                    ID: {importingPeer['.id'] || importingPeer.id}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    Ad: {importingPeer.comment || importingPeer.name || 'Belirtilmemiş'}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 truncate">
                    IP: {importingPeer['allowed-address'] || 'Belirtilmemiş'}
                  </p>
                </div>

                {/* Template seçimi */}
                <div className="mb-3 sm:mb-4">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                    Peer Şablonu (Opsiyonel)
                  </label>
                  {availableTemplates.length > 0 ? (
                    <>
                      <select
                        value={importSelectedTemplate}
                        onChange={(e) => setImportSelectedTemplate(e.target.value)}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Şablon kullanma</option>
                        {availableTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Şablon seçerek ayarları otomatik doldurabilirsiniz.
                      </p>
                    </>
                  ) : (
                    <>
                      <select
                        disabled
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 text-sm text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-60"
                      >
                        <option>Henüz şablon oluşturulmamış</option>
                      </select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        💡 "Şablonlar" sayfasından yeni şablon oluşturabilirsiniz.
                      </p>
                    </>
                  )}

                  {/* Template preview */}
                  {importSelectedTemplate && (() => {
                    const selectedTemplate = availableTemplates.find(t => t.id === parseInt(importSelectedTemplate))
                    if (selectedTemplate) {
                      return (
                        <div className="mt-2 p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs">
                          <p className="font-semibold text-green-800 dark:text-green-300 mb-1">
                            Şablon Ayarları:
                          </p>
                          {selectedTemplate.endpoint_address && (
                            <p className="text-green-700 dark:text-green-400 truncate">
                              • Endpoint: {selectedTemplate.endpoint_address}
                              {selectedTemplate.endpoint_port && `:${selectedTemplate.endpoint_port}`}
                            </p>
                          )}
                          {selectedTemplate.persistent_keepalive && (
                            <p className="text-green-700 dark:text-green-400">
                              • Keepalive: {selectedTemplate.persistent_keepalive}s
                            </p>
                          )}
                          {selectedTemplate.group_name && (
                            <p className="text-green-700 dark:text-green-400">
                              • Grup: {selectedTemplate.group_name}
                            </p>
                          )}
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>

                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                  Private Key *
                </label>
                <textarea
                  value={importPrivateKey}
                  onChange={(e) => setImportPrivateKey(e.target.value)}
                  placeholder="Peer'ın private key'ini buraya yapıştırın..."
                  className="w-full p-2 sm:p-3 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
                  rows={3}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Private key genellikle 44 karakter uzunluğundadır.
                </p>
              </div>

              <div className="flex gap-2 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowImportModal(false)
                    setImportingPeer(null)
                    setImportPrivateKey('')
                    setImportSelectedTemplate('')
                  }}
                  className="flex-1 btn btn-secondary text-sm"
                  disabled={importing}
                >
                  İptal
                </button>
                <button
                  onClick={handleImportPeer}
                  disabled={importing || !importPrivateKey.trim()}
                  className="flex-1 btn btn-primary text-sm flex items-center justify-center gap-1.5"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                      <span className="hidden sm:inline">Kaydediliyor...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span>Kaydet</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WireGuardInterfaceDetail


