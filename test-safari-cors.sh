#!/bin/bash

echo "Testing Safari CORS fixes..."
echo "================================"

# Kill existing processes
echo "Stopping existing servers..."
pkill -f "node.*server/index.js" 2>/dev/null
pkill -f "vite" 2>/dev/null

# Start the backend server
echo "Starting backend server..."
cd server
node index.js &
SERVER_PID=$!
cd ..

# Wait for server to start
sleep 2

# Test CORS endpoint
echo "Testing CORS endpoint..."
curl -X GET "http://localhost:8080/api/cors-test" \
  -H "Origin: http://localhost:5173" \
  -H "Accept: application/json" \
  -v

echo ""
echo "Backend server started with PID: $SERVER_PID"
echo "You can now test the frontend in Safari by running: npm run dev"
echo ""
echo "To stop the backend server, run: kill $SERVER_PID"
echo "Server logs are visible above. Check for CORS debug messages."
