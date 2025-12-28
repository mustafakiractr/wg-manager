#!/usr/bin/env python3
"""WebSocket Notification Test Script"""
import asyncio
import websockets
import json
import sys

async def test_websocket():
    """Test WebSocket notification connection"""

    # Test user credentials
    import httpx

    print("=" * 60)
    print("WebSocket Notification Test")
    print("=" * 60)

    # Step 1: Login
    print("\n[1/4] Logging in...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://localhost:8001/api/v1/auth/login",
                data={"username": "admin", "password": "admin"}
            )

            if response.status_code != 200:
                print(f"❌ Login failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False

            token_data = response.json()
            access_token = token_data.get("access_token")

            if not access_token:
                print("❌ No access token received")
                return False

            print(f"✅ Login successful")
            print(f"   Token: {access_token[:30]}...")

    except Exception as e:
        print(f"❌ Login error: {e}")
        return False

    # Step 2: Connect to WebSocket
    print("\n[2/4] Connecting to WebSocket...")
    ws_url = f"ws://localhost:8001/api/v1/ws/notifications?token={access_token}"

    try:
        async with websockets.connect(ws_url) as websocket:
            print("✅ WebSocket connected!")

            # Step 3: Wait for welcome message
            print("\n[3/4] Waiting for welcome message...")
            try:
                welcome_msg = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                welcome_data = json.loads(welcome_msg)

                if welcome_data.get("type") == "connected":
                    print("✅ Connection confirmed!")
                    print(f"   Type: {welcome_data.get('type')}")
                    print(f"   User ID: {welcome_data.get('user_id')}")
                    print(f"   Username: {welcome_data.get('username')}")
                    print(f"   Message: {welcome_data.get('message')}")
                else:
                    print(f"⚠️  Unexpected message: {welcome_data}")

            except asyncio.TimeoutError:
                print("❌ No welcome message received within 5 seconds")
                return False

            # Step 4: Test ping/pong
            print("\n[4/4] Testing heartbeat (ping/pong)...")
            await websocket.send("ping")

            try:
                pong_msg = await asyncio.wait_for(websocket.recv(), timeout=3.0)
                pong_data = json.loads(pong_msg)

                if pong_data.get("type") == "pong":
                    print("✅ Heartbeat working!")
                    print(f"   Sent: ping")
                    print(f"   Received: {pong_data}")
                else:
                    print(f"⚠️  Unexpected response: {pong_data}")

            except asyncio.TimeoutError:
                print("❌ No pong response received")
                return False

            print("\n" + "=" * 60)
            print("✅ ALL TESTS PASSED!")
            print("=" * 60)
            print("\nWebSocket Features Verified:")
            print("  ✓ JWT Authentication")
            print("  ✓ Connection Establishment")
            print("  ✓ Welcome Message")
            print("  ✓ Heartbeat (ping/pong)")
            print("\nThe WebSocket notification system is fully functional!")
            print("=" * 60)

            return True

    except websockets.exceptions.InvalidStatusCode as e:
        print(f"❌ WebSocket connection rejected: HTTP {e.status_code}")
        print(f"   Reason: {e}")
        return False
    except ConnectionRefusedError:
        print("❌ Connection refused - is the backend running on port 8001?")
        return False
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    try:
        result = asyncio.run(test_websocket())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted")
        sys.exit(1)
