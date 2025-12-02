import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X } from 'lucide-react'
import ClickableUsername from './ClickableUsername'

interface Gifter {
  gifter_id: string
  gifter_username: string
  gifter_avatar_url: string | null
  total_gifts_sent: number
  total_coins_sent: number
  last_gift_at: string
}

interface GiftersModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  type: 'received' | 'sent' // received = gifters, sent = recipients
}

export default function GiftersModal({ isOpen, onClose, userId, type }: GiftersModalProps) {
  const [gifters, setGifters] = useState<Gifter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen && userId) {
      loadGifters()
    }
  }, [isOpen, userId, type])

  const loadGifters = async () => {
    try {
      setLoading(true)
      const functionName = type === 'received' ? 'get_user_gifters' : 'get_user_gift_recipients'
      const { data, error } = await supabase.rpc(functionName, {
        p_user_id: userId
      })

      if (error) throw error
      setGifters(data || [])
    } catch (error: any) {
      console.error('Error loading gifters:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center p-6 z-50">
      <div className="bg-[#08010A] p-6 rounded-xl border border-purple-600 w-full max-w-2xl max-h-[80vh] shadow-[0_0_40px_rgba(130,0,200,0.6)]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-purple-400">
            {type === 'received' ? 'Gifters' : 'Gift Recipients'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading...</div>
        ) : gifters.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No {type === 'received' ? 'gifters' : 'recipients'} yet
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {gifters.map((gifter) => (
              <div
                key={gifter.gifter_id}
                className="bg-black/50 border border-purple-600/30 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 flex-1">
                  <img
                    src={gifter.gifter_avatar_url || '/default-avatar.png'}
                    alt={gifter.gifter_username}
                    className="w-12 h-12 rounded-full border border-purple-500"
                  />
                  <div className="flex-1">
                    <ClickableUsername
                      username={gifter.gifter_username}
                      userId={gifter.gifter_id}
                      className="text-white font-semibold hover:text-purple-400"
                    />
                    <div className="text-xs text-gray-400">
                      {gifter.total_gifts_sent} {gifter.total_gifts_sent === 1 ? 'gift' : 'gifts'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-purple-400 font-bold">
                    {gifter.total_coins_sent.toLocaleString()} coins
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(gifter.last_gift_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

