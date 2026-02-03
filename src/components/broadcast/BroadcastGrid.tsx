import React, { useState, useMemo } from 'react';
import { useParticipants, useTracks, VideoTrack } from '@livekit/components-react';
import { Track, Participant } from 'livekit-client';
import { Stream } from '../../types/broadcast';
import { User, Gift, Plus, Coins, Lock, MicOff, Ban, Shield, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import UserActionModal from './UserActionModal';
import UserNameWithAge from '../UserNameWithAge';
import { toast } from 'sonner';
import { useParticipantAttributes } from '../../hooks/useParticipantAttributes';

interface BroadcastGridProps {
  stream: Stream;
  isHost: boolean;
  isModerator?: boolean;
  maxItems?: number; // For Battle Mode (limit to 4: Host + 3 Guests)
  onGift: (userId: string) => void;
  onGiftAll: (ids: string[]) => void;
}

export default function BroadcastGrid({ stream, isHost, isModerator, maxItems, onGift, onGiftAll }: BroadcastGridProps) {
  const allParticipants = useParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]);
  // Local state for selecting user to show action modal
  const [selectedUserForAction, setSelectedUserForAction] = useState<string | null>(null);
  const { user } = useAuthStore();
  
  // Sort participants: Host always first
  const sortedParticipants = useMemo(() => {
    return [...allParticipants].sort((a, b) => {
        // Participant identity is the user_id
        const aIsHost = a.identity === stream.user_id;
        const bIsHost = b.identity === stream.user_id;
        if (aIsHost) return -1;
        if (bIsHost) return 1;
        return 0;
    });
  }, [allParticipants, stream.user_id]);

  // Filter/Limit participants if maxItems is set
  const visibleParticipants = maxItems ? sortedParticipants.slice(0, maxItems) : sortedParticipants;
  
  // Fetch attributes (username, perks, gifts)
  const participantIds = useMemo(() => visibleParticipants.map(p => p.identity), [visibleParticipants]);
  const userAttributes = useParticipantAttributes(participantIds, stream.id);

  // Check if Host has Global RGB/Neon active
  // We need to fetch host attributes even if not visible, but usually host is visible.
  // If host is not in visibleParticipants, we might miss it. But Host is usually first.
  const hostId = stream.user_id;
  const hostAttributes = userAttributes[hostId];
  const globalRgb = hostAttributes?.activePerks?.includes('perk_rgb_username');
  const globalGlow = hostAttributes?.activePerks?.includes('perk_global_highlight');

  // Calculate effective box count for layout
  // If maxItems is set (Battle Mode), we force that layout (e.g. 4 boxes) to ensure consistency
  const effectiveBoxCount = maxItems || stream.box_count;
  const boxes = Array.from({ length: effectiveBoxCount }, (_, i) => i);

  const handleUserClick = (identity: string | undefined) => {
    if (!identity) return;
    if (identity === user?.id) return; 
    setSelectedUserForAction(identity);
  };

  const handleJoinPaidSeat = async () => {
    if (!user) return;
    
    if (stream.are_seats_locked) {
        toast.error("Seats are currently closed by the broadcaster.");
        return;
    }
    
    if (confirm(`Join this seat for ${stream.seat_price} Troll Coins?`)) {
       try {
         const { data, error } = await supabase.rpc('join_paid_seat', { 
            p_stream_id: stream.id,
            p_seat_index: 0 // Logic for specific seat index should be handled if grid positions matter
         });
         
         if (error) {
            console.error("Join seat error:", error);
            toast.error(error.message || "Failed to join seat");
         } else {
            toast.success("Successfully joined the seat!");
         }
       } catch (e) {
         console.error(e);
         toast.error("Failed to join seat");
       }
    }
  };

  return (
    <div className={cn(
      "grid gap-4 w-full h-full max-h-[calc(100vh-2rem)] transition-all duration-500 ease-in-out p-4",
      stream.box_count === 1 && "grid-cols-1",
      stream.box_count === 2 && "grid-cols-2",
      stream.box_count >= 3 && stream.box_count <= 4 && "grid-cols-2 grid-rows-2",
      stream.box_count >= 5 && stream.box_count <= 6 && "grid-cols-3 grid-rows-2",
      stream.box_count > 6 && "grid-cols-3 grid-rows-3"
    )}>
      {boxes.map((boxIndex) => {
        const participant = visibleParticipants[boxIndex];
        const trackRef = participant ? cameraTracks.find(t => t.participant.identity === participant.identity) : undefined;
        
        const attrs = participant ? userAttributes[participant.identity] : null;
        const displayName = attrs?.username || participant?.identity;
        
        // Apply RGB/Glow if individual has it OR if Host has it globally OR if Stream has it enabled
        const hasRgb = stream.has_rgb_effect || globalRgb || attrs?.activePerks?.includes('perk_rgb_username');
        const hasGlow = globalGlow || attrs?.activePerks?.includes('perk_global_highlight');
        const giftCount = attrs?.giftCount || 0;

        return (
          <div 
            key={boxIndex} 
            className={cn(
                "relative bg-zinc-800/50 rounded-2xl overflow-hidden border shadow-lg group transition-all duration-300",
                "flex flex-col items-center justify-center",
                hasRgb ? "border-transparent animate-border-rgb bg-gradient-to-r from-red-500 via-green-500 to-blue-500 p-[2px]" : "border-white/5"
            )}
            onClick={() => participant?.identity && handleUserClick(participant.identity)}
          >
            {/* Inner content container (needed for RGB border to work as a border) */}
            <div className={cn("w-full h-full relative overflow-hidden rounded-[14px]", hasRgb ? "bg-zinc-900" : "")}>
            {participant ? (
              <div className="w-full h-full relative cursor-pointer">
                 {trackRef ? (
                     <VideoTrack 
                       trackRef={trackRef}
                       className="w-full h-full object-cover"
                     />
                 ) : (
                     <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900">
                        <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center border border-white/10 mb-2">
                            <User size={40} className="text-zinc-500" />
                        </div>
                        <span className="text-zinc-400 font-medium">Audio Only</span>
                     </div>
                 )}
                 
                 {/* Identity/Name Tag */}
                 <div className="absolute bottom-3 left-3 flex flex-col gap-1 items-start z-10">
                     <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10">
                        <UserNameWithAge
                            user={{
                                username: displayName,
                                created_at: attrs?.created_at,
                                id: participant.identity,
                                role: attrs?.troll_role as any
                            }}
                            className={cn(
                                "text-white text-sm font-bold shadow-sm",
                                hasGlow && "text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-[0_0_8px_rgba(0,255,255,0.8)] animate-pulse",
                                hasRgb && !hasGlow && "text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-green-500 to-blue-500 animate-pulse"
                            )}
                            showBadges={false}
                            onClick={() => handleUserClick(participant.identity)}
                            isBroadcaster={isHost}
                            isModerator={!!isModerator}
                            streamId={stream.id}
                        />
                        
                        {/* Role Badges */}
                        {attrs?.troll_role === 'admin' && (
                            <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shadow-sm border border-red-400/50">
                                STAFF
                            </span>
                        )}
                        {attrs?.troll_role === 'moderator' && (
                            <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shadow-sm border border-blue-400/50">
                                MOD
                            </span>
                        )}

                        {participant.isMicrophoneEnabled ? (
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        ) : (
                            <MicOff size={12} className="text-red-500" />
                        )}
                     </div>
                     
                     {/* Gift Counter */}
                     <div className="flex items-center gap-1.5 bg-yellow-500/20 backdrop-blur-md px-2 py-1 rounded-full border border-yellow-500/30">
                        <Gift size={10} className="text-yellow-400" />
                        <span className="text-xs font-bold text-yellow-100">{giftCount}</span>
                     </div>
                 </div>
                 
                 {/* Hover Hint */}
                 <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <div className="bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-medium">
                        Click for Actions
                    </div>
                 </div>
              </div>
            ) : (
              // Empty Seat Placeholder
              <div className="flex flex-col items-center gap-3 text-zinc-500">
                  {stream.are_seats_locked ? (
                    <>
                       <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center border-2 border-red-500/30">
                           <X size={32} className="text-red-500" />
                       </div>
                       <span className="text-sm font-medium text-red-500">Seats Closed</span>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center border-2 border-dashed border-zinc-700">
                          <User size={32} className="opacity-50" />
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-medium">Empty Seat</span>
                        {stream.seat_price > 0 && (
                            <div className="flex items-center gap-1 text-amber-500 text-xs mt-1">
                                <Coins size={10} />
                                <span>{stream.seat_price}</span>
                            </div>
                        )}
                      </div>
                      
                      {!isHost && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleJoinPaidSeat(); }}
                            className="mt-2 px-4 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-bold rounded-full transition-colors flex items-center gap-2"
                          >
                            <Plus size={12} />
                            Join
                          </button>
                      )}
                    </>
                  )}
              </div>
            )}
            </div>
          </div>
        );
      })}
      
      {/* User Action Modal */}
      {selectedUserForAction && (
        <UserActionModal
            streamId={stream.id}
            userId={selectedUserForAction}
            isHost={isHost}
            isModerator={!!isModerator}
            onClose={() => setSelectedUserForAction(null)}
            onGift={() => {
                onGift(selectedUserForAction);
                setSelectedUserForAction(null);
            }}
            onGiftAll={() => {
                onGiftAll(participantIds);
                setSelectedUserForAction(null);
            }}
        />
      )}
    </div>
  );
}
