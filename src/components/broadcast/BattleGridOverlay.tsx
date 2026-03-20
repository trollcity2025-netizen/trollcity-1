import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { RemoteParticipant, LocalVideoTrack, LocalAudioTrack, RemoteVideoTrack, RemoteAudioTrack } from 'livekit-client';
import { supabase } from '../../lib/supabase';

interface BattleGridOverlayProps {
  battleId: string;
  streamId: string;
  isHost: boolean;
  localTracks: [LocalAudioTrack, LocalVideoTrack] | null;
  remoteParticipants: RemoteParticipant[];
  userId: string;
  userProfile: any;
  onEndBattle: () => void;
}

interface BattleParticipant {
  user_id: string;
  role: 'host' | 'stage';
  team: 'challenger' | 'opponent';
  seat_index: number;
  username?: string;
  avatar_url?: string;
}

interface BattleBox {
  index: number;
  userId: string | null;
  username: string;
  avatarUrl: string;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  videoTrack: LocalVideoTrack | RemoteVideoTrack | undefined;
  audioTrack: LocalAudioTrack | RemoteAudioTrack | undefined;
  isLocal: boolean;
}

// Memoized video player component - only re-renders when track changes
const LiveKitVideoPlayer = React.memo(function LiveKitVideoPlayer({ 
  videoTrack, 
  isLocal,
  identity
}: { 
  videoTrack: LocalVideoTrack | RemoteVideoTrack | undefined; 
  isLocal: boolean;
  identity: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const attachedTrackIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!videoTrack || !containerRef.current) {
      return;
    }
    
    // Check if this track is already attached by comparing track IDs
    const currentTrackId = videoTrack.sid || (videoTrack as any).id;
    if (attachedTrackIdRef.current === currentTrackId && videoElementRef.current) {
      return;
    }
    
    // Clean up existing video element
    if (containerRef.current.querySelector('video')) {
      try {
        videoTrack.detach();
      } catch (e) {}
    }
    
    try {
      const videoElement = videoTrack.attach();
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';
      videoElement.style.objectFit = 'cover';
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      if (isLocal) {
        videoElement.muted = true;
      }
      
      containerRef.current.appendChild(videoElement);
      videoElementRef.current = videoElement;
      attachedTrackIdRef.current = currentTrackId;
    } catch (err) {
      console.error('[BattleGridOverlay] Error attaching video:', err);
    }
    
    return () => {
      try {
        if (videoElementRef.current) {
          videoTrack.detach();
          videoElementRef.current = null;
          attachedTrackIdRef.current = null;
        }
      } catch (e) {}
    };
  }, [videoTrack, isLocal]);
  
  return <div ref={containerRef} className="absolute inset-0" />;
});

// Memoized single video box - only re-renders when its specific data changes
const VideoBox = React.memo(function VideoBox({ 
  box, 
  team,
  userId
}: { 
  box: BattleBox; 
  team: 'broadcaster' | 'challenger';
  userId: string;
}) {
  const isCurrentUser = box.userId === userId;
  
  return (
    <div
      key={`${team}-${box.userId || 'empty'}-${box.index}`}
      className="relative bg-gradient-to-br from-gray-900 to-black border-2 border-white/10 rounded-lg overflow-hidden flex items-center justify-center"
      style={{
        aspectRatio: '16/9',
      }}
    >
      {/* Video or placeholder */}
      {box.isVideoEnabled && box.videoTrack ? (
        <LiveKitVideoPlayer 
          videoTrack={box.videoTrack} 
          isLocal={box.isLocal}
          identity={box.userId || ''}
        />
      ) : (
        <div className="flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 to-red-500 flex items-center justify-center text-white font-bold text-2xl overflow-hidden">
            {box.avatarUrl ? (
              <img src={box.avatarUrl} alt={box.username} className="w-full h-full object-cover" />
            ) : (
              box.username.charAt(0).toUpperCase()
            )}
          </div>
          <span className="mt-2 text-white font-medium text-sm">{box.username}</span>
          {!box.isVideoEnabled && box.userId && (
            <span className="text-xs text-gray-400">Camera off</span>
          )}
          {!box.userId && (
            <span className="text-xs text-gray-500">Empty</span>
          )}
        </div>
      )}
      
      {/* Audio indicator */}
      {box.isAudioEnabled && (
        <div className="absolute bottom-2 right-2 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
      )}
      
      {/* Muted indicator */}
      {!box.isAudioEnabled && box.userId && (
        <div className="absolute bottom-2 right-2 w-3 h-3 bg-red-500 rounded-full" />
      )}
      
      {/* Box number */}
      <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
        Box {box.index + 1}
      </div>
      
      {/* Crown indicator for host/challenger */}
      {box.index === 0 && team === 'broadcaster' && (
        <div className="absolute top-2 right-2 bg-amber-500 text-black text-xs px-2 py-1 rounded font-bold">
          👑 HOST
        </div>
      )}
      {box.index === 0 && team === 'challenger' && (
        <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded font-bold">
          ⚔️ CHALLENGER
        </div>
      )}
    </div>
  );
});

export default function BattleGridOverlay({
  battleId,
  streamId,
  isHost,
  localTracks,
  remoteParticipants,
  userId,
  userProfile,
  onEndBattle
}: BattleGridOverlayProps) {
  const [participants, setParticipants] = useState<BattleParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Get LiveKit identity mapping
  const getLiveKitIdentity = useCallback((userId: string): string => {
    return userId;
  }, []);
  
  // Find participant by LiveKit identity - stable reference
  const findParticipantByIdentity = useCallback((identity: string): RemoteParticipant | undefined => {
    return remoteParticipants.find(p => p.identity === identity || p.identity.startsWith(identity));
  }, [remoteParticipants]);
  
  // Fetch battle participants - with debouncing to prevent rapid updates
  useEffect(() => {
    let mounted = true;
    let pollInterval: ReturnType<typeof setInterval>;
    
    const fetchBattleParticipants = async () => {
      try {
        const { data, error } = await supabase
          .from('battle_participants')
          .select('*')
          .eq('battle_id', battleId);
        
        if (error || !mounted) {
          return;
        }
        
        if (data && data.length > 0) {
          // Get user profiles for usernames
          const userIds = data.map((p: any) => p.user_id);
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url')
            .in('id', userIds);
          
          if (!mounted) return;
          
          const profileMap = new Map();
          if (profiles) {
            profiles.forEach((p: any) => {
              profileMap.set(p.id, p);
            });
          }
          
          const participantsWithProfiles = data.map((p: any) => ({
            user_id: p.user_id,
            role: p.role,
            team: p.team,
            seat_index: p.metadata ? JSON.parse(p.metadata).seatIndex : 0,
            username: profileMap.get(p.user_id)?.username || 'Unknown',
            avatar_url: profileMap.get(p.user_id)?.avatar_url
          }));
          
          // Only update state if data actually changed
          setParticipants(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(participantsWithProfiles)) {
              return participantsWithProfiles;
            }
            return prev;
          });
          setIsLoading(false);
        } else {
          setParticipants([]);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[BattleGridOverlay] Error:', err);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    // Initial fetch
    fetchBattleParticipants();
    
    // Poll for updates - reduced frequency to prevent flashing
    pollInterval = setInterval(fetchBattleParticipants, 5000);
    return () => {
      mounted = false;
      clearInterval(pollInterval);
    };
  }, [battleId]);
  
  // Memoized team filtering
  const { broadcasterTeam, challengerTeam } = useMemo(() => {
    // Get broadcaster (host) participants - team 'challenger' is the broadcaster's team (from ChallengeManager)
    const bt = participants.filter(p => p.team === 'challenger');
    // Get challenger team - team 'opponent' is the challenger (from ChallengeManager)
    const ct = participants.filter(p => p.team === 'opponent');
    return { broadcasterTeam: bt, challengerTeam: ct };
  }, [participants]);
  
  // Helper function to get video track from participant
  const getVideoTrack = (participant: RemoteParticipant | null): RemoteVideoTrack | undefined => {
    if (!participant) return undefined;
    const pubs = participant.videoTrackPublications as unknown as Map<string, { track?: RemoteVideoTrack }>;
    if (!pubs) return undefined;
    const values = Array.from(pubs.values());
    const pub = values.find(p => p.track?.kind === 'video');
    return pub?.track;
  };

  // Helper function to get audio track from participant
  const getAudioTrack = (participant: RemoteParticipant | null): RemoteAudioTrack | undefined => {
    if (!participant) return undefined;
    const pubs = participant.audioTrackPublications as unknown as Map<string, { track?: RemoteAudioTrack }>;
    if (!pubs) return undefined;
    const values = Array.from(pubs.values());
    const pub = values.find(p => p.track?.kind === 'audio');
    return pub?.track;
  };

  // Helper function to check if video is enabled
  const hasVideoEnabled = (participant: RemoteParticipant | null): boolean => {
    if (!participant) return false;
    const pubs = participant.videoTrackPublications as unknown as Map<string, { track?: RemoteVideoTrack }>;
    if (!pubs) return false;
    return Array.from(pubs.values()).some(p => p.track?.kind === 'video' && p.track.isEnabled);
  };

  // Helper function to check if audio is enabled
  const hasAudioEnabled = (participant: RemoteParticipant | null): boolean => {
    if (!participant) return false;
    const pubs = participant.audioTrackPublications as unknown as Map<string, { track?: RemoteAudioTrack }>;
    if (!pubs) return false;
    return Array.from(pubs.values()).some(p => p.track?.kind === 'audio' && p.track.isEnabled);
  };

  // Memoized box creation for broadcaster
  const broadcasterBoxes = useMemo((): BattleBox[] => {
    const boxes: BattleBox[] = [];
    const host = participants.find(p => p.role === 'host');
    
    // Box 0: Host (broadcaster)
    const hostParticipant = host ? findParticipantByIdentity(getLiveKitIdentity(host.user_id)) : null;
    
    // For host, use local tracks when isHost is true, otherwise check remote
    let hostVideoTrack: LocalVideoTrack | RemoteVideoTrack | undefined;
    let hostAudioTrack: LocalAudioTrack | RemoteAudioTrack | undefined;
    let hostHasVideo = false;
    let hostHasAudio = false;
    
    if (isHost && localTracks) {
      hostVideoTrack = localTracks[1];
      hostAudioTrack = localTracks[0];
      hostHasVideo = !!localTracks[1];
      hostHasAudio = !!localTracks[0];
    } else if (hostParticipant) {
      hostVideoTrack = getVideoTrack(hostParticipant);
      hostAudioTrack = getAudioTrack(hostParticipant);
      hostHasVideo = hasVideoEnabled(hostParticipant);
      hostHasAudio = hasAudioEnabled(hostParticipant);
    }
    
    boxes.push({
      index: 0,
      userId: host?.user_id || userId,
      username: host?.username || userProfile?.username || 'Broadcaster',
      avatarUrl: host?.avatar_url || userProfile?.avatar_url || '',
      isVideoEnabled: hostHasVideo,
      isAudioEnabled: hostHasAudio,
      videoTrack: hostVideoTrack,
      audioTrack: hostAudioTrack,
      isLocal: isHost
    });
    
    // Boxes 1-4: Additional broadcaster side participants
    for (let i = 1; i <= 4; i++) {
      const guest = broadcasterTeam.find(p => p.seat_index === i && p.role !== 'host');
      const guestParticipant = guest ? findParticipantByIdentity(getLiveKitIdentity(guest.user_id)) : null;
      
      boxes.push({
        index: i,
        userId: guest?.user_id || null,
        username: guest?.username || (i === 1 ? 'Teammate 1' : i === 2 ? 'Teammate 2' : i === 3 ? 'Teammate 3' : 'Teammate 4'),
        avatarUrl: guest?.avatar_url || '',
        isVideoEnabled: hasVideoEnabled(guestParticipant),
        isAudioEnabled: hasAudioEnabled(guestParticipant),
        videoTrack: getVideoTrack(guestParticipant),
        audioTrack: getAudioTrack(guestParticipant),
        isLocal: false
      });
    }
    
    return boxes;
  }, [participants, broadcasterTeam, isHost, localTracks, userId, userProfile, findParticipantByIdentity, getLiveKitIdentity]);
  
  // Memoized box creation for challenger
  const challengerBoxes = useMemo((): BattleBox[] => {
    const boxes: BattleBox[] = [];
    
    // Box 0: Challenger (the person who challenged)
    const challenger = challengerTeam.find(p => p.role === 'stage');
    const challengerParticipant = challenger ? findParticipantByIdentity(getLiveKitIdentity(challenger.user_id)) : null;
    
    boxes.push({
      index: 0,
      userId: challenger?.user_id || null,
      username: challenger?.username || (challengerTeam.length > 0 ? challengerTeam[0].username : 'Challenger'),
      avatarUrl: challenger?.avatar_url || (challengerTeam.length > 0 ? challengerTeam[0].avatar_url : ''),
      isVideoEnabled: hasVideoEnabled(challengerParticipant),
      isAudioEnabled: hasAudioEnabled(challengerParticipant),
      videoTrack: getVideoTrack(challengerParticipant),
      audioTrack: getAudioTrack(challengerParticipant),
      isLocal: false
    });
    
    // Boxes 1-4: Challenger team members
    for (let i = 1; i <= 4; i++) {
      const opponent = challengerTeam.find(p => p.seat_index === i);
      const opponentParticipant = opponent ? findParticipantByIdentity(getLiveKitIdentity(opponent.user_id)) : null;
      
      boxes.push({
        index: i,
        userId: opponent?.user_id || null,
        username: opponent?.username || (i === 1 ? 'Teammate 1' : i === 2 ? 'Teammate 2' : i === 3 ? 'Teammate 3' : 'Teammate 4'),
        avatarUrl: opponent?.avatar_url || '',
        isVideoEnabled: hasVideoEnabled(opponentParticipant),
        isAudioEnabled: hasAudioEnabled(opponentParticipant),
        videoTrack: getVideoTrack(opponentParticipant),
        audioTrack: getAudioTrack(opponentParticipant),
        isLocal: false
      });
    }
    
    return boxes;
  }, [challengerTeam, findParticipantByIdentity, getLiveKitIdentity]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="text-white">Loading battle...</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-purple-900/20 to-red-900/20">
      {/* Battle Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-black/50">
        <div className="flex items-center gap-4">
          <h2 className="text-white font-bold text-lg">⚔️ BATTLE ARENA</h2>
          <span className="text-amber-400 text-sm">5v5</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-purple-400 font-bold">{broadcasterTeam.length}</span>
            <span className="text-white">vs</span>
            <span className="text-red-400 font-bold">{challengerTeam.length}</span>
          </div>
          {isHost && (
            <button
              onClick={onEndBattle}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
            >
              End Battle
            </button>
          )}
        </div>
      </div>

      {/* VS Indicator */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
        <div className="text-6xl font-black text-white drop-shadow-lg" style={{
          textShadow: '0 0 20px rgba(255,0,0,0.8), 0 0 40px rgba(168,85,247,0.8)'
        }}>
          VS
        </div>
      </div>

      {/* 5v5 Grid */}
      <div className="absolute inset-0 pt-16 pb-8 px-4 flex gap-4">
        {/* Broadcaster Side (Left) */}
        <div className="flex-1 flex flex-col gap-2">
          <div className="text-center text-purple-400 font-bold mb-2">BROADCASTER TEAM</div>
          <div className="flex-1 grid grid-cols-2 gap-2">
            {broadcasterBoxes.map(box => (
              <VideoBox key={`broadcaster-${box.userId || 'empty'}-${box.index}`} box={box} team="broadcaster" userId={userId} />
            ))}
          </div>
        </div>
        
        {/* Challenger Side (Right) */}
        <div className="flex-1 flex flex-col gap-2">
          <div className="text-center text-red-400 font-bold mb-2">CHALLENGER TEAM</div>
          <div className="flex-1 grid grid-cols-2 gap-2">
            {challengerBoxes.map(box => (
              <VideoBox key={`challenger-${box.userId || 'empty'}-${box.index}`} box={box} team="challenger" userId={userId} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
