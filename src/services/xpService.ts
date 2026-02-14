import { supabase } from '../lib/supabase'

export const xpService = {
  /**
   * Grant XP to a user via RPC (secure backend function)
   */
  grantXP: async (
    userId: string,
    amount: number,
    source: string,
    sourceId: string,
    metadata: any = {}
  ) => {
    // Safety check for inputs
    if (!userId) {
      console.error('[xpService] Missing userId for grantXP');
      return { success: false, error: 'Missing userId' };
    }

    // Skip XP grants for guest IDs (non-UUID format like TC-XXXX)
    if (userId.startsWith('TC-')) {
      console.log('[xpService] Guest user detected, skipping XP grant');
      return { success: true, data: { message: 'Guest skipped' } };
    }

    if (!supabase) {
        console.error('[xpService] CRITICAL: Supabase client is undefined');
        return { success: false, error: 'Supabase client not initialized' };
    }
    
    // Ensure amount is a valid integer
    const safeAmount = Math.floor(Number(amount) || 0);
    if (safeAmount <= 0 && amount !== 0) { // Allow 0 XP grants if needed, but usually we want > 0
       // If amount was intended but invalid (NaN), this catches it.
       // If amount is 0, we might want to skip or proceed. Let's proceed with 0.
    }

    const { data, error } = await supabase.rpc('grant_xp', {
      p_user_id: userId,
      p_amount: safeAmount,
      p_source_type: source,
      p_source_id: sourceId,
      p_metadata: metadata
    })
    
    if (error) {
      console.error('Error granting XP:', error)
      return { success: false, error }
    }
    return { success: true, data }
  },

  /**
   * Simulate a gift event (for testing/dev tools)
   */
  simulateGift: async (userId: string, coinsSpent: number) => {
    // Broadcaster gets 100% of coins as XP
    // Sender gets 25% of coins as XP
    // This function typically runs on server, but we simulate the call here.
    
    // In a real app, 'grant_xp' is called by the webhook or edge function handling the gift.
    // Here we call it directly for the "Dev Simulator".
    
    const sourceId = `sim_gift_${Date.now()}_${Math.random()}`
    
    return await xpService.grantXP(
      userId,
      coinsSpent, // 1 XP per coin
      'gift_received',
      sourceId,
      { simulator: true }
    )
  }
}
