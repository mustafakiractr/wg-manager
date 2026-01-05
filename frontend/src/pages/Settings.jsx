/**
 * Kullanıcı ayarları sayfası
 * Profil bilgileri ve güvenlik ayarları
 */
import { useState } from 'react'
import { Settings as SettingsIcon, User, Shield, Smartphone, Bell, MessageSquare } from 'lucide-react'
import ProfileSettings from '../components/ProfileSettings'
import TwoFactorSettings from '../components/TwoFactorSettings'
import ActiveDevices from '../components/ActiveDevices'
import TelegramSettings from '../components/TelegramSettings'
import TelegramDashboard from '../components/TelegramDashboard'

function Settings() {
  const [activeTab, setActiveTab] = useState('profile')

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-0">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <SettingsIcon className="w-6 h-6 sm:w-8 sm:h-8 text-primary-600" />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Ayarlar
          </h1>
        </div>
      </div>

      {/* Tab menü */}
      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="-mb-px flex space-x-2 sm:space-x-4 md:space-x-8 min-w-max">
          <button
            onClick={() => setActiveTab('profile')}
            className={`
              py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap
              ${activeTab === 'profile'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            <User className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Profil</span>
            <span className="sm:hidden">Profil</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`
              py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap
              ${activeTab === 'security'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Güvenlik</span>
            <span className="sm:hidden">2FA</span>
          </button>
          <button
            onClick={() => setActiveTab('devices')}
            className={`
              py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap
              ${activeTab === 'devices'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Cihazlar</span>
            <span className="sm:hidden">Cihaz</span>
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`
              py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap
              ${activeTab === 'notifications'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            <Bell className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Bildirimler</span>
            <span className="sm:hidden">Bildir.</span>
          </button>
          <button
            onClick={() => setActiveTab('telegram-logs')}
            className={`
              py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap
              ${activeTab === 'telegram-logs'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-1 sm:mr-2" />
            <span className="hidden md:inline">Telegram Geçmişi</span>
            <span className="md:hidden">Telegram</span>
          </button>
        </nav>
      </div>

      {/* Tab içeriği */}
      <div>
        <div className={activeTab === 'profile' ? 'block' : 'hidden'}>
          <div className="space-y-4 sm:space-y-6">
            <ProfileSettings />
          </div>
        </div>

        <div className={activeTab === 'security' ? 'block' : 'hidden'}>
          <div className="space-y-4 sm:space-y-6">
            <TwoFactorSettings />
          </div>
        </div>

        <div className={activeTab === 'devices' ? 'block' : 'hidden'}>
          <div className="space-y-4 sm:space-y-6">
            <ActiveDevices />
          </div>
        </div>

        <div className={activeTab === 'notifications' ? 'block' : 'hidden'}>
          <div className="space-y-4 sm:space-y-6">
            <TelegramSettings />
          </div>
        </div>

        <div className={activeTab === 'telegram-logs' ? 'block' : 'hidden'}>
          <div className="space-y-4 sm:space-y-6">
            <TelegramDashboard />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
