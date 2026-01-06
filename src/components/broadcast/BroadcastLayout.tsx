import React, { useMemo, useState, Suspense } from 'react'
import { useRoomParticipants } from '../../hooks/useRoomParticipants'
import { Room } from 'livekit-client'
import { User, Minus, Plus } from 'lucide-react'

// Lazy load VideoTile to avoid circular dependency issues
const VideoTile = React.lazy(() => import('./VideoTile'))

interface BroadcastLayoutProps {
  room: Room
  broadcasterId: string
  isHost: boolean
  totalCoins?: number
  joinPrice?: number
  onSetPrice?: (price: number) => void
  onJoinRequest?: () => void
  onLeaveSession?: () => void
  children?: React.ReactNode
}

export default function BroadcastLayout({ room, broadcasterId, isHost, totalCoins = 0, joinPrice = 0, onSetPrice, onJoinRequest, onLeaveSession, children }: BroadcastLayoutProps) {
  const participants = useRoomParticipants(room);
  const [guestSlotCount, setGuestSlotCount] = useState(5);

  const broadcaster = useMemo(() => {
    return participants.find(p => p.identity === broadcasterId);
  }, [participants, broadcasterId]);

  const guests = useMemo(() => {
    return participants.filter(p => p.identity !== broadcasterId);
  }, [participants, broadcasterId]);

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Main Broadcaster Area - Constrained to roughly 60% height or aspect ratio */}
      <div className="relative flex-none h-[60%] min-h-[300px] w-full flex justify-center">
        <div className="relative aspect-video h-full max-w-full bg-black rounded-2xl overflow-hidden border border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
          {broadcaster ? (
            <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-white/30">Loading...</div>}>
              <VideoTile 
                  participant={broadcaster} 
                  isBroadcaster={true} 
                  className="w-full h-full" 
                  isLocal={isHost}
              />
            </Suspense>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/30">
              Waiting for broadcaster...
            </div>
          )}
          
          {/* Coin Counter Overlay */}
          <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-yellow-500/30 px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg z-10">
             <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center text-black font-bold text-xs">C</div>
             <span className="text-yellow-400 font-bold text-lg">{totalCoins.toLocaleString()}</span>
          </div>

          {/* Broadcaster Price Control */}
          {isHost && onSetPrice && (
            <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg flex items-center gap-2 z-10">
              <span className="text-xs text-gray-300">Join Price:</span>
              <input 
                type="number" 
                value={joinPrice} 
                onChange={(e) => onSetPrice(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 bg-white/10 border border-white/20 rounded px-1 text-sm text-white"
              />
            </div>
          )}

          {/* Injected Overlays (e.g. Gifts) */}
          {children}
        </div>
      </div>

      {/* Guest Row */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-1 px-1 shrink-0">
          <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Guests</h3>
          {isHost && (
            <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
              <button 
                onClick={() => setGuestSlotCount(prev => Math.max(1, prev - 1))}
                className="p-1 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors"
              >
                <Minus size={14} />
              </button>
              <span className="text-xs font-mono w-4 text-center">{guestSlotCount}</span>
              <button 
                onClick={() => setGuestSlotCount(prev => Math.min(6, prev + 1))}
                className="p-1 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          )}
        </div>
        
        {/* Scrollable Guest Row */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide h-full items-start">
          {Array.from({ length: guestSlotCount }).map((_, i) => (
            <div key={i} className="aspect-video h-[120px] md:h-[140px] shrink-0 bg-white/5 rounded-lg border border-white/5 overflow-hidden relative group">
              {guests[i] ? (
                <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-white/10"><User size={20} className="animate-pulse" /></div>}>
                  <VideoTile 
                    participant={guests[i]} 
                    className="w-full h-full"
                    isLocal={guests[i].identity === room.localParticipant.identity}
                    onLeave={guests[i].identity === room.localParticipant.identity ? onLeaveSession : undefined}
                  />
                </Suspense>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-white/10 hover:bg-white/10 transition-colors">
                  {!isHost && onJoinRequest ? (
                    <button 
                      onClick={onJoinRequest}
                      className="flex flex-col items-center gap-1 group-hover:scale-110 transition-transform"
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white shadow-lg">
                        <Plus size={20} />
                      </div>
                      <span className="text-[10px] font-bold text-purple-300">
                        {joinPrice > 0 ? `${joinPrice} Coins` : 'Join'}
                      </span>
                    </button>
                  ) : (
                     <User size={20} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
