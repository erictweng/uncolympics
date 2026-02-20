import React from 'react'
import './confetti.css'

interface ConfettiProps {
  show: boolean
}

const Confetti: React.FC<ConfettiProps> = ({ show }) => {
  if (!show) return null

  // Create 30-50 confetti pieces with random properties
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    animationDelay: Math.random() * 2,
    animationDuration: 3 + Math.random() * 2,
    backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'][
      Math.floor(Math.random() * 8)
    ],
    width: 8 + Math.random() * 6,
    height: 12 + Math.random() * 8
  }))

  return (
    <div className="confetti-container">
      {pieces.map(piece => (
        <div
          key={piece.id}
          className="confetti-piece"
          style={{
            left: `${piece.left}%`,
            animationDelay: `${piece.animationDelay}s`,
            animationDuration: `${piece.animationDuration}s`,
            backgroundColor: piece.backgroundColor,
            width: `${piece.width}px`,
            height: `${piece.height}px`
          }}
        />
      ))}
    </div>
  )
}

export default Confetti