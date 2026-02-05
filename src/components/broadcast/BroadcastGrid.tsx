import { useState } from 'react';
import { useParticipants, useTracks, VideoTrack } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Stream } from '../../types/broadcast';
import { User, Coins, Plus, MicOff, VideoOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import UserActionModal from './UserActionModal';
import { SeatSession } from '../../hooks/useStreamSeats';

interface BroadcastGridProps {
  stream: Stream;
  isHost: boolean;
  isModerator?: boolean;
  maxItems?: number; 
  onGift: (userId: string) => void;
  onGiftAll: (ids: string[]) => void;
  mode?: 'viewer' | 'stage';
  seats?: Record<number, SeatSession>;
  onJoinSeat?: (index: number) => void;
  onKick?: (userId: string) => void;
  broadcasterProfile?: any;
}

export default function BroadcastGrid({ 
    stream, 
    isHost, 
    isModerator, 
    maxItems, 
    onGift, 
    onGiftAll: _onGiftAll,
    mode: _mode = 'stage', // Default to stage (legacy behavior)
    seats = {},
    onJoinSeat,
    onKick,
    broadcasterProfile
}: BroadcastGridProps) {
  // Only use LiveKit hooks if in Stage Mode (or if we are blindly rendering)
  // But hooks must be top-level.
  // Ideally BroadcastGrid is ONLY used inside LiveKitRoom.
  // But for Viewer Mode, we are NOT in LiveKitRoom.
  // This causes a crash if we call useParticipants() outside.
  
  // SOLUTION: Split into two components? Or conditional hooks?
  // We can't do conditional hooks.
  // We should create `BroadcastGridStage` and `BroadcastGridViewer`.
  // And `BroadcastGrid` is a wrapper?
  // Or simply: `BroadcastGrid` assumes it is inside LiveKitRoom.
  // And we create `BroadcastGridOverlay` for Viewer Mode.
  
  // Refactoring Plan:
  // 1. Rename this file to BroadcastGridStage.tsx
  // 2. Create BroadcastGridViewer.tsx
  // 3. Create index.tsx that exports BroadcastGrid which switches?
  
  // Actually, I'll just create `BroadcastGridViewer.tsx` and use it in BroadcastPage when mode is 'viewer'.
  // And keep this one for 'stage'.
  
  // BUT, to avoid code duplication, I'll modify THIS file to be Stage Only.
  // And creating a new one for Viewer.
  
  // Wait, I can't rename easily without breaking imports.
  // I will check if I am inside LiveKit context? No easy way.
  // I will assume `BroadcastGrid` is for STAGE.
  // I will create `BroadcastOverlay` for Viewer.
  
  // Let's stick to the current file for Stage.
  // I will revert to just "Stage" logic here, but with "Seat" awareness.
  
  const allParticipants = useParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const audioTracks = useTracks([Track.Source.Microphone]); // Monitor audio tracks for mute state
  const [selectedUserForAction, setSelectedUserForAction] = useState<string | null>(null);
  
  // Map Seats to Participants
  // seats: { 0: {user_id: 'A'}, 1: {user_id: 'B'} }
  // We want to render 6 boxes fixed.
  
  const effectiveBoxCount = Math.min(maxItems || stream.box_count, 6);
  const boxes = Array.from({ length: effectiveBoxCount }, (_, i) => i);
  
  return (
    <div className={cn(
      "grid gap-4 w-full h-full p-4",
      stream.box_count === 1 && "grid-cols-1 grid-rows-1",
      stream.box_count === 2 && "grid-cols-1 md:grid-cols-2 grid-rows-1",
      stream.box_count >= 3 && "grid-cols-2 md:grid-cols-3 grid-rows-2"
    )}>
      {boxes.map(seatIndex => {
          const seat = seats[seatIndex];
          let userId = seat?.user_id;

          // FORCE HOST INTO BOX 0
          // The broadcaster (Host) always occupies the first box.
          if (seatIndex === 0) {
             userId = stream.user_id;
          }
          
          // Find participant
          const participant = allParticipants.find(p => p.identity === userId);
          const track = cameraTracks.find(t => t.participant.identity === userId);
          const audioTrack = audioTracks.find(t => t.participant.identity === userId);
          
          const isMicOn = audioTrack ? !audioTrack.publication.isMuted : false;
          // Note: track here refers to the Video Track Reference from useTracks
          const isCamOn = track ? !track.publication.isMuted : false;

          const isStreamHost = userId === stream.user_id;

          // Determine box style
          // Use seat profile for guests, broadcasterProfile for Host (Seat 0)
          let displayProfile = seat?.user_profile;
          if (seatIndex === 0 && isStreamHost) {
              displayProfile = broadcasterProfile;
          }

          let boxClass = "relative bg-black/50 rounded-xl overflow-hidden border border-white/10";
          
          const hasGold = displayProfile?.is_gold;
          const hasRgbProfile = displayProfile?.rgb_username_expires_at && new Date(displayProfile.rgb_username_expires_at) > new Date();
          const hasStreamRgb = (seatIndex === 0 && stream.has_rgb_effect);

          if (hasGold) {
             // Gold Box - Highest Priority
             boxClass = "relative bg-black/50 rounded-xl overflow-hidden border-2 border-yellow-500 shadow-[0_0_15px_rgba(255,215,0,0.3)]";
          } else if (hasRgbProfile || hasStreamRgb) {
             // RGB Box - Secondary Priority (Profile or Stream-level)
             boxClass = "relative bg-black/50 rounded-xl overflow-hidden rgb-box";
          }
          
          return (
            <div key={seatIndex} className={boxClass}>
                {/* Render Video if Participant Exists and Track is active */}
                {track && isCamOn && (
                    <VideoTrack trackRef={track} className="w-full h-full object-cover" />
                )}

                {/* Video Off / Audio Only State */}
                {userId && participant && (!track || !isCamOn) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90">
                        <div className="relative">
                            <img 
                                src={displayProfile?.avatar_url || `https://ui-avatars.com/api/?name=${displayProfile?.username || 'User'}&background=random`}
                                alt={displayProfile?.username}
                                className="w-16 h-16 rounded-full border-2 border-white/20"
                            />
                            {!isMicOn && (
                                <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-1">
                                    <MicOff size={12} className="text-white" />
                                </div>
                            )}
                        </div>
                        <span className="mt-2 text-xs text-zinc-400 flex items-center gap-1">
                           <VideoOff size={10} />
                           Camera Off
                        </span>
                    </div>
                )}
                
                {/* Fallback / Loading - Only if participant NOT found yet */}
                {userId && !participant && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-pulse bg-zinc-800 w-full h-full" />
                        <span className="absolute text-xs text-white/50">
                            {isStreamHost ? 'Host Connecting...' : 'Connecting...'}
                        </span>
                    </div>
                )}
                
                {/* Empty Seat */}
                {!userId && (
                    <div className="absolute inset-0 flex items-center justify-center">
                         {onJoinSeat ? (
                             <button 
                                onClick={() => onJoinSeat(seatIndex)}
                                className="flex flex-col items-center text-zinc-500 hover:text-white transition-colors"
                             >
                                <div className="p-3 rounded-full border border-dashed border-zinc-600 hover:border-white mb-2">
                                    <Plus size={24} />
                                </div>
                                <span className="text-xs font-medium">Join Stage</span>
                                {stream.seat_price > 0 && (
                                    <span className="text-[10px] text-yellow-500 mt-1">{stream.seat_price} Coins</span>
                                )}
                             </button>
                         ) : (
                             <div className="text-zinc-600 flex flex-col items-center">
                                <User size={24} className="opacity-20" />
                                <span className="text-xs mt-2">Empty</span>
                             </div>
                         )}
                    </div>
                )}
                
                {/* Metadata Overlay */}
                {userId && (
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
                        <div className="flex flex-col min-w-0">
                            <div className="text-white text-sm font-bold truncate">
                                {(() => {
                                    const profile = (isStreamHost && broadcasterProfile) ? broadcasterProfile : seat?.user_profile;
                                    const name = isStreamHost 
                                        ? (broadcasterProfile?.username || 'Host') 
                                        : (participant?.name || profile?.username || 'User');
                                    
                                    let className = "text-white";
                                    
                                    if (profile) {
                                        if (profile.is_gold) {
                                            className = "gold-username";
                                        } else if (profile.rgb_username_expires_at && new Date(profile.rgb_username_expires_at) > new Date()) {
                                            className = "rgb-username";
                                        } else if (['admin', 'moderator', 'secretary'].includes(profile.role || '')) {
                                            className = "silver-username";
                                        }
                                    }
                                    
                                    return (
                                        <span className={className}>
                                            {name}
                                            {isStreamHost && <span className="ml-1 text-[10px] bg-red-600 px-1 rounded text-white font-normal align-middle">HOST</span>}
                                        </span>
                                    );
                                })()}
                            </div>
                            <div className="flex items-center gap-1 text-yellow-500 text-xs">
                                <Coins size={10} />
                                <span>{(displayProfile?.troll_coins || 0).toLocaleString()}</span>
                            </div>
                        </div>
                        
                        {/* Mic Status Indicator */}
                        {!isMicOn && (
                             <div className="ml-2 bg-red-500/80 p-1.5 rounded-full backdrop-blur-md shadow-sm" title="Mic Muted">
                                 <MicOff size={14} className="text-white" />
                             </div>
                        )}
                    </div>
                )}
                
                 {/* Action Modal */}
                 {selectedUserForAction && selectedUserForAction === userId && (
                    <UserActionModal
                        isOpen={true}
                        onClose={() => setSelectedUserForAction(null)}
                        targetUserId={userId}
                        isHost={isHost}
                        isModerator={isModerator}
                        onGift={() => onGift(userId)}
                        onKickStage={onKick ? () => onKick(userId) : undefined}
                    />
                 )}
            </div>
          );
      })}
    </div>
  );
}
