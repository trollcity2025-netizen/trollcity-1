import React, { useEffect, useState } from 'react'
import { Crown, Sparkles, Star } from 'lucide-react'

interface RoyalCoronationAnimationProps {
  isVisible: boolean
  titleType: 'wife' | 'husband'
  username: string
  onComplete: () => void
}

export default function RoyalCoronationAnimation({
  isVisible,
  titleType,
  username,
  onComplete
}: RoyalCoronationAnimationProps) {
  const [stage, setStage] = useState(0)
  const [showParticles, setShowParticles] = useState(false)

  useEffect(() => {
    if (!isVisible) return

    // Animation sequence
    const sequence = [
      () => setStage(1), // Crown appears
      () => setStage(2), // Title appears
      () => setShowParticles(true), // Particles start
      () => setStage(3), // Celebration
    ]

    let currentStep = 0
    const timer = setInterval(() => {
      if (currentStep < sequence.length) {
        sequence[currentStep]()
        currentStep++
      } else {
        // Animation complete
        setTimeout(() => {
          onComplete()
          setStage(0)
          setShowParticles(false)
        }, 2000)
      }
    }, 800) // Each stage lasts 800ms

    return () => clearInterval(timer)
  }, [isVisible, onComplete])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative text-center">
        {/* Crown Animation */}
        {stage >= 1 && (
          <div className={`transition-all duration-1000 ${stage >= 2 ? 'scale-110' : 'scale-50'}`}>
            <Crown className="w-24 h-24 text-yellow-400 mx-auto mb-4 drop-shadow-2xl animate-bounce" />
          </div>
        )}

        {/* Title Text */}
        {stage >= 2 && (
          <div className="transition-all duration-1000 opacity-0 animate-fade-in">
            <h2 className="text-4xl font-bold text-yellow-300 mb-2 drop-shadow-lg">
              👑 Coronation! 👑
            </h2>
            <p className="text-2xl text-white font-semibold mb-1">
              @{username}
            </p>
            <p className="text-xl text-yellow-200">
              is now Admin's {titleType === 'wife' ? 'Wife' : 'Husband'}!
            </p>
          </div>
        )}

        {/* Particle Effects */}
        {showParticles && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Crown particles */}
            {[...Array(12)].map((_, i) => (
              <div
                key={`crown-${i}`}
                className="absolute w-3 h-3 text-yellow-400 animate-ping"
                style={{
                  top: '20%',
                  left: '50%',
                  transform: `rotate(${i * 30}deg) translateY(-60px)`,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: '2s'
                }}
              >
                <Crown className="w-3 h-3" />
              </div>
            ))}

            {/* Sparkle particles */}
            {[...Array(20)].map((_, i) => (
              <div
                key={`sparkle-${i}`}
                className="absolute animate-bounce"
                style={{
                  top: `${30 + Math.random() * 40}%`,
                  left: `${20 + Math.random() * 60}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1 + Math.random()}s`
                }}
              >
                <Sparkles
                  className={`w-4 h-4 ${
                    i % 3 === 0 ? 'text-yellow-400' :
                    i % 3 === 1 ? 'text-pink-400' :
                    'text-purple-400'
                  }`}
                />
              </div>
            ))}

            {/* Star burst */}
            {stage >= 3 && [...Array(8)].map((_, i) => (
              <div
                key={`star-${i}`}
                className="absolute animate-pulse"
                style={{
                  top: `${40 + Math.sin(i * 45 * Math.PI / 180) * 30}%`,
                  left: `${50 + Math.cos(i * 45 * Math.PI / 180) * 30}%`,
                  animationDelay: `${i * 0.2}s`
                }}
              >
                <Star className="w-6 h-6 text-yellow-300 fill-yellow-300" />
              </div>
            ))}
          </div>
        )}

        {/* Celebration Text */}
        {stage >= 3 && (
          <div className="mt-8 text-yellow-300 font-bold text-lg animate-pulse">
            🎉 Long Live the Royal Family! 🎉
          </div>
        )}
      </div>
    </div>
  )
}