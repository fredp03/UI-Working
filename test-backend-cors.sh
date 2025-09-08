#!/bin/bash

# Test script to verify backend CORS configuration for Dynu Dynamic DNS + Caddy setup
# Usage: ./test-backend-cors.sh [backend-url]

BACKEND_URL=${1:-"https://fredav-videoparty.freeddns.org"}
FRONTEND_ORIGIN="https://fredaline-independent-cinema.netlify.app"

echo "Testing CORS configuration for Dynu Dynamic DNS + Caddy setup"
echo "Backend URL: $BACKEND_URL"
echo "Testing with origin: $FRONTEND_ORIGIN"
echo ""

# Test 1: Health check
echo "🔍 Testing health endpoint..."
curl -s -X GET "$BACKEND_URL/api/health" \
  -H "Origin: $FRONTEND_ORIGIN" \
  -H "Accept: application/json" \
  -w "\nStatus: %{http_code}\n" \
  | head -10

echo ""

# Test 2: CORS test endpoint
echo "🔍 Testing CORS endpoint..."
curl -s -X GET "$BACKEND_URL/api/cors-test" \
  -H "Origin: $FRONTEND_ORIGIN" \
  -H "Accept: application/json" \
  -w "\nStatus: %{http_code}\n" \
  | head -10

echo ""

# Test 3: Videos endpoint (may require auth)
echo "🔍 Testing videos endpoint..."
curl -s -X GET "$BACKEND_URL/api/videos" \
  -H "Origin: $FRONTEND_ORIGIN" \
  -H "Accept: application/json" \
  -w "\nStatus: %{http_code}\n" \
  | head -10

echo ""

# Test 4: Preflight request simulation
echo "🔍 Testing preflight (OPTIONS) request..."
curl -s -X OPTIONS "$BACKEND_URL/api/videos" \
  -H "Origin: $FRONTEND_ORIGIN" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Accept, Content-Type" \
  -w "\nStatus: %{http_code}\n" \
  -I | grep -E "(HTTP|Access-Control|Status)"

echo ""
echo "✅ CORS test complete!"
echo ""
echo "If all tests return 200/204 status codes, your CORS configuration is working correctly."
echo "Safari CORS errors should be resolved once the backend is deployed and environment variables are set."
