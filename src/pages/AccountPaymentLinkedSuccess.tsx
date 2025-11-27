import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../lib/store'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
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
        if (p === 'card') {
          const res = await fetch('/api/square/save-card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, cardToken: token, saveAsDefault: true })
          })
          const saved = await res.json().catch(() => null)
          if (!res.ok) throw new Error(saved?.error || 'Failed to save card')

        // 🔹 Save wallet providers (CashApp, ApplePay, GooglePay, Venmo)
        } else {
          const res = await fetch('/api/square/wallet-bind', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, provider: p, tokenId: token })
          })
          const bound = await res.json().catch(() => null)
          if (!res.ok) throw new Error(bound?.error || 'Failed to link wallet')
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
          await recordAppEvent(user.id, 'PAYMENT_METHOD_LINKED', { provider: p })
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
