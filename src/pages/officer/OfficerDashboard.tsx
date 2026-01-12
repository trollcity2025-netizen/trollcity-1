import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { OFFICER_BASE_HOURLY_COINS } from '../../lib/officerPay'
import { toast } from 'sonner'
import { Shield, Ghost, Clock, Award, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react'
import OfficerStreamGrid from '../../components/officer/OfficerStreamGrid'

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

interface ShiftSlot {
  id: string
  shift_date: string
  shift_start_time: string
  shift_end_time: string
  status: 'scheduled' | 'active' | 'completed' | 'cancelled'
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
  const [shiftSlots, setShiftSlots] = useState<ShiftSlot[]>([])
  const [shiftActionLoading, setShiftActionLoading] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [togglingGhost, setTogglingGhost] = useState(false)

  const loadData = useCallback(async () => {
    if (!user) return
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

      const { data: slots } = await supabase
        .from('officer_shift_slots')
        .select('*')
        .eq('officer_id', user.id)
        .order('shift_date', { ascending: false })

      setShiftSlots((slots as ShiftSlot[]) || [])
    } catch (error: any) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user, loadData])

  const performShiftRpc = useCallback(
    async (slotId: string, rpcName: 'clock_in_from_slot' | 'clock_out_and_complete_slot', successMessage: string) => {
      setShiftActionLoading((prev) => ({ ...prev, [slotId]: true }))
      try {
        const { error } = await supabase.rpc(rpcName, { p_slot_id: slotId })
        if (error) throw error
        toast.success(successMessage)
        await loadData()
      } catch (error: any) {
        console.error('Shift action failed:', error)
        toast.error(error?.message || 'Shift action failed')
      } finally {
        setShiftActionLoading((prev) => {
          const next = { ...prev }
          delete next[slotId]
          return next
        })
      }
    },
    [loadData]
  )

  const handleClockIn = useCallback(
    (slotId: string) => performShiftRpc(slotId, 'clock_in_from_slot', 'Clocked in to shift'),
    [performShiftRpc]
  )

  const handleClockOut = useCallback(
    (slotId: string) => performShiftRpc(slotId, 'clock_out_and_complete_slot', 'Clocked out of shift'),
    [performShiftRpc]
  )

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

      {/* Live Streams Grid */}
      <div className="mb-6">
        <OfficerStreamGrid />
      </div>

      {/* Stats */}
    <div className="grid md:grid-cols-4 gap-4 mb-6">
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
        <div className="bg-black/60 border border-yellow-600 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-yellow-400" />
            <div className="text-sm opacity-70">Hourly Rate</div>
          </div>
          <div className="text-2xl font-bold text-yellow-400">{OFFICER_BASE_HOURLY_COINS.toLocaleString()}</div>
          <div className="text-xs opacity-70">coins/hour</div>
      </div>
    </div>

    {/* Shift Signups */}
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Scheduled Shifts</h2>
        <p className="text-sm opacity-70">{shiftSlots.length} slots</p>
      </div>
      <div className="bg-black/60 border border-purple-600 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="p-3 text-left text-gray-400">Date</th>
              <th className="p-3 text-left text-gray-400">Time</th>
              <th className="p-3 text-left text-gray-400">Status</th>
              <th className="p-3 text-left text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shiftSlots.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-400">
                  No scheduled shifts available
                </td>
              </tr>
            ) : (
              shiftSlots.map((slot) => {
                const start = new Date(`${slot.shift_date}T${slot.shift_start_time}`)
                const end = new Date(`${slot.shift_date}T${slot.shift_end_time}`)
                const canClockIn = slot.status === 'scheduled'
                const canClockOut = slot.status === 'active'
                return (
                  <tr key={slot.id} className="border-b border-gray-800 hover:bg-gray-900/30">
                    <td className="p-3">{start.toLocaleDateString()}</td>
                    <td className="p-3 text-sm">
                      {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
                        slot.status === 'active'
                          ? 'bg-green-500/20 text-green-300'
                          : slot.status === 'scheduled'
                            ? 'bg-blue-500/10 text-blue-300'
                            : 'bg-gray-700/60 text-gray-300'
                      }`}>
                        {slot.status}
                      </span>
                    </td>
                    <td className="p-3 text-sm">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => handleClockIn(slot.id)}
                          disabled={!canClockIn || shiftActionLoading[slot.id]}
                          className="px-3 py-1 rounded-full border border-blue-500 text-blue-300 text-xs font-bold hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {shiftActionLoading[slot.id] && slot.status === 'scheduled' ? 'Clocking in…' : 'Clock In'}
                        </button>
                        <button
                          onClick={() => handleClockOut(slot.id)}
                          disabled={!canClockOut || shiftActionLoading[slot.id]}
                          className="px-3 py-1 rounded-full border border-red-500 text-red-300 text-xs font-bold hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {shiftActionLoading[slot.id] && slot.status === 'active' ? 'Clocking out…' : 'Clock Out'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
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
      <div className="grid md:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/officer/payroll')}
          className="p-4 bg-black/60 border border-yellow-600 rounded-lg hover:bg-black/80 transition-colors text-left"
        >
          <DollarSign className="w-6 h-6 text-yellow-400 mb-2" />
          <p className="font-semibold">Payroll Dashboard</p>
          <p className="text-sm opacity-70">View earnings and work hours</p>
        </button>
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
          className="p-4 bg-black/60 border border-red-600 rounded-lg hover:bg-black/80 transition-colors text-left"
        >
          <AlertTriangle className="w-6 h-6 text-red-400 mb-2" />
          <p className="font-semibold">Moderation Tools</p>
          <p className="text-sm opacity-70">Access moderation panel</p>
        </button>
      </div>
    </div>
  )
}

