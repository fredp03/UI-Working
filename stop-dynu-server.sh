#!/bin/bash

# Stop script for Dynu Dynamic DNS + Caddy + Node.js setup

echo "🛑 Stopping VideoParty services..."

# Stop Caddy
echo "Stopping Caddy..."
caddy stop 2>/dev/null || echo "Caddy was not running"

# Stop Node.js server
echo "Stopping Node.js server..."
if [ -f "server/node.pid" ]; then
    NODE_PID=$(cat server/node.pid)
    if kill -0 $NODE_PID 2>/dev/null; then
        kill $NODE_PID
        echo "Stopped Node.js server (PID: $NODE_PID)"
    else
        echo "Node.js server was not running"
    fi
    rm -f server/node.pid
else
    pkill -f "node.*index.js" 2>/dev/null && echo "Stopped Node.js server" || echo "Node.js server was not running"
fi

echo "✅ All services stopped"
