import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Crown, Shield } from 'lucide-react';
import { APP_DATA_REFETCH_EVENT_NAME as REFRESH_EVENT } from '../lib/appEvents';
import { isBirthdayToday } from '../lib/birthdayUtils';
import { useAuthStore } from '../lib/store';
import { areUsersLive } from '../lib/liveUtils';
import { useLiveStreams, useNewUsers } from '../hooks/useQueries';
import BanPage from '../components/BanPage';
import KickPage from '../components/KickPage';
import EmptyStateLiveNow from '../components/ui/EmptyStateLiveNow';
import TrollPassBanner from '../components/ui/TrollPassBanner';
import { UserCardSkeleton } from '../components/ui/Skeleton';

type HomeUser = {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
  tier?: string | null;
  level?: number | null;
  troll_coins?: number | null;
  created_at?: string | null;
  role?: string | null;
  is_banned?: boolean | null;
  banned_until?: string | null;
  rgb_username_expires_at?: string | null;
};

const NeonParticle: React.FC<{ delay: number; color: string }> = ({ delay, color }) => {
  return (
    <div
      className="absolute w-2 h-2 rounded-full animate-float"
      style={{
        backgroundColor: color,
        boxShadow: `0 0 10px ${color}`,
        animationDelay: `${delay}s`
      }}
    />
  );
};

const TrollCityBackground: React.FC = () => {
  return (
    <div className="absolute bottom-0 w-full h-3/4 pointer-events-none" style={{ zIndex: 1 }}>
      <div className="absolute bottom-0 w-full h-3/4 perspective">
        <div className="absolute bottom-0 w-full h-32 opacity-40" style={{ transform: 'translateZ(-500px) scale(1.5)' }}>
          <div className="flex items-end justify-around h-full px-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={`bg-${i}`}
                className="bg-gradient-to-t from-purple-600/50 to-purple-400/20 rounded-t-lg border border-purple-500/40"
                style={{
                  width: `${40 + (i % 3) * 20}px`,
                  height: `${80 + (i % 4) * 40}px`,
                  animation: `float ${5 + i * 0.5}s ease-in-out infinite`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Mid buildings */}
        <div className="absolute bottom-0 w-full h-48 opacity-60" style={{ transform: 'translateZ(-250px)' }}>
          <div className="flex items-end justify-between h-full px-8">
            {[...Array(6)].map((_, i) => (
              <div
                key={`mid-${i}`}
                className="bg-gradient-to-b from-purple-500/60 via-purple-600/50 to-purple-700/70 rounded-t-xl border-2 border-purple-400/50 shadow-lg shadow-purple-500/40"
                style={{
                  width: `${60 + (i % 3) * 30}px`,
                  height: `${120 + (i % 5) * 60}px`,
                  animation: `float ${4 + i * 0.3}s ease-in-out infinite`,
                }}
              >
                {/* Windows */}
                {[...Array(Math.floor(120 / 20))].map((_, w) => (
                  <div
                    key={`window-${w}`}
                    className="absolute left-1/4 w-2 h-2 bg-yellow-300/70 rounded-sm m-1"
                    style={{ top: `${w * 20}px` }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Front buildings - closest and most prominent */}
        <div className="absolute bottom-0 w-full h-80 opacity-75">
          <div className="flex items-end justify-between h-full px-12 gap-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={`front-${i}`}
                className="bg-gradient-to-b from-cyan-500/50 via-purple-600/60 to-purple-900/80 rounded-t-2xl border-2 border-purple-400/60 shadow-2xl shadow-purple-500/50"
                style={{
                  width: `${100 + (i % 2) * 40}px`,
                  height: `${180 + (i % 3) * 80}px`,
                  animation: `float ${3 + i * 0.2}s ease-in-out infinite`,
                }}
              >
                {/* Building windows grid */}
                {[...Array(5)].map((_, row) =>
                  [...Array(2)].map((_, col) => (
                    <div
                      key={`win-${row}-${col}`}
                      className="absolute w-3 h-3 bg-yellow-200/80 rounded-sm border border-yellow-400/60"
                      style={{
                        left: `${col * 30 + 15}px`,
                        top: `${row * 35 + 20}px`,
                        animation: `windowFlicker ${2 + (row + col) * 0.3}s ease-in-out infinite`,
                      }}
                    />
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trolls in the city */}
      <div className="absolute bottom-24 w-full h-64 opacity-75 flex items-end justify-around px-8">
        {/* Troll 1 - Left side */}
        <div
          className="relative"
          style={{
            animation: 'float 6s ease-in-out infinite',
          }}
        >
          <svg width="100" height="140" viewBox="0 0 100 140" className="drop-shadow-lg" style={{ filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.5))' }}>
            {/* Thick muscular legs */}
            <ellipse cx="35" cy="115" rx="12" ry="20" fill="#6b4d9c" opacity="1" />
            <ellipse cx="65" cy="115" rx="12" ry="20" fill="#6b4d9c" opacity="1" />
            
            {/* Feet */}
            <ellipse cx="35" cy="135" rx="14" ry="8" fill="#4a3470" opacity="1" />
            <ellipse cx="65" cy="135" rx="14" ry="8" fill="#4a3470" opacity="1" />
            
            {/* Large muscular torso */}
            <ellipse cx="50" cy="70" rx="28" ry="35" fill="#8b5fbf" opacity="1" />
            
            {/* Chest definition */}
            <path d="M 50 40 Q 48 70 50 85" stroke="#6b4d9c" strokeWidth="2" fill="none" opacity="0.6" />
            
            {/* Massive shoulders */}
            <ellipse cx="22" cy="55" rx="15" ry="20" fill="#8b5fbf" opacity="1" />
            <ellipse cx="78" cy="55" rx="15" ry="20" fill="#8b5fbf" opacity="1" />
            
            {/* Thick muscular arms */}
            <rect x="8" y="50" width="16" height="35" rx="8" fill="#7c4da8" opacity="1" />
            <rect x="76" y="50" width="16" height="35" rx="8" fill="#7c4da8" opacity="1" />
            
            {/* Large clawed hands */}
            <circle cx="16" cy="90" r="10" fill="#5a3a7a" opacity="1" />
            <circle cx="84" cy="90" r="10" fill="#5a3a7a" opacity="1" />
            
            {/* Hand claws */}
            <polygon points="10,95 6,105 8,98" fill="#3d2654" opacity="1" />
            <polygon points="22,95 26,105 24,98" fill="#3d2654" opacity="1" />
            <polygon points="78,95 74,105 76,98" fill="#3d2654" opacity="1" />
            <polygon points="90,95 94,105 92,98" fill="#3d2654" opacity="1" />
            
            {/* Large thick neck */}
            <rect x="42" y="25" width="16" height="20" rx="8" fill="#7c4da8" opacity="1" />
            
            {/* Massive head */}
            <ellipse cx="50" cy="18" rx="22" ry="24" fill="#9d68cc" opacity="1" />
            
            {/* Rough textured skin */}
            <circle cx="35" cy="12" r="4" fill="#7c4da8" opacity="0.4" />
            <circle cx="65" cy="10" r="4" fill="#7c4da8" opacity="0.4" />
            <circle cx="50" cy="28" r="3" fill="#7c4da8" opacity="0.4" />
            
            {/* Prominent brow ridge */}
            <ellipse cx="50" cy="10" rx="20" ry="5" fill="#6b4d9c" opacity="0.5" />
            
            {/* Deep-set glowing eyes */}
            <ellipse cx="38" cy="15" rx="4" ry="6" fill="#00ffff" opacity="1" />
            <ellipse cx="62" cy="15" rx="4" ry="6" fill="#00ffff" opacity="1" />
            
            {/* Pupil glow */}
            <circle cx="38" cy="14" r="2.5" fill="#00ffff" opacity="0.8" />
            <circle cx="62" cy="14" r="2.5" fill="#00ffff" opacity="0.8" />
            
            {/* Large menacing nose */}
            <polygon points="50,22 46,28 54,28" fill="#5a3a7a" opacity="1" />
            <ellipse cx="48" cy="26" rx="2" ry="3" fill="#3d2654" opacity="0.6" />
            <ellipse cx="52" cy="26" rx="2" ry="3" fill="#3d2654" opacity="0.6" />
            
            {/* Wide menacing mouth */}
            <path d="M 40 32 Q 50 37 60 32" stroke="#fbbf24" strokeWidth="2.5" fill="none" opacity="1" />
            
            {/* Teeth visible */}
            <line x1="43" y1="33" x2="43" y2="35" stroke="#fff" strokeWidth="1.5" opacity="0.8" />
            <line x1="47" y1="34" x2="47" y2="36" stroke="#fff" strokeWidth="1.5" opacity="0.8" />
            <line x1="53" y1="34" x2="53" y2="36" stroke="#fff" strokeWidth="1.5" opacity="0.8" />
            <line x1="57" y1="33" x2="57" y2="35" stroke="#fff" strokeWidth="1.5" opacity="0.8" />
            
            {/* Horns - curved and menacing */}
            <path d="M 28 6 Q 15 2 12 12" stroke="#fbbf24" strokeWidth="4" fill="none" opacity="1" strokeLinecap="round" />
            <path d="M 72 6 Q 85 2 88 12" stroke="#fbbf24" strokeWidth="4" fill="none" opacity="1" strokeLinecap="round" />
            
            {/* Horn shine */}
            <path d="M 30 7 Q 22 4 20 11" stroke="#fde047" strokeWidth="1.5" fill="none" opacity="0.6" strokeLinecap="round" />
            <path d="M 70 7 Q 78 4 80 11" stroke="#fde047" strokeWidth="1.5" fill="none" opacity="0.6" strokeLinecap="round" />
          </svg>
        </div>

        {/* Troll 2 - Center */}
        <div
          className="relative"
          style={{
            animation: 'float 7s ease-in-out infinite 1s',
            transform: 'scaleX(-1)',
          }}
        >
          <svg width="110" height="160" viewBox="0 0 110 160" className="drop-shadow-lg" style={{ filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.6))' }}>
            {/* Thick tree-trunk legs */}
            <ellipse cx="40" cy="130" rx="16" ry="24" fill="#5a3a7a" opacity="1" />
            <ellipse cx="70" cy="130" rx="16" ry="24" fill="#5a3a7a" opacity="1" />
            
            {/* Large feet with claws */}
            <ellipse cx="40" cy="155" rx="18" ry="10" fill="#3d2654" opacity="1" />
            <ellipse cx="70" cy="155" rx="18" ry="10" fill="#3d2654" opacity="1" />
            
            {/* Foot claws */}
            <polygon points="28,155 20,160 24,155" fill="#2a1a47" opacity="1" />
            <polygon points="52,155 60,160 56,155" fill="#2a1a47" opacity="1" />
            <polygon points="58,155 50,160 54,155" fill="#2a1a47" opacity="1" />
            <polygon points="82,155 90,160 86,155" fill="#2a1a47" opacity="1" />
            
            {/* Massive barrel chest */}
            <ellipse cx="55" cy="80" rx="32" ry="42" fill="#7c4da8" opacity="1" />
            
            {/* Pectoral muscle definition */}
            <ellipse cx="38" cy="65" rx="10" ry="15" fill="#6b4d9c" opacity="0.5" />
            <ellipse cx="72" cy="65" rx="10" ry="15" fill="#6b4d9c" opacity="0.5" />
            
            {/* Huge broad shoulders */}
            <ellipse cx="20" cy="70" rx="18" ry="24" fill="#8b5fbf" opacity="1" />
            <ellipse cx="90" cy="70" rx="18" ry="24" fill="#8b5fbf" opacity="1" />
            
            {/* Massive arms */}
            <rect x="2" y="65" width="20" height="45" rx="10" fill="#6b4d9c" opacity="1" />
            <rect x="88" y="65" width="20" height="45" rx="10" fill="#6b4d9c" opacity="1" />
            
            {/* Large hands with wicked claws */}
            <circle cx="12" cy="115" r="12" fill="#4a3470" opacity="1" />
            <circle cx="98" cy="115" r="12" fill="#4a3470" opacity="1" />
            
            {/* Hand claws - menacing */}
            <polygon points="2,120 -8,135 -2,122" fill="#2a1a47" opacity="1" />
            <polygon points="22,120 32,135 28,122" fill="#2a1a47" opacity="1" />
            <polygon points="88,120 78,135 82,122" fill="#2a1a47" opacity="1" />
            <polygon points="108,120 118,135 112,122" fill="#2a1a47" opacity="1" />
            
            {/* Thick muscular neck */}
            <rect x="45" y="30" width="20" height="25" rx="10" fill="#7c4da8" opacity="1" />
            
            {/* Massive brutish head */}
            <ellipse cx="55" cy="20" rx="26" ry="28" fill="#8b5fbf" opacity="1" />
            
            {/* Rough scarred skin texture */}
            <circle cx="35" cy="8" r="5" fill="#6b4d9c" opacity="0.3" />
            <circle cx="75" cy="6" r="5" fill="#6b4d9c" opacity="0.3" />
            <circle cx="55" cy="35" r="4" fill="#6b4d9c" opacity="0.3" />
            <circle cx="45" cy="15" r="3" fill="#6b4d9c" opacity="0.3" />
            <circle cx="70" cy="12" r="4" fill="#6b4d9c" opacity="0.3" />
            
            {/* Thick heavy brow */}
            <ellipse cx="55" cy="6" rx="24" ry="7" fill="#6b4d9c" opacity="0.6" />
            
            {/* Large menacing eyes - glowing intensity */}
            <ellipse cx="40" cy="18" rx="6" ry="8" fill="#00ffff" opacity="1" />
            <ellipse cx="70" cy="18" rx="6" ry="8" fill="#00ffff" opacity="1" />
            
            {/* Eye glow rings */}
            <circle cx="40" cy="18" r="8" fill="none" stroke="#00ffff" strokeWidth="1" opacity="0.5" />
            <circle cx="70" cy="18" r="8" fill="none" stroke="#00ffff" strokeWidth="1" opacity="0.5" />
            
            {/* Large tusks */}
            <path d="M 42 32 Q 38 40 40 50" stroke="#f5f5f5" strokeWidth="4" fill="none" opacity="1" strokeLinecap="round" />
            <path d="M 68 32 Q 72 40 70 50" stroke="#f5f5f5" strokeWidth="4" fill="none" opacity="1" strokeLinecap="round" />
            
            {/* Tusk highlights */}
            <path d="M 44 32 Q 41 40 42 50" stroke="#e0e0e0" strokeWidth="1.5" fill="none" opacity="0.6" strokeLinecap="round" />
            <path d="M 66 32 Q 71 40 68 50" stroke="#e0e0e0" strokeWidth="1.5" fill="none" opacity="0.6" strokeLinecap="round" />
            
            {/* Flared nose */}
            <ellipse cx="55" cy="28" rx="5" ry="6" fill="#4a3470" opacity="1" />
            <ellipse cx="52" cy="30" rx="1.5" ry="2.5" fill="#2a1a47" opacity="0.8" />
            <ellipse cx="58" cy="30" rx="1.5" ry="2.5" fill="#2a1a47" opacity="0.8" />
            
            {/* Menacing mouth */}
            <path d="M 45 38 Q 55 45 65 38" stroke="#fbbf24" strokeWidth="3" fill="none" opacity="1" strokeLinecap="round" />
            
            {/* Visible teeth */}
            <line x1="47" y1="39" x2="47" y2="42" stroke="#fff" strokeWidth="2" opacity="0.9" />
            <line x1="52" y1="41" x2="52" y2="44" stroke="#fff" strokeWidth="2" opacity="0.9" />
            <line x1="58" y1="41" x2="58" y2="44" stroke="#fff" strokeWidth="2" opacity="0.9" />
            <line x1="63" y1="39" x2="63" y2="42" stroke="#fff" strokeWidth="2" opacity="0.9" />
            
            {/* Large curved horns */}
            <path d="M 32 4 Q 18 -8 10 5" stroke="#fcd34d" strokeWidth="5" fill="none" opacity="1" strokeLinecap="round" />
            <path d="M 78 4 Q 92 -8 100 5" stroke="#fcd34d" strokeWidth="5" fill="none" opacity="1" strokeLinecap="round" />
            
            {/* Horn striations */}
            <path d="M 35 3 Q 23 -6 15 3" stroke="#fde047" strokeWidth="1.5" fill="none" opacity="0.5" strokeLinecap="round" />
            <path d="M 75 3 Q 87 -6 95 3" stroke="#fde047" strokeWidth="1.5" fill="none" opacity="0.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* Troll 3 - Right side */}
        <div
          className="relative"
          style={{
            animation: 'float 5.5s ease-in-out infinite 0.5s',
          }}
        >
          <svg width="95" height="150" viewBox="0 0 95 150" className="drop-shadow-lg" style={{ filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.5))' }}>
            {/* Solid muscular legs */}
            <ellipse cx="32" cy="120" rx="14" ry="22" fill="#6b4d9c" opacity="1" />
            <ellipse cx="63" cy="120" rx="14" ry="22" fill="#6b4d9c" opacity="1" />
            
            {/* Wide stance feet */}
            <ellipse cx="32" cy="142" rx="16" ry="9" fill="#4a3470" opacity="1" />
            <ellipse cx="63" cy="142" rx="16" ry="9" fill="#4a3470" opacity="1" />
            
            {/* Foot spikes */}
            <polygon points="20,142 14,148 18,142" fill="#2a1a47" opacity="1" />
            <polygon points="44,142 50,148 46,142" fill="#2a1a47" opacity="1" />
            <polygon points="51,142 45,148 49,142" fill="#2a1a47" opacity="1" />
            <polygon points="75,142 81,148 77,142" fill="#2a1a47" opacity="1" />
            
            {/* Large athletic torso */}
            <ellipse cx="47.5" cy="75" rx="30" ry="38" fill="#8b5fbf" opacity="1" />
            
            {/* Abs definition */}
            <rect x="44" y="45" width="2" height="35" fill="#6b4d9c" opacity="0.4" />
            <line x1="40" y1="60" x2="55" y2="60" stroke="#6b4d9c" strokeWidth="1.5" opacity="0.3" />
            <line x1="40" y1="75" x2="55" y2="75" stroke="#6b4d9c" strokeWidth="1.5" opacity="0.3" />
            
            {/* Massive shoulders */}
            <ellipse cx="18" cy="65" rx="16" ry="22" fill="#8b5fbf" opacity="1" />
            <ellipse cx="77" cy="65" rx="16" ry="22" fill="#8b5fbf" opacity="1" />
            
            {/* Thick muscular arms */}
            <rect x="4" y="60" width="18" height="40" rx="9" fill="#7c4da8" opacity="1" />
            <rect x="73" y="60" width="18" height="40" rx="9" fill="#7c4da8" opacity="1" />
            
            {/* Strong clawed hands */}
            <circle cx="13" cy="105" r="11" fill="#5a3a7a" opacity="1" />
            <circle cx="82" cy="105" r="11" fill="#5a3a7a" opacity="1" />
            
            {/* Sharp hand claws */}
            <polygon points="6,108 -2,120 2,110" fill="#2a1a47" opacity="1" />
            <polygon points="20,108 28,120 24,110" fill="#2a1a47" opacity="1" />
            <polygon points="75,108 67,120 71,110" fill="#2a1a47" opacity="1" />
            <polygon points="89,108 97,120 93,110" fill="#2a1a47" opacity="1" />
            
            {/* Strong neck */}
            <rect x="41" y="28" width="18" height="22" rx="9" fill="#7c4da8" opacity="1" />
            
            {/* Fearsome head */}
            <ellipse cx="50" cy="18" rx="24" ry="26" fill="#9d68cc" opacity="1" />
            
            {/* War scars and texture */}
            <circle cx="32" cy="8" r="4" fill="#7c4da8" opacity="0.35" />
            <circle cx="68" cy="10" r="4" fill="#7c4da8" opacity="0.35" />
            <circle cx="50" cy="32" r="3.5" fill="#7c4da8" opacity="0.35" />
            
            {/* Fierce brow ridge */}
            <ellipse cx="50" cy="4" rx="22" ry="6" fill="#6b4d9c" opacity="0.55" />
            
            {/* Intense piercing eyes */}
            <ellipse cx="38" cy="16" rx="5" ry="7" fill="#00ffff" opacity="1" />
            <ellipse cx="62" cy="16" rx="5" ry="7" fill="#00ffff" opacity="1" />
            
            {/* Eye intensity */}
            <circle cx="38" cy="16" r="2.5" fill="#ffffff" opacity="0.8" />
            <circle cx="62" cy="16" r="2.5" fill="#ffffff" opacity="0.8" />
            
            {/* Battle-scarred nose */}
            <polygon points="50,24 46,30 54,30" fill="#5a3a7a" opacity="1" />
            <circle cx="48" cy="28" r="1.5" fill="#2a1a47" opacity="0.7" />
            <circle cx="52" cy="28" r="1.5" fill="#2a1a47" opacity="0.7" />
            
            {/* Fierce grin with teeth */}
            <path d="M 42 34 Q 50 40 58 34" stroke="#fbbf24" strokeWidth="2.5" fill="none" opacity="1" strokeLinecap="round" />
            
            {/* Menacing tusks/teeth */}
            <line x1="44" y1="35" x2="44" y2="37" stroke="#fff" strokeWidth="1.5" opacity="0.9" />
            <line x1="48" y1="36" x2="48" y2="38" stroke="#fff" strokeWidth="1.5" opacity="0.9" />
            <line x1="52" y1="36" x2="52" y2="38" stroke="#fff" strokeWidth="1.5" opacity="0.9" />
            <line x1="56" y1="35" x2="56" y2="37" stroke="#fff" strokeWidth="1.5" opacity="0.9" />
            
            {/* Curved demonic horns */}
            <path d="M 28 6 Q 16 2 12 14" stroke="#fcd34d" strokeWidth="3.5" fill="none" opacity="1" strokeLinecap="round" />
            <path d="M 72 6 Q 84 2 88 14" stroke="#fcd34d" strokeWidth="3.5" fill="none" opacity="1" strokeLinecap="round" />
            
            {/* Horn shine detail */}
            <path d="M 30 6 Q 20 4 16 12" stroke="#fde047" strokeWidth="1" fill="none" opacity="0.5" strokeLinecap="round" />
            <path d="M 70 6 Q 80 4 84 12" stroke="#fde047" strokeWidth="1" fill="none" opacity="0.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Glow effect overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-purple-600/10 via-transparent to-transparent pointer-events-none" />
    </div>
  );
};

const ChristmasOutline: React.FC<{ rowCount?: number; colCount?: number }> = ({
  rowCount = 7,
  colCount = 4
}) => {
  const rowLights = Array.from({ length: rowCount });
  const colLights = Array.from({ length: colCount });
  let idx = 0;

  return (
    <div className="christmas-outline">
      <div className="lights-row lights-top">
        {rowLights.map((_, i) => (
          <span
            key={`top-${i}`}
            className="outline-light"
            style={{ ['--idx' as any]: idx++ }}
          />
        ))}
      </div>
      <div className="lights-row lights-bottom">
        {rowLights.map((_, i) => (
          <span
            key={`bottom-${i}`}
            className="outline-light"
            style={{ ['--idx' as any]: idx++ }}
          />
        ))}
      </div>
      <div className="lights-col lights-right">
        {colLights.map((_, i) => (
          <span
            key={`right-${i}`}
            className="outline-light"
            style={{ ['--idx' as any]: idx++ }}
          />
        ))}
      </div>
      <div className="lights-col lights-left">
        {colLights.map((_, i) => (
          <span
            key={`left-${i}`}
            className="outline-light"
            style={{ ['--idx' as any]: idx++ }}
          />
        ))}
      </div>
    </div>
  );
};

import LiveAvatar from '../components/LiveAvatar';

const NewUserCard: React.FC<{ user: HomeUser; onClick: (profileRoute: string) => void; isLive?: boolean }> = memo(({ user, onClick, isLive }) => {
  const displayName = user.username || 'User';
  const isAdmin = user.role === 'admin';
  const profileRoute = user.id ? `/profile/id/${user.id}` : '#';
  const hasRgbUsername = user.rgb_username_expires_at && new Date(user.rgb_username_expires_at) > new Date();

  const handleProfileClick = () => {
    if (!user.id) return;
    onClick(profileRoute);
  };

  return (
    <button
      onClick={handleProfileClick}
      className="relative group w-full aspect-[3/4] bg-gradient-to-br from-[#1f1535]/80 via-[#16102a]/60 to-[#0f0820]/40 rounded-xl p-3 border border-purple-500/30 hover:border-purple-400/60 shadow-md hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300 flex flex-col items-center gap-2 overflow-hidden home-outline-rgb"
    >
      <div className="absolute inset-0 bg-gradient-to-t from-purple-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative z-10">
        <div className="relative">
          <LiveAvatar
            userId={user.id}
            username={displayName}
            avatarUrl={user.avatar_url}
            isLive={isLive}
            size="lg"
            borderColor={isAdmin ? 'border-yellow-400/60' : 'border-cyan-400/60'}
            onProfileClick={handleProfileClick}
          />
          
          {isAdmin && (
            <div className="absolute -top-1 -left-1 z-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full p-1.5 border-2 border-black">
              <Crown className="w-3 h-3 text-black" />
            </div>
          )}
        </div>
      </div>
      
      <div className="relative z-10 text-center flex-1 w-full">
        <p className={`text-[clamp(12px,3.5vw,16px)] font-semibold truncate ${hasRgbUsername ? 'rgb-username' : 'text-white'}`}>{displayName}</p>
        <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold transition-all home-outline-rgb-pill ${
            isAdmin
              ? 'bg-yellow-500/20 border border-yellow-400/50 text-yellow-300'
              : 'bg-purple-500/20 border border-purple-400/50 text-purple-300'
          }`}>
            Lv {user.level ?? 1}
          </span>
          {isAdmin && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-500/20 border border-yellow-400/50 text-yellow-300 home-outline-rgb-pill">
              Admin
            </span>
          )}
        </div>
      </div>
    </button>
  );
});

NewUserCard.displayName = 'NewUserCard';

// 🔑 Step 5: Background refresh pattern with dual-state buffering
const HomePageContent = () => {
  const { profile } = useAuthStore();

  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return;
    document.body.classList.remove('no-scroll');
    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, []);

  // Use React Query hooks
  const { data: liveStreams = [], isLoading: loadingLive } = useLiveStreams();
  const { data: newUsers = [], isLoading: loadingUsers } = useNewUsers();
  
  // Role logic for Go Live access
  const canGoLive =
    profile?.role === "admin" ||
    profile?.role === "lead_troll_officer" ||
    profile?.role === "troll_officer" ||
    profile?.is_broadcaster ||
    profile?.is_lead_officer;
  const isOfficer =
    profile?.role === 'troll_officer' ||
    profile?.role === 'lead_troll_officer' ||
    profile?.is_troll_officer ||
    profile?.is_lead_officer
  const isAdmin = profile?.role === 'admin' || profile?.is_admin
  const _canEndLive = isAdmin || isOfficer

  const _endLiveStream = async (streamId: string) => {
    try {
      const { error } = await supabase
        .from('streams')
        .update({ is_live: false })
        .eq('id', streamId)

      if (error) throw error

      toast.success('Live stream ended')
    } catch (error) {
      console.error('Error ending live stream:', error)
      toast.error('Failed to end live stream')
    }
  }

  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return

    const bannerTerms = [
      'refresh now to load the latest experience',
      'update available',
    ]

    const matchesBanner = (text?: string) => {
      if (!text) return false
      const lowerText = text.toLowerCase()
      return bannerTerms.some((term) => lowerText.includes(term))
    }

    const removeCurrentBanner = () => {
      const body = document.body
      if (!body) return false
      const candidate = Array.from(body.querySelectorAll<HTMLElement>('*')).find((element) =>
        matchesBanner(element.textContent || '')
      )
      if (candidate) {
        candidate.remove()
        return true
      }
      return false
    }

    let observer: MutationObserver | null = null
    if (!removeCurrentBanner() && typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(() => {
        if (removeCurrentBanner()) {
          observer?.disconnect()
          observer = null
        }
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      })
    }

    return () => {
      observer?.disconnect()
    }
  }, [])

  const [currentTime, setCurrentTime] = useState(new Date());
  const [liveUsers, setLiveUsers] = useState<Map<string, boolean>>(new Map()); // Track which users are live
  const [selectedCategory, setSelectedCategory] = useState('All');
  const navigate = useNavigate();
  const location = useLocation();
  const lastGlobalRefetchAt = useRef(0);
  
  const normalizeCategory = (category?: string | null) => {
    const trimmed = (category || '').trim();
    return trimmed || 'General';
  };

  const availableCategories = useMemo(() => {
    const categoriesSet = new Set<string>();
    liveStreams.forEach((stream) => {
      categoriesSet.add(normalizeCategory(stream.category));
    });
    return ['All', ...Array.from(categoriesSet)];
  }, [liveStreams]);

  useEffect(() => {
    if (!availableCategories.includes(selectedCategory)) {
      setSelectedCategory('All');
    }
  }, [availableCategories, selectedCategory]);
  // Dev mode test displays
  const [showBanPage, setShowBanPage] = useState(false);
  const [showKickPage, setShowKickPage] = useState(false);
  const isDev = import.meta.env.DEV;
  const feeMode = useMemo(() => {
    if (!isDev) return null;
    const params = new URLSearchParams(location.search);
    return params.get('fee');
  }, [isDev, location.search]);

  useEffect(() => {
    if (!isDev) return;
    if (feeMode === 'ban') {
      setShowBanPage(true);
      setShowKickPage(false);
    } else if (feeMode === 'kick') {
      setShowKickPage(true);
      setShowBanPage(false);
    }
  }, [feeMode, isDev]);

  useEffect(() => {
    // Only update the page-level time once per minute to avoid constant re-renders.
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);
// 🔑 Step 2: Listen for global refetch signal
useEffect(() => {
  const refetch = () => {
    const path = location.pathname;
    if (path.startsWith('/profile')) return;

    const now = Date.now();
    if (now - lastGlobalRefetchAt.current < 1000) return;
    lastGlobalRefetchAt.current = now;

    console.log("🔄 Global refetch signal received - refreshing homepage data");
    // React Query will handle refetching
  };

  window.addEventListener("trollcity:refetch", refetch);
  window.addEventListener(REFRESH_EVENT, refetch);
  return () => {
    window.removeEventListener("trollcity:refetch", refetch);
    window.removeEventListener(REFRESH_EVENT, refetch);
  };
}, [location.pathname]);

  // Check which users are live
  useEffect(() => {
    const checkLiveUsers = async () => {
      if (newUsers.length === 0) {
        // avoid updating state unnecessarily
        setLiveUsers(prev => {
          if (prev.size === 0) return prev;
          return new Map();
        });
        return;
      }

      try {
        const userIds = newUsers.map(user => user.id);
        const liveStatusMap = await areUsersLive(userIds);
        // Only update state if the map contents actually changed to avoid render loops
        setLiveUsers((prev) => {
          const prevKeys = Array.from(prev.keys());
          const newKeys = Array.from(liveStatusMap.keys());
          if (prevKeys.length !== newKeys.length) return liveStatusMap;
          for (const k of newKeys) {
            if (prev.get(k) !== liveStatusMap.get(k)) return liveStatusMap;
          }
          return prev;
        });
      } catch (error) {
        console.error('Failed to check live users:', error);
        setLiveUsers(new Map());
      }
    };

    checkLiveUsers();

    // Refresh live status every 15 seconds
    const interval = setInterval(checkLiveUsers, 15000);
    return () => clearInterval(interval);
  }, [newUsers]);


  // Award birthday bonus on page load if eligible
  useEffect(() => {
    const awardBirthdayBonus = async () => {
      if (!profile?.id) return;

      try {
        const { data, error } = await supabase.rpc('award_birthday_bonus', {
          p_user_id: profile.id
        });

        if (error) {
          console.error('Error awarding birthday bonus:', error);
        } else if (data === true) {
          console.log('Birthday bonus awarded!');
          // Optionally show a toast or notification
        }
      } catch (e) {
        console.error('Failed to check birthday bonus:', e);
      }
    };

    awardBirthdayBonus();
  }, [profile?.id]);

  const hasLiveData = liveStreams.length > 0;
  const displayStreams =
    selectedCategory === 'All'
      ? liveStreams
      : liveStreams.filter((stream) => normalizeCategory(stream.category) === selectedCategory);
  const showCategoryRow = availableCategories.length > 1;
  const showCategoryEmpty = hasLiveData && displayStreams.length === 0;

  // Holiday theme active from Dec 1-25
  const isHolidaySeason = currentTime.getMonth() === 11 && currentTime.getDate() <= 25;

  return (
    // 🔑 Step 3: Layout dimension locking to prevent repaints
    <div className="min-h-screen bg-gradient-to-br from-[#0F0517] via-[#1A0A26] to-[#0D0411] text-white relative overflow-x-hidden homepage-root">
      {showKickPage && (
        <KickPage onClose={() => setShowKickPage(false)} kickCount={2} />
      )}
      {showBanPage && <BanPage onClose={() => setShowBanPage(false)} />}
      
      {/* Troll City skyline only (no falling Troll City text) */}
      <TrollCityBackground />
      {/* Holiday Theme: Snow, Christmas Lights, and Candy Canes */}
      {isHolidaySeason && (
        <div className="absolute inset-0 pointer-events-none holiday-theme">
          {/* Snowflakes */}
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={`snow-${i}`}
            className="snowflake"
            style={{
              left: `${((i + 1) / 51) * 100}%`,
              animationDelay: `${(i % 12) * 0.9}s`,
              animationDuration: `${12 + (i % 12) * 1.2}s`
            }}
          />
        ))}
        <div className="snow-ground">
          <div className="snowbank" />
          <div className="snowmen">
            <div className="snowman">
              <div className="snowman-body" />
              <div className="snowman-head">
                <span className="snowman-eye left" />
                <span className="snowman-eye right" />
                <span className="snowman-nose" />
                <span className="snowman-scarf" />
                <span className="snowman-hat" />
              </div>
            </div>
            <div className="snowman">
              <div className="snowman-body" />
              <div className="snowman-head">
                <span className="snowman-eye left" />
                <span className="snowman-eye right" />
                <span className="snowman-nose" />
                <span className="snowman-scarf" />
                <span className="snowman-hat" />
              </div>
            </div>
          </div>
          <div className="snow-footer">
            <div className="snow-footer-card">
            </div>
          </div>
        </div>

        </div>
      )}
      
      {/* Floating Neon Particles */}
      <div className="absolute inset-0 pointer-events-none">
        <NeonParticle delay={0} color="#00FFFF" />
        <NeonParticle delay={2} color="#FF00C8" />
        <NeonParticle delay={4} color="#00B8FF" />
        <NeonParticle delay={1} color="#FFC93C" />
        <NeonParticle delay={3} color="#FF00C8" />
        <NeonParticle delay={5} color="#00FFFF" />
      </div>

      {/* Light Streaks Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-1 h-full bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent transform rotate-12 animate-pulse" />
        <div className="absolute top-0 right-1/3 w-1 h-full bg-gradient-to-b from-transparent via-pink-400/20 to-transparent transform -rotate-12 animate-pulse" />
        <div className="absolute top-1/3 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-400/20 to-transparent animate-pulse" />
      </div>

      <div className="relative z-20 max-w-7xl mx-auto px-5 py-3">
        <div className="mb-6 flex justify-center">
          <Link
            to="/trollstown"
            className="w-full max-w-3xl rounded-3xl border border-purple-500/50 bg-gradient-to-r from-purple-900/40 via-fuchsia-900/40 to-green-900/40 px-4 py-4 text-center backdrop-blur-sm shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:shadow-[0_0_25px_rgba(168,85,247,0.6)] transition-all duration-300 group relative overflow-hidden home-outline-rgb"
          >
            {/* Neon Glow Effects */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-green-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse" />
            
            <div className="relative z-10 flex flex-col items-center justify-center gap-1">
               <h3 className="text-xl sm:text-2xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-300 to-green-300 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
                 Welcome to Trolls Town
               </h3>
               <p className="text-xs sm:text-sm font-semibold text-purple-200 tracking-wide group-hover:text-white transition-colors">
                 Enter Troll Town &middot; Own Homes &middot; Upgrade &middot; Sell
               </p>
            </div>

            {/* Moving shine effect */}
            <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
          </Link>
        </div>
        {/* Live Now */}
        <section className="mb-8 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <div className="mb-8">
            <TrollPassBanner />
          </div>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-4 h-4">
                  <div className="absolute inset-0 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
                  <div className="w-2 h-2 bg-red-600 rounded-full" />
                </div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Live Now</h2>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-400/30 backdrop-blur-sm">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-cyan-400 tracking-wide">Auto-updating</span>
              </div>
            </div>

            {/* Mobile Go Live Button */}
            <div className="md:hidden">
              {canGoLive && (
                <Link
                  to="/go-live"
                  className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-full hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30 flex items-center gap-2"
                >
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  GO LIVE
                </Link>
              )}
            </div>
          </div>

          {showCategoryRow && (
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white tracking-tight">Browse Categories</h2>
                {selectedCategory !== 'All' && (
                  <button
                    onClick={() => setSelectedCategory('All')}
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    Clear filter
                  </button>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {availableCategories.map((category) => {
                  const isActive = selectedCategory === category;
                  return (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 ${
                        isActive
                          ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/40 scale-105'
                          : 'bg-gradient-to-r from-[#1A1A2E] to-[#0F0820] text-gray-300 border border-purple-500/30 hover:border-purple-400/60 hover:text-white hover:shadow-lg hover:shadow-purple-500/20'
                      }`}
                    >
                      {category}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="relative rounded-3xl bg-gradient-to-br from-[#1a0f2e]/40 to-[#0d0820]/20 backdrop-blur-xl border border-purple-500/20 p-6 shadow-lg space-y-4 home-live-wrapper home-outline-rgb">
            {isHolidaySeason && <ChristmasOutline rowCount={6} colCount={3} />}
            {loadingLive ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 stream-grid" style={{ minHeight: '400px' }}>
                {Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} className="flex gap-2 p-1 rounded-lg bg-[#1f1535]/50 animate-pulse border border-purple-500/10 h-8 items-center">
                    <div className="w-[20px] h-[20px] bg-purple-500/10 rounded-sm ml-1" />
                    <div className="flex-1 space-y-1 py-1 min-w-0">
                      <div className="h-1.5 w-3/4 bg-purple-500/10 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayStreams.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3 stream-grid" style={{ minHeight: '400px' }}>
                {displayStreams.map((s) => {
                  const isOfficer = profile?.role === 'admin' || profile?.role === 'lead_troll_officer' || profile?.role === 'troll_officer' || profile?.is_admin || profile?.is_lead_officer || profile?.is_troll_officer;
                  
                  const handleEndStream = async (e: React.MouseEvent, streamId: string) => {
                    e.stopPropagation();
                    if (!confirm('End this stream?')) return;
                    try {
                      await supabase.from('streams').update({ status: 'ended', is_live: false, ended_at: new Date().toISOString() }).eq('id', streamId);
                      toast.success('Stream ended');
                    } catch (err) {
                      console.error('Failed to end stream:', err);
                      toast.error('Failed to end stream');
                    }
                  };
                  
                  return (
                  <div
                    key={s.id}
                    className="relative flex flex-col items-center gap-1.5 transition-all duration-300 group cursor-pointer"
                    onClick={() => navigate(`/live/${s.id}`, { state: { streamData: { ...s, status: 'live' } } })}
                  >
                    <div className={`relative w-10 h-10 rounded-lg overflow-hidden border-2 transition-all duration-300 ${
                      s.user_profiles?.date_of_birth && isBirthdayToday(s.user_profiles.date_of_birth)
                        ? 'border-yellow-400 shadow-[0_0_15px_rgba(255,215,0,0.5)]'
                        : 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] group-hover:shadow-[0_0_20px_rgba(239,68,68,0.6)]'
                    }`}>
                      {s.category === 'Officer Stream' ? (
                         <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                           <Shield className="w-5 h-5 text-blue-400" />
                         </div>
                      ) : (
                        <img
                          src={s.user_profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.user_profiles?.username || 'troll'}`}
                          className="w-full h-full object-cover"
                          alt="Stream"
                        />
                      )}
                      <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50 flex items-center justify-center border border-[#0F0820]" />
                      {isOfficer && (
                        <button
                          onClick={(e) => handleEndStream(e, s.id)}
                          className="absolute -top-1 -left-1 w-4 h-4 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          title="End Stream"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col items-center gap-0.5 min-w-0 w-full">
                      <p className="text-[10px] font-bold text-white truncate w-full text-center leading-tight">{s.title || 'Untitled'}</p>
                      <p className="text-[9px] text-gray-400 truncate w-full text-center leading-tight">{s.user_profiles?.username}</p>
                      <div className="flex items-center gap-0.5">
                         <span className="text-[9px]">👁</span>
                         <span className="text-[9px] font-semibold text-cyan-400">{s.current_viewers || 0}</span>
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>
            )}

            {showCategoryEmpty && (
              <div className="rounded-2xl border border-[#2C2C3A] bg-[#0A0811] p-6 text-center text-gray-300">
                <p>No live streams in {selectedCategory} right now.</p>
                <button
                  onClick={() => setSelectedCategory('All')}
                  className="mt-4 px-5 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full text-sm font-semibold text-white shadow-lg"
                >
                  View all categories
                </button>
              </div>
            )}

            {!hasLiveData && <EmptyStateLiveNow />}
          </div>
        </section>

        {/* Mobile Go Live Button (Under Live Now) */}
        <div className="md:hidden mb-8 px-4">
          {canGoLive && (
            <Link
              to="/go-live"
              className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              GO LIVE NOW
            </Link>
          )}
        </div>

        {/* New Trollerz - dY"` Step 4: Use visibility pattern */}
        <div className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
          <div className="relative bg-gradient-to-br from-[#1a0f2e]/40 to-[#0d0820]/20 backdrop-blur-xl rounded-3xl p-8 border border-purple-500/20 shadow-lg home-outline-rgb">
            {isHolidaySeason && <ChristmasOutline rowCount={6} colCount={3} />}
            <div className="flex items-center gap-3 mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg opacity-75 blur" />
                <div className="relative bg-black px-3 py-1 rounded-lg">
                  <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">NEW</span>
                </div>
              </div>
              <h2 className="text-3xl font-bold text-white">Trollerz</h2>
              <span className="ml-auto text-sm font-semibold text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full">{newUsers.length} members</span>
            </div>
            <div className="new-trollerz-scroll" style={{ maxHeight: '480px', overflowY: 'auto' }}>
              {loadingUsers ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <UserCardSkeleton key={i} />
                  ))}
                </div>
              ) : newUsers.length === 0 ? (
                <div className="col-span-full p-6 text-center text-gray-400">No new users yet</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {newUsers.map((user) => (
                    <NewUserCard
                      key={user.id}
                      user={user}
                      onClick={navigate}
                      isLive={liveUsers.get(user.id) || false}
                    />
                  ))}
                </div>
              )}
            </div>
    
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-gray-400 text-sm">
            © {new Date().getFullYear()} Troll City. All rights reserved.
          </div>
        </div>
        
        {/* Neon glow styles for live users */}
        <style>{`
          .live-user-neon {
            animation: liveNeonGlow 2s ease-in-out infinite alternate;
          }
          @keyframes liveNeonGlow {
            0% {
              box-shadow: 0 0 20px rgba(255, 0, 100, 0.8), 0 0 40px rgba(255, 0, 100, 0.6), 0 0 60px rgba(255, 0, 100, 0.4);
            }
            100% {
              box-shadow: 0 0 30px rgba(255, 0, 150, 1), 0 0 50px rgba(255, 0, 150, 0.8), 0 0 70px rgba(255, 0, 150, 0.6);
            }
          }
        `}</style>
      </div>
    </div>
  );
};

// 🔑 Step 7: Memoize HomePage to prevent unnecessary re-renders
export default memo(HomePageContent);
