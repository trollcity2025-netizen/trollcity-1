import { supabase } from "@/api/supabaseClient";
import { debitCoins } from "@/lib/coins";

export const FEES = {
  kick: 500,
  ban: 2000,
  ban3x: 5000,
  family_create: 500,
  message_admin: 3200,
  disable_chat: 100,
  racism_lock: 1500,
};

export async function payFee(userId, code, opts = {}) {
  if (!userId) throw new Error("payFee: missing userId");
  const amount = FEES[code];
  if (!amount || amount <= 0) return { skipped: true };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("purchased_coins, coins")
    .eq("id", userId)
    .single();
  if (error) throw error;
  const purchased = Number(profile?.purchased_coins || 0);
  if (purchased < amount) throw new Error(`Not enough purchased coins (${amount} required)`);

  return await debitCoins(userId, amount, { reason: `fee_${code}`, source: "fee", reference: opts.reference });
}

export async function getUserMessageFee(userId) {
  if (!userId) return 0;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("message_fee_paid_coins")
      .eq("id", userId)
      .single();
    const fee = Number(data?.message_fee_paid_coins || 0);
    return Number.isFinite(fee) && fee > 0 ? fee : 0;
  } catch (_) {
    return 0;
  }
}

export default { FEES, payFee, getUserMessageFee };
