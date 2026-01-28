import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Check, X, Loader2, DollarSign, Settings, Trash2 } from 'lucide-react'

interface Pitch {
  id: string
  title: string
  description: string
  status: string
  vote_count: number
  up_votes: number
  down_votes: number
  author: {
    username: string
    avatar_url: string
  }
}

interface Contest {
  id: string
  status: string
  week_start: string
  week_end: string
  title?: string
}

export default function TrotingAdminView() {
  const [contests, setContests] = useState<Contest[]>([])
  const [selectedContest, setSelectedContest] = useState<string | null>(null)
  const [pitches, setPitches] = useState<Pitch[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showSplitsModal, setShowSplitsModal] = useState<string | null>(null) // pitch_id
  const [splits, setSplits] = useState<any[]>([])
  const [newSplitUser, setNewSplitUser] = useState('')
  const [newSplitPercent, setNewSplitPercent] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [duration, setDuration] = useState('7') // Default 1 week

  useEffect(() => {
    loadContests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedContest) {
      loadPitches(selectedContest)
    }
  }, [selectedContest])

  useEffect(() => {
    if (showSplitsModal) {
      loadSplits(showSplitsModal)
    }
  }, [showSplitsModal])

  const loadSplits = async (pitchId: string) => {
    const { data } = await supabase
      .from('revenue_splits')
      .select('*, recipient:user_profiles(username)')
      .eq('pitch_id', pitchId)
    if (data) setSplits(data)
  }

  const addSplit = async () => {
    if (!showSplitsModal || !newSplitUser || !newSplitPercent) return

    try {
      // Find user by username
      const { data: userData } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', newSplitUser)
        .single()
      
      if (!userData) {
        toast.error('User not found')
        return
      }

      const { error } = await supabase
        .from('revenue_splits')
        .insert({
          pitch_id: showSplitsModal,
          recipient_id: userData.id,
          percentage: parseFloat(newSplitPercent)
        })

      if (error) throw error
      
      toast.success('Revenue split added')
      setNewSplitUser('')
      setNewSplitPercent('')
      loadSplits(showSplitsModal)
    } catch {
      toast.error('Failed to add split')
    }
  }

  const deleteSplit = async (id: string) => {
    const { error } = await supabase.from('revenue_splits').delete().eq('id', id)
    if (!error) {
      toast.success('Split removed')
      if (showSplitsModal) loadSplits(showSplitsModal)
    }
  }

  const loadContests = async () => {
    const { data } = await supabase
      .from('pitch_contests')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (data) {
      setContests(data)
      if (data.length > 0 && !selectedContest) {
        setSelectedContest(data[0].id)
      }
    }
  }

  const loadPitches = async (contestId: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('pitches')
      .select('*, author:user_profiles(username, avatar_url)')
      .eq('contest_id', contestId)
      .order('vote_count', { ascending: false })
    
    if (data) setPitches(data)
    setLoading(false)
  }

  const deletePitch = async (pitchId: string) => {
    if (!window.confirm('Are you sure you want to delete this pitch?')) return
    
    setActionLoading(pitchId)
    try {
      const { error } = await supabase
        .from('pitches')
        .delete()
        .eq('id', pitchId)

      if (error) throw error
      
      setPitches(current => current.filter(p => p.id !== pitchId))
      toast.success('Pitch deleted')
    } catch (err) {
      console.error('Error deleting pitch:', err)
      toast.error('Failed to delete pitch')
    } finally {
      setActionLoading(null)
    }
  }

  const updatePitchStatus = async (pitchId: string, status: string) => {
    setActionLoading(pitchId)
    try {
      const { error } = await supabase
        .from('pitches')
        .update({ status })
        .eq('id', pitchId)

      if (error) throw error
      
      setPitches(current => 
        current.map(p => p.id === pitchId ? { ...p, status } : p)
      )
      toast.success(`Pitch marked as ${status}`)
    } catch (err) {
      console.error('Error updating pitch:', err)
      toast.error('Failed to update status')
    } finally {
      setActionLoading(null)
    }
  }

  const updateContestStatus = async (status: string) => {
    if (!selectedContest) return
    try {
      const { error } = await supabase
        .from('pitch_contests')
        .update({ status })
        .eq('id', selectedContest)

      if (error) throw error

      setContests(current =>
        current.map(c => c.id === selectedContest ? { ...c, status } : c)
      )
      toast.success(`Contest status updated to ${status}`)
    } catch {
      toast.error('Failed to update contest status')
    }
  }

  const createContest = async () => {
    try {
      const today = new Date()
      const nextWeek = new Date(today)
      nextWeek.setDate(today.getDate() + 7)
      const weekStartStr = today.toISOString().split('T')[0]
      
      const titleToUse = formTitle.trim() || `Pitch Contest ${weekStartStr}`
      
      const { data, error } = await supabase
        .from('pitch_contests')
        .insert({
            week_start: weekStartStr,
            week_end: nextWeek.toISOString().split('T')[0],
            status: 'submission',
            title: titleToUse
        })
        .select()
        .single()

      if (error) throw error

      setContests([data, ...contests])
      setSelectedContest(data.id)
      setFormTitle('')
      toast.success('New contest created!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to create contest')
    }
  }

  const deleteAllContests = async () => {
    if (!window.confirm('WARNING: This will delete ALL contests, pitches, votes, and revenue splits. This action cannot be undone. Are you sure?')) return
    
    if (!window.confirm('Last chance: Are you absolutely sure you want to wipe all contest data?')) return

    try {
      // Delete all contests where id is not empty (effectively all)
      const { error } = await supabase
        .from('pitch_contests')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (error) throw error
      
      setContests([])
      setSelectedContest(null)
      setPitches([])
      toast.success('All contests deleted')
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete all contests')
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-purple-400" />
          Contest Management
        </h2>
        
        <div className="flex flex-wrap gap-4 items-center">
          <select 
            value={selectedContest || ''}
            onChange={(e) => setSelectedContest(e.target.value)}
            className="bg-black/50 border border-zinc-700 rounded-lg px-4 py-2 text-white"
          >
            {contests.map(c => (
              <option key={c.id} value={c.id}>
                {c.title || `Week of ${new Date(c.week_start).toLocaleDateString()}`} ({c.status})
              </option>
            ))}
          </select>
          
          <input
            type="text"
            placeholder="Contest Title (optional)"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            className="bg-black/50 border border-zinc-700 rounded-lg px-4 py-2 text-white w-64"
          />

          <button
            onClick={createContest}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
          >
            + New Contest
          </button>

          <button
            onClick={deleteAllContests}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            title="Delete ALL Contests"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          <div className="h-8 w-px bg-zinc-700 mx-2" />

          <div className="flex gap-2">
            {['submission', 'voting', 'review', 'completed'].map(status => (
              <button
                key={status}
                onClick={() => updateContestStatus(status)}
                disabled={!selectedContest || contests.find(c => c.id === selectedContest)?.status === status}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  contests.find(c => c.id === selectedContest)?.status === status
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-800 text-gray-400 hover:text-white'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-300">Pitches ({pitches.length})</h3>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : (
          <div className="grid gap-4">
            {pitches.map(pitch => (
              <div key={pitch.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden">
                    <img src={pitch.author?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${pitch.author.username}`} alt="" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">{pitch.title}</h4>
                    <p className="text-sm text-gray-400">
                      by {pitch.author?.username} • 
                      <span className="text-green-400 ml-1">+{pitch.up_votes || 0}</span> / 
                      <span className="text-red-400 ml-1">-{pitch.down_votes || 0}</span> • 
                      Total: {pitch.vote_count}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                    pitch.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    pitch.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {pitch.status}
                  </span>
                  
                  <div className="h-6 w-px bg-zinc-700 mx-2" />

                  <button
                    onClick={() => updatePitchStatus(pitch.id, 'approved')}
                    disabled={actionLoading === pitch.id || pitch.status === 'approved'}
                    className="p-2 hover:bg-green-500/20 text-gray-400 hover:text-green-400 rounded-lg transition-colors"
                    title="Approve"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => updatePitchStatus(pitch.id, 'rejected')}
                    disabled={actionLoading === pitch.id || pitch.status === 'rejected'}
                    className="p-2 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                    title="Reject"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowSplitsModal(pitch.id)}
                    className="p-2 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 rounded-lg transition-colors"
                    title="Manage Revenue Splits"
                  >
                    <DollarSign className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deletePitch(pitch.id)}
                    disabled={actionLoading === pitch.id}
                    className="p-2 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                    title="Delete Pitch"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showSplitsModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Revenue Splits</h3>
              <button 
                onClick={() => setShowSplitsModal(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSplitUser}
                  onChange={(e) => setNewSplitUser(e.target.value)}
                  placeholder="Username"
                  className="flex-1 bg-black/50 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                />
                <input
                  type="number"
                  value={newSplitPercent}
                  onChange={(e) => setNewSplitPercent(e.target.value)}
                  placeholder="%"
                  className="w-20 bg-black/50 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={addSplit}
                  disabled={!newSplitUser || !newSplitPercent}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>

              <div className="space-y-2">
                {splits.map(split => (
                  <div key={split.id} className="flex items-center justify-between bg-zinc-800/50 p-3 rounded-lg">
                    <div>
                      <span className="font-medium text-white">{split.recipient?.username}</span>
                      <span className="text-gray-400 text-sm ml-2">{split.percentage}%</span>
                    </div>
                    <button
                      onClick={() => deleteSplit(split.id)}
                      className="text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {splits.length === 0 && (
                  <p className="text-center text-gray-500 py-4">No revenue splits configured</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
