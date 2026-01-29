import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { CheckCircle, Coins, Shield } from 'lucide-react'

export default function VerificationPage() {
  const { user, profile, refreshProfile } = useAuthStore()
  const navigate = useNavigate()
  const [processing, setProcessing] = useState<'coins' | null>(null)

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4">Please log in to get verified</p>
          <button
            onClick={() => navigate('/auth')}
            className="px-4 py-2 bg-purple-600 rounded-lg"
          >
            Log In
          </button>
        </div>
      </div>
    )
  }

  if (profile?.is_verified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="max-w-lg mx-auto bg-[#1A1A1A] border-2 border-green-500/30 rounded-xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">You're Verified!</h1>
          <p className="opacity-80 mb-6">
            Your account is verified. Enjoy your verified badge!
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  const payWithCoins = async () => {
    if (processing) return

    const troll_coins = profile?.troll_coins || 0
    if (troll_coins < 500) {
      toast.error('You need 500 troll_coins to verify. You have ' + troll_coins)
      return
    }

    setProcessing('coins')
    try {
      // Check if deduct_troll_coins RPC exists, otherwise use direct update
      const { error: deductError } = await supabase.rpc('rpc_deduct_troll_coins', {
        p_user_id: user.id,
        p_amount: 500
      })

      if (deductError) {
        // Fallback: direct update
        const { data: currentProfile } = await supabase
          .from('user_profiles')
          .select('troll_coins')
          .eq('id', user.id)
          .single()

        if ((currentProfile?.troll_coins || 0) < 500) {
          throw new Error('Insufficient troll_coins')
        }

        await supabase
          .from('user_profiles')
          .update({
            troll_coins: (currentProfile?.troll_coins || 0) - 500
          })
          .eq('id', user.id)
      }

      // Verify user
      const { error: verifyError } = await supabase.rpc('verify_user', {
        p_user_id: user.id,
        p_payment_method: 'coins',
        p_amount: 500,
        p_payment_reference: null
      })

      if (verifyError) {
        throw verifyError
      }

      toast.success('Verification successful!')
      if (refreshProfile) await refreshProfile()
      
      // Log transaction
      await supabase.from('coin_transactions').insert({
        user_id: user.id,
        coins: -500,
        type: 'verification_purchase',
        description: 'Account verification',
        source: 'coins'
      })
    } catch (error: any) {
      console.error('Error verifying with coins:', error)
      toast.error(error?.message || 'Failed to verify')
    } finally {
      setProcessing(null)
    }
  }

  const troll_coins = profile?.troll_coins || 0
  const canPayWithCoins = troll_coins >= 500
  const handleSkip = () => {
    navigate('/tcps')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-lg mx-auto bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-8">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-8 h-8 text-purple-400" />
          <h1 className="text-3xl font-bold">Get Verified</h1>
        </div>

        <p className="opacity-80 mb-6">
          Stand out with a verified badge. Build trust. Boost visibility. Get recognized as a trusted member of Troll City.
        </p>

        {/* Benefits */}
        <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2">Benefits:</h3>
          <ul className="text-sm space-y-1 opacity-80">
            <li>✓ Verified badge on your profile and in chat</li>
            <li>✓ Increased trust and credibility</li>
            <li>✓ Priority support</li>
            <li>✓ Exclusive verified-only features</li>
          </ul>
        </div>

        {/* Payment Options */}
        <div className="space-y-4">
          <div className="relative">
            <button
              onClick={payWithCoins}
              disabled={processing !== null || !canPayWithCoins}
              className="w-full px-6 py-4 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Coins className="w-5 h-5" />
              {processing === 'coins' 
                ? 'Processing...' 
                : `Pay 500 troll_coins ${canPayWithCoins ? `(You have ${troll_coins})` : `(Need ${500 - troll_coins} more)`}`
              }
            </button>
            {!canPayWithCoins && (
              <p className="text-xs text-red-400 mt-2 text-center">
                Insufficient troll_coins. You need 500, but only have {troll_coins}.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 items-center">
          <p className="text-xs text-gray-400 text-center">
            Not ready to verify yet? You can still access TCPS and grab it later from the store.
          </p>
          <button
            onClick={handleSkip}
            className="px-6 py-3 bg-white text-black rounded-lg font-semibold hover:bg-gray-200 transition-colors"
          >
            Not right now — Take me to TCPS
          </button>
        </div>

        <p className="text-xs opacity-60 mt-6 text-center">
          Verification is a one-time payment. Badge remains active unless account is permanently banned.
        </p>
      </div>
    </div>
  )
}

