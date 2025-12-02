import { motion, AnimatePresence } from 'framer-motion'

interface AdminEntranceProps {
  username: string
  onComplete: () => void
}

export default function AdminEntrance({ username, onComplete }: AdminEntranceProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -30, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1.05 }}
        exit={{ opacity: 0, y: -40, scale: 0.97 }}
        transition={{ duration: 0.5 }}
        className="admin-entrance"
        onAnimationComplete={() => {
          setTimeout(onComplete, 3000)
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">👑</span>
          <div>
            <div className="text-lg font-bold text-gold">
              Admin {username} has joined Troll City Live
            </div>
            <div className="text-xs text-yellow-300 mt-1">Full control activated</div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

