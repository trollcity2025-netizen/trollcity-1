import React, { useEffect, useState } from 'react'

const icons = ['💎', '💜', '😈', '👑', '🔥']
const megaIcons = ['💎', '👑', '🔥', '😈', '💜', '⭐', '🌟', '✨', '🎉', '🎊']
const diamondIcons = ['💎', '💎', '💎', '💎', '💎', '💜', '👑']

interface GiftParticlesProps {
  trigger: { timestamp: number; amount: number } | null
}

export default function GiftParticles({ trigger }: GiftParticlesProps) {
  const [particles, setParticles] = useState<Array<{ id: number; icon: string; left: number; delay: number; animationClass: string }>>([])

  useEffect(() => {
    if (!trigger) return

    const { amount } = trigger
    let particleCount = 12
    let iconSet = icons
    let animationDuration = 3000
    let animationClass = 'animate-particle'

    // Tiered animations based on amount
    if (amount >= 5000) {
      // Mega Explosion - Rainbow troll blast
      particleCount = 30
      iconSet = megaIcons
      animationDuration = 4000
      animationClass = 'animate-mega-explosion'
    } else if (amount >= 1000) {
      // Diamond Rain
      particleCount = 20
      iconSet = diamondIcons
      animationDuration = 3500
      animationClass = 'animate-diamond-rain'
    } else {
      // Emoji Sparkle (default)
      particleCount = 12
      iconSet = icons
      animationDuration = 3000
      animationClass = 'animate-particle'
    }

    const blast = [...Array(particleCount)].map((_, i) => ({
      id: Date.now() + i,
      icon: iconSet[Math.floor(Math.random() * iconSet.length)],
      left: Math.random() * 80 + 10,
      delay: Math.random() * 0.3, // Stagger animation
      animationClass,
    }))

    setParticles(blast)

    setTimeout(() => setParticles([]), animationDuration)
  }, [trigger])

  return (
    <>
      {particles.map((p) => (
        <div
          key={p.id}
          className={`absolute text-3xl ${p.animationClass} pointer-events-none z-20`}
          style={{
            left: `${p.left}%`,
            bottom: '10%',
            animationDelay: `${p.delay}s`,
          }}
        >
          {p.icon}
        </div>
      ))}
    </>
  )
}

