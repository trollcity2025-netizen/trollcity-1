import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { toast } from 'sonner'
import { Calendar, Clock, User, Plus, Trash2, CheckCircle } from 'lucide-react'
import ClickableUsername from '../../../components/ClickableUsername'

interface Officer {
  id: string
  username: string
  email: string
  is_troll_officer: boolean
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
  const [officers, setOfficers] = useState<Officer[]>([])
  const [selectedOfficer, setSelectedOfficer] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingSchedules, setLoadingSchedules] = useState(true)

  // Load all troll officers (exclude admins - they don't need shifts)
  const loadOfficers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, email, is_troll_officer, role, is_admin')
        .or('is_troll_officer.eq.true,role.eq.troll_officer')
        .neq('role', 'admin')  // Exclude admins from shift scheduling
        .eq('is_admin', false)  // Also exclude by is_admin flag
        .order('username', { ascending: true })

      if (error) throw error

      // Filter out any admins that might have slipped through
      const filteredOfficers = (data as any)?.filter((o: any) => 
        o.role !== 'admin' && !o.is_admin
      ) || []

      setOfficers(filteredOfficers)
    } catch (err: any) {
      console.error('Error loading officers:', err)
      toast.error('Failed to load officers')
    }
  }

  // Load all schedules
  const loadSchedules = async () => {
    setLoadingSchedules(true)
    try {
      const { data, error } = await supabase
        .from('officer_shift_slots')
        .select(`
          *,
          officer:user_profiles!officer_shift_slots_officer_id_fkey(
            id,
            username,
            email,
            is_troll_officer
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
  }

  useEffect(() => {
    loadOfficers()
    loadSchedules()

    // Subscribe to real-time updates
    const channel = supabase
      .channel('officer_schedules_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'officer_shift_slots'
        },
        () => {
          loadSchedules()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

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

    if (!confirm('Are you sure you want to delete this schedule?')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('officer_shift_slots')
        .delete()
        .eq('id', scheduleId)

      if (error) throw error

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
                  {officer.username} ({officer.email})
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
                                <ClickableUsername username={schedule.officer.username} />
                              ) : (
                                <span className="text-gray-400">Unknown Officer</span>
                              )}
                            </div>
                            <div className="text-sm text-gray-400">
                              {schedule.shift_start_time} - {schedule.shift_end_time}
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

