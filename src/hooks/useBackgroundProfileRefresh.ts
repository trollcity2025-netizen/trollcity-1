import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'

export const useBackgroundProfileRefresh = () => {
  const refreshProfileInBackground = async (userId?: string, delayMs: number = 500) => {
    if (!userId) {
      const { profile } = useAuthStore.getState()
      userId = profile?.id
    }
    
    if (!userId) return

    // Wait before fetching to allow DB replication
    await new Promise(resolve => setTimeout(resolve, delayMs))

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (!error && data) {
        const currentProfile = useAuthStore.getState().profile
        
        // Only update if values actually changed to prevent unnecessary UI updates
        if (currentProfile && 
            currentProfile.troll_coins === data.troll_coins &&
            currentProfile.free_coin_balance === data.free_coin_balance &&
            currentProfile.total_earned_coins === data.total_earned_coins &&
            currentProfile.total_spent_coins === data.total_spent_coins) {
          // Data hasn't changed, skip update to prevent flickering
          return
        }
        
        useAuthStore.getState().setProfile(data)
      }
    } catch (error) {
      console.error('Background profile refresh error:', error)
    }
  }

  return { refreshProfileInBackground }
}
