import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

interface ReactionBubbleProps {
  type: string
  id: string
  onComplete?: () => void
}

const reactionEmojis: Record<string, string> = {
  heart: '❤️',
  troll: '🧌',
  boo: '👎',
  default: '❤️',
}

export default function ReactionBubble({ type, id, onComplete }: ReactionBubbleProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onComplete?.(), 500) // Wait for exit animation
    }, 3000)

    return () => clearTimeout(timer)
  }, [onComplete])

  const emoji = reactionEmojis[type] || reactionEmojis.default
  const randomX = Math.random() * 80 + 10 // 10-90% of screen width

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={id}
          className="fixed bottom-20 z-30 pointer-events-none"
          style={{ left: `${randomX}%` }}
          initial={{ y: 0, opacity: 0, scale: 0 }}
          animate={{
            y: -window.innerHeight * 0.6,
            opacity: [0, 1, 1, 0],
            scale: [0, 1.2, 1, 0.8],
          }}
          exit={{ opacity: 0, scale: 0 }}
          transition={{
            duration: 3,
            ease: 'easeOut',
            opacity: {
              times: [0, 0.1, 0.8, 1],
            },
          }}
        >
          <motion.div
            className="text-5xl drop-shadow-[0_0_15px_rgba(255,0,255,0.8)]"
            animate={{
              rotate: [0, 15, -15, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 0.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {emoji}
          </motion.div>

          {/* Glow trail */}
          <motion.div
            className="absolute inset-0 bg-purple-400/20 blur-xl rounded-full"
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

