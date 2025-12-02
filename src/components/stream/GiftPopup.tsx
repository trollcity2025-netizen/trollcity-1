import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Gift, Sparkles } from 'lucide-react'

interface GiftPopupProps {
  sender: string
  coins: number
  giftType?: string
  onComplete?: () => void
}

const giftEmojis: Record<string, string> = {
  coin: '💎',
  gift: '🎁',
  crown: '👑',
  fire: '🔥',
  heart: '❤️',
  default: '🎁',
}

export default function GiftPopup({ sender, coins, giftType = 'gift', onComplete }: GiftPopupProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([])
  const [show, setShow] = useState(true)

  useEffect(() => {
    // Create explosion particles
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100 - 50,
      y: Math.random() * 100 - 50,
      delay: Math.random() * 0.5,
    }))
    setParticles(newParticles)

    // Auto-hide after animation
    const timer = setTimeout(() => {
      setShow(false)
      onComplete?.()
    }, 4000)

    return () => clearTimeout(timer)
  }, [onComplete])

  const emoji = giftEmojis[giftType] || giftEmojis.default

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Main Gift Popup */}
          <motion.div
            className="relative bg-gradient-to-br from-purple-900/95 to-pink-900/95 backdrop-blur-xl rounded-3xl p-8 border-2 border-purple-400/50 shadow-[0_0_60px_rgba(255,0,255,0.8)]"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-400/20 to-pink-400/20 animate-pulse" />

            {/* Content */}
            <div className="relative z-10 text-center">
              <motion.div
                className="text-7xl mb-4"
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0],
                }}
                transition={{ duration: 0.5, repeat: 2 }}
              >
                {emoji}
              </motion.div>

              <motion.h3
                className="text-2xl font-bold text-white mb-2"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {sender}
              </motion.h3>

              <motion.div
                className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring' }}
              >
                {coins.toLocaleString()} 💎
              </motion.div>
            </div>

            {/* Explosion Particles */}
            {particles.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute text-3xl"
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: particle.x * 2,
                  y: particle.y * 2,
                  opacity: 0,
                  scale: 0,
                }}
                transition={{
                  delay: particle.delay,
                  duration: 1.5,
                  ease: 'easeOut',
                }}
              >
                {emoji}
              </motion.div>
            ))}

            {/* Sparkles */}
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                  rotate: 360,
                }}
                transition={{
                  delay: Math.random() * 0.5,
                  duration: 1.5,
                  repeat: Infinity,
                  repeatDelay: 2,
                }}
              >
                <Sparkles className="w-4 h-4 text-yellow-400" />
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

