import React from 'react'
import { useGiftSystem } from '../lib/hooks/useGiftSystem'
import { toast } from 'sonner'

interface GiftActionPanelProps {
  streamerId: string
  streamId: string
}

const ALL_GIFTS = [
  { id: 'blunt', name: '🚬 Blunt', cost: 1 },
  { id: 'lighter', name: '🔥 Lighter', cost: 5 },
  { id: 'cigs', name: '🚬 Pack of Cigs', cost: 15 },
  { id: 'wine', name: '🍷 Wine Bottle', cost: 30 },
  { id: 'trollhat', name: '🧢 Troll Hat', cost: 40 },
  { id: 'trollavatar', name: '👤 Troll Character', cost: 50 },
  { id: 'toolbox', name: '🧰 Toolbox (Admin Gift)', cost: 75 },
  { id: 'vivedball', name: '🏀 Vived Basketball', cost: 100 },
  { id: 'savscratch', name: '😼 Sav Cat Scratch', cost: 200 },
  { id: 'car', name: '🚗 Car Gift', cost: 100 },
  { id: 'crown', name: '👑 Troll Crown', cost: 500 },
  { id: 'diamond', name: '💎 Diamond Shower', cost: 1000 },
  { id: 'insurance', name: '🛡 Troller Insurance', cost: 750 },
]

export default function GiftActionPanel({ streamerId, streamId }: GiftActionPanelProps) {
  const { sendGift, isSending } = useGiftSystem(streamerId, streamId)

  const handleSend = async (gift: any) => {
    const success = await sendGift({
      id: gift.id,
      name: gift.name,
      icon: gift.name.split(' ')[0],
      coinCost: gift.cost,
      type: 'paid',
    })

    if (success) {
      toast.success(`🎁 You sent ${gift.name}`)
    }
  }

  return (
    <div className="bg-gray-900/70 p-2 flex gap-2 overflow-x-auto rounded-md border border-gray-700 shadow-lg">
      {ALL_GIFTS.map((gift) => (
        <button
          key={gift.id}
          disabled={isSending}
          onClick={() => handleSend(gift)}
          className="min-w-[80px] bg-purple-700 hover:bg-purple-600 p-2 rounded-lg 
                     flex flex-col items-center text-xs transition"
        >
          <span className="text-xl">{gift.name.split(' ')[0]}</span>
          <span>{gift.cost} 💰</span>
        </button>
      ))}
    </div>
  )
}
