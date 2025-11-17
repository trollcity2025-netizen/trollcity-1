import { supabase } from '@/api/supabaseClient';

// Generate weekly family payout: find top family by gifts received in the prior week and create payouts
export async function generateWeeklyFamilyPayout(referenceDate = new Date()) {
  // Compute last Friday window: we take the last Friday prior to referenceDate (not including that day's midnight)
  const ref = new Date(referenceDate);
  // find most recent Friday (5) at 00:00
  const day = ref.getDay();
  // JS: Sunday=0, Friday=5
  const daysSinceFriday = (day >= 5) ? day - 5 : 7 - (5 - day);
  const lastFriday = new Date(ref);
  lastFriday.setDate(ref.getDate() - daysSinceFriday);
  lastFriday.setHours(0,0,0,0);
  const weekStart = new Date(lastFriday.getTime() - 7 * 24 * 60 * 60 * 1000); // previous Friday
  const weekEnd = new Date(lastFriday.getTime());

  // Query stream_gifts joined to recipient profiles to get troll_family_id
  const sql = `
    SELECT p.troll_family_id, p.troll_family_name, SUM(g.coin_value) as total_coins
    FROM stream_gifts g
    JOIN profiles p ON p.id = g.recipient_id
    WHERE g.created_date >= $1 AND g.created_date < $2
      AND p.troll_family_id IS NOT NULL
    GROUP BY p.troll_family_id, p.troll_family_name
    ORDER BY total_coins DESC
    LIMIT 1
  `;

  // Try to use RPC if available, otherwise fallback to client-side processing
  let topRows = null;
  let topErr = null;
  
  try {
    const rpcResult = await supabase.rpc('sql', { q: sql, params: [weekStart.toISOString(), weekEnd.toISOString()] });
    topRows = rpcResult.data;
  } catch (e) {
    topErr = e;
  }
  // Note: If your Supabase does not expose an RPC to run raw SQL, fallback to client-side aggregation
  if (topErr) {
    // Fallback: fetch gifts and aggregate in JS
    const { data: gifts, error: gErr } = await supabase
      .from('stream_gifts')
      .select('*, recipient:recipient_id(id, troll_family_id, troll_family_name)')
      .gte('created_date', weekStart.toISOString())
      .lt('created_date', weekEnd.toISOString());
    if (gErr) throw gErr;

    const byFamily = {};
    (gifts || []).forEach(g => {
      const fam = g.recipient?.troll_family_id;
      if (!fam) return;
      const name = g.recipient?.troll_family_name || 'Unknown';
      byFamily[fam] = byFamily[fam] || { family_id: fam, family_name: name, total_coins: 0 };
      byFamily[fam].total_coins += Number(g.coin_value || 0);
    });
    const arr = Object.values(byFamily).sort((a,b)=>b.total_coins - a.total_coins);
    if (arr.length === 0) return null;
    const top = arr[0];
    // create payout entries
    return await _createFamilyPayout(top, weekStart, weekEnd);
  }

  // If RPC returned rows, use them
  const top = (topRows && topRows.length > 0) ? topRows[0] : null;
  if (!top) return null;
  return await _createFamilyPayout({ family_id: top.troll_family_id, family_name: top.troll_family_name, total_coins: Number(top.total_coins) }, weekStart, weekEnd);
}

async function _createFamilyPayout(top, weekStart, weekEnd) {
  const TOTAL_USD = 50;
  const { family_id, family_name, total_coins } = top;
  // Get family members
  const { data: members, error: memErr } = await supabase.from('profiles').select('id, username, email').eq('troll_family_id', family_id);
  if (memErr) throw memErr;
  const memberCount = (members || []).length;
  if (memberCount === 0) return null;
  const perMember = parseFloat((TOTAL_USD / memberCount).toFixed(2));

  // Insert weekly payout summary
  const { error: insertErr } = await supabase.from('family_weekly_payouts').insert({
    family_id,
    family_name,
    total_coins_received: total_coins,
    payout_amount_total: TOTAL_USD,
    payout_per_member: perMember,
    week_start: weekStart.toISOString(),
    week_end: weekEnd.toISOString(),
    created_date: new Date().toISOString(),
  });
  if (insertErr) throw insertErr;

  // Create individual Payout rows
  for (const m of members) {
    await supabase.from('payouts').insert({
      user_id: m.id,
      user_name: m.username || m.email,
      user_email: m.email || null,
      coin_amount: 0,
      usd_amount: perMember,
      fee_amount: 0,
      payout_amount: perMember,
      payment_method: 'manual',
      payment_details: `Family weekly payout ${family_name}`,
      status: 'pending',
      admin_notes: `Family weekly payout for week ${weekStart.toISOString()} - ${weekEnd.toISOString()}`,
      created_date: new Date().toISOString(),
    });
  }

  return {
    family_id,
    family_name,
    total_coins,
    memberCount,
    perMember,
  };
}

export async function getRecentFamilyPayouts(limit = 10) {
  const { data, error } = await supabase.from('family_weekly_payouts').select('*').order('created_date', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

export default { generateWeeklyFamilyPayout, getRecentFamilyPayouts };
