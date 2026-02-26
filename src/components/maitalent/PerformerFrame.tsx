import React, { useState, useEffect } from 'react';
import VideoTile from '@/components/agora/VideoTile';

export type PerformerState = 'empty' | 'connecting' | 'live' | 'camera_off' | 'mic_muted';

interface PerformerFrameProps {
  performer: any;
  slot: 'A' | 'B';
  localVideoTrack?: any;
  localAudioTrack?: any;
  remoteUser?: any;
  canPublish?: boolean;
  agoraClient?: any;
  isSpeaking?: boolean;
  connectionState?: PerformerState;
}

/**
 * PerformerFrame - Large performer video frame with:
 * - Rounded 16px-20px corners
 * - Gold illuminated border
 * - Inner shadow for depth
 * - LIVE badge top-left (red)
 * - Username + avatar bottom left
 * - Coins bottom right
 * - Subtle animated glow when user is speaking
 * - Camera connection states supported
 */
export const PerformerFrame: React.FC<PerformerFrameProps> = ({
  performer,
  slot,
  localVideoTrack,
  localAudioTrack,
  remoteUser,
  canPublish = false,
  agoraClient,
  isSpeaking = false,
  connectionState = 'empty',
}) => {
  const [coins, setCoins] = useState(performer?.total_votes || 0);

  useEffect(() => {
    if (performer?.id) {
      const subscription = (window as any).supabase
        .channel(`mai_talent_votes:${performer.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mai_talent_votes', filter: `audition_id=eq.${performer.id}` }, (payload: any) => {
          setCoins((prevCoins: number) => prevCoins + payload.new.amount);
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [performer?.id]);

  // Determine connection state
  const getConnectionState = (): PerformerState => {
    if (connectionState !== 'empty') return connectionState;
    if (!performer) return 'empty';
    if (remoteUser?.hasVideo === false) return 'camera_off';
    if (remoteUser?.hasAudio === false) return 'mic_muted';
    return 'live';
  };

  const state = getConnectionState();
  const isLive = state === 'live';
  const isConnecting = state === 'connecting';
  const isEmpty = state === 'empty';

  // Get avatar and username
  const avatarUrl = performer?.user_profiles?.avatar_url || `https://ui-avatars.com/api/?background=random&name=${performer?.user_profiles?.username || 'Performer'}`;
  const username = performer?.user_profiles?.username || `Performer ${slot}`;

  return (
    <div className="relative w-full h-full">
      {/* Main frame container with gold border */}
      <div 
        className={`
          relative rounded-2xl overflow-hidden
          bg-slate-900/80 backdrop-blur-sm
          border-2 border-yellow-500/40
          shadow-[0_0_60px_rgba(255,215,0,0.25)]
          transition-all duration-500
          ${isSpeaking ? 'shadow-[0_0_80px_rgba(255,215,0,0.5)] border-yellow-400/60' : ''}
          ${isEmpty ? 'opacity-60' : 'opacity-100'}
        `}
        style={{
          boxShadow: isSpeaking 
            ? '0 0 60px rgba(255, 215, 0, 0.4), inset 0 0 30px rgba(255, 215, 0, 0.1)' 
            : '0 0 40px rgba(255, 215, 0, 0.2), inset 0 0 20px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Inner shadow for depth */}
        <div className="absolute inset-0 rounded-2xl shadow-[inset_0_0_30px_rgba(0,0,0,0.5)] pointer-events-none z-10" />
        
        {/* Video content */}
        <div className="relative aspect-video">
          {canPublish && localVideoTrack ? (
            <VideoTile
              localVideoTrack={localVideoTrack}
              localAudioTrack={localAudioTrack}
              displayName={username}
              role="performer"
              canPublish={canPublish}
              agoraClient={agoraClient}
            />
          ) : remoteUser || performer ? (
            <VideoTile
              user={remoteUser || performer}
              displayName={username}
              role="performer"
            />
          ) : (
            /* Empty seat state */
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center">
                  <svg className="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="text-slate-500 text-sm">Waiting for performer...</p>
              </div>
            </div>
          )}

          {/* Connecting state overlay */}
          {isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-yellow-500/50 border-t-yellow-500 rounded-full animate-spin" />
                <span className="text-yellow-500 text-sm font-medium">Connecting...</span>
              </div>
            </div>
          )}

          {/* Camera off state overlay */}
          {state === 'camera_off' && isLive && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-20">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-slate-800 flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-slate-500 text-xs">Camera Off</p>
              </div>
            </div>
          )}

          {/* LIVE badge - top left */}
          {isLive && (
            <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="px-2 py-0.5 bg-red-600/90 text-white text-xs font-bold rounded">LIVE</span>
            </div>
          )}

          {/* Slot indicator - top right */}
          <div className="absolute top-3 right-3 z-30">
            <span className="px-2 py-0.5 bg-black/60 text-yellow-400 text-xs font-medium rounded border border-yellow-500/30">
              Slot {slot}
            </span>
          </div>
        </div>

        {/* Bottom info bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent z-20">
          <div className="flex items-end justify-between">
            {/* Username + Avatar - bottom left */}
            <div className="flex items-center gap-3">
              <img 
                src={avatarUrl} 
                alt={username}
                className="w-10 h-10 rounded-full border-2 border-yellow-500/50 object-cover"
              />
              <div>
                <p className="text-white font-bold text-sm">{username}</p>
                <p className="text-yellow-400 text-xs">Performer</p>
              </div>
            </div>

            {/* Coins - bottom right */}
            <div className="flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-full border border-yellow-500/20">
              <span className="text-yellow-400 text-lg">🪙</span>
              <span className="text-yellow-400 font-bold text-sm">{coins.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Speaking indicator ring */}
      {isSpeaking && (
        <div className="absolute -inset-2 rounded-2xl border-2 border-yellow-400/50 animate-pulse pointer-events-none" />
      )}
    </div>
  );
};

export default PerformerFrame;
