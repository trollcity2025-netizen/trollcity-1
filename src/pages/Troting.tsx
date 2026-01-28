import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { Vote, Calendar, Trophy, Plus, AlertCircle, Loader2, XCircle, ShieldAlert, Trash2, ThumbsUp, ThumbsDown } from 'lucide-react'
import { getWeeklyTopBroadcasters } from '../lib/leaderboards'
import TrotingAdminView from '../components/TrotingAdminView'

interface Pitch {
  id: string
  title: string
  description: string
  image_url?: string
  user_id: string
  vote_count: number
  up_votes: number
  down_votes: number
  created_at: string
  author?: {
    username: string
    avatar_url: string
  }
}

interface Contest {
  id: string
  week_start: string
  week_end: string
  status: 'submission' | 'voting' | 'review' | 'completed'
}

export default function Troting() {
  const { user, profile } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'active' | 'upcoming' | 'results' | 'admin'>('active')
  const [contest, setContest] = useState<Contest | null>(null)
  const [pitches, setPitches] = useState<Pitch[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [votingId, setVotingId] = useState<string | null>(null)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [isEligible, setIsEligible] = useState(false)
  
  const isAdmin = profile?.role === 'admin' || profile?.is_admin

  // Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    loadContest()
    checkEligibility()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Subscribe to real-time updates for votes
  useEffect(() => {
    if (!contest?.id) return

    const channel = supabase
      .channel('pitch_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pitches',
          filter: `contest_id=eq.${contest.id}`
        },
        (payload) => {
          setPitches(current => 
            current.map(p => 
              p.id === payload.new.id 
                ? { ...p, vote_count: payload.new.vote_count }
                : p
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [contest?.id])

  const checkEligibility = async () => {
    if (!user) return
    // Check if user is in top 5 broadcasters
    const topBroadcasters = await getWeeklyTopBroadcasters(5)
    const eligible = topBroadcasters.some(b => b.user_id === user.id)
    setIsEligible(eligible)
  }

  const loadContest = async () => {
    try {
      setLoading(true)
      
      // Get current active or submission contest
      const { data: contests, error } = await supabase
        .from('pitch_contests')
        .select('*')
        .in('status', ['voting', 'submission'])
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) throw error

      const currentContest = contests?.[0]
      setContest(currentContest || null)

      if (currentContest) {
        const { data: pitchData, error: pitchError } = await supabase
          .from('pitches')
          .select('*, author:user_profiles(username, avatar_url)')
          .eq('contest_id', currentContest.id)
          .order('vote_count', { ascending: false })

        if (pitchError) throw pitchError
        setPitches(pitchData || [])
      }
    } catch (err) {
      console.error('Error loading contest:', err)
      toast.error('Failed to load contest data')
    } finally {
      setLoading(false)
    }
  }

  const handleVote = async (pitch: Pitch) => {
    if (!user) return
    
    try {
      setVotingId(pitch.id)
      
      const { data, error } = await supabase.rpc('vote_for_pitch', {
        p_pitch_id: pitch.id,
        p_voter_id: user.id
      })

      if (error) throw error

      if (data.success) {
        toast.success(`Voted for ${pitch.title}!`)
        // Update local state optimistically or wait for subscription
      } else {
        toast.error(data.error || 'Failed to vote')
      }
    } catch (err) {
      console.error('Vote error:', err)
      toast.error('Failed to process vote')
    } finally {
      setVotingId(null)
    }
  }

  const handleDeletePitch = async (pitch: Pitch) => {
    if (!isAdmin && user?.id !== pitch.user_id) return
    
    if (!window.confirm('Are you sure you want to delete this pitch?')) return

    try {
      const { error } = await supabase
        .from('pitches')
        .delete()
        .eq('id', pitch.id)

      if (error) throw error

      toast.success('Pitch deleted')
      loadContest()
    } catch (err) {
      console.error('Delete error:', err)
      toast.error('Failed to delete pitch')
    }
  }

  const handleSubmitPitch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !contest) return

    try {
      setSubmitting(true)
      
      const { error } = await supabase
        .from('pitches')
        .insert({
          contest_id: contest.id,
          user_id: user.id,
          title,
          description,
          status: 'approved' // Auto-approve for now or 'pending' if moderation needed
        })

      if (error) throw error

      toast.success('Pitch submitted successfully!')
      setShowSubmitModal(false)
      setTitle('')
      setDescription('')
      loadContest() // Reload to see new pitch
    } catch (err) {
      console.error('Submit error:', err)
      toast.error('Failed to submit pitch')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-4 md:p-8 pb-24">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Vote className="w-8 h-8 text-purple-400" />
            <div>
              <h1 className="text-3xl font-bold">Troting</h1>
              <p className="text-gray-400">Troll City Voting & Pitch Contests</p>
            </div>
          </div>
          
          {contest?.status === 'submission' && (
            <button
              onClick={() => setShowSubmitModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Submit Pitch
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-800 pb-2">
          <button
            onClick={() => setActiveTab('active')}
            className={`pb-2 px-2 font-medium transition-colors ${
              activeTab === 'active' 
                ? 'text-purple-400 border-b-2 border-purple-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Active Votes
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`pb-2 px-2 font-medium transition-colors ${
              activeTab === 'upcoming' 
                ? 'text-purple-400 border-b-2 border-purple-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`pb-2 px-2 font-medium transition-colors ${
              activeTab === 'results' 
                ? 'text-purple-400 border-b-2 border-purple-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Past Results
          </button>
          
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`pb-2 px-2 font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'admin' 
                  ? 'text-red-400 border-b-2 border-red-400' 
                  : 'text-gray-400 hover:text-red-400'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              Admin
            </button>
          )}
        </div>

        {/* Content */}
        {activeTab === 'admin' && isAdmin && (
          <TrotingAdminView />
        )}

        {activeTab === 'active' && (
          <div>
            {!contest ? (
              <div className="text-center py-12 bg-gray-900/50 rounded-xl border border-gray-800">
                <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-300">No Active Contests</h3>
                <p className="text-gray-500 mt-2">Check back later for new voting events.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <Trophy className="w-6 h-6 text-yellow-400" />
                      Weekly Pitch Contest
                    </h2>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      contest.status === 'voting' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {contest.status === 'voting' ? 'Voting Open' : 'Submissions Open'}
                    </span>
                  </div>
                  <p className="text-gray-300">
                    Vote for your favorite broadcaster idea! Voting is free.
                    {contest.status === 'submission' && ' Voting starts soon.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pitches.map((pitch) => (
                    <div key={pitch.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-purple-500/50 transition-all">
                      <div className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <img 
                            src={pitch.author?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${pitch.user_id}`} 
                            alt={pitch.author?.username}
                            className="w-10 h-10 rounded-full bg-gray-800"
                          />
                          <div>
                            <h3 className="font-semibold text-white">{pitch.title}</h3>
                            <p className="text-sm text-gray-400">by {pitch.author?.username}</p>
                          </div>
                        </div>
                        
                        <p className="text-gray-300 mb-6 min-h-[4.5rem] line-clamp-3">
                          {pitch.description}
                        </p>

                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex items-center gap-2">
                            <div className="text-2xl font-bold text-white">{pitch.vote_count}</div>
                            <span className="text-sm text-gray-500">votes</span>
                          </div>
                          
                          {contest.status === 'voting' && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleVote(pitch, 'up')}
                                    disabled={votingId === pitch.id}
                                    className="px-3 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    <ThumbsUp className="w-5 h-5" />
                                    <span className="font-bold">{pitch.up_votes || 0}</span>
                                </button>
                                
                                <button
                                    onClick={() => handleVote(pitch, 'down')}
                                    disabled={votingId === pitch.id}
                                    className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    <ThumbsDown className="w-5 h-5" />
                                    <span className="font-bold">{pitch.down_votes || 0}</span>
                                </button>
                            </div>
                          )}
                          
                          {(isAdmin || (user && user.id === pitch.user_id)) && (
                            <button
                              onClick={() => handleDeletePitch(pitch)}
                              className="p-2 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors ml-2"
                              title="Delete Pitch"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'upcoming' && (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400">No Upcoming Events</h3>
            <p className="text-gray-600 mt-2">Stay tuned for future contests!</p>
          </div>
        )}

        {activeTab === 'results' && (
           <div className="text-center py-12">
            <Trophy className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400">No Past Results</h3>
            <p className="text-gray-600 mt-2">Completed contest results will appear here.</p>
          </div>
        )}
      </div>

      {/* Submit Pitch Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-gray-900 rounded-xl max-w-lg w-full p-6 border border-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Submit Pitch</h2>
              <button 
                onClick={() => setShowSubmitModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmitPitch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  placeholder="e.g. New Game Show Idea"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white h-32 focus:outline-none focus:border-purple-500"
                  placeholder="Describe your pitch..."
                  required
                />
              </div>

              <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                <p className="text-sm text-yellow-200">
                  By submitting, you agree that your pitch will be visible to all users and subject to community voting.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Pitch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
