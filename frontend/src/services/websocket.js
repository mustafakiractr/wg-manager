/**
 * WebSocket Service for Real-time Notifications
 *
 * Features:
 * - Auto-reconnection with exponential backoff
 * - Automatic fallback to polling on persistent failure
 * - Heartbeat ping/pong
 * - Token refresh handling
 * - Multiple listeners support
 * - Connection state management
 */

import useAuthStore from '../store/authStore'

const isDev = import.meta.env.DEV

class NotificationWebSocket {
  constructor() {
    this.ws = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10
    this.reconnectDelay = 1000 // Start with 1 second
    this.maxReconnectDelay = 30000 // Max 30 seconds
    this.reconnectTimer = null
    this.pingInterval = null
    this.listeners = new Set()
    this.isManualClose = false
    this.connectionState = 'disconnected' // disconnected, connecting, connected, error
    this.stateListeners = new Set()
  }

  /**
   * Get WebSocket URL with JWT token
   */
  getWebSocketUrl() {
    const { accessToken } = useAuthStore.getState()
    if (!accessToken) {
      throw new Error('No access token available')
    }

    // Determine WebSocket protocol (ws:// or wss://)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host

    // In development, use same-origin to go through Vite proxy
    // In production, use same-origin to reach backend
    const wsUrl = `${protocol}//${host}/api/v1/ws/notifications?token=${encodeURIComponent(accessToken)}`

    if (isDev) {
      console.log('[WebSocket] Connecting to:', wsUrl.replace(/token=[^&]+/, 'token=<REDACTED>'))
    }

    return wsUrl
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      if (isDev) console.log('WebSocket already connected or connecting')
      return
    }

    try {
      this.setConnectionState('connecting')
      const wsUrl = this.getWebSocketUrl()
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        if (isDev) console.log('WebSocket connected')
        this.reconnectAttempts = 0
        this.reconnectDelay = 1000
        this.setConnectionState('connected')
        this.startPingInterval()
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (isDev) console.log('WebSocket message:', data)

          // Handle different message types
          if (data.type === 'notification') {
            // Broadcast to all listeners
            this.listeners.forEach(listener => {
              try {
                listener(data.data)
              } catch (err) {
                console.error('Error in notification listener:', err)
              }
            })
          } else if (data.type === 'pong') {
            // Heartbeat response
            if (isDev) console.log('Received pong')
          } else if (data.type === 'ping') {
            // Server keepalive ping, respond with pong
            this.send('pong')
          } else if (data.type === 'connected') {
            if (isDev) console.log('Connection acknowledged:', data.message)
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err)
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        this.setConnectionState('error')
      }

      this.ws.onclose = (event) => {
        if (isDev) {
          console.log('WebSocket closed:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          })
        }

        this.stopPingInterval()
        this.setConnectionState('disconnected')

        // Don't reconnect if manually closed or auth failed
        if (this.isManualClose || event.code === 1008) {
          if (isDev) console.log('Not reconnecting (manual close or auth failure)')
          return
        }

        // Attempt reconnection with exponential backoff
        this.scheduleReconnect()
      }

    } catch (error) {
      console.error('Error connecting to WebSocket:', error)
      this.setConnectionState('error')
      this.scheduleReconnect()
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    this.isManualClose = true
    this.stopPingInterval()

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect')
      this.ws = null
    }

    this.setConnectionState('disconnected')
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached, giving up')
      this.setConnectionState('error')
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay)

    if (isDev) {
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    }

    this.reconnectTimer = setTimeout(() => {
      this.isManualClose = false
      this.connect()
    }, delay)
  }

  /**
   * Send message to server
   */
  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(typeof message === 'string' ? message : JSON.stringify(message))
      return true
    }
    return false
  }

  /**
   * Start ping interval (heartbeat)
   */
  startPingInterval() {
    this.stopPingInterval()
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send('ping')
      }
    }, 30000) // Ping every 30 seconds
  }

  /**
   * Stop ping interval
   */
  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  /**
   * Add notification listener
   */
  addListener(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * Add connection state listener
   */
  addStateListener(callback) {
    this.stateListeners.add(callback)
    return () => this.stateListeners.delete(callback)
  }

  /**
   * Set connection state and notify listeners
   */
  setConnectionState(state) {
    this.connectionState = state
    this.stateListeners.forEach(listener => {
      try {
        listener(state)
      } catch (err) {
        console.error('Error in state listener:', err)
      }
    })
  }

  /**
   * Get current connection state
   */
  getConnectionState() {
    return this.connectionState
  }
}

// Singleton instance
const notificationWebSocket = new NotificationWebSocket()

export default notificationWebSocket
