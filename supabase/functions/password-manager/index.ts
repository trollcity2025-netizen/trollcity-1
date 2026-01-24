import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withCors, handleCorsPreflight } from "../_shared/cors.ts";

const textEncoder = new TextEncoder();
const PIN_SALT = Deno.env.get("PIN_SALT") || "trollcity-pin-salt";
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function sha256Hex(input: string): Promise<string> {
  const data = textEncoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hashBuffer);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(data: unknown, status = 200) {
  return withCors(data, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreflight();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const action = String(body?.action || "").toLowerCase();

  if (action === "set-pin") {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || null;
    if (!token) return json({ error: "Missing auth token" }, 401);

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) return json({ error: "Unauthorized" }, 401);

    const pin: string = String(body?.pin || "").trim();
    if (!/^\d{6}$/.test(pin)) return json({ error: "PIN must be exactly 6 digits" }, 400);
    if (pin === "000000") return json({ error: "Temporary PIN cannot be used as your permanent PIN" }, 400);

    const userId = authData.user.id;
    const pinHash = await sha256Hex(`${userId}:${pin}:${PIN_SALT}`);

    // Use RPC to set PIN (safer and bypasses potential RLS issues with direct update)
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc("set_password_reset_pin", {
      p_user_id: userId,
      p_pin_hash: pinHash
    });

    if (rpcError) {
      console.error("set_password_reset_pin error:", rpcError);
      // Fallback to direct update if RPC is missing (for backward compatibility during migration)
      const { error: updErr } = await supabaseAdmin
        .from("user_profiles")
        .update({ password_reset_pin_hash: pinHash, password_reset_pin_set_at: new Date().toISOString() })
        .eq("id", userId);
        
      if (updErr) {
        console.error("Direct update error:", updErr);
        return json({ error: "Failed to set PIN" }, 500);
      }
    } else {
        // RPC might return success:false if user not found, depending on implementation
        // But my RPC returns void or throws error if I didn't change it to return jsonb.
        // Wait, I defined it to return JSONB in the migration file.
        if (rpcData && rpcData.success === false) {
             return json({ error: rpcData.error || "Failed to set PIN" }, 400);
        }
    }

    return json({ ok: true });
  }

  if (action === "reset-password") {
    const email: string = String(body?.email || "").trim().toLowerCase();
    const fullName: string = String(body?.full_name || "").trim();
    const pin: string = String(body?.pin || "").trim();
    const newPassword: string = String(body?.new_password || "").trim();

    if (!email || !fullName || !pin || !newPassword) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (!/^\d{6}$/.test(pin)) return json({ error: "PIN must be exactly 6 digits" }, 400);
    if (newPassword.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

    const { data: profile, error: profErr } = await supabaseAdmin
      .from("user_profiles")
      .select("id, email, full_name, password_reset_pin_hash")
      .eq("email", email)
      .eq("full_name", fullName)
      .maybeSingle();

    if (profErr) return json({ error: "Lookup failed" }, 500);
    if (!profile?.id) return json({ error: "No matching account found" }, 404);

    if (!profile.password_reset_pin_hash) {
      return json({ error: "Password reset PIN is not set on this account. You cannot reset your password." }, 403);
    }

    const computed = await sha256Hex(`${profile.id}:${pin}:${PIN_SALT}`);
    if (profile.password_reset_pin_hash !== computed) {
      return json({ error: "Invalid PIN" }, 403);
    }

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
      password: newPassword,
    });
    if (updErr) return json({ error: "Password update failed" }, 500);

    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
