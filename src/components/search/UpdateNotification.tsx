import React, { useState, useEffect } from 'react'

interface UpdateNotificationProps {
  version: string
  releaseNotesUrl: string
  onDismiss: () => void
}

const FIREWORK_EMOJIS = ['🎉', '🎊', '✨', '🚀', '⭐', '💫', '🌟', '🎆']

function generateParticles() {
  return Array.from({ length: 20 }, (_, i) => ({
    id: i,
    emoji: FIREWORK_EMOJIS[Math.floor(Math.random() * FIREWORK_EMOJIS.length)],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 0.5}s`,
    duration: `${1.5 + Math.random() * 1}s`
  }))
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  version,
  releaseNotesUrl,
  onDismiss
}) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const [particles] = useState(generateParticles)

  return (
    <div className={`update-celebration ${isVisible ? 'visible' : ''}`}>
      <div className="fireworks-container">
        {particles.map((p) => (
          <span
            key={p.id}
            className="firework-particle"
            style={{
              left: p.left,
              animationDelay: p.delay,
              animationDuration: p.duration
            }}
          >
            {p.emoji}
          </span>
        ))}
      </div>
      <div className="update-celebration-content">
        <span className="update-celebration-icon">🎉</span>
        <div className="update-celebration-text">
          <div className="update-celebration-title">
            Updated to v{version}
          </div>
          <div className="update-celebration-desc">
            See what is new in this version
          </div>
        </div>
        <a
          href={releaseNotesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="update-celebration-link"
        >
          Release Notes
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
        <button
          className="update-celebration-dismiss"
          onClick={onDismiss}
          title="Dismiss"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default UpdateNotification
