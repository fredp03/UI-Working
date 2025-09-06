# Quick Server Setup Guide

## 🚀 Quick Start

1. **Install Dependencies**
   ```bash
   cd "All Server Files"
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env file:
   # MEDIA_DIR=/path/to/your/videos
   # ORIGIN=http://localhost:3000
   ```

3. **Start Server**
   ```bash
   npm start
   # OR
   ./start-videoparty.sh
   ```

4. **Test APIs**
   ```bash
   # Health check
   curl http://localhost:8080/api/health
   
   # List videos
   curl http://localhost:8080/api/videos
   ```

## 📋 Dependencies

- **Node.js 16+**
- **FFmpeg** (optional, for audio compatibility)
- **Caddy** (optional, for production HTTPS)

## 🎯 Integration Points

### Frontend Requirements:
- Video element with range request support
- WebSocket connection capability
- Fetch API for video discovery
- CORS handling for cross-origin requests

### Key Endpoints:
- `GET /api/health` - Server health check
- `GET /api/videos` - Video discovery
- `GET /media/{path}` - Video streaming
- `WS /ws?roomId=X&clientId=Y` - Real-time sync

## 🔧 Environment Variables

```env
MEDIA_DIR=/path/to/videos     # Required: Video files location
PORT=8080                     # Server port (default: 8080)
ORIGIN=http://localhost:3000  # Frontend URL for CORS
SHARED_TOKEN=secret123        # Optional: Authentication token
```

## 🌐 CORS Configuration

The server automatically handles CORS for:
- `http://localhost:5173` (Vite dev server)
- `https://fredav.netlify.app` (Production frontend)

Add your frontend domain to the `allowedOrigins` array in `index.js`.

## 📱 Supported Video Formats

- **Video**: MP4, WebM, MKV, MOV, AVI, M4V
- **Captions**: WebVTT (.vtt files)
- **Streaming**: HTTP Range requests for efficient playback

## 🔒 Security Features

- Path validation prevents directory traversal
- Optional token-based authentication
- CORS origin restrictions
- File type validation

## 🚀 Production Deployment

Use the included `Caddyfile` for HTTPS reverse proxy:

```bash
# Start server
npm start

# Start Caddy (in separate terminal)
sudo caddy run --config Caddyfile
```

For detailed integration instructions, see `INTEGRATION_GUIDE.md`.
