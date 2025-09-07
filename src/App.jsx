import { useState, useEffect } from 'react'
import UserSelectScreen from './components/UserSelectScreen'
import PasswordScreen from './components/PasswordScreen'
import LoadingScreen from './components/LoadingScreen'
import VideoPlayerScreen from './components/VideoPlayerScreen'
import MovieSelectionScreen from './components/MovieSelectionScreen'

function App() {
  const [currentScreen, setCurrentScreen] = useState('user-select')
  const [currentUser, setCurrentUser] = useState('')
  const [selectedMovie, setSelectedMovie] = useState(null)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // ESC key to go back
      if (e.key === 'Escape') {
        if (currentScreen === 'password') {
          setCurrentScreen('user-select')
        } else if (currentScreen === 'movie-selection') {
          setCurrentScreen('video-player')
        }
      }
      
      // Ctrl/Cmd + M for movie selection (when on video player)
      if ((e.ctrlKey || e.metaKey) && e.key === 'm' && currentScreen === 'video-player') {
        e.preventDefault()
        setCurrentScreen('movie-selection')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [currentScreen])

  const handleUserSelect = (userName) => {
    setCurrentUser(userName)
    setCurrentScreen('password')
  }

  const handlePasswordSuccess = () => {
    setCurrentScreen('loading')
    // Show loading screen for 2 seconds then navigate to video player
    setTimeout(() => {
      setCurrentScreen('video-player')
    }, 2000)
  }

  const handleBackToUserSelect = () => {
    setCurrentScreen('user-select')
    setCurrentUser('')
  }

  const handleGoToMovies = () => {
    setCurrentScreen('movie-selection')
  }

  const handleBackToVideoPlayer = () => {
    setCurrentScreen('video-player')
  }

  const handleMovieSelect = (movie) => {
    console.log('Movie selected:', movie)
    setSelectedMovie(movie)
    setCurrentScreen('video-player')
  }

  return (
    <div className="app">
      <UserSelectScreen 
        isActive={currentScreen === 'user-select'}
        onUserSelect={handleUserSelect}
      />
      
      <PasswordScreen 
        isActive={currentScreen === 'password'}
        currentUser={currentUser}
        onPasswordSuccess={handlePasswordSuccess}
        onBack={handleBackToUserSelect}
      />
      
      <LoadingScreen 
        isActive={currentScreen === 'loading'}
      />
      
      <VideoPlayerScreen 
        isActive={currentScreen === 'video-player'}
        currentUser={currentUser}
        selectedMovie={selectedMovie}
        onGoToMovies={handleGoToMovies}
      />
      
      <MovieSelectionScreen 
        isActive={currentScreen === 'movie-selection'}
        onMovieSelect={handleMovieSelect}
        onBack={handleBackToVideoPlayer}
      />
    </div>
  )
}

export default App
