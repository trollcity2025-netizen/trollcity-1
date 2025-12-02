import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { X } from 'lucide-react'

interface KickReentryModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function KickReentryModal({ isOpen, onClose, onSuccess }: KickReentryModalProps) {
  const { user, profile } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [kickCount, setKickCount] = useState(0)
  const [isBanned, setIsBanned] = useState(false)

  useEffect(() => {
    if (isOpen && profile) {
      setKickCount(profile.kick_count || 0)
      setIsBanned(profile.is_banned || false)
    }
  }, [isOpen, profile])

  const handlePayReentry = async () => {
    if (!user || !profile) return

    if (profile.paid_coin_balance < 250) {
      toast.error('You need 250 paid coins to re-enter')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('pay_kick_reentry_fee', {
        p_user_id: user.id
      })

      if (error) throw error

      if (data?.success) {
        toast.success('Re-entry fee paid! You can now access the app.')
        onSuccess()
        onClose()
      } else {
        toast.error(data?.error || 'Failed to pay re-entry fee')
      }
    } catch (error: any) {
      console.error('Error paying re-entry fee:', error)
      toast.error(error?.message || 'Failed to pay re-entry fee')
    } finally {
      setLoading(false)
    }
  }

  const handlePayBanRestoration = async () => {
    if (!user || !profile) return

    if (profile.paid_coin_balance < 2000) {
      toast.error('You need 2000 paid coins ($20) to restore your account')
      return
    }

    // No confirmation - proceed directly

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('pay_ban_restoration_fee', {
        p_user_id: user.id
      })

      if (error) throw error

      if (data?.success) {
        toast.success('Account restored! Fresh start!')
        onSuccess()
        onClose()
      } else {
        toast.error(data?.error || 'Failed to restore account')
      }
    } catch (error: any) {
      console.error('Error restoring account:', error)
      toast.error(error?.message || 'Failed to restore account')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center p-6 z-50">
      <div className="bg-[#08010A] p-6 rounded-xl border border-purple-600 w-full max-w-md shadow-[0_0_40px_rgba(130,0,200,0.6)]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-purple-400">Account Status</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {isBanned ? (
          <div className="space-y-4">
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
              <p className="text-red-400 font-semibold mb-2">⚠️ Account Banned</p>
              <p className="text-sm text-gray-300">
                You have been kicked 3 times. Your account is now banned.
              </p>
              <p className="text-sm text-gray-300 mt-2">
                Pay <strong className="text-yellow-400">$20 (2000 paid coins)</strong> to restore your account.
                Your account will be reset to level 0 with 0 coins.
              </p>
              <div className="mt-3 p-3 bg-blue-900/20 border border-blue-500/50 rounded-lg">
                <p className="text-xs text-blue-300">
                  💡 <strong>Important:</strong> Being honest about why you were banned will help you get back on the app. 
                  Honesty and understanding the reason for your ban can lead to account restoration.
                </p>
              </div>
            </div>
            <button
              onClick={handlePayBanRestoration}
              disabled={loading || (profile?.paid_coin_balance || 0) < 2000}
              className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Pay $20 to Restore Account'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4">
              <p className="text-yellow-400 font-semibold mb-2">⚠️ You've Been Kicked</p>
              <p className="text-sm text-gray-300">
                Kick count: <strong>{kickCount}/3</strong>
              </p>
              <p className="text-sm text-gray-300 mt-2">
                Pay <strong className="text-yellow-400">250 paid coins</strong> to re-enter the app.
                After 3 kicks, you'll be permanently banned.
              </p>
              <div className="mt-3 p-3 bg-blue-900/20 border border-blue-500/50 rounded-lg">
                <p className="text-xs text-blue-300">
                  💡 <strong>Important:</strong> Being honest about why you were kicked will help you get back on the app. 
                  If you believe this was a mistake, please contact support.
                </p>
              </div>
            </div>
            <button
              onClick={handlePayReentry}
              disabled={loading || (profile?.paid_coin_balance || 0) < 250}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Pay 250 Coins to Re-enter'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

