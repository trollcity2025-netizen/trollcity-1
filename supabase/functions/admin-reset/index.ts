// supabase/functions/admin-reset/index.ts
// Admin-only reset and maintenance tools
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withCors, handleCorsPreflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

interface ResetAction {
  action: 'reset_test_data' | 'reset_live_streams' | 'reset_coin_balances';
  [key: string]: any;
}

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight();
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return withCors({ error: "Missing authorization" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return withCors({ error: "Invalid user" }, 401);
    }

    // Verify admin
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin, role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.is_admin || profile?.role === 'admin';
    if (!isAdmin) {
      return withCors({ error: "Admin only" }, 403);
    }

    const body: ResetAction = await req.json().catch(() => ({}));
    const { action } = body;

    switch (action) {
      case 'reset_test_data': {
        // Delete test data
        const tables = [
          'streams_participants',
          'battles',
          'troll_event_claims',
          'troll_events',
          'gifts',
          'chat_messages',
        ];

        const results: Record<string, number> = {};

        for (const table of tables) {
          const { count } = await supabase
            .from(table)
            .select("*", { count: 'exact', head: true });

          const { error: deleteError } = await supabase
            .from(table)
            .delete()
            .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

          results[table] = count || 0;
        }

        // Optionally delete test users
        const { data: testUsers } = await supabase
          .from("user_profiles")
          .select("id")
          .or("email.ilike.%@example.com,email.ilike.%@test.com");

        if (testUsers && testUsers.length > 0) {
          // Note: This will cascade delete related data
          const { error: deleteUsersError } = await supabase
            .from("user_profiles")
            .delete()
            .in("id", testUsers.map(u => u.id));

          results.test_users = testUsers.length;
        }

        return withCors({ success: true, deleted: results }, 200);
      }

      case 'reset_live_streams': {
        // End all live streams
        const { data: liveStreams } = await supabase
          .from("streams")
          .select("id")
          .eq("is_live", true);

        const streamIds = liveStreams?.map(s => s.id) || [];

        if (streamIds.length === 0) {
          return withCors({ streams_ended: 0 }, 200);
        }

        const { error: updateError } = await supabase
          .from("streams")
          .update({
            is_live: false,
            ended_at: new Date().toISOString(),
          })
          .in("id", streamIds);

        if (updateError) {
          return withCors({ error: updateError.message }, 400);
        }

        // Mark participants inactive
        await supabase
          .from("streams_participants")
          .update({
            is_active: false,
            left_at: new Date().toISOString(),
          })
          .in("stream_id", streamIds)
          .eq("is_active", true);

        return withCors({ streams_ended: streamIds.length }, 200);
      }

      case 'reset_coin_balances': {
        // Reset all non-admin user coin balances
        const { data: nonAdminUsers } = await supabase
          .from("user_profiles")
          .select("id")
          .or("is_admin.is.null,is_admin.eq.false")
          .neq("role", "admin");

        if (!nonAdminUsers || nonAdminUsers.length === 0) {
          return withCors({ users_reset: 0 }, 200);
        }

        const { error: updateError } = await supabase
          .from("user_profiles")
          .update({
            paid_coin_balance: 0,
            free_coin_balance: 0,
            total_earned_coins: 0,
          })
          .in("id", nonAdminUsers.map(u => u.id));

        if (updateError) {
          return withCors({ error: updateError.message }, 400);
        }

        return withCors({ users_reset: nonAdminUsers.length }, 200);
      }

      default:
        return withCors({ error: "Invalid action" }, 400);
    }
  } catch (e) {
    console.error("Admin reset error:", e);
    return withCors({ error: "Internal error" }, 500);
  }
};

Deno.serve(handler);

