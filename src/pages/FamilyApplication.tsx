import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { useBackgroundProfileRefresh } from '../hooks/useBackgroundProfileRefresh'
import { useCoins } from '../lib/hooks/useCoins'
import { toast } from 'sonner'

export default function FamilyApplication() {
  const { profile } = useAuthStore()
  const { troll_coins: coinsBalance, refreshCoins } = useCoins()
  const navigate = useNavigate()
  const { refreshProfileInBackground } = useBackgroundProfileRefresh()
  const [reason, setReason] = useState('')
  const [commitment, setCommitment] = useState('')
  const [loading, setLoading] = useState(false)

  // Get troll coins from useCoins hook
  const userCoins = typeof coinsBalance === 'number' ? coinsBalance : (profile?.troll_coins || 0)

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!profile) return toast.error('Please sign in')
    if (!reason.trim() || !commitment.trim()) return toast.error('Complete all fields')
    const requiredCoins = 1000
    if (userCoins < requiredCoins) {
      toast.error('Requires 1,000 troll_coins to apply. Redirecting to Store...')
      navigate('/store?tab=packages')
      return
    }
    try {
      setLoading(true)
      
      // 1. Deduct coins securely using standard spend_coins RPC
      const { data: spendResult, error: spendError } = await supabase.rpc('spend_coins', {
        p_sender_id: profile.id,
        p_receiver_id: null,
        p_coin_amount: requiredCoins,
        p_source: 'application',
        p_item: 'family_application',
        p_idempotency_key: null
      });

      if (spendError) throw spendError;
      
      if (spendResult && spendResult.success === false) {
          throw new Error(spendResult.error || 'Insufficient funds');
      }
      
      const { error } = await supabase.from('applications').insert([{
        user_id: profile.id,
        type: 'troll_family',
        reason: reason,
        goals: commitment,
        data: {
          username: profile.username
        },
        status: 'pending'
      }])
      
      if (error) {
        console.error('[Family App] Submission error:', error)
        toast.error(error.message || 'Failed to submit application')
        throw error
      }
      toast.success('Application submitted! An admin will review it soon.')
      useAuthStore.getState().setProfile({ ...profile, troll_coins: userCoins - requiredCoins } as any)
      refreshProfileInBackground()
      refreshCoins()
      // Redirect to family home after successful submission
      navigate('/family/home')
    } catch {
      toast.error('Failed to submit')
    } finally {
      setLoading(false)
      setReason('')
      setCommitment('')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-6">Troll Family Application</h1>
        <p className="text-[#E2E2E2]/80 mb-4">Requirement: 1,000 troll_coins to apply (deducted on submission).</p>
        <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C] space-y-4">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why join Troll Family?" className="w-full px-4 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg" />
          <textarea value={commitment} onChange={(e) => setCommitment(e.target.value)} placeholder="Weekly commitment" rows={4} className="w-full px-4 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg" />
          <button type="button" onClick={submit} disabled={loading} className="px-6 py-3 bg-gradient-to-r from-[#FFC93C] to-[#FFD700] text-black rounded-lg font-semibold hover:shadow-lg hover:shadow-[#FFC93C]/30">Submit</button>
        </div>
      </div>
    </div>
  )
}
