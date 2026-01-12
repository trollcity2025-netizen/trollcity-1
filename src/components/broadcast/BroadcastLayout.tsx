import React, { useEffect, useMemo, useState } from 'react'
import { useRoomParticipants } from '../../hooks/useRoomParticipants'
import { Room } from 'livekit-client'
import ResponsiveVideoGrid from '../stream/ResponsiveVideoGrid'
import { supabase } from '../../lib/supabase'

interface BroadcastLayoutProps {
  room: Room
  broadcasterId: string
  isHost: boolean
  joinPrice?: number
  seats?: any[]
  lastGift?: any
  backgroundStyle?: React.CSSProperties
  onSetPrice?: (price: number) => void
  onJoinRequest?: (seatIndex: number) => void
  onLeaveSession?: () => void
  onDisableGuestMedia?: (participantId: string) => void
  children?: React.ReactNode
}

export default function BroadcastLayout({
  room,
  broadcasterId,
  isHost,
  joinPrice = 0,
  seats,
  lastGift,
  backgroundStyle,
  onSetPrice,
  onJoinRequest,
  onLeaveSession,
  onDisableGuestMedia,
  children
}: BroadcastLayoutProps) {
  const participants = useRoomParticipants(room);
  const [draftPrice, setDraftPrice] = useState<string>('');
  const [coinBalances, setCoinBalances] = useState<Record<string, number>>({});

  const participantIds = useMemo(
    () => participants.map((p) => p.identity).filter(Boolean) as string[],
    [participants]
  );
  const participantIdsKey = useMemo(
    () => participantIds.slice().sort().join('|'),
    [participantIds]
  );

  useEffect(() => {
    setDraftPrice(joinPrice > 0 ? String(joinPrice) : '');
  }, [joinPrice]);

  useEffect(() => {
    if (!participantIds.length) return;
    let isActive = true;
    const loadBalances = async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id,troll_coins')
        .in('id', participantIds);
      if (!isActive || error || !data) return;
      const next = data.reduce<Record<string, number>>((acc, row: any) => {
        acc[row.id] = Number(row.troll_coins || 0);
        return acc;
      }, {});
      setCoinBalances((prev) => ({ ...prev, ...next }));
    };
    loadBalances();
    return () => {
      isActive = false;
    };
  }, [participantIdsKey]);

  useEffect(() => {
    const receiverId =
      lastGift?.receiver_id ||
      lastGift?.to_user_id ||
      lastGift?.receiverId ||
      lastGift?.receiverID ||
      null;
    if (!receiverId) return;
    let isActive = true;
    const refreshReceiverBalance = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('id,troll_coins')
        .eq('id', receiverId)
        .maybeSingle();
      if (!isActive || !data?.id) return;
      setCoinBalances((prev) => ({
        ...prev,
        [data.id]: Number(data.troll_coins || 0)
      }));
    };
    refreshReceiverBalance();
    return () => {
      isActive = false;
    };
  }, [lastGift]);
  
  if (!room) return null;

  return (
    <div
      className="relative w-full h-full min-h-0 bg-black overflow-hidden"
      style={backgroundStyle}
    >
      {/* Responsive Grid System */}
      <ResponsiveVideoGrid
        participants={participants}
        localParticipant={room.localParticipant}
        broadcasterId={broadcasterId}
        seats={seats}
        joinPrice={joinPrice}
        onLeaveSession={onLeaveSession}
        onJoinRequest={onJoinRequest}
        onDisableGuestMedia={onDisableGuestMedia}
        coinBalances={coinBalances}
      />

      {/* Overlays / Children (Gifts, etc) */}
      <div className="absolute inset-0 pointer-events-none z-20">
        {children}
      </div>

      {/* Broadcaster Price Control (Preserved) */}
      {isHost && onSetPrice && (
        <div className="absolute bottom-20 left-4 md:bottom-4 md:left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg flex items-center gap-2 z-30 pointer-events-auto">
          <span className="text-xs text-gray-300">Join Price:</span>
          <input 
            type="number" 
            value={draftPrice}
            placeholder="Set price"
            inputMode="numeric"
            onChange={(e) => setDraftPrice(e.target.value.replace(/[^\d]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const parsed = parseInt(draftPrice || '0') || 0;
                onSetPrice(Math.max(0, parsed));
              }
            }}
            className="w-20 bg-white/10 border border-white/20 rounded px-2 text-sm text-white"
          />
        </div>
      )}
    </div>
  );
}

