import { supabase } from "@/api/supabaseClient";

// Centralized coin operations: credit and debit.
// Each operation inserts a row into `coin_transactions` and updates the `profiles` row.

export async function creditCoins(userId, amount, opts = {}) {
  if (!userId) throw new Error("creditCoins: missing userId");
  amount = Number(amount) || 0;
  if (amount <= 0) throw new Error("creditCoins: amount must be > 0");

  const now = new Date().toISOString();

  // Insert transaction record
  const txPayload = {
    user_id: userId,
    amount: amount,
    type: 'credit',
    reason: opts.reason || opts.source || 'credit',
    source: opts.source || null,
    reference_id: opts.reference || null,
    created_date: now,
  };

  const { error: txErr } = await supabase.from('coin_transactions').insert(txPayload);
  if (txErr) {
    console.warn('creditCoins: failed to insert transaction', txErr.message || txErr);
    throw txErr;
  }

  // Update profile balances
  const { data: profileData, error: pErr } = await supabase
    .from('profiles')
    .select('coins, purchased_coins')
    .eq('id', userId)
    .single();
  if (pErr) {
    console.warn('creditCoins: failed to fetch profile', pErr.message || pErr);
    throw pErr;
  }

  const newCoins = (profileData?.coins || 0) + amount;
  const newPurchased = (profileData?.purchased_coins || 0) + amount;

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ coins: newCoins, purchased_coins: newPurchased, updated_date: now })
    .eq('id', userId);
  if (updErr) {
    console.warn('creditCoins: failed to update profile', updErr.message || updErr);
    throw updErr;
  }

  return { userId, newCoins, newPurchased };
}

export async function debitCoins(userId, amount, opts = {}) {
  if (!userId) throw new Error("debitCoins: missing userId");
  amount = Number(amount) || 0;
  if (amount <= 0) throw new Error("debitCoins: amount must be > 0");

  const now = new Date().toISOString();

  const { data: profileData, error: pErr } = await supabase
    .from('profiles')
    .select('coins, free_coins, purchased_coins')
    .eq('id', userId)
    .single();
  if (pErr) {
    console.warn('debitCoins: failed to fetch profile', pErr.message || pErr);
    throw pErr;
  }

  const available = (profileData?.coins || 0);
  if (available < amount) throw new Error('Insufficient coins');

  // Insert transaction record
  const txPayload = {
    user_id: userId,
    amount: amount,
    type: 'debit',
    reason: opts.reason || opts.source || 'debit',
    source: opts.source || null,
    reference_id: opts.reference || null,
    created_date: now,
  };

  const { error: txErr } = await supabase.from('coin_transactions').insert(txPayload);
  if (txErr) {
    console.warn('debitCoins: failed to insert transaction', txErr.message || txErr);
    throw txErr;
  }

  const newCoins = (profileData?.coins || 0) - amount;
  const newPurchased = (profileData?.purchased_coins || 0) - Math.min(profileData?.purchased_coins || 0, amount);

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ coins: newCoins, purchased_coins: newPurchased, updated_date: now })
    .eq('id', userId);
  if (updErr) {
    console.warn('debitCoins: failed to update profile', updErr.message || updErr);
    throw updErr;
  }

  return { userId, newCoins, newPurchased };
}

export async function debitPurchasedCoinsWithNegative(userId, amount, opts = {}) {
  if (!userId) throw new Error("debitPurchasedCoinsWithNegative: missing userId");
  amount = Number(amount) || 0;
  if (amount <= 0) throw new Error("debitPurchasedCoinsWithNegative: amount must be > 0");

  const now = new Date().toISOString();

  const { data: profileData, error: pErr } = await supabase
    .from('profiles')
    .select('coins, purchased_coins, free_coins')
    .eq('id', userId)
    .single();
  if (pErr) throw pErr;

  const purchased = Number(profileData?.purchased_coins || 0);
  const freeCoins = Number(profileData?.free_coins || 0);
  
  // Check if user has less than 1000 purchased coins - allow negative balance
  if (purchased < 1000) {
    console.log(`User ${userId} has ${purchased} purchased coins (< 1000), allowing negative balance`);
    
    // Create transaction record showing negative balance
    const txPayload = {
      user_id: userId,
      amount: amount,
      type: 'debit',
      reason: opts.reason || opts.source || 'debit_purchased_negative',
      source: opts.source || 'purchased_negative',
      reference_id: opts.reference || null,
      created_date: now,
    };
    try { await supabase.from('coin_transactions').insert(txPayload); } catch (_) {}

    const newPurchased = purchased - amount; // This can go negative
    const newCoins = Number(profileData?.coins || 0) - amount;

    const { error: updErr } = await supabase
      .from('profiles')
      .update({ coins: newCoins, purchased_coins: newPurchased, updated_date: now })
      .eq('id', userId);
    if (updErr) throw updErr;

    // Return special flag indicating negative balance and store redirect needed
    return { 
      userId, 
      newCoins, 
      newPurchased, 
      wentNegative: true, 
      needsStoreRedirect: purchased < 1000 && newPurchased < 0 
    };
  } else {
    // User has 1000+ purchased coins, use normal logic
    return await debitPurchasedCoins(userId, amount, opts);
  }
}

export async function debitPurchasedCoins(userId, amount, opts = {}) {
  if (!userId) throw new Error("debitPurchasedCoins: missing userId");
  amount = Number(amount) || 0;
  if (amount <= 0) throw new Error("debitPurchasedCoins: amount must be > 0");

  const now = new Date().toISOString();

  const { data: profileData, error: pErr } = await supabase
    .from('profiles')
    .select('coins, purchased_coins')
    .eq('id', userId)
    .single();
  if (pErr) throw pErr;

  const purchased = Number(profileData?.purchased_coins || 0);
  if (purchased < amount) throw new Error('Insufficient purchased coins');

  const txPayload = {
    user_id: userId,
    amount: amount,
    type: 'debit',
    reason: opts.reason || opts.source || 'debit_purchased',
    source: opts.source || 'purchased',
    reference_id: opts.reference || null,
    created_date: now,
  };
  try { await supabase.from('coin_transactions').insert(txPayload); } catch (_) {}

  const newPurchased = purchased - amount;
  const newCoins = Number(profileData?.coins || 0) - amount;

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ coins: newCoins, purchased_coins: newPurchased, updated_date: now })
    .eq('id', userId);
  if (updErr) throw updErr;

  return { userId, newCoins, newPurchased };
}

export async function creditFreeCoins(userId, amount, opts = {}) {
  if (!userId) throw new Error("creditFreeCoins: missing userId");
  amount = Number(amount) || 0;
  if (amount <= 0) throw new Error("creditFreeCoins: amount must be > 0");

  const now = new Date().toISOString();

  const txPayload = {
    user_id: userId,
    amount: amount,
    type: 'credit',
    reason: opts.reason || 'free',
    source: opts.source || 'free',
    reference_id: opts.reference || null,
    created_date: now,
  };
  try { await supabase.from('coin_transactions').insert(txPayload); } catch (_) {}

  const { data: profileData, error: pErr } = await supabase
    .from('profiles')
    .select('coins, free_coins')
    .eq('id', userId)
    .single();
  if (pErr) throw pErr;

  const newCoins = (profileData?.coins || 0) + amount;
  const newFree = (profileData?.free_coins || 0) + amount;

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ coins: newCoins, free_coins: newFree, updated_date: now })
    .eq('id', userId);
  if (updErr) throw updErr;

  return { userId, newCoins, free_coins: newFree };
}

export default { creditCoins, debitCoins, debitPurchasedCoins, creditFreeCoins };
