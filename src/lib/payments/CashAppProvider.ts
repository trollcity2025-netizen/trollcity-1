// src/lib/payments/CashAppProvider.ts
import type { PaymentProvider, PaymentCreateOptions, PaymentSession, PaymentResult } from './PaymentProvider';

export const CashAppProvider: PaymentProvider = {
  id: 'cashapp',
  displayName: 'CashApp Pay',
  logoUrl: '/img/cashapp-logo.svg',

  async createPayment(options: PaymentCreateOptions): Promise<PaymentSession> {
    // Always trigger the manual CashApp modal for coin packages and troll pass
    return {
      sessionId: '',
      provider: 'cashapp',
      approvalUrl: '', // Modal will be opened by UI
      raw: options,
    };
  },

  async capturePayment(sessionId: string, _options?: any): Promise<PaymentResult> {
    return { success: true, provider: 'cashapp', transactionId: sessionId };
  },
};
