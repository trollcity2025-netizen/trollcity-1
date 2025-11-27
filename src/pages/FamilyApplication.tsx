import React, { useState } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

export default function FamilyApplication() {
  const { profile } = useAuthStore()
  const [reason, setReason] = useState('')
  const [commitment, setCommitment] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!profile) return toast.error('Please sign in')
    if (!reason.trim() || !commitment.trim()) return toast.error('Complete all fields')
    const requiredCoins = 1000
    if ((profile.paid_coin_balance || 0) < requiredCoins) {
      toast.error('Requires 1,000 paid coins to apply. Redirecting to Store...')
      window.location.href = '/store?tab=packages'
      return
    }
    try {
      setLoading(true)
      const now = new Date().toISOString()
      
      const { error: coinErr } = await supabase
        .from('user_profiles')
        .update({ paid_coin_balance: profile.paid_coin_balance - requiredCoins, updated_at: now })
        .eq('id', profile.id)
      
      if (coinErr) throw coinErr
      
      const { error } = await supabase.from('applications').insert([{ 
        user_id: profile.id, 
        type: 'family', 
        reason, 
        goals: commitment, 
        status: 'pending'
      }])
      
      if (error) {
        console.error('[Family App] Submission error:', error)
        toast.error(error.message || 'Failed to submit application')
        throw error
      }
      toast.success('Application submitted! An admin will review it soon.')
      useAuthStore.getState().setProfile({ ...profile, paid_coin_balance: profile.paid_coin_balance - requiredCoins } as any)
      setReason('')
      setCommitment('')
    } catch {
      toast.error('Failed to submit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-6">Troll Family Application</h1>
        <p className="text-[#E2E2E2]/80 mb-4">Requirement: 1,000 paid coins to apply (deducted on submission).</p>
        <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C] space-y-4">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why join Troll Family?" className="w-full px-4 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg" />
          <textarea value={commitment} onChange={(e) => setCommitment(e.target.value)} placeholder="Weekly commitment" rows={4} className="w-full px-4 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg" />
          <button onClick={submit} disabled={loading} className="px-6 py-3 bg-gradient-to-r from-[#FFC93C] to-[#FFD700] text-black rounded-lg font-semibold hover:shadow-lg hover:shadow-[#FFC93C]/30">Submit</button>
        </div>
      </div>
    </div>
  )
}