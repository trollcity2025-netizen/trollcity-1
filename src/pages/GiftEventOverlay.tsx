import React, { useEffect, useState } from 'react'
import GiftSoundPlayer from './GiftSoundPlayer'
import WheelModal from './WheelModal'
import ClickableUsername from '../components/ClickableUsername'

export default function GiftEventOverlay({ gift }: any) {
  const [visible, setVisible] = useState(false)
  const megaGift = gift?.coinCost >= 1000

  useEffect(() => {
    if (!gift) return
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), 5000)
    return () => clearTimeout(timer)
  }, [gift])

  if (!gift || !visible) return null

  return (
    <>
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-[100]">

        {/* CAR Animation */}
        {gift.id === 'car' && (
          <div className="absolute bottom-10 left-[-200px] animate-driveCar text-6xl">
            🚗
          </div>
        )}

        {/* Diamond Rain */}
        {gift.id === 'diamond' && (
          <div className="absolute inset-0 animate-diamondRain text-5xl">
            💎💎💎💎💎
          </div>
        )}

        {/* Cat Scratch */}
        {gift.id === 'savscratch' && (
          <div className="absolute inset-0 animate-catScratch text-7xl">
            😼💥 SCRATCH!
          </div>
        )}

        {/* Crown VIP Flash */}
        {gift.id === 'crown' && (
          <div className="absolute animate-crownFlash text-8xl top-20 left-1/2 -translate-x-1/2">
            👑
          </div>
        )}

        {/* Toolbox Spin */}
        {gift.id === 'toolbox' && (
          <div className="absolute animate-toolboxSpin text-8xl top-[20%] left-[30%]">
            🧰
          </div>
        )}

        {/* Wine Glow */}
        {gift.id === 'wine' && (
          <div className="absolute animate-wineGlow text-8xl top-[15%] left-[55%]">
            🍷✨
          </div>
        )}

        {/* Mega Gift Pop-up (> 1000 coins) */}
        {megaGift && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-purple-700/80 
                          px-6 py-3 rounded-xl text-lg animate-pulse text-white shadow-xl">
            🎉 <ClickableUsername username={gift.sender_username} className="text-white font-bold" /> sent {gift.name}! 🎉
          </div>
        )}
      </div>

      <GiftSoundPlayer giftId={gift.id} />
      {gift.id === 'trollwheel' && <WheelModal />}
    </>
  )
}
