import { supabase } from '@/api/supabaseClient';
import { processSquarePayment } from '@/api/square';

/**
 * Get user's saved payment methods
 */
export async function getUserPaymentMethods(userId) {
  try {
    // Validate userId
    if (!userId || typeof userId !== 'string') {
      throw new Error(`Invalid userId: expected string UUID, got ${typeof userId}: ${JSON.stringify(userId)}`);
    }
    
    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      throw new Error(`Invalid UUID format: ${userId}`);
    }
    
    const { data, error } = await supabase
      .from('profiles')
      .select('apple_pay_id, google_wallet_id, chime_id, cashapp_id')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    
    return {
      applePay: data?.apple_pay_id || null,
      googleWallet: data?.google_wallet_id || null,
      chime: data?.chime_id || null,
      cashApp: data?.cashapp_id || null,
    };
  } catch (error) {
    console.error('Error fetching user payment methods:', error);
    throw error;
  }
}

/**
 * Process payment using user's saved payment method
 */
export async function processUserPaymentMethod(userId, method, methodId, amount, currency, description, coinAmount, idempotencyKey) {
  try {
    // Validate userId
    if (!userId || typeof userId !== 'string') {
      throw new Error(`Invalid userId: expected string, got ${typeof userId}: ${JSON.stringify(userId)}`);
    }
    
    // Get user's saved payment methods to verify ownership
    const paymentMethods = await getUserPaymentMethods(userId);
    
    // Check if the requested method is available and belongs to user
    // Map method names to match the database field names
    const methodMapping = {
      'apple_pay': 'applePay',
      'google_wallet': 'googleWallet',
      'chime': 'chime',
      'cashapp': 'cashApp'
    };
    
    const mappedMethod = methodMapping[method];
    const userMethodId = paymentMethods[mappedMethod];
    if (!userMethodId || userMethodId !== methodId) {
      throw new Error(`No saved ${method} payment method found. Please set up your payment method in profile first.`);
    }
    
    // Process payment based on method type
    const amountCents = Math.round(parseFloat(amount) * 100);
    
    // Try to call the Edge Function, fallback to regular Square payment if not available
    try {
      const { data: result, error } = await supabase.functions.invoke('processUserPaymentMethod', {
        body: {
          userId,
          method,
          methodId,
          amount: amountCents,
          currency: currency || 'USD',
          description,
          coinAmount,
          idempotency_key: idempotencyKey || `${userId}-${Date.now()}-${amountCents}`,
        },
      });
      
      if (error) throw error;
      return result;
    } catch (functionError) {
      console.warn('Edge Function not available, falling back to regular Square payment:', functionError);
      
      // Fallback to regular Square payment processing
      const result = await processSquarePayment({
        amount: amountCents,
        currency: currency || 'USD',
        sourceId: methodId,
        description,
        userId: userId,
        metadata: { idempotency_key: idempotencyKey || `${userId}-${Date.now()}-${amountCents}` },
      });
      
      return result;
    }
  } catch (error) {
    console.error('Error processing user payment method:', error);
    throw error;
  }
}

/**
 * Check which payment methods are available for the user
 */
export async function getAvailablePaymentMethods(userId) {
  try {
    const paymentMethods = await getUserPaymentMethods(userId);
    
    return {
      applePay: !!paymentMethods.applePay,
      googleWallet: !!paymentMethods.googleWallet,
      chime: !!paymentMethods.chime,
      cashApp: !!paymentMethods.cashApp,
    };
  } catch (error) {
    console.error('Error checking available payment methods:', error);
    return {
      applePay: false,
      googleWallet: false,
      chime: false,
      cashApp: false,
    };
  }
}