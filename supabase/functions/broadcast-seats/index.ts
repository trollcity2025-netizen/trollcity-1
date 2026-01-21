import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"
import { getPurchaseErrorStatus, PURCHASE_REQUIRED_MESSAGE } from "../_shared/purchaseGate.ts"

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  throw new Error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY")
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface AuthorizedProfile {
  id: string
  username: string
  role: string
  avatar_url?: string | null
  is_admin?: boolean
  is_lead_officer?: boolean
  is_troll_officer?: boolean
  is_broadcaster?: boolean
  has_paid?: boolean
}

async function authorizeUser(req: Request): Promise<AuthorizedProfile> {
  const authHeader = req.headers.get("authorization") ?? ""
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.error("[broadcast-seats] Missing auth header")
    throw new Error("Missing auth token")
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()

  if (userError || !user) {
    console.error("[broadcast-seats] Auth lookup failed:", userError?.message)
    throw new Error("Unable to verify session")
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id, username, role, avatar_url, is_admin, is_lead_officer, is_troll_officer, is_broadcaster, has_paid, troll_coins")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    console.error("[broadcast-seats] Profile lookup failed:", profileError?.message)
    throw new Error("Profile not found")
  }

  const hasElevatedAccess = Boolean(profile.is_admin || profile.is_lead_officer)
  const hasTrollCoins = Number(profile.troll_coins || 0) > 0

  if (!hasElevatedAccess && !profile.has_paid && !hasTrollCoins) {
    const err = new Error(PURCHASE_REQUIRED_MESSAGE)
    ;(err as any).status = 403
    throw err
  }

  return profile as AuthorizedProfile
}

type SeatActionRequest = {
  action?: "list" | "claim" | "release"
  room?: string
  seat_index?: number | string
  username?: string
  avatar_url?: string | null
  role?: string
  metadata?: Record<string, any>
  force?: boolean
}

const ROOM_NAME = "officer-stream"
const MAX_SEATS = 6

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const profile = await authorizeUser(req)
    const body: SeatActionRequest = req.method === "GET"
      ? {}
      : await req.json().catch(() => ({} as SeatActionRequest))
    const action = body.action || "list"
    const room = String(body.room ?? ROOM_NAME)
    const seatIndex = Number(body.seat_index)

    if (!room) {
      return new Response(
        JSON.stringify({ error: "Missing room" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      )
    }

    if ([ "claim", "release" ].includes(action)) {
      if (!Number.isInteger(seatIndex) || seatIndex < 1 || seatIndex > MAX_SEATS) {
        return new Response(
          JSON.stringify({ error: "Invalid seat index" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        )
      }
    }

    if (action === "list") {
      const { data: seats, error } = await supabase
        .from("broadcast_seats")
        .select("*")
        .eq("room", room)

      if (error) {
        console.error("[broadcast-seats] list error:", error)
        return new Response(
          JSON.stringify({ error: error.message, seats: [] }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        )
      }

      return new Response(
        JSON.stringify({ success: true, seats: seats || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (action === "claim") {
      // Check for active guest box ban before claiming
      try {
        const { data: banRow, error: banError } = await supabase
          .from("broadcast_seat_bans")
          .select("banned_until")
          .eq("room", room)
          .eq("user_id", profile.id)
          .maybeSingle()

        if (banError) {
          console.warn("[broadcast-seats] ban check error:", banError)
        } else if (banRow) {
          const bannedUntil = banRow.banned_until ? new Date(banRow.banned_until) : null
          const now = new Date()
          if (!bannedUntil || bannedUntil > now) {
            return new Response(
              JSON.stringify({
                error: "You are temporarily restricted from joining the guest box.",
                banned_until: banRow.banned_until,
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 403,
              }
            )
          }
        }
      } catch (banErr) {
        console.warn("[broadcast-seats] ban check exception:", banErr)
      }

      const { data, error } = await supabase.rpc("claim_broadcast_seat", {
        p_room: room,
        p_seat_index: seatIndex,
        p_user_id: profile.id,
        p_username: body.username ?? profile.username,
        p_avatar_url: body.avatar_url ?? profile.avatar_url ?? null,
        p_role: body.role ?? profile.role,
        p_metadata: body.metadata ?? {},
      })

      if (error) {
        console.error("[broadcast-seats] claim error:", error)
        return new Response(
          JSON.stringify({ error: error.message }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        )
      }

      const seat = data?.[0]
      if (!seat) {
        return new Response(
          JSON.stringify({ error: "Failed to claim seat" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          seat,
          created: seat.created,
          is_owner: seat.is_owner,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (action === "release") {
      const { data, error } = await supabase.rpc("release_broadcast_seat", {
        p_room: room,
        p_seat_index: seatIndex,
        p_user_id: profile.id,
        p_force: Boolean(body.force),
      })

      if (error) {
        console.error("[broadcast-seats] release error:", error)
        return new Response(
          JSON.stringify({ error: error.message }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        )
      }

      const banMinutes =
        typeof body.ban_minutes === "number" && body.ban_minutes > 0
          ? body.ban_minutes
          : null
      const banPermanent = Boolean(body.ban_permanent)

      if (banMinutes || banPermanent) {
        const bannedUntil = banPermanent
          ? null
          : new Date(Date.now() + (banMinutes as number) * 60 * 1000).toISOString()

        try {
          await supabase
            .from("broadcast_seat_bans")
            .upsert(
              {
                room,
                user_id: profile.id,
                banned_until: bannedUntil,
                created_by: profile.id,
              },
              { onConflict: "room,user_id" }
            )
        } catch (banErr) {
          console.error("[broadcast-seats] failed to record seat ban:", banErr)
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          seat: data?.[0] ?? null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    )
  } catch (error: any) {
    console.error("[broadcast-seats] error:", error)
    const status = getPurchaseErrorStatus(error)
    return new Response(
      JSON.stringify({ error: error?.message || "Internal server error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      }
    )
  }
})
