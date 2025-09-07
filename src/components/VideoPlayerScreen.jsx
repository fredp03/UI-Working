import React, { useState, useRef, useEffect } from 'react'

const VideoPlayerScreen = ({ isActive, currentUser, selectedMovie, onGoToMovies }) => {
  const [isChatVisible, setIsChatVisible] = useState(false)
  const [chatMessage, setChatMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [currentVideo, setCurrentVideo] = useState(null)
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('disconnected') // 'disconnected', 'connecting', 'connected'
  const [isReceivingSync, setIsReceivingSync] = useState(false) // Prevent sync loops
  const [isSyncing, setIsSyncing] = useState(false) // Manual sync loading state
  const [hasVideoStarted, setHasVideoStarted] = useState(false) // Track if video has played
  
  const chatMessagesRef = useRef(null)
  const videoRef = useRef(null)
  const wsRef = useRef(null)
  const syncTimeoutRef = useRef(null)
  const lastSyncRef = useRef({ time: 0, timestamp: 0 })

  // Function to get thumbnail URL based on video name
  const getThumbnailUrl = (videoName) => {
    if (!videoName) return null
    // Try to match thumbnail by video name (case insensitive)
    // Thumbnails are stored as "VideoName - 16x9.jpg"
    return `http://localhost:8080/media/Images/Thumbnails/${encodeURIComponent(videoName)} - 16x9.jpg`
  }

  // WebSocket connection management
  useEffect(() => {
    if (!isActive) return

    const connectWebSocket = () => {
      try {
        setConnectionStatus('connecting')
        const wsUrl = `ws://localhost:8080/ws?roomId=shared&clientId=${currentUser}`
        console.log('Connecting to WebSocket:', wsUrl)
        
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          console.log('WebSocket connected')
          setConnectionStatus('connected')
        }

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            console.log('Received sync message:', message)
            handleSyncMessage(message)
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
          }
        }

        ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason)
          setConnectionStatus('disconnected')
          
          // Attempt to reconnect after 3 seconds
          setTimeout(() => {
            if (isActive) {
              connectWebSocket()
            }
          }, 3000)
        }

        ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          setConnectionStatus('disconnected')
        }
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error)
        setConnectionStatus('disconnected')
      }
    }

    connectWebSocket()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [isActive, currentUser])

  // Handle incoming sync messages
  const handleSyncMessage = (message) => {
    if (message.clientId === currentUser) return

    // Handle chat messages
    if (message.type === 'chat') {
      addChatMessage(message.message, 'received', message.clientId)
      return
    }

    // Handle sync requests - respond with current state
    if (message.type === 'syncRequest') {
      const video = videoRef.current
      if (video && currentVideo) {
        console.log('Responding to sync request with current state')
        const syncResponse = {
          type: 'syncResponse',
          roomId: 'shared',
          clientId: currentUser,
          currentTime: video.currentTime,
          paused: video.paused,
          sentAtMs: Date.now(),
          videoUrl: `http://localhost:8080${currentVideo.url}`
        }
        wsRef.current.send(JSON.stringify(syncResponse))
      }
      return
    }

    if (!videoRef.current) return

    setIsReceivingSync(true)
    
    try {
      const video = videoRef.current
      const now = Date.now()
      const networkDelay = (now - message.sentAtMs) / 1000
      const adjustedTime = message.currentTime + (networkDelay * 0.5) // Compensate for network delay

      switch (message.type) {
        case 'loadVideo':
        case 'syncResponse': // Handle manual sync responses the same as loadVideo
          if (message.videoUrl && message.videoUrl !== video.src) {
            // Find the video object from our videos list
            const videoObject = videos.find(v => `http://localhost:8080${v.url}` === message.videoUrl)
            if (videoObject) {
              setCurrentVideo(videoObject)
              setHasVideoStarted(false) // Reset video started state when switching videos
            }
          }
          
          if (message.type === 'syncResponse') {
            setIsSyncing(false) // Clear syncing state when we receive a response
          }
          // Fall through to sync time and play state
          
        case 'play':
        case 'pause':
        case 'seek':
        case 'timeSync':
          // Sync playback time if drift is significant  
          const currentTimeDrift = Math.abs(video.currentTime - adjustedTime)
          if (currentTimeDrift > 0.2) { // Reduced tolerance to 200ms for tighter sync
            console.log(`Syncing time: ${video.currentTime.toFixed(2)}s -> ${adjustedTime.toFixed(2)}s (drift: ${currentTimeDrift.toFixed(2)}s)`)
            video.currentTime = adjustedTime
          }

          // Sync play/pause state
          if (message.type === 'play' || (message.type === 'loadVideo' && !message.paused) || (message.type === 'syncResponse' && !message.paused)) {
            if (video.paused) {
              setHasVideoStarted(true) // Mark that video has started playing (remotely)
              video.play().catch(e => console.log('Auto-play prevented:', e))
            }
          } else if (message.type === 'pause' || (message.type === 'loadVideo' && message.paused) || (message.type === 'syncResponse' && message.paused)) {
            if (!video.paused) {
              video.pause()
            }
          }

          // Store sync reference for drift correction
          lastSyncRef.current = {
            time: adjustedTime,
            timestamp: now,
            paused: message.paused
          }
          break
      }
    } catch (error) {
      console.error('Error handling sync message:', error)
    } finally {
      // Reset sync flag after a short delay to prevent immediate re-sync
      setTimeout(() => setIsReceivingSync(false), 100)
    }
  }

  // Send sync messages to other clients
  const sendSyncMessage = (type, additionalData = {}) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || isReceivingSync) {
      return
    }

    const video = videoRef.current
    if (!video) return

    const message = {
      type,
      roomId: 'shared',
      clientId: currentUser,
      currentTime: video.currentTime,
      paused: video.paused,
      sentAtMs: Date.now(),
      ...additionalData
    }

    console.log('Sending sync message:', message)
    wsRef.current.send(JSON.stringify(message))
  }

  // Manual sync function - requests current state from other user
  const requestManualSync = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return
    }

    if (isSyncing) return // Prevent multiple sync requests

    setIsSyncing(true)

    // Send a sync request to get the current state from other users
    const syncRequest = {
      type: 'syncRequest',
      roomId: 'shared',
      clientId: currentUser,
      sentAtMs: Date.now()
    }

    console.log('Requesting manual sync...')
    wsRef.current.send(JSON.stringify(syncRequest))

    // Reset syncing state after 3 seconds (timeout)
    setTimeout(() => {
      setIsSyncing(false)
    }, 3000)
  }

  // Continuous drift correction during playback
  useEffect(() => {
    if (!isActive) return

    const driftCorrectionInterval = setInterval(() => {
      const video = videoRef.current
      const lastSync = lastSyncRef.current
      
      if (!video || !lastSync.timestamp || video.paused || lastSync.paused) {
        return
      }

      // Calculate expected time based on last sync
      const timeSinceSync = (Date.now() - lastSync.timestamp) / 1000
      const expectedTime = lastSync.time + timeSinceSync
      const actualTime = video.currentTime
      const drift = Math.abs(actualTime - expectedTime)

      // Correct significant drift (> 300ms) for tighter sync
      if (drift > 0.3) {
        console.log(`Drift correction: ${actualTime.toFixed(2)}s -> ${expectedTime.toFixed(2)}s (drift: ${drift.toFixed(2)}s)`)
        video.currentTime = expectedTime
      }
    }, 2000) // Check every 2 seconds

    return () => clearInterval(driftCorrectionInterval)
  }, [isActive])

  // Fetch videos from API when component becomes active
  useEffect(() => {
    if (isActive && videos.length === 0) {
      fetchVideos()
    }
  }, [isActive])

  // Auto-load Zodiac video when videos are fetched
  useEffect(() => {
    if (videos.length > 0 && !currentVideo) {
      const zodiacVideo = videos.find(video => video.name.toLowerCase().includes('zodiac'))
      if (zodiacVideo) {
        setCurrentVideo(zodiacVideo)
        
        // Send loadVideo message to sync with other clients
        setTimeout(() => {
          sendSyncMessage('loadVideo', { 
            videoUrl: `http://localhost:8080${zodiacVideo.url}` 
          })
        }, 1000) // Small delay to ensure video element is ready
      }
    }
  }, [videos, currentVideo])

  // Reset video started state when current video changes
  useEffect(() => {
    setHasVideoStarted(false)
  }, [currentVideo])

  // Handle movie selection from movie selection screen
  useEffect(() => {
    if (selectedMovie && isActive) {
      console.log('Loading selected movie:', selectedMovie)
      setCurrentVideo(selectedMovie)
      setHasVideoStarted(false)
      
      // Send sync message to other users if connected
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        setTimeout(() => {
          sendSyncMessage('loadVideo', { 
            videoUrl: `http://localhost:8080${selectedMovie.url}` 
          })
        }, 1000) // Small delay to ensure video element is ready
      }
    }
  }, [selectedMovie, isActive])

  // Video event handlers for synchronization
  const handleVideoPlay = () => {
    setHasVideoStarted(true) // Mark that video has started playing
    if (!isReceivingSync) {
      console.log('Local play event')
      sendSyncMessage('play')
    }
  }

  const handleVideoPause = () => {
    if (!isReceivingSync) {
      console.log('Local pause event')
      sendSyncMessage('pause')
    }
  }

  const handleVideoSeeked = () => {
    if (!isReceivingSync) {
      console.log('Local seek event')
      sendSyncMessage('seek')
    }
  }

  // Periodic time sync for playing videos
  useEffect(() => {
    if (!isActive) return

    const timeSyncInterval = setInterval(() => {
      const video = videoRef.current
      if (video && !video.paused && !isReceivingSync) {
        sendSyncMessage('timeSync')
      }
    }, 5000) // Send time sync every 5 seconds during playback

    return () => clearInterval(timeSyncInterval)
  }, [isActive, isReceivingSync])

  const fetchVideos = async () => {
    setLoading(true)
    try {
      const response = await fetch('http://localhost:8080/api/videos')
      if (response.ok) {
        const videoList = await response.json()
        setVideos(videoList)
        console.log('Videos loaded:', videoList)
      } else {
        console.error('Failed to fetch videos:', response.status)
      }
    } catch (error) {
      console.error('Error fetching videos:', error)
    } finally {
      setLoading(false)
    }
  }

  const addChatMessage = (text, type = 'sent', sender = null) => {
    const displayText = type === 'received' && sender ? `${sender}: ${text}` : text
    const newMessage = { type, text: displayText }
    setMessages(prev => [...prev, newMessage])
    
    // Scroll to bottom
    setTimeout(() => {
      if (chatMessagesRef.current) {
        chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
      }
    }, 100)
  }

  const updateContainerAspectRatio = (aspectRatio) => {
    // Update the page-items container to match video aspect ratio
    const pageItemsElement = document.getElementById('page-items')
    if (pageItemsElement && aspectRatio && aspectRatio > 0) {
      // Store the original aspect ratio for when chat is closed
      pageItemsElement.setAttribute('data-video-aspect-ratio', aspectRatio.toString())
      
      if (!isChatVisible) {
        // Only update aspect ratio when chat is not visible
        pageItemsElement.style.aspectRatio = aspectRatio.toString()
        pageItemsElement.style.width = 'clamp(678px, 67.4vw, 2158px)'
      } else {
        // If chat is visible, calculate expanded container
        const chatWidthRatio = 0.25
        const videoWidthRatio = 1 - chatWidthRatio
        const newContainerAspectRatio = aspectRatio / videoWidthRatio
        
        pageItemsElement.style.aspectRatio = newContainerAspectRatio.toString()
        pageItemsElement.style.width = 'clamp(889px, 88.5vw, 2830px)'
      }
      
      console.log('Updated container aspect ratio to:', aspectRatio.toFixed(3))
    }
  }

  // Update aspect ratio when chat visibility changes
  useEffect(() => {
    const pageItemsElement = document.getElementById('page-items')
    if (pageItemsElement) {
      const videoAspectRatio = parseFloat(pageItemsElement.getAttribute('data-video-aspect-ratio'))
      
      if (isChatVisible && videoAspectRatio && videoAspectRatio > 0) {
        // When chat is visible, calculate new aspect ratio to accommodate chat
        // Chat takes fixed width, video keeps its aspect ratio
        const chatWidthRatio = 0.25 // Chat takes about 25% of container width
        const videoWidthRatio = 1 - chatWidthRatio
        
        // Calculate new container aspect ratio
        // If video aspect ratio is W:H, and we want video to take 75% of container width,
        // then container aspect ratio should be (W/0.75):H
        const newContainerAspectRatio = videoAspectRatio / videoWidthRatio
        
        pageItemsElement.style.aspectRatio = newContainerAspectRatio.toString()
        pageItemsElement.style.width = 'clamp(889px, 88.5vw, 2830px)' // Expanded width
      } else if (videoAspectRatio && videoAspectRatio > 0) {
        // When chat is hidden, use the video's aspect ratio and normal width
        pageItemsElement.style.aspectRatio = videoAspectRatio.toString()
        pageItemsElement.style.width = 'clamp(678px, 67.4vw, 2158px)'
      }
    }
  }, [isChatVisible])

  // Keyboard shortcuts for chat
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + C for chat toggle (when on video player)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && isActive) {
        e.preventDefault()
        toggleChat()
      }
    }

    if (isActive) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isActive, isChatVisible])

  const toggleChat = () => {
    setIsChatVisible(!isChatVisible)
  }

  const closeChat = () => {
    setIsChatVisible(false)
  }

  const handleChatSubmit = (e) => {
    if (e.key === 'Enter' && chatMessage.trim()) {
      const message = chatMessage.trim()
      addChatMessage(message, 'sent')
      
      // Send chat message through WebSocket if connected
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'chat',
          roomId: 'shared',
          clientId: currentUser,
          message: message,
          sentAtMs: Date.now()
        }))
      }
      
      setChatMessage('')
    }
  }

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className={`screen ${isActive ? 'active' : ''}`}>
      <div className="movie-page">
        <div className="top-bar">
          <div className="breadcrumb-trail">
            <a href="#" className="home">Home</a>
            <a href="#" className="video-party">
              {currentVideo ? currentVideo.name : 'Video Party'}
            </a>
          </div>
          
          <div className="right-side-buttons">
            <button 
              className="button server-connection"
              onClick={requestManualSync}
              disabled={connectionStatus !== 'connected' || isSyncing}
              title={
                connectionStatus !== 'connected' ? 'Not connected' :
                isSyncing ? 'Syncing...' : 'Click to sync with other user'
              }
              style={{ 
                cursor: (connectionStatus === 'connected' && !isSyncing) ? 'pointer' : 'not-allowed',
                opacity: (connectionStatus === 'connected' && !isSyncing) ? 1 : 0.7
              }}
            >
              <div 
                className="status-dot" 
                style={{ 
                  backgroundColor: 
                    isSyncing ? '#3b82f6' : // Blue when syncing
                    connectionStatus === 'connected' ? '#22c55e' : 
                    connectionStatus === 'connecting' ? '#f59e0b' : '#ef4444' 
                }}
              ></div>
              <div className="connection-text">
                {isSyncing ? 'Syncing...' :
                 connectionStatus === 'connected' ? 'Synced' : 
                 connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
              </div>
            </button>
            
            <button className="button icon-button" onClick={onGoToMovies} title="Movie Button">
              <svg width="26" height="20" viewBox="0 0 26 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.8641 9.50574V17.1011C5.8641 17.6048 6.05715 18.0877 6.40077 18.4438C6.7444 18.7999 7.21046 19 7.69643 19H18.6904C19.1764 19 19.6424 18.7999 19.9861 18.4438C20.3297 18.0877 20.5227 17.6048 20.5227 17.1011V9.50574H5.8641ZM5.8641 9.50574L5.05787 6.78088C4.98719 6.54213 4.96266 6.29127 4.98567 6.04267C5.00868 5.79407 5.07878 5.55262 5.19197 5.33214C5.30515 5.11166 5.4592 4.91649 5.64528 4.75779C5.83135 4.59909 6.04581 4.48 6.27637 4.40732L16.794 1.08432C17.2581 0.936009 17.76 0.984699 18.1895 1.21969C18.6189 1.45469 18.9408 1.85676 19.0844 2.33757L19.8814 5.06242L5.8641 9.51523L5.8641 9.50574ZM8.24613 3.79968L11.3428 7.78727M13.0652 2.27111L16.1618 6.2587" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            
            <button 
              className={`button icon-button ${isChatVisible ? 'active' : ''}`}
              onClick={toggleChat}
            >
              <svg width="19" height="18" viewBox="0 0 19 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path opacity="0.5" d="M9.25 18C14.2206 18 18.25 13.9706 18.25 9C18.25 4.02944 14.2206 0 9.25 0C4.27944 0 0.25 4.02944 0.25 9C0.25 10.4397 0.588055 11.8005 1.18912 13.0072C1.34884 13.3279 1.40201 13.6945 1.30941 14.0406L0.773359 16.044C0.540659 16.9137 1.33631 17.7093 2.20601 17.4766L4.20945 16.9406C4.55554 16.848 4.92209 16.9012 5.24277 17.0609C6.44953 17.6619 7.81029 18 9.25 18Z" fill="black"/>
                <path d="M5.4925 9.7649C5.08243 9.7649 4.75 10.0973 4.75 10.5074C4.75 10.9175 5.08243 11.2499 5.4925 11.2499H10.9375C11.3476 11.2499 11.68 10.9175 11.68 10.5074C11.68 10.0973 11.3476 9.7649 10.9375 9.7649H5.4925Z" fill="black"/>
                <path d="M5.4925 6.2999C5.08243 6.2999 4.75 6.63232 4.75 7.0424C4.75 7.45247 5.08243 7.7849 5.4925 7.7849H13.4125C13.8226 7.7849 14.155 7.45247 14.155 7.0424C14.155 6.63232 13.8226 6.2999 13.4125 6.2999H5.4925Z" fill="black"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div className={`page-items ${isChatVisible ? 'chat-visible' : ''}`} id="page-items">
          <div className="video-player">
            {currentVideo ? (
              <video 
                ref={videoRef}
                className="video-placeholder" 
                src={`http://localhost:8080${currentVideo.url}`}
                poster={!hasVideoStarted ? getThumbnailUrl(currentVideo.name) : undefined}
                controls
                autoPlay={false}
                preload="metadata"
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover' // Fill container completely
                }}
                onPlay={handleVideoPlay}
                onPause={handleVideoPause}
                onSeeked={handleVideoSeeked}
                onLoadStart={() => console.log('Video loading started')}
                onLoadedData={() => {
                  console.log('Video loaded successfully')
                  // Log the video dimensions for debugging
                  if (videoRef.current) {
                    console.log('Video dimensions:', {
                      videoWidth: videoRef.current.videoWidth,
                      videoHeight: videoRef.current.videoHeight,
                      aspectRatio: (videoRef.current.videoWidth / videoRef.current.videoHeight).toFixed(3)
                    })
                  }
                }}
                onLoadedMetadata={() => {
                  // Update container aspect ratio when metadata loads
                  if (videoRef.current) {
                    const video = videoRef.current
                    const aspectRatio = video.videoWidth / video.videoHeight
                    
                    updateContainerAspectRatio(aspectRatio)
                    
                    // Send loadVideo sync message when video metadata is ready
                    if (!isReceivingSync) {
                      sendSyncMessage('loadVideo', { 
                        videoUrl: `http://localhost:8080${currentVideo.url}` 
                      })
                    }
                  }
                }}
                onError={(e) => {
                  console.error('Video error:', e)
                }}
              />) : loading ? (
              <div style={{ 
                width: '100%', 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#535353',
                fontSize: '18px'
              }}>
                🎬 Loading videos...
              </div>
            ) : (
              <div style={{ 
                width: '100%', 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#535353',
                fontSize: '18px',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div>📁 No videos found</div>
                <div style={{ fontSize: '14px', opacity: 0.7 }}>
                  Add video files to the media directory
                </div>
              </div>
            )}
          </div>
          
          <div className="chat-section">
            <button className="chat-close-button" onClick={closeChat}>
              <svg width="9" height="8" viewBox="0 0 9 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M8.29735 0.166357C8.52106 0.388954 8.52197 0.750762 8.29937 0.974477L5.30611 3.98278L8.33364 7.02552C8.55624 7.24924 8.55533 7.61105 8.33162 7.83364C8.1079 8.05624 7.7461 8.05533 7.5235 7.83162L4.5 4.79293L1.4765 7.83162C1.2539 8.05533 0.892096 8.05624 0.668381 7.83364C0.444666 7.61104 0.44376 7.24924 0.666357 7.02552L3.69389 3.98278L0.700631 0.97448C0.478034 0.750765 0.47894 0.388957 0.702655 0.16636C0.92637 -0.0562373 1.28818 -0.0553311 1.51077 0.168384L4.5 3.17262L7.48923 0.168381C7.71182 -0.0553341 8.07363 -0.0562404 8.29735 0.166357Z" fill="#474747" fillOpacity="0.69"/>
              </svg>
            </button>

            <div className="user-joined-indicator">
              <span className="user-joined-text">
                {currentUser} • {connectionStatus === 'connected' ? 'Synchronized' : 'Local Only'}
              </span>
            </div>

            <div className="chat-messages" ref={chatMessagesRef}>
              {messages.map((message, index) => (
                <div key={index} className={`message-bubble ${message.type}`}>
                  {message.text}
                </div>
              ))}
            </div>

            <input 
              type="text" 
              className="chat-input" 
              placeholder="Start typing...."
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyPress={handleChatSubmit}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoPlayerScreen
