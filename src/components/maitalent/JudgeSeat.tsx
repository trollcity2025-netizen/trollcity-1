import React from 'react';
import VideoTile from '@/components/livekit/VideoTile';

interface JudgeSeatProps {
  seatNumber: number;
  user: any;
  isCurrentUser?: boolean;
  localVideoTrack?: any;
  localAudioTrack?: any;
  canPublish?: boolean;
  livekitClient?: any;
  onJoin?: () => void;
  onLeave?: () => void;
}

/**
 * JudgeSeat - Individual judge chair with:
 * - Dark leather style
 * - Name + role on chair back
 * - Vote buttons integrated into chair panel
 * - Perspective depth (slightly angled or shadowed)
 * - Current user seat labeled "You (Judge)"
 */
export const JudgeSeat: React.FC<JudgeSeatProps> = ({
  seatNumber,
  user,
  isCurrentUser = false,
  localVideoTrack,
  localAudioTrack,
  canPublish = false,
  livekitClient,
  onJoin,
  onLeave,
}) => {
  const hasUser = !!user;
  const avatarUrl = user?.user_profiles?.avatar_url || `https://ui-avatars.com/api/?background=random&name=${user?.user_profiles?.username || 'Judge'}`;
  const username = user?.user_profiles?.username || `Judge ${seatNumber}`;

  return (
    <div className="relative group">
      {/* Chair container with perspective depth */}
      <div 
        className={`
          relative rounded-xl overflow-hidden
          bg-gradient-to-b from-slate-800 to-slate-950
          border border-slate-700/50
          shadow-[0_10px_40px_rgba(0,0,0,0.5),0_0_20px_rgba(0,0,0,0.3)]
          transition-all duration-300
          ${hasUser ? 'ring-2 ring-yellow-500/30' : ''}
          hover:ring-2 hover:ring-yellow-500/50
        `}
      >
        {/* Chair back - dark leather style */}
        <div className="absolute -top-1 -left-1 -right-1 h-16 bg-gradient-to-b from-slate-700 to-slate-900 rounded-t-xl border-b border-slate-600/30">
          {/* Chair back name label */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center">
            <p className={`text-xs font-bold ${isCurrentUser ? 'text-yellow-400' : 'text-slate-300'}`}>
              {isCurrentUser ? 'YOU' : username}
            </p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
              {isCurrentUser ? 'Judge' : `Seat ${seatNumber}`}
            </p>
          </div>
        </div>

        {/* Video area */}
        <div className="pt-14 p-2">
          {hasUser ? (
            canPublish && localVideoTrack ? (
              <VideoTile
                localVideoTrack={localVideoTrack}
                localAudioTrack={localAudioTrack}
                displayName={username}
                role="judge"
                canPublish={canPublish}
                livekitClient={livekitClient}
              />
            ) : (
              <VideoTile
                user={user}
                displayName={username}
                role="judge"
              />
            )
          ) : (
            /* Empty seat state */
            <div className="aspect-video flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 rounded-lg">
              <div className="text-center p-4">
                <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-slate-800/50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="text-slate-500 text-xs">Empty Seat</p>
                {onJoin && (
                  <button
                    onClick={onJoin}
                    className="mt-2 px-3 py-1.5 bg-yellow-600/80 hover:bg-yellow-600 text-white text-xs font-medium rounded-full transition-colors"
                  >
                    Take Seat
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Control panel at bottom */}
        {hasUser && (
          <div className="p-2 bg-gradient-to-t from-slate-900 to-slate-800/50">
            {/* Avatar and name */}
            <div className="flex items-center gap-2 mb-2">
              <img 
                src={avatarUrl} 
                alt={username}
                className="w-8 h-8 rounded-full border border-slate-600 object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{username}</p>
                <p className="text-yellow-500 text-xs">Judge</p>
              </div>
              {isCurrentUser && onLeave && (
                <button
                  onClick={onLeave}
                  className="px-2 py-1 bg-red-600/80 hover:bg-red-600 text-white text-xs rounded transition-colors"
                >
                  Leave
                </button>
              )}
            </div>
            
            {/* Vote buttons */}
            <div className="flex gap-1">
              <button className="flex-1 py-1.5 bg-green-600/80 hover:bg-green-600 text-white text-xs font-medium rounded transition-colors">
                ✓ Yes
              </button>
              <button className="flex-1 py-1.5 bg-red-600/80 hover:bg-red-600 text-white text-xs font-medium rounded transition-colors">
                ✗ No
              </button>
              <button className="flex-1 py-1.5 bg-yellow-600/80 hover:bg-yellow-600 text-black text-xs font-medium rounded transition-colors">
                ★
              </button>
            </div>
          </div>
        )}

        {/* Chair armrest decoration */}
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-slate-600/20 to-transparent" />
      </div>

      {/* Seat number indicator */}
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-slate-800/90 text-slate-400 text-[10px] font-medium rounded-full border border-slate-700/50">
        {seatNumber}
      </div>

      {/* Glow effect for current user */}
      {isCurrentUser && (
        <div className="absolute -inset-1 rounded-xl bg-yellow-500/20 blur-sm animate-pulse" />
      )}
    </div>
  );
};

export default JudgeSeat;
