import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { Room, LocalAudioTrack, LocalVideoTrack, RemoteParticipant, RemoteTrack, RemoteVideoTrack, RemoteAudioTrack, RemoteTrackPublication, RoomEvent, Track } from 'livekit-client';

import { supabase } from '../../lib/supabase';
import { Stream } from '../../types/broadcast';
import { useAuthStore } from '../../lib/store';
import { PreflightStore } from '../../lib/preflightStore';
import { Loader2, Coins, User, MicOff, VideoOff, Plus, Minus, Crown, Flame, ArrowLeft, Skull, Gem } from 'lucide-react';
import { useBattleRoom } from '../../hooks/useBattleRoom';
import { useCoins } from '../../lib/hooks/useCoins';
import BattleChat from './BattleChat';
import MuteHandler from './MuteHandler';
import GiftAnimationOverlay from './GiftAnimationOverlay';
import GiftTray from './GiftTray';
import TrollBattleArena from './TrollBattleArena';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// --- Sub-components for the new architecture ---

const LiveKitVideoPlayer = ({
  videoTrack,
  isLocal = false,
  onDimensionsReady,
}: {
  videoTrack?: LocalVideoTrack | RemoteVideoTrack;
  isLocal?: boolean;
  onDimensionsReady?: (width: number, height: number) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasPlayedRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  useEffect(() => {
    if (!videoTrack || !containerRef.current) {
      console.log('[LiveKitVideoPlayer] Skipping - missing track or container');
      return;
    }

    if (hasPlayedRef.current) {
      console.log('[LiveKitVideoPlayer] Already played this track - skipping duplicate');
      return;
    }

    const handleLoaded = () => {
      if (!videoRef.current) return;
      
      // This is the ONLY moment the browser actually knows the real dimensions
      const width = videoRef.current.videoWidth;
      const height = videoRef.current.videoHeight;
      
      console.log('[LiveKitVideoPlayer] REAL dimensions from loadedmetadata:', width, height);
      
      // Report dimensions back to parent if callback provided
      if (onDimensionsReady && width > 0 && height > 0) {
        onDimensionsReady(width, height);
      }
    };

    const playWithRetry = () => {
      if (!containerRef.current) return;

      try {
        console.log('[LiveKitVideoPlayer] Calling attach() - attempt', retryCountRef.current + 1);
        // LiveKit tracks use attach() instead of play()
        const videoElement = videoTrack.attach();
        
        // Store ref to the attached video element for dimension tracking
        videoRef.current = videoElement;
        
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'cover';
        // Mirror local video
        if (isLocal) {
          videoElement.style.transform = 'scaleX(-1)';
        }
        // Critical: Add autoplay and playsInline for proper video display
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        // Ensure muted for local video to avoid feedback
        if (isLocal) {
          videoElement.muted = true;
        }
        
        // Add loadedmetadata listener for reliable dimensions
        videoElement.addEventListener('loadedmetadata', handleLoaded);
        
        containerRef.current.appendChild(videoElement);
        hasPlayedRef.current = true;
        console.log('[LiveKitVideoPlayer] attach() called successfully');

        // Inspect injected video after LiveKit has time to inject it
        // Also handle case where metadata is already loaded
        setTimeout(() => {
          const inner = containerRef.current?.querySelector('video') as HTMLVideoElement | null;
          console.log('[LiveKitVideoPlayer] Inner <video> inspection:', {
            exists: !!inner,
            width: inner?.videoWidth ?? 0,
            height: inner?.videoHeight ?? 0,
            readyState: inner?.readyState ?? -1,
            paused: inner?.paused ?? false,
            muted: inner?.muted ?? false,
            srcObjectPresent: !!inner?.srcObject,
          });

          // If already loaded, trigger the handler
          if (inner && inner.videoWidth > 0 && inner.readyState >= 1) {
            handleLoaded();
          } else if (inner && (inner.videoWidth === 0 || inner.readyState < 2)) {
            // If video element has no srcObject, try to play it
            if (inner && !inner.srcObject) {
              console.log('[LiveKitVideoPlayer] Video element has no srcObject, attempting play()');
              inner.play().catch(e => console.log('[LiveKitVideoPlayer] play() failed:', e));
            }
            if (retryCountRef.current < maxRetries) {
              retryCountRef.current++;
              console.warn(`[LiveKitVideoPlayer] No frames yet (attempt ${retryCountRef.current}/${maxRetries}) - retrying in 400ms`);
              hasPlayedRef.current = false;
              setTimeout(playWithRetry, 400);
            } else {
              console.error('[LiveKitVideoPlayer] Max retries reached - no frames flowing');
            }
          }
        }, 600);

      } catch (err) {
        console.error('[LiveKitVideoPlayer] attach() threw error:', err);
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          setTimeout(playWithRetry, 500);
        }
      }
    };

    const initialTimer = setTimeout(playWithRetry, 150);

    // FIX #5: Hidden Bug - Only stop LOCAL tracks, not remote tracks
    // Also need to detach the video element from DOM
    return () => {
      clearTimeout(initialTimer);
      
      // Remove the loadedmetadata listener
      if (videoRef.current) {
        videoRef.current.removeEventListener('loadedmetadata', handleLoaded);
      }
      
      // Detach the video element from container
      if (containerRef.current) {
        const videoEl = containerRef.current.querySelector('video');
        if (videoEl) {
          try {
            videoTrack.detach();
          } catch (e) {}
        }
      }
      
      // Only stop LOCAL tracks - stopping remote tracks kills the stream
      if (isLocal && videoTrack) {
        console.log('[LiveKitVideoPlayer] Cleanup - stopping LOCAL track only');
        try {
          videoTrack.stop();
        } catch (e) {}
      }
    };
  }, [videoTrack]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full object-cover overflow-hidden"
      style={{
        minWidth: '100%',
        minHeight: '100%',
      }}
    />
  );
};

interface BattleParticipant {
  identity: string;
  name: string;
  isLocal: boolean;
  videoTrack?: LocalVideoTrack | RemoteVideoTrack;
  audioTrack?: LocalAudioTrack | RemoteAudioTrack;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  metadata: any;
  role?: 'host' | 'stage' | 'viewer';
  team?: 'challenger' | 'opponent';
  sourceStreamId?: string;
  seatIndex?: number;
  profile?: any;
  trollCoins?: number;
  trollmonds?: number;
}

interface CrownInfo {
  crowns: number;
  streak: number;
  hasStreak: boolean;
}

// Extended props for BattleParticipantTile to support single-host mode
interface BattleParticipantTileProps extends BattleParticipant {
  side: 'challenger' | 'opponent';
  crownInfo?: CrownInfo;
  isSuddenDeath?: boolean;
  onTroll?: () => void;
  canTroll?: boolean;
  isSingleHost?: boolean; // New: true when this is the only participant (no guests)
}

const BattleParticipantTile = ({
  identity,
  name,
  isLocal,
  videoTrack,
  audioTrack,
  isMicrophoneEnabled,
  isCameraEnabled,
  metadata,
  side,
  crownInfo,
  isSuddenDeath,
  onTroll,
  canTroll,
  isSingleHost = false, // Default: show boxed style
}: BattleParticipantTileProps) => {
  const isHost = metadata.role === 'host';
  const isMicMuted = !isMicrophoneEnabled;
  const isVideoOn = isCameraEnabled && !!videoTrack;

  // DEBUG: Log single host detection
  useEffect(() => {
    console.log('[BattleParticipantTile] Rendering:', {
      name,
      isHost,
      isSingleHost,
      hasVideo: !!videoTrack,
      side
    });
  }, [isSingleHost, isHost, name, side, videoTrack]);

  // When isSingleHost is true, remove box styling to match BroadcastGrid single-broadcaster layout
  // The video should fill the available space without borders/rounded corners
  const containerClass = isSingleHost
    ? "relative w-full h-full transition-all duration-300"
    : "relative rounded-2xl overflow-hidden border-2 transition-all duration-300" +
      (isHost ? " h-48 md:h-56 lg:h-64" : " h-32 md:h-36 lg:h-40") +
      (side === 'challenger' 
        ? " border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.3)]" 
        : " border-emerald-500/50 shadow-[0_0_20px_rgba(34,197,94,0.3)]") +
      " bg-black/60 backdrop-blur-sm";

  return (
    <div className={cn(containerClass)}>
      {/* Video or Avatar */}
      {isVideoOn ? (
        <LiveKitVideoPlayer videoTrack={videoTrack} isLocal={isLocal} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/80">
          <div className={cn(
            "rounded-full flex items-center justify-center border-2 mb-2",
            isHost ? "w-16 h-16 md:w-20 md:h-20 border-amber-500/50" : "w-12 h-12 md:w-14 md:h-14 border-white/20"
          )}>
            <User className="text-zinc-400" size={isHost ? 32 : 24} />
          </div>
          <div className="flex items-center gap-2 text-zinc-500 text-xs">
            <VideoOff size={14} />
            <span>Camera Off</span>
          </div>
        </div>
      )}

      {/* Crown & Streak Badge */}
      {isHost && crownInfo && crownInfo.crowns > 0 && (
        <div className="absolute -top-1 -right-1 z-20">
          <div className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold shadow-lg",
            crownInfo.hasStreak 
              ? "bg-gradient-to-r from-yellow-400 to-amber-500 text-black animate-pulse"
              : "bg-gradient-to-r from-amber-600 to-yellow-600 text-white"
          )}>
            <Crown size={12} className={crownInfo.hasStreak ? "fill-black" : "fill-white"} />
            <span>{crownInfo.crowns}</span>
            {crownInfo.hasStreak && (
              <Flame size={12} className="ml-0.5 fill-black" />
            )}
          </div>
        </div>
      )}

      {/* Streak indicator */}
      {isHost && crownInfo?.hasStreak && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-20">
          <motion.div 
            initial={{ scale: 0, y: -10 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-0.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1"
          >
            <Flame size={12} className="fill-white" />
            <span>{crownInfo.streak} WIN STREAK!</span>
          </motion.div>
        </div>
      )}

      {/* Troll Button - Only during sudden death */}
      {isHost && isSuddenDeath && canTroll && onTroll && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            onTroll();
          }}
          className="absolute bottom-2 right-2 z-20 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white p-2 rounded-full shadow-lg border-2 border-white/20"
          title="Troll Opponent (Deduct 1% coins)"
        >
          <Skull size={18} />
        </motion.button>
      )}

      {/* Overlay Info */}
      <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-10">
        <div className={cn(
          "flex items-center gap-2 backdrop-blur-md px-2 py-1 rounded-full border",
          isHost 
            ? "bg-amber-500/20 border-amber-500/40" 
            : "bg-black/60 border-white/10"
        )}>
          <span className={cn(
            "text-xs font-bold",
            isHost ? "text-amber-400" : "text-white"
          )}>
            {name || 'Anonymous'}
          </span>
          {isHost && (
            <span className="text-[8px] bg-gradient-to-r from-amber-500 to-yellow-500 text-black px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              HOST
            </span>
          )}
        </div>
        
        {isMicMuted && (
          <div className="bg-red-500 p-1.5 rounded-full shadow-lg">
            <MicOff size={12} className="text-white" />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * The main split arena component
 */
interface BattleArenaProps {
  onGift: (uid: string, sourceStreamId: string) => void;
  battleId: string;
  localAudioTrack: LocalAudioTrack | null;
  localVideoTrack: LocalVideoTrack | null;
  localIsCameraEnabled?: boolean;
  localIsMicEnabled?: boolean;
  remoteUsers: RemoteParticipant[];
  challengerStreamId: string;
  opponentStreamId: string;
  challengerHostId: string;
  opponentHostId: string;
  challengerBoxCount?: number;
  opponentBoxCount?: number;
  challengerCrownInfo?: CrownInfo;
  opponentCrownInfo?: CrownInfo;
  isSuddenDeath?: boolean;
  onTrollOpponent?: (targetStreamId: string) => void;
  canTroll?: boolean;
  currentUserTeam?: 'challenger' | 'opponent' | null;
  userIdToLiveKitIdentity?: Record<string, string>;
}

const BattleArena = ({
  onGift,
  battleId,
  localAudioTrack,
  localVideoTrack,
  localIsCameraEnabled,
  localIsMicEnabled,
  remoteUsers,
  challengerStreamId,
  opponentStreamId,
  challengerHostId,
  opponentHostId,
  challengerBoxCount = 1,
  opponentBoxCount = 1,
  challengerCrownInfo,
  opponentCrownInfo,
  isSuddenDeath = false,
  onTrollOpponent,
  canTroll = false,
  currentUserTeam,
  userIdToLiveKitIdentity,
}: BattleArenaProps) => {
  const { user } = useAuthStore();
  const [battleParticipants, setBattleParticipants] = useState<BattleParticipant[]>([]);
  
  // Helper to get username from participant (checks profile join first)
  const getUsername = (participant: any, fallback = 'Anonymous'): string => {
    return participant?.profile?.username || participant?.username || fallback;
  };
  
  useEffect(() => {
    const fetchParticipantData = async () => {
      const getSupabaseParticipant = async (userId: string) => {
        const { data, error } = await supabase
          .from('battle_participants')
          .select('*, profile:user_profiles(id, username, avatar_url, troll_coins, trollmonds)')
          .eq('battle_id', battleId)
          .eq('user_id', userId)
          .maybeSingle();
        if (error) console.error(`Failed to fetch battle_participant for user ${userId}:`, error);
        console.log('[BattleArena] getSupabaseParticipant for', userId, ':', data);
        return data;
      };

      const participantsData: BattleParticipant[] = [];

      // First, fetch ALL battle participants from database to ensure slots are shown
      // even before LiveKit connections are established
      const { data: allParticipants } = await supabase
        .from('battle_participants')
        .select('*, profile:user_profiles(id, username, avatar_url, troll_coins, trollmonds)')
        .eq('battle_id', battleId);

      // Add database participants even if they're not in LiveKit yet
      if (allParticipants) {
        for (const dbParticipant of allParticipants) {
          // Skip if we already have this participant
          if (participantsData.some(p => p.identity === dbParticipant.user_id)) continue;
          
          let metadata: any = {};
          if (dbParticipant.metadata) {
            try {
              metadata = JSON.parse(dbParticipant.metadata);
            } catch (e) {}
          }
          
          // Determine team from host IDs if not set
          let team: 'challenger' | 'opponent' | null = dbParticipant.team;
          if (!team) {
            if (dbParticipant.user_id === challengerHostId) {
              team = 'challenger';
            } else if (dbParticipant.user_id === opponentHostId) {
              team = 'opponent';
            }
          }
          
          // Get username from profile if available (joined via profile:user_profiles)
          const getUsername = (participant: any): string => {
            return participant.profile?.username || participant.username || 'Anonymous';
          };
          
          participantsData.push({
            identity: dbParticipant.user_id,
            name: getUsername(dbParticipant),
            isLocal: false, // Database participants aren't local until they connect
            videoTrack: undefined,
            audioTrack: undefined,
            isMicrophoneEnabled: false,
            isCameraEnabled: false,
            metadata: metadata,
            role: dbParticipant.role,
            team: team,
            sourceStreamId: metadata.sourceStreamId,
            seatIndex: metadata.seatIndex,
            profile: dbParticipant.profile,
            trollCoins: dbParticipant.profile?.troll_coins || 0,
            trollmonds: dbParticipant.profile?.trollmonds || 0,
          });
        }
      }

      // Helper to find LiveKit identity for a user ID
      const findLiveKitIdentity = (userId: string): string | undefined => {
        if (userIdToLiveKitIdentity) {
          return userIdToLiveKitIdentity[userId];
        }
        return undefined;
      };

      // Helper to find RemoteParticipant by LiveKit identity
      const findRemoteParticipant = (livekitIdentity: string): RemoteParticipant | undefined => {
        return remoteUsers.find(u => u.identity === livekitIdentity);
      };

      // Local participant
      if (user) {
        const localSupabaseParticipant = await getSupabaseParticipant(user.id);
        let localMetadata: any = {};
        if (localSupabaseParticipant?.metadata) {
          try {
            localMetadata = JSON.parse(localSupabaseParticipant.metadata);
          } catch (e) {
            console.error("Failed to parse metadata for local user:", user.id, e);
          }
        }
        // Get username from profile if available (joined via profile:user_profiles)
        const getUsername = (participant: any): string => {
          return participant.profile?.username || participant.username || 'You';
        };
        
        participantsData.push({
          identity: user.id,
          name: getUsername(localSupabaseParticipant) || user.user_metadata?.username || 'You',
          isLocal: true,
          videoTrack: localVideoTrack,
          audioTrack: localAudioTrack,
          // Use explicitly passed enabled state, fallback to track-based detection
          isMicrophoneEnabled: localIsMicEnabled ?? (localAudioTrack?.enabled ?? false),
          // Be more lenient with camera check - use explicit state if available, otherwise check track
          isCameraEnabled: localIsCameraEnabled ?? !!localVideoTrack,
          metadata: localMetadata,
          role: localSupabaseParticipant?.role,
          team: localSupabaseParticipant?.team,
          sourceStreamId: localMetadata.sourceStreamId,
          seatIndex: localMetadata.seatIndex,
          profile: localSupabaseParticipant?.profile,
          trollCoins: localSupabaseParticipant?.profile?.troll_coins || 0,
          trollmonds: localSupabaseParticipant?.profile?.trollmonds || 0,
        });
      }

      // Remote participants - use mapping to identify which team each belongs to
      for (const remoteUser of remoteUsers) {
        // Try to match remote user to a team using the LiveKit identity mapping
        let matchedUserId: string | null = null;
        let matchedTeam: 'challenger' | 'opponent' | null = null;
        
        if (userIdToLiveKitIdentity) {
          // Find which user ID has this LiveKit identity
          for (const [userId, identity] of Object.entries(userIdToLiveKitIdentity)) {
            if (identity === remoteUser.identity) {
              matchedUserId = userId;
              // Determine team based on which stream this user owns
              if (userId === challengerHostId) {
                matchedTeam = 'challenger';
              } else if (userId === opponentHostId) {
                matchedTeam = 'opponent';
              }
              break;
            }
          }
        }

        // If we didn't find a match via mapping, try to find participant by LiveKit identity directly
        // This handles the case where the identity IS the user ID
        if (!matchedUserId) {
          const { data: participantByIdentity } = await supabase
            .from('battle_participants')
            .select('*, profile:user_profiles(id, username, avatar_url, troll_coins, trollmonds)')
            .eq('battle_id', battleId)
            .eq('user_id', remoteUser.identity)
            .maybeSingle();
          
          if (participantByIdentity) {
            matchedUserId = remoteUser.identity;
            matchedTeam = participantByIdentity.team;
          }
        }

        // If we still don't have a match, skip this participant
        if (!matchedUserId) {
          console.log('[BattleArena] Skipping unmatched remote participant:', remoteUser.identity);
          continue;
        }

        // If we found a match, get participant data from database
        let remoteSupabaseParticipant = null;
        let remoteMetadata: any = {};
        
        if (matchedUserId) {
          remoteSupabaseParticipant = await getSupabaseParticipant(matchedUserId);
          if (remoteSupabaseParticipant?.metadata) {
            try {
              remoteMetadata = JSON.parse(remoteSupabaseParticipant.metadata);
            } catch (e) {
              console.error("Failed to parse metadata for remote user:", remoteUser.identity, e);
            }
          }
          // Use team from database if not set from mapping
          if (!matchedTeam && remoteSupabaseParticipant?.team) {
            matchedTeam = remoteSupabaseParticipant.team;
          }
        }

        // FIX #1: Correct Track Extraction - use publications with isSubscribed check
        // Use proper source mapping - check publication.source against Track.Source enum
        const videoPublications = Array.from(remoteUser.videoTracks.values()) as RemoteTrackPublication[];
        const audioPublications = Array.from(remoteUser.audioTracks.values()) as RemoteTrackPublication[];
        
        // Log ALL publication details for debugging
        videoPublications.forEach(p => {
          console.log('[BattleArena] Video publication:', {
            sid: p.sid,
            trackSid: p.trackSid,
            source: p.source,
            isSubscribed: p.isSubscribed,
            trackKind: p.kind,
            hasTrack: !!p.track,
            trackId: p.track?.id,
            trackSidFromTrack: p.track?.sid,
            // Use Track.Source enum for proper comparison
            isCamera: p.source === Track.Source.Camera,
            isScreen: p.source === Track.Source.ScreenShare,
          });
        });
        
        audioPublications.forEach(p => {
          console.log('[BattleArena] Audio publication:', {
            sid: p.sid,
            trackSid: p.trackSid,
            source: p.source,
            isSubscribed: p.isSubscribed,
            trackKind: p.kind,
            hasTrack: !!p.track,
            trackId: p.track?.id,
            trackSidFromTrack: p.track?.sid,
            isMic: p.source === Track.Source.Microphone,
          });
        });
        
        // Find subscribed tracks - prefer Camera source for video, Microphone for audio
        // Note: p.track might be undefined even when isSubscribed is true, so we check both
        const videoPub = videoPublications.find(p => p.isSubscribed && p.track && p.source === Track.Source.Camera) 
          || videoPublications.find(p => p.isSubscribed && p.track);
        const audioPub = audioPublications.find(p => p.isSubscribed && p.track && p.source === Track.Source.Microphone)
          || audioPublications.find(p => p.isSubscribed && p.track);
        
        // Log what we found
        console.log('[BattleArena] Selected video publication:', {
          found: !!videoPub,
          sid: videoPub?.sid,
          trackSid: videoPub?.trackSid,
          hasTrack: !!videoPub?.track,
          trackSidFromTrack: videoPub?.track?.sid,
        });
        console.log('[BattleArena] Selected audio publication:', {
          found: !!audioPub,
          sid: audioPub?.sid,
          trackSid: audioPub?.trackSid,
          hasTrack: !!audioPub?.track,
          trackSidFromTrack: audioPub?.track?.sid,
        });
        
        // Check if there's a subscribed video track - be more permissive to show video when available
        // Don't require isEnabled as it may not be set correctly for remote tracks
        const hasVideoTrack = !!(videoPub?.track);
        const hasAudioTrack = !!(audioPub?.track);
        
        // Update existing participant or add new one
        const existingIdx = participantsData.findIndex(p => p.identity === matchedUserId);
        // Get username from profile join
        const remoteName = remoteSupabaseParticipant?.profile?.username || remoteSupabaseParticipant?.username || `User ${remoteUser.identity.substring(0, 8)}`;
        const participantData = {
          identity: remoteUser.identity,
          name: remoteName,
          isLocal: false,
          videoTrack: videoPub?.track as RemoteVideoTrack | undefined,
          audioTrack: audioPub?.track as RemoteAudioTrack | undefined,
          isMicrophoneEnabled: hasAudioTrack,
          isCameraEnabled: hasVideoTrack,
          metadata: remoteMetadata,
          role: remoteSupabaseParticipant?.role || (matchedTeam ? 'host' : 'stage'),
          team: matchedTeam || remoteSupabaseParticipant?.team || null,
          sourceStreamId: remoteMetadata.sourceStreamId,
          seatIndex: remoteMetadata.seatIndex,
          profile: remoteSupabaseParticipant?.profile,
          trollCoins: remoteSupabaseParticipant?.profile?.troll_coins || 0,
          trollmonds: remoteSupabaseParticipant?.profile?.trollmonds || 0,
        };
        
        if (existingIdx >= 0) {
          participantsData[existingIdx] = participantData;
        } else {
          participantsData.push(participantData);
        }
      }
      setBattleParticipants(participantsData);
    };

    fetchParticipantData();
  }, [remoteUsers, user, localAudioTrack, localVideoTrack, battleId, userIdToLiveKitIdentity, challengerHostId, opponentHostId]);

  const categorized = useMemo(() => {
    const teams = {
      challenger: { host: null as BattleParticipant | null, guests: [] as BattleParticipant[], boxCount: Math.max(1, Math.min(challengerBoxCount, 6)) },
      opponent: { host: null as BattleParticipant | null, guests: [] as BattleParticipant[], boxCount: Math.max(1, Math.min(opponentBoxCount, 6)) }
    };

    battleParticipants.forEach(p => {
      if (p.team === 'challenger' || p.team === 'opponent') {
        if (p.role === 'host') {
          teams[p.team].host = p;
        } else if (p.role === 'stage') {
          teams[p.team].guests.push(p);
        }
      }
    });

    const sortBySeat = (a: BattleParticipant, b: BattleParticipant) => {
      return (a.seatIndex || 0) - (b.seatIndex || 0);
    };
    
    teams.challenger.guests.sort(sortBySeat);
    teams.opponent.guests.sort(sortBySeat);

    return teams;
  }, [battleParticipants, challengerBoxCount, opponentBoxCount]);

  const handleGiftClick = (p: BattleParticipant) => {
    const resolvedStreamId =
      p.sourceStreamId ||
      (p.team === 'challenger' ? challengerStreamId : p.team === 'opponent' ? opponentStreamId : '');

    if (!resolvedStreamId || !p.identity) return;
    onGift(p.identity, resolvedStreamId);
  };

  const handleSideGiftClick = (team: 'challenger' | 'opponent') => {
    const streamId = team === 'challenger' ? challengerStreamId : opponentStreamId;
    const hostId = team === 'challenger' ? challengerHostId : opponentHostId;
    if (!streamId || !hostId) return;
    onGift(hostId, streamId);
  };

  const handleTrollClick = (team: 'challenger' | 'opponent') => {
    if (!onTrollOpponent) return;
    const targetStreamId = team === 'challenger' ? challengerStreamId : opponentStreamId;
    onTrollOpponent(targetStreamId);
  };

  // Generate placeholder slots based on box_count for each team - show ALL slots including empty ones
  const generateSlots = (team: 'challenger' | 'opponent') => {
    const teamData = categorized[team];
    const boxCount = Math.min(teamData.boxCount, 6);
    const slots: Array<{ type: 'host' | 'guest'; participant?: BattleParticipant | null; index?: number }> = [];
    
    // Always include host slot (can be empty)
    slots.push({ type: 'host', participant: teamData.host || null });
    
    // Generate guest slots based on box_count
    const guestSlots = Math.max(0, boxCount - 1);
    for (let i = 0; i < guestSlots; i++) {
      const guest = teamData.guests[i];
      slots.push({ type: 'guest', participant: guest || null, index: i + 1 });
    }
    
    return slots;
  };

  const challengerSlots = generateSlots('challenger');
  const opponentSlots = generateSlots('opponent');

  // DEBUG: Log slot counts to diagnose single-host scenarios
  useEffect(() => {
    console.log('[BattleArena] Slot counts:', {
      challengerSlots: challengerSlots.length,
      opponentSlots: opponentSlots.length,
      challengerGuests: categorized.challenger.guests.length,
      opponentGuests: categorized.opponent.guests.length
    });
  }, [challengerSlots.length, opponentSlots.length, categorized.challenger.guests.length, categorized.opponent.guests.length]);

  // Determine if a side has only the host (no guests) - for single-host styling
  const challengerIsSingleHost = challengerSlots.length === 1 && challengerSlots[0]?.type === 'host';
  const opponentIsSingleHost = opponentSlots.length === 1 && opponentSlots[0]?.type === 'host';

  const getGridClass = (totalSlots: number) => {
    // Match BroadcastGrid layout logic
    if (totalSlots === 1) return 'grid-cols-1 grid-rows-1';
    if (totalSlots === 2) return 'grid-cols-1 md:grid-cols-2 grid-rows-1';
    if (totalSlots === 3) return 'grid-cols-2 grid-rows-2';
    if (totalSlots === 4) return 'grid-cols-2 grid-rows-2';
    if (totalSlots === 5) return 'grid-cols-2 grid-rows-3';
    if (totalSlots === 6) return 'grid-cols-3 grid-rows-2';
    return 'grid-cols-2 grid-rows-3';
  };

  return (
    <div className="flex-1 flex overflow-hidden p-2 md:p-4 gap-2 md:gap-4">
      {/* Challenger Side */}
      <div className="flex-1 flex flex-col gap-2 md:gap-3 overflow-y-auto pr-1 scrollbar-hide">
        <button
          onClick={() => handleSideGiftClick('challenger')}
          className="self-start px-3 py-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white border border-purple-400/50 shadow-lg shadow-purple-500/20 transition-all hover:scale-105"
        >
          Gift Side A
        </button>
        
        {/* Unified Grid for Host + Guests - match BroadcastGrid layout */}
        <div className={`grid gap-2 ${getGridClass(challengerSlots.length)} flex-1`}>
          {challengerSlots.map((slot, idx) => (
            <div key={`challenger-slot-${idx}`} className="min-h-0">
              {slot.type === 'host' ? (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (slot.participant) {
                      handleGiftClick(slot.participant);
                    }
                  }}
                  className={cn(
                    "cursor-pointer transform transition-transform hover:scale-[1.02] h-full",
                    !slot.participant && "opacity-50"
                  )}
                >
                  {slot.participant ? (
                    <BattleParticipantTile 
                      {...slot.participant} 
                      side="challenger" 
                      crownInfo={challengerCrownInfo}
                      isSuddenDeath={isSuddenDeath}
                      canTroll={canTroll && currentUserTeam === 'opponent'}
                      onTroll={() => handleTrollClick('challenger')}
                      isSingleHost={challengerIsSingleHost}
                    />
                  ) : (
                    <div className="h-full min-h-[120px] rounded-2xl border-2 border-purple-500/30 bg-black/40 flex flex-col items-center justify-center">
                      <User className="text-purple-500/50" size={48} />
                      <span className="text-purple-500/50 text-sm mt-2">Waiting for challenger...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (slot.participant) {
                      handleGiftClick(slot.participant!);
                    }
                  }}
                  className={cn(
                    "cursor-pointer transform transition-transform hover:scale-[1.02] h-full",
                    !slot.participant && "opacity-50"
                  )}
                >
                  {slot.participant ? (
                    <BattleParticipantTile {...slot.participant} side="challenger" />
                  ) : (
                    <div className="h-full min-h-[100px] rounded-2xl border border-purple-500/20 bg-black/20 flex flex-col items-center justify-center">
                      <User className="text-purple-500/30" size={24} />
                      <span className="text-purple-500/30 text-xs mt-1">Empty</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* VS Divider */}
      <div className="w-px bg-gradient-to-b from-transparent via-amber-500/50 to-transparent" />

      {/* Opponent Side */}
      <div className="flex-1 flex flex-col gap-2 md:gap-3 overflow-y-auto pl-1 scrollbar-hide">
        <button
          onClick={() => handleSideGiftClick('opponent')}
          className="self-start px-3 py-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white border border-emerald-400/50 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
        >
          Gift Side B
        </button>
        
        {/* Unified Grid for Host + Guests - match BroadcastGrid layout */}
        <div className={`grid gap-2 ${getGridClass(opponentSlots.length)} flex-1`}>
          {opponentSlots.map((slot, idx) => (
            <div key={`opponent-slot-${idx}`} className="min-h-0">
              {slot.type === 'host' ? (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (slot.participant) {
                      handleGiftClick(slot.participant);
                    }
                  }}
                  className={cn(
                    "cursor-pointer transform transition-transform hover:scale-[1.02] h-full",
                    !slot.participant && "opacity-50"
                  )}
                >
                  {slot.participant ? (
                    <BattleParticipantTile 
                      {...slot.participant} 
                      side="opponent" 
                      crownInfo={opponentCrownInfo}
                      isSuddenDeath={isSuddenDeath}
                      canTroll={canTroll && currentUserTeam === 'challenger'}
                      onTroll={() => handleTrollClick('opponent')}
                      isSingleHost={opponentIsSingleHost}
                    />
                  ) : (
                    <div className="h-full min-h-[120px] rounded-2xl border-2 border-emerald-500/30 bg-black/40 flex flex-col items-center justify-center">
                      <User className="text-emerald-500/50" size={48} />
                      <span className="text-emerald-500/50 text-sm mt-2">Waiting for opponent...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (slot.participant) {
                      handleGiftClick(slot.participant!);
                    }
                  }}
                  className={cn(
                    "cursor-pointer transform transition-transform hover:scale-[1.02] h-full",
                    !slot.participant && "opacity-50"
                  )}
                >
                  {slot.participant ? (
                    <BattleParticipantTile {...slot.participant} side="opponent" />
                  ) : (
                    <div className="h-full min-h-[100px] rounded-2xl border border-emerald-500/20 bg-black/20 flex flex-col items-center justify-center">
                      <User className="text-emerald-500/30" size={24} />
                      <span className="text-emerald-500/30 text-xs mt-1">Empty</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MemoBattleArena = React.memo(BattleArena);

// --- Main Component ---

interface BattleViewProps {
  battleId: string;
  currentStreamId: string;
  viewerId?: string;
  localTracks?: [LocalAudioTrack, LocalVideoTrack] | null;
  remoteUsers?: RemoteParticipant[];
  userIdToLiveKitIdentity?: Record<string, string>;
  onReturnToStream?: () => void;
}

export default function BattleView({ battleId, currentStreamId, viewerId, localTracks: passedLocalTracks, remoteUsers: passedRemoteUsers, userIdToLiveKitIdentity, onReturnToStream }: BattleViewProps) {
  const [battle, setBattle] = useState<any>(null);
  const [challengerStream, setChallengerStream] = useState<Stream | null>(null);
  const [opponentStream, setOpponentStream] = useState<Stream | null>(null);
  const [participantInfo, setParticipantInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  
  // Get coin/crown balances for display
  const { troll_coins: userCoins, crowns: userCrowns, trollmonds: userTrollmonds } = useCoins();
  
  // Explicitly track enabled state to ensure camera stays on during battle
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [participantSnapshots, setParticipantSnapshots] = useState<Array<{ user_id: string; role: 'host' | 'stage' | 'viewer' }>>([]);
  const [arenaReadyAtMs, setArenaReadyAtMs] = useState<number | null>(null);
  const [arenaReady, setArenaReady] = useState(false);
  const [challengerCrownInfo, setChallengerCrownInfo] = useState<CrownInfo>({ crowns: 0, streak: 0, hasStreak: false });
  const [opponentCrownInfo, setOpponentCrownInfo] = useState<CrownInfo>({ crowns: 0, streak: 0, hasStreak: false });
  
  const publishedArenaReadyRef = useRef(false);
  
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const effectiveUserId = viewerId || user?.id;

  const isBroadcaster = participantInfo?.role === 'host' || participantInfo?.role === 'stage';

  // Get local tracks from PreflightStore
  const prefightTracks = PreflightStore.getLivekitTracks();
  const localTracksFromPreflight = prefightTracks || passedLocalTracks || null;

  // Use the new useBattleRoom hook for deterministic, stable connections
  const {
    room: livekitRoom,
    isConnected,
    isConnecting,
    remoteParticipants,
    localAudioTrack,
    localVideoTrack,
    error: battleRoomError,
    connect: connectToBattleRoom,
    disconnect: disconnectFromBattleRoom,
  } = useBattleRoom({
    battleId,
    challengerUserId: challengerStream?.user_id || '',
    opponentUserId: opponentStream?.user_id || '',
    currentUserId: effectiveUserId || '',
    isPublisher: isBroadcaster,
    localTracks: localTracksFromPreflight,
    onRoomConnected: (room) => {
      console.log('[BattleView] Battle room connected, room:', room.name);
      setIsCameraEnabled(true);
      setIsMicEnabled(true);
    },
    onRoomDisconnected: () => {
      console.log('[BattleView] Battle room disconnected');
    },
  });

  // Auto-connect when battle is ready and we have user IDs
  useEffect(() => {
    if (
      battle && 
      challengerStream && 
      opponentStream && 
      effectiveUserId &&
      !isConnected &&
      !isConnecting &&
      battle.status === 'active'
    ) {
      console.log('[BattleView] Auto-connecting to battle room...');
      connectToBattleRoom();
    }
  }, [battle, challengerStream, opponentStream, effectiveUserId, isConnected, isConnecting, connectToBattleRoom]);

  // Update mic/camera enabled state based on track availability
  useEffect(() => {
    if (localAudioTrack) {
      setIsMicEnabled(true);
    }
    if (localVideoTrack) {
      setIsCameraEnabled(true);
    }
  }, [localAudioTrack, localVideoTrack]);

  // Fetch crown info for both broadcasters
  useEffect(() => {
    const fetchCrownInfo = async () => {
      if (!challengerStream?.user_id || !opponentStream?.user_id) return;

      const { data: challengerProfile } = await supabase
        .from('user_profiles')
        .select('battle_crowns, battle_crown_streak')
        .eq('id', challengerStream.user_id)
        .single();

      const { data: opponentProfile } = await supabase
        .from('user_profiles')
        .select('battle_crowns, battle_crown_streak')
        .eq('id', opponentStream.user_id)
        .single();

      if (challengerProfile) {
        setChallengerCrownInfo({
          crowns: challengerProfile.battle_crowns || 0,
          streak: challengerProfile.battle_crown_streak || 0,
          hasStreak: (challengerProfile.battle_crown_streak || 0) >= 3,
        });
      }

      if (opponentProfile) {
        setOpponentCrownInfo({
          crowns: opponentProfile.battle_crowns || 0,
          streak: opponentProfile.battle_crown_streak || 0,
          hasStreak: (opponentProfile.battle_crown_streak || 0) >= 3,
        });
      }
    };

    fetchCrownInfo();
  }, [challengerStream?.user_id, opponentStream?.user_id]);

  // LiveKit setup - check if we should reuse existing room or create new one
  useEffect(() => {
    // First, check for existing room from PreflightStore
    const existingRoom = PreflightStore.getLivekitRoom();
    const existingTracks = PreflightStore.getLivekitTracks();
    
    // Check if there's a valid existing room and tracks to reuse
    if (existingRoom && existingTracks && existingTracks[1]) {
      console.log('[BattleView] Reusing existing LiveKit room and tracks from PreflightStore');
      isReusingRoomRef.current = true;
      setLivekitRoom(existingRoom);
      
      // FIX #3: Load already connected participants when reusing room
      setRemoteUsers(Array.from(existingRoom.remoteParticipants.values()));
      
      console.log('[BattleView] Reusing existing tracks from PreflightStore - will publish to battle room');
      console.log('[BattleView] existingTracks:', { audio: !!existingTracks[0], video: !!existingTracks[1] });
      setLocalAudioTrack(existingTracks[0]);
      setLocalVideoTrack(existingTracks[1]);
      
      // CRITICAL FIX: Publish existing tracks to the battle room!
      // Without this, the camera shows locally but others in battle can't see it
      const hasPublishedRef = { current: false };
      
      const publishTracksToBattle = async () => {
        // Prevent multiple simultaneous publish attempts
        if (hasPublishedRef.current) {
          console.log('[BattleView] Publish already in progress, skipping duplicate call');
          return;
        }
        
        console.log('[BattleView] publishTracksToBattle called - room state:', existingRoom?.state);
        
        if (!existingRoom || existingRoom.state !== 'connected') {
          console.log('[BattleView] Room not connected yet, waiting... Current state:', existingRoom?.state);
          setTimeout(publishTracksToBattle, 500);
          return;
        }
        
        // Mark as published to prevent duplicate attempts
        hasPublishedRef.current = true;
        
        // DEBUG: Log current published tracks before attempting to publish
        const currentPublications = Array.from(existingRoom.localParticipant.tracks.values());
        console.log('[BattleView] Current local publications:', currentPublications.map((p: any) => ({ trackSid: p.trackSid, source: p.source, isSubscribed: p.isSubscribed })));
        
        console.log('[BattleView] Publishing tracks to battle room...');
        try {
          // Publish audio track
          if (existingTracks[0]) {
            // Check if track is already published
            const alreadyPublished = currentPublications.some((p: any) => p.trackSid === existingTracks[0].sid);
            console.log('[BattleView] Audio track already published?', alreadyPublished);
            
            if (!alreadyPublished) {
              await existingRoom.localParticipant.publishTrack(existingTracks[0], { name: 'audio' });
              console.log('[BattleView] Published audio track to battle room');
            }
            setIsMicEnabled(true);
          }
          
          // Publish video track
          if (existingTracks[1]) {
            // Check if track is already published
            const alreadyPublished = currentPublications.some((p: any) => p.trackSid === existingTracks[1].sid);
            console.log('[BattleView] Video track already published?', alreadyPublished);
            
            if (!alreadyPublished) {
              await existingRoom.localParticipant.publishTrack(existingTracks[1], { name: 'video' });
              console.log('[BattleView] Published video track to battle room');
            }
            setIsCameraEnabled(true);
          }
          
          // Verify tracks are now published
          const afterPublications = Array.from(existingRoom.localParticipant.tracks.values());
          console.log('[BattleView] After publish - local publications:', afterPublications.map((p: any) => ({ trackSid: p.trackSid, source: p.source })));
          
        } catch (e) {
          console.error('[BattleView] Failed to publish tracks to battle room:', e);
          // Reset the flag to allow retry
          hasPublishedRef.current = false;
          // Retry once after delay
          setTimeout(publishTracksToBattle, 1000);
        }
      };
      
      // Publish tracks after a short delay to ensure room is connected
      setTimeout(publishTracksToBattle, 300);
      
      // Subscribe to existing participants
      const handleParticipantConnected = (participant: RemoteParticipant) => {
        console.log('[BattleView] Participant connected:', participant.identity);
        setRemoteUsers(prev => {
          if (prev.some(p => p.identity === participant.identity)) return prev;
          return [...prev, participant];
        });
      };

      const handleParticipantDisconnected = (participant: RemoteParticipant) => {
        console.log('[BattleView] Participant disconnected:', participant.identity);
        setRemoteUsers(prev => prev.filter(p => p.identity !== participant.identity));
      };

      existingRoom.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
      existingRoom.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      
      return () => {
        // Don't disconnect the room if we reused it - it belongs to the main broadcast
        // Only unsubscribe from events
        if (isReusingRoomRef.current && existingRoom) {
          existingRoom.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
          existingRoom.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
        }
      };
    }
    
    // Fallback: Create new room only if no existing room
    console.log('[BattleView] No existing room found, creating new connection');
    isReusingRoomRef.current = false;
    const client = new Room({ mode: 'rtc', codec: 'vp8' });
    setLivekitRoom(client);
    let mounted = true;
    let createdAudioTrack: LocalAudioTrack | null = null;
    let createdVideoTrack: LocalVideoTrack | null = null;

    const joinBattle = async () => {
      if (!battle || !effectiveUserId) return;

      const roomName = `battle-${battle.id}`;

      if (isBroadcaster) {
        try {
          const { data, error } = await supabase.functions.invoke('livekit-token', {
            body: { room: roomName, userId: effectiveUserId, role: 'publisher' },
          });
          if (error) throw error;

          await client.connect(
            import.meta.env.VITE_LIVEKIT_URL || 'wss://troll-yuvlkqig.livekit.cloud',
            data.token,
            { name: roomName }
          );

          if (passedLocalTracks) {
            // Handle tracks independently - publish whatever is available
            if (passedLocalTracks[0]) {
              setLocalAudioTrack(passedLocalTracks[0]);
              setIsMicEnabled(true);
              try {
                // Pass trackName to ensure proper identification in battle room
                await client.localParticipant.publishTrack(passedLocalTracks[0], { name: 'audio' });
              } catch (e) {
                console.warn('[BattleView] Failed to publish audio track:', e);
              }
            }
            if (passedLocalTracks[1]) {
              setLocalVideoTrack(passedLocalTracks[1]);
              setIsCameraEnabled(true);
              try {
                // Pass trackName to ensure proper identification in battle room
                await client.localParticipant.publishTrack(passedLocalTracks[1], { name: 'video' });
              } catch (e) {
                console.warn('[BattleView] Failed to publish video track:', e);
              }
            }
          } else {
            // Use the recommended approach: enableCameraAndMicrophone
            try {
              const tracks = await client.localParticipant.enableCameraAndMicrophone();
              if (!mounted) return;
              
              const audioTrack = tracks.find(t => t.kind === 'audio') as LocalAudioTrack | undefined;
              const videoTrack = tracks.find(t => t.kind === 'video') as LocalVideoTrack | undefined;
              
              if (audioTrack) {
                createdAudioTrack = audioTrack;
                setLocalAudioTrack(audioTrack);
              }
              if (videoTrack) {
                createdVideoTrack = videoTrack;
                setLocalVideoTrack(videoTrack);
              }
            } catch (trackError) {
              console.warn('[BattleView] Failed to enable camera/mic:', trackError);
              // Try manual track creation as fallback
              try {
                const audioTrack = await LocalAudioTrack.create({
                  AEC: true,
                  AGC: true,
                  ANS: true
                });
                const videoTrack = await LocalVideoTrack.create();

                createdAudioTrack = audioTrack;
                createdVideoTrack = videoTrack;
                if (!mounted) return;
                setLocalAudioTrack(audioTrack);
                setLocalVideoTrack(videoTrack);

                await client.localParticipant.publishTrack(audioTrack);
                await client.localParticipant.publishTrack(videoTrack);
              } catch (manualError) {
                console.error('[BattleView] Manual track creation also failed:', manualError);
              }
            }
          }
        } catch (error) {
          console.error("Failed to join battle as publisher:", error);
          toast.error("Couldn't connect to the battle.");
        }
      } else {
        try {
          const { data, error } = await supabase.functions.invoke('livekit-token', {
            body: { room: roomName, userId: effectiveUserId, role: 'viewer' },
          });
          if (error) throw error;
          
          await client.connect(
            import.meta.env.VITE_LIVEKIT_URL || 'wss://troll-yuvlkqig.livekit.cloud',
            data.token,
            { name: roomName }
          );
        } catch (error) {
          console.error("Failed to join battle as viewer:", error);
        }
      }
    };

    // Handle participant connected
    const handleParticipantConnected = (participant: RemoteParticipant) => {
      console.log('[BattleView] Participant connected:', participant.identity);
      setRemoteUsers(prev => {
        if (prev.some(p => p.identity === participant.identity)) return prev;
        return [...prev, participant];
      });
    };

    // Handle participant disconnected
    const handleParticipantDisconnected = (participant: RemoteParticipant) => {
      console.log('[BattleView] Participant disconnected:', participant.identity);
      setRemoteUsers(prev => prev.filter(p => p.identity !== participant.identity));
    };

    // FIX #2: React to Track Updates Properly - handle all track events
    
    const forceUpdate = () => {
      setRemoteUsers(prev => [...prev]);
    };

    // Handle track subscribed - use RoomEvent.TrackSubscribed to get actual track with SID
    // Note: The callback receives (track, publication, participant) - track is the actual LiveKit track
    const handleTrackSubscribed = (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      console.log('[BattleView] Track subscribed:', {
        trackKind: track.kind,
        trackSid: track.sid,
        trackConstructor: track.constructor.name,
        publicationSid: publication.sid,
        participantIdentity: participant.identity,
      });
      forceUpdate();
    };

    // Handle track unsubscribed
    const handleTrackUnsubscribed = (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      console.log('[BattleView] Track unsubscribed:', {
        trackKind: track.kind,
        trackSid: track.sid,
        publicationSid: publication.sid,
        participantIdentity: participant.identity,
      });
      forceUpdate();
    };

    // Handle track published (local participant published a track)
    const handleTrackPublished = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      console.log('[BattleView] Track published:', {
        trackKind: publication.kind,
        trackSid: publication.sid,
        trackSource: publication.source,
        participantIdentity: participant.identity,
      });
      forceUpdate();
    };

    // Handle track unpublished
    const handleTrackUnpublished = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      console.log('[BattleView] Track unpublished:', {
        trackKind: publication.kind,
        trackSid: publication.sid,
        trackSource: publication.source,
        participantIdentity: participant.identity,
      });
      forceUpdate();
    };

    client.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    client.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    client.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    client.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    client.on(RoomEvent.TrackPublished, handleTrackPublished);
    client.on(RoomEvent.TrackUnpublished, handleTrackUnpublished);

    joinBattle();

    return () => {
      mounted = false;
      client.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      client.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      client.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      client.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      client.off(RoomEvent.TrackPublished, handleTrackPublished);
      client.off(RoomEvent.TrackUnpublished, handleTrackUnpublished);
      if (createdAudioTrack) createdAudioTrack.stop();
      if (createdVideoTrack) createdVideoTrack.stop();
      client.disconnect();
      // Do NOT call PreflightStore.clear() - tracks belong to the main broadcast
      // clearTracks();
    };
  }, [battle, effectiveUserId, isBroadcaster, passedLocalTracks]);

  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);
  const [giftStreamId, setGiftStreamId] = useState<string | null>(null);

  const handleGiftSelect = useCallback((uid: string, sourceStreamId: string) => {
    setGiftRecipientId(uid);
    setGiftStreamId(sourceStreamId);
  }, []);

  const myStream = useMemo(() => {
    if (!participantInfo?.team) return null;
    if (participantInfo.team === 'challenger') return challengerStream;
    if (participantInfo.team === 'opponent') return opponentStream;
    return null;
  }, [participantInfo?.team, challengerStream, opponentStream]);

  const updateMyStreamBoxCount = async (newCount: number) => {
    if (!myStream || participantInfo?.role !== 'host') return;

    if (newCount < 1) {
      toast.warning('Cannot have less than 1 box.');
      return;
    }
    if (newCount > 6) {
      toast.warning('Maximum 6 boxes allowed.');
      return;
    }

    const prevStream = myStream;
    if (participantInfo.team === 'challenger') {
      setChallengerStream({ ...myStream, box_count: newCount });
    } else if (participantInfo.team === 'opponent') {
      setOpponentStream({ ...myStream, box_count: newCount });
    }

    try {
      const broadcastChannel = supabase.channel(`stream:${myStream.id}`);
      
      await new Promise<void>((resolve, reject) => {
        broadcastChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            reject(new Error('Channel subscription failed'));
          }
        });
      });
      
      await broadcastChannel.send({
        type: 'broadcast',
        event: 'box_count_changed',
        payload: { box_count: newCount, stream_id: myStream.id }
      });
      
      setTimeout(() => {
        supabase.removeChannel(broadcastChannel);
      }, 3000);
    } catch (broadcastErr) {
      console.warn('[BoxCount] Broadcast error (non-fatal):', broadcastErr);
    }

    const { error } = await supabase.rpc('set_stream_box_count', {
      p_stream_id: myStream.id,
      p_new_box_count: newCount
    });

    if (error) {
      toast.error('Failed to update box count.');
      if (participantInfo.team === 'challenger') {
        setChallengerStream(prevStream);
      } else if (participantInfo.team === 'opponent') {
        setOpponentStream(prevStream);
      }
    }
  };

  // Initialize battle
  useEffect(() => {
    const initBattle = async () => {
      try {
        // Set battle mode flag to hide TrollEngine during battles
        PreflightStore.setInBattle(true);
        console.log('[BattleView] Set isInBattle = true');
        
        const { data: battleData, error: battleError } = await supabase.from('battles').select('*').eq('id', battleId).maybeSingle();
        if (battleError || !battleData) {
          setError('Battle not found');
          return;
        }
        setBattle(battleData);

        if (battleData.status === 'ended') {
          setShowResults(true);
        }

        const { data: streams, error: streamsError } = await supabase
          .from('streams')
          .select('*')
          .in('id', [battleData.challenger_stream_id, battleData.opponent_stream_id]);
            
        if (streamsError || !streams) {
          setError('Failed to load battle streams: ' + (streamsError?.message || 'Unknown error'));
          return;
        }

        const cStream = streams.find(s => s.id === battleData.challenger_stream_id);
        const oStream = streams.find(s => s.id === battleData.opponent_stream_id);
            
        if (!cStream) {
          setError('Challenger stream not found or not live.');
          return;
        }
        if (!oStream) {
          setError('Opponent stream not found or not live.');
          return;
        }
              
        setChallengerStream(cStream);
        setOpponentStream(oStream);

        if (effectiveUserId) {
          const { data: pData, error: pError } = await supabase
            .from('battle_participants')
            .select('*')
            .eq('battle_id', battleId)
            .eq('user_id', effectiveUserId)
            .maybeSingle();
          if (pError) {
            console.error("Error fetching participant data", pError);
          }
          setParticipantInfo(pData || { role: 'viewer', team: null });
        }

        const { data: participantData } = await supabase
          .from('battle_participants')
          .select('user_id, role')
          .eq('battle_id', battleId);
        setParticipantSnapshots((participantData as Array<{ user_id: string; role: 'host' | 'stage' | 'viewer' }>) || []);
      } catch (e) {
        console.error("[BattleView] Initialization error:", e);
        setError('Failed to initialize battle');
      } finally {
        setLoading(false);
      }
    };
    initBattle();

    const channel = supabase.channel(`battle:${battleId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'battles',
        filter: `id=eq.${battleId}`
      }, (payload) => {
        const newBattle = payload.new;
        setBattle(newBattle);
        if (newBattle.status === 'ended') {
          setShowResults(true);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      // Clear battle mode flag when leaving battle
      PreflightStore.setInBattle(false);
      console.log('[BattleView] Set isInBattle = false (cleanup)');
    };
  }, [battleId, effectiveUserId]);

  // Participants channel
  useEffect(() => {
    if (!battleId) return;
    const participantsChannel = supabase
      .channel(`battle_participants:${battleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'battle_participants', filter: `battle_id=eq.${battleId}` },
        async () => {
          const { data } = await supabase
            .from('battle_participants')
            .select('user_id, role')
            .eq('battle_id', battleId);
          setParticipantSnapshots((data as Array<{ user_id: string; role: 'host' | 'stage' | 'viewer' }>) || []);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(participantsChannel);
    };
  }, [battleId]);

  // Arena ready channel
  useEffect(() => {
    if (!battleId) return;

    const arenaChannel = supabase.channel(`battle_arena:${battleId}`);
    arenaChannel
      .on('broadcast', { event: 'arena_ready' }, (payload) => {
        const readyAtMs = Number(payload?.payload?.ready_at_ms || 0);
        if (!readyAtMs || arenaReadyAtMs) return;
        setArenaReadyAtMs(readyAtMs);
        setArenaReady(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(arenaChannel);
    };
  }, [battleId, arenaReadyAtMs]);

  // Arena readiness check
  useEffect(() => {
    if (!battle || battle.status !== 'active' || arenaReady) return;

    const expectedHosts = participantSnapshots.filter((p) => p.role === 'host').map((p) => p.user_id);
    const expectedStages = participantSnapshots.filter((p) => p.role === 'stage').map((p) => p.user_id);

    const loaded = new Set<string>();
    if (effectiveUserId && (localVideoTrack || localAudioTrack)) {
      loaded.add(String(effectiveUserId));
    }

    for (const remoteUser of remoteUsers) {
      // LiveKit RemoteParticipant.videoTracks is a Map, not an array
      const videoTracks = Array.from(remoteUser.videoTracks.values());
      const audioTracks = Array.from(remoteUser.audioTracks.values());
      const hasMedia = Boolean(videoTracks.length || audioTracks.length);
      if (!hasMedia) continue;
      loaded.add(remoteUser.identity);
    }

    const hostsReady = expectedHosts.length >= 2 && expectedHosts.every((id) => loaded.has(String(id)));
    const stagesReady = expectedStages.every((id) => loaded.has(String(id)));

    if (hostsReady && stagesReady) {
      const nowMs = Date.now();
      setArenaReadyAtMs(nowMs);
      setArenaReady(true);

      if (participantInfo?.role === 'host' && !publishedArenaReadyRef.current) {
        publishedArenaReadyRef.current = true;
        const publishChannel = supabase.channel(`battle_arena:${battleId}`);
        publishChannel.subscribe(async (status) => {
          if (status !== 'SUBSCRIBED') return;
          await publishChannel.send({
            type: 'broadcast',
            event: 'arena_ready',
            payload: { ready_at_ms: nowMs },
          });
          setTimeout(() => {
            supabase.removeChannel(publishChannel);
          }, 500);
        });
      }
    }
  }, [
    battle, arenaReady, participantSnapshots, remoteUsers, localVideoTrack, localAudioTrack,
    effectiveUserId, participantInfo?.role, battleId,
  ]);

  // Fallback arena ready
  useEffect(() => {
    if (!battle || battle.status !== 'active' || arenaReady) return;
    const timeout = setTimeout(() => {
      if (arenaReady) return;
      setArenaReadyAtMs(Date.now());
      setArenaReady(true);
    }, 4500);
    return () => clearTimeout(timeout);
  }, [battle, arenaReady]);

  // Stream updates
  useEffect(() => {
    if (!challengerStream?.id && !opponentStream?.id) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    if (challengerStream?.id) {
      const c = supabase.channel(`battle_stream_${challengerStream.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams', filter: `id=eq.${challengerStream.id}` },
          (payload) => {
            setChallengerStream((prev) => prev ? { ...prev, ...(payload.new as Stream) } : (payload.new as Stream));
          }
        )
        .on('broadcast', { event: 'box_count_changed' }, (payload) => {
          const boxData = payload.payload;
          if (boxData && boxData.box_count !== undefined) {
            setChallengerStream((prev) => prev ? { ...prev, box_count: boxData.box_count } : prev);
          }
        })
        .subscribe();
      channels.push(c);
    }

    if (opponentStream?.id) {
      const c = supabase.channel(`battle_stream_${opponentStream.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams', filter: `id=eq.${opponentStream.id}` },
          (payload) => {
            setOpponentStream((prev) => prev ? { ...prev, ...(payload.new as Stream) } : (payload.new as Stream));
          }
        )
        .on('broadcast', { event: 'box_count_changed' }, (payload) => {
          const boxData = payload.payload;
          if (boxData && boxData.box_count !== undefined) {
            setOpponentStream((prev) => prev ? { ...prev, box_count: boxData.box_count } : prev);
          }
        })
        .subscribe();
      channels.push(c);
    }

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [challengerStream?.id, opponentStream?.id]);

  // Timer Logic - 3 minutes with 10 second sudden death
  const [timeLeft, setTimeLeft] = useState<number>(180);
  const [isSuddenDeath, setIsSuddenDeath] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [showRematchOption, setShowRematchOption] = useState(false);

  const awardCrownToWinner = useCallback(async (winnerStreamId: string) => {
    try {
      // Award crown to winner using the existing function
      const { data, error } = await supabase.rpc('end_battle_with_rewards', {
        p_battle_id: battle.id,
        p_winner_stream_id: winnerStreamId
      });
      
      if (error) {
        console.error('Failed to award crown:', error);
        return;
      }
      
      if (data?.success && data?.crowns_awarded > 0) {
        toast.success(`Winner awarded ${data.crowns_awarded} crown(s)!`);
      }
    } catch (e) {
      console.error('Crown award error:', e);
    }
  }, [battle?.id]);

  const handleRematch = useCallback(async () => {
    if (!battle || !user) return;
    
    try {
      // Reset the battle timer by updating started_at
      const { error: updateError } = await supabase
        .from('battles')
        .update({ 
          started_at: new Date().toISOString(),
          status: 'active'
        })
        .eq('id', battle.id);
      
      if (updateError) throw updateError;
      
      setTimeLeft(180);
      setIsSuddenDeath(false);
      setHasEnded(false);
      setShowRematchOption(false);
      setArenaReady(true);
      setArenaReadyAtMs(Date.now());
      
      toast.success('Rematch started! Fight!');
    } catch (e) {
      console.error('Rematch error:', e);
      toast.error('Failed to start rematch');
    }
  }, [battle, user]);

  const endBattle = useCallback(async (skipConfirmation = false) => {
    if (!battle || !user) return;
    
    if (!skipConfirmation && !confirm("Are you sure you want to end this battle?")) {
      return;
    }

    try {
      let winner_id = null;
      if (battle.score_challenger > battle.score_opponent) {
        winner_id = challengerStream?.user_id;
      } else if (battle.score_opponent > battle.score_challenger) {
        winner_id = opponentStream?.user_id;
      }

      const { data: endResult, error: endError } = await supabase.rpc('end_battle_guarded', {
        p_battle_id: battle.id,
        p_winner_id: winner_id
      });

      if (endError || !endResult?.success) {
        if (endResult?.message === 'Battle timer not elapsed') {
          setHasEnded(false);
          setTimeout(() => {
            if (participantInfo?.role === 'host') {
              setHasEnded(true);
              endBattle(true);
            }
          }, 2000);
        }
        return;
      }

      const { error: payoutError } = await supabase.rpc('distribute_battle_winnings', { p_battle_id: battle.id });
      if (payoutError) toast.error("Battle ended but payout failed.");
      else toast.success(`Battle Ended! Winnings distributed.`);
    } catch (e) {
      console.error(e);
    }
  }, [battle, user, challengerStream, opponentStream, participantInfo?.role]);

  const [leaveLoading, setLeaveLoading] = useState(false);

  const handleLeaveBattle = useCallback(async () => {
    if (!battle || !user) return;

    if (!confirm('Leave this battle and forfeit?')) {
      return;
    }

    setLeaveLoading(true);
    try {
      setBattle((prev: any) => prev ? { ...prev, status: 'ended' } : prev);
      setShowResults(true);

      const { data: leaveResult, error: leaveError } = await supabase.rpc('leave_battle', {
        p_battle_id: battle.id,
        p_user_id: user.id
      });

      if (leaveError || leaveResult?.success === false) {
        toast.error(leaveResult?.message || leaveError?.message || 'Failed to leave battle');
      } else {
        // CRITICAL: Update streams to clear battle state - this prevents redirect loop
        try {
          // Clear challenger stream's battle state
          if (challengerStream?.id) {
            await supabase.from('streams').update({
              is_battle: false,
              battle_id: null
            }).eq('id', challengerStream.id);
          }
          // Clear opponent stream's battle state
          if (opponentStream?.id) {
            await supabase.from('streams').update({
              is_battle: false,
              battle_id: null
            }).eq('id', opponentStream.id);
          }
          console.log('[BattleView] Cleared battle state from streams');
        } catch (streamUpdateErr) {
          console.warn('[BattleView] Failed to update stream battle state:', streamUpdateErr);
        }
        
        // Award crowns to the winner (the other broadcaster)
        const winnerStreamId = leaveResult?.winner_stream_id;
        if (winnerStreamId) {
          try {
            const { data: rewardResult } = await supabase.rpc('end_battle_with_rewards', {
              p_battle_id: battle.id,
              p_winner_stream_id: winnerStreamId
            });
            
            if (rewardResult?.success && rewardResult?.crowns_awarded > 0) {
              toast.success(`Winner awarded ${rewardResult.crowns_awarded} crown(s)!`);
            }
          } catch (rewardErr) {
            console.warn('Crown award failed:', rewardErr);
          }
        }
        
        // Distribute winnings
        try {
          await supabase.rpc('distribute_battle_winnings', { p_battle_id: battle.id });
        } catch (payoutErr) {
          console.warn('Payout failed:', payoutErr);
        }
        
        // Update battle state with winner
        setBattle((prev: any) => {
          if (!prev) return prev;
          return { 
            ...prev, 
            status: 'ended', 
            winner_id: winnerStreamId,
            winner_stream_id: winnerStreamId
          };
        });
        
        // Show appropriate message based on who forfeited
        const isChallenger = participantInfo?.team === 'challenger';
        toast.success(isChallenger ? 'You forfeited. Opponent wins!' : 'You forfeited. Challenger wins!');
      }
      
      // FIX: Forfeiting broadcaster should return to their own stream, not the winner's stream
      // Navigate back to the forfeiting broadcaster's own stream so they can continue their broadcast
      // Use /stream/{streamId} route (not /live which redirects to /live)
      if (participantInfo?.team === 'challenger' && challengerStream?.id) {
        navigate(`/stream/${challengerStream.id}`);
      } else if (participantInfo?.team === 'opponent' && opponentStream?.id) {
        navigate(`/stream/${opponentStream.id}`);
      } else if (currentStreamId) {
        // Fallback to original stream
        navigate(`/stream/${currentStreamId}`);
      } else if (onReturnToStream) {
        // Fallback to callback if provided
        onReturnToStream();
      } else {
        // Last resort - navigate to home
        navigate('/');
      }
      
      // Do NOT stop local tracks - they belong to the broadcaster's main stream
      // The tracks should continue working when they return to their stream
      // The LiveKit room will handle cleanup when the user leaves the battle room
      // Note: We intentionally don't stop/close tracks or disconnect the room here
      // because the user is returning to their broadcast stream where these tracks are needed
      
      // Just navigate back to the stream without stopping tracks
    } catch (e) {
      console.error(e);
      toast.error('Failed to leave battle');
      if (onReturnToStream) {
        onReturnToStream();
      } else {
        navigate('/');
      }
    } finally {
      setLeaveLoading(false);
    }
  }, [battle, user, localAudioTrack, localVideoTrack, livekitRoom, onReturnToStream, navigate, participantInfo?.team, challengerStream?.id, opponentStream?.id]);

  // Timer effect - 3 minutes + 10 seconds sudden death
  useEffect(() => {
    if (!battle?.started_at || battle.status !== 'active' || !arenaReady) {
      if (battle?.status === 'ended') setHasEnded(true);
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const start = new Date(arenaReadyAtMs || battle.started_at);
      const elapsed = (now.getTime() - start.getTime()) / 1000;
      
      const BATTLE_DURATION = 180; // 3 minutes
      const SUDDEN_DEATH = 10; // 10 seconds
      
      if (elapsed < BATTLE_DURATION) {
        setTimeLeft(Math.ceil(BATTLE_DURATION - elapsed));
        setIsSuddenDeath(false);
      } else if (elapsed < BATTLE_DURATION + SUDDEN_DEATH) {
        setTimeLeft(Math.ceil((BATTLE_DURATION + SUDDEN_DEATH) - elapsed));
        setIsSuddenDeath(true);
      } else {
        setTimeLeft(0);
        setIsSuddenDeath(true);
        if (!hasEnded) {
          setHasEnded(true);
          // Award crown to winner
          if (battle.score_challenger > battle.score_opponent && challengerStream?.user_id) {
            awardCrownToWinner(challengerStream.user_id);
          } else if (battle.score_opponent > battle.score_challenger && opponentStream?.user_id) {
            awardCrownToWinner(opponentStream.user_id);
          }
          // Show rematch option for hosts
          if (participantInfo?.role === 'host') {
            setShowRematchOption(true);
          }
          endBattle(true);
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [battle?.started_at, battle?.status, battle?.score_challenger, battle?.score_opponent, participantInfo?.role, hasEnded, endBattle, awardCrownToWinner, arenaReady, arenaReadyAtMs, challengerStream?.user_id, opponentStream?.user_id]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Handle troll opponent
  const handleTrollOpponent = async (targetStreamId: string) => {
    if (!battle || !user) return;

    try {
      const { data, error } = await supabase.rpc('troll_opponent', {
        p_battle_id: battle.id,
        p_troller_id: user.id,
        p_target_stream_id: targetStreamId
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data?.success) {
        toast.success(`Trolled opponent! Deducted ${data.deduction} coins`);
      } else {
        toast.error(data?.message || 'Troll failed');
      }
    } catch (e) {
      console.error('Troll error:', e);
      toast.error('Failed to troll opponent');
    }
  };

  // Return to stream handler - returns each broadcaster to their own stream
  const handleReturnToStream = useCallback(() => {
    // Cleanup media
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
    }
    if (localVideoTrack) {
      localVideoTrack.stop();
      localVideoTrack.close();
    }
    if (livekitRoom) {
      livekitRoom.disconnect();
    }
    // Do NOT call PreflightStore.clear() or clearTracks() - tracks belong to the main broadcast
    // Navigate back to stream - prioritize the original broadcast stream

    // If user is a broadcaster (host or stage), return to their own stream
    // Use /stream/{streamId} route (not /live which redirects to /live)
    if (participantInfo?.team === 'challenger' && challengerStream?.id) {
      navigate(`/stream/${challengerStream.id}`);
    } else if (participantInfo?.team === 'opponent' && opponentStream?.id) {
      navigate(`/stream/${opponentStream.id}`);
    } else if (currentStreamId) {
      // Fallback to the original stream they were watching
      navigate(`/stream/${currentStreamId}`);
    } else if (onReturnToStream) {
      // Fallback to callback if provided
      onReturnToStream();
    } else {
      // Last resort - navigate to home but keep them in app
      navigate('/');
    }
  }, [localAudioTrack, localVideoTrack, livekitRoom, onReturnToStream, navigate, participantInfo?.team, challengerStream?.id, opponentStream?.id, currentStreamId]);

  // Auto-return after battle ends - only for viewers, not for broadcasters who should stay
  // Don't auto-return when someone forfeited - show winner first and let them click return
  useEffect(() => {
    if (showResults && battle?.status === 'ended') {
      // Check if user is a broadcaster (host or stage) - they should NOT auto-return
      const isBroadcasterUser = participantInfo?.role === 'host' || participantInfo?.role === 'stage';
      
      // Don't auto-return for broadcasters - they need to manually return to stay in their broadcast
      if (isBroadcasterUser) {
        return;
      }
      
      // For viewers, auto-return after delay but only to the original stream
      // Use /stream/{streamId} route (not /live which redirects to /live)
      const timer = setTimeout(() => {
        // Return to original stream if available
        if (currentStreamId) {
          navigate(`/stream/${currentStreamId}`);
        } else if (onReturnToStream) {
          onReturnToStream();
        } else {
          navigate('/');
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showResults, battle?.status, navigate, currentStreamId, onReturnToStream, participantInfo?.role]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-red-500 gap-4">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-white">Battle Error</h2>
        <span className="font-medium">{error}</span>
        <button 
          onClick={() => navigate('/')}
          className="mt-4 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg transition"
        >
          Return Home
        </button>
      </div>
    );
  }

  if (loading || !battle || !challengerStream || !opponentStream) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-amber-500 gap-4">
        <Loader2 className="animate-spin" size={48} />
        <span className="font-medium animate-pulse">Joining Battle Arena...</span>
      </div>
    );
  }

  const totalScore = (battle?.score_challenger || 0) + (battle?.score_opponent || 0);
  const challengerPercent = totalScore === 0 ? 50 : Math.round((battle?.score_challenger / totalScore) * 100);
  const opponentPercent = 100 - challengerPercent;

  // Use the userIdToLiveKitIdentity mapping from BroadcastPage to find video tracks
  // The mapping converts database user IDs to LiveKit identities
  const challengerLiveKitIdentity = userIdToLiveKitIdentity?.[challengerStream.user_id];
  const opponentLiveKitIdentity = userIdToLiveKitIdentity?.[opponentStream.user_id];
  
  console.log('[BattleView] User lookup - challenger stream:', challengerStream.user_id?.substring(0, 8), '-> livekit identity:', challengerLiveKitIdentity);
  console.log('[BattleView] User lookup - opponent stream:', opponentStream.user_id?.substring(0, 8), '-> livekit identity:', opponentLiveKitIdentity);
  console.log('[BattleView] Passed remoteUsers count:', passedRemoteUsers?.length || 0);
  console.log('[BattleView] Local videoTrack:', !!localVideoTrack);

  // Handle challenger video - use mapping to find remote user
  const challengerUser = passedRemoteUsers?.find(u => u.identity === challengerLiveKitIdentity) ||
    (effectiveUserId === challengerStream.user_id
      ? { videoTrack: localVideoTrack }
      : null);

  // Handle opponent video - use mapping to find remote user
  const opponentUser = passedRemoteUsers?.find(u => u.identity === opponentLiveKitIdentity) ||
    (effectiveUserId === opponentStream.user_id
      ? { videoTrack: localVideoTrack }
      : null);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 overflow-hidden z-50">
      {/* Troll Battle Royale Background Effects */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl" />
      </div>

      {/* Header - Troll Battle Royale with Balance */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <span className="text-white font-black text-lg">T</span>
          </div>
          <h1 className="text-xl font-black text-white tracking-wide">Troll Battle Royale</h1>
        </div>
        
        {/* Crown & Coin Balance Display */}
        {effectiveUserId && (
          <div className="flex items-center gap-3 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <div className="flex items-center gap-1.5">
              <Crown size={14} className="text-amber-400" />
              <span className="text-sm font-bold text-white">
                {(userCrowns ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="w-px h-4 bg-white/20" />
            <div className="flex items-center gap-1.5">
              <Gem size={14} className="text-purple-400" />
              <span className="text-sm font-bold text-white">
                {(userTrollmonds ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="w-px h-4 bg-white/20" />
            <div className="flex items-center gap-1.5">
              <Coins size={14} className="text-yellow-400" />
              <span className="text-sm font-bold text-white">
                {(userCoins ?? 0).toLocaleString()}
              </span>
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-full">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-green-400 text-sm font-bold">LIVE</span>
        </div>
      </div>

      {/* Back Button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-20 left-6 z-50 flex items-center gap-2 px-4 py-2 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-full border border-white/10 transition-all hover:scale-105"
      >
        <ArrowLeft size={18} />
        <span className="text-sm font-medium">Home</span>
      </button>

      {/* Main Content Container */}
      <div className="relative z-10 flex flex-col h-full pt-20">
        {/* Battle Arena - Shows all participants with scores */}
        <div className="flex-1 flex items-center justify-center px-2 md:px-4 pb-36">

        {/* Battle Arena */}
        <MemoBattleArena
          onGift={handleGiftSelect}
          battleId={battleId}
          localAudioTrack={localAudioTrack}
          localVideoTrack={localVideoTrack}
          localIsCameraEnabled={isCameraEnabled}
          localIsMicEnabled={isMicEnabled}
          remoteUsers={remoteUsers}
          challengerStreamId={challengerStream.id}
          opponentStreamId={opponentStream.id}
          challengerHostId={challengerStream.user_id}
          opponentHostId={opponentStream.user_id}
          challengerBoxCount={challengerStream.box_count || 1}
          opponentBoxCount={opponentStream.box_count || 1}
          challengerCrownInfo={challengerCrownInfo}
          opponentCrownInfo={opponentCrownInfo}
          isSuddenDeath={isSuddenDeath}
          onTrollOpponent={handleTrollOpponent}
          canTroll={isSuddenDeath && participantInfo?.role === 'host'}
          currentUserTeam={participantInfo?.team}
          userIdToLiveKitIdentity={userIdToLiveKitIdentity}
        />
        </div>

        {/* Central Floating Timer */}
        <div className="absolute top-24 md:top-28 left-1/2 -translate-x-1/2 pointer-events-none z-40">
          <motion.div 
            animate={isSuddenDeath ? {
              scale: [1, 1.1, 1],
            } : {}}
            transition={{ duration: 0.5, repeat: isSuddenDeath ? Infinity : 0 }}
            className={cn(
              "flex flex-col items-center justify-center px-4 py-2 md:px-6 md:py-3 rounded-2xl backdrop-blur-md border shadow-2xl",
              isSuddenDeath 
                ? "bg-red-950/60 border-red-500/60 shadow-red-500/30" 
                : "bg-black/50 border-white/20"
            )}
          >
            <span className={cn(
              "text-xs md:text-sm font-black uppercase tracking-wider mb-0.5",
              isSuddenDeath ? "text-red-400" : "text-amber-500"
            )}>
              {isSuddenDeath ? "⚡ SUDDEN DEATH ⚡" : "BATTLE TIME"}
            </span>
            <div className={cn(
              "font-mono text-2xl md:text-4xl font-black",
              isSuddenDeath ? "text-red-500" : "text-white"
            )}>
              {battle?.status === 'ended' ? "FINISHED" : arenaReady ? formatTime(timeLeft) : "SYNCING"}
            </div>
            {isSuddenDeath && (
              <span className="text-[10px] text-red-400/80 mt-0.5">Troll buttons active!</span>
            )}
            {/* Rematch Button - shows when battle ended and user is host */}
            {showRematchOption && participantInfo?.role === 'host' && (
              <button
                onClick={handleRematch}
                className="mt-2 px-4 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold text-sm rounded-full shadow-lg transition-all hover:scale-105"
              >
                🔄 REMATCH
              </button>
            )}
          </motion.div>
        </div>

        {/* Progress Bar */}
        <div className="absolute top-20 md:top-24 left-0 w-full h-1 flex z-30">
          <div 
            className="h-full bg-gradient-to-r from-purple-600 to-blue-500 transition-all duration-500" 
            style={{ width: `${challengerPercent}%` }}
          />
          <div 
            className="h-full bg-gradient-to-l from-emerald-500 to-teal-500 transition-all duration-500" 
            style={{ width: `${opponentPercent}%` }}
          />
        </div>

        <MuteHandler streamId={challengerStream.id} />
        
        {/* Unified Battle Chat - Both sides see all messages */}
        <div className="absolute bottom-0 left-0 w-full h-[200px] md:h-[250px] pointer-events-none flex gap-2 md:gap-4 px-2 md:px-4">
          <div className="flex-1 pointer-events-auto">
            <BattleChat
              battleId={battleId}
              challengerStream={challengerStream}
              opponentStream={opponentStream}
              currentUserId={effectiveUserId}
              participantRole={participantInfo?.role}
            />
          </div>
          <div className="flex-1 pointer-events-none">
            <div className="absolute inset-0 pointer-events-none z-30">
              <GiftAnimationOverlay streamId={challengerStream.id} />
              <GiftAnimationOverlay streamId={opponentStream.id} />
            </div>
          </div>
        </div>

        {/* Host Controls */}
        {participantInfo?.role === 'host' && (
          <div className="absolute top-20 right-2 md:right-4 z-40 flex flex-col gap-2">
            {myStream && (
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/20 rounded-full px-3 py-1.5">
                <span className="text-xs text-white/70">Boxes</span>
                <button
                  onClick={() => updateMyStreamBoxCount((myStream.box_count || 1) - 1)}
                  className="p-1 rounded-full hover:bg-white/20 text-white/80 transition"
                  aria-label="Decrease boxes"
                >
                  <Minus size={14} />
                </button>
                <span className="text-sm font-bold text-white min-w-[20px] text-center">
                  {myStream.box_count || 1}
                </span>
                <button
                  onClick={() => updateMyStreamBoxCount((myStream.box_count || 1) + 1)}
                  className="p-1 rounded-full hover:bg-white/20 text-white/80 transition"
                  aria-label="Increase boxes"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}

            <button
              onClick={handleLeaveBattle}
              disabled={leaveLoading}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-600/80 hover:bg-red-500 text-white border border-red-500/40 transition disabled:opacity-60 shadow-lg"
            >
              {leaveLoading ? 'Leaving...' : 'Forfeit'}
            </button>
          </div>
        )}

        {/* Battle End Overlay */}
        <AnimatePresence>
          {showResults && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-gradient-to-b from-zinc-900 to-black border-2 border-amber-500/50 p-6 md:p-8 rounded-3xl text-center max-w-md shadow-[0_0_60px_rgba(245,158,11,0.3)]"
              >
                <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-500 mb-2 uppercase tracking-tighter italic">
                  Battle Ended
                </h2>
                <div className="h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent w-full my-4" />
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center text-zinc-300 font-mono px-4">
                    <span className="flex items-center gap-2">
                      {challengerCrownInfo.hasStreak && <Crown size={14} className="text-yellow-400 fill-yellow-400" />}
                      {challengerStream.title}
                    </span>
                    <span className="text-purple-400 font-bold text-lg">{battle.score_challenger.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-300 font-mono px-4">
                    <span className="flex items-center gap-2">
                      {opponentCrownInfo.hasStreak && <Crown size={14} className="text-yellow-400 fill-yellow-400" />}
                      {opponentStream.title}
                    </span>
                    <span className="text-emerald-400 font-bold text-lg">{battle.score_opponent.toLocaleString()}</span>
                  </div>
                </div>

                {battle.status === 'ended' ? (
                  <div className="mb-6">
                    <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Winner</div>
                    {/* Check both winner_id and winner_stream_id for winner determination */}
                    {battle.winner_id === challengerStream.user_id || battle.winner_stream_id === challengerStream.id ? (
                      <div className="flex flex-col items-center gap-2">
                        {participantInfo?.team === 'challenger' ? (
                          <>
                            <div className="flex items-center justify-center gap-2 text-3xl font-black text-green-400">
                              <Crown size={32} className="text-yellow-400 fill-yellow-400" />
                              YOU WON!
                            </div>
                            <div className="flex items-center justify-center gap-1 text-amber-400 font-bold">
                              <Coins size={20} className="text-yellow-400" />
                              +{Math.round((battle.score_challenger || 0) * 0.1)} coins
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-center gap-2 text-2xl font-bold text-white">
                            <Crown size={24} className="text-yellow-400 fill-yellow-400" />
                            {challengerStream.title}
                          </div>
                        )}
                      </div>
                    ) : battle.winner_id === opponentStream.user_id || battle.winner_stream_id === opponentStream.id ? (
                      <div className="flex flex-col items-center gap-2">
                        {participantInfo?.team === 'opponent' ? (
                          <>
                            <div className="flex items-center justify-center gap-2 text-3xl font-black text-green-400">
                              <Crown size={32} className="text-yellow-400 fill-yellow-400" />
                              YOU WON!
                            </div>
                            <div className="flex items-center justify-center gap-1 text-amber-400 font-bold">
                              <Coins size={20} className="text-yellow-400" />
                              +{Math.round((battle.score_opponent || 0) * 0.1)} coins
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-center gap-2 text-2xl font-bold text-white">
                            <Crown size={24} className="text-yellow-400 fill-yellow-400" />
                            {opponentStream.title}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-2xl font-bold text-zinc-400">
                        It's a Draw!
                      </div>
                    )}
                    {(battle.winner_id === challengerStream.user_id && challengerCrownInfo.hasStreak) ||
                     (battle.winner_id === opponentStream.user_id && opponentCrownInfo.hasStreak) ? (
                      <div className="mt-2 text-amber-400 font-bold flex items-center justify-center gap-1">
                        <Flame size={16} className="fill-amber-400" />
                        WIN STREAK CONTINUES!
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mb-6 text-xl font-bold text-zinc-400 italic animate-pulse">Calculating Results...</div>
                )}

                <div className="text-sm text-zinc-500">
                  Returning to stream in a few seconds...
                </div>

                <button
                  onClick={handleReturnToStream}
                  className="mt-4 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-full transition"
                >
                  Return Now
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gift Tray */}
        {giftRecipientId && (
          <GiftTray 
            onClose={() => {
              setGiftRecipientId(null);
              setGiftStreamId(null);
            }}
            recipientId={giftRecipientId}
            streamId={giftStreamId || currentStreamId}
          />
        )}
      </div>
    </div>
  );
}
