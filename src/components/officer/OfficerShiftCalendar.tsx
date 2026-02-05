import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Calendar } from 'lucide-react'
import { format12hr } from '../../utils/timeFormat'

interface ShiftSlotRow {
  id: string
  officer_id: string | null
  shift_date: string
  shift_start_time: string
  shift_end_time: string
  status: string
  slot_status: string
  user_profiles?: {
    username?: string | null
    avatar_url?: string | null
  } | null
}

interface OfficerShiftCalendarProps {
  title?: string
  daysAhead?: number
}

const toDateKey = (value: string) => value

const formatDayLabel = (value: string) => {
  const date = new Date(`${value}T00:00:00`)
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

const formatTime = (value: string) => format12hr(value)

export default function OfficerShiftCalendar({ title = 'Officer Shift Calendar', daysAhead = 30 }: OfficerShiftCalendarProps) {
  const [loading, setLoading] = useState(true)
  const [slots, setSlots] = useState<ShiftSlotRow[]>([])

  const dateRange = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + daysAhead)
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    }
  }, [daysAhead])

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('officer_shift_slots')
        .select('id, officer_id, shift_date, shift_start_time, shift_end_time, status, slot_status, user_profiles:officer_id (username, avatar_url)')
        .gte('shift_date', dateRange.start)
        .lte('shift_date', dateRange.end)
        .order('shift_date', { ascending: true })
        .order('shift_start_time', { ascending: true })

      if (!isMounted) return

      if (error) {
        console.error('Failed to load shift slots:', error)
        setSlots([])
      } else {
        setSlots((data as ShiftSlotRow[]) || [])
      }
      setLoading(false)
    }

    load()

    return () => {
      isMounted = false
    }
  }, [dateRange])

  const grouped = useMemo(() => {
    const map = new Map<string, ShiftSlotRow[]>()
    slots.forEach((slot) => {
      const key = toDateKey(slot.shift_date)
      const list = map.get(key) || []
      list.push(slot)
      map.set(key, list)
    })
    return map
  }, [slots])

  return (
    <div className={`rounded-2xl ${trollCityTheme.borders.glass} ${trollCityTheme.backgrounds.card} p-6`}>
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-purple-300" />
        <h2 className={`text-lg font-semibold ${trollCityTheme.text.primary}`}>{title}</h2>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">Loading shifts…</div>
      ) : slots.length === 0 ? (
        <div className="text-sm text-slate-500">No shifts scheduled in the next {daysAhead} days.</div>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([date, daySlots]) => (
            <div key={date} className="border border-slate-800 rounded-xl p-4">
              <div className="text-sm font-semibold text-slate-200 mb-3">{formatDayLabel(date)}</div>
              <div className="space-y-2">
                {daySlots.map((slot) => (
                  <div key={slot.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="text-slate-300">
                      {formatTime(slot.shift_start_time)} - {formatTime(slot.shift_end_time)}
                    </div>
                    <div className="text-slate-400">
                      {slot.user_profiles?.username || 'Unassigned'}
                    </div>
                    <div className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-300">
                      {slot.status || slot.slot_status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
