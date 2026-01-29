
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized", reason: "missing bearer token" }),
      { status: 401, headers: corsHeaders }
    );
  }
  const token = authHeader.replace("Bearer ", "").trim();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized", reason: authError?.message ?? "user not found" }),
      { status: 401, headers: corsHeaders }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders });
  }

  const { loan_id, amount, is_full_payment } = body;
  if (!loan_id || !amount) {
    return new Response(JSON.stringify({ error: 'Missing loan_id or amount' }), { status: 400, headers: corsHeaders });
  }

  // Fetch loan
  const { data: loan, error: loanError } = await supabase
    .from('loans')
    .select('*')
    .eq('id', loan_id)
    .eq('user_id', user.id)
    .single();
  if (loanError || !loan) {
    return new Response(JSON.stringify({ error: 'Loan not found' }), { status: 404, headers: corsHeaders });
  }

  // Payment logic
  let newBalance = Number(loan.balance) - Number(amount);
  if (newBalance < 0) newBalance = 0;
  let status = loan.status;
  if (newBalance === 0) status = 'paid';

  // Credit score logic
  let scoreIncrease = Math.floor((Number(amount) / Number(loan.principal)) * 40);
  let event = 'Partial loan payment';
  if (is_full_payment) {
    scoreIncrease += 20;
    event = 'Full loan payment';
  }
  // TODO: Add on-time/early/late logic

  // Update loan
  const { error: updateLoanError } = await supabase
    .from('loans')
    .update({ balance: newBalance, status })
    .eq('id', loan_id);
  if (updateLoanError) {
    return new Response(JSON.stringify({ error: 'Failed to update loan' }), { status: 500, headers: corsHeaders });
  }

  // Log payment
  const { error: paymentError } = await supabase
    .from('loan_payments')
    .insert({
      loan_id,
      user_id: user.id,
      amount,
      payment_type: is_full_payment ? 'full' : 'partial',
      on_time: true // TODO: Calculate on_time
    });
  if (paymentError) {
    return new Response(JSON.stringify({ error: 'Failed to log payment' }), { status: 500, headers: corsHeaders });
  }

  // Update credit score
  const { data: creditScoreRow } = await supabase
    .from('credit_scores')
    .select('*')
    .eq('user_id', user.id)
    .single();
  let newScore = 500;
  if (creditScoreRow) {
    newScore = Number(creditScoreRow.score) + scoreIncrease;
  }
  await supabase
    .from('credit_scores')
    .upsert({ user_id: user.id, score: newScore, updated_at: new Date().toISOString() });

  // Log credit report
  await supabase
    .from('credit_reports')
    .insert({
      user_id: user.id,
      event,
      score_change: scoreIncrease,
      created_at: new Date().toISOString()
    });

  return new Response(JSON.stringify({ success: true, newBalance, newScore }), { headers: corsHeaders });
});
