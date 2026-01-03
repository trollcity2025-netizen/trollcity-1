import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'

const DEFAULT_ROOM = 'officer-stream'
const SEAT_COUNT = 9

export type SeatAssignment = {
  room: string
  seat_index: number
  user_id: string
  username: string
  avatar_url?: string | null
  role: string
  metadata?: Record<string, any>
  assigned_at: string
} | null

export function useSeatRoster(roomName: string = DEFAULT_ROOM) {
  const { user, profile } = useAuthStore()
  const [seats, setSeats] = useState<SeatAssignment[]>(Array(SEAT_COUNT).fill(null))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isClaimingSeat, setIsClaimingSeat] = useState<number | null>(null)
  const normalizeSeatIndex = useCallback((value: number) => {
    const requested = Number.isFinite(value) ? Math.floor(value) : 0
    const clamped = Math.min(Math.max(requested, 0), SEAT_COUNT - 1)
    if (clamped !== requested || requested !== value) {
      console.warn('[useSeatRoster] Seat index out of range, clamping', {
        requestedValue: value,
        normalized: clamped,
      })
    }
    return clamped
  }, [])

  const normalize = useCallback((data: any[]): SeatAssignment[] => {
    const map = new Map<number, any>()
    data?.forEach((seat) => {
      if (seat?.seat_index) {
        map.set(Number(seat.seat_index), seat)
      }
    })
    return Array.from({ length: SEAT_COUNT }, (_, index) => {
      const entry = map.get(index + 1)
      if (!entry) return null
      return {
        room: entry.room,
        seat_index: entry.seat_index,
        user_id: entry.user_id,
        username: entry.username,
        avatar_url: entry.avatar_url,
        role: entry.role,
        metadata: entry.metadata,
        assigned_at: entry.assigned_at,
      }
    })
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('broadcast-seats', {
        body: {
          action: 'list',
          room: roomName,
        },
      })

      // Only log errors, not successful responses
      if (invokeError) {
        console.error('[useSeatRoster] invoke error:', invokeError)
      }

      if (invokeError) {
        throw invokeError
      }

      const payload: any = data

      if (!payload) {
        throw new Error('No response payload from broadcast-seats')
      }

      if (payload.success === false) {
        throw new Error(payload.error || 'broadcast-seats failed')
      }

      const seats = payload.seats ?? payload.data?.seats ?? []
      setSeats(normalize(seats))
      setError(null)
    } catch (err: any) {
      console.error('[useSeatRoster] refresh failed', err)
      setError(err?.message || 'Unable to load seats')
    } finally {
      setLoading(false)
    }
  }, [normalize, roomName])

  useEffect(() => {
    if (!user?.id) {
      console.log('[useSeatRoster] Waiting for auth...')
      return
    }

    const checkSessionThenSubscribe = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.warn('[useSeatRoster] Session token not available yet', {
          hasSession: !!session,
          hasToken: !!session?.access_token,
          userId: user?.id,
        })
        return
      }

      console.log('[useSeatRoster] Session verified, subscribing to seats', {
        userId: user?.id,
        tokenLength: session.access_token.length,
      })

      const channel = supabase
      .channel(`broadcast-seats-${roomName}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'broadcast_seats',
          filter: `room=eq.${roomName}`,
        },
        () => {
          refresh()
        }
      )
      .subscribe()

      refresh()

      return () => {
        channel.unsubscribe()
      }
    }

    checkSessionThenSubscribe()
  }, [roomName, user?.id, refresh])

  const claimSeat = useCallback(
    async (
      seatIndex: number,
      payload?: {
        user_id?: string
        username?: string
        avatarUrl?: string | null
        role?: string
        metadata?: Record<string, any>
      }
    ) => {
      const safeIndex = normalizeSeatIndex(seatIndex)
      setIsClaimingSeat(safeIndex)
      try {
        // Check if user already has a seat in this room
        const existingSeat = seats.find(seat => seat?.user_id === user?.id)
        if (existingSeat) {
          throw new Error('You already have a seat in this stream. Please release your current seat first.')
        }

        const userId = payload?.user_id ?? user?.id
        const username = payload?.username ?? profile?.username ?? user?.email?.split('@')[0] ?? 'Officer'
        const role = payload?.role ?? profile?.role ?? 'troll_officer'
        const avatar_url = payload?.avatarUrl ?? profile?.avatar_url ?? null
        const metadata = payload?.metadata ?? {}

        const { data, error: invokeError } = await supabase.functions.invoke('broadcast-seats', {
          body: {
            action: 'claim',
            room: roomName,
            seat_index: safeIndex + 1,
            user_id: userId,
            username,
            avatar_url,
            role,
            metadata,
          },
        })

        // Only log errors
        if (invokeError) {
          console.error('[useSeatRoster] claim invoke error:', invokeError)
        }

        if (invokeError) {
          throw invokeError
        }

        const response: any = data

        if (!response?.success) {
          throw new Error(response?.error || 'Seat claim failed')
        }

        const seat = response?.seat
        const created = response?.created ?? false
        const isOwner = response?.is_owner ?? false

        if (!seat) {
          throw new Error('Seat claim returned no data')
        }

        if (!created && !isOwner) {
          throw new Error('Seat already occupied')
        }

        refresh()
        return seat
      } finally {
        setIsClaimingSeat(null)
      }
    },
    [refresh, normalizeSeatIndex, profile, user, roomName, seats]
  )

  const releaseSeat = useCallback(
    async (seatIndex: number, userId?: string, options?: { force?: boolean }) => {
      const safeIndex = normalizeSeatIndex(seatIndex)
      const targetUserId = userId ?? user?.id
      if (!targetUserId) {
        console.warn('[useSeatRoster] releaseSeat skipped, missing userId')
        return
      }
      try {
        const { data, error: invokeError } = await supabase.functions.invoke('broadcast-seats', {
          body: {
            action: 'release',
            room: roomName,
            seat_index: safeIndex + 1,
            user_id: targetUserId,
            force: Boolean(options?.force),
          },
        })

        // Only log errors
        if (invokeError) {
          console.error('[useSeatRoster] release invoke error:', invokeError)
        }

        if (invokeError) {
          throw invokeError
        }

        refresh()
      } catch (err) {
        console.warn('[useSeatRoster] releaseSeat failed', err)
      }
    },
    [refresh, normalizeSeatIndex, user, roomName]
  )

  const currentOccupants = useMemo(
    () => seats.filter((seat): seat is NonNullable<SeatAssignment> => Boolean(seat)),
    [seats]
  )

  return {
    seats,
    seatsLoading: loading,
    seatsError: error,
    refreshSeats: refresh,
    claimSeat,
    releaseSeat,
    currentOccupants,
    isClaimingSeat,
  }
}
