import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

type UserRole = 'viewer' | 'troller' | 'officer' | 'vip' | 'donor'

interface EntranceEffectProps {
  username: string
  role: UserRole
  onComplete?: () => void
  isFullScreen?: boolean
  profile?: any // User profile for badges
}

const roleConfigs: Record<UserRole, { color: string; emoji: string; glowColor: string }> = {
  viewer: { color: '#00eaff', emoji: '👋', glowColor: 'rgba(0, 234, 255, 0.5)' },
  troller: { color: '#b700ff', emoji: '🧌', glowColor: 'rgba(183, 0, 255, 0.5)' },
  officer: { color: '#ffd700', emoji: '👮‍♂️', glowColor: 'rgba(255, 215, 0, 0.5)' },
  vip: { color: '#ff0077', emoji: '💎', glowColor: 'rgba(255, 0, 119, 0.5)' },
  donor: { color: '#ff0077', emoji: '💰', glowColor: 'rgba(255, 0, 119, 0.5)' },
}

// Full-screen entrance effect (for VIP/Officer)
export function FullScreenEntrance({ username, role, onComplete, profile: userProfile }: EntranceEffectProps) {
  const [visible, setVisible] = useState(true)
  const config = roleConfigs[role]

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onComplete?.(), 500)
    }, 3000)

    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Dim overlay for Officer/VIP */}
          {(role === 'officer' || role === 'vip' || role === 'donor') && (
            <motion.div
              className="fixed inset-0 bg-black/60 z-40 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}

          {/* Spotlight sweep for Officer */}
          {role === 'officer' && (
            <motion.div
              className="fixed inset-0 z-41 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent" />
            </motion.div>
          )}

          {/* Main entrance popup */}
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-gradient-to-br from-purple-900/95 to-pink-900/95 backdrop-blur-xl rounded-3xl p-8 border-2 shadow-[0_0_60px_rgba(255,0,255,0.8)]"
              style={{ borderColor: config.color }}
              initial={{ scale: 0, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0, y: -50 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <div className="text-center">
                <motion.div
                  className="text-7xl mb-4"
                  style={{ color: config.color }}
                  animate={{
                    scale: [1, 1.3, 1],
                    rotate: role === 'troller' ? [0, 15, -15, 0] : [0, 10, -10, 0],
                  }}
                  transition={{ duration: 0.6, repeat: role === 'officer' ? Infinity : 0 }}
                >
                  {config.emoji}
                </motion.div>

                <motion.h3
                  className="text-3xl font-bold mb-2 flex items-center justify-center gap-2"
                  style={{ color: config.color }}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  {username}
                  {userProfile && <UserBadge profile={userProfile} />}
                </motion.h3>

                <motion.p
                  className="text-xl text-white"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {role === 'officer' && '👮‍♂️ Officer has arrived!'}
                  {role === 'vip' && '💎 VIP has entered!'}
                  {role === 'donor' && '💰 Donor has joined!'}
                  {role === 'troller' && '🧌 Troller has arrived!'}
                  {role === 'viewer' && 'has entered the stream! 🎉'}
                </motion.p>

                {/* Coin rain for VIP/Donor */}
                {(role === 'vip' || role === 'donor') && (
                  <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute text-2xl"
                        style={{
                          left: `${Math.random() * 100}%`,
                          top: '-10%',
                        }}
                        animate={{
                          y: ['100vh', '-10%'],
                          rotate: [0, 360],
                          opacity: [1, 0],
                        }}
                        transition={{
                          delay: Math.random() * 0.5,
                          duration: 2,
                          ease: 'easeIn',
                        }}
                      >
                        💰
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Compact entrance banner (for chat panel)
export default function EntranceBanner({ username, role, onComplete, profile }: EntranceEffectProps) {
  const [visible, setVisible] = useState(true)
  const config = roleConfigs[role]

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onComplete?.(), 500)
    }, 5000)

    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="entrance-banner"
          style={{
            borderColor: config.color,
            boxShadow: `0 0 16px ${config.glowColor}`,
          }}
          initial={{ opacity: 0, y: 30, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <motion.span
            className="inline-block mr-2"
            animate={
              role === 'troller'
                ? {
                    rotate: [0, 15, -15, 0],
                    scale: [1, 1.2, 1],
                  }
                : {
                    scale: [1, 1.1, 1],
                  }
            }
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            {config.emoji}
          </motion.span>
          <span style={{ color: config.color }} className="font-semibold">
            {username}
            {userProfile && <UserBadge profile={userProfile} />}
          </span>{' '}
          has entered the stream!
        </motion.div>
      )}
    </AnimatePresence>
  )
}
