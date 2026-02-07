import { useState, useEffect } from 'react'
import { X, Gift } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface GiftModalProps {
  postId: string
  onClose: () => void
  onGiftSent: (giftType: string, cost: number) => void
}

interface GiftItem {
  id: string
  name: string
  icon: string
  value: number
  category: string
  slug?: string
}

export default function GiftModal({ postId: _postId, onClose, onGiftSent }: GiftModalProps) {
  const [gifts, setGifts] = useState<GiftItem[]>([])
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const fetchGifts = async () => {
      try {
        const { data, error } = await supabase
          .from('gift_items')
          .select('*')
          .order('value', { ascending: true })

        if (error) throw error

        if (data && data.length > 0) {
          setGifts(data.map(item => ({
            id: item.id,
            name: item.name,
            icon: item.icon,
            value: item.value,
            category: item.category || 'Common',
            slug: item.gift_slug || item.name || item.id,
          })))
        } else {
          // Fallback gifts
          setGifts([
            { id: 'rose', name: 'Rose', icon: '🌹', value: 10, category: 'Basic', slug: 'rose' },
            { id: 'heart', name: 'Heart', icon: '💖', value: 25, category: 'Basic', slug: 'heart' },
            { id: 'star', name: 'Star', icon: '⭐', value: 50, category: 'Basic', slug: 'star' },
            { id: 'crown', name: 'Crown', icon: '👑', value: 100, category: 'Premium', slug: 'crown' },
            { id: 'diamond', name: 'Diamond', icon: '💎', value: 200, category: 'Premium', slug: 'diamond' },
            { id: 'trophy', name: 'Trophy', icon: '🏆', value: 500, category: 'Epic', slug: 'trophy' },
            { id: 'coffee', name: 'Coffee', icon: '☕', value: 15, category: 'Basic', slug: 'coffee' },
            { id: 'pizza', name: 'Pizza', icon: '🍕', value: 30, category: 'Basic', slug: 'pizza' },
            { id: 'rocket', name: 'Rocket', icon: '🚀', value: 1000, category: 'Epic', slug: 'rocket' },
            { id: 'dragon', name: 'Dragon', icon: '🐉', value: 5000, category: 'Legendary', slug: 'dragon' },
          ])
        }
      } catch (err) {
        console.error('Error fetching gifts:', err)
        // Fallback gifts
        setGifts([
          { id: 'rose', name: 'Rose', icon: '🌹', value: 10, category: 'Basic', slug: 'rose' },
          { id: 'heart', name: 'Heart', icon: '💖', value: 25, category: 'Basic', slug: 'heart' },
          { id: 'star', name: 'Star', icon: '⭐', value: 50, category: 'Basic', slug: 'star' },
          { id: 'crown', name: 'Crown', icon: '👑', value: 100, category: 'Premium', slug: 'crown' },
          { id: 'diamond', name: 'Diamond', icon: '💎', value: 200, category: 'Premium', slug: 'diamond' },
        ])
      }
    }

    fetchGifts()
  }, [])

  const handleSendGift = async () => {
    if (!selectedGift) return

    setSending(true)
    try {
      const giftType = selectedGift.slug || selectedGift.id
      await onGiftSent(giftType, selectedGift.value)
      onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 bg-[#0B091F] rounded-xl w-full max-w-lg border border-purple-500/30 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Send a Gift</h3>
              <p className="text-sm text-gray-400">Show some love to the post!</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Gift Grid */}
        <div className="grid grid-cols-5 gap-3 overflow-y-auto px-6 py-2 custom-scrollbar flex-1 min-h-0">
          {gifts.map((gift) => (
            <button
              key={gift.id}
              onClick={() => setSelectedGift(gift)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                selectedGift?.id === gift.id
                  ? 'bg-purple-600/30 border-2 border-purple-500'
                  : 'bg-white/5 hover:bg-white/10 border-2 border-transparent'
              }`}
            >
              <span className="text-3xl transform hover:scale-110 transition-transform">{gift.icon}</span>
              <div className="flex flex-col items-center">
                <span className="text-xs font-medium text-white/80 truncate w-full text-center">{gift.name}</span>
                <span className="text-xs text-yellow-500 font-bold">{gift.value}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Selected Gift Info & Send Button */}
        {selectedGift && (
          <div className="p-6 pt-4 border-t border-white/10 flex-shrink-0 bg-[#0B091F] rounded-b-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{selectedGift.icon}</span>
                <div>
                  <p className="font-bold text-white">{selectedGift.name}</p>
                  <p className="text-sm text-yellow-500 font-bold">{selectedGift.value} coins</p>
                </div>
              </div>
              <button
                onClick={handleSendGift}
                disabled={sending}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-bold text-white disabled:opacity-50 transition-all transform hover:scale-105"
              >
                {sending ? 'Sending...' : 'Send Gift'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
