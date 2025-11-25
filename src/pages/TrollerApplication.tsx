import React, { useState } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

export default function TrollerApplication() {
  const { profile } = useAuthStore()
  const [bio, setBio] = useState('')
  const [goals, setGoals] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!profile) return toast.error('Please sign in')
    if (!bio.trim() || !goals.trim()) return toast.error('Complete all fields')
    try {
      setLoading(true)
      const now = new Date().toISOString()
      await supabase.from('applications').insert([{ user_id: profile.id, type: 'troller', bio, goals, status: 'approved', created_at: now, updated_at: now }])
      try {
        await supabase.from('user_profiles').update({ role: 'troller', troll_badge: true, updated_at: now }).eq('id', profile.id)
      } catch (e) {
        console.warn('Failed to update user role', e)
      }
      try {
        await supabase.from('notifications').insert([{ user_id: profile.id, type: 'message', content: 'Your Troller application was auto-approved. Badge granted.', created_at: now }])
      } catch (e) {
        console.warn('Failed to insert notification', e)
      }
      toast.success('Approved! Troll badge granted')
      // update local store
      useAuthStore.getState().setProfile({ ...profile, role: 'troller' } as any)
      setBio('')
      setGoals('')
    } catch {
      toast.error('Failed to submit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-6">Troller Application</h1>
        <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C] space-y-4">
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself" rows={4} className="w-full px-4 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg" />
          <textarea value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="Goals as a Troller" rows={4} className="w-full px-4 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg" />
          <button onClick={submit} disabled={loading} className="px-6 py-3 bg-gradient-to-r from-[#FFC93C] to-[#FFD700] text-black rounded-lg font-semibold hover:shadow-lg hover:shadow-[#FFC93C]/30">Submit</button>
        </div>
      </div>
    </div>
  )
}
