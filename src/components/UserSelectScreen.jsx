import React, { useEffect } from 'react'
import anime from 'animejs/lib/anime.es.js'

const UserSelectScreen = ({ isActive, onUserSelect }) => {
  useEffect(() => {
    if (isActive) {
      anime.set('.user-card', { opacity: 0, translateY: 20 })
      anime({
        targets: '.user-card',
        opacity: 1,
        translateY: 0,
        delay: anime.stagger(100),
        easing: 'easeOutQuad'
      })
    }
  }, [isActive])

  return (
    <div className={`screen ${isActive ? 'active' : ''}`}>
      <div className="select-user-card">
        <h1 className="page-heading">Who's Here?</h1>
        
        <div className="user-cards-container">
          <div className="user-card" onClick={() => onUserSelect('Fred')}>
            <div className="user-name">Fred</div>
          </div>
          
          <div className="user-card" onClick={() => onUserSelect('Avalene')}>
            <div className="user-name">Avalene</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserSelectScreen
