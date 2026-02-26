import React, { useState, useEffect } from 'react'
import { X, Gavel, Users, AlertCircle, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

interface SummonModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  username: string
}

export default function SummonModal({ isOpen, onClose, userId, username }: SummonModalProps) {
  const [reason, setReason] = useState('')
  const [usersInvolved, setUsersInvolved] = useState('')
  const [loading, setLoading] = useState(false)
  const [dockets, setDockets] = useState<any[]>([])
  const [selectedDocketId, setSelectedDocketId] = useState<string>('')

  useEffect(() => {
    if (isOpen) {
      loadDockets()
    }
  }, [isOpen])

  const loadDockets = async () => {
    const { data } = await supabase
      .from('court_dockets')
      .select('*')
      .eq('status', 'open')
      .gte('court_date', new Date().toISOString().split('T')[0])
      .order('court_date', { ascending: true })
      .limit(5)
    
    if (data) {
      setDockets(data)
    }
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      toast.error('Please provide a reason')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('summon_user_to_court', {
        p_defendant_id: userId,
        p_reason: reason,
        p_users_involved: usersInvolved || '',
        p_docket_id: selectedDocketId || null
      })

      if (error) throw error

      if (data && data.success) {
        toast.success(`Summoned ${username} to court!`)
        onClose()
      } else {
        toast.error(data?.error || 'Failed to summon user')
      }
    } catch (err: any) {
      console.error('Summon error:', err)
      toast.error(err.message || 'Failed to summon user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-red-900/50 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-red-950 to-zinc-900 p-4 border-b border-red-900/30 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-400 font-bold text-lg">
            <Gavel className="w-5 h-5" />
            Summon to Court
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm text-red-200/80">
              You are summoning <span className="font-bold text-white">{username}</span> to {selectedDocketId ? 'a specific docket' : 'the next available court docket'}. 
              Access will be restricted if a warrant is issued.
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Reason for Summoning</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the violation..."
              className="w-full bg-black/50 border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 min-h-[100px]"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Select Docket (Optional)
            </label>
            <select
              value={selectedDocketId}
              onChange={(e) => setSelectedDocketId(e.target.value)}
              className="w-full bg-black/50 border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500"
            >
              <option value="">Next Available</option>
              {dockets.map(docket => (
                <option key={docket.id} value={docket.id}>
                  {new Date(docket.court_date).toLocaleDateString()} ({docket.status})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Users Involved (Optional)
            </label>
            <input
              type="text"
              value={usersInvolved}
              onChange={(e) => setUsersInvolved(e.target.value)}
              placeholder="e.g. user1, user2 (usernames)"
              className="w-full bg-black/50 border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Summoning...' : 'Summon to Court'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
