import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import api, { API_ENDPOINTS } from '../lib/api'
import { isPurchaseRequiredError, openPurchaseGate } from '../lib/purchaseGate'

const DEFAULT_ROOM = 'officer-stream'
const SEAT_COUNT = 9

// ✅ New: Prevent flicker after claim
const CLAIM_GRACE_MS = 2500

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

  // ✅ New refs to prevent UI flicker
  const lastClaimAtRef = useRef<number>(0)
  const lastClaimedSeatRef = useRef<number | null>(null)

  // ✅ Use stable user identity always
  const stableUserId = useMemo(() => {
    return user?.id || profile?.id || null
  }, [user?.id, profile?.id])

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
      // ✅ Fix: seat_index 0 should still count
      if (seat?.seat_index !== undefined && seat?.seat_index !== null) {
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
      const response = await api.get(API_ENDPOINTS.broadcastSeats.list, {
        params: {
          room: roomName,
        },
      })

      const { data, error: invokeError } = response

      // Only log errors, not successful responses
      if (invokeError) {
        console.error('[useSeatRoster] invoke error:', invokeError)
      }

      if (invokeError && isPurchaseRequiredError(invokeError)) {
        const message =
          typeof invokeError === 'string'
            ? invokeError
            : (invokeError as any)?.message || (invokeError as any)?.error || 'Purchase required to join seats'
        openPurchaseGate(message)
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

      const seatRows = payload.seats ?? payload.data?.seats ?? []
      const normalized = normalize(seatRows)

      // ✅ Flicker protection: ignore refresh that loses your own seat
      if (stableUserId) {
        const mySeatExistsLocally = seats.some((s) => s?.user_id === stableUserId)
        const mySeatExistsInIncoming = normalized.some((s) => s?.user_id === stableUserId)

        const withinGrace =
          lastClaimAtRef.current &&
          Date.now() - lastClaimAtRef.current < CLAIM_GRACE_MS

        if (withinGrace && mySeatExistsLocally && !mySeatExistsInIncoming) {
          console.warn('[useSeatRoster] Ignoring refresh because backend is stale (claim grace window)', {
            stableUserId,
            withinGrace,
          })
          setLoading(false)
          return
        }
      }

      setSeats(normalized)
      setError(null)
    } catch (err: any) {
      console.error('[useSeatRoster] refresh failed', err)
      if (isPurchaseRequiredError(err)) {
        const message =
          typeof err === 'string'
            ? err
            : (err as any)?.message || (err as any)?.error || 'Purchase required to join seats'
        openPurchaseGate(message)
      }
      setError(err?.message || (typeof err === 'string' ? err : 'Unable to load seats'))
    } finally {
      setLoading(false)
    }
  }, [normalize, roomName, stableUserId, seats])

  // ✅ Ref to track active subscription channel
  const subscriptionRef = useRef<boolean>(false)

  useEffect(() => {
    // ✅ Fix: Only subscribe once per roomName
    if (!user?.id || subscriptionRef.current) {
      return
    }

    const checkSessionThenSubscribe = async () => {
      // ✅ Use cached session check if possible, or single check
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.warn('[useSeatRoster] Session token not available yet')
        return
      }

      console.log('[useSeatRoster] Session verified, subscribing to seats', {
        room: roomName,
        userId: user.id
      })
      
      subscriptionRef.current = true

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
          (payload) => {
            console.log('[useSeatRoster] Seat change detected, refreshing for all users', payload)
            refresh()
          }
        )
        .subscribe((status) => {
          console.log('[useSeatRoster] Subscription status:', status)
          if (status === 'SUBSCRIBED') {
            console.log('[useSeatRoster] Successfully subscribed to seat changes')
          }
        })

      refresh()

      return () => {
        console.log('[useSeatRoster] Unsubscribing from seats', roomName)
        subscriptionRef.current = false
        supabase.removeChannel(channel)
      }
    }

    const cleanupPromise = checkSessionThenSubscribe()
    
    return () => {
      cleanupPromise.then(cleanup => cleanup && cleanup())
    }
  }, [roomName, user?.id, refresh]) // Added refresh to dependencies

  const claimSeat = useCallback(
    async (
      seatIndex: number,
      payload?: {
        user_id?: string
        username?: string
        avatarUrl?: string | null
        role?: string
        metadata?: Record<string, any>
        joinPrice?: number
      }
    ) => {
      const safeIndex = normalizeSeatIndex(seatIndex)
      setIsClaimingSeat(safeIndex)
      try {
        // ✅ Claim grace window begins now
        lastClaimAtRef.current = Date.now()
        lastClaimedSeatRef.current = safeIndex

        // Check if user already has a seat in this room
        const existingSeat = seats.find(seat => seat?.user_id === stableUserId)
        if (existingSeat) {
          throw new Error('You already have a seat in this stream. Please release your current seat first.')
        }

        const userId = payload?.user_id ?? stableUserId
        const username = payload?.username ?? profile?.username ?? user?.email?.split('@')[0] ?? 'Officer'
        const role = payload?.role ?? profile?.role ?? 'troll_officer'
        const avatar_url = payload?.avatarUrl ?? profile?.avatar_url ?? null
        const metadata = payload?.metadata ?? {}
        const joinPrice = payload?.joinPrice ?? 0

        // Handle coin deduction if there's a join price
        if (joinPrice > 0 && userId) {
          try {
            const { deductCoins } = await import('../lib/coinTransactions')
            const deductionResult = await deductCoins({
              userId: userId,
              amount: joinPrice,
              type: 'perk_purchase',
              description: `Joined seat ${safeIndex + 1} in broadcast`,
              metadata: {
                seatIndex: safeIndex + 1,
                room: roomName,
                ...metadata
              }
            })

            if (!deductionResult.success) {
              throw new Error(deductionResult.error || 'Failed to deduct coins for seat join')
            }
          } catch (coinError) {
            console.error('Failed to deduct coins for seat join:', coinError)
            throw new Error(`Failed to deduct coins: ${coinError instanceof Error ? coinError.message : 'Unknown error'}`)
          }
        }

        const response = await api.request(API_ENDPOINTS.broadcastSeats.action, {
          method: 'POST',
          body: JSON.stringify({
            action: 'claim',
            room: roomName,
            seat_index: safeIndex + 1,
            user_id: userId,
            username,
            avatar_url,
            role,
            metadata,
          }),
        })

        const { data, error: invokeError } = response

        // Only log errors
        if (invokeError) {
          console.error('[useSeatRoster] claim invoke error:', invokeError)
        }

        if (invokeError && isPurchaseRequiredError(invokeError)) {
          const message =
            typeof invokeError === 'string'
              ? invokeError
              : (invokeError as any)?.message || (invokeError as any)?.error || 'Purchase required to claim seat'
          openPurchaseGate(message)
        }

        if (invokeError) {
          throw invokeError
        }

        const claimResult: any = data

        if (!claimResult?.success) {
          throw new Error(claimResult?.error || 'Seat claim failed')
        }

        const seat = claimResult?.seat
        const created = claimResult?.created ?? false
        const isOwner = claimResult?.is_owner ?? false

        if (!seat) {
          throw new Error('Seat claim returned no data')
        }

        if (!created && !isOwner) {
          throw new Error('Seat already occupied')
        }

        // ✅ Optimistic update: Update local state immediately
        setSeats(prev => {
          const newSeats = [...prev]
          if (seat.seat_index && seat.seat_index > 0 && seat.seat_index <= newSeats.length) {
            newSeats[seat.seat_index - 1] = seat
          }
          return newSeats
        })

        return seat
      } catch (err: any) {
        if (isPurchaseRequiredError(err)) {
          const message =
            typeof err === 'string'
              ? err
              : (err as any)?.message || (err as any)?.error || 'Purchase required to claim seat'
          openPurchaseGate(message)
        }
        throw err
      } finally {
        setIsClaimingSeat(null)
      }
    },
    [normalizeSeatIndex, profile, user, roomName, seats, stableUserId]
  )

  const releaseSeat = useCallback(
    async (
      seatIndex: number,
      userId?: string,
      options?: { force?: boolean; banMinutes?: number | null; banPermanent?: boolean }
    ) => {
      const safeIndex = normalizeSeatIndex(seatIndex)
      const targetUserId = userId ?? stableUserId
      if (!targetUserId) {
        console.warn('[useSeatRoster] releaseSeat skipped, missing userId')
        return
      }

      try {
        const response = await api.request(API_ENDPOINTS.broadcastSeats.action, {
          method: 'POST',
          body: JSON.stringify({
            action: 'release',
            room: roomName,
            seat_index: safeIndex + 1,
            user_id: targetUserId,
            force: Boolean(options?.force),
            ...(typeof options?.banMinutes === 'number' && options.banMinutes > 0
              ? { ban_minutes: options.banMinutes }
              : {}),
            ...(options?.banPermanent ? { ban_permanent: true } : {}),
          }),
        })

        const { error: invokeError } = response

        // Only log errors
        if (invokeError) {
          console.error('[useSeatRoster] release invoke error:', invokeError)
        }

        if (invokeError) {
          throw invokeError
        }

        // ✅ Optimistic update: Clear the seat locally immediately
        setSeats(prev => {
          const newSeats = [...prev]
          if (safeIndex >= 0 && safeIndex < newSeats.length) {
            newSeats[safeIndex] = null
          }
          return newSeats
        })

        // ✅ Reset claim tracking refs
        lastClaimAtRef.current = 0
        lastClaimedSeatRef.current = null

      } catch (err) {
        console.warn('[useSeatRoster] releaseSeat failed', err)
      }
    },
    [normalizeSeatIndex, stableUserId, roomName]
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
