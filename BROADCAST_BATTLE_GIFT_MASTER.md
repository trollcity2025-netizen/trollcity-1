# BROADCAST, BATTLE, & GIFT SYSTEM MASTER CONTEXT

This file contains the consolidated source code for the broadcast system, battle system, and gift sending functionality. 
It is intended for analysis and providing a final "fix-all" prompt.

---

## FILE: e:\trollcity-1\src\types\broadcast.ts
```typescript
export type StreamStatus = 'pending' | 'live' | 'ended';
export type LayoutMode = 'grid' | 'battle' | 'spotlight';

export interface Stream {
  id: string;
  user_id: string;
  title: string;
  category: string;
  status: StreamStatus;
  is_battle: boolean;
  battle_id?: string;
  viewer_count: number;
  box_count: number;
  layout_mode: LayoutMode;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  seat_price: number;
  are_seats_locked: boolean;
  has_rgb_effect: boolean;
  rgb_purchased?: boolean;
  active_theme_url?: string;
  hls_path?: string;
  hls_url?: string;
}

export interface StreamGuest {
  id: string;
  stream_id: string;
  user_id: string;
  status: 'invited' | 'accepted' | 'rejected' | 'joined' | 'left';
  type: 'guest' | 'cohost';
  created_at: string;
}

export interface Gift {
  id: string;
  name: string;
  cost: number;
  icon_url: string;
  animation_url?: string;
}

export interface StreamGift {
  id: string;
  stream_id: string;
  sender_id: string;
  recipient_id: string;
  gift_id: string;
  created_at: string;
  sender?: {
    username: string;
    avatar_url: string;
  };
  gift?: Gift;
}

export interface ChatMessage {
  id: string;
  stream_id: string;
  user_id: string;
  content: string;
  created_at: string;
  type?: 'chat' | 'system';
  user?: {
    username: string;
    avatar_url: string;
  };
  user_profiles?: {
    username: string;
    avatar_url: string;
    role?: string;
    troll_role?: string;
    created_at?: string;
    rgb_username_expires_at?: string;
    glowing_username_color?: string;
  };
  vehicle_status?: any; // Avoiding circular dependency or complex type for now
}
```

---

## FILE: e:\trollcity-1\src\pages\broadcast\BroadcastPage.tsx
```tsx
import React, { useEffect, useState, useRef } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { LiveKitRoom, RoomAudioRenderer, StartAudio, useLocalParticipant, useParticipants, useRoomContext } from '@livekit/components-react';
import '@livekit/components-styles';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { useLiveKitToken } from '../../hooks/useLiveKitToken';
import { useViewerTracking } from '../../hooks/useViewerTracking';
import { ListenerEntranceEffect } from '../../hooks/useListenerEntranceEffect';
import { PublishEntranceOnJoin } from '../../hooks/usePublishEntranceOnJoin';
import { ListenForEntrances } from '../../hooks/useListenForEntrances';
import { Stream, ChatMessage } from '../../types/broadcast';
import BroadcastGrid from '../../components/broadcast/BroadcastGrid';
import BroadcastChat from '../../components/broadcast/BroadcastChat';
import BroadcastControls from '../../components/broadcast/BroadcastControls';
import GiftTray from '../../components/broadcast/GiftTray';
import MobileBroadcastLayout from '../../components/broadcast/MobileBroadcastLayout';
import { useMobileBreakpoint } from '../../hooks/useMobileBreakpoint';
import { useStreamChat } from '../../hooks/useStreamChat';
import { Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useStreamSeats, SeatSession } from '../../hooks/useStreamSeats';
import { useStreamEndListener } from '../../hooks/useStreamEndListener';
import { coinOptimizer } from '../../lib/coinRotation';
import VideoViewer from '../../components/broadcast/VideoViewer';
import BattleView from '../../components/broadcast/BattleView';
import BattleControlsList from '../../components/broadcast/BattleControlsList';
import PreflightPublisher from '../../components/broadcast/PreflightPublisher';
import { PreflightStore } from '../../lib/preflightStore';
import { MobileErrorLogger } from '../../lib/MobileErrorLogger';

import BroadcastHeader from '../../components/broadcast/BroadcastHeader';
import BroadcastEffectsLayer from '../../components/broadcast/BroadcastEffectsLayer';
import ErrorBoundary from '../../components/ErrorBoundary';

// Helper component to sync Room state with Mode (force publish/unpublish)
const RoomStateSync = ({ mode, isHost, streamId }: { mode: 'stage' | 'viewer'; isHost: boolean; streamId: string }) => {
    const { localParticipant } = useLocalParticipant();
    const room = useRoomContext();
    const lastModeRef = useRef(mode);
    
    // ✅ Fix D: Update status to 'live' after successful connection
    useEffect(() => {
        if (isHost && room.state === 'connected') {
            console.log('[RoomStateSync] Host connected, updating stream status to live...');
            supabase.from('streams')
                .update({ 
                    status: 'live', 
                    is_live: true,
                    // Ensure started_at is set if it wasn't
                })
                .eq('id', streamId)
                .then(({ error }) => {
                    if (error) console.error('[RoomStateSync] Failed to update stream status:', error);
                    else console.log('[RoomStateSync] Stream marked as live');
                });

            // TRAE FIX: Clear is_battle flag after a delay to ensure transition webhooks are ignored.
            // When returning from BattleView, we keep is_battle=true to prevent the webhook from ending the stream
            // due to the brief disconnection. We clear it here after the connection is stable.
            const timer = setTimeout(async () => {
                const { error } = await supabase.from('streams').update({ is_battle: false }).eq('id', streamId);
                if (!error) console.log('[RoomStateSync] Cleared battle mode flag');
            }, 15000); // 15 seconds safety window

            return () => clearTimeout(timer);
        }
    }, [isHost, room.state, streamId]);
    
    useEffect(() => {
        if (!localParticipant) return;

        const syncState = async () => {
            const isModeChange = lastModeRef.current !== mode;
            lastModeRef.current = mode;

            try {
                if (mode === 'stage') {
                    // Force enable media ONLY when joining stage (transitioning from viewer)
                    // This prevents re-enabling mic when user manually mutes (which triggers this effect)
                    if (isModeChange) {
                        // Ensure track is published if not already
                        for (const pub of localParticipant.trackPublications.values()) {
                            if (pub.kind === 'video' && pub.isMuted) {
                                await pub.unmute();
                            }
                            if (pub.kind === 'audio' && pub.isMuted) {
                                await pub.unmute();
                            }
                        }

                        if (!localParticipant.isCameraEnabled) {
                            console.log('[RoomStateSync] Joining stage: Enabling Camera');
                            try {
                                await localParticipant.setCameraEnabled(true);
                            } catch (e) {
                                console.warn('[RoomStateSync] Failed to enable camera (likely not connected yet):', e);
                            }
                        }
                        if (!localParticipant.isMicrophoneEnabled) {
                            console.log('[RoomStateSync] Joining stage: Enabling Mic');
                            try {
                                await localParticipant.setMicrophoneEnabled(true);
                            } catch (e) {
                                console.warn('[RoomStateSync] Failed to enable mic (likely not connected yet):', e);
                            }
                        }
                    }
                } else {
                    // We are a viewer. Force unpublish.
                    // STRICT RULE: Downgrade role and stop all streams
                    console.log('[RoomStateSync] Downgrading to viewer: Stopping all tracks');
                    
                    const tracks = localParticipant.trackPublications;
                    if (tracks) {
                        for (const pub of tracks.values()) {
                            if (pub.track) {
                                try {
                                    await localParticipant.unpublishTrack(pub.track);
                                } catch (e) {
                                    console.warn('[RoomStateSync] Error unpublishing track:', e);
                                }
                            }
                        }
                    }

                    if (localParticipant.isMicrophoneEnabled) {
                        await localParticipant.setMicrophoneEnabled(false);
                    }
                    if (localParticipant.isCameraEnabled) {
                        await localParticipant.setCameraEnabled(false);
                    }
                }
            } catch (error) {
                console.error('[RoomStateSync] Error syncing state:', error);
            }
        };

        syncState();
    }, [mode, localParticipant]);

    return null;
};
// ... rest of BroadcastPage (truncated for brevity but logically complete for this file)
```

---

## FILE: e:\trollcity-1\src\components\broadcast\BattleView.tsx
```tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  useLocalParticipant, 
  useParticipants, 
  useTracks, 
  VideoTrack,
  ParticipantContext,
  TrackRefContext
} from '@livekit/components-react';
import { LocalTrack, Track, Participant } from 'livekit-client';
import { supabase } from '../../lib/supabase';
import { Stream } from '../../types/broadcast';
import { useAuthStore } from '../../lib/store';
import { Loader2, Coins, User, MicOff, VideoOff } from 'lucide-react';
import BroadcastChat from './BroadcastChat';
import MuteHandler from './MuteHandler';
import GiftAnimationOverlay from './GiftAnimationOverlay';
import GiftTray from './GiftTray';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

// --- Sub-components for the new architecture ---

/**
 * Ensures the host/guest is unmuted when joining the battle room
 */
const BattleRoomSync = ({ isBroadcaster }: { isBroadcaster: boolean }) => {
    const { localParticipant } = useLocalParticipant();

    useEffect(() => {
        if (!localParticipant || !isBroadcaster) return;

        const syncState = async () => {
            try {
                const publications = localParticipant.getTrackPublications();
                if (publications) {
                    for (const pub of publications.values()) {
                        if (pub.track?.kind === 'video' && pub.isMuted) {
                            await (pub.track as LocalTrack).unmute();
                        }
                        if (pub.track?.kind === 'audio' && pub.isMuted) {
                            await (pub.track as LocalTrack).unmute();
                        }
                    }
                }

                if (!localParticipant.isCameraEnabled) {
                    await localParticipant.setCameraEnabled(true);
                }
                if (!localParticipant.isMicrophoneEnabled) {
                    await localParticipant.setMicrophoneEnabled(true);
                }
            } catch (error) {
                console.error('[BattleRoomSync] Error syncing state:', error);
            }
        };

        syncState();
    }, [isBroadcaster, localParticipant]);

    return null;
};

/**
 * Individual participant tile in the battle arena
 */
const BattleParticipantTile = ({ 
  participant, 
  side 
}: { 
  participant: Participant; 
  side: 'challenger' | 'opponent' 
}) => {
  const cameraTracks = useTracks([Track.Source.Camera]);
  const track = cameraTracks.find((t) => t.participant.identity === participant.identity);
  
  const metadata = useMemo(() => {
    try {
      return JSON.parse(participant.metadata || '{}');
    } catch (e) {
      return {};
    }
  }, [participant.metadata]);

  const isHost = metadata.role === 'host';
  const isMuted = !participant.isMicrophoneEnabled;

  return (
    <div className={cn(
      "relative bg-zinc-900/50 rounded-xl overflow-hidden border transition-all duration-300",
      isHost ? "h-64 border-amber-500/30" : "h-40 border-white/10",
      side === 'challenger' ? "hover:border-purple-500/50" : "hover:border-emerald-500/50"
    )}>
      {track && participant.isCameraEnabled ? (
        <VideoTrack
          trackRef={track}
          className={cn('w-full h-full object-cover', participant.isLocal && 'scale-x-[-1]')}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900">
           <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center border-2 border-white/10 mb-2">
              <User className="text-zinc-500" size={32} />
           </div>
           <div className="flex items-center gap-2 text-zinc-400 text-xs">
              <VideoOff size={14} />
              <span>Camera Off</span>
           </div>
        </div>
      )}

      {/* Overlay Info */}
      <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-10">
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
          <span className={cn(
            "text-xs font-bold",
            isHost ? "text-amber-400" : "text-white"
          )}>
            {participant.name || 'Anonymous'}
          </span>
          {isHost && (
            <span className="text-[8px] bg-red-600 px-1 rounded text-white font-bold uppercase">HOST</span>
          )}
        </div>
        
        {isMuted && (
          <div className="bg-red-500 p-1 rounded-full">
            <MicOff size={12} className="text-white" />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * The main split arena component
 */
const BattleArena = ({ onGift }: { onGift: (uid: string, sourceStreamId: string) => void }) => {
  const participants = useParticipants();
  
  const categorized = useMemo(() => {
    const teams = {
      challenger: { host: null as Participant | null, guests: [] as Participant[] },
      opponent: { host: null as Participant | null, guests: [] as Participant[] }
    };

    participants.forEach(p => {
      try {
        const meta = JSON.parse(p.metadata || '{}');
        const team = meta.team as 'challenger' | 'opponent';
        const role = meta.role;

        if (team === 'challenger' || team === 'opponent') {
          if (role === 'host') {
            teams[team].host = p;
          } else if (role === 'stage') {
            teams[team].guests.push(p);
          }
        }
      } catch (e) {}
    });

    // Sort guests by seat index if available
    const sortBySeat = (a: Participant, b: Participant) => {
      const metaA = JSON.parse(a.metadata || '{}');
      const metaB = JSON.parse(b.metadata || '{}');
      return (metaA.seatIndex || 0) - (metaB.seatIndex || 0);
    };
    
    teams.challenger.guests.sort(sortBySeat);
    teams.opponent.guests.sort(sortBySeat);

    return teams;
  }, [participants]);

  const handleGiftClick = (p: Participant) => {
    try {
      const meta = JSON.parse(p.metadata || '{}');
      if (meta.sourceStreamId) {
        onGift(p.identity, meta.sourceStreamId);
      }
    } catch (e) {}
  };

  return (
    <div className="flex-1 flex overflow-hidden p-4 gap-4 bg-black/40">
      {/* Challenger Side */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-hide">
        {categorized.challenger.host && (
          <div onClick={() => handleGiftClick(categorized.challenger.host!)} className="cursor-pointer">
            <BattleParticipantTile participant={categorized.challenger.host} side="challenger" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          {categorized.challenger.guests.map(p => (
            <div key={p.identity} onClick={() => handleGiftClick(p)} className="cursor-pointer">
              <BattleParticipantTile participant={p} side="challenger" />
            </div>
          ))}
        </div>
      </div>

      {/* VS Divider (Visual Only) */}
      <div className="w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

      {/* Opponent Side */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pl-2 scrollbar-hide">
        {categorized.opponent.host && (
          <div onClick={() => handleGiftClick(categorized.opponent.host!)} className="cursor-pointer">
            <BattleParticipantTile participant={categorized.opponent.host} side="opponent" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          {categorized.opponent.guests.map(p => (
            <div key={p.identity} onClick={() => handleGiftClick(p)} className="cursor-pointer">
              <BattleParticipantTile participant={p} side="opponent" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
// ... rest of BattleView (Timer logic, LiveKit initialization, etc.)
```

---

## FILE: e:\trollcity-1\src\components\broadcast\GiftTray.tsx
```tsx
import React, { useEffect, useState } from 'react';
import { X, Coins, Loader2, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useGiftSystem, GiftItem } from '../../lib/hooks/useGiftSystem';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface GiftTrayProps {
  recipientId: string;
  streamId: string;
  onClose: () => void;
  battleId?: string | null;
  allRecipients?: string[];
}

export default function GiftTray({ recipientId, streamId, onClose, battleId, allRecipients }: GiftTrayProps) {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const { sendGift, isSending } = useGiftSystem(recipientId, streamId, battleId, recipientId);
  const { profile } = useAuthStore();
  const [sendingToAll, setSendingToAll] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);

  useEffect(() => {
    const fetchGifts = async () => {
      try {
        const { data, error } = await supabase
          .from('purchasable_items')
          .select('*')
          .eq('category', 'gift')
          .eq('is_active', true)
          .order('coin_price', { ascending: true });

        let mappedGifts: GiftItem[] = [];

        if (data && data.length > 0) {
          mappedGifts = data.map((g: any) => ({
            id: g.id,
            name: g.display_name,
            icon: g.metadata?.icon || '🎁',
            coinCost: g.coin_price || 0,
            type: 'paid' as const,
            slug: g.item_key,
            category: g.category,
            subcategory: g.metadata?.subcategory || 'Misc'
          }));
        } else {
           // Fallback to gift_items table if purchasable_items is empty
           const { data: legacyGifts } = await supabase
             .from('gift_items')
             .select('*')
             .order('value', { ascending: true });
            
           if (legacyGifts && legacyGifts.length > 0) {
              mappedGifts = legacyGifts.map((g: any) => ({
                id: g.id,
                name: g.name,
                icon: g.icon,
                coinCost: g.value,
                type: 'paid' as const,
                slug: g.gift_slug || g.name,
                category: 'gift',
                subcategory: g.category || 'Misc'
              }));
           }
        }

        setGifts(mappedGifts);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchGifts();
  }, []);

  const handleSend = async (gift: GiftItem) => {
    const success = await sendGift(gift);
    if (success) {
      setSelectedGift(gift);
      setTimeout(() => onClose(), 1000);
    }
  };

  const canAfford = (cost: number) => (profile?.troll_coins || 0) >= cost;

  return (
    <div className="bg-zinc-900/95 backdrop-blur-xl border-t border-white/10 p-4 rounded-t-3xl shadow-2xl">
      {/* UI implementation of the grid and categories */}
    </div>
  );
}
```

---

## FILE: e:\trollcity-1\src\hooks\useGiftSystem.ts
```typescript
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
      // Use the standardized send_gift_in_stream RPC for atomic transactions and battle scoring
      const { data, error } = await supabase.rpc('send_gift_in_stream', {
        p_sender_id: user.id,
        p_receiver_id: finalRecipientId,
        p_stream_id: streamId || null,
        p_gift_id: gift.id,
        p_quantity: quantity
      });

      if (error) throw error;

      if (data && data.success) {
        toast.success(`Sent ${gift.name}!`);
        
        // Broadcast event for animations
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
        
        refreshProfile(); 
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

  return { sendGift, isSending };
}
```

---

## FILE: e:\trollcity-1\src\hooks\useStreamSeats.ts
```typescript
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';

export interface SeatSession {
  id: string;
  seat_index: number;
  user_id: string;
  user_profile?: any;
  status: 'active' | 'left' | 'kicked';
  joined_at: string;
}

export function useStreamSeats(streamId: string | undefined, userId?: string, broadcasterProfile?: any) {
  const [seats, setSeats] = useState<Record<number, SeatSession>>({});
  const { user, profile } = useAuthStore();
  const [mySession, setMySession] = useState<SeatSession | null>(null);

  const effectiveUserId = userId || user?.id;

  const fetchSeats = useCallback(async () => {
    if (!streamId) return;
    const { data, error } = await supabase.rpc('get_stream_seats', { p_stream_id: streamId });
    if (error) return;

    const seatMap: Record<number, SeatSession> = {};
    let mySess: SeatSession | null = null;

    data?.forEach((s: any) => {
      const idx = Number(s.seat_index);
      seatMap[idx] = {
        id: s.id,
        seat_index: idx,
        user_id: s.user_id,
        user_profile: { username: s.username, avatar_url: s.avatar_url, role: s.role, troll_role: s.troll_role },
        status: s.status,
        joined_at: s.joined_at,
      };
      if (effectiveUserId && s.user_id === effectiveUserId) mySess = seatMap[idx];
    });

    setSeats(seatMap);
    setMySession(mySess);
  }, [streamId, effectiveUserId]);

  const joinSeat = async (seatIndex: number, price: number) => {
    if (!effectiveUserId || !streamId) return false;
    const { data, error } = await supabase.rpc('join_seat_atomic', {
      p_stream_id: streamId,
      p_seat_index: seatIndex,
      p_price: price,
      p_user_id: effectiveUserId
    });
    if (error) throw error;
    if (data?.success) {
      toast.success('Joined seat!');
      fetchSeats();
      return true;
    }
    return false;
  };

  const leaveSeat = async () => {
    if (!mySession) return;
    const { data, error } = await supabase.rpc('leave_seat_atomic', { p_session_id: mySession.id });
    if (error) throw error;
    if (data?.success) {
      toast.success('Left seat');
      setMySession(null);
      fetchSeats();
    }
  };

  return { seats, mySession, joinSeat, leaveSeat, refreshSeats: fetchSeats };
}
```

---

## FILE: e:\trollcity-1\BROADCAST_SYSTEM_COMPLETE_FIXES.sql
```sql
-- ============================================
-- 12. SPEND COINS RPC (For Gifts)
-- ============================================

CREATE OR REPLACE FUNCTION public.spend_coins(
    p_sender_id UUID,
    p_receiver_id UUID,
    p_coin_amount INTEGER,
    p_source VARCHAR(100),
    p_item VARCHAR(255)
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSONB;
    v_sender_balance INTEGER;
    v_gift_id UUID;
BEGIN
    -- Get sender balance
    SELECT troll_coins INTO v_sender_balance 
    FROM public.user_profiles 
    WHERE id = p_sender_id
    FOR UPDATE;
    
    -- Check balance
    IF COALESCE(v_sender_balance, 0) < p_coin_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;
    
    -- Deduct from sender
    UPDATE public.user_profiles 
    SET troll_coins = troll_coins - p_coin_amount,
        updated_at = NOW()
    WHERE id = p_sender_id;
    
    -- Add to receiver
    UPDATE public.user_profiles 
    SET troll_coins = troll_coins + p_coin_amount,
        updated_at = NOW()
    WHERE id = p_receiver_id;
    
    -- Create gift record
    INSERT INTO public.gifts (sender_id, receiver_id, coin_amount, gift_type, gift_slug, source)
    VALUES (p_sender_id, p_receiver_id, p_coin_amount, 'paid', p_item, p_source)
    RETURNING id INTO v_gift_id;
    
    -- Log transaction
    INSERT INTO public.coin_transactions 
    (user_id, amount, type, description, metadata)
    VALUES 
    (p_sender_id, -p_coin_amount, 'gift_sent', 'Gift sent: ' || p_item, jsonb_build_object('gift_id', v_gift_id, 'receiver_id', p_receiver_id)),
    (p_receiver_id, p_coin_amount, 'gift_received', 'Gift received: ' || p_item, jsonb_build_object('gift_id', v_gift_id, 'sender_id', p_sender_id));
    
    RETURN jsonb_build_object('success', true, 'gift_id', v_gift_id);
END;
$$;
```

---

## FILE: e:\trollcity-1\supabase\migrations\20270309000000_add_send_gift_in_stream.sql
```sql
CREATE OR REPLACE FUNCTION public.send_gift_in_stream(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_stream_id UUID,
  p_gift_id TEXT,
  p_quantity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_balance BIGINT;
  v_gift_cost BIGINT;
  v_total_cost BIGINT;
  v_gift_name TEXT;
  v_battle_id UUID;
  v_is_challenger BOOLEAN;
BEGIN
  -- 1. Get gift cost and name
  SELECT cost, name INTO v_gift_cost, v_gift_name
  FROM public.gifts
  WHERE id::text = p_gift_id OR slug = p_gift_id;

  IF v_gift_cost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Gift not found');
  END IF;

  v_total_cost := v_gift_cost * p_quantity;

  -- 2. Check sender's balance
  SELECT troll_coins INTO v_sender_balance FROM public.user_profiles WHERE id = p_sender_id;
  IF v_sender_balance < v_total_cost THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  -- 3. Deduct cost from sender
  UPDATE public.user_profiles
  SET troll_coins = troll_coins - v_total_cost
  WHERE id = p_sender_id;

  -- 4. Credit receiver (95% share)
  UPDATE public.user_profiles
  SET troll_coins = troll_coins + FLOOR(v_total_cost * 0.95)
  WHERE id = p_receiver_id;

  -- 5. Record transaction
  INSERT INTO coin_transactions (user_id, amount, type, metadata)
  VALUES
    (p_sender_id, -v_total_cost, 'gift_sent', jsonb_build_object('gift_id', p_gift_id, 'receiver_id', p_receiver_id, 'stream_id', p_stream_id, 'quantity', p_quantity)),
    (p_receiver_id, FLOOR(v_total_cost * 0.95), 'gift_received', jsonb_build_object('gift_id', p_gift_id, 'sender_id', p_sender_id, 'stream_id', p_stream_id, 'quantity', p_quantity));

  -- 7. Battle Scoring Logic
  SELECT id, (challenger_stream_id = p_stream_id) INTO v_battle_id, v_is_challenger
  FROM public.battles
  WHERE (challenger_stream_id = p_stream_id OR opponent_stream_id = p_stream_id)
    AND status = 'active'
  LIMIT 1;

  IF v_battle_id IS NOT NULL THEN
    IF v_is_challenger THEN
      UPDATE public.battles
      SET score_challenger = COALESCE(score_challenger, 0) + v_total_cost,
          pot_challenger = COALESCE(pot_challenger, 0) + v_total_cost
      WHERE id = v_battle_id;
    ELSE
      UPDATE public.battles
      SET score_opponent = COALESCE(score_opponent, 0) + v_total_cost,
          pot_opponent = COALESCE(pot_opponent, 0) + v_total_cost
      WHERE id = v_battle_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Gift sent successfully');
END;
$$;
```
