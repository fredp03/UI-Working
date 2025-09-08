#!/bin/bash

# Startup script for Dynu Dynamic DNS + Caddy + Node.js setup
# This script ensures both services start correctly for external access

echo "🚀 Starting VideoParty with Dynu Dynamic DNS + Caddy..."

# Navigate to server directory
cd "$(dirname "$0")/server"

# Check if required files exist
if [ ! -f "index.js" ]; then
    echo "❌ Error: index.js not found in server directory"
    exit 1
fi

if [ ! -f "Caddyfile" ]; then
    echo "❌ Error: Caddyfile not found in server directory"
    exit 1
fi

# Stop any existing processes
echo "🛑 Stopping existing processes..."
pkill -f "node.*index.js" 2>/dev/null
pkill -f "caddy" 2>/dev/null
sleep 2

# Start Node.js server in background
echo "📡 Starting Node.js server on port 8080..."
node index.js &
NODE_PID=$!
echo "Node.js PID: $NODE_PID"

# Wait a moment for Node.js to start
sleep 3

# Check if Node.js started successfully
if ! kill -0 $NODE_PID 2>/dev/null; then
    echo "❌ Failed to start Node.js server"
    exit 1
fi

# Test local server
echo "🧪 Testing local server..."
if curl -s http://localhost:8080/api/health > /dev/null; then
    echo "✅ Node.js server is responding locally"
else
    echo "❌ Node.js server is not responding locally"
    kill $NODE_PID
    exit 1
fi

# Start Caddy
echo "🌐 Starting Caddy reverse proxy..."
caddy start --config Caddyfile

# Wait for Caddy to start
sleep 5

# Test if Caddy is running
if pgrep caddy > /dev/null; then
    echo "✅ Caddy is running"
else
    echo "❌ Failed to start Caddy"
    kill $NODE_PID
    exit 1
fi

echo ""
echo "🎉 VideoParty is now running!"
echo ""
echo "📊 Service Status:"
echo "  • Node.js Server: Running (PID: $NODE_PID)"
echo "  • Caddy Proxy: Running"
echo "  • Local API: http://localhost:8080"
echo "  • External API: https://fredav-videoparty.freeddns.org"
echo ""
echo "🔧 Next Steps:"
echo "  1. Ensure your router forwards ports 80 and 443 to this machine"
echo "  2. Check that Dynu dynamic DNS is updating your IP address"
echo "  3. Test external access: curl https://fredav-videoparty.freeddns.org/api/health"
echo ""
echo "📝 Process IDs saved to:"
echo "  • Node.js PID: $NODE_PID (saved to node.pid)"
echo "  • Caddy: Use 'caddy stop' to stop"
echo ""

# Save PIDs for stopping later
echo $NODE_PID > node.pid

echo "💡 To stop services, run: ./stop-videoparty.sh"
echo "💡 To view logs, run: tail -f /var/log/caddy/*.log (if Caddy logging enabled)"
