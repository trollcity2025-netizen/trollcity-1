import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

interface GiftBonusPopupProps {
  bonus: {
    bonus_amount: number
    total_gifts: number
    message: string
  }
  trigger: boolean
  onComplete?: () => void
}

export default function GiftBonusPopup({ bonus, trigger, onComplete }: GiftBonusPopupProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (trigger && bonus) {
      setShow(true)
      const timer = setTimeout(() => {
        setShow(false)
        onComplete?.()
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [trigger, bonus, onComplete])

  if (!show || !bonus) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -40, scale: 0.9 }}
        className="popup-bonus fixed top-[30%] left-1/2 -translate-x-1/2 z-[90] text-white text-center"
      >
        <motion.div
          initial={{ scale: 0.5, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="text-6xl mb-3"
        >
          🎉
        </motion.div>
        
        <div className="px-6 py-4 rounded-xl bg-black/90 backdrop-blur-md border-2 border-yellow-400 shadow-[0_0_20px_rgba(255,215,0,0.6)]">
          <h3 className="text-xl font-bold text-yellow-300 mb-2">
            Gift Streak Bonus Unlocked!
          </h3>
          <p className="text-lg mb-2">{bonus.message}</p>
          <p className="text-2xl font-bold text-yellow-400">
            +{bonus.bonus_amount.toLocaleString()} Free Coins
          </p>
          <p className="text-sm text-gray-300 mt-2">
            Total Gifts Sent: {bonus.total_gifts}
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

