#!/bin/bash
# Service status checker for WireGuard Manager

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Service Status Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check backend
echo -e "${YELLOW}Backend (Port 8001):${NC}"
if lsof -ti :8001 > /dev/null 2>&1; then
    pid=$(lsof -ti :8001)
    if curl -s http://localhost:8001/health > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Running (PID: $pid)${NC}"
        echo -e "  ${GREEN}✓ Health check: OK${NC}"
        echo -e "  ${BLUE}  URL: http://localhost:8001${NC}"
        echo -e "  ${BLUE}  Docs: http://localhost:8001/docs${NC}"
    else
        echo -e "  ${YELLOW}⚠ Process running but not responding (PID: $pid)${NC}"
    fi
else
    echo -e "  ${RED}✗ Not running${NC}"
fi

echo ""

# Check frontend
echo -e "${YELLOW}Frontend (Port 5173):${NC}"
if lsof -ti :5173 > /dev/null 2>&1; then
    pid=$(lsof -ti :5173)
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Running (PID: $pid)${NC}"
        echo -e "  ${GREEN}✓ Health check: OK${NC}"
        echo -e "  ${BLUE}  Local: http://localhost:5173${NC}"
        # Get network IP if available
        network_url=$(grep "Network:" /tmp/frontend.log 2>/dev/null | tail -1 | awk '{print $NF}')
        if [ -n "$network_url" ]; then
            echo -e "  ${BLUE}  Network: $network_url${NC}"
        fi
    else
        echo -e "  ${YELLOW}⚠ Process running but not responding (PID: $pid)${NC}"
    fi
else
    echo -e "  ${RED}✗ Not running${NC}"
fi

echo ""

# Check logs
echo -e "${YELLOW}Logs:${NC}"
echo -e "  ${BLUE}Backend:  /tmp/backend.log${NC}"
echo -e "  ${BLUE}Frontend: /tmp/frontend.log${NC}"

# Script directory detection (if not already set)
if [ -z "$SCRIPT_DIR" ]; then
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    PROJECT_DIR="$SCRIPT_DIR"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Commands:${NC}"
echo -e "  ${GREEN}$PROJECT_DIR/restart_services.sh${NC} - Restart both services"
echo -e "  ${GREEN}$PROJECT_DIR/rs${NC}                   - Quick restart shortcut"
echo -e "${BLUE}========================================${NC}"
