import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { Shield, Ghost, Clock, Award, AlertTriangle, TrendingUp } from 'lucide-react'

interface WorkSession {
  id: string
  stream_id: string
  clock_in: string
  clock_out: string | null
  hours_worked: number
  coins_earned: number
  auto_clocked_out: boolean
  streams?: { title: string | null }
}

interface ActiveAssignment {
  id: string
  stream_id: string
  joined_at: string
  last_activity: string
  streams?: { title: string | null }
}

export default function OfficerDashboard() {
  const { user, profile, refreshProfile } = useAuthStore()
  const navigate = useNavigate()
  const [activeAssignment, setActiveAssignment] = useState<ActiveAssignment | null>(null)
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingGhost, setTogglingGhost] = useState(false)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load active assignment
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token

      if (token) {
        const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
          'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'

        const assignmentRes = await fetch(`${edgeFunctionsUrl}/officer-get-assignment`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })

        if (assignmentRes.ok) {
          const assignmentData = await assignmentRes.json()
          setActiveAssignment(assignmentData.assignment)
        }
      }

      // Load work sessions
      const { data: sessions } = await supabase
        .from('officer_work_sessions')
        .select(`
          *,
          streams(title)
        `)
        .eq('officer_id', user.id)
        .order('clock_in', { ascending: false })
        .limit(30)

      setWorkSessions((sessions as any) || [])
    } catch (error: any) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleGhostMode = async () => {
    if (!user || !profile) return

    setTogglingGhost(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token

      if (!token) {
        toast.error('Not authenticated')
        return
      }

      const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
        'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'

      const response = await fetch(`${edgeFunctionsUrl}/toggle-ghost-mode`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled: !profile.is_ghost_mode })
      })

      if (!response.ok) throw new Error('Failed to toggle ghost mode')

      if (refreshProfile) await refreshProfile()
      toast.success(profile.is_ghost_mode ? 'Ghost mode disabled' : 'Ghost mode enabled')
    } catch (error: any) {
      console.error('Error toggling ghost mode:', error)
      toast.error('Failed to toggle ghost mode')
    } finally {
      setTogglingGhost(false)
    }
  }

  const calculateDuration = (joinedAt: string) => {
    const now = Date.now()
    const joined = new Date(joinedAt).getTime()
    const minutes = Math.floor((now - joined) / 60000)
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  if (loading) {
    return <div className="p-6 text-white text-center">Loading...</div>
  }

  return (
    <div className="p-6 max-w-5xl mx-auto text-white min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-purple-400" />
          <h1 className="text-3xl font-bold">Officer Dashboard</h1>
        </div>
        <button
          onClick={() => navigate('/officer/training')}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
        >
          Start Training
        </button>
      </div>

      {/* Ghost Mode Toggle */}
      <div className="bg-black/60 border border-purple-600 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ghost className={`w-6 h-6 ${profile?.is_ghost_mode ? 'text-purple-400' : 'text-gray-400'}`} />
            <div>
              <p className="font-semibold">Ghost Mode</p>
              <p className="text-sm opacity-70">
                {profile?.is_ghost_mode 
                  ? 'You are invisible to users' 
                  : 'Become invisible to users while keeping moderation tools'
                }
              </p>
            </div>
          </div>
          <button
            onClick={toggleGhostMode}
            disabled={togglingGhost}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              profile?.is_ghost_mode 
                ? 'bg-gray-800 hover:bg-gray-700' 
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {togglingGhost 
              ? 'Toggling...' 
              : profile?.is_ghost_mode 
                ? '👻 Ghost Mode Active' 
                : '🛡 Become Visible'
            }
          </button>
        </div>
      </div>

      {/* Live Status */}
      {activeAssignment && (
        <div className="bg-green-900/20 border border-green-500 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-green-400" />
            <p className="font-semibold">Currently Assigned</p>
          </div>
          <p className="text-sm opacity-80">
            Stream: {activeAssignment.streams?.title || activeAssignment.stream_id}
          </p>
          <p className="text-sm opacity-80">
            Active for: {calculateDuration(activeAssignment.joined_at)}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-black/60 border border-purple-600 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <div className="text-sm opacity-70">Reputation Score</div>
          </div>
          <div className="text-2xl font-bold">{profile?.officer_reputation_score || 100}</div>
        </div>
        <div className="bg-black/60 border border-blue-600 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-5 h-5 text-blue-400" />
            <div className="text-sm opacity-70">Officer Level</div>
          </div>
          <div className="text-2xl font-bold">Level {profile?.officer_level || 1}</div>
        </div>
        <div className="bg-black/60 border border-green-600 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-green-400" />
            <div className="text-sm opacity-70">Status</div>
          </div>
          <div className="text-2xl font-bold">
            {profile?.is_officer_active ? 'Active' : 'Inactive'}
          </div>
        </div>
      </div>

      {/* Work Sessions */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Recent Work Sessions</h2>
        <div className="bg-black/60 border border-purple-600 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="p-3 text-left text-gray-400">Stream</th>
                <th className="p-3 text-left text-gray-400">Date</th>
                <th className="p-3 text-left text-gray-400">Hours</th>
                <th className="p-3 text-left text-gray-400">Coins</th>
                <th className="p-3 text-left text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {workSessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-400">
                    No work sessions yet
                  </td>
                </tr>
              ) : (
                workSessions.map((session) => (
                  <tr key={session.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                    <td className="p-3">{session.streams?.title || 'N/A'}</td>
                    <td className="p-3 text-sm">
                      {new Date(session.clock_in).toLocaleDateString()}
                    </td>
                    <td className="p-3">{session.hours_worked.toFixed(2)}</td>
                    <td className="p-3 text-green-400">{session.coins_earned}</td>
                    <td className="p-3">
                      {session.auto_clocked_out && (
                        <span className="text-xs text-yellow-400">Auto-clockout</span>
                      )}
                      {session.clock_out ? (
                        <span className="text-xs text-gray-400">Completed</span>
                      ) : (
                        <span className="text-xs text-green-400">Active</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/officer/training-progress')}
          className="p-4 bg-black/60 border border-purple-600 rounded-lg hover:bg-black/80 transition-colors text-left"
        >
          <Award className="w-6 h-6 text-purple-400 mb-2" />
          <p className="font-semibold">View Training Progress</p>
          <p className="text-sm opacity-70">See your training history and stats</p>
        </button>
        <button
          onClick={() => navigate('/officer/moderation')}
          className="p-4 bg-black/60 border border-purple-600 rounded-lg hover:bg-black/80 transition-colors text-left"
        >
          <AlertTriangle className="w-6 h-6 text-red-400 mb-2" />
          <p className="font-semibold">Moderation Tools</p>
          <p className="text-sm opacity-70">Access moderation panel</p>
        </button>
      </div>
    </div>
  )
}

