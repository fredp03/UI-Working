require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { WebSocketServer } = require('ws')
const http = require('http')
const path = require('path')
const fs = require('fs')
const mime = require('mime')
const { glob } = require('glob')

// Import media processing functions
const mediaProcessor = (() => {
  try {
    return require('../scripts/media/process-media.js')
  } catch (error) {
    console.warn('Media processor not available:', error.message)
    return null
  }
})()

const app = express()
const server = http.createServer(app)

// Configuration
const PORT = process.env.PORT || 8080
const MEDIA_DIR = process.env.MEDIA_DIR || '../media'
const ORIGIN = process.env.ORIGIN || 'http://localhost:5173'
const SHARED_TOKEN = process.env.SHARED_TOKEN

// CORS middleware with preflight handling
const allowedOrigins = [
  'http://localhost:5173',
  'https://fredav.netlify.app'
]

app.use((req, res, next) => {
  const origin = req.headers.origin
  
  // Allow both development and production origins
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Authorization, Range, Content-Type')
  res.header('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range')
  res.header('Access-Control-Allow-Credentials', 'true')
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }
  
  next()
})

app.use(express.json())

// Auth middleware for API routes
const authMiddleware = (req, res, next) => {
  if (SHARED_TOKEN) {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' })
    }
    
    const token = authHeader.substring(7)
    if (token !== SHARED_TOKEN) {
      return res.status(401).json({ error: 'Invalid token' })
    }
  }
  next()
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: Date.now() })
})

app.get('/api/videos', authMiddleware, async (req, res) => {
  try {
    if (!fs.existsSync(MEDIA_DIR)) {
      return res.status(404).json({ error: 'Media directory not found' })
    }

    // Find video files recursively
    const videoExtensions = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v']
    const pattern = `**/*.{${videoExtensions.join(',')}}`
    const files = await glob(pattern, { cwd: MEDIA_DIR, nodir: true })

    const videos = await Promise.all(files.map(async relPath => {
      const fullPath = path.join(MEDIA_DIR, relPath)
      const parsedPath = path.parse(relPath)
      const captionsPath = path.join(parsedPath.dir, parsedPath.name + '.vtt')
      const captionsFullPath = path.join(MEDIA_DIR, captionsPath)
      
      // Check audio compatibility if media processor is available
      let audioCompatible = true
      let audioInfo = null
      
      if (mediaProcessor) {
        try {
          const compatibility = await mediaProcessor.checkAudioCompatibility(fullPath)
          audioCompatible = compatibility.compatible
          audioInfo = compatibility.audioInfo
        } catch (error) {
          console.warn('Failed to check audio compatibility for', relPath, ':', error.message)
        }
      }
      
      return {
        id: Buffer.from(relPath).toString('base64'),
        name: parsedPath.name,
        relPath: relPath,
        url: `/media/${encodeURIComponent(relPath)}`,
        captionsUrl: fs.existsSync(captionsFullPath) ? `/media/${encodeURIComponent(captionsPath)}` : undefined,
        audioCompatible,
        audioInfo
      }
    }))

    res.json(videos)
  } catch (error) {
    console.error('Error scanning media directory:', error)
    res.status(500).json({ error: 'Failed to scan media directory' })
  }
})

// New endpoint to process media compatibility
app.post('/api/videos/process-compatibility', authMiddleware, async (req, res) => {
  if (!mediaProcessor) {
    return res.status(503).json({ error: 'Media processor not available' })
  }

  try {
    console.log('Starting media compatibility processing...')
    await mediaProcessor.processMediaFiles()
    res.json({ success: true, message: 'Media compatibility processing completed' })
  } catch (error) {
    console.error('Media processing failed:', error)
    res.status(500).json({ error: 'Media processing failed', details: error.message })
  }
})

// Handle preflight requests for media endpoint
app.options('/media/*', (req, res) => {
  const origin = req.headers.origin
  if (allowedOrigins.includes(origin)) {
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    });
  }
  res.status(200).end();
});

// Media streaming with Range support
app.get('/media/*', authMiddleware, (req, res) => {
  try {
    const encodedPath = req.params[0]
    const relPath = decodeURIComponent(encodedPath)
    const fullPath = path.join(MEDIA_DIR, relPath)

    // Security check - ensure path is within media directory
    const resolvedPath = path.resolve(fullPath)
    const resolvedMediaDir = path.resolve(MEDIA_DIR)
    if (!resolvedPath.startsWith(resolvedMediaDir)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    const stat = fs.statSync(fullPath)
    const fileSize = stat.size
    let mimeType = mime.getType(fullPath) || 'application/octet-stream'
    
    // Safari-specific MIME type fixes
    const userAgent = req.headers['user-agent'] || ''
    const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome')
    
    if (isSafari && mimeType === 'video/mp4') {
      // Force Safari to treat as MP4 video
      mimeType = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'
    }

    // Set CORS headers dynamically based on request origin
    const origin = req.headers.origin
    const corsHeaders = {
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range',
      'Access-Control-Allow-Credentials': 'true',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
    
    // Safari-specific headers
    if (isSafari) {
      corsHeaders['X-Content-Type-Options'] = 'nosniff'
      corsHeaders['Content-Disposition'] = 'inline'
    }
    
    if (allowedOrigins.includes(origin)) {
      corsHeaders['Access-Control-Allow-Origin'] = origin
    }
    
    res.set(corsHeaders)

    // Handle Range requests for video streaming
    const range = req.headers.range
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      
      // Safari sometimes sends invalid ranges, so clamp them
      if (start >= fileSize) {
        res.status(416).set({
          'Content-Range': `bytes */${fileSize}`
        })
        return res.end()
      }
      
      // Ensure end doesn't exceed file size
      if (end >= fileSize) {
        end = fileSize - 1
      }
      
      // Safari prefers smaller chunk sizes
      if (isSafari && !parts[1]) {
        // If no end specified and Safari, send first chunk
        end = Math.min(start + 1024 * 1024, fileSize - 1) // 1MB chunks for Safari
      }

      const chunkSize = (end - start) + 1
      const stream = fs.createReadStream(fullPath, { start, end })

      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunkSize
      })

      stream.on('error', (err) => {
        console.error('Stream error:', err)
        if (!res.headersSent) {
          res.status(500).end()
        }
      })

      stream.pipe(res)
    } else {
      // For Safari, always suggest range support even for full file requests
      if (isSafari) {
        res.status(206).set({
          'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`,
          'Content-Length': fileSize
        })
      } else {
        res.set('Content-Length', fileSize)
      }
      
      const stream = fs.createReadStream(fullPath)
      
      stream.on('error', (err) => {
        console.error('Stream error:', err)
        if (!res.headersSent) {
          res.status(500).end()
        }
      })
      
      stream.pipe(res)
    }
  } catch (error) {
    console.error('Error serving media file:', error)
    res.status(500).json({ error: 'Failed to serve file' })
  }
})

// WebSocket server for real-time sync
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
})

// Room management
const rooms = new Map() // roomId -> Set of client websockets
const roomStates = new Map() // roomId -> { videoUrl, videoRelPath, currentTime, paused }

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const roomId = url.searchParams.get('roomId')
  const clientId = url.searchParams.get('clientId')
  const token = url.searchParams.get('token')

  // Auth check for WebSocket
  if (SHARED_TOKEN && token !== SHARED_TOKEN) {
    ws.close(1008, 'Invalid token')
    return
  }

  if (!roomId || !clientId) {
    ws.close(1008, 'Missing roomId or clientId')
    return
  }

  // Add client to room
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set())
  }
  
  const room = rooms.get(roomId)
  room.add(ws)

  // Store client info on websocket
  ws.roomId = roomId
  ws.clientId = clientId

  console.log(`Client ${clientId} joined room ${roomId}. Room size: ${room.size}`)

  // Send current room state to new client
  const existingState = roomStates.get(roomId)
  if (existingState && existingState.videoUrl) {
    console.log(`Sending room state to new client ${clientId}:`, existingState)
    
    // Calculate current time if video is playing
    let currentTime = existingState.currentTime
    if (!existingState.paused && existingState.lastUpdateMs) {
      const timeSinceUpdate = (Date.now() - existingState.lastUpdateMs) / 1000
      currentTime = existingState.currentTime + timeSinceUpdate
    }
    
    // Send a single comprehensive sync message
    const syncMessage = {
      type: 'loadVideo',
      roomId,
      clientId: 'server',
      currentTime: currentTime,
      paused: existingState.paused,
      sentAtMs: Date.now(),
      videoUrl: existingState.videoUrl
    }
    
    // Send immediately without delay
    ws.send(JSON.stringify(syncMessage))
  }

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString())
      
      // Validate message structure
      if (!message.type || !message.roomId || !message.clientId) {
        return
      }

      // Update room state for sync messages
      if (['loadVideo', 'play', 'pause', 'seek', 'timeSync'].includes(message.type)) {
        const currentState = roomStates.get(message.roomId) || { currentTime: 0, paused: true }
        
        // Update video URL if provided
        if (message.videoUrl) {
          currentState.videoUrl = message.videoUrl
          // Extract relative path from URL for easier lookup
          if (message.videoUrl.startsWith('/media/')) {
            currentState.videoRelPath = decodeURIComponent(message.videoUrl.replace('/media/', ''))
          }
          console.log(`Room ${message.roomId} video changed to:`, message.videoUrl)
        }
        
        // Only update state if this is a control message (not timeSync)
        if (message.type !== 'timeSync') {
          currentState.currentTime = message.currentTime
          currentState.paused = message.paused
          currentState.lastUpdateMs = Date.now()
          roomStates.set(message.roomId, currentState)
          
          console.log(`Room ${message.roomId} state updated by ${message.clientId}:`, {
            type: message.type,
            currentTime: currentState.currentTime,
            paused: currentState.paused
          })
        }
      }

      // Broadcast to all other clients in the same room
      const room = rooms.get(message.roomId)
      if (room) {
        const payload = JSON.stringify(message)
        room.forEach(client => {
          if (client !== ws && client.readyState === client.OPEN) {
            client.send(payload)
          }
        })
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error)
    }
  })

  ws.on('close', () => {
    const room = rooms.get(roomId)
    if (room) {
      room.delete(ws)
      console.log(`Client ${clientId} left room ${roomId}. Room size: ${room.size}`)

      // Clean up empty rooms
      if (room.size === 0) {
        rooms.delete(roomId)
        roomStates.delete(roomId)
        console.log(`Room ${roomId} deleted (empty)`)
      }
    }
  })

  ws.on('error', (error) => {
    console.error('WebSocket error:', error)
  })
})

// Error handling
app.use((err, req, res, next) => {
  console.error('Express error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

// Start server
server.listen(PORT, () => {
  console.log(`VideoParty server running on port ${PORT}`)
  console.log(`Media directory: ${path.resolve(MEDIA_DIR)}`)
  console.log(`CORS origin: ${ORIGIN}`)
  console.log(`Authentication: ${SHARED_TOKEN ? 'Enabled' : 'Disabled'}`)
})
