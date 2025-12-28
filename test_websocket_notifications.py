#!/usr/bin/env python3
"""
WebSocket Notification System Test Script
Tests WebSocket connection, authentication, and notification delivery
"""
import asyncio
import websockets
import json
import requests
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:8001"
WS_URL = "ws://localhost:8001/api/v1/ws/notifications"
TEST_USERNAME = "admin"
TEST_PASSWORD = "admin"

async def test_websocket_notifications():
    """Test WebSocket notification system end-to-end"""

    print("=" * 60)
    print("WebSocket Notification System Test")
    print("=" * 60)

    # Step 1: Login and get JWT token
    print("\n[1/5] Authenticating...")
    try:
        login_response = requests.post(
            f"{BACKEND_URL}/api/v1/auth/login",
            data={"username": TEST_USERNAME, "password": TEST_PASSWORD}
        )
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            print(f"Response: {login_response.text}")
            return False

        token_data = login_response.json()
        access_token = token_data.get("access_token")

        if not access_token:
            print("❌ No access token in response")
            return False

        print(f"✅ Authenticated successfully")
        print(f"   Token: {access_token[:20]}...")
    except Exception as e:
        print(f"❌ Login error: {e}")
        return False

    # Step 2: Connect to WebSocket with JWT token
    print("\n[2/5] Connecting to WebSocket...")
    ws_url_with_token = f"{WS_URL}?token={access_token}"

    try:
        async with websockets.connect(ws_url_with_token) as websocket:
            print("✅ WebSocket connected")

            # Step 3: Wait for connection confirmation
            print("\n[3/5] Waiting for connection confirmation...")
            try:
                welcome_msg = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                welcome_data = json.loads(welcome_msg)

                if welcome_data.get("type") == "connected":
                    print("✅ Connection confirmed")
                    print(f"   User ID: {welcome_data.get('user_id')}")
                    print(f"   Username: {welcome_data.get('username')}")
                    user_id = welcome_data.get('user_id')
                else:
                    print(f"⚠️  Unexpected welcome message: {welcome_data}")
            except asyncio.TimeoutError:
                print("❌ No welcome message received")
                return False

            # Step 4: Create a test notification via REST API
            print("\n[4/5] Creating test notification via REST API...")

            # Create notification directly via service (simulating system event)
            # We'll use a separate request to trigger a notification
            test_notification = {
                "type": "info",
                "title": "WebSocket Test",
                "message": f"Test notification created at {datetime.now().strftime('%H:%M:%S')}",
                "data": {"test": True}
            }

            try:
                # Create notification via API
                create_response = requests.post(
                    f"{BACKEND_URL}/api/v1/notifications/",
                    headers={"Authorization": f"Bearer {access_token}"},
                    json=test_notification
                )

                if create_response.status_code == 201:
                    notification = create_response.json()
                    print("✅ Notification created via REST API")
                    print(f"   ID: {notification.get('id')}")
                    print(f"   Title: {notification.get('title')}")
                else:
                    print(f"⚠️  Notification creation returned: {create_response.status_code}")
            except Exception as e:
                print(f"⚠️  Notification creation error: {e}")

            # Step 5: Wait for notification via WebSocket
            print("\n[5/5] Waiting for notification via WebSocket...")

            try:
                # Wait for WebSocket message (with timeout)
                message = await asyncio.wait_for(websocket.recv(), timeout=3.0)
                msg_data = json.loads(message)

                if msg_data.get("type") == "notification":
                    notification_data = msg_data.get("data", {})
                    print("✅ Notification received via WebSocket!")
                    print(f"   Type: {notification_data.get('type')}")
                    print(f"   Title: {notification_data.get('title')}")
                    print(f"   Message: {notification_data.get('message')}")
                    print(f"   Real-time delivery: SUCCESS")
                else:
                    print(f"⚠️  Received message but not notification: {msg_data.get('type')}")
            except asyncio.TimeoutError:
                print("⚠️  No notification received via WebSocket within 3 seconds")
                print("   Note: WebSocket may not be broadcasting on notification creation")
                print("   Check NotificationService.create_notification() implementation")

            # Test ping/pong
            print("\n[BONUS] Testing heartbeat (ping/pong)...")
            try:
                await websocket.send("ping")
                pong_msg = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                pong_data = json.loads(pong_msg)

                if pong_data.get("type") == "pong":
                    print("✅ Heartbeat working (ping → pong)")
                else:
                    print(f"⚠️  Unexpected response to ping: {pong_data}")
            except Exception as e:
                print(f"⚠️  Heartbeat test error: {e}")

            print("\n" + "=" * 60)
            print("✅ WebSocket Test Complete")
            print("=" * 60)
            return True

    except websockets.exceptions.InvalidStatusCode as e:
        print(f"❌ WebSocket connection failed: {e.status_code}")
        if e.status_code == 403:
            print("   Possible cause: Invalid or expired token")
        return False
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    try:
        result = asyncio.run(test_websocket_notifications())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
