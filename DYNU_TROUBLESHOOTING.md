# Dynu Dynamic DNS + Caddy Troubleshooting Guide

## Current Status
- ✅ Domain resolves: fredav-videoparty.freeddns.org → 73.142.127.37
- ❌ Ports 80/443 not accessible externally
- ✅ CORS configuration updated for Safari

## Most Likely Issues & Solutions

### 1. Router Port Forwarding ⚠️ CRITICAL
Your router needs to forward external traffic to your local machine:

**Required Port Forwards:**
- External Port 80 → Your Local IP:80 (for HTTP and Let's Encrypt)
- External Port 443 → Your Local IP:443 (for HTTPS)

**How to set up:**
1. Find your local IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`
2. Access your router admin panel (usually 192.168.1.1 or 192.168.0.1)
3. Look for "Port Forwarding" or "Virtual Server" settings
4. Add rules forwarding ports 80 and 443 to your local machine

### 2. Firewall Configuration
Ensure your Mac firewall allows incoming connections:

```bash
# Check firewall status
sudo pfctl -s info

# If needed, allow Caddy through firewall:
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/caddy
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblock /usr/local/bin/caddy
```

### 3. Dynu Dynamic DNS Updates
Ensure your IP is being updated in Dynu:

```bash
# Check current public IP
curl -s https://ipinfo.io/ip

# Compare with DNS resolution
nslookup fredav-videoparty.freeddns.org
```

If they don't match, update your Dynu client or configure automatic updates.

### 4. Caddy Binding
Updated Caddyfile now includes:
- Proper CORS headers for Safari
- HTTP/2 support
- Automatic HTTPS handling
- Proper proxy headers

## Testing Commands

```bash
# 1. Start services
./start-dynu-server.sh

# 2. Test local access
curl http://localhost:8080/api/health

# 3. Test external access (should work after port forwarding)
curl http://fredav-videoparty.freeddns.org/api/health

# 4. Test HTTPS (after Let's Encrypt cert)
curl https://fredav-videoparty.freeddns.org/api/health

# 5. Test CORS specifically
curl -H "Origin: https://fredaline-independent-cinema.netlify.app" \
     https://fredav-videoparty.freeddns.org/api/cors-test
```

## Immediate Action Items

1. **🔥 URGENT: Set up port forwarding** in your router (80 → your-local-ip:80, 443 → your-local-ip:443)
2. **Configure Dynu client** to auto-update your IP address
3. **Test external access** with the commands above
4. **Enable HTTPS** - Caddy will automatically get Let's Encrypt certificates once external access works

## Safari CORS Fix Status

✅ **Server Configuration**: Updated with Safari-compatible CORS headers
✅ **Caddy Configuration**: Enhanced with proper CORS handling  
✅ **Environment Variables**: Set to use fredav-videoparty.freeddns.org
✅ **Netlify Configuration**: Ready for external API access

Once external access is working, the Safari CORS errors should be completely resolved!
