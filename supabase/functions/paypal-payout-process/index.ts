import { createClient } from "https://esm.sh/@supabase/supabase-js";

export const config = {
  runtime: "edge",
};

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID")!;
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
const PAYPAL_BASE = "https://api-m.paypal.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

// CORS headers
const cors = {
  "Access-Control-Allow-Origin": "https://trollcity.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default async function handler(req: Request) {
  // ⭐ OPTIONS MUST BE FIRST ⭐
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: cors,
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...cors,
        "Content-Type": "application/json",
      },
    });
  }

  try {
    // Verify admin/lead officer authorization
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: {
          ...cors,
          "Content-Type": "application/json",
        },
      });
    }

    // Get user from JWT token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authorization" }), {
        status: 401,
        headers: {
          ...cors,
          "Content-Type": "application/json",
        },
      });
    }

    // Check if user has admin or lead_officer role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, officer_role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 404,
        headers: {
          ...cors,
          "Content-Type": "application/json",
        },
      });
    }

    const isAuthorized = profile.role === 'admin' || profile.officer_role === 'lead_officer';
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: {
          ...cors,
          "Content-Type": "application/json",
        },
      });
    }

    const { payout_request_id, recipient_email, amount, currency = "USD" } = await req.json();

    if (!payout_request_id || !recipient_email || !amount) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: {
          ...cors,
          "Content-Type": "application/json",
        },
      });
    }

    // Get PayPal access token
    const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
    
    const tokenResponse = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      body: "grant_type=client_credentials",
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      console.error("PayPal token error:", tokenData);
      return new Response(JSON.stringify({ error: "PayPal authentication failed" }), {
        status: 500,
        headers: {
          ...cors,
          "Content-Type": "application/json",
        },
      });
    }

    // Create PayPal payout
    const payoutData = {
      sender_batch_header: {
        sender_batch_id: `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email_subject: "You have a payment from Troll City",
        email_message: "You have received a payout from Troll City. Thank you for being part of our community!",
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: {
            value: amount.toFixed(2),
            currency: currency,
          },
          receiver: recipient_email,
          note: "Troll City Creator Payout",
          sender_item_id: payout_request_id,
        },
      ],
    };

    const payoutResponse = await fetch(`${PAYPAL_BASE}/v1/payments/payouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      body: JSON.stringify(payoutData),
    });

    const payoutResult = await payoutResponse.json();
    
    if (!payoutResponse.ok) {
      console.error("PayPal payout error:", payoutResult);
      return new Response(JSON.stringify({ 
        error: "PayPal payout failed", 
        details: payoutResult 
      }), {
        status: 500,
        headers: {
          ...cors,
          "Content-Type": "application/json",
        },
      });
    }

    // Update payout request status
    const { error: updateError } = await supabase
      .from('payout_requests')
      .update({
        status: 'paid',
        processed_at: new Date().toISOString(),
        processed_by: user.id,
        paypal_batch_id: payoutResult.batch_header?.payout_batch_id,
        paypal_batch_status: payoutResult.batch_header?.batch_status,
      })
      .eq('id', payout_request_id);

    if (updateError) {
      console.error("Database update error:", updateError);
      // Don't fail the request, but log the error
    }

    // Log the payout action
    await supabase.from('payout_audit_log').insert({
      payout_request_id,
      action: 'processed',
      processed_by: user.id,
      paypal_batch_id: payoutResult.batch_header?.payout_batch_id,
      amount: amount,
      recipient_email: recipient_email.substring(0, 3) + '***', // Partial masking
      created_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ 
      success: true, 
      payout_batch_id: payoutResult.batch_header?.payout_batch_id,
      batch_status: payoutResult.batch_header?.batch_status,
    }), {
      headers: {
        ...cors,
        "Content-Type": "application/json",
      },
    });

  } catch (err) {
    console.error("PayPal payout processing error:", err);
    return new Response(JSON.stringify({ 
      error: "Payout processing failed",
      details: err.message 
    }), {
      status: 500,
      headers: {
        ...cors,
        "Content-Type": "application/json",
      },
    });
  }
}
