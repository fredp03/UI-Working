# VideoParty Server Files - Complete Package

## 📦 What's Included

This folder contains everything needed to run the VideoParty server independently:

### Core Server Files
- **`index.js`** - Main server application with all APIs and WebSocket handling
- **`package.json`** - Dependencies and scripts
- **`.env.example`** - Environment configuration template

### Deployment Files
- **`Caddyfile`** - Production HTTPS reverse proxy configuration
- **`docker-compose.yml`** - Docker container setup
- **`Dockerfile`** - Container image definition
- **`start-videoparty.sh`** - Automated startup script

### Utilities
- **`scripts/media/`** - Media processing and compatibility tools

### Documentation
- **`INTEGRATION_GUIDE.md`** - Comprehensive integration instructions
- **`QUICK_SETUP.md`** - Fast setup guide
- **`README.md`** - Server overview and features

## 🎯 Key Features Extracted

### Video Discovery & Streaming
- Automatic media directory scanning
- HTTP Range streaming for efficient video delivery
- WebVTT caption support (.vtt files)
- Cross-browser compatibility (Safari, Chrome, Firefox, Mobile)

### Real-Time Synchronization
- WebSocket-based room management
- Sub-second synchronization accuracy (≤300ms)
- Network delay compensation
- Automatic drift correction

### Production Ready
- CORS security configuration
- Optional token authentication
- Path traversal protection
- Docker deployment support
- HTTPS reverse proxy setup

## 🚀 Quick Integration

1. **Copy these files** to your project
2. **Install dependencies**: `npm install`
3. **Configure**: Edit `.env` with your video directory
4. **Start**: `npm start` or `./start-videoparty.sh`
5. **Integrate**: Use WebSocket and fetch APIs (see INTEGRATION_GUIDE.md)

## 📡 API Overview

### HTTP Endpoints
```
GET /api/health              # Server status
GET /api/videos              # Available video list
GET /media/{path}            # Video streaming with range support
POST /api/videos/process-compatibility  # Audio compatibility processing
```

### WebSocket Messages
```javascript
// Join room
ws://server/ws?roomId=ROOM&clientId=CLIENT

// Message types: 'loadVideo', 'play', 'pause', 'seek', 'sync'
{
  type: 'play',
  roomId: 'room123',
  clientId: 'user456',
  currentTime: 45.67,
  paused: false,
  sentAtMs: Date.now(),
  videoUrl: '/media/movie.mp4'
}
```

## 🎬 How It Works

1. **Video Discovery**: Server scans media directory, returns video list with metadata
2. **Room Creation**: WebSocket connections create isolated synchronization rooms
3. **Video Loading**: One client selects video, broadcasts to all room participants
4. **Sync Control**: Any participant can play/pause/seek, changes sync to everyone
5. **Drift Correction**: Automatic time synchronization keeps everyone in sync

## 🌟 Perfect For

- **Watch parties** - Friends watching movies together
- **Educational content** - Synchronized video lessons
- **Live streaming** - Shared viewing experiences
- **Video conferencing** - Synchronized media playback
- **Gaming integration** - Shared video content in games

## 📱 Browser Support

- ✅ **Chrome/Edge** - Full support
- ✅ **Firefox** - Full support  
- ✅ **Safari** - Optimized with special handling
- ✅ **Mobile browsers** - iOS/Android compatible
- ✅ **AirPlay/Chromecast** - Casting ready

## 🔧 Customization Points

- **Media formats**: Extend supported video types
- **Authentication**: Add user accounts or API keys
- **Room features**: Add chat, user lists, or permissions
- **Streaming**: Add adaptive bitrate or transcoding
- **UI integration**: Custom video player controls

This server provides a solid foundation for any synchronized video viewing application!
