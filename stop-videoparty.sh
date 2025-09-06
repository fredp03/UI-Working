#!/bin/bash

# VideoParty Stop Script
# Gracefully stops both frontend and backend servers

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    printf "${1}${2}${NC}\n"
}

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_color $PURPLE "🛑 Stopping VideoParty Servers"
print_color $PURPLE "==============================="

# Stop servers using PID files if they exist
if [ -f "logs/server.pid" ]; then
    SERVER_PID=$(cat logs/server.pid)
    if kill -0 $SERVER_PID 2>/dev/null; then
        print_color $YELLOW "🔄 Stopping backend server (PID: $SERVER_PID)..."
        kill $SERVER_PID
        sleep 2
        if kill -0 $SERVER_PID 2>/dev/null; then
            print_color $YELLOW "🔄 Force stopping backend server..."
            kill -9 $SERVER_PID 2>/dev/null || true
        fi
        print_color $GREEN "✅ Backend server stopped"
    else
        print_color $YELLOW "⚠️ Backend server was not running"
    fi
    rm -f logs/server.pid
else
    print_color $YELLOW "⚠️ No backend server PID file found"
fi

if [ -f "logs/frontend.pid" ]; then
    FRONTEND_PID=$(cat logs/frontend.pid)
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        print_color $YELLOW "🔄 Stopping frontend server (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
        sleep 2
        if kill -0 $FRONTEND_PID 2>/dev/null; then
            print_color $YELLOW "🔄 Force stopping frontend server..."
            kill -9 $FRONTEND_PID 2>/dev/null || true
        fi
        print_color $GREEN "✅ Frontend server stopped"
    else
        print_color $YELLOW "⚠️ Frontend server was not running"
    fi
    rm -f logs/frontend.pid
else
    print_color $YELLOW "⚠️ No frontend server PID file found"
fi

# Also try to kill any remaining processes on the ports
print_color $YELLOW "🔄 Cleaning up any remaining processes..."

# Kill any process on port 5173 (frontend)
if lsof -ti:5173 >/dev/null 2>&1; then
    print_color $YELLOW "🔄 Stopping processes on port 5173..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
fi

# Kill any process on port 8080 (backend)
if lsof -ti:8080 >/dev/null 2>&1; then
    print_color $YELLOW "🔄 Stopping processes on port 8080..."
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
fi

print_color $GREEN "✅ All VideoParty servers have been stopped"
print_color $BLUE "💡 To start again, run: ./start-videoparty.sh"
