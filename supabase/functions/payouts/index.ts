import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

export const config = {
  runtime: "edge",
  schedule: "0 20 * * 1", // 1:00 PM Mountain Standard Time is 20:00 UTC on Mondays
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://trollcity.app",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      error: "PayPal payouts removed",
      message: "PayPal payout processing has been retired and is currently disabled.",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
