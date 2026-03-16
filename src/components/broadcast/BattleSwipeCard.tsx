/**
 * BattleSwipeCard - Full-screen battle stream card for TikTok-style swipe interface
 * Displays battle streams with duel visuals, scores, and competitor info
 * Migrated from Agora to LiveKit
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { Stream } from '../../types/broadcast';
import { toast } from 'sonner';
import { Eye, Heart, MessageCircle, Gift, Share2, Users, Sword, Shield, Trophy } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Room, RoomEvent, RemoteParticipant, RemoteVideoTrack, RemoteAudioTrack } from 'livekit-client';

interface BattleSwipeCardProps {
  stream: Stream & {
    broadcaster?: {
      username: string;
      avatar_url: string | null;
      level?: number;
    };
  };
  isActive: boolean;
  isMuted: boolean;
  onClose: () => void;
}

interface BattleData {
  id: string;
  challenger_id: string;
  opponent_id: string;
  challenger_score: number;
  opponent_score: number;
  status: string;
  challenger_stream_id: string;
  opponent_stream_id: string;
  challenger?: {
    username: string;
    avatar_url: string | null;
  };
  opponent?: {
    username: string;
    avatar_url: string | null;
  };
}

export default function BattleSwipeCard({ stream, isActive, isMuted, onClose }: BattleSwipeCardProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  
  const [remoteUsers, setRemoteUsers] = useState<RemoteParticipant[]>([]);
  const [viewerCount, setViewerCount] = useState(stream.current_viewers || stream.viewer_count || 0);
  const [battleData, setBattleData] = useState<BattleData | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  
  const roomRef = useRef<Room | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const hasJoinedRef = useRef(false);
  
  // Fetch battle data
  useEffect(() => {
    const fetchBattleData = async () => {
      if (!stream.battle_id) return;
      
      const { data, error } = await supabase
        .from('battles')
        .select(`
          *,
          challenger:user_profiles!battles_challenger_id_fkey(
            username,
            avatar_url
          ),
          opponent:user_profiles!battles_opponent_id_fkey(
            username,
            avatar_url
          )
        `)
        .eq('id', stream.battle_id)
        .single();
      
      if (data) {
        setBattleData({
          ...data,
          challenger: Array.isArray(data.challenger) ? data.challenger[0] : data.challenger,
          opponent: Array.isArray(data.opponent) ? data.opponent[0] : data.opponent
        });
      }
    };
    
    if (stream.battle_id) {
      fetchBattleData();
    }
  }, [stream.battle_id]);
  
  // Join LiveKit channel when card becomes active
  const joinStream = useCallback(async () => {
    if (!isActive || hasJoinedRef.current || !user) return;
    
    hasJoinedRef.current = true;
    setIsJoining(true);
    
    try {
      const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
      if (!livekitUrl) {
        console.warn('VITE_LIVEKIT_URL not configured');
        setIsJoining(false);
        return;
      }
      
      // Get viewer token from livekit-token function
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('livekit-token', {
        body: {
          room: stream.id,
          userId: user.id,
          role: 'viewer'
        }
      });
      
      if (tokenError || !tokenData?.token) {
        console.error('Token error:', tokenError);
        setIsJoining(false);
        return;
      }
      
      // Create LiveKit room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true
      });
      
      roomRef.current = room;
      
      // Handle participant connected
      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        console.log('[BattleSwipeCard] Participant connected:', participant.identity);
        setRemoteUsers(prev => {
          if (prev.find(p => p.identity === participant.identity)) return prev;
          return [...prev, participant];
        });
      });
      
      // Handle participant disconnected
      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        console.log('[BattleSwipeCard] Participant disconnected:', participant.identity);
        setRemoteUsers(prev => prev.filter(p => p.identity !== participant.identity));
      });
      
      // Handle track subscribed
      room.on(RoomEvent.TrackSubscribed, (track: RemoteVideoTrack | RemoteAudioTrack, participant: RemoteParticipant) => {
        console.log('[BattleSwipeCard] Track subscribed:', track.kind, 'from', participant.identity);
        // Force re-render
        setRemoteUsers(prev => [...prev]);
      });
      
      // Handle track unsubscribed
      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteVideoTrack | RemoteAudioTrack, participant: RemoteParticipant) => {
        console.log('[BattleSwipeCard] Track unsubscribed:', track.kind, 'from', participant.identity);
        setRemoteUsers(prev => [...prev]);
      });
      
      // Connect to room
      await room.connect(livekitUrl, tokenData.token, {
        name: stream.id,
        identity: user.id
      });
      
      // Get existing participants
      const existingParticipants = Array.from(room.participants.values());
      setRemoteUsers(existingParticipants);
      
      console.log('[BattleSwipeCard] Joined stream:', stream.id);
      
    } catch (error) {
      console.error('Error joining stream:', error);
      hasJoinedRef.current = false;
    } finally {
      setIsJoining(false);
    }
  }, [isActive, stream.id, user]);
  
  // Join/leave based on active state
  useEffect(() => {
    if (isActive) {
      joinStream();
    }
    
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
        hasJoinedRef.current = false;
      }
    };
  }, [isActive]);
  
  // Handle like
  const handleLike = async () => {
    if (!user) {
      navigate('/auth?mode=signup');
      return;
    }
    
    try {
      const edgeUrl = `${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/send-like`;
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth?mode=signup');
        return;
      }
      
      const response = await fetch(edgeUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stream_id: stream.id })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.coins_awarded > 0) {
          toast.success(`+${result.coins_awarded} coins!`);
        }
      }
    } catch (error) {
      console.error('Error liking stream:', error);
    }
  };
  
  // Handle tap to view full stream
  const handleTap = () => {
    navigate(`/watch/${stream.id}?from=swipe&battle=true`);
  };
  
  const broadcaster = stream.broadcaster;
  const isHost = user?.id === stream.user_id;
  
  // Calculate scores
  const challengerScore = battleData?.challenger_score || 0;
  const opponentScore = battleData?.opponent_score || 0;
  const totalScore = challengerScore + opponentScore;
  const challengerPercent = totalScore > 0 ? (challengerScore / totalScore) * 100 : 50;
  
  // Get video track from participant
  const getVideoTrack = (participant: RemoteParticipant): RemoteVideoTrack | undefined => {
    const trackPublications = Array.from(participant.videoTrackPublications.values());
    const videoPub = trackPublications.find(p => p.track?.kind === 'video');
    return videoPub?.track as RemoteVideoTrack | undefined;
  };
  
  return (
    <div className="w-full h-full relative bg-black overflow-hidden">
      {/* Video/Stream Container */}
      <div 
        ref={videoContainerRef}
        className="absolute inset-0"
        onClick={handleTap}
      >
        {remoteUsers.length > 0 ? (
          <div className={cn(
            "w-full h-full grid",
            remoteUsers.length === 1 ? "grid-cols-1" :
            remoteUsers.length === 2 ? "grid-cols-2" :
            "grid-cols-2 gap-0.5"
          )}>
            {remoteUsers.map((remoteUser) => {
              const videoTrack = getVideoTrack(remoteUser);
              return (
                <div key={remoteUser.identity} className="relative bg-black">
                  {videoTrack ? (
                    <div 
                      ref={(el) => {
                        if (el && videoTrack) {
                          const attached = videoTrack.attach();
                          el.appendChild(attached);
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                      <Users className="w-12 h-12 text-zinc-600" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Placeholder when no video */
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-red-900 via-purple-900 to-blue-900">
            <div className="flex items-center gap-4 mb-4">
              {/* Challenger avatar */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 p-0.5">
                <div className="w-full h-full rounded-full bg-black overflow-hidden flex items-center justify-center">
                  {battleData?.challenger?.avatar_url ? (
                    <img 
                      src={battleData.challenger.avatar_url} 
                      alt={battleData.challenger.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Sword className="w-8 h-8 text-yellow-500" />
                  )}
                </div>
              </div>
              
              {/* VS indicator */}
              <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center">
                <span className="font-bold text-white text-lg">VS</span>
              </div>
              
              {/* Opponent avatar */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-0.5">
                <div className="w-full h-full rounded-full bg-black overflow-hidden flex items-center justify-center">
                  {battleData?.opponent?.avatar_url ? (
                    <img 
                      src={battleData.opponent.avatar_url} 
                      alt={battleData.opponent.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Shield className="w-8 h-8 text-blue-500" />
                  )}
                </div>
              </div>
            </div>
            
            <p className="text-white/60 text-sm">Battle in progress...</p>
          </div>
        )}
      </div>
      
      {/* Battle score bar */}
      {battleData && (
        <div className="absolute top-24 left-4 right-4 z-10">
          <div className="bg-black/60 backdrop-blur-md rounded-full h-8 overflow-hidden flex">
            {/* Challenger score */}
            <div 
              className="h-full bg-gradient-to-r from-yellow-600 to-orange-500 flex items-center justify-start pl-3"
              style={{ width: `${challengerPercent}%` }}
            >
              <span className="text-white font-bold text-sm">{challengerScore.toLocaleString()}</span>
            </div>
            
            {/* Opponent score */}
            <div 
              className="h-full bg-gradient-to-l from-blue-600 to-purple-500 flex items-center justify-end pr-3"
              style={{ width: `${100 - challengerPercent}%` }}
            >
              <span className="text-white font-bold text-sm">{opponentScore.toLocaleString()}</span>
            </div>
          </div>
          
          {/* Names */}
          <div className="flex justify-between mt-1 px-1">
            <span className="text-yellow-400 text-xs font-medium">{battleData.challenger?.username || 'Challenger'}</span>
            <span className="text-blue-400 text-xs font-medium">{battleData.opponent?.username || 'Opponent'}</span>
          </div>
        </div>
      )}
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/80 via-black/20 to-black/30" />
      
      {/* Battle badge */}
      <div className="absolute top-20 left-4 z-10">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-red-600 to-purple-600 rounded-full">
          <Sword className="w-4 h-4 text-white" />
          <span className="text-white font-bold text-xs uppercase">Battle</span>
        </div>
      </div>
      
      {/* Stream info overlay - Bottom left */}
      <div className="absolute bottom-20 left-4 right-20 z-10">
        {/* Title */}
        <h3 className="text-white font-medium text-lg line-clamp-2 mb-2">
          {stream.title || 'Battle Arena'}
        </h3>
        
        {/* Viewer count */}
        <div className="flex items-center gap-2 text-white/70">
          <Eye className="w-4 h-4" />
          <span className="text-sm">{viewerCount.toLocaleString()} watching</span>
          {battleData && (
            <span className="text-red-400 text-sm ml-2 flex items-center gap-1">
              <Trophy className="w-3 h-3" />
              {totalScore.toLocaleString()} votes
            </span>
          )}
        </div>
      </div>
      
      {/* Action buttons - Bottom right */}
      <div className="absolute bottom-20 right-4 z-10 flex flex-col items-center gap-4">
        {/* Like button */}
        <button
          onClick={(e) => { e.stopPropagation(); handleLike(); }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors">
            <Heart className="w-6 h-6 text-white" />
          </div>
        </button>
        
        {/* Comment button */}
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/watch/${stream.id}?from=swipe`); }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
        </button>
        
        {/* Gift button */}
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/watch/${stream.id}?from=swipe`); }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors">
            <Gift className="w-6 h-6 text-pink-400" />
          </div>
        </button>
        
        {/* Share button */}
        <button
          onClick={(e) => { e.stopPropagation(); }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors">
            <Share2 className="w-6 h-6 text-white" />
          </div>
        </button>
      </div>
      
      {/* Loading indicator */}
      {isJoining && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-white text-sm">Joining battle...</span>
          </div>
        </div>
      )}
    </div>
  );
}
