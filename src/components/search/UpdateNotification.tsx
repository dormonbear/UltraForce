import React, { useEffect, useState } from 'react'

interface UpdateNotificationProps {
  version: string
  releaseNotesUrl: string
  onDismiss: () => void
}

const FIREWORK_EMOJIS = ['🎉', '🎊', '✨', '🚀', '⭐', '💫', '🌟', '🎆']

interface Particle {
  id: number
  emoji: string
  x: number
  y: number
  delay: number
  duration: number
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  version,
  releaseNotesUrl,
  onDismiss
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 300)

    const newParticles: Particle[] = []
    for (let i = 0; i < 20; i++) {
      newParticles.push({
        id: i,
        emoji: FIREWORK_EMOJIS[Math.floor(Math.random() * FIREWORK_EMOJIS.length)],
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 1 + Math.random() * 1.5
      })
    }
    setParticles(newParticles)

    return () => clearTimeout(timer)
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(() => {
      onDismiss()
    }, 300)
  }

  return (
    <div className={`update-celebration ${isVisible ? 'visible' : ''}`}>
      <div className="fireworks-container">
        {particles.map((particle) => (
          <span
            key={particle.id}
            className="firework-particle"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`
            }}
          >
            {particle.emoji}
          </span>
        ))}
      </div>

      <div className="update-celebration-content">
        <div className="update-celebration-icon">🎉</div>
        <div className="update-celebration-text">
          <div className="update-celebration-title">
            UltraForce Updated to v{version}!
          </div>
          <div className="update-celebration-desc">
            Check out what is new in this release
          </div>
        </div>
        <a
          href={releaseNotesUrl}
          target="_blank"
          rel="noreferrer"
          className="update-celebration-link"
          onClick={(e) => e.stopPropagation()}
        >
          Release Notes
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 17L17 7M17 7H7M17 7V17" />
          </svg>
        </a>
        <button
          className="update-celebration-dismiss"
          onClick={(e) => {
            e.stopPropagation()
            handleDismiss()
          }}
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
