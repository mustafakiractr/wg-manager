/**
 * Kullanıcı ayarları sayfası
 * Profil bilgileri ve güvenlik ayarları
 */
import { useState } from 'react'
import { Settings as SettingsIcon, User, Shield, Smartphone } from 'lucide-react'
import ProfileSettings from '../components/ProfileSettings'
import TwoFactorSettings from '../components/TwoFactorSettings'
import ActiveDevices from '../components/ActiveDevices'

function Settings() {
  const [activeTab, setActiveTab] = useState('profile')

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <SettingsIcon className="w-8 h-8 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Ayarlar
          </h1>
        </div>
      </div>

      {/* Tab menü */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'profile'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            <User className="w-5 h-5 inline-block mr-2" />
            Profil
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'security'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            <Shield className="w-5 h-5 inline-block mr-2" />
            Güvenlik
          </button>
          <button
            onClick={() => setActiveTab('devices')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'devices'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            <Smartphone className="w-5 h-5 inline-block mr-2" />
            Cihazlar
          </button>
        </nav>
      </div>

      {/* Tab içeriği */}
      <div>
        <div className={activeTab === 'profile' ? 'block' : 'hidden'}>
          <div className="space-y-6">
            <ProfileSettings />
          </div>
        </div>

        <div className={activeTab === 'security' ? 'block' : 'hidden'}>
          <div className="space-y-6">
            <TwoFactorSettings />
          </div>
        </div>

        <div className={activeTab === 'devices' ? 'block' : 'hidden'}>
          <div className="space-y-6">
            <ActiveDevices />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
