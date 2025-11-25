import React from 'react'
import { X } from 'lucide-react'
import { useGiftSystem } from '../lib/hooks/useGiftSystem'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'

interface GiftModalProps {
  isOpen: boolean
  onClose: () => void
  streamerId: string
  streamId: string
}

const GIFT_ITEMS = [
  { id: 'blunt', name: '🚬 Blunt', coinCost: 1, type: 'paid' },
  { id: 'lighter', name: '🔥 Lighter', coinCost: 5, type: 'paid' },
  { id: 'cigs', name: '🚬 Pack of Cigs', coinCost: 15, type: 'paid' },
  { id: 'wine', name: '🍷 Wine Bottle', coinCost: 30, type: 'paid' },
  { id: 'trollhat', name: '🧢 Troll Hat', coinCost: 40, type: 'paid' },
  { id: 'trollavatar', name: '👤 Troll Character', coinCost: 50, type: 'paid' },
  { id: 'toolbox', name: '🧰 Toolbox (Admin Gift)', coinCost: 75, type: 'paid', boostsStore: true },
  { id: 'vivedball', name: '🏀 Vived Basketball', coinCost: 100, type: 'paid', earnsPaidCoins: 5 },
  { id: 'savscratch', name: '😼 Sav Cat Scratch', coinCost: 200, type: 'paid', earnsPaidCoins: 5 },
  { id: 'car', name: '🚗 Car Gift', coinCost: 100, type: 'paid' },
  { id: 'crown', name: '👑 Troll Crown', coinCost: 500, type: 'paid', unlocksBadge: 'VIP' },
  { id: 'diamond', name: '💎 Diamond Shower', coinCost: 1000, type: 'paid', triggersAnimation: true },
  { id: 'trollwheel', name: '🎡 Troll Wheel Spin', coinCost: 5000, type: 'paid', triggersWheel: true },
  { id: 'insurance', name: '🛡 Troller Insurance Pack', coinCost: 750, type: 'paid' },
]

export default function SendGiftModal({ isOpen, onClose, streamerId, streamId }: GiftModalProps) {
  const { profile } = useAuthStore()
  const { sendGift, isSending } = useGiftSystem(streamerId, streamId)

  if (!isOpen) return null

  const handleGiftSend = async (gift: any) => {
    const success = await sendGift(gift)
    if (success) {
      toast.success(`🎁 You sent ${gift.name}`)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 p-6 w-96 rounded-xl shadow-lg text-white relative">
        <button onClick={onClose} className="absolute top-3 right-3">
          <X size={20} />
        </button>

        <h2 className="text-center text-lg font-bold mb-4">Send a Gift 🎁</h2>

        <div className="text-sm mb-3 flex justify-between bg-gray-800 p-2 rounded-lg">
          <span>Paid Coins: {profile?.paid_coin_balance}</span>
          <span>Free Coins: {profile?.free_coin_balance}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
          {GIFT_ITEMS.map((gift) => (
            <button
              key={gift.id}
              disabled={isSending}
              onClick={() => handleGiftSend(gift)}
              className="bg-purple-700 p-3 rounded-lg text-sm flex flex-col items-center hover:bg-purple-600 transition"
            >
              <span className="text-2xl">{gift.name.split(' ')[0]}</span>
              <span>{gift.name}</span>
              <span className="text-xs text-gray-300 mt-1">
                {gift.coinCost} coins
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-4 bg-gray-700 w-full py-2 rounded-lg hover:bg-gray-600 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
