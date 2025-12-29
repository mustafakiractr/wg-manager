import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Database,
  HardDrive,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Calendar,
  Clock,
  FileText,
  AlertCircle,
  CheckCircle,
  Info,
  Archive
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function BackupManagement() {
  const [backups, setBackups] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const toast = useToast();

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [createType, setCreateType] = useState('database');
  const [description, setDescription] = useState('');
  const [createBeforeRestore, setCreateBeforeRestore] = useState(true);

  useEffect(() => {
    loadData();
  }, [filterType]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load backups
      const backupsRes = await axios.get(`${API_URL}/backup/list`, {
        params: filterType !== 'all' ? { backup_type: filterType } : {},
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setBackups(backupsRes.data.backups || []);

      // Load stats
      const statsRes = await axios.get(`${API_URL}/backup/stats`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setStats(statsRes.data.stats);

    } catch (error) {
      console.error('Error loading backups:', error);
      toast.error('Backup verileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setCreating(true);

      await axios.post(
        `${API_URL}/backup/create`,
        {
          backup_type: createType,
          description: description || `${createType === 'database' ? 'Database' : 'Full'} backup - ${new Date().toLocaleString()}`
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      toast.success('Backup başarıyla oluşturuldu');
      setShowCreateModal(false);
      setDescription('');
      loadData();
    } catch (error) {
      console.error('Error creating backup:', error);
      toast.error(error.response?.data?.detail || 'Backup oluşturulamadı');
    } finally {
      setCreating(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return;

    try {
      setCreating(true);

      await axios.post(
        `${API_URL}/backup/restore`,
        {
          backup_name: selectedBackup.filename || selectedBackup.dirname,
          backup_type: selectedBackup.backup_type,
          create_backup_before: createBeforeRestore
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      toast.success('Backup başarıyla geri yüklendi');
      setShowRestoreModal(false);
      setSelectedBackup(null);

      if (selectedBackup.backup_type === 'full') {
        toast.warning('Full backup restore edildi. Servisleri yeniden başlatmanız gerekebilir.');
      }

      loadData();
    } catch (error) {
      console.error('Error restoring backup:', error);
      toast.error(error.response?.data?.detail || 'Backup geri yüklenemedi');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBackup = async (backup) => {
    if (!confirm(`"${backup.filename || backup.dirname}" backup'ını silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/backup/delete`, {
        data: { backup_name: backup.filename || backup.dirname },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      toast.success('Backup silindi');
      loadData();
    } catch (error) {
      console.error('Error deleting backup:', error);
      toast.error(error.response?.data?.detail || 'Backup silinemedi');
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Archive className="w-8 h-8 mr-3 text-blue-600" />
            Backup Yönetimi
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Veritabanı ve sistem yedeklerini yönetin
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadData}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg flex items-center transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Yenile
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Yeni Backup
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Toplam Backup</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.total_backups}
                </p>
              </div>
              <Archive className="w-10 h-10 text-blue-600" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Database</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.database_backups}
                </p>
              </div>
              <Database className="w-10 h-10 text-green-600" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Full Backup</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.full_backups}
                </p>
              </div>
              <HardDrive className="w-10 h-10 text-purple-600" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Toplam Boyut</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.total_size_mb} MB
                </p>
              </div>
              <HardDrive className="w-10 h-10 text-orange-600" />
            </div>
          </div>
        </div>
      )}

      {/* Latest Backup Info */}
      {stats?.latest_backup && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Son Backup: {stats.latest_backup.filename || stats.latest_backup.dirname}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                {formatDate(stats.latest_backup.datetime)} - {formatBytes(stats.latest_backup.size)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2">
        {['all', 'database', 'full'].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === type
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {type === 'all' ? 'Tümü' : type === 'database' ? 'Database' : 'Full Backup'}
          </button>
        ))}
      </div>

      {/* Backups List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Backup Adı
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tip
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tarih
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Boyut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Açıklama
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    <Archive className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>Henüz backup oluşturulmamış</p>
                  </td>
                </tr>
              ) : (
                backups.map((backup, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {backup.backup_type === 'database' ? (
                          <Database className="w-5 h-5 text-green-600 mr-3" />
                        ) : (
                          <HardDrive className="w-5 h-5 text-purple-600 mr-3" />
                        )}
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {backup.filename || backup.dirname}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        backup.backup_type === 'database'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                      }`}>
                        {backup.backup_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900 dark:text-gray-300">
                        <Clock className="w-4 h-4 mr-2 text-gray-400" />
                        {formatDate(backup.datetime)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {formatBytes(backup.size)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {backup.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedBackup(backup);
                            setShowRestoreModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          title="Geri Yükle"
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(backup)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Backup Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Yeni Backup Oluştur
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Backup Tipi
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setCreateType('database')}
                      className={`p-4 border-2 rounded-lg transition-colors ${
                        createType === 'database'
                          ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                      }`}
                    >
                      <Database className={`w-8 h-8 mx-auto mb-2 ${
                        createType === 'database' ? 'text-green-600' : 'text-gray-400'
                      }`} />
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Database</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Sadece veritabanı</p>
                    </button>

                    <button
                      onClick={() => setCreateType('full')}
                      className={`p-4 border-2 rounded-lg transition-colors ${
                        createType === 'full'
                          ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-purple-400'
                      }`}
                    >
                      <HardDrive className={`w-8 h-8 mx-auto mb-2 ${
                        createType === 'full' ? 'text-purple-600' : 'text-gray-400'
                      }`} />
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Full</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">DB + Config</p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Açıklama (Opsiyonel)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Backup açıklaması..."
                  />
                </div>

                {createType === 'full' && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <div className="flex">
                      <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2 flex-shrink-0" />
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        Full backup, database ve .env dosyasını içerir. Hassas bilgiler içerebilir.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setDescription('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  disabled={creating}
                >
                  İptal
                </button>
                <button
                  onClick={handleCreateBackup}
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Oluştur
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restore Backup Modal */}
      {showRestoreModal && selectedBackup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Backup Geri Yükle
              </h3>

              <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                        Dikkat! Bu işlem mevcut verileri değiştirecek.
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        {selectedBackup.filename || selectedBackup.dirname} backup'ı geri yüklenecek.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="createBeforeRestore"
                    checked={createBeforeRestore}
                    onChange={(e) => setCreateBeforeRestore(e.target.checked)}
                    className="mt-1 mr-3"
                  />
                  <label htmlFor="createBeforeRestore" className="text-sm text-gray-700 dark:text-gray-300">
                    Geri yüklemeden önce mevcut durumu yedekle (önerilir)
                  </label>
                </div>

                {selectedBackup.backup_type === 'full' && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <div className="flex">
                      <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2 flex-shrink-0" />
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        Full backup restore sonrası backend servisi yeniden başlatılmalıdır.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowRestoreModal(false);
                    setSelectedBackup(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  disabled={creating}
                >
                  İptal
                </button>
                <button
                  onClick={handleRestoreBackup}
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Geri Yükle
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
