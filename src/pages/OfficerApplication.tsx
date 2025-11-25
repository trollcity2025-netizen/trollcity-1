import React, { useState } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

export default function OfficerApplication() {
  const { profile } = useAuthStore()
  const [reason, setReason] = useState('')
  const [experience, setExperience] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!profile) return toast.error('Please sign in')
    if (!reason.trim() || !experience.trim()) return toast.error('Complete all fields')
    try {
      setLoading(true)
      await supabase.from('applications').insert([{ user_id: profile.id, type: 'officer', reason, experience, created_at: new Date().toISOString() }])
      toast.success('Application submitted')
      setReason('')
      setExperience('')
    } catch {
      toast.error('Failed to submit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-6">Troll Officer Application</h1>
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2C2C2C] mb-4">
          <p className="text-[#E2E2E2]/80">Requirements: enforce Troll City laws, ban, kick, or mute users who disobey rules; maintain stream order and report incidents.</p>
        </div>
        <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C] space-y-4">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why do you want to be an officer?" className="w-full px-4 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg" />
          <textarea value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="Moderation experience" rows={4} className="w-full px-4 py-2 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg" />
          <button onClick={submit} disabled={loading} className="px-6 py-3 bg-gradient-to-r from-[#FFC93C] to-[#FFD700] text-black rounded-lg font-semibold hover:shadow-lg hover:shadow-[#FFC93C]/30">Submit</button>
        </div>
      </div>
    </div>
  )
}