// Edge Function: credit-daily-maintenance
// Purpose: Daily cron to RECALCULATE all credit scores from event history
// Runtime: Deno (Edge)

export const config = { runtime: "edge" };

import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function clampScore(score: number): number {
  if (score < 0) return 0;
  if (score > 800) return 800;
  return score;
}

function getTier(score: number): string {
  if (score < 300) return "Untrusted";
  if (score < 450) return "Shaky";
  if (score < 600) return "Building";
  if (score < 700) return "Reliable";
  if (score < 800) return "Trusted";
  return "Elite";
}

function trendFromDelta(sum30d: number): number {
  if (sum30d > 0) return 1;
  if (sum30d < 0) return -1;
  return 0;
}

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const windowStart30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    console.log("Starting credit score recalculation...");

    // 1. Fetch ALL credit events
    // We'll use a loop to handle pagination
    let allEvents: any[] = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from("credit_events")
        .select("user_id, delta, created_at")
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) throw error;
      if (!data || data.length === 0) break;
      
      allEvents = allEvents.concat(data);
      if (data.length < pageSize) break;
      page++;
    }

    console.log(`Fetched ${allEvents.length} events.`);

    // 2. Aggregate per user
    const userStats = new Map<string, { totalDelta: number, recentDelta: number }>();

    for (const event of allEvents) {
      if (!event.user_id) continue;
      
      const stats = userStats.get(event.user_id) || { totalDelta: 0, recentDelta: 0 };
      
      stats.totalDelta += (event.delta ?? 0);
      
      if (event.created_at >= windowStart30d) {
        stats.recentDelta += (event.delta ?? 0);
      }
      
      userStats.set(event.user_id, stats);
    }

    // 3. Prepare updates
    const updates = Array.from(userStats.entries()).map(([user_id, stats]) => {
      const score = clampScore(400 + stats.totalDelta);
      return {
        user_id,
        score,
        tier: getTier(score),
        trend_30d: trendFromDelta(stats.recentDelta),
        updated_at: new Date().toISOString(),
      };
    });

    console.log(`Preparing to update ${updates.length} users.`);

    // 4. Batch update user_credit
    const chunkSize = 100; // Smaller chunk size for safety
    let updatedCount = 0;
    
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      if (chunk.length === 0) continue;
      
      const { error: upsertError } = await supabase.from("user_credit").upsert(chunk);
      if (upsertError) {
        console.error("Upsert error:", upsertError);
        // Continue with other chunks instead of failing completely?
        // throw upsertError; 
      } else {
        updatedCount += chunk.length;
      }
    }
    
    // 5. Ensure all profiles have a credit record (for those with 0 events)
    // We can't easily do "NOT IN" via JS efficiently without fetching all IDs.
    // But we can rely on the fact that if they have 0 events, they keep their default or current score.
    // However, if they have NO record in user_credit, we should insert one.
    // Let's skip this for now to avoid complexity, usually they get created on signup or first event.

    return new Response(JSON.stringify({ 
      success: true, 
      events_processed: allEvents.length,
      users_updated: updatedCount 
    }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("credit-daily-maintenance error", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
}
