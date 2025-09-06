import React, { useState, useRef } from 'react'

const PasswordScreen = ({ isActive, currentUser, onPasswordSuccess, onBack }) => {
  const [password, setPassword] = useState('')
  const [showWrongPassword, setShowWrongPassword] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const passwordContainerRef = useRef(null)

  const handlePasswordSubmit = (e) => {
    if (e.key === 'Enter' || e.type === 'submit') {
      e.preventDefault()
      
      if (password === 'password') {
        // Correct password
        onPasswordSuccess()
        resetForm()
      } else {
        // Wrong password - show shake animation and error message
        setIsShaking(true)
        setShowWrongPassword(true)
        setPassword('')
        
        // Remove shake animation after it completes
        setTimeout(() => {
          setIsShaking(false)
        }, 600)
        
        // Hide error message after 3 seconds
        setTimeout(() => {
          setShowWrongPassword(false)
        }, 3000)
      }
    }
  }

  const resetForm = () => {
    setPassword('')
    setShowWrongPassword(false)
    setIsShaking(false)
  }

  const handleBack = () => {
    resetForm()
    onBack()
  }

  return (
    <div className={`screen ${isActive ? 'active' : ''}`}>
      <div className="enter-password-card">
        <button className="back-button" onClick={handleBack}>
          ← Back
        </button>
        
        <h2 className="user-greeting">Hi {currentUser} ...</h2>
        
        <div className="decorative-divider">
          <svg width="958" height="11" viewBox="0 0 958 11" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g filter="url(#filter0_ddiiii_71_4275)">
              <path d="M950.24 3C952.869 3 955 4.11929 955 5.5C955 6.88071 952.869 8 950.24 8H7.76C5.13112 8 3 6.88071 3 5.5C3 4.11929 5.13112 3 7.76 3H950.24Z" fill="#E2E0DB"/>
            </g>
            <defs>
              <filter id="filter0_ddiiii_71_4275" x="0" y="0" width="958" height="11" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                <feOffset dx="-1" dy="-1"/>
                <feGaussianBlur stdDeviation="1"/>
                <feColorMatrix type="matrix" values="0 0 0 0 0.505882 0 0 0 0 0.501961 0 0 0 0 0.490196 0 0 0 0.5 0"/>
                <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_71_4275"/>
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                <feOffset dx="1" dy="1"/>
                <feGaussianBlur stdDeviation="1"/>
                <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.3 0"/>
                <feBlend mode="normal" in2="effect1_dropShadow_71_4275" result="effect2_dropShadow_71_4275"/>
                <feBlend mode="normal" in="SourceGraphic" in2="effect2_dropShadow_71_4275" result="shape"/>
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                <feOffset dx="1" dy="1"/>
                <feGaussianBlur stdDeviation="1.5"/>
                <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
                <feColorMatrix type="matrix" values="0 0 0 0 0.505882 0 0 0 0 0.501961 0 0 0 0 0.490196 0 0 0 0.9 0"/>
                <feBlend mode="normal" in2="shape" result="effect3_innerShadow_71_4275"/>
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                <feOffset dx="-1" dy="-1"/>
                <feGaussianBlur stdDeviation="1"/>
                <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
                <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.9 0"/>
                <feBlend mode="normal" in2="effect3_innerShadow_71_4275" result="effect4_innerShadow_71_4275"/>
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                <feOffset dx="1" dy="-1"/>
                <feGaussianBlur stdDeviation="1"/>
                <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
                <feColorMatrix type="matrix" values="0 0 0 0 0.505882 0 0 0 0 0.501961 0 0 0 0 0.490196 0 0 0 0.2 0"/>
                <feBlend mode="normal" in2="effect4_innerShadow_71_4275" result="effect5_innerShadow_71_4275"/>
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                <feOffset dx="-1" dy="1"/>
                <feGaussianBlur stdDeviation="1"/>
                <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
                <feColorMatrix type="matrix" values="0 0 0 0 0.505882 0 0 0 0 0.501961 0 0 0 0 0.490196 0 0 0 0.2 0"/>
                <feBlend mode="normal" in2="effect5_innerShadow_71_4275" result="effect6_innerShadow_71_4275"/>
              </filter>
            </defs>
          </svg>
        </div>
        
        <div className="password-section">
          <div className="password-label">Enter your password</div>
          <div 
            className={`password-container ${isShaking ? 'shake' : ''}`}
            ref={passwordContainerRef}
          >
            <input 
              type="password" 
              className="password-input" 
              placeholder="Password placeholder"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handlePasswordSubmit}
              autoFocus={isActive}
            />
          </div>
          <div className={`wrong-password ${showWrongPassword ? 'show' : ''}`}>
            wrong password
          </div>
        </div>
      </div>
    </div>
  )
}

export default PasswordScreen
