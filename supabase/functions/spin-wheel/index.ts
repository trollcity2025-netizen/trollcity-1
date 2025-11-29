import "jsr:@supabase/functions-js/edge-runtime.d.ts";
/// <reference types="https://deno.land/x/types/index.d.ts" />
import { createClient } from "@supabase/supabase-js";
declare const Deno: { serve: (handler: (req: Request) => Response | Promise<Response>) => void; env: { get: (key: string) => string | undefined } };

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { userId, spinCost, prizes } = await req.json();

  if (!userId) {
    return new Response(JSON.stringify({ success: false, error: 'Missing userId' }), { status: 400 });
  }

  // Random prize selection (weighted)
  const totalWeight = prizes.reduce((a: number, p: { probability: number }) => a + p.probability, 0);
  let random = Math.random() * totalWeight;
  const prize = prizes.find((p: { probability: number }) => (random -= p.probability) <= 0);

  // Deduct cost and apply reward
  const { data, error } = await supabase.rpc('spin_wheel', {
    user_id: userId,
    cost: spinCost,
    prize_amount: prize!.value,
    prize_type: prize!.type
  });

  if (error) return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });

  return new Response(JSON.stringify({
    success: true,
    prize,
    profile: data
  }), { status: 200 });
});
