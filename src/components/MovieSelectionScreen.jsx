import React, { useState, useEffect } from 'react'

const MovieSelectionScreen = ({ isActive, onMovieSelect, onBack }) => {
  // Environment variables for API URLs
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch videos from the server
  useEffect(() => {
    if (isActive) {
      fetchMovies()
    }
  }, [isActive])

  const fetchMovies = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/videos`)
      if (response.ok) {
        const videoList = await response.json()
        setMovies(videoList)
        console.log('Movies loaded:', videoList.length)
      } else {
        console.error('Failed to fetch movies:', response.status)
        setError('Failed to load movies from server')
      }
    } catch (error) {
      console.error('Error fetching movies:', error)
      setError('Could not connect to movie server')
    } finally {
      setLoading(false)
    }
  }

  // Function to get poster URL based on video name
  const getPosterUrl = (videoName) => {
    if (!videoName) return null
    // Posters are stored as "VideoName - poster.jpg"
    return `${API_BASE_URL}/media/Images/Posters/${encodeURIComponent(videoName)} - poster.jpg`
  }

  // Check if a movie has a poster available
  const hasPoster = async (movieName) => {
    try {
      const response = await fetch(getPosterUrl(movieName), { method: 'HEAD' })
      return response.ok
    } catch {
      return false
    }
  }

  // Create poster slots with priority for movies that have posters
  const getPosterSlots = () => {
    if (movies.length === 0) return []

    // Available poster names from the directory
    const availablePosters = ['Oppenheimer', 'Sinners', 'Zodiac']
    
    // Find movies that have posters (more flexible matching)
    const moviesWithPosters = movies.filter(movie => 
      availablePosters.some(posterName => 
        movie.name.toLowerCase().includes(posterName.toLowerCase()) ||
        posterName.toLowerCase().includes(movie.name.toLowerCase())
      )
    )
    
    // Find movies without posters
    const moviesWithoutPosters = movies.filter(movie => 
      !availablePosters.some(posterName => 
        movie.name.toLowerCase().includes(posterName.toLowerCase()) ||
        posterName.toLowerCase().includes(movie.name.toLowerCase())
      )
    )

    // Combine movies, prioritizing those with posters for center position
    const orderedMovies = [...moviesWithPosters, ...moviesWithoutPosters]
    
    // Show all available movies (up to 5 positions)
    const numSlots = Math.min(orderedMovies.length, 5)
    
    // Position priority: center first (3), then 2, 4, 1, 5
    const positionOrder = [3, 2, 4, 1, 5]
    
    const slots = []
    for (let i = 0; i < numSlots; i++) {
      const movie = orderedMovies[i]
      const position = positionOrder[i] || (i + 1)
      
      const hasPosterMatch = availablePosters.some(posterName => 
        movie.name.toLowerCase().includes(posterName.toLowerCase()) ||
        posterName.toLowerCase().includes(movie.name.toLowerCase())
      )
      
      slots.push({
        position: position,
        movie: movie,
        hasMovie: true,
        hasPoster: hasPosterMatch
      })
    }
    
    // Sort by position for rendering
    return slots.sort((a, b) => a.position - b.position)
  }

  const handleMovieClick = (movie) => {
    console.log(`Selected movie: ${movie.name}`)
    onMovieSelect(movie)
  }

  return (
    <div className={`screen ${isActive ? 'active' : ''}`}>
      <div className="movie-page">
        <div className="top-bar">
          <div className="breadcrumb-trail">
            <a href="#" className="home">Home</a>
            <a href="#" className="video-party">Video Party</a>
          </div>
          
          <div className="right-side-buttons">
            <div className="button server-connection">
              <div className="status-dot"></div>
              <div className="connection-text">Connected</div>
            </div>
            
            <button className="button icon-button" onClick={onBack} title="Movie Button">
              <svg width="26" height="20" viewBox="0 0 26 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.8641 9.50574V17.1011C5.8641 17.6048 6.05715 18.0877 6.40077 18.4438C6.7444 18.7999 7.21046 19 7.69643 19H18.6904C19.1764 19 19.6424 18.7999 19.9861 18.4438C20.3297 18.0877 20.5227 17.6048 20.5227 17.1011V9.50574H5.8641ZM5.8641 9.50574L5.05787 6.78088C4.98719 6.54213 4.96266 6.29127 4.98567 6.04267C5.00868 5.79407 5.07878 5.55262 5.19197 5.33214C5.30515 5.11166 5.4592 4.91649 5.64528 4.75779C5.83135 4.59909 6.04581 4.48 6.27637 4.40732L16.794 1.08432C17.2581 0.936009 17.76 0.984699 18.1895 1.21969C18.6189 1.45469 18.9408 1.85676 19.0844 2.33757L19.8814 5.06242L5.8641 9.51523L5.8641 9.50574ZM8.24613 3.79968L11.3428 7.78727M13.0652 2.27111L16.1618 6.2587" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            
            <button className="button icon-button">
              <svg width="19" height="18" viewBox="0 0 19 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path opacity="0.5" d="M9.25 18C14.2206 18 18.25 13.9706 18.25 9C18.25 4.02944 14.2206 0 9.25 0C4.27944 0 0.25 4.02944 0.25 9C0.25 10.4397 0.588055 11.8005 1.18912 13.0072C1.34884 13.3279 1.40201 13.6945 1.30941 14.0406L0.773359 16.044C0.540659 16.9137 1.33631 17.7093 2.20601 17.4766L4.20945 16.9406C4.55554 16.848 4.92209 16.9012 5.24277 17.0609C6.44953 17.6619 7.81029 18 9.25 18Z" fill="black"/>
                <path d="M5.4925 9.7649C5.08243 9.7649 4.75 10.0973 4.75 10.5074C4.75 10.9175 5.08243 11.2499 5.4925 11.2499H10.9375C11.3476 11.2499 11.68 10.9175 11.68 10.5074C11.68 10.0973 11.3476 9.7649 10.9375 9.7649H5.4925Z" fill="black"/>
                <path d="M5.4925 6.2999C5.08243 6.2999 4.75 6.63232 4.75 7.0424C4.75 7.45247 5.08243 7.7849 5.4925 7.7849H13.4125C13.8226 7.7849 14.155 7.45247 14.155 7.0424C14.155 6.63232 13.8226 6.2999 13.4125 6.2999H5.4925Z" fill="black"/>
              </svg>
            </button>
          </div>
        </div>

        <h1 className="movie-selection-heading">What are we watching?</h1>

        <div className="background-frame">
          <div className="movie-poster-collection">
            {loading ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                width: '100%',
                color: '#535353',
                fontSize: '18px'
              }}>
                🎬 Loading movies...
              </div>
            ) : error ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                width: '100%',
                color: '#ef4444',
                fontSize: '18px',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div>❌ {error}</div>
                <button 
                  onClick={fetchMovies}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#333',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Retry
                </button>
              </div>
            ) : (
              getPosterSlots().map((slot) => (
                <div 
                  key={slot.position}
                  className={`movie-poster poster-${slot.position}`}
                  onClick={() => handleMovieClick(slot.movie)}
                  style={{ 
                    cursor: 'pointer'
                  }}
                >
                  <div 
                    className="poster-image"
                    style={{
                      backgroundColor: '#2a2a2a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {slot.hasPoster ? (
                      <img 
                        src={getPosterUrl(slot.movie.name)}
                        alt={`${slot.movie.name} poster`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          objectPosition: 'center'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.parentElement.innerHTML = '<div style="color: #666; font-size: 24px; display: flex; align-items: center; justify-content: center; height: 100%;">🎬</div>'
                        }}
                      />
                    ) : (
                      <div style={{ 
                        color: '#666', 
                        fontSize: '24px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        height: '100%' 
                      }}>
                        🎬
                      </div>
                    )}
                  </div>
                  <div className="poster-title">
                    {slot.movie.name}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MovieSelectionScreen
