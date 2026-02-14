import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { sendNotification } from '../../../lib/sendNotification'
import { toast } from 'sonner'
import { Calendar, Clock, Plus, Trash2, CheckCircle } from 'lucide-react'
import UserNameWithAge from '../../../components/UserNameWithAge'
import { useAuthStore } from '../../../lib/store'
import { format12hr } from '../../../utils/timeFormat'

interface Officer {
  id: string
  username: string
  email?: string
  is_troll_officer: boolean
  role?: string
  is_admin?: boolean
  created_at?: string
}

interface ScheduleSlot {
  id: string
  officer_id: string
  shift_date: string
  shift_start_time: string
  shift_end_time: string
  status: string
  officer?: Officer
}

export default function CreateSchedulePanel() {
  const { profile } = useAuthStore()
  const [officers, setOfficers] = useState<Officer[]>([])
  const [selectedOfficer, setSelectedOfficer] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingSchedules, setLoadingSchedules] = useState(true)

  const canViewEmails = profile?.role === 'admin' || profile?.is_admin === true

  // Auto-generate state
  const [bulkMode, setBulkMode] = useState<'add' | 'delete'>('add')
  const [bulkTarget, setBulkTarget] = useState<'all' | 'specific'>('all')
  const [bulkSpecificOfficer, setBulkSpecificOfficer] = useState<string>('')
  const [autoStartDate, setAutoStartDate] = useState('')
  const [autoDays, setAutoDays] = useState(7)
  const [autoStartTime, setAutoStartTime] = useState('09:00')
  const [autoEndTime, setAutoEndTime] = useState('17:00')

  const sendPushNotification = async (userId: string, message: string) => {
    try {
      await sendNotification(userId, 'officer_update', 'Shift Update', message)
    } catch (err) {
      console.error('Error sending push notification:', err)
    }
  }

  // Load all troll officers (exclude admins - they don't need shifts)
  const loadOfficers = React.useCallback(async () => {
    try {
      const selectFields = canViewEmails
        ? 'id, username, email, is_troll_officer, is_lead_officer, role, is_admin'
        : 'id, username, is_troll_officer, is_lead_officer, role, is_admin'

      const { data, error } = await supabase
        .from('user_profiles')
        .select(selectFields as any)
        // Include both troll officers and lead officers
        .or('is_troll_officer.eq.true,is_lead_officer.eq.true,role.eq.troll_officer,role.eq.lead_troll_officer')
        .neq('role', 'admin')  // Exclude admins from shift scheduling
        .eq('is_admin', false)  // Also exclude by is_admin flag
        .order('username', { ascending: true })

      if (error) throw error

      // Filter out any admins that might have slipped through
      const filteredOfficers = (data as unknown as Officer[])?.filter((o) => 
        o.role !== 'admin' && !o.is_admin
      ) || []

      setOfficers(filteredOfficers)
    } catch (err: unknown) {
      console.error('Error loading officers:', err)
      toast.error('Failed to load officers')
    }
  }, [canViewEmails])

  // Load all schedules
  const loadSchedules = React.useCallback(async () => {
    setLoadingSchedules(true)
    try {
      const { data, error } = await supabase
        .from('officer_shift_slots')
        .select(`
          *,
          officer:user_profiles!officer_shift_slots_officer_id_fkey(
            id,
            username,
            created_at,
            email,
            is_troll_officer,
            created_at
          )
        `)
        .order('shift_date', { ascending: true })
        .order('shift_start_time', { ascending: true })

      if (error) throw error

      setSchedules((data as any) || [])
    } catch (err: any) {
      console.error('Error loading schedules:', err)
      toast.error('Failed to load schedules')
    } finally {
      setLoadingSchedules(false)
    }
  }, [])

  useEffect(() => {
    loadOfficers()
    loadSchedules()

    // Polling every 30s to reduce DB load
    const interval = setInterval(() => {
      loadSchedules()
    }, 30000)

    return () => {
      clearInterval(interval)
    }
  }, [loadOfficers, loadSchedules])

  // Default autoStartDate to today once
  useEffect(() => {
    if (!autoStartDate) {
      const today = new Date().toISOString().split('T')[0]
      setAutoStartDate(today)
    }
  }, [autoStartDate])

  const handleBulkAction = async () => {
    if (!autoStartDate) {
      toast.error('Please select a start date')
      return
    }

    if (bulkMode === 'add') {
      if (!autoStartTime || !autoEndTime) {
        toast.error('Please select start and end times')
        return
      }
      if (autoStartTime >= autoEndTime) {
        toast.error('End time must be after start time')
        return
      }
    }

    if (bulkTarget === 'specific' && !bulkSpecificOfficer) {
      toast.error('Please select an officer')
      return
    }

    const days = Math.max(1, Math.min(31, Number(autoDays) || 7))

    setLoading(true)
    try {
      const start = new Date(autoStartDate + 'T00:00:00')
      const dateStrings: string[] = []
      for (let i = 0; i < days; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        dateStrings.push(d.toISOString().split('T')[0])
      }

      let officerIds: string[] = []
      if (bulkTarget === 'specific') {
        officerIds = [bulkSpecificOfficer]
      } else {
        officerIds = officers.map((o) => o.id).filter(Boolean)
      }

      if (!officerIds.length) {
        toast.error('No officers found')
        return
      }

      if (bulkMode === 'add') {
        const rows = officerIds.flatMap((officerId) =>
          dateStrings.map((shift_date) => ({
            officer_id: officerId,
            shift_date,
            shift_start_time: autoStartTime,
            shift_end_time: autoEndTime,
            status: 'scheduled',
          })),
        )

        const { error } = await supabase
          .from('officer_shift_slots')
          .upsert(rows as any, {
            onConflict: 'officer_id,shift_date,shift_start_time,shift_end_time',
            ignoreDuplicates: true,
          })

        if (error) throw error

        toast.success(`Generated schedules for ${officerIds.length} officers (${days} days)`) 
      } else {
        // Bulk Delete
        const { data: shiftsToDelete, error: fetchError } = await supabase
          .from('officer_shift_slots')
          .select('id, officer_id, shift_date')
          .in('officer_id', officerIds)
          .in('shift_date', dateStrings)
          .eq('status', 'scheduled')
        
        if (fetchError) throw fetchError

        if (!shiftsToDelete || shiftsToDelete.length === 0) {
          toast.info('No scheduled shifts found to delete in this range')
          setLoading(false)
          return
        }

        if (!confirm(`Are you sure you want to delete ${shiftsToDelete.length} shifts?`)) {
          setLoading(false)
          return
        }

        const idsToDelete = shiftsToDelete.map(s => s.id)
        
        const { error: deleteError } = await supabase
          .from('officer_shift_slots')
          .delete()
          .in('id', idsToDelete)
        
        if (deleteError) throw deleteError

        // Send notifications grouped by officer
        const shiftsByOfficer = shiftsToDelete.reduce((acc, shift) => {
          acc[shift.officer_id] = (acc[shift.officer_id] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        for (const [officerId, count] of Object.entries(shiftsByOfficer)) {
          await sendPushNotification(
            officerId,
            `${count} of your scheduled shifts between ${dateStrings[0]} and ${dateStrings[dateStrings.length - 1]} have been deleted by admin.`
          )
        }

        toast.success(`Deleted ${shiftsToDelete.length} shifts`)
      }

      await loadSchedules()
    } catch (err: any) {
      console.error('Error in bulk action:', err)
      toast.error(err?.message || 'Failed to perform bulk action')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSchedule = async () => {
    if (!selectedOfficer || !selectedDate || !startTime || !endTime) {
      toast.error('Please fill in all fields')
      return
    }

    if (startTime >= endTime) {
      toast.error('End time must be after start time')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('officer_shift_slots')
        .insert({
          officer_id: selectedOfficer,
          shift_date: selectedDate,
          shift_start_time: startTime,
          shift_end_time: endTime,
          status: 'scheduled'
        })

      if (error) {
        if (error.code === '23505') {
          toast.error('This officer already has a shift scheduled for this date and time')
        } else {
          throw error
        }
        return
      }

      toast.success('Schedule created successfully!')
      setSelectedOfficer('')
      setSelectedDate('')
      setStartTime('')
      setEndTime('')
      await loadSchedules()
    } catch (err: any) {
      console.error('Error creating schedule:', err)
      toast.error(err?.message || 'Failed to create schedule')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSchedule = async (scheduleId: string, status: string) => {
    if (status === 'active') {
      toast.error('Cannot delete an active shift. Officer must clock out first.')
      return
    }

    const schedule = schedules.find(s => s.id === scheduleId)
    if (!schedule) return

    if (!confirm('Are you sure you want to delete this schedule?')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('officer_shift_slots')
        .delete()
        .eq('id', scheduleId)

      if (error) throw error

      // Notify officer
      await sendPushNotification(
        schedule.officer_id,
        `Your shift on ${schedule.shift_date} (${format12hr(schedule.shift_start_time)} - ${format12hr(schedule.shift_end_time)}) has been deleted.`
      )

      toast.success('Schedule deleted successfully')
      await loadSchedules()
    } catch (err: any) {
      console.error('Error deleting schedule:', err)
      toast.error(err?.message || 'Failed to delete schedule')
    } finally {
      setLoading(false)
    }
  }

  // Get today's date for min date
  const today = new Date().toISOString().split('T')[0]

  // Group schedules by date
  const groupedSchedules = schedules.reduce((acc, schedule) => {
    const date = schedule.shift_date
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(schedule)
    return acc
  }, {} as Record<string, ScheduleSlot[]>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Calendar className="w-6 h-6 text-purple-400" />
          Create Officer Schedules
        </h2>
      </div>

      {/* Bulk Actions */}
      <div className="bg-[#1A1A1A] border border-purple-500/30 rounded-xl p-6">
        <h3 className="text-xl font-bold mb-4 text-white">Bulk Schedule Actions</h3>
        
        {/* Mode Selection */}
        <div className="flex gap-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={bulkMode === 'add'}
              onChange={() => setBulkMode('add')}
              className="text-purple-600 focus:ring-purple-600"
            />
            <span className="text-white">Add Shifts</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={bulkMode === 'delete'}
              onChange={() => setBulkMode('delete')}
              className="text-red-600 focus:ring-red-600"
            />
            <span className="text-white">Delete Shifts</span>
          </label>
        </div>

        {/* Target Selection */}
        <div className="flex gap-4 mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={bulkTarget === 'all'}
              onChange={() => setBulkTarget('all')}
              className="text-purple-600 focus:ring-purple-600"
            />
            <span className="text-gray-300">All Officers</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={bulkTarget === 'specific'}
              onChange={() => setBulkTarget('specific')}
              className="text-purple-600 focus:ring-purple-600"
            />
            <span className="text-gray-300">Specific Officer</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {bulkTarget === 'specific' && (
            <div className="md:col-span-4">
              <label className="block text-sm text-gray-400 mb-2">Select Officer</label>
              <select
                value={bulkSpecificOfficer}
                onChange={(e) => setBulkSpecificOfficer(e.target.value)}
                className="w-full bg-[#0D0D0D] border border-purple-500/40 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              >
                <option value="">Select Officer</option>
                {officers.map((officer) => (
                  <option key={officer.id} value={officer.id}>
                    {canViewEmails && officer.email ? `${officer.username} (${officer.email})` : officer.username}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-2">Start Date</label>
            <input
              type="date"
              value={autoStartDate}
              onChange={(e) => setAutoStartDate(e.target.value)}
              min={today}
              className="w-full bg-[#0D0D0D] border border-purple-500/40 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Number of Days</label>
            <input
              type="number"
              min={1}
              max={31}
              value={autoDays}
              onChange={(e) => setAutoDays(parseInt(e.target.value) || 7)}
              className="w-full bg-[#0D0D0D] border border-purple-500/40 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            />
          </div>
          
          {bulkMode === 'add' && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Start Time</label>
                <input
                  type="time"
                  value={autoStartTime}
                  onChange={(e) => setAutoStartTime(e.target.value)}
                  className="w-full bg-[#0D0D0D] border border-purple-500/40 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">End Time</label>
                <input
                  type="time"
                  value={autoEndTime}
                  onChange={(e) => setAutoEndTime(e.target.value)}
                  className="w-full bg-[#0D0D0D] border border-purple-500/40 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
              </div>
            </>
          )}
        </div>

        <button
          onClick={handleBulkAction}
          disabled={loading || officers.length === 0 || (bulkTarget === 'specific' && !bulkSpecificOfficer)}
          className={`mt-4 px-6 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 ${
            bulkMode === 'add' 
              ? 'bg-purple-600 hover:bg-purple-700 text-white' 
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          {bulkMode === 'add' ? <CheckCircle className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
          {loading 
            ? 'Processing...' 
            : `${bulkMode === 'add' ? 'Generate' : 'Delete'} for ${bulkTarget === 'all' ? 'All Officers' : 'Selected Officer'}`
          }
        </button>
        <p className="text-xs text-gray-500 mt-2">
          {bulkMode === 'add' 
            ? 'Adds shifts for selected duration. Duplicates are ignored.' 
            : 'Deletes scheduled shifts in the selected date range.'
          }
        </p>
      </div>

      {/* Create Schedule Form */}
      <div className="bg-[#1A1A1A] border border-purple-500/30 rounded-xl p-6">
        <h3 className="text-xl font-bold mb-4 text-white">Create New Schedule</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Officer</label>
            <select
              value={selectedOfficer}
              onChange={(e) => setSelectedOfficer(e.target.value)}
              className="w-full bg-[#0D0D0D] border border-purple-500/40 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            >
              <option value="">Select Officer</option>
              {officers.map((officer) => (
                <option key={officer.id} value={officer.id}>
                  {canViewEmails && officer.email ? `${officer.username} (${officer.email})` : officer.username}
                </option>
              ))}
            </select>
          </div>
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
          onClick={handleCreateSchedule}
          disabled={loading || !selectedOfficer || !selectedDate || !startTime || !endTime}
          className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {loading ? 'Creating...' : 'Create Schedule'}
        </button>
      </div>

      {/* All Schedules List */}
      <div className="bg-[#1A1A1A] border border-[#2C2C2C] rounded-xl p-6">
        <h3 className="text-xl font-bold mb-4 text-white">All Officer Schedules</h3>
        {loadingSchedules && schedules.length === 0 ? (
          <div className="text-center text-gray-400 py-8">Loading schedules...</div>
        ) : schedules.length === 0 ? (
          <div className="text-center text-gray-400 py-8">No schedules created yet</div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedSchedules).map(([date, dateSchedules]) => (
              <div key={date} className="border-b border-[#2C2C2C] pb-4 last:border-b-0 last:pb-0">
                <h4 className="text-lg font-semibold mb-3 text-purple-400">
                  {new Date(date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </h4>
                <div className="space-y-2">
                  {dateSchedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className={`bg-[#0D0D0D] border rounded-lg p-4 ${
                        schedule.status === 'active'
                          ? 'border-green-500/50 bg-green-500/10'
                          : schedule.status === 'completed'
                          ? 'border-blue-500/50 bg-blue-500/10'
                          : 'border-purple-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Clock className="w-5 h-5 text-purple-400" />
                          <div>
                            <div className="font-semibold text-white">
                              {schedule.officer ? (
                              <UserNameWithAge 
                                user={{
                                  username: schedule.officer.username,
                                  id: schedule.officer.id,
                                  created_at: schedule.officer.created_at,
                                  is_troll_officer: schedule.officer.is_troll_officer,
                                  is_admin: schedule.officer.is_admin
                                }}
                              />
                              ) : (
                              <span className="text-gray-400">Unknown Officer</span>
                              )}
                            </div>
                            <div className="text-sm text-gray-400">
                              {format12hr(schedule.shift_start_time)} - {format12hr(schedule.shift_end_time)}
                            </div>
                            <div className="text-xs text-gray-500 capitalize mt-1">
                              Status: {schedule.status}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {schedule.status === 'active' && (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold">
                              Active
                            </span>
                          )}
                          {schedule.status === 'scheduled' && (
                            <button
                              onClick={() => handleDeleteSchedule(schedule.id, schedule.status)}
                              disabled={loading}
                              className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              title="Delete schedule"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

