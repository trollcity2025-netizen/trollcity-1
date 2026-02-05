import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { OFFICER_BASE_HOURLY_COINS } from '../../lib/officerPay'
import { toast } from 'sonner'
import { format12hr, formatFullDateTime12hr } from '../../utils/timeFormat'
import { Shield, Ghost, Clock, Award, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react'
import OfficerShiftCalendar from '../../components/officer/OfficerShiftCalendar'
import OfficerClock from '../../components/officer/OfficerClock'

interface WorkSession {
  id: string
  stream_id: string
  clock_in: string
  clock_out: string | null
  status?: string
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
      // Load active assignment via direct DB query
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('officer_live_assignments')
        .select(`
          id,
          stream_id,
          joined_at,
          last_activity,
          streams(title)
        `)
        .eq('officer_id', user.id)
        .eq('status', 'active')
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (!assignmentError && assignmentData) {
        setActiveAssignment(assignmentData as any)
      } else if (assignmentError) {
        console.error('Error fetching assignment:', assignmentError)
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
      const { error } = await supabase.functions.invoke('toggle-ghost-mode', {
        body: { enabled: !profile.is_ghost_mode }
      })

      if (error) throw error

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

  const formatSessionDuration = (hours: number) => {
    const totalMinutes = Math.round(hours * 60)
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    if (h > 0 && m > 0) return `${h} hrs ${m} min`
    if (h > 0) return `${h} hrs`
    return `${m} min`
  }

  if (loading) {
    return <div className={`p-6 ${trollCityTheme.text.primary} text-center`}>Loading...</div>
  }

  return (
    <div className={`p-6 max-w-5xl mx-auto ${trollCityTheme.text.primary} min-h-screen ${trollCityTheme.backgrounds.app}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-purple-400" />
          <h1 className="text-3xl font-bold">Officer Dashboard</h1>
        </div>
      </div>

      <div className="mb-6 grid md:grid-cols-2 gap-6">
        <OfficerClock onActionComplete={loadData} />
        
        <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-lg p-6 flex flex-col justify-between`}>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Ghost className={`w-6 h-6 ${profile?.is_ghost_mode ? 'text-purple-400' : trollCityTheme.text.muted}`} />
              <h2 className="text-xl font-bold">Ghost Mode</h2>
            </div>
            <p className={`text-sm ${trollCityTheme.text.muted}`}>
              {profile?.is_ghost_mode 
                ? 'You are invisible to users. They cannot see your location or status.' 
                : 'Become invisible to users while keeping all moderation tools active.'
              }
            </p>
          </div>
          <button
            onClick={toggleGhostMode}
            disabled={togglingGhost}
            className={`mt-4 w-full py-3 rounded-xl font-bold transition-all ${
              profile?.is_ghost_mode 
                ? `${trollCityTheme.interactive.active} hover:bg-slate-700/70 ${trollCityTheme.borders.glass}` 
                : `${trollCityTheme.gradients.button} text-white`
            }`}
          >
            {togglingGhost 
              ? 'Toggling...' 
              : profile?.is_ghost_mode 
                ? '👻 Deactivate Ghost Mode' 
                : '🛡 Activate Ghost Mode'
            }
          </button>
        </div>
      </div>

      <div className="mb-6">
        <OfficerShiftCalendar title="All Officer Shifts" />
      </div>

      {/* Live Status */}
      {activeAssignment && (
        <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} border-green-500 rounded-lg p-4 mb-6`}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-green-400" />
            <p className="font-semibold">Currently Assigned</p>
          </div>
          <p className={`text-sm ${trollCityTheme.text.muted}`}>
            Stream: {activeAssignment.streams?.title || activeAssignment.stream_id}
          </p>
          <p className={`text-sm ${trollCityTheme.text.muted}`}>
            Active for: {calculateDuration(activeAssignment.joined_at)}
          </p>
        </div>
      )}

      {/* Stats */}
    <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-lg p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <div className={`text-sm ${trollCityTheme.text.muted}`}>Reputation Score</div>
          </div>
          <div className="text-2xl font-bold">{profile?.officer_reputation_score || 100}</div>
        </div>
        <div className={`${trollCityTheme.backgrounds.card} border-blue-600/30 border rounded-lg p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-5 h-5 text-blue-400" />
            <div className={`text-sm ${trollCityTheme.text.muted}`}>Officer Level</div>
          </div>
          <div className="text-2xl font-bold">Level {profile?.officer_level || 1}</div>
        </div>
        <div className={`${trollCityTheme.backgrounds.card} border-green-600/30 border rounded-lg p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-green-400" />
            <div className={`text-sm ${trollCityTheme.text.muted}`}>Status</div>
          </div>
          <div className="text-2xl font-bold">
            {!profile?.is_officer_active 
              ? 'Suspended' 
              : (workSessions[0]?.clock_out === null 
                  ? (workSessions[0]?.status === 'break' ? 'On Break' : 'On Duty') 
                  : 'Off Duty')
            }
          </div>
        </div>
        <div className={`${trollCityTheme.backgrounds.card} border-yellow-600/30 border rounded-lg p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-yellow-400" />
            <div className={`text-sm ${trollCityTheme.text.muted}`}>Hourly Rate</div>
          </div>
          <div className="text-2xl font-bold text-yellow-400">{OFFICER_BASE_HOURLY_COINS.toLocaleString()}</div>
          <div className={`text-xs ${trollCityTheme.text.muted}`}>coins/hour</div>
      </div>
    </div>

    {/* Shift Signups */}
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Scheduled Shifts</h2>
        <p className={`text-sm ${trollCityTheme.text.muted}`}>{shiftSlots.length} slots</p>
      </div>
      <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-lg overflow-hidden`}>
        <table className="w-full">
          <thead>
            <tr className={`border-b ${trollCityTheme.borders.glass}`}>
              <th className={`p-3 text-left ${trollCityTheme.text.muted}`}>Date</th>
              <th className={`p-3 text-left ${trollCityTheme.text.muted}`}>Time</th>
              <th className={`p-3 text-left ${trollCityTheme.text.muted}`}>Status</th>
              <th className={`p-3 text-left ${trollCityTheme.text.muted}`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {shiftSlots.length === 0 ? (
              <tr>
                <td colSpan={4} className={`p-6 text-center ${trollCityTheme.text.muted}`}>
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
                  <tr key={slot.id} className={`border-b ${trollCityTheme.borders.glass} hover:bg-white/5`}>
                    <td className="p-3">{start.toLocaleDateString()}</td>
                    <td className="p-3 text-sm">
                      {format12hr(start)} - {format12hr(end)}
                    </td>
                    <td className="p-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
                        slot.status === 'active'
                          ? 'bg-green-500/20 text-green-300'
                          : slot.status === 'scheduled'
                            ? 'bg-blue-500/10 text-blue-300'
                            : `${trollCityTheme.backgrounds.input} ${trollCityTheme.text.muted}`
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
        <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-lg overflow-hidden`}>
          <table className="w-full">
            <thead>
              <tr className={`border-b ${trollCityTheme.borders.glass}`}>
                <th className={`p-3 text-left ${trollCityTheme.text.muted}`}>Stream</th>
                <th className={`p-3 text-left ${trollCityTheme.text.muted}`}>Clock In</th>
                <th className={`p-3 text-left ${trollCityTheme.text.muted}`}>Clock Out</th>
                <th className={`p-3 text-left ${trollCityTheme.text.muted}`}>Time Worked</th>
                <th className={`p-3 text-left ${trollCityTheme.text.muted}`}>Coins</th>
                <th className={`p-3 text-left ${trollCityTheme.text.muted}`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {workSessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`p-6 text-center ${trollCityTheme.text.muted}`}>
                    No work sessions yet
                  </td>
                </tr>
              ) : (
                workSessions.map((session) => (
                  <tr key={session.id} className={`border-b ${trollCityTheme.borders.glass} hover:bg-white/5`}>
                    <td className="p-3">{session.streams?.title || 'N/A'}</td>
                    <td className="p-3 text-sm">
                      {formatFullDateTime12hr(session.clock_in)}
                    </td>
                    <td className="p-3 text-sm">
                      {session.clock_out ? formatFullDateTime12hr(session.clock_out) : 'Active'}
                    </td>
                    <td className="p-3">
                      {formatSessionDuration(session.hours_worked)}
                    </td>
                    <td className="p-3 text-green-400">{session.coins_earned}</td>
                    <td className="p-3">
                      {session.auto_clocked_out && (
                        <span className="text-xs text-yellow-400">Auto-clockout</span>
                      )}
                      {session.clock_out ? (
                        <span className={`text-xs ${trollCityTheme.text.muted}`}>Completed</span>
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
          onClick={() => navigate('/officer/payroll')}
          className={`p-4 ${trollCityTheme.backgrounds.card} border border-yellow-600 rounded-lg hover:bg-white/5 transition-colors text-left`}
        >
          <DollarSign className="w-6 h-6 text-yellow-400 mb-2" />
          <p className="font-semibold">Payroll Dashboard</p>
          <p className={`text-sm ${trollCityTheme.text.muted}`}>View earnings and work hours</p>
        </button>
        <button
          onClick={() => navigate('/officer/moderation')}
          className={`p-4 ${trollCityTheme.backgrounds.card} border border-red-600 rounded-lg hover:bg-white/5 transition-colors text-left`}
        >
          <AlertTriangle className="w-6 h-6 text-red-400 mb-2" />
          <p className="font-semibold">Moderation Tools</p>
          <p className={`text-sm ${trollCityTheme.text.muted}`}>Access moderation panel</p>
        </button>
      </div>
    </div>
  )
}

