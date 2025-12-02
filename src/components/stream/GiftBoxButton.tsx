import { Gift } from 'lucide-react'
import { getActiveHolidayTheme, getGiftBoxIcon } from '../../lib/holidayThemes'
import { useState, useEffect } from 'react'

interface GiftBoxButtonProps {
  onClick: () => void
}

export default function GiftBoxButton({ onClick }: GiftBoxButtonProps) {
  const [activeHoliday, setActiveHoliday] = useState(getActiveHolidayTheme())
  const [giftBoxIcon, setGiftBoxIcon] = useState(getGiftBoxIcon())

  // Update holiday theme every minute (in case date changes)
  useEffect(() => {
    const updateTheme = () => {
      setActiveHoliday(getActiveHolidayTheme())
      setGiftBoxIcon(getGiftBoxIcon())
    }

    updateTheme()
    const interval = setInterval(updateTheme, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [])

  return (
    <button
      onClick={onClick}
      className="w-full p-4 bg-gradient-to-br from-purple-600/80 to-pink-600/80 hover:from-purple-600 hover:to-pink-600 rounded-xl border-2 border-purple-400/50 hover:border-purple-300 transition-all shadow-[0_0_20px_rgba(255,0,255,0.4)] hover:shadow-[0_0_30px_rgba(255,0,255,0.6)] flex items-center justify-center gap-2 text-white font-semibold relative"
    >
      {activeHoliday ? (
        <>
          <span className="text-2xl">{activeHoliday.icon}</span>
          <span>Open {activeHoliday.name} Gift Box</span>
        </>
      ) : (
        <>
          <Gift size={20} />
          <span>Open Gift Box 🎁</span>
        </>
      )}
    </button>
  )
}

