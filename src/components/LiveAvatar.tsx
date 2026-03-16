import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LiveAvatarProps {
  userId?: string;
  username?: string;
  avatarUrl?: string | null;
  isLive?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  onProfileClick?: () => void;
  showLiveBadge?: boolean;
  borderColor?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-20 h-20',
  xl: 'w-32 h-32',
  '2xl': 'w-40 h-40',
};

const LiveAvatar: React.FC<LiveAvatarProps> = memo(({
  userId,
  username,
  avatarUrl,
  isLive,
  size = 'md',
  className = '',
  onProfileClick,
  showLiveBadge = true,
  borderColor = 'border-gray-700',
}) => {
  const navigate = useNavigate();
  const displayName = username || 'User';
  const finalAvatarUrl = avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isLive && userId) {
      try {
        // Fetch active stream for this user
        const { data: stream } = await supabase
          .from('streams')
          .select('id')
          .eq('broadcaster_id', userId)
          .eq('is_live', true)
          .single();

        if (stream?.id) {
          navigate(`/stream/${stream.id}`);
          return;
        } else {
          // If no active stream found despite isLive=true (could be stale state), fallback to profile
          console.warn('User marked as live but no active stream found');
        }
      } catch (err) {
        console.error('Error fetching live stream:', err);
      }
    }

    // Fallback to profile click
    if (onProfileClick) {
      onProfileClick();
    } else if (userId) {
      navigate(`/profile/id/${userId}`);
    } else if (username) {
      navigate(`/profile/${encodeURIComponent(username)}`);
    }
  };

  return (
    <div 
      className={`relative inline-block cursor-pointer group ${className}`}
      onClick={handleClick}
    >
      <div className={`relative ${isLive ? 'p-[2px]' : ''} rounded-full transition-all duration-300`}>
        {/* Live Ring Animation */}
        {isLive && (
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500 via-pink-500 to-red-500 animate-spin-slow blur-[2px] opacity-80" />
        )}
        
        {/* Avatar Image */}
        <img
          src={finalAvatarUrl}
          alt={displayName}
          className={`
            relative z-10 rounded-full object-cover border-2 ${isLive ? 'border-transparent' : borderColor}
            ${sizeClasses[size]}
            ${isLive ? 'group-hover:scale-105 transition-transform duration-300' : ''}
          `}
        />

        {/* Live Badge (Optional) */}
        {isLive && showLiveBadge && (
          <div className="absolute -bottom-1 -right-1 z-20 bg-gradient-to-r from-red-600 to-pink-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-gray-900 flex items-center gap-1 shadow-lg animate-pulse">
            <Radio size={8} className="animate-pulse" />
            LIVE
          </div>
        )}
      </div>
    </div>
  );
});

LiveAvatar.displayName = 'LiveAvatar';

export default LiveAvatar;
