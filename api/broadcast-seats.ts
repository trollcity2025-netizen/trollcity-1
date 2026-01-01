import { authorizeOfficer, supabaseAdmin } from './_shared/auth'

const ROOM_NAME = 'officer-stream'
const SEAT_COUNT = 6

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

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  let profile
  try {
    profile = await authorizeOfficer(req)
  } catch (error: any) {
    const message = error?.message || 'Unauthorized'
    return res.status(403).json({ error: message })
  }

  const room = String((req.method === 'GET' ? req.query?.room : req.body?.room) ?? ROOM_NAME)

  if (req.method === 'GET') {
    return fetchSeats(res, room)
  }

  // POST: claim/release actions
  return handleAction(req, res, room, profile)
}

async function fetchSeats(res: any, room: string) {
  const { data, error } = await supabaseAdmin
    .from('broadcast_seats')
    .select(
      'room, seat_index, user_id, username, avatar_url, role, metadata, assigned_at'
    )
    .eq('room', room)
    .order('seat_index', { ascending: true })

  if (error) {
    console.error('[broadcast-seats] Fetch error', error)
    return res.status(500).json({ error: 'Unable to load seats' })
  }

  const seatMap = new Map<number, any>()
  data?.forEach((seat: any) => seatMap.set(seat.seat_index, seat))
  const seats = Array.from({ length: SEAT_COUNT }, (_, index) => seatMap.get(index + 1) || null)

  return res.status(200).json({ seats })
}

async function handleAction(req: any, res: any, room: string, profile: any) {
  const payload: SeatPayload = req.body || {}
  const seatIndex = Number(payload.seat_index)
  if (!seatIndex || seatIndex < 1 || seatIndex > SEAT_COUNT) {
    return res.status(400).json({ error: 'Invalid seat index' })
  }

  const action = String(payload.action || 'claim')

  try {
    if (action === 'claim') {
      const response = await supabaseAdmin.rpc('claim_broadcast_seat', {
        p_room: room,
        p_seat_index: seatIndex,
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
        return res.status(409).json({
          error: 'Seat already occupied',
          seat: result,
          occupiedBy: result.user_id,
        })
      }

      return res.status(200).json({
        seat: sanitizeSeat(result),
        created: result.created,
        is_owner: result.is_owner,
      })
    }

    if (action === 'release') {
      const response = await supabaseAdmin.rpc('release_broadcast_seat', {
        p_room: room,
        p_seat_index: seatIndex,
        p_user_id: payload.user_id ?? profile.id,
        p_force: Boolean(payload.force),
      })

      const result = (response.data as any)?.[0]
      if (!result) {
        return res.status(200).json({ seat: null })
      }

      return res.status(200).json({ seat: sanitizeSeat(result) })
    }

    return res.status(400).json({ error: 'Unsupported action' })
  } catch (error: any) {
    console.error('[broadcast-seats] action error', error)
    return res.status(500).json({ error: error?.message || 'Seat action failed' })
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
