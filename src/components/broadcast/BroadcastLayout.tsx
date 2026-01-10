import React, { useEffect, useState } from 'react'
import { useRoomParticipants } from '../../hooks/useRoomParticipants'
import { Room } from 'livekit-client'
import ResponsiveVideoGrid from '../stream/ResponsiveVideoGrid'

interface BroadcastLayoutProps {
  room: Room
  broadcasterId: string
  isHost: boolean
  joinPrice?: number
  seats?: any[]
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
  onSetPrice,
  onJoinRequest,
  onLeaveSession,
  onDisableGuestMedia,
  children
}: BroadcastLayoutProps) {
  const participants = useRoomParticipants(room);
  const [draftPrice, setDraftPrice] = useState<string>('');

  useEffect(() => {
    setDraftPrice(joinPrice > 0 ? String(joinPrice) : '');
  }, [joinPrice]);
  
  if (!room) return null;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
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

