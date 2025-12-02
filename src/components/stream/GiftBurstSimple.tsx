import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface GiftBurstSimpleProps {
  giftName: string
  show: boolean
}

export default function GiftBurstSimple({ giftName, show }: GiftBurstSimpleProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1.2, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute top-1/3 left-1/2 transform -translate-x-1/2 text-4xl z-[100] pointer-events-none"
        >
          🎁 {giftName}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

