import { useState } from 'react';
import { Stream } from '../../types/broadcast';
import { cn } from '../../lib/utils';
import { Plus, Coins } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import UserActionModal from './UserActionModal';
import { SeatSession } from '../../hooks/useStreamSeats';
import { getGlowingTextStyle } from '../../lib/perkEffects';

interface BroadcastGridOverlayProps {
  stream: Stream;
  isHost: boolean;
  isModerator?: boolean;
  maxItems?: number; 
  onGift: (userId: string) => void;
  seats: Record<number, SeatSession>;
  onJoinSeat: (index: number) => void;
  broadcasterProfile?: any;
}

export default function BroadcastGridOverlay({ 
    stream, 
    isHost, 
    isModerator, 
    maxItems, 
    onGift, 
    seats,
    onJoinSeat,
    broadcasterProfile
}: BroadcastGridOverlayProps) {
  const [selectedUserForAction, setSelectedUserForAction] = useState<string | null>(null);
  const { user } = useAuthStore();
  
  const effectiveBoxCount = Math.max(1, Math.min(maxItems || stream.box_count || 1, 6));
  const boxes = Array.from({ length: effectiveBoxCount }, (_, i) => i);
  
  const handleUserClick = (userId: string | undefined) => {
    if (!userId) return;
    if (userId === user?.id) return; 
    setSelectedUserForAction(userId);
  };

  return (
    <div className={cn(
      "grid gap-4 w-full h-full max-h-[calc(100vh-2rem)] p-4 pointer-events-none", // Ensure grid itself doesn't block clicks, but children do
      stream.box_count === 1 && "grid-cols-1",
      stream.box_count === 2 && "grid-cols-2",
      stream.box_count >= 3 && "grid-cols-2 md:grid-cols-3"
    )}>
      {boxes.map(seatIndex => {
          const seat = seats[seatIndex];
          let userId = seat?.user_id;
          
          // FORCE HOST INTO BOX 0
          if (seatIndex === 0) {
             userId = stream.user_id;
             // We don't have seat info for host, but we know it's them.
             // We can mock the profile if needed, or rely on them being online?
             
             // Wait, Viewer Mode uses HLS. The Overlay is just for INTERACTION (clicking profiles).
             // If Host is not in "seats" DB table, we can't get their profile easily here unless we fetch it.
             // BUT, we can just let them be clickable if we know their ID.
          }

          const isStreamHost = userId === stream.user_id;

          // Determine profile
          let displayProfile = seat?.user_profile;
          if (seatIndex === 0 && isStreamHost) {
              displayProfile = broadcasterProfile;
          }

          let boxClass = "relative rounded-xl overflow-hidden aspect-video pointer-events-auto";
          
          const hasGold = displayProfile?.is_gold;
          const hasRgbProfile = displayProfile?.rgb_username_expires_at && new Date(displayProfile.rgb_username_expires_at) > new Date();
          const hasStreamRgb = (seatIndex === 0 && stream.has_rgb_effect);
          // Check if this is the local user's box (broadcaster viewing their own stream)
          const isLocal = userId && user?.id && userId === user.id;

          if (hasGold) {
             boxClass = "relative rounded-xl overflow-hidden aspect-video pointer-events-auto border-2 border-yellow-500 shadow-[0_0_15px_rgba(255,215,0,0.3)]";
          } else if (hasRgbProfile || (hasStreamRgb && !isLocal)) {
             boxClass = "relative rounded-xl overflow-hidden aspect-video pointer-events-auto rgb-box";
          }

          return (
            <div key={seatIndex} className={boxClass}>
                {/* Empty Seat - Join Button */}
                {!userId && (
                    <button 
                        onClick={() => onJoinSeat(seatIndex)}
                        className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors border border-dashed border-white/30 hover:border-white/60 rounded-xl"
                    >
                         <div className="flex flex-col items-center text-white/70 hover:text-white">
                            <Plus size={32} />
                            <span className="text-xs mt-2 font-bold">Join seat</span>
                            {stream.seat_price > 0 && (
                                <div className="flex items-center gap-1 bg-black/60 px-2 py-1 rounded-full mt-2 border border-yellow-500/30">
                                    <Coins size={12} className="text-yellow-500" />
                                    <span className="text-xs font-bold text-yellow-400">
                                        {stream.seat_price}
                                    </span>
                                </div>
                            )}
                         </div>
                    </button>
                )}
                
                {/* Occupied Seat - Profile Trigger */}
                {userId && (
                    <div 
                        className="absolute inset-0 cursor-pointer"
                        onClick={() => handleUserClick(userId)}
                    >
                         {/* Metadata Overlay Only - Video is behind */}
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                            <div className="text-white text-sm font-bold truncate flex items-center gap-2">
                                {(() => {
                                    const profile = (isStreamHost && broadcasterProfile) ? broadcasterProfile : seat?.user_profile;
                                    const name = isStreamHost 
                                        ? (broadcasterProfile?.username || 'Broadcaster') 
                                        : (profile?.username || 'User');
                                    
                                    let className = "text-white font-bold";
                                    let style = {};
                                    
                                    if (profile) {
                                        const isGold = profile.is_gold || profile.username_style === 'gold' || profile.badge === 'president';
                                        const hasRgb = profile.rgb_username_expires_at && new Date(profile.rgb_username_expires_at) > new Date();
                                        
                                        if (isGold) {
                                            className = "gold-username";
                                        } else if (hasRgb) {
                                            className = "rgb-username";
                                        } else if (profile.glowing_username_color) {
                                            style = getGlowingTextStyle(profile.glowing_username_color);
                                        } else if (['admin', 'moderator', 'secretary'].includes(profile.role || '')) {
                                            className = "silver-username";
                                        }
                                    }
                                    
                                    return (
                                        <>
                                            {isStreamHost && (
                                                <div className="bg-red-600 text-white text-[10px] px-1 rounded font-bold">HOST</div>
                                            )}
                                            
                                            <img 
                                                src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`} 
                                                className="w-6 h-6 rounded-full border border-white/50"
                                                alt="avatar"
                                            />
                                            <span className={className} style={style}>{name}</span>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}
                
                 {/* Action Modal */}
                 {selectedUserForAction && selectedUserForAction === userId && (
                    <UserActionModal
                        onClose={() => setSelectedUserForAction(null)}
                        userId={userId}
                        streamId={stream.id}
                        username={displayProfile?.username}
                        role={displayProfile?.role || displayProfile?.troll_role}
                        createdAt={displayProfile?.created_at}
                        isHost={isHost}
                        isModerator={isModerator}
                        onGift={() => onGift(userId)}
                    />
                 )}
            </div>
          );
      })}
    </div>
  );
}
