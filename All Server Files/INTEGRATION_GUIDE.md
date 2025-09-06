# VideoParty Server Integration Guide

This guide explains how the VideoParty server works and how to integrate it with your video player project.

## 📁 Server Files Overview

The `All Server Files` folder contains all the essential server components:

```
All Server Files/
├── index.js                 # Main server file with all APIs and WebSocket handling
├── package.json             # Node.js dependencies and scripts
├── Dockerfile               # Docker container configuration
├── README.md               # Server-specific documentation
├── Caddyfile               # Reverse proxy configuration for production
├── docker-compose.yml      # Docker Compose setup
├── start-videoparty.sh     # Startup script
└── scripts/
    └── media/              # Media processing utilities
        ├── ensure-media-compatibility.sh
        └── process-media.js
```

## 🎯 Core Functionality

### 1. Video Discovery System

**API Endpoint: `GET /api/videos`**

The server automatically scans a media directory and returns a list of available videos:

```javascript
// Example response
[
  {
    "id": "base64-encoded-path",
    "name": "Movie Title",
    "relPath": "movies/Movie Title.mp4",
    "url": "/media/movies%2FMovie%20Title.mp4",
    "captionsUrl": "/media/movies%2FMovie%20Title.vtt", // if .vtt file exists
    "audioCompatible": true,
    "audioInfo": { /* audio codec details */ }
  }
]
```

**Key Features:**
- **Recursive scanning** of media directory
- **Supported formats**: MP4, MKV, WebM, MOV, AVI, M4V
- **Automatic captions detection** (.vtt files with same name as video)
- **Audio compatibility checking** (requires FFmpeg)
- **Base64 ID encoding** for secure file access

### 2. Video Streaming System

**API Endpoint: `GET /media/{encoded-path}`**

Advanced video streaming with HTTP Range support:

```javascript
// Example request
GET /media/movies%2FMovie%20Title.mp4
Range: bytes=0-1048576

// Example response
HTTP/1.1 206 Partial Content
Content-Range: bytes 0-1048576/1048576000
Content-Length: 1048577
Content-Type: video/mp4
```

**Key Features:**
- **HTTP Range requests** for efficient streaming
- **Safari-specific optimizations** (smaller chunks, special headers)
- **CORS headers** for cross-origin access
- **Security validation** (prevents directory traversal)
- **Automatic MIME type detection**
- **Caption file serving** (.vtt format)

### 3. Real-Time Synchronization

**WebSocket Endpoint: `ws://server/ws?roomId=ROOM&clientId=CLIENT`**

Real-time synchronization between multiple viewers:

```javascript
// Message Types
{
  type: 'loadVideo',      // Load a new video
  type: 'play',           // Start playback
  type: 'pause',          // Pause playback
  type: 'seek',           // Seek to timestamp
  type: 'syncRequest',    // Request current state
  type: 'sync',           // Sync state update
  
  roomId: 'room123',
  clientId: 'user456',
  currentTime: 45.67,     // Seconds
  paused: false,
  sentAtMs: 1757198077189, // Timestamp for drift calculation
  videoUrl: '/media/...'   // Video URL (for loadVideo)
}
```

**Synchronization Features:**
- **Sub-second accuracy** (≤300ms drift tolerance)
- **Network delay compensation** (calculates round-trip time)
- **Drift correction** (automatic adjustment during playback)
- **Room management** (isolated synchronization per room)
- **State persistence** (new joiners get current state)

## 🎮 How Video Playing Works

### Frontend Integration Pattern

1. **Video Discovery**
   ```javascript
   // Fetch available videos
   const videos = await fetch('/api/videos').then(r => r.json())
   
   // Display video list to user
   videos.forEach(video => {
     console.log(video.name, video.url)
   })
   ```

2. **Video Selection & Loading**
   ```javascript
   // When user selects video
   const selectedVideo = videos[0]
   
   // Send load message to all room participants
   websocket.send(JSON.stringify({
     type: 'loadVideo',
     roomId: 'room123',
     clientId: 'user456',
     currentTime: 0,
     paused: true,
     sentAtMs: Date.now(),
     videoUrl: selectedVideo.url
   }))
   
   // Update local video element
   videoElement.src = selectedVideo.url
   ```

3. **Playback Control**
   ```javascript
   // When local user hits play
   videoElement.play()
   
   // Broadcast to room
   websocket.send(JSON.stringify({
     type: 'play',
     roomId: 'room123',
     clientId: 'user456',
     currentTime: videoElement.currentTime,
     paused: false,
     sentAtMs: Date.now()
   }))
   ```

4. **Sync Message Handling**
   ```javascript
   websocket.onmessage = (event) => {
     const message = JSON.parse(event.data)
     
     // Calculate network-adjusted time
     const networkDelay = (Date.now() - message.sentAtMs) / 1000
     const adjustedTime = message.currentTime + (networkDelay * 0.5)
     
     // Apply sync if drift is significant
     const drift = Math.abs(videoElement.currentTime - adjustedTime)
     if (drift > 0.5) { // 500ms threshold
       videoElement.currentTime = adjustedTime
     }
     
     // Update play/pause state
     if (message.paused && !videoElement.paused) {
       videoElement.pause()
     } else if (!message.paused && videoElement.paused) {
       videoElement.play()
     }
   }
   ```

## 🔧 Integration Steps

### 1. Server Setup

```bash
# Copy server files to your project
cp -r "All Server Files"/* your-project/server/

# Install dependencies
cd your-project/server
npm install

# Configure environment
cp .env.example .env
# Edit .env with your media directory path
```

### 2. Environment Configuration

```env
# .env file
MEDIA_DIR=/path/to/your/videos     # Required: video files directory
PORT=8080                          # Server port
ORIGIN=https://your-frontend.com   # Frontend URL for CORS
SHARED_TOKEN=your-secret-token     # Optional: authentication token
```

### 3. Frontend Integration

**Required Dependencies:**
- WebSocket support
- Video element with range request support
- CORS-enabled fetch for API calls

**Core Integration Points:**
```javascript
// 1. Video discovery
const videoList = await fetch('/api/videos').then(r => r.json())

// 2. WebSocket connection
const ws = new WebSocket(`ws://your-server/ws?roomId=${roomId}&clientId=${clientId}`)

// 3. Video element setup
const video = document.querySelector('video')
video.src = selectedVideo.url

// 4. Sync message handling (see examples above)
```

## 🌟 Advanced Features

### Personal Settings (Local Only)
- **Volume control** - Individual volume levels
- **Caption preferences** - Enable/disable captions locally
- **Fullscreen mode** - Individual fullscreen state
- **Theatre mode** - UI density preferences

### Audio Compatibility
- **Automatic detection** of browser-compatible audio codecs
- **FFmpeg integration** for audio format conversion
- **Processing endpoint** `/api/videos/process-compatibility`

### Browser Optimizations
- **Safari-specific** range request handling
- **iOS fullscreen** support with webkit events
- **AirPlay detection** and controls
- **Mobile-responsive** video controls

## 🔒 Security Features

- **Path validation** prevents directory traversal attacks
- **CORS configuration** restricts origin access
- **Optional authentication** via shared tokens
- **File type validation** only serves video/caption files

## 📱 Mobile & Cross-Platform Support

- **iOS Safari** optimizations for video streaming
- **Android Chrome** range request compatibility  
- **Desktop browsers** full feature support
- **AirPlay/Chromecast** ready for casting

## 🚀 Production Deployment

- **Caddy reverse proxy** for HTTPS and load balancing
- **Docker support** for containerized deployment
- **Dynamic DNS** integration with Dynu/FreeDNS
- **Health check** endpoint for monitoring

## 🎯 Integration Checklist

- [ ] Copy server files to your project
- [ ] Install Node.js dependencies (`npm install`)
- [ ] Configure `.env` file with media directory
- [ ] Set up CORS for your frontend domain
- [ ] Implement video discovery UI
- [ ] Add WebSocket connection for sync
- [ ] Handle sync messages in video player
- [ ] Test with multiple browser tabs
- [ ] Configure reverse proxy for production

## 💡 Usage Examples

**Simple Room Implementation:**
```javascript
class VideoRoom {
  constructor(roomId, clientId) {
    this.roomId = roomId
    this.clientId = clientId
    this.setupWebSocket()
    this.loadVideoList()
  }
  
  async loadVideoList() {
    this.videos = await fetch('/api/videos').then(r => r.json())
    this.renderVideoList()
  }
  
  selectVideo(video) {
    this.video.src = video.url
    this.sendMessage('loadVideo', video.url)
  }
  
  sendMessage(type, videoUrl = null) {
    this.ws.send(JSON.stringify({
      type,
      roomId: this.roomId,
      clientId: this.clientId,
      currentTime: this.video.currentTime,
      paused: this.video.paused,
      sentAtMs: Date.now(),
      videoUrl
    }))
  }
}
```

This server provides a complete foundation for synchronized video watching experiences!
