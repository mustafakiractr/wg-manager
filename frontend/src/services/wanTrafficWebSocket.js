/**
 * WAN Traffic WebSocket Service
 * Real-time WAN interface traffic streaming
 *
 * Features:
 * - Auto-reconnection with exponential backoff
 * - Rate data (bytes/sec) from server
 * - Multiple listeners support
 * - Connection state management
 */

import useAuthStore from '../store/authStore'

const isDev = import.meta.env.DEV

class WanTrafficWebSocket {
  constructor() {
    this.ws = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10
    this.reconnectDelay = 1000
    this.maxReconnectDelay = 30000
    this.reconnectTimer = null
    this.listeners = new Set()
    this.errorListeners = new Set()
    this.stateListeners = new Set()
    this.isManualClose = false
    this.connectionState = 'disconnected' // disconnected, connecting, connected, error
  }

  /**
   * Get WebSocket URL with JWT token
   */
  getWebSocketUrl() {
    const { accessToken } = useAuthStore.getState()
    if (!accessToken) {
      throw new Error('No access token available')
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/api/v1/ws/wan-traffic?token=${encodeURIComponent(accessToken)}`

    if (isDev) {
      console.log('[WanTraffic WS] Connecting to:', wsUrl.replace(/token=[^&]+/, 'token=<REDACTED>'))
    }

    return wsUrl
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      if (isDev) console.log('[WanTraffic WS] Already connected or connecting')
      return
    }

    try {
      this.setConnectionState('connecting')
      const wsUrl = this.getWebSocketUrl()
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        if (isDev) console.log('[WanTraffic WS] Connected')
        this.reconnectAttempts = 0
        this.reconnectDelay = 1000
        this.setConnectionState('connected')
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          if (isDev && message.type !== 'traffic_update') {
            console.log('[Traffic WS] Message:', message)
          }

          switch (message.type) {
            case 'traffic_update':
              // Broadcast traffic data to all listeners (hem WAN hem WireGuard)
              this.listeners.forEach(listener => {
                try {
                  listener(message.data)
                } catch (err) {
                  console.error('[Traffic WS] Listener error:', err)
                }
              })
              break

            case 'error':
              // Broadcast error to error listeners
              this.errorListeners.forEach(listener => {
                try {
                  listener(message.message)
                } catch (err) {
                  console.error('[Traffic WS] Error listener error:', err)
                }
              })
              break

            case 'ping':
              this.send('pong')
              break

            case 'pong':
            case 'connected':
              // Acknowledged
              break
          }
        } catch (err) {
          console.error('[Traffic WS] Parse error:', err)
        }
      }

      this.ws.onerror = (error) => {
        console.error('[WanTraffic WS] Error:', error)
        this.setConnectionState('error')
      }

      this.ws.onclose = (event) => {
        if (isDev) {
          console.log('[WanTraffic WS] Closed:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          })
        }

        this.setConnectionState('disconnected')

        // Don't reconnect if manually closed or auth failed
        if (this.isManualClose || event.code === 1008) {
          if (isDev) console.log('[WanTraffic WS] Not reconnecting')
          return
        }

        this.scheduleReconnect()
      }

    } catch (error) {
      console.error('[WanTraffic WS] Connection error:', error)
      this.setConnectionState('error')
      this.scheduleReconnect()
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    this.isManualClose = true

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
      console.error('[WanTraffic WS] Max reconnect attempts reached')
      this.setConnectionState('error')
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    )

    if (isDev) {
      console.log(`[WanTraffic WS] Reconnecting in ${delay}ms (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
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
   * Add traffic data listener
   * @param {Function} callback - Called with traffic data object
   * @returns {Function} Unsubscribe function
   */
  addListener(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * Add error listener
   * @param {Function} callback - Called with error message
   * @returns {Function} Unsubscribe function
   */
  addErrorListener(callback) {
    this.errorListeners.add(callback)
    return () => this.errorListeners.delete(callback)
  }

  /**
   * Add connection state listener
   * @param {Function} callback - Called with state string
   * @returns {Function} Unsubscribe function
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
        console.error('[WanTraffic WS] State listener error:', err)
      }
    })
  }

  /**
   * Get current connection state
   */
  getConnectionState() {
    return this.connectionState
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connectionState === 'connected'
  }
}

// Singleton instance
const wanTrafficWebSocket = new WanTrafficWebSocket()

export default wanTrafficWebSocket
