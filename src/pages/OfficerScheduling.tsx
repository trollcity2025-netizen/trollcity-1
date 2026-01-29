import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, isAdminEmail } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { Calendar, Clock, Plus, Trash2, CheckCircle, XCircle, AlertCircle, DollarSign } from 'lucide-react'
import { format12hr } from '../utils/timeFormat'

interface ShiftSlot {
  id: string
  officer_id: string
  shift_date: string
  shift_start_time: string
  shift_end_time: string
  status: 'scheduled' | 'active' | 'completed' | 'cancelled'
  created_at: string
  shift_log_id?: string
  coins_earned?: number
  hours_worked?: number
  cashed_out?: boolean
}

export default function OfficerScheduling() {
  const { profile, user } = useAuthStore()
  const navigate = useNavigate()
  const [slots, setSlots] = useState<ShiftSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [blockedSlots, setBlockedSlots] = useState<ShiftSlot[]>([])

  const formatTime12h = (time: string) => {
    return format12hr(time);
  }

  // Check if user is officer or admin
  useEffect(() => {
    if (!profile || !user) {
      return // Don't navigate immediately, wait for profile to load
    }
    const isAdmin = profile.is_admin || profile.role === 'admin' || isAdminEmail(user.email)
    const isOfficer = profile.is_troll_officer || profile.role === 'troll_officer'
    
    if (!isOfficer && !isAdmin) {
      toast.error('Officer access required')
      navigate('/')
      return
    }
  }, [profile, user, navigate])

  const loadSlots = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      // Load shift slots
      const { data: slotsData, error: slotsError } = await supabase
        .from('officer_shift_slots')
        .select('*')
        .eq('officer_id', profile.id)
        .order('shift_date', { ascending: true })
        .order('shift_start_time', { ascending: true })

      if (slotsError) {
        console.error('Error loading shift slots:', {
          error: slotsError,
          message: slotsError.message,
          code: slotsError.code,
          details: slotsError.details,
          hint: slotsError.hint
        })
        throw slotsError
      }

      // Load shift logs to get earnings and active shifts (non-critical, continue if fails)
      let logsData = null
      let activeLogsData = null

      try {
        // Load completed shift logs for earnings
        const { data: logs, error: logsError } = await supabase
          .from('officer_work_sessions')
          .select('id, coins_earned, hours_worked, clock_in, clock_out')
          .eq('officer_id', profile.id)
          .not('clock_out', 'is', null)

        if (logsError) {
          console.warn('Error loading shift logs (non-critical):', logsError)
        } else {
          logsData = logs
        }

        // Load active shift logs to check if clocked in
        const { data: activeLogs, error: activeLogsError } = await supabase
          .from('officer_work_sessions')
          .select('id, clock_in, clock_out')
          .eq('officer_id', profile.id)
          .is('clock_out', null)

        if (activeLogsError) {
          console.warn('Error loading active shift logs (non-critical):', activeLogsError)
        } else {
          activeLogsData = activeLogs
        }
      } catch (logErr) {
        console.warn('Failed to load shift logs (non-critical):', logErr)
      }

      // Load cashout status (non-critical, continue if fails)
      let cashoutData = null
      try {
        const { data: cashouts } = await supabase
          .from('officer_payouts')
          .select('shift_log_id, status')
          .eq('officer_id', profile.id)
          .in('status', ['pending', 'approved', 'paid'])
        
        cashoutData = cashouts
      } catch (cashoutErr) {
        console.warn('Failed to load cashout data (non-critical):', cashoutErr)
      }

      // Map slots with shift log data by matching date
      const slotsWithData = (slotsData || []).map(slot => {
        const slotDate = new Date(slot.shift_date)
        const slotDateTime = new Date(`${slot.shift_date}T${slot.shift_start_time}`)
        
        // Find matching completed shift log by date
        const shiftLog = logsData?.find(log => {
          if (!log.clock_in) return false
          const logDate = new Date(log.clock_in)
          return logDate.toDateString() === slotDate.toDateString()
        })
        
        // Find matching active shift log by checking if there's an active log that matches this slot
        const activeLog = activeLogsData?.find(log => {
          if (!log.clock_in) return false
          const logStart = new Date(log.clock_in)
          // Match by date and approximate time (within 1 hour)
          const timeDiff = Math.abs(logStart.getTime() - slotDateTime.getTime())
          return logStart.toDateString() === slotDate.toDateString() && timeDiff < 3600000 // 1 hour
        })
        
        const cashout = shiftLog ? cashoutData?.find(c => c.shift_log_id === shiftLog.id) : null
        
        // If there's an active log for this slot, ensure status is 'active'
        const finalStatus = activeLog ? 'active' : slot.status
        
        return {
          ...slot,
          status: finalStatus,
          shift_log_id: shiftLog?.id || activeLog?.id,
          coins_earned: shiftLog?.coins_earned,
          hours_worked: shiftLog?.hours_worked,
          cashed_out: !!cashout,
          has_active_log: !!activeLog
        }
      })

      setSlots(slotsWithData)
    } catch (err: any) {
      console.error('Error loading shift slots:', {
        error: err,
        message: err?.message || 'Unknown error',
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        stack: err?.stack
      })
      const errorMessage = err?.message || err?.details || 'Failed to load shift slots'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  // Load shift slots and subscribe to real-time updates
  useEffect(() => {
    if (profile?.id) {
      loadSlots()

      // Subscribe to real-time updates
      const channel = supabase
        .channel('officer_shift_slots_realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'officer_shift_slots',
            filter: `officer_id=eq.${profile.id}`
          },
          () => {
            loadSlots()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [profile?.id, loadSlots])

  const handleAddSlot = async () => {
    if (!profile?.id || !selectedDate || !startTime || !endTime) {
      toast.error('Please fill in all fields')
      return
    }

    // Validate time range
    if (startTime >= endTime) {
      toast.error('End time must be after start time')
      return
    }

    // Validate date is not in the past
    const slotDate = new Date(selectedDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (slotDate < today) {
      toast.error('Cannot schedule shifts in the past')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('officer_shift_slots')
        .insert({
          officer_id: profile.id,
          shift_date: selectedDate,
          shift_start_time: startTime,
          shift_end_time: endTime,
          status: 'scheduled'
        })

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast.error('You already have a shift scheduled for this date and time')
        } else {
          throw error
        }
        return
      }

      toast.success('Shift slot created successfully')
      setSelectedDate('')
      setStartTime('')
      setEndTime('')
      setShowAddForm(false)
      await loadSlots()
    } catch (err: any) {
      console.error('Error creating shift slot:', err)
      toast.error(err?.message || 'Failed to create shift slot')
    } finally {
      setLoading(false)
    }
  }

  const handleClockIn = async (slotId: string) => {
    if (!profile?.id) return
    
    // Prevent admins from clocking in
    const isAdmin = profile.is_admin || profile.role === 'admin' || isAdminEmail(user?.email)
    if (isAdmin) {
      toast.info('Admins have full access without needing to clock in for shifts')
      return
    }
    
    // Check if the shift is blocked (passed by 15 minutes)
    const slot = slots.find(s => s.id === slotId)
    if (slot) {
      const slotDateTime = new Date(`${slot.shift_date}T${slot.shift_start_time}`)
      const now = new Date()
      const timeDiff = now.getTime() - slotDateTime.getTime()
      const fifteenMinutesInMs = 15 * 60 * 1000
      
      if (timeDiff > fifteenMinutesInMs) {
        toast.error('This shift has passed by 15 minutes and cannot be clocked in')
        
        // Mark this slot as blocked
        setBlockedSlots(prev => [...prev, slot])
        
        // Assign this shift to another officer who isn't assigned a shift
        await assignShiftToAnotherOfficer(slot)
        
        return
      }
    }
    
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('clock_in_from_slot', {
        p_slot_id: slotId
      })

      if (error) throw error

      if (data?.success) {
        toast.success('Clocked in successfully!')
        await loadSlots()
      } else {
        toast.error(data?.error || 'Failed to clock in')
      }
    } catch (err: any) {
      console.error('Error clocking in:', err)
      toast.error(err?.message || 'Failed to clock in')
    } finally {
      setLoading(false)
    }
  }

  const assignShiftToAnotherOfficer = async (slot: ShiftSlot) => {
    try {
      // Find officers who don't have a shift at this time
      const { data: officers, error: officersError } = await supabase
        .from('user_profiles')
        .select('id, username')
        .eq('is_troll_officer', true)
        .neq('id', profile?.id)
      
      if (officersError) throw officersError
      
      // Filter officers who don't have a shift at this time
      const availableOfficers = officers.filter(officer => {
        return !slots.some(s => s.officer_id === officer.id && s.shift_date === slot.shift_date)
      })
      
      if (availableOfficers.length > 0) {
        // Assign to the first available officer
        const assignedOfficer = availableOfficers[0]
        
        // Update the shift assignment
        const { error: updateError } = await supabase
          .from('officer_shift_slots')
          .update({ officer_id: assignedOfficer.id })
          .eq('id', slot.id)
        
        if (updateError) throw updateError
        
        // Send push notification
        await sendPushNotification(
          assignedOfficer.id,
          `You have been assigned a new shift: ${slot.shift_date} ${formatTime12h(slot.shift_start_time)} - ${formatTime12h(slot.shift_end_time)}`
        )
        
        toast.success(`Shift reassigned to ${assignedOfficer.username}`)
      } else {
        toast.info('No available officers to reassign this shift')
      }
    } catch (err) {
      console.error('Error reassigning shift:', err)
      toast.error('Failed to reassign shift')
    }
  }

  const sendPushNotification = async (userId: string, message: string) => {
    try {
      // Insert notification into database
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          message: message,
          type: 'shift_assignment',
          is_read: false
        })
      
      if (error) throw error
      
      // In a real app, you would also send a push notification via a service like Firebase
      console.log(`Push notification sent to user ${userId}: ${message}`)
    } catch (err) {
      console.error('Error sending push notification:', err)
    }
  }

  const handleClockOut = async (slotId: string) => {
    if (!profile?.id) return
    
    // Prevent admins from clocking out
    const isAdmin = profile.is_admin || profile.role === 'admin' || isAdminEmail(user?.email)
    if (isAdmin) {
      toast.info('Admins have full access without needing to clock out for shifts')
      return
    }
    
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('clock_out_and_complete_slot', {
        p_slot_id: slotId
      })

      if (error) throw error

      if (data?.success) {
        toast.success(`Clocked out! Earned ${data.coins_earned?.toLocaleString()} free coins for ${data.hours_worked?.toFixed(2)} hours`)
        await loadSlots()
      } else {
        toast.error(data?.error || 'Failed to clock out')
      }
    } catch (err: any) {
      console.error('Error clocking out:', err)
      toast.error(err?.message || 'Failed to clock out')
    } finally {
      setLoading(false)
    }
  }

  const handleCashout = async (shiftLogId: string) => {
    if (!profile?.id || !shiftLogId) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('officer_cashout_after_shift', {
        p_shift_log_id: shiftLogId
      })

      if (error) throw error

      if (data?.success) {
        const troll_coins = data.troll_coins_received?.toLocaleString() || '0'
        const usdAmount = data.usd_amount?.toFixed(2) || '0.00'
        toast.success(`Cashout successful! Converted ${data.free_coins_redeemed?.toLocaleString()} free coins to ${troll_coins} troll_coins ($${usdAmount})`)
        await loadSlots()
        // Refresh profile to update balances
        const { data: updatedProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', profile.id)
          .single()
        if (updatedProfile) {
          useAuthStore.getState().setProfile(updatedProfile as any)
        }
      } else {
        toast.error(data?.error || 'Failed to cash out')
      }
    } catch (err: any) {
      console.error('Error cashing out:', err)
      toast.error(err?.message || 'Failed to cash out')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSlot = async (slotId: string, status: string) => {
    if (status === 'active') {
      toast.error('Cannot delete an active shift. Please clock out first.')
      return
    }

    if (!confirm('Are you sure you want to delete this shift slot?')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('officer_shift_slots')
        .delete()
        .eq('id', slotId)
        .eq('officer_id', profile!.id)

      if (error) throw error

      toast.success('Shift slot deleted')
      await loadSlots()
    } catch (err: any) {
      console.error('Error deleting shift slot:', err)
      toast.error(err?.message || 'Failed to delete shift slot')
    } finally {
      setLoading(false)
    }
  }

  // Group slots by date
  const groupedSlots = slots.reduce((acc, slot) => {
    const date = slot.shift_date
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(slot)
    return acc
  }, {} as Record<string, ShiftSlot[]>)

  // Get today's date for min date
  const today = new Date().toISOString().split('T')[0]

  if (!profile) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Calendar className="w-8 h-8 text-purple-400" />
            Officer Shift Scheduling
          </h1>
          <p className="text-gray-400">
            Schedule your work shifts in advance. Each slot must be filled by you.
          </p>
        </div>

        {/* Add Slot Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            {showAddForm ? 'Cancel' : 'Schedule New Shift'}
          </button>
        </div>

        {/* Add Slot Form */}
        {showAddForm && (
          <div className="bg-[#1A1A1A] border border-purple-500/30 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Schedule New Shift</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={today}
                  className="w-full bg-[#0D0D0D] border border-purple-500/40 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-[#0D0D0D] border border-purple-500/40 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-[#0D0D0D] border border-purple-500/40 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
              </div>
            </div>
            <button
              onClick={handleAddSlot}
              disabled={loading}
              className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create Shift Slot'}
            </button>
          </div>
        )}

        {/* Shift Slots List */}
        {loading && slots.length === 0 ? (
          <div className="text-center text-gray-400 py-8">Loading shift slots...</div>
        ) : slots.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-gray-700 rounded-xl p-8 text-center">
            <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No shift slots scheduled yet</p>
            <p className="text-sm text-gray-500 mt-2">Click "Schedule New Shift" to get started</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedSlots).map(([date, dateSlots]) => (
              <div key={date} className="bg-[#1A1A1A] border border-purple-500/30 rounded-xl p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  {new Date(date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </h3>
                <div className="space-y-3">
                  {dateSlots.map((slot) => {
                    const slotDateTime = new Date(`${slot.shift_date}T${slot.shift_start_time}`)
                    const isAdmin = profile.is_admin || profile.role === 'admin' || isAdminEmail(user?.email)
                    const isPast = slotDateTime < new Date()
                    // Admins can't clock in/out (they don't get paid)
                    const canClockIn = !isAdmin && !isPast && slot.status === 'scheduled'
                    // Show clock out if status is 'active' OR if there's an active shift log (but not for admins)
                    const canClockOut = !isAdmin && (slot.status === 'active' || (slot as any).has_active_log)

                    return (
                      <div
                        key={slot.id}
                        className={`bg-[#0D0D0D] border rounded-lg p-4 ${
                          slot.status === 'active' || (slot as any).has_active_log
                            ? 'border-green-500/50 bg-green-500/10'
                            : slot.status === 'completed'
                            ? 'border-blue-500/50 bg-blue-500/10'
                            : slot.status === 'cancelled'
                            ? 'border-red-500/50 bg-red-500/10 opacity-50'
                            : 'border-purple-500/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Clock className="w-5 h-5 text-purple-400" />
                            <div>
                              <div className="font-semibold">
                                {formatTime12h(slot.shift_start_time)} - {formatTime12h(slot.shift_end_time)}
                              </div>
                              <div className="text-sm text-gray-400 capitalize">
                                Status: {slot.status}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isAdmin && (
                              <div className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-xs border border-purple-500/30">
                                Admin Access
                              </div>
                            )}
                            {slot.status === 'scheduled' && canClockIn && (
                              <button
                                onClick={() => handleClockIn(slot.id)}
                                disabled={loading || blockedSlots.some(b => b.id === slot.id)}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Clock In
                              </button>
                            )}
                            {blockedSlots.some(b => b.id === slot.id) && (
                              <div className="flex items-center gap-2 text-red-400 text-sm">
                                <AlertCircle className="w-4 h-4" />
                                Blocked
                              </div>
                            )}
                            {(slot.status === 'active' || (slot as any).has_active_log) && canClockOut && (
                              <>
                                <button
                                  onClick={() => handleClockOut(slot.id)}
                                  disabled={loading}
                                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Clock Out
                                </button>
                                <div className="flex items-center gap-2 text-green-400 text-sm">
                                  <AlertCircle className="w-4 h-4" />
                                  Active
                                </div>
                              </>
                            )}
                            {slot.status === 'scheduled' && (
                              <button
                                onClick={() => handleDeleteSlot(slot.id, slot.status)}
                                disabled={loading}
                                className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="Delete shift slot"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            {slot.status === 'completed' && (
                              <div className="flex items-center gap-3">
                                {slot.coins_earned && (
                                  <div className="text-sm text-gray-300">
                                    <span className="text-yellow-400 font-semibold">
                                      {slot.coins_earned.toLocaleString()}
                                    </span>{' '}
                                    free coins earned
                                  </div>
                                )}
                                {slot.shift_log_id && !slot.cashed_out && (
                                  <button
                                    onClick={() => handleCashout(slot.shift_log_id!)}
                                    disabled={loading}
                                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                    title="Cash out: 6,000 troll_coins = $60"
                                  >
                                    <DollarSign className="w-4 h-4" />
                                    Cash Out
                                  </button>
                                )}
                                {slot.cashed_out && (
                                  <div className="flex items-center gap-2 text-green-400 text-sm">
                                    <CheckCircle className="w-4 h-4" />
                                    Cashed Out
                                  </div>
                                )}
                                {!slot.shift_log_id && (
                                  <div className="flex items-center gap-2 text-blue-400 text-sm">
                                    <CheckCircle className="w-4 h-4" />
                                    Completed
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

