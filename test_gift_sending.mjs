/* global Deno */
/**
 * Gift Sending Test Script
 * Tests that sender balance is deducted and receiver balance is increased
 * when sending gifts.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test gift parameters
const TEST_SENDER_ID = ''; // Set to a test user UUID
const TEST_RECEIVER_ID = ''; // Set to a test receiver UUID
const TEST_GIFT_ID = ''; // Set to a gift UUID from gifts table
const TEST_COST = 100; // Cost of the gift to send

async function getUserBalance(userId) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('troll_coins')
    .eq('id', userId)
    .single();
  
  if (error) throw error;
  return data?.troll_coins || 0;
}

async function sendGiftTest() {
  console.log('=== Gift Sending Test ===\n');

  try {
    // Step 1: Get initial balances
    console.log('Step 1: Getting initial balances...');
    const initialSenderBalance = await getUserBalance(TEST_SENDER_ID);
    const initialReceiverBalance = await getUserBalance(TEST_RECEIVER_ID);
    
    console.log(`  Sender initial balance: ${initialSenderBalance}`);
    console.log(`  Receiver initial balance: ${initialReceiverBalance}`);

    if (initialSenderBalance < TEST_COST) {
      console.error('❌ FAIL: Sender has insufficient balance');
      return { success: false, error: 'Insufficient sender balance' };
    }

    // Step 2: Send gift using RPC
    console.log('\nStep 2: Sending gift...');
    const { data: giftResult, error: giftError } = await supabase.rpc('send_premium_gift', {
      p_sender_id: TEST_SENDER_ID,
      p_receiver_id: TEST_RECEIVER_ID,
      p_stream_id: null, // No stream for profile gift
      p_gift_id: String(TEST_GIFT_ID),
      p_cost: Number(TEST_COST), // Use Number for NUMERIC type
      p_quantity: 1
    });

    if (giftError) {
      console.error('❌ FAIL: Gift RPC error:', giftError);
      return { success: false, error: giftError };
    }

    console.log('  Gift RPC result:', giftResult);

    if (!giftResult?.success) {
      console.error('❌ FAIL: Gift not sent:', giftResult?.message);
      return { success: false, error: giftResult?.message };
    }

    console.log('  ✓ Gift sent successfully');

    // Step 3: Get new balances
    console.log('\nStep 3: Getting new balances...');
    const newSenderBalance = await getUserBalance(TEST_SENDER_ID);
    const newReceiverBalance = await getUserBalance(TEST_RECEIVER_ID);

    console.log(`  Sender new balance: ${newSenderBalance}`);
    console.log(`  Receiver new balance: ${newReceiverBalance}`);

    // Step 4: Verify balances
    console.log('\nStep 4: Verifying balance changes...');
    
    const senderExpectedChange = -(TEST_COST - (giftResult.cashback || 0));
    const actualSenderChange = newSenderBalance - initialSenderBalance;
    const receiverExpectedIncrease = Math.floor(TEST_COST * 0.95);
    const actualReceiverChange = newReceiverBalance - initialReceiverBalance;

    console.log(`  Sender expected change: ${senderExpectedChange} (cost: ${TEST_COST}, cashback: ${giftResult.cashback || 0})`);
    console.log(`  Sender actual change: ${actualSenderChange}`);
    console.log(`  Receiver expected increase: ${receiverExpectedIncrease} (95% of ${TEST_COST})`);
    console.log(`  Receiver actual increase: ${actualReceiverChange}`);

    let success = true;

    // Verify sender deduction (allow small tolerance for cashback variation)
    if (actualSenderChange > senderExpectedChange + 1 || actualSenderChange < senderExpectedChange - 50) {
      console.error(`❌ FAIL: Sender balance change incorrect. Expected ~${senderExpectedChange}, got ${actualSenderChange}`);
      success = false;
    } else {
      console.log('  ✓ Sender balance deducted correctly');
    }

    // Verify receiver increase
    if (actualReceiverChange < receiverExpectedIncrease - 1 || actualReceiverChange > receiverExpectedIncrease + 1) {
      console.error(`❌ FAIL: Receiver balance increase incorrect. Expected ~${receiverExpectedIncrease}, got ${actualReceiverChange}`);
      success = false;
    } else {
      console.log('  ✓ Receiver balance increased correctly');
    }

    // Step 5: Check coin ledger entries
    console.log('\nStep 5: Checking coin ledger...');
    const { data: ledgerEntries, error: ledgerError } = await supabase
      .from('coin_ledger')
      .select('*')
      .eq('user_id', TEST_SENDER_ID)
      .eq('source', 'gift_sent')
      .order('created_at', { ascending: false })
      .limit(1);

    if (ledgerError) {
      console.error('❌ FAIL: Ledger query error:', ledgerError);
      success = false;
    } else if (ledgerEntries?.length === 0) {
      console.error('❌ FAIL: No ledger entry found for sender');
      success = false;
    } else {
      console.log('  ✓ Ledger entry found:', ledgerEntries[0]);
    }

    // Summary
    console.log('\n=== Test Summary ===');
    if (success) {
      console.log('✅ ALL TESTS PASSED: Gift sending works correctly');
      console.log('  - Sender balance deducted correctly');
      console.log('  - Receiver balance increased correctly');
      console.log('  - Ledger entries created');
    } else {
      console.log('❌ SOME TESTS FAILED: Check errors above');
    }

    return { success };

  } catch (error) {
    console.error('❌ Test error:', error);
    return { success: false, error: String(error) };
  }
}

// Run test
sendGiftTest()
  .then(result => {
    console.log('\nFinal result:', result);
    Deno.exit(result.success ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    Deno.exit(1);
  });
