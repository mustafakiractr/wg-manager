/**
 * WireGuard Interface listesi sayfası
 * Tüm interface'leri listeler ve yönetim yapar
 * Tüm peer'ları gösterir ve yönetir
 */
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  getInterfaces, 
  toggleInterface, 
  getPeers,
  addPeer,
  updatePeer,
  deletePeer,
  togglePeer,
  getPeerQRCode,
  generateKeys,
  addInterface,
  updateInterface,
  deleteInterface
} from '../services/wireguardService'
import api from '../services/api'
import {
  getAllPeerMetadata,
  updatePeerGroup,
  bulkUpdatePeerGroup,
  getAllPeerGroups,
} from '../services/peerMetadataService'
import {
  getAllTemplates,
  previewTemplate,
} from '../services/peerTemplateService'
import {
  Network,
  Power,
  RefreshCw,
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  QrCode,
  Search,
  Users,
  UserCheck,
  UserX,
  Copy,
  Check,
  Settings,
  X,
  Download,
  FileText,
  Tag,
  Tags,
  CheckCircle,
  Layers,
} from 'lucide-react'

function WireGuardInterfaces() {
  const navigate = useNavigate()
  const [interfaces, setInterfaces] = useState([])
  const [allPeers, setAllPeers] = useState([]) // Tüm peer'lar
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAddInterfaceModal, setShowAddInterfaceModal] = useState(false)
  const [showEditInterfaceModal, setShowEditInterfaceModal] = useState(false)
  const [editingInterface, setEditingInterface] = useState(null)
  const [showQRModal, setShowQRModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [qrData, setQrData] = useState(null)
  const [configData, setConfigData] = useState(null)
  const [editingPeer, setEditingPeer] = useState(null)
  const [allowedIPs, setAllowedIPs] = useState([]) // Peer düzenleme için allowed IP listesi
  const [newIP, setNewIP] = useState('') // Yeni eklenecek IP
  const [copied, setCopied] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // 'all', 'active', 'inactive'
  const [filterInterface, setFilterInterface] = useState('all') // Interface filtresi
  const [togglingPeer, setTogglingPeer] = useState(null)
  const [loadingPool, setLoadingPool] = useState(false) // IP Pool yükleme durumu
  const [poolInfo, setPoolInfo] = useState(null) // IP Pool bilgisi
  const [addingPeer, setAddingPeer] = useState(false) // Peer ekleme durumu

  // Toplu işlemler için
  const [selectedPeers, setSelectedPeers] = useState([]) // Seçili peer ID'leri
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false)

  // Grup yönetimi için
  const [filterGroup, setFilterGroup] = useState('all') // Grup filtresi
  const [availableGroups, setAvailableGroups] = useState([]) // Mevcut gruplar
  const [peerMetadata, setPeerMetadata] = useState({}) // Peer metadata map (peer_id-interface -> metadata)
  const [showGroupModal, setShowGroupModal] = useState(false) // Grup atama modal
  const [selectedPeerForGroup, setSelectedPeerForGroup] = useState(null) // Grup atanacak peer

  // Template yönetimi için
  const [availableTemplates, setAvailableTemplates] = useState([]) // Mevcut şablonlar
  const [selectedTemplate, setSelectedTemplate] = useState(null) // Seçili şablon

  // Interface form state
  const [interfaceFormData, setInterfaceFormData] = useState({
    name: '',
    ip_address: '',
    listen_port: '',
    mtu: '1420',
    private_key: '',
    comment: ''
  })
  
  // Form state
  const [formData, setFormData] = useState({
    interface: '',
    name: '',
    private_key: '',
    public_key: '',
    allowed_address: '',
    comment: '',
    persistent_keepalive: '',
    dns: '',
    endpoint_allowed_address: '',
    preshared_key: '',
    mtu: '',
    endpoint_address: '',
    endpoint_port: '',
  })
  
  // Toplu ekleme modu
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkCount, setBulkCount] = useState(1)
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Verileri yükle
  useEffect(() => {
    loadAllData()
    // Her 5 saniyede bir yenile
    const interval = setInterval(loadAllData, 5000)
    return () => clearInterval(interval)
  }, [])

  // Modal açıldığında interface otomatik seç ve şablonları yükle
  useEffect(() => {
    if (showAddModal) {
      // Şablonları yükle
      loadTemplates()

      if (!formData.interface) {
        // Eğer filtre ile bir interface seçilmişse onu kullan
        if (filterInterface && filterInterface !== 'all') {
          setFormData(prev => ({ ...prev, interface: filterInterface }))
        }
        // Veya sadece bir interface varsa onu otomatik seç
        else if (interfaces.length === 1) {
          const interfaceName = interfaces[0].name || interfaces[0]['.id']
          setFormData(prev => ({ ...prev, interface: interfaceName }))
        }
      }
    }
  }, [showAddModal, interfaces, filterInterface])

  const loadAllData = async () => {
    try {
      setLoading(true)
      // Interface'leri yükle
      const interfacesRes = await getInterfaces()
      const interfacesData = interfacesRes.data || []
      setInterfaces(interfacesData)
      
      // Tüm interface'lerden peer'ları topla
      const peersList = []
      for (const iface of interfacesData) {
        try {
          const interfaceName = iface.name || iface['.id']
          const peersRes = await getPeers(interfaceName)
          const peers = (peersRes.data || []).map(peer => {
            // Peer ID'yi kontrol et ve varsayılan değer ekle
            // MikroTik API'den gelen peer verilerinde hem 'id' hem '.id' olabilir
            // Önce 'id' kontrolü yap (MikroTik API genelde 'id' kullanır)
            let peerId = peer.id || peer['.id'] || peer['*id'] || peer['*1']
            
            // Eğer hala None ise, tüm anahtarları kontrol et
            if (!peerId) {
              for (const key in peer) {
                // 'id' veya '.id' anahtarlarını kontrol et, ama 'endpoint' ile başlayanları atla
                if ((key === 'id' || key === '.id' || (key.includes('id') && !key.startsWith('endpoint'))) && peer[key]) {
                  peerId = peer[key]
                  if (peerId) break
                }
              }
            }
            
            // Hala None ise, geçici bir ID oluştur ama logla
            if (!peerId) {
              console.warn('Peer ID bulunamadı, geçici ID oluşturuluyor:', peer)
              peerId = `peer-${Date.now()}-${Math.random()}`
            }
            
            // MikroTik'ten gelen disabled değerini normalize et
            // "true"/"false" string, true/false boolean, veya undefined olabilir
            // MikroTik'te disabled=true ise peer pasif, disabled=false ise peer aktif
            let disabled = peer.disabled
            if (disabled === undefined || disabled === null || disabled === '') {
              disabled = false  // Varsayılan olarak aktif
            } else if (typeof disabled === 'string') {
              // String değerleri kontrol et
              const disabledLower = disabled.toLowerCase().trim()
              disabled = disabledLower === 'true' || disabledLower === 'yes' || disabledLower === '1'
            } else if (typeof disabled === 'boolean') {
              disabled = disabled
            } else {
              // Diğer tipler için boolean'a çevir
              disabled = Boolean(disabled)
            }
            
            // Debug: disabled değerini logla
            if (peerId && (peerId.includes('*') || peerId.includes('5') || peerId.includes('4'))) {
              console.log('Peer disabled normalize:', {
                peerId,
                originalDisabled: peer.disabled,
                normalizedDisabled: disabled,
                type: typeof peer.disabled
              })
            }
            
            // Peer ID'yi kontrol et - None veya geçersiz ise logla
            if (!peerId || peerId === 'undefined' || peerId === 'null' || String(peerId) === 'None') {
              console.warn('Geçersiz peer ID bulundu:', {
                peer,
                peerId,
                interfaceName,
                allKeys: Object.keys(peer)
              })
            }
            
            // Peer ID'yi normalize et - hem 'id' hem '.id' hem '*id' kontrolü yap
            const normalizedPeerId = peer.id || peer['.id'] || peer['*id'] || peerId
            
            return {
              ...peer,
              '.id': String(normalizedPeerId), // String'e çevir ve emin olmak için tekrar set et
              'id': String(normalizedPeerId), // id alanını da set et
              interfaceName: interfaceName,
              interfaceId: iface['.id'],
              disabled: disabled  // Normalize edilmiş değer
            }
          })
          peersList.push(...peers)
        } catch (error) {
          console.error(`Peer listesi alınamadı: ${iface.name}`, error)
        }
      }
      setAllPeers(peersList)

      // Grupları ve peer metadata'larını yükle
      await loadGroupsAndMetadata()
    } catch (error) {
      console.error('Veri yükleme hatası:', error)
    } finally {
      setLoading(false)
    }
  }

  // Grupları ve peer metadata'larını yükle
  const loadGroupsAndMetadata = async () => {
    try {
      // Tüm grupları yükle
      const groupsRes = await getAllPeerGroups()
      if (groupsRes.success) {
        setAvailableGroups(groupsRes.data || [])
      }

      // Tüm peer metadata'larını yükle
      const metadataList = await getAllPeerMetadata()
      const metadataMap = {}
      metadataList.forEach(metadata => {
        const key = `${metadata.peer_id}-${metadata.interface_name}`
        metadataMap[key] = metadata
      })
      setPeerMetadata(metadataMap)
    } catch (error) {
      console.error('Grup/metadata yükleme hatası:', error)
    }
  }

  // Şablonları yükle
  const loadTemplates = async () => {
    try {
      const templates = await getAllTemplates(true) // Sadece aktif şablonlar
      setAvailableTemplates(templates)
    } catch (error) {
      console.error('Şablon yükleme hatası:', error)
    }
  }

  const loadInterfaces = loadAllData // Geriye uyumluluk için

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
        endpoint_address: template.endpoint_address || '',
        endpoint_port: template.endpoint_port || '',
      }))

      alert(`"${template.name}" şablonu seçildi. Formu kontrol edip gerekirse değişiklik yapabilirsiniz.`)
    } catch (error) {
      console.error('Şablon yükleme hatası:', error)
      alert('Şablon yüklenemedi')
    }
  }

  // Interface aç/kapat
  const handleToggle = async (interfaceName, currentState) => {
    try {
      setToggling(interfaceName)
      await toggleInterface(interfaceName, !currentState)
      await loadAllData()
    } catch (error) {
      alert('Interface durumu değiştirilemedi: ' + (error.response?.data?.detail || error.message))
    } finally {
      setToggling(null)
    }
  }

  // IP adresi validasyonu
  const validateIP = (ip) => {
    if (!ip) return false
    // "auto" değerini kabul et (IP Pool'dan otomatik alınacak)
    if (ip.toLowerCase() === 'auto') return true
    // CIDR formatı kontrolü (örn: 192.168.1.1/32 veya 192.168.1.0/24)
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
    if (!cidrRegex.test(ip)) return false
    
    const parts = ip.split('/')
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
    
    return true
  }

  // Sonraki IP adresini hesapla
  const getNextIP = (currentIP, interfaceName) => {
    if (!currentIP) return '10.0.0.2/32'
    
    // Mevcut interface'in peer'larının IP'lerini al
    const interfacePeers = allPeers.filter(p => p.interfaceName === interfaceName)
    const ips = interfacePeers
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
  }

  // Peer ekle
  const handleAddPeer = async (e) => {
    e.preventDefault()
    if (!formData.interface) {
      alert('Lütfen bir interface seçin')
      return
    }

    // Validasyon - Public key kontrolü handleAddPeer içinde yapılıyor

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

    try {
      // Public key kontrolü - zorunlu
      if (!formData.public_key || !formData.public_key.trim()) {
        setAddingPeer(false)
        alert('Genel Anahtar (Public Key) zorunludur. Lütfen anahtar girin veya "Otomatik Oluştur" butonunu kullanın.')
        return
      }

      // Public key duplicate kontrolü
      const publicKeyTrimmed = formData.public_key.trim()
      const existingPeer = allPeers.find(p => {
        const existingPublicKey = p['public-key'] || p.public_key
        return existingPublicKey && existingPublicKey.trim() === publicKeyTrimmed
      })

      if (existingPeer) {
        const peerId = existingPeer['.id'] || existingPeer.id || 'N/A'
        const peerComment = existingPeer.comment || existingPeer.name || 'N/A'
        const confirmDuplicate = confirm(
          `⚠️ UYARI: Bu public key zaten kullanımda!\n\n` +
          `Mevcut Peer:\n` +
          `- ID: ${peerId}\n` +
          `- Comment: ${peerComment}\n` +
          `- Interface: ${existingPeer.interface || 'N/A'}\n\n` +
          `Aynı public key'e sahip iki peer olması güvenlik riski oluşturur ve bağlantı sorunlarına neden olabilir.\n\n` +
          `Yine de devam etmek istiyor musunuz?`
        )
        if (!confirmDuplicate) {
          setAddingPeer(false)
          return
        }
      }

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
      
      const peerData = {
        interface: formData.interface,
        public_key: formData.public_key.trim(),
        allowed_address: finalIP,
        comment: formData.comment.trim() || (formData.name.trim() || undefined),
        persistent_keepalive: formData.persistent_keepalive.trim() || undefined,
      }
      
      // Private key'i mutlaka ekle (QR kod ve config için gerekli)
      // NOT: MikroTik RouterOS'ta peer'lar için private-key alanı YOKTUR
      // Private key sadece veritabanında saklanır ve QR kod/config oluştururken kullanılır
      if (formData.private_key && formData.private_key.trim()) {
        peerData.private_key = formData.private_key.trim()
        console.log('📤 Peer eklenirken private key gönderiliyor (veritabanına kaydedilecek):', {
          private_key_length: peerData.private_key.length,
          public_key_preview: peerData.public_key.substring(0, 20) + '...'
        })
      }
      
      // Advanced options
      if (formData.dns.trim()) peerData.dns = formData.dns.trim()
      // Endpoint'e Erişim İçin İzin Verilen IP Adresleri - varsayılan 192.168.46.1/32
      if (formData.endpoint_allowed_address.trim()) {
        peerData.endpoint_allowed_address = formData.endpoint_allowed_address.trim()
      } else {
        peerData.endpoint_allowed_address = "192.168.46.1/32"
      }
      if (formData.preshared_key.trim()) peerData.preshared_key = formData.preshared_key.trim()
      if (formData.mtu) peerData.mtu = parseInt(formData.mtu)
      if (formData.endpoint_address.trim()) peerData.endpoint_address = formData.endpoint_address.trim()
      if (formData.endpoint_port) peerData.endpoint_port = parseInt(formData.endpoint_port)

      // Template ID ekle (kullanım istatistikleri için)
      if (selectedTemplate) {
        peerData.template_id = selectedTemplate.id
        console.log('📊 Template kullanıldı, ID backend\'e gönderiliyor:', selectedTemplate.id)
      }

      await addPeer(peerData)
      setShowAddModal(false)
      resetForm()
      loadAllData()
    } catch (error) {
      alert('Peer eklenemedi: ' + (error.response?.data?.detail || error.message))
    } finally {
      setAddingPeer(false)
    }
  }

  // Toplu peer ekle
  const handleBulkAdd = async () => {
    if (!formData.interface) {
      alert('Lütfen bir interface seçin')
      return
    }

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

    try {
      // Public key kontrolü - zorunlu
      if (!formData.public_key || !formData.public_key.trim()) {
        setAddingPeer(false)
        alert('Genel Anahtar (Public Key) zorunludur. Lütfen anahtar girin veya "Otomatik Oluştur" butonunu kullanın.')
        return
      }

      // Toplu eklemede her peer için aynı public key kullanılır
      // Private key de aynı olacak (her peer için ayrı private key oluşturmak mantıklı değil)
      // NOT: Toplu eklemede her peer için farklı private key oluşturulmalı
      // Bu yüzden her peer için yeni key çifti oluşturulmalı

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
          interface: formData.interface,
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
        if (formData.preshared_key.trim()) peerData.preshared_key = formData.preshared_key.trim()
        if (formData.mtu) peerData.mtu = parseInt(formData.mtu)

        // Template ID ekle (kullanım istatistikleri için)
        if (selectedTemplate) {
          peerData.template_id = selectedTemplate.id
        }

        await addPeer(peerData)
        
        // Sonraki IP'yi hesapla
        currentIP = getNextIP(currentIP, formData.interface)
      }
      
      setShowAddModal(false)
      resetForm()
      loadAllData()
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
      interface: '',
      name: '',
      private_key: '',
      public_key: '',
      allowed_address: '',
      comment: '',
      persistent_keepalive: '',
      dns: '',
      endpoint_allowed_address: '',
      preshared_key: '',
      mtu: '',
    })
    setBulkMode(false)
    setBulkCount(1)
    setShowPrivateKey(false)
    setShowAdvanced(false)
  }

  // Otomatik anahtar oluştur
  const handleGenerateKeys = async () => {
    try {
      const result = await generateKeys()
      if (result.success && result.private_key && result.public_key) {
        // Otomatik oluşturulan anahtarları form alanlarına doldur
        setFormData({
          ...formData,
          private_key: result.private_key.trim(),
          public_key: result.public_key.trim(),
        })
        setShowPrivateKey(true) // Anahtarları göster
        console.log('✅ Anahtarlar oluşturuldu ve forma dolduruldu:', {
          private_key_length: result.private_key.length,
          public_key_length: result.public_key.length,
          private_key_preview: result.private_key.substring(0, 20) + '...',
          public_key_preview: result.public_key.substring(0, 20) + '...'
        })
        // Alert yerine sessizce başarı mesajı (kullanıcı deneyimi için)
        // alert('Anahtarlar başarıyla oluşturuldu!')
      } else {
        alert('Anahtar oluşturma başarısız: Geçersiz yanıt')
      }
    } catch (error) {
      console.error('Anahtar oluşturma hatası:', error)
      alert('Anahtar oluşturma hatası: ' + (error.response?.data?.detail || error.message))
    }
  }

  // IP Pool'dan sıradaki boş IP'yi getir
  const fetchNextAvailableIP = async () => {
    if (!formData.interface) {
      alert('Önce bir interface seçin')
      return null
    }

    try {
      setLoadingPool(true)
      const response = await api.get(`/wg/next-available-ip/${formData.interface}`)

      if (response.data.success && response.data.has_pool) {
        setPoolInfo(response.data)

        if (response.data.next_ip) {
          // Sıradaki IP'yi /32 ile birlikte formData'ya ekle
          const nextIP = `${response.data.next_ip}/32`
          setFormData(prev => ({
            ...prev,
            allowed_address: nextIP
          }))
          console.log('✅ Sıradaki IP alındı:', response.data.next_ip)
          return nextIP // IP'yi return et
        } else {
          console.warn('⚠️ Pool dolu, boş IP yok')
          alert('IP Pool dolu! Lütfen pool kapasitesini artırın veya manuel IP girin.')
          return null
        }
      } else {
        setPoolInfo(null)
        console.log('ℹ️ Bu interface için IP pool yok')
        alert('Bu interface için IP Pool tanımlanmamış. Manuel IP girin.')
        return null
      }
    } catch (error) {
      console.error('❌ IP pool hatası:', error)
      alert('IP pool bilgisi alınamadı: ' + (error.response?.data?.detail || error.message))
      return null
    } finally {
      setLoadingPool(false)
    }
  }

  // Peer güncelle
  const handleUpdatePeer = async (peerId, interfaceName) => {
    // Peer ID kontrolü
    if (!peerId || peerId === 'undefined' || peerId === 'null' || peerId === undefined || peerId === null) {
      alert('Peer ID bulunamadı. Lütfen sayfayı yenileyin.')
      console.error('Peer ID:', peerId, 'editingPeer:', editingPeer)
      return
    }

    // Allowed IPs'leri birleştir
    const combinedAllowedAddress = allowedIPs.join(', ')

    try {
      await updatePeer(peerId, {
        allowed_address: combinedAllowedAddress,
        comment: editingPeer.comment,
        persistent_keepalive: editingPeer.persistent_keepalive,
        disabled: editingPeer.disabled,
        interface: interfaceName,  // Interface adını gönder
      })
      setEditingPeer(null)
      setAllowedIPs([])
      setNewIP('')
      loadAllData()
    } catch (error) {
      alert('Peer güncellenemedi: ' + (error.response?.data?.detail || error.message))
    }
  }

  // Peer sil
  const handleDeletePeer = async (peerId, interfaceName) => {
    if (!confirm('Bu peer\'ı silmek istediğinizden emin misiniz?')) return

    // Peer ID kontrolü
    if (!peerId || peerId === 'undefined' || peerId === 'null' || peerId === undefined || peerId === null) {
      alert('Peer ID bulunamadı. Lütfen sayfayı yenileyin.')
      console.error('Peer ID:', peerId, 'Interface:', interfaceName)
      return
    }

    try {
      await deletePeer(peerId, interfaceName)
      await loadAllData() // await ekle
      alert('Peer başarıyla silindi')
    } catch (error) {
      console.error('Peer silme hatası:', error)
      alert('Peer silinemedi: ' + (error.response?.data?.detail || error.message))
    }
  }

  // Peer aktif/pasif yap
  const handleTogglePeer = async (peerId, interfaceName, currentDisabled) => {
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
      // togglePeer fonksiyonuna isDisabled gönder (fonksiyon içinde enable hesaplanacak)
      await togglePeer(cleanPeerId, interfaceName, isDisabled)
      // Verileri yenile
      await loadAllData()
    } catch (error) {
      console.error('Peer toggle hatası:', error)
      console.error('Hata detayları:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        peerId: cleanPeerId,
        interfaceName
      })
      alert('Peer durumu değiştirilemedi: ' + (error.response?.data?.detail || error.message))
    } finally {
      setTogglingPeer(null)
    }
  }

  // Toplu seçim - tümünü seç/kaldır
  const handleSelectAll = () => {
    const filtered = getFilteredPeers()
    if (selectedPeers.length === filtered.length) {
      setSelectedPeers([]) // Tümünü kaldır
    } else {
      const peerIds = filtered.map(p => `${p['.id']}-${p.interfaceName}`)
      setSelectedPeers(peerIds) // Tümünü seç
    }
  }

  // Tekil peer seçimi
  const handleSelectPeer = (peerId, interfaceName) => {
    const key = `${peerId}-${interfaceName}`
    setSelectedPeers(prev => {
      if (prev.includes(key)) {
        return prev.filter(id => id !== key)
      } else {
        return [...prev, key]
      }
    })
  }

  // Toplu silme
  const handleBulkDelete = async () => {
    if (selectedPeers.length === 0) {
      alert('Lütfen en az bir peer seçin')
      return
    }

    if (!confirm(`${selectedPeers.length} peer'ı silmek istediğinizden emin misiniz?`)) return

    setBulkActionInProgress(true)
    let successCount = 0
    let errorCount = 0

    for (const peerKey of selectedPeers) {
      const [peerId, interfaceName] = peerKey.split('-')
      try {
        await deletePeer(peerId, interfaceName)
        successCount++
      } catch (error) {
        console.error(`Peer silme hatası (${peerId}):`, error)
        errorCount++
      }
    }

    setBulkActionInProgress(false)
    setSelectedPeers([])
    await loadAllData()

    if (errorCount > 0) {
      alert(`${successCount} peer silindi, ${errorCount} hata oluştu`)
    } else {
      alert(`${successCount} peer başarıyla silindi`)
    }
  }

  // Toplu aktif/pasif yapma
  const handleBulkToggle = async (enable) => {
    if (selectedPeers.length === 0) {
      alert('Lütfen en az bir peer seçin')
      return
    }

    const action = enable ? 'aktif' : 'pasif'
    if (!confirm(`${selectedPeers.length} peer'ı ${action} yapmak istediğinizden emin misiniz?`)) return

    setBulkActionInProgress(true)
    let successCount = 0
    let errorCount = 0

    for (const peerKey of selectedPeers) {
      const [peerId, interfaceName] = peerKey.split('-')
      try {
        // enable = true ise pasif peer'ları aktif yap (isDisabled = false)
        // enable = false ise aktif peer'ları pasif yap (isDisabled = true)
        await togglePeer(peerId, interfaceName, !enable)
        successCount++
      } catch (error) {
        console.error(`Peer toggle hatası (${peerId}):`, error)
        errorCount++
      }
    }

    setBulkActionInProgress(false)
    setSelectedPeers([])
    await loadAllData()

    if (errorCount > 0) {
      alert(`${successCount} peer ${action} yapıldı, ${errorCount} hata oluştu`)
    } else {
      alert(`${successCount} peer başarıyla ${action} yapıldı`)
    }
  }

  // Toplu grup atama
  const handleBulkGroupAssign = async (groupName, groupColor) => {
    if (selectedPeers.length === 0) {
      alert('Lütfen en az bir peer seçin')
      return
    }

    try {
      setBulkActionInProgress(true)

      // Peer ID'leri tuple formatına çevir [(peer_id, interface_name), ...]
      const peerIds = selectedPeers.map(peerKey => {
        const [peerId, interfaceName] = peerKey.split('-')
        return [peerId, interfaceName]
      })

      await bulkUpdatePeerGroup(peerIds, groupName, groupColor)

      setShowGroupModal(false)
      setSelectedPeers([])
      await loadGroupsAndMetadata()

      alert(`${selectedPeers.length} peer'ın grubu "${groupName}" olarak güncellendi`)
    } catch (error) {
      console.error('Toplu grup atama hatası:', error)
      alert('Grup atama hatası: ' + (error.response?.data?.detail || error.message))
    } finally {
      setBulkActionInProgress(false)
    }
  }

  // QR kod göster
  const handleShowQR = async (peerId, interfaceName) => {
    if (!peerId || peerId === 'undefined' || peerId === 'null') {
      alert('Peer ID bulunamadı. Lütfen sayfayı yenileyin.')
      console.error('Peer ID:', peerId, 'Interface:', interfaceName)
      return
    }
    try {
      const response = await getPeerQRCode(peerId, interfaceName)
      setQrData(response)
      setShowQRModal(true)
    } catch (error) {
      console.error('QR kod hatası:', error)
      alert('QR kod oluşturulamadı: ' + (error.response?.data?.detail || error.message))
    }
  }

  // Config dosyası göster/indir ve QR kod üret
  const handleShowConfig = async (peerId, interfaceName) => {
    if (!peerId || peerId === 'undefined' || peerId === 'null') {
      alert('Peer ID bulunamadı. Lütfen sayfayı yenileyin.')
      console.error('Peer ID:', peerId, 'Interface:', interfaceName)
      return
    }
    try {
      // Peer ID'yi encode et (URL'de özel karakterler için)
      const encodedPeerId = encodeURIComponent(peerId)
      
      // Config dosyasını al
      const configResponse = await api.get(`/wg/peer/${encodedPeerId}/config?interface=${encodeURIComponent(interfaceName)}`)
      setConfigData(configResponse.data)
      
      // Config oluştuktan sonra QR kodunu da üret
      try {
        const qrResponse = await getPeerQRCode(peerId, interfaceName)
        setQrData(qrResponse)
      } catch (qrError) {
        console.warn('QR kod oluşturulamadı:', qrError)
        // QR kod hatası config gösterimini engellemez
        setQrData(null)
      }
      
      setShowConfigModal(true)
    } catch (error) {
      console.error('Config dosyası hatası:', error)
      alert('Config dosyası alınamadı: ' + (error.response?.data?.detail || error.message))
    }
  }

  // Config dosyasını indir
  const handleDownloadConfig = (config, peerName) => {
    const configToDownload = config || ''
    const blob = new Blob([configToDownload], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${peerName || 'peer'}.conf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Config kopyala (güncel metni kullan)
  const handleCopyConfig = async (config) => {
    const configToCopy = config || ''
    try {
      // Modern clipboard API'yi dene
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(configToCopy)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } else {
        // Fallback: Eski yöntem (textarea kullanarak)
        const textarea = document.createElement('textarea')
        textarea.value = configToCopy
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

  // Filtrelenmiş ve aranmış peer'ları al
  const getFilteredPeers = () => {
    let filtered = allPeers

    // Interface filtresi
    if (filterInterface !== 'all') {
      filtered = filtered.filter(p => p.interfaceName === filterInterface)
    }

    // Durum filtresi
    if (filterStatus === 'active') {
      filtered = filtered.filter(p => !p.disabled)
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter(p => p.disabled)
    }

    // Grup filtresi
    if (filterGroup !== 'all') {
      filtered = filtered.filter(p => {
        const peerId = p.id || p['.id']
        const key = `${peerId}-${p.interfaceName}`
        const metadata = peerMetadata[key]

        if (filterGroup === 'none') {
          // Grupsuz peer'lar
          return !metadata || !metadata.group_name
        } else {
          // Belirli bir grup
          return metadata && metadata.group_name === filterGroup
        }
      })
    }

    // Arama filtresi
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(p => 
        (p['public-key'] && p['public-key'].toLowerCase().includes(term)) ||
        (p.comment && p.comment.toLowerCase().includes(term)) ||
        (p['allowed-address'] && p['allowed-address'].toLowerCase().includes(term)) ||
        (p.interfaceName && p.interfaceName.toLowerCase().includes(term))
      )
    }

    return filtered
  }

  // İstatistikler
  const stats = {
    total: allPeers.length,
    active: allPeers.filter(p => !p.disabled).length,
    inactive: allPeers.filter(p => p.disabled).length
  }

  return (
    <div className="space-y-6">
      {/* Sayfa başlığı ve aksiyonlar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            WireGuard Interface'leri
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Tüm WireGuard interface'lerini görüntüle ve yönet
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddInterfaceModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Interface Ekle
          </button>
          <button
            onClick={loadInterfaces}
            disabled={loading}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Toplam Interface</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {interfaces.length}
              </p>
            </div>
            <Network className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Toplam Peer</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats.total}
              </p>
            </div>
            <Users className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Aktif Peer</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {stats.active}
              </p>
            </div>
            <UserCheck className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pasif Peer</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {stats.inactive}
              </p>
            </div>
            <UserX className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
        </div>
      </div>

      {/* Interface listesi */}
      {loading && interfaces.length === 0 ? (
        <div className="card text-center py-12">
          <RefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-4 animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Yükleniyor...</p>
        </div>
      ) : interfaces.length === 0 ? (
        <div className="card text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Henüz WireGuard interface'i bulunamadı
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Peer'lar aşağıda listeleniyor
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {interfaces.map((iface, index) => {
            const interfaceName = iface.name || iface['.id']
            const isRunning = iface.running
            const isToggling = toggling === interfaceName
            const interfaceId = iface['.id'] || iface.id || iface['*id'] || index

            return (
              <div key={interfaceId} className="card">
                {/* Interface başlığı */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        isRunning
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}
                    >
                      <Network
                        className={`w-5 h-5 ${
                          isRunning
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-400'
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {interfaceName}
                      </h3>
                      <p
                        className={`text-xs mt-1 ${
                          isRunning
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {isRunning ? 'Aktif' : 'Pasif'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Interface detayları */}
                <div className="space-y-2 mb-4">
                  {iface['ip-address'] && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">IP Address:</span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {iface['ip-address']}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Port:</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {iface['listen-port'] || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">MTU:</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {iface.mtu || 'N/A'}
                    </span>
                  </div>
                  {iface['public-key'] && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Public Key:</span>
                      <span className="text-gray-900 dark:text-white font-mono text-xs">
                        {iface['public-key'].substring(0, 16)}...
                      </span>
                    </div>
                  )}
                </div>

                {/* Aksiyon butonları */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggle(interfaceName, isRunning)}
                    disabled={isToggling}
                    className={`flex-1 btn flex items-center justify-center gap-2 ${
                      isRunning
                        ? 'btn-secondary'
                        : 'btn-primary'
                    }`}
                  >
                    <Power className="w-4 h-4" />
                    {isToggling
                      ? '...'
                      : isRunning
                      ? 'Kapat'
                      : 'Aç'}
                  </button>
                  <Link
                    to={`/wireguard/${interfaceName}`}
                    className="btn btn-secondary flex-1 text-center"
                  >
                    Detaylar
                  </Link>
                  <button
                    onClick={() => {
                      setEditingInterface(iface)
                      setInterfaceFormData({
                        name: interfaceName,
                        listen_port: iface['listen-port'] || '',
                        mtu: iface.mtu || '1420',
                        private_key: '',
                        comment: iface.comment || ''
                      })
                      setShowEditInterfaceModal(true)
                    }}
                    className="btn btn-secondary flex items-center justify-center gap-2"
                    title="Yapılandır"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`'${interfaceName}' interface'ini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve tüm peer'lar silinecektir.`)) return
                      try {
                        await deleteInterface(interfaceName)
                        await loadAllData()
                        alert('Interface başarıyla silindi')
                      } catch (error) {
                        alert('Interface silinemedi: ' + (error.response?.data?.detail || error.message))
                      }
                    }}
                    className="btn btn-secondary text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tüm Peer'lar Listesi */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tüm Peer'lar ({allPeers.length})
          </h2>
          
          {/* Arama ve filtre */}
          <div className="flex flex-col sm:flex-row gap-2 flex-1 md:max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Ara (Public Key, Comment, Address)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>
            <select
              value={filterInterface}
              onChange={(e) => setFilterInterface(e.target.value)}
              className="input"
            >
              <option value="all">Tüm Interface'ler</option>
              {interfaces.map((iface, index) => {
                const ifaceId = iface['.id'] || iface.id || iface['*id'] || index
                return (
                  <option key={ifaceId} value={iface.name || iface['.id']}>
                    {iface.name || iface['.id']}
                  </option>
                )
              })}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input"
            >
              <option value="all">Tümü</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
            </select>
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="input"
            >
              <option value="all">Tüm Gruplar</option>
              <option value="none">Grupsuz</option>
              {availableGroups.map((group, index) => (
                <option key={index} value={group.name}>
                  {group.name} ({group.peer_count})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadAllData}
              className="btn btn-secondary flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Yenile
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Peer Ekle
            </button>
          </div>
        </div>

        {allPeers.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Henüz peer eklenmemiş
          </div>
        ) : getFilteredPeers().length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Arama kriterlerine uygun peer bulunamadı
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Toplu işlem butonları */}
            {selectedPeers.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {selectedPeers.length} peer seçildi
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBulkToggle(true)}
                    disabled={bulkActionInProgress}
                    className="btn btn-sm bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Aktif Yap
                  </button>
                  <button
                    onClick={() => handleBulkToggle(false)}
                    disabled={bulkActionInProgress}
                    className="btn btn-sm bg-yellow-600 text-white hover:bg-yellow-700 disabled:bg-gray-400"
                  >
                    <AlertCircle className="w-4 h-4 mr-1" />
                    Pasif Yap
                  </button>
                  <button
                    onClick={() => setShowGroupModal(true)}
                    disabled={bulkActionInProgress}
                    className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    <Tags className="w-4 h-4 mr-1" />
                    Grup Ata
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkActionInProgress}
                    className="btn btn-sm bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-400"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Sil
                  </button>
                  <button
                    onClick={() => setSelectedPeers([])}
                    disabled={bulkActionInProgress}
                    className="btn btn-sm btn-secondary"
                  >
                    İptal
                  </button>
                </div>
              </div>
            )}

            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 w-12">
                    <input
                      type="checkbox"
                      checked={selectedPeers.length === getFilteredPeers().length && getFilteredPeers().length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Arayüz
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    İsim
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Genel Anahtar
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    İzin Verilen Adres
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Açıklama
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
                {getFilteredPeers().map((peer, index) => {
                  // MikroTik API'den gelen peer verilerinde hem 'id' hem '.id' olabilir
                  const peerId = peer.id || peer['.id'] || peer['*id'] || index
                  const peerKey = `${peerId}-${peer.interfaceName}`
                  const isSelected = selectedPeers.includes(peerKey)

                  return (
                  <tr
                    key={`${peer.interfaceName}-${peerId}`}
                    className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectPeer(peerId, peer.interfaceName)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        to={`/wireguard/${peer.interfaceName}`}
                        className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium"
                      >
                        {peer.interfaceName}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-900 dark:text-white font-medium">
                          {peer.name || peer.comment || '-'}
                        </span>
                        {(() => {
                          const metadata = peerMetadata[peerKey]
                          if (metadata && metadata.group_name) {
                            const groupColor = metadata.group_color || '#6B7280'
                            return (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-white"
                                style={{ backgroundColor: groupColor }}
                              >
                                <Tag className="w-3 h-3" />
                                {metadata.group_name}
                              </span>
                            )
                          }
                          return null
                        })()}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <code className="text-xs text-gray-900 dark:text-white font-mono break-all">
                          {peer['public-key']?.substring(0, 32)}...
                        </code>
                        {(peer.id || peer['.id']) && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            ID: {peer.id || peer['.id']}
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
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {peer.comment || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          peer.disabled
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}
                      >
                        {peer.disabled ? 'Pasif' : 'Aktif'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            // MikroTik API'den gelen peer verilerinde hem 'id' hem '.id' olabilir
                            // Önce 'id' kontrolü yap (MikroTik API genelde 'id' kullanır)
                            const peerId = peer.id || peer['.id'] || peer['*id']
                            if (!peerId) {
                              alert('Peer ID bulunamadı. Lütfen sayfayı yenileyin.')
                              console.error('Peer ID yok:', peer)
                              return
                            }
                            handleTogglePeer(peerId, peer.interfaceName, peer.disabled)
                          }}
                          disabled={togglingPeer === (peer.id || peer['.id'] || peer['*id'])}
                          className={`p-2 rounded ${
                            peer.disabled
                              ? 'hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400'
                              : 'hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                          }`}
                          title={peer.disabled ? 'Aktif Et' : 'Pasif Et'}
                        >
                          {togglingPeer === (peer.id || peer['.id']) ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Power className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            // MikroTik API'den gelen peer verilerinde hem 'id' hem '.id' olabilir
                            const peerId = peer.id || peer['.id'] || peer['*id']
                            if (!peerId) {
                              alert('Peer ID bulunamadı. Lütfen sayfayı yenileyin.')
                              console.error('Peer ID yok:', peer)
                              return
                            }
                            console.log('QR kod için peer ID:', peerId, 'Interface:', peer.interfaceName)
                            handleShowQR(peerId, peer.interfaceName)
                          }}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-blue-600 dark:text-blue-400"
                          title="QR Kod"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            // MikroTik API'den gelen peer verilerinde hem 'id' hem '.id' olabilir
                            const peerId = peer.id || peer['.id'] || peer['*id']
                            if (!peerId) {
                              alert('Peer ID bulunamadı. Lütfen sayfayı yenileyin.')
                              console.error('Peer ID yok:', peer)
                              return
                            }
                            console.log('Config için peer ID:', peerId, 'Interface:', peer.interfaceName)
                            handleShowConfig(peerId, peer.interfaceName)
                          }}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-green-600 dark:text-green-400"
                          title="Config Dosyası"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            const allowedAddressStr = peer['allowed-address'] || peer.allowed_address || ''
                            const ips = allowedAddressStr
                              .split(',')
                              .map(ip => ip.trim())
                              .filter(ip => ip.length > 0)

                            setAllowedIPs(ips)
                            setNewIP('')
                            setEditingPeer({
                              ...peer,
                              allowed_address: allowedAddressStr,
                              persistent_keepalive: peer['persistent-keepalive'] || peer.persistent_keepalive || ''
                            })
                          }}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          title="Düzenle"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            const peerId = peer.id || peer['.id']
                            if (!peerId) {
                              alert('Peer ID bulunamadı.')
                              return
                            }
                            handleDeletePeer(peerId, peer.interfaceName)
                          }}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Peer ekleme modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Yeni Peer Ekle
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

            {/* Toplu Ekleme Modu */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="bulkMode"
                    checked={bulkMode}
                    onChange={(e) => setBulkMode(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="bulkMode" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    Toplu Ekle
                  </label>
                </div>
                {bulkMode && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">Adet:</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={bulkCount}
                      onChange={(e) => setBulkCount(parseInt(e.target.value) || 1)}
                      className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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

            <form onSubmit={bulkMode ? (e) => { e.preventDefault(); handleBulkAdd(); } : handleAddPeer} className="space-y-4">
              {/* Interface */}
              <div className={`p-3 rounded-lg ${!formData.interface ? 'bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700' : 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800'}`}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Interface * {!formData.interface && <span className="text-yellow-600 dark:text-yellow-400 text-xs ml-2">(Lütfen seçin)</span>}
                </label>
                <select
                  value={formData.interface}
                  onChange={(e) => setFormData({ ...formData, interface: e.target.value })}
                  className={`input ${!formData.interface ? 'border-yellow-400 dark:border-yellow-600' : 'border-green-400 dark:border-green-600'}`}
                  required
                >
                  <option value="">Interface Seçin</option>
                  {interfaces.map((iface, index) => {
                    const ifaceId = iface['.id'] || iface.id || iface['*id'] || index
                    return (
                      <option key={ifaceId} value={iface.name || iface['.id']}>
                        {iface.name || iface['.id']}
                      </option>
                    )
                  })}
                </select>
                {!formData.interface && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    Peer eklemek için önce bir interface seçmelisiniz
                  </p>
                )}
              </div>

              {/* Şablon Seçimi */}
              {availableTemplates.length > 0 && (
                <div className="p-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-600" />
                    Şablondan Oluştur (Opsiyonel)
                  </label>
                  <select
                    value={selectedTemplate?.id || ''}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    className="input"
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
                </div>
              )}


              {/* Ad */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ad {bulkMode && '(Otomatik oluşturulacak)'}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="peer-1"
                  disabled={bulkMode}
                />
              </div>

              {/* Özel Anahtar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Özel Anahtar (QR Kodu ve İndirme için zorunlu)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateKeys}
                      className="text-xs px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700"
                    >
                      Otomatik Oluştur
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
                  className="input font-mono text-sm"
                  placeholder="••••••••••••••••••••••••••••••••••••••••••••"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Kendi özel ve genel anahtarınızı kullanın veya otomatik oluşturun
                </p>
              </div>

              {/* Genel Anahtar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Genel Anahtar (Zorunlu) *
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateKeys}
                    className="text-xs px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700"
                  >
                    Otomatik Oluştur
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.public_key}
                  onChange={(e) => setFormData({ ...formData, public_key: e.target.value })}
                  className="input font-mono text-sm"
                  placeholder="Genel anahtarınızı girin veya otomatik oluşturun"
                  required
                />
              </div>

              {/* İzin Verilen IP Adresleri */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    İzin Verilen IP Adresleri (Zorunlu) *
                  </label>
                  <button
                    type="button"
                    onClick={fetchNextAvailableIP}
                    disabled={loadingPool || bulkMode || !formData.interface}
                    className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {loadingPool ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Yükleniyor...
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
                    className={`input font-mono text-sm ${
                      formData.allowed_address && formData.allowed_address.toLowerCase() !== 'auto' && !validateIP(formData.allowed_address)
                        ? 'border-red-500 dark:border-red-500'
                        : ''
                    }`}
                    placeholder="192.168.46.14/32, 192.168.40.0/24 veya 'auto'"
                    required
                  />
                  {formData.allowed_address && formData.allowed_address.toLowerCase() !== 'auto' && !validateIP(formData.allowed_address) && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Geçersiz IP adresi formatı. Örnek: 192.168.46.14/32, birden fazla: 192.168.46.14/32, 192.168.40.0/24 veya 'auto' yazarak otomatik tahsis
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
                        Range: {poolInfo.pool_info.range} |
                        Kullanılabilir: {poolInfo.pool_info.stats.available}/{poolInfo.pool_info.stats.total_ips}
                        ({poolInfo.pool_info.stats.usage_percent}% dolu)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Advanced Options Toggle */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
                >
                  <Settings className="w-4 h-4" />
                  Advanced Options
                  {showAdvanced ? '▼' : '▶'}
                </button>
              </div>

              {/* Advanced Options */}
              {showAdvanced && (
                <div className="space-y-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                  {/* DNS */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      DNS
                    </label>
                    <input
                      type="text"
                      value={formData.dns}
                      onChange={(e) => setFormData({ ...formData, dns: e.target.value })}
                      className="input"
                      placeholder="1.1.1.1"
                    />
                  </div>

                  {/* Endpoint için İzin Verilen IP Adresleri */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Endpoint'e Erişim İçin İzin Verilen IP Adresleri (Zorunlu)
                    </label>
                    <input
                      type="text"
                      value={formData.endpoint_allowed_address}
                      onChange={(e) => setFormData({ ...formData, endpoint_allowed_address: e.target.value })}
                      className="input font-mono text-sm"
                      placeholder="192.168.46.0/24"
                    />
                  </div>

                  {/* Pre-shared Key */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ön Paylaşımlı Anahtar
                    </label>
                    <input
                      type="text"
                      value={formData.preshared_key}
                      onChange={(e) => setFormData({ ...formData, preshared_key: e.target.value })}
                      className="input font-mono text-sm"
                      placeholder="Pre-shared key"
                    />
                  </div>

                  {/* MTU */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      MTU
                    </label>
                    <input
                      type="number"
                      min="1280"
                      max="1500"
                      value={formData.mtu}
                      onChange={(e) => setFormData({ ...formData, mtu: e.target.value })}
                      className="input"
                      placeholder="1420"
                    />
                  </div>

                  {/* Persistent Keepalive */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Sürekli Oturum Süresi
                    </label>
                    <input
                      type="text"
                      value={formData.persistent_keepalive}
                      onChange={(e) => setFormData({ ...formData, persistent_keepalive: e.target.value })}
                      className="input"
                      placeholder="25s"
                    />
                  </div>
                </div>
              )}

              {/* Comment (Basit mod için) */}
              {!showAdvanced && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Comment
                  </label>
                  <input
                    type="text"
                    value={formData.comment}
                    onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                    className="input"
                    placeholder="Açıklama"
                  />
                </div>
              )}

              {/* Butonlar */}
              <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    resetForm()
                  }}
                  disabled={addingPeer}
                  className="flex-1 btn btn-secondary"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={addingPeer}
                  className="flex-1 btn btn-primary flex items-center justify-center gap-2"
                >
                  {addingPeer ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Ekleniyor...
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Peer Düzenle
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Interface
                </label>
                <input
                  type="text"
                  value={editingPeer.interfaceName || ''}
                  className="input"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Allowed Address
                </label>

                {/* Mevcut IP'ler - Chip görünümü */}
                {allowedIPs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    {allowedIPs.map((ip) => (
                      <div
                        key={ip}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium"
                      >
                        <span>{ip}</span>
                        <button
                          onClick={() => {
                            const newIPs = allowedIPs.filter((item) => item !== ip)
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
                          if (trimmedIP.includes('/')) {
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
                    className="input flex-1"
                    placeholder="Yeni IP ekle (örn: 10.0.0.5/32) - Enter'a basın"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmedIP = newIP.trim()
                      if (trimmedIP) {
                        if (trimmedIP.includes('/')) {
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
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  💡 Her IP'yi chip olarak görebilir, X ile kaldırabilir veya yeni IP ekleyebilirsiniz.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Comment
                </label>
                <input
                  type="text"
                  value={editingPeer.comment || ''}
                  onChange={(e) => setEditingPeer({ ...editingPeer, comment: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Persistent Keepalive
                </label>
                <input
                  type="text"
                  value={editingPeer.persistent_keepalive || ''}
                  onChange={(e) => setEditingPeer({ ...editingPeer, persistent_keepalive: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingPeer.disabled || false}
                    onChange={(e) => setEditingPeer({ ...editingPeer, disabled: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Pasif
                  </span>
                </label>
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => {
                    setEditingPeer(null)
                    setAllowedIPs([])
                    setNewIP('')
                  }}
                  className="flex-1 btn btn-secondary"
                >
                  İptal
                </button>
                <button
                  onClick={() => handleUpdatePeer(editingPeer['.id'] || editingPeer.id, editingPeer.interfaceName)}
                  className="flex-1 btn btn-primary"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR kod modal */}
      {/* QR Kod Modal */}
      {showQRModal && qrData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                WireGuard Config QR Kodu
              </h3>
              <button
                onClick={() => setShowQRModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-4">
              {qrData.qrcode ? (
                <img src={qrData.qrcode} alt="QR Code" className="w-64 h-64" />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <p className="text-gray-500 dark:text-gray-400">QR kod oluşturulamadı</p>
                </div>
              )}
              <div className="w-full">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Config:
                  </label>
                  <button
                    onClick={() => handleCopyConfig(qrData.config)}
                    className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Kopyalandı!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Kopyala
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={qrData.config}
                  readOnly
                  className="input font-mono text-xs h-32 resize-none"
                />
              </div>
              <button
                onClick={() => {
                  setShowQRModal(false)
                  setQrData(null)
                }}
                className="w-full btn btn-secondary"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Config Dosyası Modal */}
      {showConfigModal && configData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Peer Configuration File
              </h3>
              <button
                onClick={() => {
                  setShowConfigModal(false)
                  setConfigData(null)
                  setQrData(null)
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {/* QR Code Gösterimi */}
              {qrData && qrData.qrcode && (
                <div className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    QR Code:
                  </label>
                  <img src={qrData.qrcode} alt="QR Code" className="w-64 h-64 border border-gray-300 dark:border-gray-600 rounded" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    QR kodu WireGuard mobil uygulaması ile tarayarak peer'ı ekleyebilirsiniz.
                  </p>
                </div>
              )}

              {/* Configuration Textarea (Salt Okunur) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Configuration:
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyConfig(configData.config)}
                      className="flex items-center gap-2 text-sm px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" />
                          Kopyalandı!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Kopyala
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDownloadConfig(configData.config, configData.peer?.comment || 'peer')}
                      className="flex items-center gap-2 text-sm px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700"
                    >
                      <Download className="w-4 h-4" />
                      İndir
                    </button>
                  </div>
                </div>
                <textarea
                  value={configData.config || ''}
                  readOnly
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900 text-sm font-mono text-gray-900 dark:text-white"
                  rows={15}
                  spellCheck={false}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Config dosyası peer oluşturulurken üretilen private key ile otomatik oluşturulmuştur.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  setShowConfigModal(false)
                  setConfigData(null)
                  setQrData(null)
                }}
                className="flex-1 btn btn-secondary"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interface Ekleme Modal */}
      {showAddInterfaceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Yeni WireGuard Interface Ekle
              </h3>
              <button
                onClick={() => {
                  setShowAddInterfaceModal(false)
                  setInterfaceFormData({
                    name: '',
                    ip_address: '',
                    listen_port: '',
                    mtu: '1420',
                    private_key: '',
                    comment: ''
                  })
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault()
              if (!interfaceFormData.name.trim()) {
                alert('Interface adı zorunludur')
                return
              }
              try {
                const data = {
                  name: interfaceFormData.name.trim(),
                  comment: interfaceFormData.comment.trim() || undefined,
                }
                if (interfaceFormData.ip_address.trim()) {
                  data.ip_address = interfaceFormData.ip_address.trim()
                }
                if (interfaceFormData.listen_port) {
                  data.listen_port = parseInt(interfaceFormData.listen_port)
                }
                if (interfaceFormData.mtu) {
                  data.mtu = parseInt(interfaceFormData.mtu)
                }
                if (interfaceFormData.private_key.trim()) {
                  data.private_key = interfaceFormData.private_key.trim()
                }
                await addInterface(data)
                setShowAddInterfaceModal(false)
                setInterfaceFormData({
                  name: '',
                  ip_address: '',
                  listen_port: '',
                  mtu: '1420',
                  private_key: '',
                  comment: ''
                })
                await loadAllData()
                alert('Interface başarıyla eklendi!')
              } catch (error) {
                alert('Interface eklenemedi: ' + (error.response?.data?.detail || error.message))
              }
            }} className="space-y-4">
              {/* Interface Adı */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Interface Adı *
                </label>
                <input
                  type="text"
                  value={interfaceFormData.name}
                  onChange={(e) => setInterfaceFormData({ ...interfaceFormData, name: e.target.value })}
                  className="input"
                  placeholder="wg0"
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Interface adı (örn: wg0, wg1)
                </p>
              </div>

              {/* IP Adresi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  IP Adresi
                </label>
                <input
                  type="text"
                  value={interfaceFormData.ip_address}
                  onChange={(e) => setInterfaceFormData({ ...interfaceFormData, ip_address: e.target.value })}
                  className="input"
                  placeholder="192.168.200.1/24"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Interface IP adresi (CIDR formatında, örn: 192.168.200.1/24)
                </p>
              </div>

              {/* Listen Port */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Dinleme Portu
                </label>
                <input
                  type="number"
                  min="1024"
                  max="65535"
                  value={interfaceFormData.listen_port}
                  onChange={(e) => setInterfaceFormData({ ...interfaceFormData, listen_port: e.target.value })}
                  className="input"
                  placeholder="51820"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Boş bırakılırsa otomatik port atanır
                </p>
              </div>

              {/* MTU */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  MTU
                </label>
                <input
                  type="number"
                  min="1280"
                  max="1500"
                  value={interfaceFormData.mtu}
                  onChange={(e) => setInterfaceFormData({ ...interfaceFormData, mtu: e.target.value })}
                  className="input"
                  placeholder="1420"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Varsayılan: 1420
                </p>
              </div>

              {/* Private Key */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Private Key (Opsiyonel)
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const result = await generateKeys()
                        if (result.success) {
                          setInterfaceFormData({
                            ...interfaceFormData,
                            private_key: result.private_key
                          })
                          alert('Anahtarlar oluşturuldu!')
                        }
                      } catch (error) {
                        alert('Anahtar oluşturma hatası: ' + (error.response?.data?.detail || error.message))
                      }
                    }}
                    className="text-xs px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700"
                  >
                    Otomatik Oluştur
                  </button>
                </div>
                <input
                  type="password"
                  value={interfaceFormData.private_key}
                  onChange={(e) => setInterfaceFormData({ ...interfaceFormData, private_key: e.target.value })}
                  className="input font-mono text-sm"
                  placeholder="Boş bırakılırsa otomatik oluşturulur"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Boş bırakılırsa MikroTik otomatik oluşturur
                </p>
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Açıklama
                </label>
                <input
                  type="text"
                  value={interfaceFormData.comment}
                  onChange={(e) => setInterfaceFormData({ ...interfaceFormData, comment: e.target.value })}
                  className="input"
                  placeholder="Interface açıklaması"
                />
              </div>

              {/* Butonlar */}
              <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddInterfaceModal(false)
                    setInterfaceFormData({
                      name: '',
                      ip_address: '',
                      listen_port: '',
                      mtu: '1420',
                      private_key: '',
                      comment: ''
                    })
                  }}
                  className="flex-1 btn btn-secondary"
                >
                  İptal
                </button>
                <button type="submit" className="flex-1 btn btn-primary">
                  Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interface Düzenleme Modal */}
      {showEditInterfaceModal && editingInterface && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Interface Yapılandırma
              </h3>
              <button
                onClick={() => {
                  setShowEditInterfaceModal(false)
                  setEditingInterface(null)
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const data = {}
                if (interfaceFormData.listen_port) {
                  data.listen_port = parseInt(interfaceFormData.listen_port)
                }
                if (interfaceFormData.mtu) {
                  data.mtu = parseInt(interfaceFormData.mtu)
                }
                if (interfaceFormData.comment !== undefined) {
                  data.comment = interfaceFormData.comment.trim() || undefined
                }
                await updateInterface(interfaceFormData.name, data)
                setShowEditInterfaceModal(false)
                setEditingInterface(null)
                await loadAllData()
                alert('Interface başarıyla güncellendi!')
              } catch (error) {
                alert('Interface güncellenemedi: ' + (error.response?.data?.detail || error.message))
              }
            }} className="space-y-4">
              {/* Interface Adı (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Interface Adı
                </label>
                <input
                  type="text"
                  value={interfaceFormData.name}
                  className="input bg-gray-100 dark:bg-gray-700"
                  disabled
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Interface adı değiştirilemez
                </p>
              </div>

              {/* Listen Port */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Dinleme Portu
                </label>
                <input
                  type="number"
                  min="1024"
                  max="65535"
                  value={interfaceFormData.listen_port}
                  onChange={(e) => setInterfaceFormData({ ...interfaceFormData, listen_port: e.target.value })}
                  className="input"
                  placeholder="51820"
                />
              </div>

              {/* MTU */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  MTU
                </label>
                <input
                  type="number"
                  min="1280"
                  max="1500"
                  value={interfaceFormData.mtu}
                  onChange={(e) => setInterfaceFormData({ ...interfaceFormData, mtu: e.target.value })}
                  className="input"
                  placeholder="1420"
                />
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Açıklama
                </label>
                <input
                  type="text"
                  value={interfaceFormData.comment}
                  onChange={(e) => setInterfaceFormData({ ...interfaceFormData, comment: e.target.value })}
                  className="input"
                  placeholder="Interface açıklaması"
                />
              </div>

              {/* Public Key (Read-only) */}
              {editingInterface['public-key'] && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Public Key
                  </label>
                  <input
                    type="text"
                    value={editingInterface['public-key']}
                    className="input font-mono text-xs bg-gray-100 dark:bg-gray-700"
                    disabled
                  />
                </div>
              )}

              {/* Butonlar */}
              <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditInterfaceModal(false)
                    setEditingInterface(null)
                  }}
                  className="flex-1 btn btn-secondary"
                >
                  İptal
                </button>
                <button type="submit" className="flex-1 btn btn-primary">
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grup Atama Modal */}
      {showGroupModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Grup Ata ({selectedPeers.size} peer seçili)
              </h3>
              <button
                onClick={() => {
                  setShowGroupModal(false)
                  setSelectedPeerForGroup(null)
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mevcut Gruplar */}
            {availableGroups.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Mevcut Gruplar
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableGroups.map((group) => (
                    <button
                      key={group.name}
                      onClick={async () => {
                        await handleBulkGroupAssign(group.name, group.color)
                        setShowGroupModal(false)
                      }}
                      disabled={bulkActionInProgress}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: group.color }}
                        ></div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {group.name}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {group.peer_count} peer
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Yeni Grup Oluştur */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Yeni Grup Oluştur
              </h4>
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  const formData = new FormData(e.target)
                  const groupName = formData.get('groupName')
                  const groupColor = formData.get('groupColor')

                  if (!groupName || !groupName.trim()) {
                    toast.error('Grup adı boş olamaz')
                    return
                  }

                  await handleBulkGroupAssign(groupName.trim(), groupColor)
                  setShowGroupModal(false)
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Grup Adı
                  </label>
                  <input
                    type="text"
                    name="groupName"
                    placeholder="Örn: Müşteriler, Test, VIP"
                    className="input"
                    disabled={bulkActionInProgress}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Grup Rengi
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      name="groupColor"
                      defaultValue="#3B82F6"
                      className="w-12 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                      disabled={bulkActionInProgress}
                    />
                    <input
                      type="text"
                      name="groupColorHex"
                      placeholder="#3B82F6"
                      className="input flex-1"
                      disabled={bulkActionInProgress}
                      onChange={(e) => {
                        const colorInput = e.target.form.querySelector('input[type="color"]')
                        if (colorInput && /^#[0-9A-F]{6}$/i.test(e.target.value)) {
                          colorInput.value = e.target.value
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowGroupModal(false)
                      setSelectedPeerForGroup(null)
                    }}
                    className="flex-1 btn btn-secondary"
                    disabled={bulkActionInProgress}
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 btn btn-primary"
                    disabled={bulkActionInProgress}
                  >
                    {bulkActionInProgress ? 'Kaydediliyor...' : 'Grup Ata'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WireGuardInterfaces


