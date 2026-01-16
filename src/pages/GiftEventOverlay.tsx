import React, { useEffect, useState } from 'react'
import GiftSoundPlayer from './GiftSoundPlayer'
import ClickableUsername from '../components/ClickableUsername'

export default function GiftEventOverlay({ gift, onProfileClick }: { gift: any, onProfileClick?: (profile: any) => void }) {
  const [visible, setVisible] = useState(false)
  const megaGift = gift?.coinCost >= 1000
  const tier = gift?.tier || 'basic'
  const combo = gift?.comboCount || 0

  useEffect(() => {
    if (!gift) return
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(timer)
  }, [gift])

  if (!gift || !visible) return null

  return (
    <>
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-[100]">
        
        {/* Tier Background Effects */}
        {tier === 'millionaire' && (
           <div className="absolute inset-0 bg-black/40 animate-pulse z-0 flex items-center justify-center">
               <div className="absolute inset-0 animate-moneyRain opacity-50 text-6xl">💸 💵 💴 💶 💷</div>
               <div className="text-9xl animate-vaultOpen relative z-10">🏦</div>
               <div className="absolute inset-0 animate-fireworks z-20"></div>
           </div>
        )}
        
        {tier === 'legendary' && (
           <div className="absolute inset-0 bg-yellow-500/10 z-0">
               <div className="absolute inset-0 animate-spinSlow opacity-30 bg-[radial-gradient(circle,rgba(255,215,0,0.5)_0%,transparent_70%)]" />
               <div className="absolute top-1/4 left-1/2 -translate-x-1/2 text-8xl animate-bounce">🏆</div>
           </div>
        )}
        
        {tier === 'epic' && (
           <div className="absolute inset-0 z-0">
               <div className="absolute inset-0 animate-pulse-neon bg-purple-900/20" />
               <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-8xl animate-ping">⚡</div>
           </div>
        )}

        {/* Combo Streak */}
        {combo > 1 && (
            <div className="absolute top-32 right-10 z-50 animate-bounceIn">
                <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white font-black italic text-6xl px-6 py-2 rounded-xl border-4 border-yellow-400 shadow-[0_0_20px_rgba(255,0,0,0.8)] transform -rotate-12">
                    {combo}x COMBO!
                </div>
                <div className="text-center text-yellow-300 font-bold text-xl mt-1 drop-shadow-md">
                    {gift.sender_username} is on fire! 🔥
                </div>
            </div>
        )}

        {/* CAR Animation */}
        {gift.id === 'car' && (
          <div className="absolute bottom-10 left-[-200px] animate-driveCar text-6xl">
            🚗
          </div>
        )}

        {/* Troll Respect (Thumb) */}
        {gift.id === 'troll_respect' && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-giftPulse text-8xl">
            👍
          </div>
        )}

        {/* Neon Heart */}
        {gift.id === 'neon_heart' && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse-neon text-8xl">
            💜
          </div>
        )}

        {/* Candy Pop */}
        {gift.id === 'candy_troll_pop' && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-floatGift text-7xl">
            🍭
          </div>
        )}

        {/* Lightbulb Idea */}
        {gift.id === 'lightbulb_idea' && (
          <div className="absolute top-[20%] right-[20%] animate-giftGlow text-8xl">
            💡
          </div>
        )}

        {/* Mic Support */}
        {gift.id === 'mic_support' && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 animate-giftWave text-8xl">
            🎤
          </div>
        )}

        {/* Mini Troll */}
        {gift.id === 'mini_troll' && (
          <div className="absolute inset-0 flex items-center justify-center animate-spinIn text-9xl">
            🧌
          </div>
        )}

        {/* Roast Wind */}
        {gift.id === 'roast_wind' && (
          <div className="absolute top-1/2 animate-driveCar text-8xl">
            💨
          </div>
        )}

        {/* Laugh Riot */}
        {gift.id === 'laugh_riot' && (
          <div className="absolute inset-0 flex items-center justify-center animate-giftBurst text-8xl">
            😂 😂 😂
          </div>
        )}

        {/* Diamond Troll (Reuse Diamond Rain) */}
        {(gift.id === 'diamond_troll' || gift.id === 'diamond') && (
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

        {/* Royal Crown Drop (Reuse Crown Flash) */}
        {(gift.id === 'royal_crown_drop' || gift.id === 'crown') && (
          <div className="absolute animate-crownFlash text-9xl top-20 left-1/2 -translate-x-1/2">
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
                          px-6 py-3 rounded-xl text-lg animate-pulse text-white shadow-xl z-50">
            🎉 <ClickableUsername username={gift.sender_username} className="text-white font-bold" onClick={() => onProfileClick?.({ name: gift.sender_username, username: gift.sender_username })} /> sent {gift.name}! 🎉
          </div>
        )}
      </div>

      {/* Play sound only for single-item sends */}
      {(gift.quantity === undefined || Number(gift.quantity) === 1) && (
        <GiftSoundPlayer giftId={String(gift.id)} />
      )}
    </>
  )
}
