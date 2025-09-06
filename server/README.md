# VideoParty Server

Node.js backend server for the VideoParty synchronized video watching app.

## Features

- 📁 Automatic video indexing from local media directory
- 🎞️ HTTP Range streaming for efficient video delivery
- 🔄 Real-time WebSocket synchronization
- 📝 WebVTT caption support (.vtt files)
- 🔒 Optional token-based authentication
- 🌐 CORS protection

## Quick Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Set your media directory** in `.env`:
   ```
   MEDIA_DIR=/path/to/your/video/files
   ```

4. **Start the server**:
   ```bash
   npm start
   ```

## Configuration

### Environment Variables (.env)

- `MEDIA_DIR`: Path to your video files directory (required)
- `PORT`: Server port (default: 8080)
- `ORIGIN`: Allowed CORS origin (your frontend URL)
- `SHARED_TOKEN`: Optional authentication token

### Supported Video Formats

- MP4 (.mp4)
- WebM (.webm) 
- MKV (.mkv)
- MOV (.mov)
- AVI (.avi)
- M4V (.m4v)

### Caption Support

Place `.vtt` caption files next to video files with the same name:
```
/videos/
  movie.mp4
  movie.vtt        ← Will be automatically detected
  series/
    episode1.mkv
    episode1.vtt   ← Also detected
```

## Exposing Your Server

### Production Deployment with Caddy

For production deployment with HTTPS and proper security:

1. **Set up Domain/DDNS**:
   - Configure your domain to point to your public IP
   - Or use a Dynamic DNS service like DuckDNS

2. **Port Forwarding**:
   - Forward TCP ports 80 and 443 to your server machine
   - Configure NAT loopback for local testing

3. **Install Caddy**:
   ```bash
   # macOS
   brew install caddy
   
   # Linux
   sudo apt install caddy
   ```

4. **Configure Caddyfile**:
   - Edit the `Caddyfile` in project root
   - Replace `watch.example.com` with your domain
   - Replace Netlify URL with your actual frontend URL

5. **Start Services**:
   ```bash
   # Start Node server
   npm start
   
   # Start Caddy (from project root)
   caddy run --config ./Caddyfile
   ```

6. **Verify Setup**:
   ```bash
   curl -I https://yourdomain.com/api/health
   ```

See `docs/NETWORKING.md` for detailed networking setup instructions.

## API Endpoints

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "ok": true,
  "timestamp": 1693843200000
}
```

### GET /api/videos
List all available videos.

**Headers** (if `SHARED_TOKEN` is set):
```
Authorization: Bearer YOUR_TOKEN
```

**Response:**
```json
[
  {
    "id": "base64-encoded-path",
    "name": "Movie Title",
    "relPath": "movies/movie.mp4",
    "url": "/media/movies%2Fmovie.mp4",
    "captionsUrl": "/media/movies%2Fmovie.vtt"
  }
]
```

### GET /media/:path
Stream video/caption files with Range support.

**Headers** (if `SHARED_TOKEN` is set):
```
Authorization: Bearer YOUR_TOKEN
Range: bytes=0-1023
```

**Response:**
- Status 206 (Partial Content) for Range requests
- Status 200 for full file requests
- Proper `Content-Type` and `Content-Range` headers

## WebSocket API

### Connection
```
ws://localhost:8080/ws?roomId=ROOM&clientId=CLIENT&token=TOKEN
```

### Message Format
```json
{
  "type": "play|pause|seek|loadVideo|timeSync",
  "roomId": "room123",
  "clientId": "client456", 
  "currentTime": 42.5,
  "paused": false,
  "sentAtMs": 1693843200000,
  "videoUrl": "/media/path%2Fto%2Fvideo.mp4"
}
```

## Testing

1. **Test video indexing**:
   ```bash
   curl http://localhost:8080/api/videos
   ```

2. **Test video streaming**:
   ```bash
   curl -H "Range: bytes=0-1023" http://localhost:8080/media/your-video.mp4
   ```

3. **Test WebSocket** (using a WebSocket client):
   ```
   ws://localhost:8080/ws?roomId=test&clientId=test1
   ```

## Troubleshooting

### Videos not showing up
- Check `MEDIA_DIR` path in `.env`
- Ensure video files have supported extensions
- Check file permissions

### CORS errors
- Verify `ORIGIN` matches your frontend URL exactly
- Include protocol (http/https)
- Restart server after changing `.env`

### WebSocket connection fails
- Check firewall settings
- Verify WebSocket URL format
- Test with browser developer tools

### Range requests not working
- Check that files exist and are readable
- Verify client sends proper `Range` header
- Test with `curl -H "Range: bytes=0-1023"`
