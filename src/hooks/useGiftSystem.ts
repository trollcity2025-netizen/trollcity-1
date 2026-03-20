import { useEffect, useRef, useState } from 'react';
import { supabase, getSystemSettings } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { generateUUID } from '../lib/uuid';
import { OFFICIAL_GIFTS } from '../lib/giftConstants';
import { notifyGiftReceived } from '../lib/notifications';

// Calculate discount based on trollmonds balance
// 10% discount per 100 trollmonds (e.g., 200 trollmonds = 20% off)
export function getTrollmondDiscount(trollmonds: number): number {
  // Every 100 trollmonds gives 10% discount
  const discountPercent = Math.floor(trollmonds / 100) * 10;
  // Cap at 100%
  return Math.min(discountPercent, 100);
}

// Calculate how many trollmonds will be deducted per gift
export function getTrollmondDeduction(trollmonds: number): number {
  // 100 trollmonds deducted per gift sent (regardless of gift size)
  return trollmonds >= 100 ? 100 : 0;
}

// Calculate discounted price
export function getDiscountedPrice(basePrice: number, discountPercent: number): number {
  return Math.floor(basePrice * (1 - discountPercent / 100));
}

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
  _targetUserId?: string,
  sharedChannel?: any  // Optional shared channel for broadcasting
) {
  const [isSending, setIsSending] = useState(false);
  const [giftsDisabled, setGiftsDisabled] = useState(false);
  const [giftsDisabledReason, setGiftsDisabledReason] = useState<string | null>(null);
  const { user, refreshProfile } = useAuthStore();

  // Simple client-side circuit breaker
  const circuitRef = useRef<{ openUntil: number }>({ openUntil: 0 });
  
  // Track if we're currently subscribing to avoid multiple subscriptions
  const isSubscribingRef = useRef(false);

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

    // For logged-in users, check if sending to themselves
    // For guests (no user), they can't send gifts anyway, but we check to be safe
    if (user && user.id === finalRecipientId) {
      toast.error("You cannot send gifts to yourself");
      return false;
    }

    // Guests cannot send gifts - they need to be logged in
    if (!user) {
      toast.error("You must be logged in to send gifts");
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
        p_receiver_id: finalRecipientId,
        p_stream_id: streamId || null,
        p_gift_id: gift.id,
        p_quantity: quantity,
        p_metadata: { txn_key: txnKey }
      });

      console.log('[GiftDebugger-2] RPC Result:', { data, error });

      if (error) throw error;

       if (data && data.success) {
         // Get sender's profile for username
         let senderName = 'Someone';
         try {
           const { data: profileData } = await supabase
             .from('user_profiles')
             .select('username')
             .eq('id', user.id)
             .single();
           if (profileData?.username) {
             senderName = profileData.username;
           }
         } catch (profileErr) {
           console.warn('[GiftSystem] Could not fetch sender profile:', profileErr);
         }
        
        // Get gift icon - try multiple lookups to find the correct icon
        let giftIcon = '🎁';
        const officialGiftById = OFFICIAL_GIFTS.find(g => g.id === gift.id);
        const officialGiftBySlug = OFFICIAL_GIFTS.find(g => 
          g.id.toLowerCase().replace(/_/g, '-') === gift.slug?.toLowerCase() ||
          g.id.toLowerCase() === gift.slug?.toLowerCase().replace(/-/g, '_')
        );
        const officialGift = officialGiftById || officialGiftBySlug;
        if (officialGift) {
          giftIcon = officialGift.icon;
        } else if (gift.icon) {
          giftIcon = gift.icon;
        }
        
        // Broadcast event for animations via Supabase realtime channel
        try {
          if (streamId) {
            const payload = {
              id: generateUUID(),
              gift_id: gift.id,
              gift_slug: gift.slug,
              gift_name: gift.name,
              gift_icon: giftIcon,
              amount: gift.coinCost * quantity,
              quantity: quantity,
              sender_id: user.id,
              sender_name: senderName,
              receiver_id: finalRecipientId,
              timestamp: new Date().toISOString()
            };
            
            // Use shared channel if available, otherwise create new one
            if (sharedChannel) {
              // Use the shared channel that's already subscribed
              await sharedChannel.send({
                type: 'broadcast',
                event: 'gift_sent',
                payload
              });
              console.log('[GiftSystem] Gift broadcast via shared channel');
            } else {
              // Fallback: create ephemeral channel with the SAME name as the main stream channel
              // This ensures all users receive the broadcast regardless of when they joined
              const channel = supabase.channel(`stream:${streamId}`);
              
              // Subscribe and send immediately
              channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                  channel.send({
                    type: 'broadcast',
                    event: 'gift_sent',
                    payload
                  });
                  console.log('[GiftSystem] Gift broadcast via ephemeral channel (stream:${streamId})');
                  
                  // Clean up after a short delay
                  setTimeout(() => {
                    supabase.removeChannel(channel);
                  }, 500);
                }
              });
            }
          }
        } catch (broadcastErr) {
          console.warn('[GiftSystem] Could not broadcast gift event:', broadcastErr);
        }
        
         // Also send a chat message via Supabase broadcast
        try {
          if (streamId) {
            const txnId = generateUUID();
            const chatChannel = supabase.channel(`stream:${streamId}`);
            await chatChannel.subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                chatChannel.send({
                  type: 'broadcast',
                  event: 'chat-message',
                  payload: {
                    id: txnId,
                    txn_id: txnId,
                    user_id: user.id,
                    content: `${senderName} sent ${gift.name} x${quantity}`,
                    created_at: new Date().toISOString(),
                    type: 'chat',
                    gift_type: gift.slug,
                    gift_amount: quantity,
                    sender_name: senderName,
                    user_profiles: {
                      username: senderName,
                      avatar_url: null
                    }
                  }
                });
                // Unsubscribe after sending
                setTimeout(() => {
                  supabase.removeChannel(chatChannel);
                }, 1000);
              }
            });
          }
        } catch (chatErr) {
          console.warn('[GiftSystem] Could not send chat message:', chatErr);
        }
        
         // Refresh sender's profile to update balance in real-time
        // Use non-blocking refresh to avoid disrupting Agora connection
        refreshProfile().catch(err => {
          console.warn('[GiftSystem] Profile refresh failed:', err);
        });

        // Create notification for the receiver (if not sending to self)
        // Also refresh receiver's profile so they see updated balance in real-time
        if (finalRecipientId !== user.id) {
          const totalCoins = gift.coinCost * quantity;
          
          // Create notification for receiver
          notifyGiftReceived(
            finalRecipientId,
            user.id,
            totalCoins,
            streamId || undefined
          ).catch(err => {
            console.warn('[GiftSystem] Failed to create notification:', err);
          });
          
          // If receiver is different from sender, we need to trigger a profile refresh for them
          // This is done via the notification system which will cause a refresh when they check it
          // For real-time update, we also need to inform the receiver's client
          // The realtime channel will broadcast this via gift_sent event
        }

        // If the receiver is the current user, refresh their profile to see updated balance (e.g., broadcaster receiving gift)
        if (finalRecipientId === user.id) {
          refreshProfile().catch(err => {
            console.warn('[GiftSystem] Profile refresh failed for receiver:', err);
          });
        }
        
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
