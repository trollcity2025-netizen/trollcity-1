import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { generateUUID } from '../lib/uuid';

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
  _targetUserId?: string
) {
  const [isSending, setIsSending] = useState(false);
  const { user, refreshProfile } = useAuthStore();

  const sendGift = async (gift: GiftItem, targetIdOverride?: string, quantity: number = 1): Promise<boolean> => {
    if (!user) {
      toast.error("You must be logged in to send gifts");
      return false;
    }

    const finalRecipientId = targetIdOverride || recipientId;

    if (user.id === finalRecipientId) {
      toast.error("You cannot send gifts to yourself");
      return false;
    }

    setIsSending(true);

    try {
      const txnKey = `${user.id}_${streamId}_${gift.id}_${Date.now()}`;
      
      console.log('[GiftDebugger-2] Sending gift...', {
        sender: user.id,
        receiver: finalRecipientId,
        streamId: streamId || null,
        giftId: gift.id,
        cost: gift.coinCost,
        quantity,
        txnKey
      });

      // Use the new idempotent send_gift_in_stream RPC
      const { data, error } = await supabase.rpc('send_gift_in_stream', {
        p_sender_id: user.id,
        p_stream_id: streamId || null,
        p_gift_id: gift.id,
        p_txn_key: txnKey
      });

      console.log('[GiftDebugger-2] RPC Result:', { data, error });

      if (error) throw error;

      if (data && data.success) {
        toast.success(`Sent ${gift.name}!`);
        
        // Broadcast event for animations (Optimistic + RPC backup)
        // RPC might not trigger broadcast immediately or correctly for all clients
        // We manually broadcast here to ensure immediate visual feedback
        const channel = supabase.channel(`stream_events_${streamId}`);
        await channel.send({
            type: 'broadcast',
            event: 'gift_sent',
            payload: {
                id: generateUUID(),
                gift_id: gift.id,
                gift_slug: gift.slug,
                gift_name: gift.name,
                amount: gift.coinCost * quantity,
                sender_id: user.id,
                receiver_id: finalRecipientId,
                timestamp: new Date().toISOString()
            }
        });
        
        // Refresh profile to update balance (Optimistic)
        refreshProfile(); 
        
        // XP is now granted server-side within send_premium_gift to prevent farming exploits
        // Client-side XP calls removed.
        
        // NO manual insert into stream_gifts. 
        // The ledger processor will handle history and stats.
        
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
