import { supabase } from '../supabaseClient'

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
    const { data, error } = await supabase.rpc('grant_xp', {
      p_user_id: userId,
      p_amount: amount,
      p_source: source,
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
