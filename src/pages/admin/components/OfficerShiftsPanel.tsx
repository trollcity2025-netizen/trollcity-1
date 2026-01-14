import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { toast } from 'sonner'
import { Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import ClickableUsername from '../../../components/ClickableUsername'

interface ShiftLog {
  id: string
  officer_id: string
  clock_in: string
  clock_out: string | null
  last_activity: string
  hours_worked: number | null
  coins_earned: number
  auto_clocked_out: boolean
  paid: boolean
  created_at: string
  officer?: {
    username: string
    email?: string
  }
}

interface ScheduledSlot {
  id: string
  officer_id: string
  shift_date: string
  shift_start_time: string
  shift_end_time: string
  status: 'scheduled' | 'active' | 'completed' | 'cancelled'
  officer?: {
    username: string
  }
}

export default function OfficerShiftsPanel() {
  const [shifts, setShifts] = useState<ShiftLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [now, setNow] = useState(Date.now())
  const [slots, setSlots] = useState<ScheduledSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(true)

  const loadShifts = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('officer_shift_logs')
        // Avoid FK-name joins to prevent schema-cache/constraint-name drift (PGRST200)
        .select('*')
        .order('clock_in', { ascending: false })
        .limit(100)

      if (filter === 'active') {
        query = query.is('clock_out', null)
      } else if (filter === 'completed') {
        query = query.not('clock_out', 'is', null)
      }

      const { data, error } = await query

      if (error) throw error

      const raw = (data as any) || []
      const officerIds = Array.from(
        new Set(raw.map((s: any) => s.officer_id).filter((id: any) => typeof id === 'string' && id.length > 0)),
      )

      const officerMap = new Map<string, any>()
      if (officerIds.length) {
        const { data: officersData, error: officersError } = await supabase
          .from('user_profiles')
          .select('id, username')
          .in('id', officerIds)
        if (officersError) {
          console.warn('Failed to hydrate officer usernames (non-fatal):', officersError)
        } else {
          ;(officersData || []).forEach((o: any) => officerMap.set(o.id, o))
        }
      }

      setShifts(
        raw.map((s: any) => ({
          ...s,
          officer: officerMap.get(s.officer_id) ? { username: officerMap.get(s.officer_id).username } : undefined,
        })),
      )
    } catch (err: any) {
      console.error('Error loading shifts:', err)
      toast.error(err?.message || 'Failed to load shifts')
    } finally {
      setLoading(false)
    }
  }, [filter])

  const loadSlots = useCallback(async () => {
    setSlotsLoading(true)
    try {
      const { data, error } = await supabase
        .from('officer_shift_slots')
        .select(`
          *,
          officer:user_profiles!officer_shift_slots_officer_id_fkey(id, username)
        `)
        .order('shift_date', { ascending: true })
        .order('shift_start_time', { ascending: true })

      if (error) throw error

      setSlots((data as ScheduledSlot[]) || [])
    } catch (err: any) {
      console.error('Error loading scheduled slots:', err)
      toast.error('Failed to load scheduled shifts')
    } finally {
      setSlotsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadShifts()
    loadSlots()

    // Subscribe to real-time updates
    const channel = supabase
      .channel('officer_shifts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'officer_shift_logs'
        },
        () => {
          loadShifts()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [filter, loadShifts, loadSlots])

  useEffect(() => {
    const channel = supabase
      .channel('officer_shift_slots_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'officer_shift_slots'
        },
        () => {
          loadSlots()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadSlots])

  // Real-time ticking for active shifts
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '—'
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatDuration = (clockIn: string, clockOut: string | null) => {
    const start = new Date(clockIn).getTime()
    const end = clockOut ? new Date(clockOut).getTime() : now
    const diff = end - start
    
    if (diff < 0) return '0h 0m'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff / (1000 * 60)) % 60)
    return `${hours}h ${minutes}m`
  }

  const formatSlotDate = (slot: ScheduledSlot) =>
    new Date(`${slot.shift_date}T${slot.shift_start_time}`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })

  const formatSlotRange = (slot: ScheduledSlot) =>
    `${slot.shift_start_time} – ${slot.shift_end_time}`

  const slotStatusCounts = slots.reduce<Record<string, number>>((acc, slot) => {
    acc[slot.status] = (acc[slot.status] || 0) + 1
    return acc
  }, {})

  const activeShifts = shifts.filter(s => !s.clock_out)
  const completedShifts = shifts.filter(s => s.clock_out)
  const upcomingSlots = slots.filter(slot => {
    const end = new Date(`${slot.shift_date}T${slot.shift_end_time}`).getTime()
    return end >= Date.now()
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Clock className="w-6 h-6 text-purple-400" />
          Officer Shift Logs
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="all">All Shifts</option>
            <option value="active">Active Only</option>
            <option value="completed">Completed Only</option>
          </select>
          <button
            onClick={loadShifts}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1A1A1A] border border-[#2C2C2C] rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">Total Shifts</div>
          <div className="text-2xl font-bold text-white">{shifts.length}</div>
        </div>
        <div className="bg-[#1A1A1A] border border-green-500/30 rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">Active Now</div>
          <div className="text-2xl font-bold text-green-400">{activeShifts.length}</div>
        </div>
        <div className="bg-[#1A1A1A] border border-blue-500/30 rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">Completed</div>
          <div className="text-2xl font-bold text-blue-400">{completedShifts.length}</div>
        </div>
      </div>

      <div className="bg-[#1A1A1A] border border-[#2C2C2C] rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-400">Scheduled Slots</p>
            <p className="text-lg font-bold text-white">{slots.length} assigned shifts</p>
          </div>
          {slotsLoading && (
            <span className="text-xs uppercase tracking-[0.3em] text-yellow-400">Syncing…</span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
          {['scheduled', 'active', 'completed', 'cancelled'].map((status) => (
            <div
              key={status}
              className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col items-start gap-1"
            >
              <span className="text-[10px] uppercase text-gray-400 tracking-[0.3em]">{status}</span>
              <span className="text-lg font-semibold text-white">
                {slotStatusCounts[status] || 0}
              </span>
            </div>
          ))}
        </div>
        {slotsLoading && slots.length === 0 ? (
          <div className="p-4 text-gray-400 text-sm">Loading scheduled shifts...</div>
        ) : upcomingSlots.length === 0 ? (
          <div className="p-4 text-gray-400 text-sm">No upcoming shifts scheduled.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0D0D0D] border border-[#2C2C2C]">
                <tr>
                  <th className="p-3 text-left text-xs text-gray-400 uppercase tracking-[0.3em]">Officer</th>
                  <th className="p-3 text-left text-xs text-gray-400 uppercase tracking-[0.3em]">Date</th>
                  <th className="p-3 text-left text-xs text-gray-400 uppercase tracking-[0.3em]">Time</th>
                  <th className="p-3 text-left text-xs text-gray-400 uppercase tracking-[0.3em]">Status</th>
                </tr>
              </thead>
              <tbody>
                {upcomingSlots.map((slot) => (
                  <tr
                    key={slot.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="p-3 text-white">
                      {slot.officer ? (
                        <ClickableUsername userId={slot.officer_id} username={slot.officer.username} />
                      ) : (
                        <span className="text-gray-400">Unknown</span>
                      )}
                    </td>
                    <td className="p-3 text-gray-300">{formatSlotDate(slot)}</td>
                    <td className="p-3 text-gray-300">{formatSlotRange(slot)}</td>
                    <td className="p-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-[0.3em] ${
                          slot.status === 'active'
                            ? 'bg-green-500/20 text-green-200'
                            : slot.status === 'completed'
                              ? 'bg-blue-500/20 text-blue-200'
                              : slot.status === 'cancelled'
                                ? 'bg-red-500/20 text-red-200'
                                : 'bg-yellow-500/20 text-yellow-200'
                        }`}
                      >
                        {slot.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Shifts Table */}
      <div className="bg-[#1A1A1A] border border-[#2C2C2C] rounded-xl overflow-hidden">
        {loading && shifts.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Loading shifts...</div>
        ) : shifts.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No shifts found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0D0D0D] border-b border-[#2C2C2C]">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-gray-300">Officer</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-300">Clock In</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-300">Clock Out</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-300">Duration</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-300">Coins Earned</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-300">Status</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift) => {
                  const isActive = !shift.clock_out

                  return (
                    <tr
                      key={shift.id}
                      className={`border-b border-[#2C2C2C] hover:bg-[#0D0D0D] ${
                        isActive ? 'bg-green-500/5' : ''
                      }`}
                    >
                      <td className="p-4">
                        {shift.officer ? (
                          <ClickableUsername userId={shift.officer_id} username={shift.officer.username} />
                        ) : (
                          <span className="text-gray-400">Unknown</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-gray-300">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          {formatTime(shift.clock_in)}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-300">
                        {shift.clock_out ? (
                          <div className="flex items-center gap-2">
                            <XCircle className="w-4 h-4 text-red-400" />
                            {formatTime(shift.clock_out)}
                          </div>
                        ) : (
                          <span className="text-green-400 flex items-center gap-2">
                            <Clock className="w-4 h-4 animate-pulse" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-gray-300">
                        {isActive ? (
                          <span className="text-green-400 font-semibold">
                            {formatDuration(shift.clock_in, shift.clock_out)}
                          </span>
                        ) : (
                          formatDuration(shift.clock_in, shift.clock_out)
                        )}
                      </td>
                      <td className="p-4 text-sm">
                        <span className="text-yellow-400 font-semibold">
                          {shift.coins_earned?.toLocaleString() || '0'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {isActive ? (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-semibold">
                              Completed
                            </span>
                          )}
                          {shift.auto_clocked_out && (
                            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                              Auto
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {isActive && (
                          <button
                            className="rounded-lg bg-red-700 px-3 py-1 text-xs font-semibold hover:bg-red-800 disabled:opacity-50"
                            onClick={async () => {
                              try {
                                const { error } = await supabase.rpc('admin_end_shift', {
                                  p_shift_id: shift.id,
                                  p_reason: 'Admin ended shift'
                                })
                                if (error) {
                                  console.error('Error ending shift:', error)
                                  toast.error('Failed to end shift')
                                } else {
                                  toast.success('Shift ended successfully')
                                  loadShifts()
                                }
                              } catch (err: any) {
                                console.error('Error ending shift:', err)
                                toast.error(err.message || 'Failed to end shift')
                              }
                            }}
                          >
                            End Shift
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

