import { useEffect, useRef, useState } from 'react';
import { supabase, getSystemSettings } from '../lib/supabase';
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
  _battleId?: string | null,
  _targetUserId?: string
) {
  const [isSending, setIsSending] = useState(false);
  const [giftsDisabled, setGiftsDisabled] = useState(false);
  const [giftsDisabledReason, setGiftsDisabledReason] = useState<string | null>(null);
  const { user, refreshProfile } = useAuthStore();

  // Simple client-side circuit breaker
  const circuitRef = useRef<{ openUntil: number }>({ openUntil: 0 });

  useEffect(() => {
    getSystemSettings()
      .then((settings) => {
        setGiftsDisabled(!!settings?.gifts_disabled);
        setGiftsDisabledReason(settings?.gifts_disabled_reason || null);
      })
      .catch(() => {
        // ignore - don't block gifting on fetch failure
      });
  }, []);

  const sendGift = async (gift: GiftItem, targetIdOverride?: string, quantity: number = 1): Promise<boolean> => {
    const now = Date.now();
    if (circuitRef.current.openUntil > now) {
      toast.error('Gifting is temporarily paused. Please try again shortly.');
      return false;
    }

    if (giftsDisabled) {
      toast.error(giftsDisabledReason || 'Gifting is temporarily disabled.');
      return false;
    }

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
      const msg = err?.message || "Transaction failed";
      if (String(msg).toLowerCase().includes('rate limit')) {
        toast.error('You are sending gifts too fast. Please slow down.');
      } else {
        toast.error(msg);
      }

      if (
        String(msg).toLowerCase().includes('timeout') ||
        String(msg).toLowerCase().includes('deadlock') ||
        String(msg).toLowerCase().includes('could not obtain lock')
      ) {
        circuitRef.current.openUntil = Date.now() + 60_000; // 60s cooldown
      }
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
