import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';

export interface GiftItem {
  id: string;
  name: string;
  icon: string;
  coinCost: number;
  type: 'paid' | 'free';
  slug: string;
}

export function useGiftSystem(
  recipientId: string, 
  streamId: string, 
  battleId?: string | null,
  targetUserId?: string
) {
  const [isSending, setIsSending] = useState(false);
  const { user, refreshProfile } = useAuthStore();

  const sendGift = async (gift: GiftItem): Promise<boolean> => {
    if (!user) {
      toast.error("You must be logged in to send gifts");
      return false;
    }

    if (user.id === recipientId) {
      toast.error("You cannot send gifts to yourself");
      return false;
    }

    setIsSending(true);

    try {
      // Use the unified spend_coins RPC which handles the 10% admin cut
      const { data, error } = await supabase.rpc('spend_coins', {
        p_sender_id: user.id,
        p_receiver_id: recipientId,
        p_coin_amount: gift.coinCost,
        p_reason: `gift:${gift.slug}`,
        p_metadata: {
          stream_id: streamId,
          battle_id: battleId || null,
          gift_name: gift.name,
          gift_icon: gift.icon,
          gift_id: gift.id
        }
      });

      if (error) throw error;

      if (data && data.success) {
        toast.success(`Sent ${gift.name}!`);
        
        // Refresh profile to update balance
        refreshProfile(); 
        
        // Record the gift in stream_gifts table for history/analytics if needed
        // (The RPC might do this, but usually we track it)
        // For now, we trust the RPC handled the transaction.
        
        // We can also manually insert into stream_gifts if the RPC doesn't
        await supabase.from('stream_gifts').insert({
            stream_id: streamId,
            sender_id: user.id,
            receiver_id: recipientId,
            gift_id: gift.id, // Assuming gifts table has UUIDs
            amount: gift.coinCost,
            battle_id: battleId
        });

        return true;
      } else {
        toast.error(data?.message || "Failed to send gift");
        return false;
      }

    } catch (err: any) {
      console.error("Gift error:", err);
      toast.error(err.message || "Transaction failed");
      return false;
    } finally {
      setIsSending(false);
    }
  };

  return {
    sendGift,
    isSending
  };
}
