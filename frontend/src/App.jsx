/**
 * Ana App bileşeni
 * Router ve temel layout yapısını içerir
 */
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { ToastProvider } from './context/ToastContext'
import { NotificationProvider } from './context/NotificationContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import WireGuardInterfaces from './pages/WireGuardInterfaces'
import WireGuardInterfaceDetail from './pages/WireGuardInterfaceDetail'
import MikroTikConnection from './pages/MikroTikConnection'
import Logs from './pages/Logs'
import TrafficHistory from './pages/TrafficHistory'
import Users from './pages/Users'
import ActivityLogs from './pages/ActivityLogs'
import Settings from './pages/Settings'
import IPPoolManagement from './pages/IPPoolManagement'
import PeerTemplates from './pages/PeerTemplates'
import BackupManagement from './pages/BackupManagement'
import Layout from './components/Layout'

// Protected Route bileşeni - giriş yapmamış kullanıcıları login'e yönlendirir
function ProtectedRoute({ children }) {
  try {
    const { isAuthenticated } = useAuthStore()
    return isAuthenticated ? children : <Navigate to="/login" replace />
  } catch (error) {
    console.error('ProtectedRoute error:', error)
    return <Navigate to="/login" replace />
  }
}

function App() {
  try {
    return (
      <ToastProvider>
        <NotificationProvider>
          <Router>
          <Routes>
            {/* Login sayfası - giriş yapmış kullanıcılar dashboard'a yönlendirilir */}
            <Route path="/login" element={<Login />} />

            {/* Protected routes - Layout içinde gösterilir */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="wireguard" element={<WireGuardInterfaces />} />
              <Route path="wireguard/:interfaceName" element={<WireGuardInterfaceDetail />} />
              <Route path="mikrotik" element={<MikroTikConnection />} />
              <Route path="ip-pools" element={<IPPoolManagement />} />
              <Route path="peer-templates" element={<PeerTemplates />} />
              <Route path="logs" element={<Logs />} />
              <Route path="traffic" element={<TrafficHistory />} />
              <Route path="users" element={<Users />} />
              <Route path="activity" element={<ActivityLogs />} />
              <Route path="backup" element={<BackupManagement />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </Router>
        </NotificationProvider>
      </ToastProvider>
    )
  } catch (error) {
    console.error('App render error:', error)
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial' }}>
        <h1 style={{ color: 'red' }}>Uygulama Hatası</h1>
        <p><strong>{error.message}</strong></p>
        <pre style={{ background: '#f0f0f0', padding: '10px', overflow: 'auto' }}>
          {error.stack || 'Stack trace yok'}
        </pre>
      </div>
    )
  }
}

export default App


