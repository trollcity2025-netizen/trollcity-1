import React from 'react';

interface QueueItem {
  id: string;
  position: number;
  user_id: string;
  user_profiles?: {
    username: string;
    avatar_url: string;
  };
  coins?: number;
}

interface QueueSidePanelProps {
  queue: QueueItem[];
  currentUserId?: string;
  isOpen?: boolean;
  onClose?: () => void;
  onJoin?: () => void;
  onLeave?: () => void;
  isUserInQueue?: boolean;
}

/**
 * QueueSidePanel - Floating glass panel on right side with:
 * - Transparent dark blur background
 * - Queue list with avatars
 * - Coins indicators
 * - Position numbers
 * - Highlight current user
 * - Join / Leave buttons
 * - Scrollable content
 */
export const QueueSidePanel: React.FC<QueueSidePanelProps> = ({
  queue,
  currentUserId,
  isOpen = true,
  onClose,
  onJoin,
  onLeave,
  isUserInQueue = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed right-4 top-20 z-50 w-80">
      {/* Glass panel container */}
      <div className="
        backdrop-blur-xl bg-black/40 
        border border-yellow-500/20 
        rounded-2xl 
        shadow-[0_0_40px_rgba(0,0,0,0.5),0_0_20px_rgba(255,215,0,0.1)]
        overflow-hidden
      ">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-yellow-600/20 to-amber-600/20 border-b border-yellow-500/20">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-lg">🎭</span>
            <h3 className="text-white font-bold text-sm">Audition Queue</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded-full">
              {queue.length} waiting
            </span>
            {onClose && (
              <button 
                onClick={onClose}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Queue list */}
        <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-yellow-500/30 scrollbar-track-transparent">
          {queue.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800/50 flex items-center justify-center">
                <span className="text-2xl">🎤</span>
              </div>
              <p className="text-slate-400 text-sm">No one in queue</p>
              <p className="text-slate-500 text-xs mt-1">Be the first to audition!</p>
            </div>
          ) : (
            <div className="p-2">
              {queue.map((item, index) => {
                const isCurrentUser = item.user_id === currentUserId;
                const avatarUrl = item.user_profiles?.avatar_url || `https://ui-avatars.com/api/?background=random&name=${item.user_profiles?.username || 'User'}`;
                const username = item.user_profiles?.username || 'Unknown';

                return (
                  <div 
                    key={item.id || index}
                    className={`
                      flex items-center gap-3 p-2 rounded-xl mb-1
                      transition-all duration-200
                      ${isCurrentUser 
                        ? 'bg-yellow-500/20 border border-yellow-500/40' 
                        : 'hover:bg-white/5 border border-transparent'
                      }
                    `}
                  >
                    {/* Position number */}
                    <div className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                      ${index === 0 ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-slate-400'}
                    `}>
                      {item.position}
                    </div>

                    {/* Avatar */}
                    <img 
                      src={avatarUrl}
                      alt={username}
                      className="w-10 h-10 rounded-full border-2 object-cover"
                      style={{ borderColor: isCurrentUser ? '#eab308' : '#475569' }}
                    />

                    {/* User info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isCurrentUser ? 'text-yellow-400' : 'text-white'}`}>
                        {username}
                        {isCurrentUser && <span className="text-xs ml-1">(You)</span>}
                      </p>
                      {item.coins !== undefined && (
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <span>🪙</span>
                          {item.coins.toLocaleString()}
                        </p>
                      )}
                    </div>

                    {/* Next up indicator */}
                    {index === 0 && (
                      <div className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full animate-pulse">
                        NEXT
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with action buttons */}
        <div className="p-3 bg-gradient-to-t from-black/60 to-transparent border-t border-yellow-500/10">
          {!isUserInQueue ? (
            <button
              onClick={onJoin}
              className="w-full py-2.5 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-yellow-600/20 hover:shadow-yellow-600/40"
            >
              Join Queue
            </button>
          ) : (
            <button
              onClick={onLeave}
              className="w-full py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-red-600/20 hover:shadow-red-600/40"
            >
              Leave Queue
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QueueSidePanel;
