import { supabase } from '@/api/supabaseClient';

/**
 * Fetch the current earnings config from the database
 */
export async function getEarningsConfig() {
  try {
    const { data, error } = await supabase
      .from('earnings_config')
      .select('*')
      .eq('id', 1)
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    return {
      square_account_active: false,
      square_application_id: null,
      square_location_id: null,
      transaction_fee_percentage: 2.9,
      transaction_fee_fixed_cents: 30,
      _fallback: true,
      _error: err?.message || String(err)
    };
  }
}

/**
 * Calculate transaction fees based on config
 * Returns { grossAmount, feeAmount, netAmount } in cents
 */
export function calculateTransactionFees(amountCents, feePercentage = 2.9, fixedFeeCents = 30) {
  const percentageFee = Math.round((amountCents * feePercentage) / 100);
  const totalFee = percentageFee + fixedFeeCents;
  const netAmount = amountCents - totalFee;
  return {
    grossAmount: amountCents,
    feeAmount: totalFee,
    netAmount: Math.max(netAmount, 0),
  };
}

/**
 * Process a payment via Square (placeholder - replace with actual Square SDK)
 * In production, this would integrate with Square's Web Payments SDK
 */
export async function processSquarePayment(paymentDetails) {
  const {
    amount, // in cents
    currency = 'USD',
    sourceId, // token from Square Web Payments SDK
    description,
    userId,
    metadata = {},
  } = paymentDetails;

  try {
    const config = await getEarningsConfig();
    
    // Check if Square is properly configured
    if (!config.square_account_active || 
        !config.square_application_id || 
        config.square_application_id === 'sandbox-sq0idb-YOUR_SANDBOX_APP_ID') {
      console.warn('Square integration not fully configured, using test mode');
      
      // Simulate successful payment for testing
      const { feeAmount, netAmount } = calculateTransactionFees(
        amount,
        config.transaction_fee_percentage || 2.9,
        config.transaction_fee_fixed_cents || 30
      );
      
      return {
        success: true,
        transactionId: `test_${Date.now()}`,
        paymentId: `test_payment_${Date.now()}`,
        amountCharged: amount,
        feeApplied: feeAmount,
        netReceived: netAmount,
        raw: { test: true, message: 'Square integration in test mode' },
      };
    }

    const { feeAmount, netAmount } = calculateTransactionFees(
      amount,
      config.transaction_fee_percentage,
      config.transaction_fee_fixed_cents
    );

    // Call Supabase Edge Function which securely talks to Square
    const fnBody = {
      amount,
      currency,
      sourceId,
      description,
      userId,
      metadata,
      idempotency_key: metadata?.idempotency_key,
    };

    const { data: fnResp, error: fnError } = await supabase.functions.invoke('processSquarePayment', { body: fnBody });
    if (fnError) throw fnError;

    const result = fnResp;

    // If the Edge Function returned created transaction info, return it
    return {
      success: true,
      transactionId: result?.transactionId || null,
      paymentId: result?.paymentId || null,
      amountCharged: amount,
      feeApplied: result?.feeAmount ?? feeAmount,
      netReceived: result?.netAmount ?? netAmount,
      raw: result,
    };
  } catch (error) {
    console.error('Square payment error:', error);
    
    // If it's a configuration error, provide a helpful message
    if (error.message?.includes('Square integration is not active')) {
      throw new Error('Payment processing is temporarily unavailable. Please contact support or try again later.');
    }
    
    throw error;
  }
}

/**
 * Process a refund via Square
 */
export async function processSquareRefund(paymentId, amountCents = null) {
  try {
    const response = await fetch('/api/square/process-refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId,
        amountCents,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Refund processing failed');
    }

    const result = await response.json();
    return {
      success: true,
      refundId: result.refundId,
      amountRefunded: result.amountRefunded,
    };
  } catch (error) {
    console.error('Square refund error:', error);
    throw error;
  }
}

/**
 * Get Square transactions for a user
 */
export async function getUserSquareTransactions(userId) {
  const { data, error } = await supabase
    .from('square_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get Square transaction by ID
 */
export async function getSquareTransaction(transactionId) {
  const { data, error } = await supabase
    .from('square_transactions')
    .select('*')
    .eq('square_transaction_id', transactionId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update Square transaction status (e.g., after webhook confirmation)
 */
export async function updateSquareTransactionStatus(transactionId, status) {
  const { error } = await supabase
    .from('square_transactions')
    .update({
      status,
      updated_date: new Date().toISOString(),
    })
    .eq('square_transaction_id', transactionId);

  if (error) throw error;
}

/**
 * Test Square connection and configuration
 */
export async function testSquareConnection() {
  try {
    const config = await getEarningsConfig();

    if (!config || !config.square_account_active) {
      return {
        success: false,
        error: 'Square integration is not active',
        details: config?._fallback ? 'earnings_config missing; run migrations' : 'Enable Square in earnings_config'
      };
    }

    const requiredConfig = [
      'square_application_id',
      'square_location_id',
    ];

    const missing = requiredConfig.filter((k) => !config[k]);
    if (missing.length) {
      return {
        success: false,
        error: 'Missing Square configuration',
        details: `Missing: ${missing.join(', ')}`,
      };
    }

    return {
      success: true,
      message: 'Square config present',
      details: 'Application ID and Location ID are set; account active',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Square connection test error:', error);
    return {
      success: false,
      error: error?.message || String(error),
      details: 'Unexpected error during configuration test',
    };
  }
}
