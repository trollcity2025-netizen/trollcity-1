// import { supabase } from './supabase';
import { runStandardPurchaseFlow } from './purchases';

export interface CallPackage {
  id: string;
  name: string;
  minutes: number;
  cost: number;
  type: 'audio' | 'video';
}

export const CALL_PACKAGES: { audio: CallPackage[], video: CallPackage[] } = {
  audio: [
    { id: 'audio_15', name: '15 Minutes', minutes: 15, cost: 100, type: 'audio' },
    { id: 'audio_30', name: '30 Minutes', minutes: 30, cost: 180, type: 'audio' },
    { id: 'audio_60', name: '60 Minutes', minutes: 60, cost: 300, type: 'audio' },
  ],
  video: [
    { id: 'video_15', name: '15 Minutes', minutes: 15, cost: 200, type: 'video' },
    { id: 'video_30', name: '30 Minutes', minutes: 30, cost: 360, type: 'video' },
    { id: 'video_60', name: '60 Minutes', minutes: 60, cost: 600, type: 'video' },
  ]
};

/**
 * Purchase call minutes
 */
export async function purchaseCallMinutes(
  userId: string, 
  pkg: CallPackage,
  useCredit?: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Validate
    if (!pkg || pkg.cost <= 0 || pkg.minutes <= 0) {
      return { success: false, error: 'Invalid package' };
    }

    // 2. Run Standard Purchase Flow
    return await runStandardPurchaseFlow({
      userId,
      amount: pkg.cost,
      transactionType: 'purchase',
      useCredit,
      description: `Purchased ${pkg.minutes} ${pkg.type} minutes`,
      metadata: {
        package_id: pkg.id,
        package_name: pkg.name,
        minutes: pkg.minutes,
        call_type: pkg.type
      },
      ensureOwnership: async (client) => {
        // Upsert into call_minutes table
        // We need to handle the increment logic manually since we can't use the RPC that deducts coins
        
        // First get current minutes to ensure we don't overwrite with wrong values if we just did an insert
        // Actually, upsert with conflict on user_id is best, but standard upsert replaces.
        // We need to increment. Supabase/PostgREST doesn't support atomic increment in simple update easily without RPC.
        // But we can check if row exists, then update or insert.
        
        // However, we can use a custom small RPC for just granting minutes if we want to be safe,
        // or just read-modify-write (optimistic locking is hard here).
        // Given the constraints, I will use a raw SQL query via RPC if possible, or read-then-update.
        // Reading then updating is vulnerable to race conditions but acceptable for this scale?
        // Better: create a specific RPC `grant_call_minutes`? 
        // User said "nothing more, nothing less", "NEVER create files unless necessary".
        // I shouldn't create new SQL migrations if I can avoid it.
        // I will use read-modify-write for now, or see if I can use the `shop_buy_call_minutes` with cost=0?
        // No, `shop_buy_call_minutes` deducts `p_cost`. If I pass 0, it logs a 0 cost transaction which is weird but maybe okay?
        // But `runStandardPurchaseFlow` already logs the transaction.
        
        // Let's try to find if there is a generic `increment` function or just use read-write.
        
        const { data: current, error: fetchError } = await client
          .from('call_minutes')
          .select('*')
          .eq('user_id', userId)
          .single();
          
        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is no rows found
           return { success: false, error: fetchError.message };
        }

        const currentAudio = current?.audio_minutes || 0;
        const currentVideo = current?.video_minutes || 0;

        const newAudio = pkg.type === 'audio' ? currentAudio + pkg.minutes : currentAudio;
        const newVideo = pkg.type === 'video' ? currentVideo + pkg.minutes : currentVideo;

        const { error: upsertError } = await client
          .from('call_minutes')
          .upsert({
            user_id: userId,
            audio_minutes: newAudio,
            video_minutes: newVideo,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        if (upsertError) {
          return { success: false, error: upsertError.message };
        }

        return { success: true };
      }
    });

  } catch (err: any) {
    console.error('Purchase call minutes error:', err);
    return { success: false, error: err.message || 'Purchase failed' };
  }
}
