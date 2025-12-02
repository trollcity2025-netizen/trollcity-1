import React from 'react'
import { useAuthStore } from '../lib/store'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import api from '../lib/api'
import { recordAppEvent } from '../lib/progressionEngine'
import { toast } from 'sonner'

const AccountPaymentsSuccess = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, setProfile } = useAuthStore()

  const [saving, setSaving] = React.useState(false)
  const [provider, setProvider] = React.useState('')
  const [status, setStatus] = React.useState<'idle' | 'saved' | 'error'>('idle')

  React.useEffect(() => {
    const params = new URLSearchParams(location.search)
    const p = params.get('provider') || ''
    const tokenId = params.get('token_id') || ''
    setProvider(p)

    if (!p || !tokenId) {
      toast.error('Missing provider or token')
      return
    }
    if (!user) {
      toast.error('Please sign in')
      navigate('/auth')
      return
    }

    const run = async () => {
      try {
        setSaving(true)

        const saved = await api.post('/payments', { userId: user.id, nonce: tokenId })
        if (!saved.success) throw new Error(saved?.error || 'Failed to save card')

        // 2) Mark user as fully payment-enabled
        

        if (profile) setProfile(profile)

        try { localStorage.setItem(`tc-valid-pay-${user.id}`, 'true') } catch {}

        // 3) Analytics / tracking
        try {
          await supabase.rpc('record_dna_event', {
            p_user_id: user.id,
            p_event_type: 'PAYMENT_METHOD_LINKED',
            p_event_data: { provider: p }
          })
        } catch {}

        setStatus('saved')
        toast.success('Payment Method Connected and Ready for Purchases')
      } catch (err: any) {
        console.error(err)
        setStatus('error')
        toast.error(err?.message || 'Error saving payment method')
      } finally {
        setSaving(false)
      }
    }

    run()
  }, [location.search, navigate, user, profile, setProfile])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
      <div className="bg-[#1A1A1A] rounded-lg p-8 border border-[#2C2C2C] w-full max-w-md text-center shadow-xl">
        <h1 className="text-2xl font-bold mb-4">Payment Method Connected 🎉</h1>
        <p className="text-[#E2E2E2]/80 mb-6">
          Your {provider === 'cashapp' ? 'Cash App' : provider === 'applepay' ? 'Apple Pay' : provider === 'googlepay' ? 'Google Pay' : provider === 'venmo' ? 'Venmo' : 'Card'} has been securely linked.
          <br />
          You can now purchase coins instantly.
        </p>
        <button
          onClick={() => navigate('/profile')}
          className="w-full py-2 bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white font-semibold rounded"
          disabled={saving}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

export default AccountPaymentsSuccess
