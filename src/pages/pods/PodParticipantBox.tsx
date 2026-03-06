import React, { useEffect, useState } from 'react';
import { Mic, MicOff, Crown, Shield, User, MoreVertical, ArrowDown, MessageSquareOff, UserMinus, Ban } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import GiftModal from '@/components/GiftModal';
import { PodParticipant } from './TrollPodRoom'; // Assuming PodParticipant is defined in TrollPodRoom
import { IRemoteAudioTrack, ILocalAudioTrack } from 'agora-rtc-sdk-ng';

interface PodParticipantBoxProps {
  participant: PodParticipant | IAgoraRTCRemoteUser;
  isHost: boolean; // Is the viewer the host of the room?
  isOfficer?: boolean; // Is the viewer an officer?
  isSelf: boolean; // Is this box for the viewer themselves?
  onKick?: (userId: string) => void;
  onBan?: (userId: string) => void; // Permanent/Long ban
  onDemote?: (userId: string) => void;
  onPromoteOfficer?: (userId: string) => void;
  onDisableChat?: (userId:string) => void;
  audioTrack?: IRemoteAudioTrack | ILocalAudioTrack;
}

export default function PodParticipantBox({
  participant,
  isHost,
  isOfficer,
  isSelf,
  onKick,
  onBan,
  onDemote,
  onPromoteOfficer,
  onDisableChat,
  audioTrack
}: PodParticipantBoxProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  
  const isLocal = isSelf;
  const canManage = (isHost || isOfficer) && !isSelf;
  
  // Identity is now the user_id from PodParticipant
  const userId = participant.user_id;
  const [userProfile, setUserProfile] = useState<{ username: string; avatar_url: string } | null>(null);

  useEffect(() => {
    // Fetch profile
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('username, avatar_url')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        console.error("Error fetching user profile", error);
        return;
      }
      if (data) setUserProfile(data);
    };
    fetchProfile();
  }, [userId]);

  useEffect(() => {
    if (audioTrack) {
      if (!isSelf) {
        (audioTrack as IRemoteAudioTrack).play();
      }
      setIsMuted(!audioTrack.enabled);
    }
    // No cleanup needed for play, but for listeners
  }, [audioTrack, isSelf]);



  return (
    <>
      <div 
        className={`relative group w-full aspect-video rgb-frame rounded-xl ${!isSelf ? 'cursor-pointer' : ''}`}
        onClick={() => {
            if (!isSelf) setShowGiftModal(true);
        }}
      >
      <div className="w-full h-full bg-black relative overflow-hidden rounded-lg">
      
      {/* Video or Avatar */}
      {
        userProfile?.avatar_url ? (
          <img src={userProfile.avatar_url} alt={userProfile.username} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-900">
            <User className="w-20 h-20 text-gray-500" />
          </div>
        )
      }

      {/* Audio Element */}
      {/* {!isLocal && <audio ref={audioRef} />} */}

      {/* Host / Officer Badge */}
      {(isHost || isOfficer) && (
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1">
            {isHost && (
                <div className="flex items-center gap-1 bg-yellow-500/90 text-black px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider shadow-lg shadow-yellow-500/20">
                    <Crown className="w-3 h-3 fill-black" />
                    HOST
                </div>
            )}
            {isOfficer && !isHost && (
                <div className="flex items-center gap-1 bg-blue-500/90 text-white px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider shadow-lg shadow-blue-500/20">
                    <Shield className="w-3 h-3 fill-white" />
                    OFFICER
                </div>
            )}
        </div>
      )}

      {/* Overlay Info */}
      <div className="absolute bottom-2 left-2 z-20 flex items-center gap-2 bg-black/60 px-2 py-1 rounded-full backdrop-blur-sm">
        <span className="text-white text-sm font-bold truncate max-w-[100px]">
          {userProfile?.username || participant.identity}
        </span>
        {isMuted ? <MicOff className="w-4 h-4 text-red-500" /> : <Mic className="w-4 h-4 text-green-500" />}
      </div>

      {/* Host/Officer Controls */}
      {canManage && (
        <div className="absolute top-2 right-2 z-30">
          <button 
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-1.5 bg-black/60 hover:bg-gray-800 rounded-full text-white backdrop-blur-sm transition-colors"
            aria-label="Show options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50 flex flex-col">

                <button 
                    onClick={() => { onDemote?.(participant.identity); setShowMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white text-left transition-colors"
                >
                    <ArrowDown className="w-4 h-4 text-orange-400" />
                    Remove from Stage
                </button>

                {isHost && (
                    <button 
                        onClick={() => { onPromoteOfficer?.(participant.identity); setShowMenu(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white text-left transition-colors"
                    >
                        <Shield className="w-4 h-4 text-blue-400" />
                        Make Officer
                    </button>
                )}

                <button 
                    onClick={() => { onDisableChat?.(participant.identity); setShowMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white text-left transition-colors"
                >
                    <MessageSquareOff className="w-4 h-4 text-purple-400" />
                    Disable Chat
                </button>

                <div className="h-px bg-gray-700 my-1" />

                <button 
                    onClick={() => { onKick?.(participant.identity); setShowMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 text-left transition-colors"
                >
                    <UserMinus className="w-4 h-4" />
                    Kick User
                </button>
                
                <button 
                    onClick={() => { onBan?.(participant.identity); setShowMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-900/30 hover:text-red-400 text-left transition-colors font-bold"
                >
                    <Ban className="w-4 h-4" />
                    Kick & Ban (24h)
                </button>
            </div>
          )}
          
          {/* Click outside listener could be added here or just rely on mouseleave/toggle */}
          {showMenu && (
             <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          )}
        </div>
      )}
      </div>
    </div>
    
    <GiftModal 
        isOpen={showGiftModal} 
        onClose={() => setShowGiftModal(false)} 
        recipientId={userId}
        recipientUsername={userProfile?.username || participant.identity}
    />
    </>
  );
}
