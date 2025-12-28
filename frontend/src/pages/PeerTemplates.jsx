import React, { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import {
  FileText, Plus, Edit2, Trash2, Power, Eye, Copy,
  X, Save, Tag, Clock, TrendingUp
} from 'lucide-react'
import * as peerTemplateService from '../services/peerTemplateService'

const PeerTemplates = () => {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [previewData, setPreviewData] = useState(null)
  const [filterActive, setFilterActive] = useState('all')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    allowed_address: 'auto',
    endpoint_address: '',
    endpoint_port: '',
    persistent_keepalive: 0,
    preshared_key: '',
    group_name: '',
    group_color: '#3B82F6',
    tags: '',
    notes_template: ''
  })

  useEffect(() => {
    loadTemplates()
  }, [filterActive])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const isActive = filterActive === 'all' ? null : filterActive === 'active'
      const data = await peerTemplateService.getAllTemplates(isActive)
      setTemplates(data)
    } catch (error) {
      console.error('Şablonlar yüklenirken hata:', error)
      toast.error('Şablonlar yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (template = null) => {
    if (template) {
      setEditingTemplate(template)
      setFormData({
        name: template.name || '',
        description: template.description || '',
        allowed_address: template.allowed_address || 'auto',
        endpoint_address: template.endpoint_address || '',
        endpoint_port: template.endpoint_port || '',
        persistent_keepalive: template.persistent_keepalive || 0,
        preshared_key: template.preshared_key || '',
        group_name: template.group_name || '',
        group_color: template.group_color || '#3B82F6',
        tags: template.tags || '',
        notes_template: template.notes_template || ''
      })
    } else {
      setEditingTemplate(null)
      setFormData({
        name: '',
        description: '',
        allowed_address: 'auto',
        endpoint_address: '',
        endpoint_port: '',
        persistent_keepalive: 0,
        preshared_key: '',
        group_name: '',
        group_color: '#3B82F6',
        tags: '',
        notes_template: ''
      })
    }
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      if (editingTemplate) {
        await peerTemplateService.updateTemplate(editingTemplate.id, formData)
        toast.success('Şablon güncellendi')
      } else {
        await peerTemplateService.createTemplate(formData)
        toast.success('Şablon oluşturuldu')
      }

      setShowModal(false)
      loadTemplates()
    } catch (error) {
      console.error('Şablon kaydedilirken hata:', error)
      toast.error(error.response?.data?.detail || 'Şablon kaydedilemedi')
    }
  }

  const handleDelete = async (template) => {
    if (!window.confirm(`"${template.name}" şablonunu silmek istediğinizden emin misiniz?`)) {
      return
    }

    try {
      await peerTemplateService.deleteTemplate(template.id)
      toast.success('Şablon silindi')
      loadTemplates()
    } catch (error) {
      console.error('Şablon silinirken hata:', error)
      toast.error('Şablon silinemedi')
    }
  }

  const handleToggleActive = async (template) => {
    try {
      await peerTemplateService.toggleTemplateActive(template.id)
      toast.success(`Şablon ${template.is_active ? 'pasif' : 'aktif'} yapıldı`)
      loadTemplates()
    } catch (error) {
      console.error('Şablon durumu değiştirilirken hata:', error)
      toast.error('Şablon durumu değiştirilemedi')
    }
  }

  const handlePreview = async (template) => {
    try {
      const data = await peerTemplateService.previewTemplate(template.id)
      setPreviewData(data)
      setShowPreviewModal(true)
    } catch (error) {
      console.error('Şablon önizlenirken hata:', error)
      toast.error('Şablon önizlenemedi')
    }
  }

  const handleCopyTemplate = (template) => {
    setFormData({
      name: `${template.name} (Kopya)`,
      description: template.description || '',
      allowed_address: template.allowed_address || 'auto',
      endpoint_address: template.endpoint_address || '',
      endpoint_port: template.endpoint_port || '',
      persistent_keepalive: template.persistent_keepalive || 0,
      preshared_key: template.preshared_key || '',
      group_name: template.group_name || '',
      group_color: template.group_color || '#3B82F6',
      tags: template.tags || '',
      notes_template: template.notes_template || ''
    })
    setEditingTemplate(null)
    setShowModal(true)
  }

  const filteredTemplates = templates

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Peer Şablonları
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Sık kullanılan peer konfigürasyonlarını şablon olarak kaydedin
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          Yeni Şablon
        </button>
      </div>

      {/* Filtreler */}
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Durum:
          </span>
          {['all', 'active', 'inactive'].map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterActive(filter)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                filterActive === filter
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {filter === 'all' ? 'Tümü' : filter === 'active' ? 'Aktif' : 'Pasif'}
            </button>
          ))}
        </div>
      </div>

      {/* Şablon Listesi */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            Yükleniyor...
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            Henüz şablon oluşturulmamış
          </div>
        ) : (
          filteredTemplates.map((template) => (
            <div
              key={template.id}
              className={`card p-4 ${!template.is_active ? 'opacity-60' : ''}`}
            >
              {/* Başlık */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {template.name}
                  </h3>
                  {template.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {template.description}
                    </p>
                  )}
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  template.is_active
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {template.is_active ? 'Aktif' : 'Pasif'}
                </div>
              </div>

              {/* Grup Badge */}
              {template.group_name && (
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: template.group_color }}
                  ></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {template.group_name}
                  </span>
                </div>
              )}

              {/* Kullanım İstatistikleri */}
              <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400 mb-3">
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>{template.usage_count || 0} kullanım</span>
                </div>
                {template.last_used_at && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(template.last_used_at).toLocaleDateString('tr-TR')}</span>
                  </div>
                )}
              </div>

              {/* Etiketler */}
              {template.tags && (
                <div className="flex items-center gap-1 mb-3">
                  <Tag className="w-3 h-3 text-gray-500" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {template.tags}
                  </span>
                </div>
              )}

              {/* Aksiyon Butonları */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handlePreview(template)}
                  className="flex-1 btn btn-sm bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
                  title="Önizle"
                >
                  <Eye className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleCopyTemplate(template)}
                  className="flex-1 btn btn-sm bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/30"
                  title="Kopyala"
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleOpenModal(template)}
                  className="flex-1 btn btn-sm bg-yellow-50 text-yellow-600 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:hover:bg-yellow-900/30"
                  title="Düzenle"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleToggleActive(template)}
                  className={`flex-1 btn btn-sm ${
                    template.is_active
                      ? 'bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400'
                      : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400'
                  }`}
                  title={template.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                >
                  <Power className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDelete(template)}
                  className="flex-1 btn btn-sm bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                  title="Sil"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Şablon Oluştur/Düzenle Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingTemplate ? 'Şablonu Düzenle' : 'Yeni Şablon Oluştur'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Şablon Bilgileri */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Şablon Adı *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                  placeholder="Örn: Standart Müşteri, VPN Kullanıcısı"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Açıklama
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  rows="2"
                  placeholder="Şablon hakkında kısa açıklama"
                />
              </div>

              {/* Peer Konfigürasyonu */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Peer Konfigürasyonu
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      İzin Verilen IP
                    </label>
                    <input
                      type="text"
                      value={formData.allowed_address}
                      onChange={(e) => setFormData({ ...formData, allowed_address: e.target.value })}
                      className="input"
                      placeholder="auto, 10.10.0.1/32"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      "auto" yazmak IP Pool'dan otomatik alır
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Keepalive (saniye)
                    </label>
                    <input
                      type="number"
                      value={formData.persistent_keepalive}
                      onChange={(e) => setFormData({ ...formData, persistent_keepalive: parseInt(e.target.value) })}
                      className="input"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Endpoint Adresi
                    </label>
                    <input
                      type="text"
                      value={formData.endpoint_address}
                      onChange={(e) => setFormData({ ...formData, endpoint_address: e.target.value })}
                      className="input"
                      placeholder="vpn.example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Endpoint Portu
                    </label>
                    <input
                      type="number"
                      value={formData.endpoint_port}
                      onChange={(e) => setFormData({ ...formData, endpoint_port: parseInt(e.target.value) || '' })}
                      className="input"
                      placeholder="51820"
                    />
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Varsayılan Metadata
                </h4>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Grup Adı
                      </label>
                      <input
                        type="text"
                        value={formData.group_name}
                        onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
                        className="input"
                        placeholder="Örn: Müşteriler"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Grup Rengi
                      </label>
                      <input
                        type="color"
                        value={formData.group_color}
                        onChange={(e) => setFormData({ ...formData, group_color: e.target.value })}
                        className="w-full h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Etiketler
                    </label>
                    <input
                      type="text"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      className="input"
                      placeholder="vpn, remote, production"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Not Şablonu
                    </label>
                    <textarea
                      value={formData.notes_template}
                      onChange={(e) => setFormData({ ...formData, notes_template: e.target.value })}
                      className="input"
                      rows="2"
                      placeholder="Peer oluşturuldu: {date}"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Değişkenler: {'{date}'}, {'{datetime}'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Butonlar */}
              <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 btn btn-secondary"
                >
                  İptal
                </button>
                <button type="submit" className="flex-1 btn btn-primary">
                  <Save className="w-4 h-4" />
                  {editingTemplate ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Önizleme Modal */}
      {showPreviewModal && previewData && (
        <div className="modal-overlay">
          <div className="modal-content max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Şablon Önizleme: {previewData.template_name}
              </h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <pre className="text-sm text-gray-800 dark:text-gray-200 overflow-x-auto">
                {JSON.stringify(previewData.peer_data, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="btn btn-secondary"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PeerTemplates
