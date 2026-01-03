#!/bin/bash
# Automated service restart script for WireGuard Manager
# Restarts both backend and frontend services

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory detection
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$SCRIPT_DIR"

# Directories
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
LOG_DIR="/tmp"

# Log files
BACKEND_LOG="${LOG_DIR}/backend.log"
FRONTEND_LOG="${LOG_DIR}/frontend.log"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  WireGuard Manager Service Restart${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to stop backend by port
stop_backend_by_port() {
    echo -e "${YELLOW}Stopping Backend (port 8001)...${NC}"

    # Find process using port 8001
    pids=$(lsof -ti :8001 2>/dev/null)

    if [ -z "$pids" ]; then
        echo -e "${YELLOW}  ℹ No process using port 8001${NC}"
        return 0
    fi

    for pid in $pids; do
        kill $pid 2>/dev/null || true
        echo -e "${GREEN}  ✓ Stopped process on port 8001 (PID: $pid)${NC}"
    done

    # Wait for process to stop
    sleep 2

    # Force kill if still running
    pids=$(lsof -ti :8001 2>/dev/null)
    if [ -n "$pids" ]; then
        for pid in $pids; do
            kill -9 $pid 2>/dev/null || true
            echo -e "${YELLOW}  ⚠ Force killed process on port 8001 (PID: $pid)${NC}"
        done
        sleep 1
    fi
}

# Function to stop a process
stop_process() {
    local process_name=$1
    local search_pattern=$2

    echo -e "${YELLOW}Stopping ${process_name}...${NC}"

    # Find and kill the process
    pids=$(ps aux | grep -E "${search_pattern}" | grep -v grep | awk '{print $2}')

    if [ -z "$pids" ]; then
        echo -e "${YELLOW}  ℹ No running ${process_name} process found${NC}"
        return 0
    fi

    for pid in $pids; do
        kill $pid 2>/dev/null || true
        echo -e "${GREEN}  ✓ Stopped ${process_name} (PID: $pid)${NC}"
    done

    # Wait for process to stop
    sleep 2

    # Force kill if still running
    pids=$(ps aux | grep -E "${search_pattern}" | grep -v grep | awk '{print $2}')
    if [ -n "$pids" ]; then
        for pid in $pids; do
            kill -9 $pid 2>/dev/null || true
            echo -e "${YELLOW}  ⚠ Force killed ${process_name} (PID: $pid)${NC}"
        done
    fi
}

# Function to start backend
start_backend() {
    echo -e "${YELLOW}Starting Backend...${NC}"

    cd "${BACKEND_DIR}"

    # Clear old log
    > "${BACKEND_LOG}"

    # Start backend using venv python
    nohup "${BACKEND_DIR}/venv/bin/python" -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload > "${BACKEND_LOG}" 2>&1 &
    local backend_pid=$!

    echo -e "${GREEN}  ✓ Backend started (PID: ${backend_pid})${NC}"
    echo -e "${BLUE}  📋 Log: ${BACKEND_LOG}${NC}"

    # Wait for backend to be ready
    echo -e "${YELLOW}  Waiting for backend to be ready...${NC}"
    for i in {1..30}; do
        if curl -s http://localhost:8001/health > /dev/null 2>&1; then
            echo -e "${GREEN}  ✓ Backend is ready!${NC}"
            return 0
        fi
        sleep 1
    done

    echo -e "${RED}  ✗ Backend didn't respond in 30 seconds${NC}"
    return 1
}

# Function to start frontend
start_frontend() {
    echo -e "${YELLOW}Starting Frontend...${NC}"

    cd "${FRONTEND_DIR}"

    # Clear old log
    > "${FRONTEND_LOG}"

    # Start frontend
    nohup npm run dev > "${FRONTEND_LOG}" 2>&1 &
    local frontend_pid=$!

    echo -e "${GREEN}  ✓ Frontend started (PID: ${frontend_pid})${NC}"
    echo -e "${BLUE}  📋 Log: ${FRONTEND_LOG}${NC}"

    # Wait for frontend to be ready
    echo -e "${YELLOW}  Waiting for frontend to be ready...${NC}"
    for i in {1..20}; do
        if curl -s http://localhost:5173 > /dev/null 2>&1; then
            echo -e "${GREEN}  ✓ Frontend is ready!${NC}"
            return 0
        fi
        sleep 1
    done

    echo -e "${RED}  ✗ Frontend didn't respond in 20 seconds${NC}"
    return 1
}

# Function to check service status
check_status() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Service Status${NC}"
    echo -e "${BLUE}========================================${NC}"

    # Check backend
    if curl -s http://localhost:8001/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend:  Running (http://localhost:8001)${NC}"
    else
        echo -e "${RED}✗ Backend:  Not responding${NC}"
    fi

    # Check frontend
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Frontend: Running (http://localhost:5173)${NC}"
    else
        echo -e "${RED}✗ Frontend: Not responding${NC}"
    fi

    echo ""
}

# Main execution
main() {
    # Stop existing processes
    stop_backend_by_port
    stop_process "Frontend" "vite"

    echo ""

    # Start services
    start_backend
    echo ""
    start_frontend

    # Show status
    check_status

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  ✓ Services restarted successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
}

# Run main function
main
