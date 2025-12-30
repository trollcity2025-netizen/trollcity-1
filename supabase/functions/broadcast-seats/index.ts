import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

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
    .select("id, username, role, avatar_url, is_admin, is_lead_officer, is_troll_officer, is_broadcaster")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    console.error("[broadcast-seats] Profile lookup failed:", profileError?.message)
    throw new Error("Profile not found")
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
    return new Response(
      JSON.stringify({ error: error?.message || "Internal server error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})
