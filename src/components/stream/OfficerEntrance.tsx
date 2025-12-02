import { motion, AnimatePresence } from 'framer-motion'

interface OfficerEntranceProps {
  username: string
  officerLevel?: string
  onComplete: () => void
}

export default function OfficerEntrance({ username, officerLevel = 'Officer', onComplete }: OfficerEntranceProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -80 }}
        transition={{ duration: 0.5 }}
        className="officer-entrance"
        onAnimationComplete={() => {
          setTimeout(onComplete, 3500)
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">🛡️</span>
          <div>
            <div className="text-lg font-bold text-white">
              Troll {officerLevel} {username} has joined the stream!
            </div>
            <div className="text-xs text-purple-300 mt-1">Moderation powers activated</div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

