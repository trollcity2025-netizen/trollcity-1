import React, { useState } from 'react';
import { Mic, MicOff, Crown, Shield, User, MoreVertical, ArrowDown, MessageSquareOff, UserMinus, Ban } from 'lucide-react';
import GiftModal from '@/components/GiftModal';

// This is now a simpler, more controlled component
// Data is passed down from the parent (TrollPodRoom)

interface PodParticipantBoxProps {
  participant: any; // Combined data from Supabase
  isHost: boolean;
  isSelf: boolean;
  isSpeaking: boolean;
  isMuted?: boolean;
  // Management functions are now passed from the parent
  onKick?: (identity: string) => void;
  onBan?: (identity: string) => void;
  onMute?: (identity: string) => void;
  onDemote?: (identity: string) => void;
  onPromoteOfficer?: (identity: string) => void;
  onDisableChat?: (identity: string) => void;
}

export default function PodParticipantBox({
  participant,
  isHost,
  isSelf,
  isSpeaking,
  isMuted,
  onKick,
  onBan,
  onMute,
  onDemote,
  onPromoteOfficer,
  onDisableChat
}: PodParticipantBoxProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  
  const isOfficer = participant.role === 'officer';
  const canManage = (isHost || isOfficer) && !isSelf;
  const userId = participant.user_id;
  const userProfile = participant.user; // Directly from prop

  return (
    <>
      <div 
        className={`relative group w-full aspect-video rounded-xl ${isSpeaking ? 'rgb-frame' : 'border-2 border-transparent'} ${!isSelf ? 'cursor-pointer' : ''}`}
        onClick={() => {
            if (!isSelf) setShowGiftModal(true);
        }}
      >
      <div className="w-full h-full bg-black relative overflow-hidden rounded-lg">
      
      {/* Avatar is always shown now, as video is handled by Agora globally */}
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        {userProfile?.avatar_url ? (
          <img src={userProfile.avatar_url} alt={userProfile.username} className="w-24 h-24 rounded-full border-2 border-white/20" />
        ) : (
          <User className="w-20 h-20 text-gray-500" />
        )}
      </div>

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
          {userProfile?.username || userId}
        </span>
        {isMuted ? <MicOff className="w-4 h-4 text-red-500" /> : <Mic className="w-4 h-4 text-green-500" />}
      </div>

      {/* Host/Officer Controls */}
      {canManage && (
        <div className="absolute top-2 right-2 z-30">
          <button 
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-1.5 bg-black/60 hover:bg-gray-800 rounded-full text-white backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
            data-state={showMenu ? 'open' : 'closed'}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50 flex flex-col">
                <button 
                    onClick={() => { onMute?.(userId); setShowMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white text-left transition-colors"
                >
                    <MicOff className="w-4 h-4 text-yellow-500" />
                    Mute Mic
                </button>
                
                <button 
                    onClick={() => { onDemote?.(userId); setShowMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white text-left transition-colors"
                >
                    <ArrowDown className="w-4 h-4 text-orange-400" />
                    Remove from Stage
                </button>

                {isHost && (
                    <button 
                        onClick={() => { onPromoteOfficer?.(userId); setShowMenu(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white text-left transition-colors"
                    >
                        <Shield className="w-4 h-4 text-blue-400" />
                        Make Officer
                    </button>
                )}

                <button 
                    onClick={() => { onDisableChat?.(userId); setShowMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white text-left transition-colors"
                >
                    <MessageSquareOff className="w-4 h-4 text-purple-400" />
                    Disable Chat
                </button>

                <div className="h-px bg-gray-700 my-1" />

                <button 
                    onClick={() => { onKick?.(userId); setShowMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 text-left transition-colors"
                >
                    <UserMinus className="w-4 h-4" />
                    Kick User
                </button>
                
                <button 
                    onClick={() => { onBan?.(userId); setShowMenu(false); }}
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
        recipientUsername={userProfile?.username || userId}
    />
    </>
  );
}
