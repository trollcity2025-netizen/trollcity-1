import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../lib/store'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import api from '../lib/api'
import { recordAppEvent } from '../lib/progressionEngine'
import { toast } from 'sonner'

const AccountPaymentLinkedSuccess = () => {
  const { user, profile, setProfile } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [provider, setProvider] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const p = params.get('provider') || ''
    const token = params.get('token_id') || ''
    setProvider(p)

    if (!user) {
      navigate('/auth')
      return
    }
    if (!p || !token) {
      toast.error('Missing provider or token')
      return
    }

    const run = async () => {
      try {
        // 🔹 Save regular card
        const { data: sessionData } = await supabase.auth.getSession()
        const authToken = sessionData?.session?.access_token || ''
        if (p === 'card') {
          const saved = await api.post('/payments', { userId: user.id, nonce: token })
          if (!saved.success) throw new Error(saved?.error || 'Failed to save card')

        // 🔹 Save wallet providers (CashApp, ApplePay, GooglePay, Venmo)
        } else {
          const bound = await api.post('/square/wallet-bind', { userId: user.id, provider: p, tokenId: token })
          if (!bound.success) throw new Error(bound?.error || 'Failed to link wallet')
        }

        // 🔄 Fetch updated payment methods from Supabase
        const { data: methods } = await supabase
          .from('payment_methods')
          .select('*')
          .eq('user_id', user.id)

        if (profile) {
          setProfile({ ...profile, payment_methods: methods || [] })
        }

        // 🔐 Mark as valid in localStorage
        try {
          localStorage.setItem(`tc-valid-pay-${user.id}`, 'true')
        } catch {}

        // 🎯 Identity & analytics tracking
        try {
          await supabase.rpc('record_dna_event', {
            p_user_id: user.id,
            p_event_type: 'PAYMENT_METHOD_LINKED',
            p_event_data: { provider: p }
          })
        } catch {}

        toast.success('Payment method linked and activated!')
      } catch (err) {
        console.error('Payment save error:', err)
        toast.error('Failed to link payment method')
      }
    }

    run()
  }, [location.search, navigate, user, profile, setProfile])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
      <div className="bg-[#1A1A1A] rounded-lg p-8 border border-[#2C2C2C] w-full max-w-md text-center shadow-xl">
        <h1 className="text-2xl font-bold mb-2">Payment Method Linked</h1>
        <p className="text-[#E2E2E2]/80 mb-6">
          {provider
            ? `Linked: ${
                provider === 'cashapp'
                  ? 'Cash App'
                  : provider === 'applepay'
                  ? 'Apple Pay'
                  : provider === 'googlepay'
                  ? 'Google Pay'
                  : provider === 'venmo'
                  ? 'Venmo'
                  : 'Card'
              }`
            : ''}
          <br /> Activated for Purchases
        </p>
        <button
          onClick={() => navigate('/profile')}
          className="w-full py-2 bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white font-semibold rounded"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

export default AccountPaymentLinkedSuccess
