import { motion } from 'framer-motion'
import { Gift } from 'lucide-react'

interface GiftButtonProps {
  onClick: () => void
  disabled?: boolean
}

export default function GiftButton({ onClick, disabled }: GiftButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className="relative p-4 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full shadow-[0_0_30px_rgba(255,0,255,0.6)] border-2 border-purple-400/50 hover:border-purple-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      animate={{
        boxShadow: [
          '0 0 30px rgba(255,0,255,0.6)',
          '0 0 50px rgba(255,0,255,0.8)',
          '0 0 30px rgba(255,0,255,0.6)',
        ],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <Gift className="w-6 h-6 text-white" />
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-400/20 to-pink-400/20 animate-pulse" />
    </motion.button>
  )
}

