import React from 'react';
import { Crown } from 'lucide-react';
import { UserProfile } from '../../lib/supabase';

interface TrollTractBadgeProps {
  profile: UserProfile;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export default function TrollTractBadge({ profile, size = 'md', showText = true }: TrollTractBadgeProps) {
  // Don't render if user doesn't have TrollTract activated
  if (!profile.is_trolltract) {
    return null;
  }

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: showText ? "6px" : "0",
        padding: size === 'sm' ? "2px 6px" : size === 'md' ? "4px 8px" : "6px 12px",
        borderRadius: "999px",
        background: "linear-gradient(135deg, rgba(148,63,255,0.9), rgba(255,204,0,0.9))",
        fontSize: size === 'sm' ? "10px" : size === 'md' ? "12px" : "14px",
        fontWeight: 700,
        color: "#050308",
        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
      }}
      title="TrollTract Creator"
    >
      <Crown className={`${iconSizes[size]} text-yellow-600`} />
      {showText && <span>👑 TrollTract</span>}
    </span>
  );
}

// Compact version for tight spaces
export function TrollTractBadgeCompact({ profile }: { profile: UserProfile }) {
  if (!profile.is_trolltract) return null;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        background: "linear-gradient(135deg, rgba(148,63,255,0.9), rgba(255,204,0,0.9))",
        fontSize: "10px",
        fontWeight: 700,
        color: "#050308",
        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
      }}
      title="TrollTract Creator"
    >
      👑
    </span>
  );
}

// Card version for lists
export function TrollTractBadgeCard({ profile }: { profile: UserProfile }) {
  if (!profile.is_trolltract) return null;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        borderRadius: "8px",
        background: "linear-gradient(135deg, rgba(148,63,255,0.1), rgba(255,204,0,0.1))",
        border: "1px solid rgba(148,63,255,0.3)",
        fontSize: "13px",
        fontWeight: 600,
        color: "#e0e0e0",
      }}
    >
      <Crown className="w-4 h-4 text-gold-400" />
      <span>TrollTract Creator</span>
    </div>
  );
}