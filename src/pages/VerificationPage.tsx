import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { CheckCircle, Coins, CreditCard, Shield } from 'lucide-react'

export default function VerificationPage() {
  const { user, profile, refreshProfile } = useAuthStore()
  const navigate = useNavigate()
  const [processing, setProcessing] = useState<'paypal' | 'coins' | null>(null)

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

  const payWithPayPal = async () => {
    if (processing) return

    setProcessing('paypal')
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token

      if (!token) {
        toast.error('Not authenticated')
        return
      }

      const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
        'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'

      const response = await fetch(`${edgeFunctionsUrl}/verify-user-paypal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create payment')
      }

      const data = await response.json()

      if (!data.approvalUrl) {
        throw new Error('Missing approval URL')
      }

      // Store order ID for completion
      sessionStorage.setItem('verification_order_id', data.orderId)

      // Redirect to PayPal
      window.location.href = data.approvalUrl
    } catch (error: any) {
      console.error('Error starting PayPal payment:', error)
      toast.error(error?.message || 'Failed to start payment')
    } finally {
      setProcessing(null)
    }
  }

  const payWithCoins = async () => {
    if (processing) return

    const paidCoins = profile?.paid_coin_balance || 0
    if (paidCoins < 500) {
      toast.error('You need 500 paid coins to verify. You have ' + paidCoins)
      return
    }

    setProcessing('coins')
    try {
      // Check if deduct_paid_coins RPC exists, otherwise use direct update
      const { error: deductError } = await supabase.rpc('deduct_paid_coins', {
        p_user_id: user.id,
        p_amount: 500
      })

      if (deductError) {
        // Fallback: direct update
        const { data: currentProfile } = await supabase
          .from('user_profiles')
          .select('paid_coin_balance')
          .eq('id', user.id)
          .single()

        if ((currentProfile?.paid_coin_balance || 0) < 500) {
          throw new Error('Insufficient paid coins')
        }

        await supabase
          .from('user_profiles')
          .update({
            paid_coin_balance: (currentProfile?.paid_coin_balance || 0) - 500
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

  const paidCoins = profile?.paid_coin_balance || 0
  const canPayWithCoins = paidCoins >= 500

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
          <button
            onClick={payWithPayPal}
            disabled={processing !== null}
            className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <CreditCard className="w-5 h-5" />
            {processing === 'paypal' ? 'Processing...' : 'Pay $5 via PayPal'}
          </button>

          <div className="relative">
            <button
              onClick={payWithCoins}
              disabled={processing !== null || !canPayWithCoins}
              className="w-full px-6 py-4 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Coins className="w-5 h-5" />
              {processing === 'coins' 
                ? 'Processing...' 
                : `Pay 500 Paid Coins ${canPayWithCoins ? `(You have ${paidCoins})` : `(Need ${500 - paidCoins} more)`}`
              }
            </button>
            {!canPayWithCoins && (
              <p className="text-xs text-red-400 mt-2 text-center">
                Insufficient paid coins. You need 500, but only have {paidCoins}.
              </p>
            )}
          </div>
        </div>

        <p className="text-xs opacity-60 mt-6 text-center">
          Verification is a one-time payment. Badge remains active unless account is permanently banned.
        </p>
      </div>
    </div>
  )
}

