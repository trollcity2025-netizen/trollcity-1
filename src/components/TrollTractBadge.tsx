import React from 'react';
import { Crown, Sparkles } from 'lucide-react';
import { UserProfile } from '../lib/supabase';

interface TrollTractBadgeProps {
  profile: UserProfile;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  animated?: boolean;
}

export default function TrollTractBadge({ 
  profile, 
  size = 'md', 
  showText = true, 
  animated = true 
}: TrollTractBadgeProps) {
  
  // Don't render if user doesn't have TrollTract activated
  if (!profile.is_trolltract) {
    return null;
  }

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8', 
    lg: 'w-12 h-12'
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  };

  return (
    <div className="inline-flex items-center gap-1">
      {/* Main Badge */}
      <div 
        className={`
          relative ${sizeClasses[size]} rounded-full
          bg-gradient-to-r from-purple-600 via-gold-500 to-purple-600
          ${animated ? 'animate-pulse' : ''}
          flex items-center justify-center
          shadow-lg
          ${animated ? 'hover:scale-110 transition-transform' : ''}
        `}
        title="TrollTract Creator"
      >
        {/* Animated background gradient */}
        <div className={`
          absolute inset-0 rounded-full
          bg-gradient-to-r from-purple-600 via-gold-500 to-purple-600
          ${animated ? 'animate-pulse' : ''}
          opacity-75
        `} />
        
        {/* Crown Icon */}
        <Crown 
          className={`
            ${iconSizes[size]} text-white relative z-10
            ${animated ? 'drop-shadow-sm' : ''}
          `} 
        />
        
        {/* Sparkle effect for animated version */}
        {animated && (
          <div className="absolute -top-1 -right-1">
            <Sparkles className="w-3 h-3 text-gold-300 animate-ping" />
          </div>
        )}
        
        {/* Glow effect */}
        <div className={`
          absolute inset-0 rounded-full
          bg-gradient-to-r from-purple-600 via-gold-500 to-purple-600
          blur-sm opacity-50
          ${animated ? 'animate-pulse' : ''}
        `} />
      </div>
      
      {/* Text Label */}
      {showText && (
        <span 
          className={`
            ${textSizes[size]} font-bold text-transparent bg-clip-text
            bg-gradient-to-r from-purple-400 to-gold-400
            ${animated ? 'animate-pulse' : ''}
          `}
        >
          TrollTract
        </span>
      )}
    </div>
  );
}

// Simplified version for smaller spaces
export function TrollTractBadgeCompact({ profile, size = 'sm' }: { profile: UserProfile, size?: 'sm' | 'md' }) {
  if (!profile.is_trolltract) return null;

  return (
    <div 
      className={`
        inline-flex items-center justify-center
        ${size === 'sm' ? 'w-5 h-5' : 'w-6 h-6'} 
        rounded-full bg-gradient-to-r from-purple-600 to-gold-500
        shadow-md
      `}
      title="TrollTract Creator"
    >
      <Crown className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} text-white`} />
    </div>
  );
}

// Badge for display in user lists/cards
export function TrollTractBadgeCard({ profile }: { profile: UserProfile }) {
  if (!profile.is_trolltract) return null;

  return (
    <div className="inline-flex items-center gap-1 bg-gradient-to-r from-purple-900/20 to-gold-900/20 px-2 py-1 rounded-full border border-purple-500/30">
      <Crown className="w-4 h-4 text-gold-400" />
      <span className="text-xs font-semibold text-gold-300">TrollTract</span>
    </div>
  );
}