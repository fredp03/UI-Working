#!/bin/bash

# VideoParty Startup Script
# Starts the VideoParty server for development/testing

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting VideoParty Server"
echo "============================="
echo "Project directory: $SCRIPT_DIR"
echo ""

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -i :$port >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Step 1: Check if server dependencies are installed
echo "1️⃣ Checking server dependencies..."
if [ ! -d "server/node_modules" ]; then
    echo "📦 Installing server dependencies..."
    cd server
    npm install
    cd ..
else
    echo "✅ Server dependencies already installed"
fi

# Step 2: Check if .env exists
echo ""
echo "2️⃣ Checking server configuration..."
if [ ! -f "server/.env" ]; then
    echo "⚠️  No .env file found. Creating from example..."
    if [ -f "server/.env.example" ]; then
        cp server/.env.example server/.env
        echo "📝 Created server/.env from example. Please edit it if needed."
    else
        echo "📝 Creating basic .env file..."
        cat > server/.env << EOF
MEDIA_DIR=$SCRIPT_DIR/test-media
PORT=8080
ORIGIN=http://localhost:5173
NODE_ENV=development
EOF
    fi
fi

# Step 3: Create test media directory if it doesn't exist
echo ""
echo "3️⃣ Setting up test media directory..."
if [ ! -d "test-media" ]; then
    mkdir -p test-media
    echo "📁 Created test-media directory"
    echo "ℹ️  Add your video files to the test-media directory"
else
    echo "✅ Test media directory exists"
fi

# Step 4: Check if port 8080 is available
echo ""
echo "4️⃣ Checking if port 8080 is available..."
if check_port 8080; then
    echo "⚠️  Port 8080 is already in use. Stopping existing process..."
    # Try to find and stop the process
    pkill -f "node.*index.js" || true
    sleep 2
    if check_port 8080; then
        echo "❌ Could not free port 8080. Please manually stop the process using port 8080"
        exit 1
    fi
fi

# Step 5: Start the server
echo ""
echo "5️⃣ Starting VideoParty server..."
echo "🌐 Server will be available at: http://localhost:8080"
echo "📁 Media directory: $(cat server/.env | grep MEDIA_DIR | cut -d'=' -f2)"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

cd server
npm start