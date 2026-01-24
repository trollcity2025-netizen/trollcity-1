// src/lib/payments/PayPalProvider.ts
import { supabase } from '../supabase';
import type { PaymentProvider, PaymentCreateOptions, PaymentSession, PaymentResult } from './PaymentProvider';

export const PayPalProvider: PaymentProvider = {
  id: 'paypal',
  displayName: 'PayPal',
  logoUrl: '/img/paypal-logo.svg',

  async createPayment(options: PaymentCreateOptions): Promise<PaymentSession> {
    try {
      const { data, error } = await supabase.functions.invoke('paypal-create-order', {
        body: {
          amount: options.amount,
          currency: options.currency,
          userId: options.userId,
          productType: options.productType,
          packageId: options.packageId,
          metadata: options.metadata,
        }
      });

      if (error) throw error;
      
      if (!data.orderId) {
        throw new Error(data.error || 'Failed to create PayPal order');
      }

      return {
        sessionId: data.orderId,
        provider: 'paypal',
        approvalUrl: data.approvalUrl,
        raw: data,
      };
    } catch (err: any) {
      console.error('[PayPal] Create payment error:', err);
      throw new Error(err.message || 'Failed to create PayPal order');
    }
  },

  async capturePayment(sessionId: string, options?: any): Promise<PaymentResult> {
    try {
      const { data, error } = await supabase.functions.invoke('paypal-complete-order', {
        body: {
          orderId: sessionId,
          userId: options?.userId,
          packageId: options?.packageId
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to fulfill PayPal purchase');
      
      return { success: true, provider: 'paypal', transactionId: sessionId };
    } catch (err: any) {
      console.error('[PayPal] Capture error:', err);
      throw new Error(err.message || 'Failed to capture PayPal payment');
    }
  },
};
