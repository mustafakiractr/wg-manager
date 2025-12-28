/**
 * Notification Context
 * Manages notification state with WebSocket + polling fallback
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import notificationWebSocket from '../services/websocket'
import api from '../services/api'
import useAuthStore from '../store/authStore'

const NotificationContext = createContext()

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [connectionState, setConnectionState] = useState('disconnected')
  const [usePolling, setUsePolling] = useState(false)

  const { isAuthenticated, accessToken } = useAuthStore()
  const pollingIntervalRef = useRef(null)
  const wsFailureCountRef = useRef(0)
  const prevTokenRef = useRef(null)

  /**
   * Fetch notifications from REST API (fallback)
   */
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await api.get('/notifications', {
        params: { limit: 50 }
      })
      if (response.data.success) {
        setNotifications(response.data.notifications || [])
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }, [])

  /**
   * Fetch unread count from REST API
   */
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await api.get('/notifications/unread-count')
      if (response.data.success) {
        setUnreadCount(response.data.count || 0)
      }
    } catch (error) {
      console.error('Error fetching unread count:', error)
    }
  }, [])

  /**
   * Handle new notification from WebSocket
   */
  const handleWebSocketNotification = useCallback((notification) => {
    // Add to notifications list
    setNotifications(prev => [notification, ...prev])

    // Increment unread count if not read
    if (!notification.read) {
      setUnreadCount(prev => prev + 1)
    }

    // Reset WS failure count on successful message
    wsFailureCountRef.current = 0
  }, [])

  /**
   * Handle WebSocket connection state changes
   */
  const handleWebSocketStateChange = useCallback((state) => {
    setConnectionState(state)

    // If WebSocket fails multiple times, switch to polling
    if (state === 'error') {
      wsFailureCountRef.current++
      if (wsFailureCountRef.current >= 3) {
        console.warn('WebSocket failed multiple times, switching to polling mode')
        setUsePolling(true)
      }
    } else if (state === 'connected') {
      // WebSocket reconnected successfully, disable polling
      setUsePolling(false)
      wsFailureCountRef.current = 0

      // Fetch latest notifications on reconnect
      fetchNotifications()
      fetchUnreadCount()
    }
  }, [fetchNotifications, fetchUnreadCount])

  /**
   * Start polling fallback
   */
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return

    console.log('Starting polling fallback (30s interval)')
    fetchUnreadCount() // Initial fetch

    pollingIntervalRef.current = setInterval(() => {
      fetchUnreadCount()
    }, 30000) // 30 seconds
  }, [fetchUnreadCount])

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
      console.log('Stopped polling')
    }
  }, [])

  /**
   * Mark notification as read
   */
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await api.post(`/notifications/${notificationId}/read`)

      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n
        )
      )

      // Decrement unread count
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
      throw error
    }
  }, [])

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    try {
      await api.post('/notifications/read-all')

      // Update local state
      const now = new Date().toISOString()
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true, read_at: now }))
      )
      setUnreadCount(0)
    } catch (error) {
      console.error('Error marking all as read:', error)
      throw error
    }
  }, [])

  /**
   * Delete notification
   */
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`)

      // Update local state
      setNotifications(prev => {
        const notification = prev.find(n => n.id === notificationId)
        if (notification && !notification.read) {
          setUnreadCount(count => Math.max(0, count - 1))
        }
        return prev.filter(n => n.id !== notificationId)
      })
    } catch (error) {
      console.error('Error deleting notification:', error)
      throw error
    }
  }, [])

  /**
   * Refresh notifications manually
   */
  const refresh = useCallback(async () => {
    await Promise.all([fetchNotifications(), fetchUnreadCount()])
  }, [fetchNotifications, fetchUnreadCount])

  // Setup WebSocket or polling based on authentication
  useEffect(() => {
    if (!isAuthenticated) {
      notificationWebSocket.disconnect()
      stopPolling()
      setNotifications([])
      setUnreadCount(0)
      return
    }

    // Add WebSocket listeners
    const unsubscribeNotification = notificationWebSocket.addListener(handleWebSocketNotification)
    const unsubscribeState = notificationWebSocket.addStateListener(handleWebSocketStateChange)

    // Try WebSocket first
    notificationWebSocket.connect()

    // Cleanup
    return () => {
      unsubscribeNotification()
      unsubscribeState()
    }
  }, [isAuthenticated, handleWebSocketNotification, handleWebSocketStateChange, stopPolling])

  // Handle polling fallback
  useEffect(() => {
    if (usePolling && isAuthenticated) {
      startPolling()
    } else {
      stopPolling()
    }

    return () => stopPolling()
  }, [usePolling, isAuthenticated, startPolling, stopPolling])

  // Reconnect WebSocket when token changes (after refresh)
  useEffect(() => {
    // Only reconnect if token actually changed (not on initial mount)
    if (isAuthenticated && accessToken && prevTokenRef.current && prevTokenRef.current !== accessToken) {
      // Token changed, reconnect WebSocket
      if (connectionState === 'connected') {
        notificationWebSocket.disconnect()
        setTimeout(() => {
          notificationWebSocket.connect()
        }, 100)
      }
    }
    // Update previous token reference
    prevTokenRef.current = accessToken
  }, [accessToken, isAuthenticated, connectionState])

  const value = {
    notifications,
    unreadCount,
    connectionState,
    usePolling,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
    fetchNotifications, // For dropdown to load on open
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}
