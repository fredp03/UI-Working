import React from 'react'

const UserSelectScreen = ({ isActive, onUserSelect }) => {
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
