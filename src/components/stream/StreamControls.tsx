import { motion } from 'framer-motion'
import { Camera, CameraOff, Mic, MicOff, Users, Power, Gift, Sword } from 'lucide-react'

interface StreamControlsProps {
  isCameraEnabled: boolean
  isMicrophoneEnabled: boolean
  onToggleCamera: () => void
  onToggleMicrophone: () => void
  onInviteGuest: () => void
  onEndStream: () => void
  onGiftClick?: () => void
  onStartBattle?: () => void
  isHost: boolean
}

export default function StreamControls({
  isCameraEnabled,
  isMicrophoneEnabled,
  onToggleCamera,
  onToggleMicrophone,
  onInviteGuest,
  onEndStream,
  onGiftClick,
  onStartBattle,
  isHost,
}: StreamControlsProps) {
  return (
    <motion.div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/80 rounded-full px-6 py-3 border-2 border-purple-500/50 shadow-[0_0_30px_rgba(177,48,255,0.4)] z-30"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      {/* Camera Toggle */}
      <motion.button
        onClick={onToggleCamera}
        className={`p-3 rounded-full transition-all ${
          isCameraEnabled
            ? 'bg-green-500/20 text-green-400 border border-green-500/50'
            : 'bg-red-500/20 text-red-400 border border-red-500/50'
        }`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
      >
        {isCameraEnabled ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
      </motion.button>

      {/* Microphone Toggle */}
      <motion.button
        onClick={onToggleMicrophone}
        className={`p-3 rounded-full transition-all ${
          isMicrophoneEnabled
            ? 'bg-green-500/20 text-green-400 border border-green-500/50'
            : 'bg-red-500/20 text-red-400 border border-red-500/50'
        }`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        title={isMicrophoneEnabled ? 'Turn off microphone' : 'Turn on microphone'}
      >
        {isMicrophoneEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </motion.button>

      {/* Start Battle */}
      {isHost && onStartBattle && (
        <motion.button
          onClick={onStartBattle}
          className="p-3 rounded-full bg-gradient-to-r from-yellow-600/30 to-orange-600/30 text-yellow-300 border border-yellow-500/50 hover:from-yellow-600/40 hover:to-orange-600/40 transition-all"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="Start Troll Battle"
        >
          <Sword className="w-5 h-5" />
        </motion.button>
      )}

      {/* Invite Guest */}
      {isHost && (
        <motion.button
          onClick={onInviteGuest}
          className="p-3 rounded-full bg-purple-600/20 text-purple-300 border border-purple-500/50 hover:bg-purple-600/30 transition-all"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="Invite Guest"
        >
          <Users className="w-5 h-5" />
        </motion.button>
      )}

      {/* Gift Button */}
      {onGiftClick && (
        <motion.button
          onClick={onGiftClick}
          className="p-3 rounded-full bg-pink-600/20 text-pink-300 border border-pink-500/50 hover:bg-pink-600/30 transition-all"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="Send Gift"
        >
          <Gift className="w-5 h-5" />
        </motion.button>
      )}

      {/* End Stream */}
      {isHost && (
        <motion.button
          onClick={onEndStream}
          className="px-4 py-2 rounded-full bg-red-600 text-white border border-red-400 shadow-lg flex items-center gap-2 font-semibold"
          whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(239,68,68,0.6)' }}
          whileTap={{ scale: 0.95 }}
          title="End Stream"
        >
          <Power className="w-4 h-4" />
          <span>End Live</span>
        </motion.button>
      )}

      {/* Glow effect */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10 pointer-events-none" />
    </motion.div>
  )
}

