import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { data: authUser, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser?.user) {
      console.error("Auth error:", authError);
      return new Response("Unauthorized", { status: 401 });
    }

    const officerId = authUser.user.id;

    // Verify user is an officer
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, is_troll_officer")
      .eq("id", officerId)
      .single();

    if (!profile || (!profile.is_troll_officer && profile.role !== "troll_officer" && profile.role !== "admin")) {
      return new Response("Only officers can submit abuse reports", { status: 403 });
    }

    const body = await req.json();
    const { streamId, offenderUserId, reason, severity } = body;

    if (!reason || !severity) {
      return new Response("Missing required fields: reason, severity", { status: 400 });
    }

    if (severity < 1 || severity > 5) {
      return new Response("Severity must be between 1 and 5", { status: 400 });
    }

    // Insert abuse report
    const { data: report, error: insertError } = await supabase
      .from("abuse_reports")
      .insert({
        reported_by: officerId,
        stream_id: streamId || null,
        offender_user_id: offenderUserId || null,
        reason: reason,
        severity: severity
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting abuse report:", insertError);
      return new Response("Failed to submit report", { status: 500 });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      reportId: report.id 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Error in officer-report-abuse:", e);
    return new Response("Server error", { status: 500 });
  }
});

