/**
 * Browser Console Test for WebSocket Notifications
 *
 * INSTRUCTIONS:
 * 1. Open the frontend in your browser (http://localhost:5173)
 * 2. Login as admin
 * 3. Open browser console (F12 → Console tab)
 * 4. Copy and paste this entire script
 * 5. The test will run automatically and show results
 */

(async function testWebSocketNotifications() {
    console.log('═'.repeat(60));
    console.log('🧪 WebSocket Notification System Test');
    console.log('═'.repeat(60));

    // Get access token from localStorage
    const authData = JSON.parse(localStorage.getItem('auth-storage') || '{}');
    const accessToken = authData.state?.accessToken;

    if (!accessToken) {
        console.error('❌ No access token found. Please login first!');
        return;
    }

    console.log('✅ Access token found:', accessToken.substring(0, 20) + '...');

    // Test 1: WebSocket Connection
    console.log('\n[1/4] Testing WebSocket connection...');
    const wsUrl = `ws://localhost:8001/api/v1/ws/notifications?token=${accessToken}`;

    try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('✅ WebSocket connection opened');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('📨 Message received:', data);

            if (data.type === 'connected') {
                console.log('✅ Connection confirmed');
                console.log('   User ID:', data.user_id);
                console.log('   Username:', data.username);

                // Test 2: Send ping
                console.log('\n[2/4] Testing heartbeat (ping)...');
                ws.send('ping');
            }
            else if (data.type === 'pong') {
                console.log('✅ Heartbeat working (received pong)');

                // Test 3: Check NotificationContext
                console.log('\n[3/4] Checking NotificationContext integration...');
                const notificationIcon = document.querySelector('[class*="Bell"]');
                if (notificationIcon) {
                    console.log('✅ Notification icon found in UI');
                    const unreadBadge = notificationIcon.parentElement.querySelector('[class*="rounded-full"]');
                    if (unreadBadge) {
                        console.log('   Unread count badge:', unreadBadge.textContent);
                    }
                } else {
                    console.warn('⚠️  Notification icon not found (might be on a different page)');
                }

                // Test 4: Create test notification
                console.log('\n[4/4] Creating test notification...');
                fetch('http://localhost:8001/api/v1/notifications/', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
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
                .then(notification => {
                    console.log('✅ Notification created via REST API');
                    console.log('   ID:', notification.id);
                    console.log('   Waiting for WebSocket delivery...');
                })
                .catch(err => {
                    console.error('❌ Failed to create notification:', err);
                });
            }
            else if (data.type === 'notification') {
                console.log('🎉 ✅ NOTIFICATION RECEIVED VIA WEBSOCKET!');
                console.log('   Title:', data.data.title);
                console.log('   Message:', data.data.message);
                console.log('   Type:', data.data.type);
                console.log('\n' + '═'.repeat(60));
                console.log('✅ ALL TESTS PASSED!');
                console.log('   • WebSocket connection: ✓');
                console.log('   • Authentication: ✓');
                console.log('   • Heartbeat (ping/pong): ✓');
                console.log('   • Real-time notification delivery: ✓');
                console.log('═'.repeat(60));

                // Close connection after successful test
                setTimeout(() => {
                    ws.close();
                    console.log('🔌 WebSocket connection closed');
                }, 2000);
            }
            else if (data.type === 'ping') {
                console.log('📨 Server sent ping (keepalive)');
                ws.send('pong');
            }
        };

        ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
        };

        ws.onclose = (event) => {
            console.log('🔌 WebSocket closed:', event.code, event.reason);
        };

    } catch (error) {
        console.error('❌ WebSocket connection failed:', error);
    }
})();
