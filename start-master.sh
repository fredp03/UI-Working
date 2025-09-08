#!/bin/bash

# VideoParty Master Startup Script
# Supports multiple deployment modes: Development, Production with Dynu+Caddy

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

# Function to display header
show_header() {
    print_color $PURPLE ""
    print_color $PURPLE "🎬 VideoParty Master Startup Script 🍿"
    print_color $PURPLE "========================================"
    print_color $PURPLE ""
}

# Function to show deployment options
show_deployment_options() {
    print_color $CYAN "Select deployment mode:"
    print_color $CYAN ""
    print_color $GREEN "1) 🔧 Development Mode"
    print_color $CYAN "   - Starts React frontend (localhost:5173)"
    print_color $CYAN "   - Starts Node.js backend (localhost:8080)" 
    print_color $CYAN "   - Perfect for local development and testing"
    print_color $CYAN ""
    print_color $GREEN "2) 🌐 Production Mode (Dynu + Caddy)"
    print_color $CYAN "   - Starts Node.js backend (localhost:8080)"
    print_color $CYAN "   - Starts Caddy reverse proxy"
    print_color $CYAN "   - External access via fredav-videoparty.freeddns.org"
    print_color $CYAN "   - Automatic HTTPS with Let's Encrypt"
    print_color $CYAN ""
    print_color $GREEN "3) 🔍 Backend Only"
    print_color $CYAN "   - Starts only the Node.js backend server"
    print_color $CYAN "   - Useful for API testing or when frontend is deployed separately"
    print_color $CYAN ""
}

# Function to start development mode
start_development() {
    print_color $YELLOW "🚀 Starting Development Mode..."
    print_color $CYAN ""
    
    # Check if original startup script exists
    if [ -f "./start-videoparty.sh" ]; then
        print_color $GREEN "📋 Using existing development startup script..."
        exec ./start-videoparty.sh
    else
        print_color $RED "❌ Development startup script not found!"
        exit 1
    fi
}

# Function to start production mode with Dynu + Caddy
start_production() {
    print_color $YELLOW "🌐 Starting Production Mode (Dynu + Caddy)..."
    print_color $CYAN ""
    
    # Check if Dynu startup script exists
    if [ -f "./start-dynu-server.sh" ]; then
        print_color $GREEN "📋 Using Dynu + Caddy startup script..."
        exec ./start-dynu-server.sh
    else
        print_color $RED "❌ Dynu startup script not found!"
        print_color $YELLOW "🔧 Creating Dynu startup script..."
        
        # Create the Dynu script if it doesn't exist
        cat > start-dynu-server.sh << 'EOF'
#!/bin/bash
# Auto-generated Dynu startup script
echo "🚀 Starting VideoParty Production Mode..."
cd "$(dirname "$0")/server"
echo "📡 Starting Node.js server..."
node index.js &
NODE_PID=$!
echo "Node.js PID: $NODE_PID"
sleep 3
echo "🌐 Starting Caddy..."
caddy start --config Caddyfile
echo "✅ Production mode started!"
echo "External URL: https://fredav-videoparty.freeddns.org"
echo $NODE_PID > node.pid
wait
EOF
        chmod +x start-dynu-server.sh
        exec ./start-dynu-server.sh
    fi
}

# Function to start backend only
start_backend_only() {
    print_color $YELLOW "🔧 Starting Backend Only..."
    print_color $CYAN ""
    
    cd server
    
    # Check dependencies
    if [ ! -d "node_modules" ]; then
        print_color $YELLOW "📦 Installing server dependencies..."
        npm install
    fi
    
    print_color $GREEN "🚀 Starting Node.js backend server..."
    print_color $CYAN "API will be available at: http://localhost:8080"
    print_color $CYAN "Health check: http://localhost:8080/api/health"
    print_color $CYAN ""
    print_color $YELLOW "Press Ctrl+C to stop the server"
    print_color $CYAN ""
    
    node index.js
}

# Function to show current system status
show_system_status() {
    print_color $CYAN ""
    print_color $CYAN "🔍 System Status Check:"
    print_color $CYAN "======================"
    
    # Check Node.js
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        print_color $GREEN "✅ Node.js: $NODE_VERSION"
    else
        print_color $RED "❌ Node.js: Not installed"
    fi
    
    # Check Caddy
    if command -v caddy >/dev/null 2>&1; then
        CADDY_VERSION=$(caddy version | head -n1)
        print_color $GREEN "✅ Caddy: $CADDY_VERSION"
    else
        print_color $YELLOW "⚠️ Caddy: Not installed (needed for production mode)"
    fi
    
    # Check if server is running
    if lsof -i :8080 >/dev/null 2>&1; then
        print_color $YELLOW "⚠️ Port 8080: Already in use"
    else
        print_color $GREEN "✅ Port 8080: Available"
    fi
    
    # Check if frontend is running  
    if lsof -i :5173 >/dev/null 2>&1; then
        print_color $YELLOW "⚠️ Port 5173: Already in use"
    else
        print_color $GREEN "✅ Port 5173: Available"
    fi
    
    # Check Dynu domain resolution
    print_color $CYAN ""
    print_color $CYAN "🌐 External Access Check:"
    if nslookup fredav-videoparty.freeddns.org >/dev/null 2>&1; then
        RESOLVED_IP=$(nslookup fredav-videoparty.freeddns.org | grep -A1 "Non-authoritative answer:" | grep "Address:" | awk '{print $2}' | head -n1)
        print_color $GREEN "✅ Dynu DNS: fredav-videoparty.freeddns.org → $RESOLVED_IP"
    else
        print_color $RED "❌ Dynu DNS: Resolution failed"
    fi
    
    print_color $CYAN ""
}

# Main script logic
main() {
    show_header
    show_system_status
    
    # If command line argument provided, use it
    if [ $# -eq 1 ]; then
        case $1 in
            "dev"|"development"|"1")
                start_development
                ;;
            "prod"|"production"|"dynu"|"2")
                start_production
                ;;
            "backend"|"api"|"3")
                start_backend_only
                ;;
            *)
                print_color $RED "❌ Invalid option: $1"
                print_color $YELLOW "Valid options: dev, prod, backend"
                exit 1
                ;;
        esac
    else
        # Interactive mode
        show_deployment_options
        
        while true; do
            read -p "$(print_color $YELLOW 'Enter your choice (1-3): ')" choice
            case $choice in
                1)
                    start_development
                    break
                    ;;
                2)
                    start_production
                    break
                    ;;
                3)
                    start_backend_only
                    break
                    ;;
                *)
                    print_color $RED "❌ Invalid choice. Please enter 1, 2, or 3."
                    ;;
            esac
        done
    fi
}

# Handle script termination
trap 'print_color $YELLOW "\n🛑 Startup cancelled by user"; exit 1' INT

# Run main function
main "$@"
