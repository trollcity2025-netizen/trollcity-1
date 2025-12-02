import { motion, AnimatePresence } from 'framer-motion'

interface TrollerEntranceProps {
  username: string
  trollerLevel?: number
  onComplete: () => void
}

const trollerTitles: Record<number, string> = {
  1: 'Troller',
  2: 'Chaos Agent',
  3: 'Supreme Troll',
}

export default function TrollerEntrance({ username, trollerLevel = 1, onComplete }: TrollerEntranceProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -40, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1.15 }}
        exit={{ opacity: 0, y: -60, scale: 0.95 }}
        transition={{ 
          duration: 0.5,
          type: 'spring',
          stiffness: 200,
          damping: 15
        }}
        className="troller-entrance"
        onAnimationComplete={() => {
          setTimeout(onComplete, 2500)
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">👹</span>
          <div>
            <div className="text-lg font-bold text-white">
              {username} has entered to cause CHAOS!
            </div>
            <div className="text-xs text-red-300 mt-1">
              {trollerTitles[trollerLevel] || 'Troller'} • Mischief Mode Activated
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
