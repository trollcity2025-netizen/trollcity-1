import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    error: "PayPal verification removed",
    message: "PayPal flows have been retired. Use the Stripe verification flow instead.",
  }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  });
});

