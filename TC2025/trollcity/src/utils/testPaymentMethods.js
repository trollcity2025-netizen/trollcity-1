import { supabase } from '@/api/supabaseClient';

// Test payment method setup functionality
async function testPaymentMethods() {
  try {
    // Test CashApp setup
    console.log('Testing CashApp setup...');
    const { error: cashappError } = await supabase
      .from('profiles')
      .update({
        payout_method: 'cashapp',
        cashapp_tag: '$testuser123',
        last_payout_date: new Date().toISOString()
      })
      .eq('id', 'test-user-id');
    
    if (cashappError) {
      console.error('CashApp setup error:', cashappError);
    } else {
      console.log('✓ CashApp setup test passed');
    }

    // Test Apple Pay setup
    console.log('Testing Apple Pay setup...');
    const { error: appleError } = await supabase
      .from('profiles')
      .update({
        payout_method: 'apple_pay',
        apple_pay_id: 'test@example.com',
        last_payout_date: new Date().toISOString()
      })
      .eq('id', 'test-user-id');
    
    if (appleError) {
      console.error('Apple Pay setup error:', appleError);
    } else {
      console.log('✓ Apple Pay setup test passed');
    }

    // Test Google Wallet setup
    console.log('Testing Google Wallet setup...');
    const { error: googleError } = await supabase
      .from('profiles')
      .update({
        payout_method: 'google_wallet',
        google_wallet_id: 'test@example.com',
        last_payout_date: new Date().toISOString()
      })
      .eq('id', 'test-user-id');
    
    if (googleError) {
      console.error('Google Wallet setup error:', googleError);
    } else {
      console.log('✓ Google Wallet setup test passed');
    }

    // Test Chime setup
    console.log('Testing Chime setup...');
    const { error: chimeError } = await supabase
      .from('profiles')
      .update({
        payout_method: 'chime',
        chime_id: 'testuser123',
        last_payout_date: new Date().toISOString()
      })
      .eq('id', 'test-user-id');
    
    if (chimeError) {
      console.error('Chime setup error:', chimeError);
    } else {
      console.log('✓ Chime setup test passed');
    }

    console.log('All payment method tests completed!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Export for use in testing
export { testPaymentMethods };