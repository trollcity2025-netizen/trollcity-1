import React, { useState } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { FileText, Send } from 'lucide-react'

export default function Support() {
  const { user, profile } = useAuthStore()
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('general')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!user || !profile) { toast.error('Sign in required'); return }
    if (!subject.trim() || !message.trim()) { toast.error('Enter subject and message'); return }
    setLoading(true)
    try {
      const payload = {
        user_id: profile.id,
        username: profile.username,
        email: user.email,
        subject: subject.trim(),
        category,
        message: message.trim(),
        status: 'open',
        created_at: new Date().toISOString()
      }
      let ok = false
      const { error } = await supabase.from('support_tickets').insert([payload])
      if (!error) ok = true
      if (!ok) {
        await supabase.from('notifications').insert([
          { type: 'support_ticket', content: `${profile.username}: ${subject}`, metadata: payload, created_at: new Date().toISOString() }
        ])
      }
      toast.success('Support ticket submitted')
      setSubject(''); setMessage(''); setCategory('general')
    } catch {
      toast.error('Failed to submit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#05030B] text-white p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-2 flex items-center gap-2">
          <FileText className="text-troll-gold w-7 h-7" />
          Support Ticket
        </h1>
        <p className="text-sm text-gray-300 mb-4">Having issues with the app or payouts? Send a message to Admin.</p>

        <div className="bg-[#0E0A1A] rounded-xl border border-purple-700/40 p-6 space-y-4">
          <div>
            <label className="block text-sm mb-1">Subject</label>
            <input value={subject} onChange={e=>setSubject(e.target.value)} className="w-full bg-[#171427] border border-purple-500/40 rounded px-3 py-2 text-sm" placeholder="Issue summary" />
          </div>
          <div>
            <label className="block text-sm mb-1">Category</label>
            <select value={category} onChange={e=>setCategory(e.target.value)} className="w-full bg-[#171427] border border-purple-500/40 rounded px-3 py-2 text-sm">
              <option value="general">General</option>
              <option value="payouts">Payouts</option>
              <option value="payments">Payments</option>
              <option value="streams">Streams</option>
              <option value="account">Account</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Message</label>
            <textarea value={message} onChange={e=>setMessage(e.target.value)} rows={6} className="w-full bg-[#171427] border border-purple-500/40 rounded px-3 py-2 text-sm" placeholder="Describe the issue, steps to reproduce, screenshots/links (optional)" />
          </div>
          <button onClick={submit} disabled={loading} className="w-full mt-2 bg-gradient-to-r from-purple-600 to-indigo-500 text-white font-semibold py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60">
            {loading ? 'Submitting…' : (<><Send className="w-4 h-4" /> Submit Ticket</>)}
          </button>
        </div>
      </div>
    </div>
  )
}
