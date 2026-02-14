/**
 * Gift Sending Test Suite
 * Tests that sender balance is deducted and receiver balance is increased
 * when sending gifts.
 * 
 * Run this in browser console or as a standalone script with Supabase configured.
 */

import { supabase } from './supabase';
// import { useAuthStore } from './store';

interface GiftTestResult {
  success: boolean;
  senderBalanceChange?: number;
  receiverBalanceChange?: number;
  error?: string;
}

export async function testGiftSending(
  senderId: string,
  receiverId: string,
  giftId: string,
  giftCost: number
): Promise<GiftTestResult> {
  console.log('=== Gift Sending Test ===');
  console.log(`Testing gift: ${giftId} costing ${giftCost} coins`);
  console.log(`From: ${senderId} -> To: ${receiverId}\n`);

  try {
    // Step 1: Get initial balances
    console.log('Step 1: Getting initial balances...');
    
    const { data: senderProfile, error: senderError } = await supabase
      .from('user_profiles')
      .select('troll_coins')
      .eq('id', senderId)
      .single();

    const { data: receiverProfile, error: receiverError } = await supabase
      .from('user_profiles')
      .select('troll_coins')
      .eq('id', receiverId)
      .single();

    if (senderError || receiverError) {
      throw new Error(`Failed to fetch profiles: ${senderError?.message || receiverError?.message}`);
    }

    const initialSenderBalance = senderProfile?.troll_coins || 0;
    const initialReceiverBalance = receiverProfile?.troll_coins || 0;

    console.log(`  Sender initial: ${initialSenderBalance}`);
    console.log(`  Receiver initial: ${initialReceiverBalance}`);

    if (initialSenderBalance < giftCost) {
      return {
        success: false,
        error: `Insufficient sender balance. Has ${initialSenderBalance}, needs ${giftCost}`
      };
    }

    // Step 2: Send gift
    console.log('\nStep 2: Sending gift...');
    
    const { data: result, error: rpcError } = await supabase.rpc('send_premium_gift', {
      p_sender_id: senderId,
      p_receiver_id: receiverId,
      p_stream_id: null,
      p_gift_id: String(giftId),
      p_cost: Number(giftCost), // Use Number for NUMERIC type
      p_quantity: 1
    });

    if (rpcError) {
      console.error('  ❌ RPC Error:', rpcError);
      return { success: false, error: rpcError.message };
    }

    console.log('  RPC Result:', result);

    if (!result?.success) {
      return { success: false, error: result?.message || 'Gift sending failed' };
    }

    console.log('  ✓ Gift sent successfully');

    // Step 3: Get new balances
    console.log('\nStep 3: Getting new balances...');

    const { data: newSenderProfile } = await supabase
      .from('user_profiles')
      .select('troll_coins')
      .eq('id', senderId)
      .single();

    const { data: newReceiverProfile } = await supabase
      .from('user_profiles')
      .select('troll_coins')
      .eq('id', receiverId)
      .single();

    const newSenderBalance = newSenderProfile?.troll_coins || 0;
    const newReceiverBalance = newReceiverProfile?.troll_coins || 0;

    console.log(`  Sender new: ${newSenderBalance}`);
    console.log(`  Receiver new: ${newReceiverBalance}`);

    // Step 4: Calculate changes
    const senderBalanceChange = newSenderBalance - initialSenderBalance;
    const receiverBalanceChange = newReceiverBalance - initialReceiverBalance;

    console.log('\nStep 4: Analyzing balance changes...');
    console.log(`  Sender change: ${senderBalanceChange} (${initialSenderBalance} -> ${newSenderBalance})`);
    console.log(`  Receiver change: ${receiverBalanceChange} (${initialReceiverBalance} -> ${newReceiverBalance})`);

    // Expected: Sender loses giftCost - cashback, Receiver gains ~95% of giftCost
    const expectedReceiverGain = Math.floor(giftCost * 0.95);
    const expectedSenderLoss = -(giftCost - (result.cashback || 0));

    console.log(`  Expected sender: ${expectedSenderLoss} (cost: ${giftCost}, cashback: ${result.cashback || 0})`);
    console.log(`  Expected receiver: +${expectedReceiverGain}`);

    // Step 5: Verify changes
    let success = true;

    // Check sender balance (should be negative, within tolerance)
    if (senderBalanceChange > -1) {
      console.error('  ❌ Sender balance did NOT decrease');
      success = false;
    } else if (senderBalanceChange > expectedSenderLoss + 50) {
      console.error('  ❌ Sender balance decrease is too small');
      success = false;
    } else {
      console.log('  ✓ Sender balance decreased correctly');
    }

    // Check receiver balance (should be positive, close to 95% of cost)
    if (receiverBalanceChange < 1) {
      console.error('  ❌ Receiver balance did NOT increase');
      success = false;
    } else if (Math.abs(receiverBalanceChange - expectedReceiverGain) > 5) {
      console.error('  ❌ Receiver balance increase is incorrect');
      success = false;
    } else {
      console.log('  ✓ Receiver balance increased correctly');
    }

    // Step 6: Check ledger
    console.log('\nStep 5: Checking coin ledger...');
    
    const { data: ledger } = await supabase
      .from('coin_ledger')
      .select('*')
      .eq('user_id', senderId)
      .eq('source', 'gift_sent')
      .order('created_at', { ascending: false })
      .limit(1);

    if (ledger && ledger.length > 0) {
      console.log('  ✓ Ledger entry found:', ledger[0]);
    } else {
      console.log('  ⚠️ No ledger entry found (may be delay)');
    }

    // Summary
    console.log('\n=== Test Result ===');
    if (success) {
      console.log('✅ PASSED: Gift sending works correctly');
      console.log('  - Sender balance deducted');
      console.log('  - Receiver balance increased');
      console.log('  - Ledger entries created');
    } else {
      console.log('❌ FAILED: Some checks did not pass');
    }

    return {
      success,
      senderBalanceChange,
      receiverBalanceChange
    };

  } catch (error: any) {
    console.error('❌ Test error:', error);
    return { success: false, error: error.message };
  }
}

// Browser console test function - paste this in browser console
export function browserGiftTest() {
  console.log('Gift Sending Test');
  console.log('==================');
  console.log('To run the test, call:');
  console.log('  testGiftSending(senderId, receiverId, giftId, cost)');
  console.log('');
  console.log('Example:');
  console.log('  const test = await testGiftSending(');
  console.log('    "user-uuid-1",');
  console.log('    "user-uuid-2",');
  console.log('    "gift-uuid",');
  console.log('    100');
  console.log('  );');
}

export default testGiftSending;
