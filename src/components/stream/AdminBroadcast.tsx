import { motion, AnimatePresence } from 'framer-motion'
import { Crown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { translateMessage } from '../../lib/translation'

interface AdminBroadcastProps {
  message: string
  userLanguage?: string
  onComplete?: () => void
}

export default function AdminBroadcast({ message, userLanguage = 'en', onComplete }: AdminBroadcastProps) {
  const [translatedMessage, setTranslatedMessage] = useState(message)

  useEffect(() => {
    // Translate message if user has a different language preference
    if (userLanguage && userLanguage !== 'en') {
      translateMessage(message, userLanguage)
        .then(translated => {
          if (translated && translated !== message) {
            setTranslatedMessage(translated)
          }
        })
        .catch(err => {
          console.error('Translation error:', err)
          setTranslatedMessage(message) // Fallback to original
        })
    } else {
      setTranslatedMessage(message)
    }
  }, [message, userLanguage])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -30, scale: 0.95 }}
        className="admin-broadcast-popup"
      >
        <div className="flex items-center gap-3 mb-2">
          <Crown className="w-6 h-6 text-yellow-400" />
          <span className="text-lg font-bold">ADMIN ANNOUNCEMENT</span>
        </div>
        <div className="text-base font-semibold">{translatedMessage}</div>
      </motion.div>
    </AnimatePresence>
  )
}

