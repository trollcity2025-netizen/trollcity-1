import { authorizeUser, supabaseAdmin } from './_shared/auth'

const ROOM_NAME = 'officer-stream'
const SEAT_COUNT = 6
const STALE_SEAT_MINUTES = 3

type SeatPayload = {
  seat_index: number
  action?: 'claim' | 'release'
  room?: string
  username?: string
  avatar_url?: string | null
  role?: string
  metadata?: Record<string, any>
  user_id?: string
  force?: boolean
}

function normalizeRoom(input: any) {
  try {
    const value = String(input ?? '').trim().toLowerCase()
    const safe = value.replace(/[^a-z0-9_-]/g, '')
    if (!safe) {
      return ROOM_NAME
    }
    return safe
  } catch {
    return ROOM_NAME
  }
}

async function cleanupStaleSeats(room: string) {
  try {
    const cutoff = new Date(Date.now() - STALE_SEAT_MINUTES * 60 * 1000).toISOString()
    const { data, error } = await supabaseAdmin
      .from('broadcast_seats')
      .delete()
      .eq('room', room)
      .lt('assigned_at', cutoff)
      .neq('metadata->>permanent', 'true')
      .select('seat_index')

    if (error) {
      console.warn('[broadcast-seats] cleanup error', error)
      return
    }

    const count = Array.isArray(data) ? data.length : 0
    if (count > 0) {
      console.log('[broadcast-seats] cleanup', { room, count })
    }
  } catch (err) {
    console.warn('[broadcast-seats] cleanup exception', err)
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    const server_time = new Date().toISOString()
    return res.status(405).json({ error: 'Method Not Allowed', server_time })
  }

  let profile
  try {
    profile = await authorizeUser(req)
  } catch (error: any) {
    const message = error?.message || 'Unauthorized'
    const server_time = new Date().toISOString()
    return res.status(403).json({ error: message, server_time })
  }

  const rawRoom = req.method === 'GET' ? req.query?.room : req.body?.room
  const room = normalizeRoom(rawRoom)

  if (req.method === 'GET') {
    return fetchSeats(res, room)
  }

  return handleAction(req, res, room, profile)
}

async function fetchSeats(res: any, room: string) {
  await cleanupStaleSeats(room)

  const { data, error } = await supabaseAdmin
    .from('broadcast_seats')
    .select(
      'room, seat_index, user_id, username, avatar_url, role, metadata, assigned_at'
    )
    .eq('room', room)
    .order('seat_index', { ascending: true })

  if (error) {
    console.error('[broadcast-seats] Fetch error', error)
    const server_time = new Date().toISOString()
    return res.status(500).json({ error: 'Unable to load seats', room, server_time })
  }

  const seatMap = new Map<number, any>()
  if (Array.isArray(data)) {
    data.forEach((seat: any) => {
      if (seat && typeof seat.seat_index === 'number') {
        seatMap.set(seat.seat_index, seat)
      }
    })
  }

  const hasZeroIndex = Array.isArray(data) ? data.some((seat: any) => seat?.seat_index === 0) : false

  const seats = Array.from({ length: SEAT_COUNT }, (_, index) => {
    if (hasZeroIndex) {
      return seatMap.get(index) || null
    }
    return seatMap.get(index + 1) || null
  })

  const server_time = new Date().toISOString()
  return res.status(200).json({ room, seats, server_time })
}

async function handleAction(req: any, res: any, room: string, profile: any) {
  const payload: SeatPayload = req.body || {}
  const seatIndexNumber = Number(payload.seat_index)
  if (!Number.isInteger(seatIndexNumber) || seatIndexNumber < 1 || seatIndexNumber > SEAT_COUNT) {
    const server_time = new Date().toISOString()
    return res.status(400).json({ error: 'Invalid seat index', room, server_time })
  }

  const action = String(payload.action || 'claim')
  if (action !== 'claim' && action !== 'release') {
    const server_time = new Date().toISOString()
    return res.status(400).json({ error: 'Invalid action', room, server_time })
  }

  try {
    if (action === 'claim') {
      const response = await supabaseAdmin.rpc('claim_broadcast_seat', {
        p_room: room,
        p_seat_index: seatIndexNumber,
        p_user_id: profile.id,
        p_username: payload.username ?? profile.username,
        p_avatar_url: payload.avatar_url ?? profile.avatar_url,
        p_role: payload.role ?? profile.role,
        p_metadata: payload.metadata ?? {},
      })

      const result = (response.data as any)?.[0]
      if (!result) {
        throw new Error('Unable to claim seat')
      }

      if (!result.created && !result.is_owner) {
        const server_time = new Date().toISOString()
        console.log(
          `[broadcast-seats] claim room=${room} seat=${result.seat_index} user=${result.user_id} conflict`
        )
        return res.status(409).json({
          error: 'Seat already occupied',
          seat: sanitizeSeat(result),
          occupiedBy: result.user_id,
          occupiedByUsername: result.username || null,
          room,
          server_time,
        })
      }

      const server_time = new Date().toISOString()
      console.log(
        `[broadcast-seats] claim room=${room} seat=${result.seat_index} user=${result.user_id} ok`
      )
      return res.status(200).json({
        seat: sanitizeSeat(result),
        created: result.created,
        is_owner: result.is_owner,
        room,
        server_time,
      })
    }

    if (action === 'release') {
      const isForce = Boolean(payload.force)
      if (isForce) {
        const role = String(profile.role || '')
        const allowedRoles = ['admin', 'lead_troll_officer', 'troll_officer']
        if (!allowedRoles.includes(role)) {
          const server_time = new Date().toISOString()
          return res.status(403).json({ error: 'Forbidden', room, server_time })
        }
      }

      const userId = payload.user_id ?? profile.id

      const response = await supabaseAdmin.rpc('release_broadcast_seat', {
        p_room: room,
        p_seat_index: seatIndexNumber,
        p_user_id: userId,
        p_force: isForce,
      })

      const result = (response.data as any)?.[0]
      const server_time = new Date().toISOString()

      if (!result) {
        console.log(
          `[broadcast-seats] release room=${room} seat=${seatIndexNumber} user=${userId} ok`
        )
        return res.status(200).json({ seat: null, room, server_time })
      }

      console.log(
        `[broadcast-seats] release room=${room} seat=${result.seat_index} user=${result.user_id} ok`
      )
      return res.status(200).json({ seat: sanitizeSeat(result), room, server_time })
    }

    const server_time = new Date().toISOString()
    return res.status(400).json({ error: 'Unsupported action', room, server_time })
  } catch (error: any) {
    console.error('[broadcast-seats] action error', error)
    const server_time = new Date().toISOString()
    return res.status(500).json({ error: error?.message || 'Seat action failed', room, server_time })
  }
}

function sanitizeSeat(raw: any) {
  return {
    seat_index: raw.seat_index,
    room: raw.room,
    user_id: raw.user_id,
    username: raw.username,
    avatar_url: raw.avatar_url,
    role: raw.role,
    metadata: raw.metadata,
    assigned_at: raw.assigned_at,
  }
}
