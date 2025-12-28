#!/bin/bash
# Simple WebSocket Test Script

echo "=========================================="
echo "WebSocket Notification Test"
echo "=========================================="

# Step 1: Get JWT token
echo ""
echo "[1/2] Getting JWT token..."
TOKEN=$(curl -s -X POST "http://localhost:8001/api/v1/auth/login" -d "username=admin&password=admin" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token"
  exit 1
fi

echo "✅ Token received: ${TOKEN:0:40}..."

# Step 2: Save token for Python WebSocket test
echo ""
echo "[2/2] Testing WebSocket connection..."
export WS_TOKEN="$TOKEN"

# Create simple WebSocket test
cat > /tmp/ws_test.py << 'PYEOF'
import asyncio
import websockets
import json
import os
import sys

async def test():
    token = os.environ.get('WS_TOKEN')
    url = f"ws://localhost:8001/api/v1/ws/notifications?token={token}"

    print(f"Connecting to: {url[:60]}...")

    try:
        async with websockets.connect(url) as ws:
            print("✅ WebSocket connected!")

            # Wait for welcome message
            msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
            data = json.loads(msg)

            print(f"✅ Received: {data.get('type')}")
            print(f"   User ID: {data.get('user_id')}")
            print(f"   Username: {data.get('username')}")

            # Test ping/pong
            await ws.send("ping")
            pong = await asyncio.wait_for(ws.recv(), timeout=3.0)
            pong_data = json.loads(pong)
            print(f"✅ Heartbeat: {pong_data.get('type')}")

            print("\n" + "=" * 50)
            print("✅ ALL TESTS PASSED!")
            print("=" * 50)
            return True

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    result = asyncio.run(test())
    sys.exit(0 if result else 1)
PYEOF

# Run the Python test
/root/wg/backend/venv/bin/python /tmp/ws_test.py
TEST_RESULT=$?

# Cleanup
rm /tmp/ws_test.py

exit $TEST_RESULT
