import React, { useEffect, useMemo, useState } from 'react'
import { useRoomParticipants } from '../../hooks/useRoomParticipants'
import { Room, Participant } from 'livekit-client'
import ResponsiveVideoGrid from '../stream/ResponsiveVideoGrid'
import { supabase } from '../../lib/supabase'

interface BroadcastLayoutProps {
  room: Room
  broadcasterId: string
  isHost: boolean
  joinPrice?: number
  boxCount?: number
  seats?: any[]
  lastGift?: any
  onJoinRequest?: (seatIndex: number) => void
  onLeaveSession?: () => void
  onDisableGuestMedia?: (participantId: string) => void
  giftBalanceDelta?: { userId: string; delta: number; key: number } | null
  backgroundStyle?: React.CSSProperties
  children?: React.ReactNode
  onSeatAction?: (params: { seatIndex: number; seat: any; participant?: any }) => void
  hostSeatIndex?: number
  onHostSeatChange?: (seatIndex: number) => void
  onUserClick?: (participant: Participant) => void
  onToggleCamera?: () => void
  onToggleScreenShare?: () => void
  isCameraOn?: boolean
  isScreenShareOn?: boolean
  onSetPrice?: (price: number) => void
}

export default function BroadcastLayout({
  giftBalanceDelta,
  room,
  broadcasterId,
  isHost,
  joinPrice = 0,
  boxCount = 0,
  seats,
  lastGift,
  onJoinRequest,
  onLeaveSession,
  onDisableGuestMedia,
  onSeatAction,
  backgroundStyle,
  children,
  hostSeatIndex,
  onHostSeatChange,
  onUserClick,
  onToggleCamera,
  onToggleScreenShare,
  isCameraOn,
  isScreenShareOn,
  onSetPrice: _onSetPrice
}: BroadcastLayoutProps) {
  const participants = useRoomParticipants(room);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useEffect(() => {
    if (!giftBalanceDelta?.userId || giftBalanceDelta.delta === 0) return;
    setCoinBalances((prev) => {
      const current = prev[giftBalanceDelta.userId] || 0;
      return {
        ...prev,
        [giftBalanceDelta.userId]: current + giftBalanceDelta.delta,
      };
    });
  }, [giftBalanceDelta?.key, giftBalanceDelta?.userId, giftBalanceDelta?.delta]);

  if (!room) return null;

  return (
    <div className="relative w-full h-full min-h-0 overflow-hidden" style={backgroundStyle}>
      <div className="relative z-10">
        <ResponsiveVideoGrid
          participants={participants}
          localParticipant={room.localParticipant}
          broadcasterId={broadcasterId}
          seats={seats}
          isHost={isHost}
          hostSeatIndex={hostSeatIndex}
          joinPrice={joinPrice}
          onLeaveSession={onLeaveSession}
          onJoinRequest={onJoinRequest}
          onDisableGuestMedia={onDisableGuestMedia}
          coinBalances={coinBalances}
          onHostSeatChange={onHostSeatChange}
          onSeatAction={onSeatAction}
          boxCount={boxCount}
          onUserClick={onUserClick}
          onToggleCamera={onToggleCamera}
          onToggleScreenShare={onToggleScreenShare}
          isCameraOn={isCameraOn}
          isScreenShareOn={isScreenShareOn}
        />
      </div>

      <div className="absolute inset-0 pointer-events-none z-20">
        {children}
      </div>
    </div>
  );
}
