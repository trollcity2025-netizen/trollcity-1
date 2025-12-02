import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { useAuthStore } from '../../lib/store'

interface TrollWalkingProps {
  streamId?: string
  userId?: string
  onCaught?: (coins: number) => void
}

export default function TrollWalking({ streamId, userId, onCaught }: TrollWalkingProps) {
  const { profile, setProfile } = useAuthStore()
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState(-100)
  const [canClick, setCanClick] = useState(true)
  const [coins, setCoins] = useState(0)

  useEffect(() => {
    // Random spawn: 1-3 minutes
    const spawnDelay = Math.random() * 120000 + 60000 // 60-180 seconds
    const timer = setTimeout(() => {
      setVisible(true)
      setPosition(-100) // Start from left
      setCanClick(true)
      setCoins(Math.floor(Math.random() * 41) + 10) // 10-50 coins

      // Auto-hide after 10 seconds
      const hideTimer = setTimeout(() => {
        setVisible(false)
      }, 10000)

      return () => clearTimeout(hideTimer)
    }, spawnDelay)

    return () => clearTimeout(timer)
  }, [visible]) // Re-trigger when troll disappears

  const handleClick = async () => {
    if (!canClick || !userId || !streamId) return

    setCanClick(false)
    setVisible(false)

    try {
      // Award coins via RPC
      const { error } = await supabase.rpc('add_free_coins', {
        p_user_id: userId,
        p_amount: coins,
      })

      if (error) throw error

      // Instantly update local profile balance
      if (profile) {
        const newBalance = (profile.free_coin_balance || 0) + coins
        setProfile({
          ...profile,
          free_coin_balance: newBalance,
        })
      }

      // Send chat notification
      await supabase.from('messages').insert({
        stream_id: streamId,
        user_id: userId,
        content: `🎉 Caught the Troll and earned ${coins} coins!`,
        message_type: 'system',
      })

      toast.success(`You caught the Troll! +${coins} coins`)
      onCaught?.(coins)
    } catch (error) {
      console.error('Error catching troll:', error)
      toast.error('Failed to catch the Troll')
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed bottom-24 z-40 cursor-pointer"
          style={{ left: `${position}px` }}
          initial={{ x: -100, opacity: 0 }}
          animate={{
            x: [0, window.innerWidth + 100],
            opacity: [0, 1, 1, 0],
          }}
          exit={{ opacity: 0 }}
          transition={{
            x: {
              duration: 6,
              ease: 'linear',
            },
            opacity: {
              times: [0, 0.1, 0.9, 1],
              duration: 6,
            },
          }}
          onClick={handleClick}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <div className="relative">
            {/* Troll Image/Emoji */}
            <motion.div
              className="text-6xl drop-shadow-[0_0_20px_#00ff66]"
              animate={{
                y: [0, -10, 0],
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              🧌
            </motion.div>

            {/* Glow effect */}
            <div className="absolute inset-0 bg-green-400/30 blur-2xl rounded-full animate-pulse" />

            {/* Coin indicator */}
            <motion.div
              className="absolute -top-8 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              +{coins} 💰
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

