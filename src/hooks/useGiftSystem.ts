import { useEffect, useRef, useState } from 'react';
import { supabase, getSystemSettings } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { generateUUID } from '../lib/uuid';
import { OFFICIAL_GIFTS } from '../lib/giftConstants';
import { notifyGiftReceived } from '../lib/notifications';
import { useMissionProgress } from './useMissionProgress';

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
  animationType?: string;
}

export function useGiftSystem(
  recipientId: string, 
  streamId: string, 
  _battleId?: string | null,
  _targetUserId?: string,
  sharedChannel?: any  // Optional shared channel for broadcasting
) {
  console.log('[GiftSystem] useGiftSystem initialized with sharedChannel:', !!sharedChannel, 'streamId:', streamId);
  
  const [isSending, setIsSending] = useState(false);
  const [giftsDisabled, setGiftsDisabled] = useState(false);
  const [giftsDisabledReason, setGiftsDisabledReason] = useState<string | null>(null);
  const { user } = useAuthStore();
  const { trackGiftSent } = useMissionProgress(streamId);

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
    const finalRecipientId = targetIdOverride || recipientId;

    console.log('[GiftSystem] sendGift invoked', {
      senderId: user?.id || null,
      finalRecipientId,
      streamId,
      giftId: gift?.id,
      quantity,
      giftsDisabled,
      circuitOpen: circuitRef.current.openUntil > now,
    });

    if (circuitRef.current.openUntil > now) {
      console.warn('[GiftSystem] sendGift blocked: circuit open');
      toast.error('Gifting is temporarily paused. Please try again shortly.');
      return false;
    }

    if (giftsDisabled) {
      console.warn('[GiftSystem] sendGift blocked: gifts disabled', { reason: giftsDisabledReason });
      toast.error(giftsDisabledReason || 'Gifting is temporarily disabled.');
      return false;
    }

    if (!user) {
      console.warn('[GiftSystem] sendGift blocked: no authenticated user');
      toast.error("You must be logged in to send gifts");
      return false;
    }

    // For logged-in users, check if sending to themselves
    // For guests (no user), they can't send gifts anyway, but we check to be safe
    if (user && user.id === finalRecipientId) {
      console.warn('[GiftSystem] sendGift blocked: self-send attempted', {
        userId: user.id,
        finalRecipientId,
        streamId,
      });
      toast.error("You cannot send gifts to yourself");
      return false;
    }

    // Guests cannot send gifts - they need to be logged in
    if (!user) {
      console.warn('[GiftSystem] sendGift blocked: no user after recipient resolution');
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

      // Deduct 100 trollmonds for ANY gift sent (if sender has 100+ trollmonds)
      // This applies to all gifts regardless of currency
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('trollmonds')
        .eq('id', user.id)
        .single();
      
      const senderTrollmonds = profileData?.trollmonds || 0;
      
      // Deduct 100 trollmonds per gift if sender has 100+
      if (senderTrollmonds >= 100) {
        const trollmondDeduction = 100 * quantity;
        await supabase.rpc('increment_trollmonds', {
          p_user_id: user.id,
          p_amount: -trollmondDeduction
        });
      }
      
      // Now send the gift via the appropriate RPC
      let data, error;
      
      // First, check the currency from gift_items table
      const { data: giftData } = await supabase
        .from('gift_items')
        .select('currency, value')
        .eq('id', gift.id)
        .maybeSingle();
      
      const giftCurrency = giftData?.currency || 'troll_coins';
      
      if (giftCurrency === 'trollmonds') {
        // Use send_gift_in_stream for trollmonds gifts (as they're stored in gifts table too)
        const result = await supabase.rpc('send_gift_in_stream', {
          p_sender_id: user.id,
          p_receiver_id: finalRecipientId,
          p_stream_id: streamId || null,
          p_gift_id: gift.id,
          p_quantity: quantity,
          p_metadata: { txn_key: txnKey, trollmonds_deducted: senderTrollmonds >= 100 ? 100 * quantity : 0 }
        });
        data = result.data;
        error = result.error;
      } else {
        // Use send_gift_in_stream for troll_coins
        const result = await supabase.rpc('send_gift_in_stream', {
          p_sender_id: user.id,
          p_receiver_id: finalRecipientId,
          p_stream_id: streamId || null,
          p_gift_id: gift.id,
          p_quantity: quantity,
          p_metadata: { txn_key: txnKey, trollmonds_deducted: senderTrollmonds >= 100 ? 100 * quantity : 0 }
        });
        data = result.data;
        error = result.error;
      }

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
        console.log('[GiftSystem] === BROADCAST SECTION START ===');
        try {
          if (streamId) {
            const payload = {
              id: generateUUID(),
              gift_id: gift.id,
              gift_slug: gift.slug,
              gift_name: gift.name,
              gift_icon: giftIcon,
              animation_type: gift.animationType,
              amount: gift.coinCost * quantity,
              quantity: quantity,
              sender_id: user.id,
              sender_name: senderName,
              receiver_id: finalRecipientId,
              timestamp: new Date().toISOString(),
              streamId: streamId,
              stream_id: streamId
            };
            
            const giftChannelName = `stream-gifts:${streamId}`;
            console.log('[GiftSystem] 🚀 Publishing gift to unified channel', { giftChannelName, payload });

            // Always use dedicated stream-gifts channel for gifts (not shared channel)
            const giftChannel = supabase.channel(giftChannelName, {
              config: {
                presence: { key: null }  // Don't track presence on this channel
              }
            });
            
            giftChannel.subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                giftChannel.send({
                  type: 'broadcast',
                  event: 'gift_sent',
                  payload
                });
                console.log('[GiftSystem] ✅ Gift published to stream-gifts channel:', giftChannelName);
                
                // Clean up after a short delay
                setTimeout(() => {
                  supabase.removeChannel(giftChannel);
                }, 500);
              } else {
                console.warn('[GiftSystem] ⚠️ Gift channel subscribe failed:', status);
              }
            });
          }
        } catch (broadcastErr) {
          console.warn('[GiftSystem] Could not broadcast gift event:', broadcastErr);
        }
        
        // Also send a chat message via Supabase broadcast
        console.log('[GiftSystem] === CHAT MESSAGE DEBUG ===');
        console.log('[GiftSystem] streamId:', streamId);
        console.log('[GiftSystem] sharedChannel:', sharedChannel ? 'exists' : 'null/undefined');
        
        try {
          if (streamId) {
            const txnId = generateUUID();
            // Get recipient username for display in chat
            let receiverName = 'user';
            try {
              const { data: receiverProfile } = await supabase
                .from('user_profiles')
                .select('username')
                .eq('id', finalRecipientId)
                .single();
              if (receiverProfile?.username) {
                receiverName = receiverProfile.username;
              }
            } catch (recErr) {
              console.warn('[GiftSystem] Could not fetch receiver profile:', recErr);
            }
            
            // Use shared channel if available, otherwise create new one
            // This ensures the message goes to BroadcastChat
            const chatPayload = {
              id: txnId,
              txn_id: txnId,
              user_id: user.id,
              content: `GIFT_EVENT:${gift.slug}:${quantity}`,
              created_at: new Date().toISOString(),
              type: 'gift',
              gift_type: gift.slug,
              gift_amount: quantity,
              sender_name: senderName,
              receiver_id: finalRecipientId,
              receiver_name: receiverName,
              user_profiles: {
                username: senderName,
                avatar_url: null
              }
            };
            
            // ALWAYS send on a dedicated channel as backup, in addition to sharedChannel
            const chatChannel = supabase.channel(`stream:${streamId}`);
            chatChannel.subscribe((status) => {
              console.log('[GiftSystem] Chat channel subscribe status:', status);
              if (status === 'SUBSCRIBED') {
                chatChannel.send({
                  type: 'broadcast',
                  event: 'chat-message',
                  payload: chatPayload
                });
                console.log('[GiftSystem] Gift chat message sent on stream:' + streamId);
                // Keep channel for a moment then clean up
                setTimeout(() => {
                  supabase.removeChannel(chatChannel);
                }, 2000);
              }
            });
            
            // Also try sharedChannel if available
            if (sharedChannel) {
              console.log('[GiftSystem] Also sending via sharedChannel');
              sharedChannel.send({
                type: 'broadcast',
                event: 'chat-message',
                payload: chatPayload
              }).catch(e => console.log('[GiftSystem] sharedChannel send error:', e));
            }
          }
        } catch (chatErr) {
          console.warn('[GiftSystem] Could not send chat message:', chatErr);
        }
        
        // Create notification for the receiver (if not sending to self)
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
        }
        
        // XP is now granted server-side within send_premium_gift to prevent farming exploits
        // Client-side XP calls removed.

        // NO manual insert into stream_gifts.
        // The ledger processor will handle history and stats.

        // Track mission progress
        if (streamId) {
          trackGiftSent(gift.coinCost * quantity);
        }

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
