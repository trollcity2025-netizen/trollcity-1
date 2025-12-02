import { motion } from 'framer-motion'
import { Participant } from 'livekit-client'
import VideoBox from './VideoBox'
import { X, UserPlus } from 'lucide-react'

interface GuestSlotProps {
  participant?: Participant
  index: number
  onRemove?: () => void
  onInvite?: () => void
  isHost?: boolean
}

export default function GuestSlot({ participant, index, onRemove, onInvite, isHost }: GuestSlotProps) {
  if (!participant && !onInvite) {
    return null
  }

  return (
    <motion.div
      className="relative w-full h-[180px] rounded-xl overflow-hidden border-2 border-purple-500/50 shadow-[0_0_20px_rgba(177,48,255,0.4)] bg-black/30 backdrop-blur-sm"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      whileHover={{ borderColor: 'rgba(177,48,255,0.8)', boxShadow: '0 0 30px rgba(177,48,255,0.6)' }}
    >
      {participant ? (
        <>
          <VideoBox
            participant={participant}
            size="medium"
            label={index === 0 ? '🎥 Host' : `👤 Guest ${index}`}
            isHost={index === 0 && isHost}
          />
          {onRemove && (
            <motion.button
              onClick={onRemove}
              className="absolute top-2 right-2 p-1.5 bg-red-600/80 hover:bg-red-600 rounded-full backdrop-blur-md z-10"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-4 h-4 text-white" />
            </motion.button>
          )}
        </>
      ) : (
        <motion.button
          onClick={onInvite}
          className="w-full h-full flex flex-col items-center justify-center gap-2 text-purple-300 hover:text-purple-200 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="p-3 bg-purple-600/20 rounded-full border border-purple-500/50">
            <UserPlus className="w-6 h-6" />
          </div>
          <span className="text-sm font-medium">Invite Guest</span>
        </motion.button>
      )}

      {/* Neon glow effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 pointer-events-none" />
    </motion.div>
  )
}

