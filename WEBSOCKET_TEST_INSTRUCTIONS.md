# WebSocket Notification System - Test Instructions

## ✅ System Status

- **Backend**: Running on port 8001 ✓
- **Frontend**: Running on port 5173 ✓
- **Vite Proxy**: WebSocket support enabled ✓
- **Database**: Migration completed ✓

## 🧪 Test 1: Automatic WebSocket Connection

### Steps:
1. Open your browser and navigate to: `http://localhost:5173`
2. Login with credentials:
   - Username: `admin`
   - Password: `admin`
3. Open Browser Developer Console (F12 → Console tab)
4. Look for the following log messages:

```
[WebSocket] Connecting to: ws://localhost:5173/api/v1/ws/notifications?token=<REDACTED>
[WebSocket] Connection opened
[WebSocket] Connected message: { type: "connected", user_id: X, username: "admin" }
```

### Expected Results:
- ✅ WebSocket connection established automatically after login
- ✅ Console shows "Connection opened" message
- ✅ Notification icon in header (Bell icon)
- ✅ Connection indicator shows green wifi icon (real-time connected)

### Troubleshooting:
If connection fails, check:
- Backend logs: `tail -f /root/wg/backend/backend_startup.log | grep -i websocket`
- Browser console for error messages
- Network tab (Filter: WS) shows WebSocket connection

---

## 🧪 Test 2: Real-time Notification Delivery

### Option A: Browser Console Test

1. **While logged in**, open browser console (F12)
2. Copy and paste this code:

```javascript
// Create test notification
fetch('http://localhost:8001/api/v1/notifications/', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${JSON.parse(localStorage.getItem('auth-storage')).state.accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'info',
    title: 'WebSocket Test',
    message: `Test notification at ${new Date().toLocaleTimeString()}`,
    data: { test: true }
  })
})
.then(res => res.json())
.then(data => console.log('Notification created:', data))
.catch(err => console.error('Error:', err))
```

3. Watch the console for WebSocket message delivery
4. Check the notification dropdown (Bell icon) - notification should appear instantly

### Option B: Using Provided Test Script

Run the browser test script (already created):
```bash
cat /root/wg/test_websocket_browser.js
```

Copy entire content and paste into browser console.

### Expected Results:
- ✅ Notification appears in console via WebSocket (< 1 second)
- ✅ Unread badge updates on Bell icon
- ✅ Notification dropdown shows new notification
- ✅ Real-time delivery confirmed

---

## 🧪 Test 3: Heartbeat (Ping/Pong)

### Steps:
1. Open browser console
2. Find the WebSocket connection in Network tab (WS filter)
3. After 30 seconds, you should see:
   - Server sends: `{"type": "ping"}`
   - Client responds: `pong`

### Expected Results:
- ✅ Server sends ping every 30 seconds
- ✅ Client automatically responds with pong
- ✅ Connection stays alive

---

## 🧪 Test 4: Polling Fallback

### Steps:
1. Open browser console
2. Open Network tab
3. Simulate WebSocket failure (close connection):

```javascript
// Get WebSocket service from window (exposed for debugging)
const wsService = window.__notificationWS
if (wsService) {
  wsService.ws.close()
  console.log('WebSocket manually closed')
}
```

4. Wait for 3 reconnection attempts to fail
5. System should automatically switch to polling mode

### Expected Results:
- ✅ After 3 failed reconnection attempts, polling activates
- ✅ Network tab shows: `GET /api/v1/notifications/unread-count` every 30 seconds
- ✅ Connection indicator shows yellow wifi icon (polling mode)
- ✅ Notifications still work (via polling)

---

## 🧪 Test 5: Multi-Tab Support

### Steps:
1. Open the application in two separate browser tabs
2. Login in both tabs
3. Create a notification (use Option A from Test 2)

### Expected Results:
- ✅ Both tabs receive the notification via WebSocket
- ✅ Both tabs show updated unread count
- ✅ Each tab has its own WebSocket connection

---

## 🧪 Test 6: Token Refresh Reconnection

### Steps:
1. Login and wait for token to approach expiry (30 minutes)
2. Or manually trigger token refresh:

```javascript
// Trigger token refresh
const authStore = JSON.parse(localStorage.getItem('auth-storage'))
// Wait for automatic refresh, then check WebSocket reconnects
```

### Expected Results:
- ✅ When token refreshes, WebSocket disconnects and reconnects with new token
- ✅ No notification loss during reconnection
- ✅ Connection indicator may briefly show yellow (reconnecting) then green

---

## 📊 Backend Verification

### Check WebSocket Connections in Backend Logs:

```bash
# Monitor WebSocket connections
tail -f /root/wg/backend/backend_startup.log | grep -i "websocket\|notification"

# Look for:
# - "WebSocket authentication successful for user: admin (ID: X)"
# - "User X (admin) disconnected from notifications WebSocket"
```

### Check Active Connections:

```bash
# See who's connected
lsof -i :8001 | grep ESTABLISHED
```

---

## 🐛 Debugging

### If WebSocket Won't Connect:

1. **Check Vite proxy is working**:
```bash
curl -I http://localhost:5173/api/v1/mikrotik/status
# Should return 200 OK from backend
```

2. **Check WebSocket endpoint is accessible**:
```bash
# View backend routes
grep -r "ws/notifications" /root/wg/backend/app/api/websocket.py
```

3. **Check browser console for errors**:
   - Look for "WebSocket connection failed"
   - Look for 403 Forbidden (auth issue)
   - Look for connection refused (backend down)

4. **Check backend is running**:
```bash
curl http://localhost:8001/api/v1/mikrotik/status
```

5. **Check frontend env has access token**:
```javascript
// In browser console
console.log(JSON.parse(localStorage.getItem('auth-storage')))
```

### Common Issues:

| Issue | Solution |
|-------|----------|
| 403 Forbidden | Token invalid or expired - re-login |
| Connection refused | Backend not running - check port 8001 |
| No messages received | Check NotificationService broadcasts |
| Polling instead of WS | Check Vite proxy `ws: true` is enabled |
| Multiple reconnects | Check token validity and backend logs |

---

## ✅ Success Criteria

All tests passing means:

- [x] WebSocket connects automatically on login
- [x] Notifications delivered in real-time (< 1s latency)
- [x] No cross-user notification leaks
- [x] Heartbeat keeps connection alive
- [x] Automatic reconnection works
- [x] Polling fallback activates when WebSocket fails
- [x] Multi-tab support works
- [x] Token refresh doesn't interrupt notification flow

---

## 📝 Additional Notes

### WebSocket URL:
```
ws://localhost:5173/api/v1/ws/notifications?token=<JWT>
```
This goes through Vite proxy which forwards to:
```
ws://192.168.40.38:8001/api/v1/ws/notifications?token=<JWT>
```

### Backend WebSocket Endpoint:
```python
# File: /root/wg/backend/app/api/websocket.py
@router.websocket("/ws/notifications")
async def notifications_websocket(websocket: WebSocket, token: Optional[str] = None)
```

### Frontend WebSocket Service:
```javascript
// File: /root/wg/frontend/src/services/websocket.js
// Auto-connects when NotificationContext mounts
// Handles reconnection, heartbeat, token refresh
```

### NotificationContext:
```javascript
// File: /root/wg/frontend/src/context/NotificationContext.jsx
// Provides global state and WebSocket/polling logic
// Used by NotificationDropdown component
```

---

**Test Date**: 2025-12-25
**Backend**: FastAPI + WebSocket + AsyncIO
**Frontend**: React + WebSocket API + Context
**Status**: Ready for Testing ✅
