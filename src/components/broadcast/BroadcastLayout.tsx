import React, { useEffect, useMemo, useState } from 'react'
import { useRoomParticipants } from '../../hooks/useRoomParticipants'
import { Room, Participant } from 'livekit-client'
import ResponsiveVideoGrid from '../stream/ResponsiveVideoGrid'
import { supabase } from '../../lib/supabase'


interface BroadcastLayoutProps {
  room: Room
  streamId?: string
  broadcasterId: string
  isHost: boolean
  className?: string
  joinPrice?: number
  boxCount?: number
  seats?: any[]
  lastGift?: any
  onJoinRequest?: (seatIndex: number) => void
  onLeaveSession?: () => void
  onDisableGuestMedia?: (participantId: string, disableVideo?: boolean, disableAudio?: boolean) => void
  giftBalanceDelta?: { userId: string; delta: number; key: number } | null
  backgroundStyle?: React.CSSProperties
  onSeatAction?: (params: { seatIndex: number; seat: any; participant?: any }) => void
  hostSeatIndex?: number
  onHostSeatChange?: (seatIndex: number) => void
  onUserClick?: (participant: Participant) => void
  onToggleCamera?: () => void
  isCameraOn?: boolean
  onSetPrice?: (price: number) => void
}


export default function BroadcastLayout({
  giftBalanceDelta,
  room,
  streamId,
  broadcasterId,
  isHost,
  className,
  joinPrice = 0,
  boxCount = 5,
  seats,
  lastGift,
  onJoinRequest,
  onLeaveSession,
  onDisableGuestMedia,
  onSeatAction,
  backgroundStyle,
  hostSeatIndex,
  onHostSeatChange,
  onUserClick,
  onToggleCamera,
  isCameraOn,
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
    if (!streamId) return;

    const channel = supabase
      .channel(`gifts-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gifts',
          filter: `stream_id=eq.${streamId}`,
        },
        async (payload) => {
          const eventType = (payload as any).eventType;
          if (eventType && eventType !== 'INSERT' && eventType !== 'UPDATE') {
            return;
          }
          const newGift: any = payload.new;
          const receiverId =
            newGift?.receiver_id ||
            newGift?.to_user_id ||
            newGift?.receiverId ||
            null;
          const senderId =
            newGift?.sender_id ||
            newGift?.from_user_id ||
            newGift?.senderId ||
            null;
          const amount = Number(
            newGift?.coin_amount ??
              newGift?.coinAmount ??
              newGift?.coins ??
              newGift?.amount ??
              0
          );

          if (receiverId && amount) {
            setCoinBalances((prev) => ({
              ...prev,
              [receiverId]: (prev[receiverId] || 0) + amount,
            }));
          }

          if (senderId && amount) {
            setCoinBalances((prev) => ({
              ...prev,
              [senderId]: (prev[senderId] || 0) - amount,
            }));
          }

          if (receiverId) {
            const { data } = await supabase
              .from('user_profiles')
              .select('id,troll_coins')
              .eq('id', receiverId)
              .maybeSingle();
            if (data?.id) {
              setCoinBalances((prev) => ({
                ...prev,
                [data.id]: Number(data.troll_coins || 0),
              }));
            }
          }

          if (senderId) {
            const { data } = await supabase
              .from('user_profiles')
              .select('id,troll_coins')
              .eq('id', senderId)
              .maybeSingle();
            if (data?.id) {
              setCoinBalances((prev) => ({
                ...prev,
                [data.id]: Number(data.troll_coins || 0),
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

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
    <div className="flex flex-1 min-h-0 bg-black text-white">
      {/* VIDEO AREA */}
      <div className="flex-1 p-4">
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
          isCameraOn={isCameraOn}
        />
      </div>
    </div>
  );
}
