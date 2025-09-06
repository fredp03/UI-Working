#!/bin/bash

# VideoParty Complete Startup Script
# Starts both the React frontend and Node.js backend server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Function to print colored output
print_color() {
    printf "${1}${2}${NC}\n"
}

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -i :$port >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to wait for port to be available
wait_for_port() {
    local port=$1
    local service=$2
    local max_attempts=30
    local attempt=1
    
    print_color $YELLOW "⏳ Waiting for $service to start on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if check_port $port; then
            print_color $GREEN "✅ $service is running on port $port"
            return 0
        fi
        
        printf "."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    print_color $RED "❌ $service failed to start on port $port after $max_attempts seconds"
    return 1
}

# Function to create sample media files
create_sample_media() {
    print_color $CYAN "📁 Creating sample media structure..."
    
    mkdir -p "$SCRIPT_DIR/media/sample"
    
    cat > "$SCRIPT_DIR/media/README.md" << 'EOF'
# Media Directory

Place your video files in this directory for the VideoParty server to serve them.

## Supported Formats
- MP4 (.mp4)
- WebM (.webm)
- MKV (.mkv)
- MOV (.mov)
- AVI (.avi)
- M4V (.m4v)

## Caption Support
- Place `.vtt` files with the same name as your video files for automatic caption support
- Example: `movie.mp4` and `movie.vtt`

## Directory Structure
You can organize your media in subdirectories:
```
media/
├── movies/
│   ├── action/
│   │   ├── movie1.mp4
│   │   └── movie1.vtt
│   └── comedy/
│       └── movie2.mp4
└── tv-shows/
    └── series1/
        ├── s01e01.mp4
        └── s01e01.vtt
```

The server will automatically discover all video files recursively.
EOF

    cat > "$SCRIPT_DIR/media/sample/sample.txt" << 'EOF'
This is a sample directory.
Place your actual video files here or in subdirectories.

The VideoParty server will automatically discover and serve all supported video files from this directory.
EOF

    print_color $GREEN "✅ Sample media structure created"
}

print_color $PURPLE "🎬 VideoParty Complete Startup"
print_color $PURPLE "=============================="
print_color $BLUE "Project directory: $SCRIPT_DIR"
echo ""

# Step 1: Check Node.js
print_color $CYAN "1️⃣ Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    print_color $RED "❌ Node.js is not installed. Please install Node.js from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
print_color $GREEN "✅ Node.js $NODE_VERSION found"

# Step 2: Install frontend dependencies
print_color $CYAN ""
print_color $CYAN "2️⃣ Checking frontend dependencies..."
if [ ! -d "node_modules" ]; then
    print_color $YELLOW "📦 Installing frontend dependencies..."
    npm install
else
    print_color $GREEN "✅ Frontend dependencies already installed"
fi

# Step 3: Install server dependencies
print_color $CYAN ""
print_color $CYAN "3️⃣ Checking server dependencies..."
if [ ! -d "server/node_modules" ]; then
    print_color $YELLOW "📦 Installing server dependencies..."
    cd server
    npm install
    cd ..
else
    print_color $GREEN "✅ Server dependencies already installed"
fi

# Step 4: Create server .env if it doesn't exist
print_color $CYAN ""
print_color $CYAN "4️⃣ Checking server configuration..."
if [ ! -f "server/.env" ]; then
    print_color $YELLOW "⚙️ Creating server configuration..."
    cat > "server/.env" << EOF
# VideoParty Server Configuration

# Path to your video files directory
MEDIA_DIR=$SCRIPT_DIR/media

# Server port
PORT=8080

# Allowed CORS origin (React dev server)
ORIGIN=http://localhost:5173

# Optional shared token for API authentication
# SHARED_TOKEN=your-secret-token-here
EOF
    print_color $GREEN "✅ Server .env file created"
else
    print_color $GREEN "✅ Server configuration already exists"
fi

# Step 5: Create media directory structure
print_color $CYAN ""
print_color $CYAN "5️⃣ Setting up media directory..."
if [ ! -d "media" ]; then
    create_sample_media
elif [ ! -f "media/README.md" ]; then
    create_sample_media
else
    print_color $GREEN "✅ Media directory already configured"
fi

# Step 6: Check for port conflicts
print_color $CYAN ""
print_color $CYAN "6️⃣ Checking ports..."

FRONTEND_PORT=5173
SERVER_PORT=8080

if check_port $FRONTEND_PORT; then
    print_color $YELLOW "⚠️ Port $FRONTEND_PORT is already in use (frontend)"
    read -p "$(print_color $YELLOW 'Do you want to kill the existing process? (y/N): ')" -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_color $YELLOW "🔄 Stopping existing process on port $FRONTEND_PORT..."
        lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
fi

if check_port $SERVER_PORT; then
    print_color $YELLOW "⚠️ Port $SERVER_PORT is already in use (backend)"
    read -p "$(print_color $YELLOW 'Do you want to kill the existing process? (y/N): ')" -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_color $YELLOW "🔄 Stopping existing process on port $SERVER_PORT..."
        lsof -ti:$SERVER_PORT | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
fi

# Step 7: Start the servers
print_color $CYAN ""
print_color $CYAN "7️⃣ Starting servers..."

# Create log directory
mkdir -p logs

# Start the backend server
print_color $YELLOW "🚀 Starting VideoParty backend server..."
cd server
nohup npm start > ../logs/server.log 2>&1 &
SERVER_PID=$!
cd ..

# Wait for server to start
if wait_for_port $SERVER_PORT "VideoParty Server"; then
    print_color $GREEN "✅ Backend server started successfully (PID: $SERVER_PID)"
else
    print_color $RED "❌ Failed to start backend server"
    exit 1
fi

# Start the frontend server
print_color $YELLOW "🚀 Starting React frontend..."
nohup npm run dev > logs/frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to start
if wait_for_port $FRONTEND_PORT "React Frontend"; then
    print_color $GREEN "✅ Frontend started successfully (PID: $FRONTEND_PID)"
else
    print_color $RED "❌ Failed to start frontend"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

# Step 8: Save PIDs for cleanup
echo "$SERVER_PID" > logs/server.pid
echo "$FRONTEND_PID" > logs/frontend.pid

# Step 9: Display status and instructions
print_color $PURPLE ""
print_color $PURPLE "🎉 VideoParty is now running!"
print_color $PURPLE "=========================="
echo ""
print_color $GREEN "📱 Frontend (React):  http://localhost:$FRONTEND_PORT"
print_color $GREEN "🔧 Backend (API):     http://localhost:$SERVER_PORT"
print_color $GREEN "🎬 Media Directory:   $SCRIPT_DIR/media"
echo ""
print_color $CYAN "📋 Server Status:"
print_color $CYAN "Frontend PID: $FRONTEND_PID"
print_color $CYAN "Backend PID:  $SERVER_PID"
echo ""
print_color $YELLOW "📁 Add your video files to: $SCRIPT_DIR/media"
print_color $YELLOW "📊 View logs: tail -f logs/server.log or logs/frontend.log"
print_color $YELLOW "🛑 Stop servers: ./stop-videoparty.sh"
echo ""
print_color $BLUE "🌐 Open your browser to: http://localhost:$FRONTEND_PORT"
echo ""

# Step 10: Test server health
print_color $CYAN "🔍 Testing server health..."
sleep 2
if curl -s "http://localhost:$SERVER_PORT/api/health" > /dev/null; then
    print_color $GREEN "✅ Server health check passed"
else
    print_color $YELLOW "⚠️ Server health check failed - server may still be starting"
fi

print_color $PURPLE ""
print_color $PURPLE "🎬 Ready to start your video party! 🍿"

# Keep script running to show real-time logs (optional)
read -p "$(print_color $YELLOW 'Press Enter to show live logs, or Ctrl+C to return to terminal: ')"
echo ""
print_color $CYAN "📊 Live logs (Ctrl+C to stop):"
tail -f logs/server.log logs/frontend.log
