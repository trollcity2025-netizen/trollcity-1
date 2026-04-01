import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import DiamondAvatar from './DiamondAvatar';
import {
  getFrameForLevel,
  AUDIO_PRIORITY,
} from '../../types/liveStreaming';
import {
  Mic,
  Sparkles,
  Crown,
  Star,
  Trophy,
  ShoppingCart,
  Radio,
  Zap,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface JoinNotification {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  entranceEffectKey: string | null;
  badges: UserBadge[];
  priority: number;
  timestamp: number;
}

type UserBadge = 'event_winner' | 'top_broadcaster' | 'top_buyer' | 'level_1000' | 'level_500' | 'level_200';

interface PresenceUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  entrance_effect: string | null;
  badges: UserBadge[];
}

interface EnhancedJoinExperienceProps {
  streamId: string;
  isVisible: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const NOTIFICATION_DURATION = 4500;
const QUEUE_FLUSH_INTERVAL = 200;

const LEVEL_TIERS = {
  ELITE: 1000,
  HIGH: 500,
  MID: 200,
} as const;

// ============================================================================
// HELPERS
// ============================================================================

function getPriority(user: PresenceUser): number {
  if (user.badges.includes('event_winner')) return AUDIO_PRIORITY.EVENT_WINNER;
  if (user.badges.includes('top_broadcaster')) return AUDIO_PRIORITY.TOP_BROADCASTER;
  if (user.badges.includes('top_buyer')) return AUDIO_PRIORITY.TOP_BUYER;
  if (user.level >= LEVEL_TIERS.ELITE) return AUDIO_PRIORITY.LEVEL_1000_PLUS;
  if (user.level >= LEVEL_TIERS.MID) return AUDIO_PRIORITY.LEVEL_200_VOICE;
  return AUDIO_PRIORITY.DEFAULT;
}

function getAvatarSize(level: number): 'sm' | 'md' | 'lg' {
  if (level >= LEVEL_TIERS.ELITE) return 'lg';
  if (level >= LEVEL_TIERS.HIGH) return 'md';
  if (level >= LEVEL_TIERS.MID) return 'md';
  return 'sm';
}

function getBannerTier(level: number): 'elite' | 'high' | 'mid' | 'default' {
  if (level >= LEVEL_TIERS.ELITE) return 'elite';
  if (level >= LEVEL_TIERS.HIGH) return 'high';
  if (level >= LEVEL_TIERS.MID) return 'mid';
  return 'default';
}

function getVoiceAnnouncement(notification: JoinNotification): string | null {
  const { level, username, badges } = notification;

  if (badges.includes('event_winner')) {
    return `Event winner ${username} has entered the stream!`;
  }
  if (badges.includes('top_broadcaster')) {
    return `Top broadcaster ${username} has joined!`;
  }
  if (badges.includes('top_buyer')) {
    return `Top buyer has joined the stream!`;
  }
  if (level >= LEVEL_TIERS.ELITE) {
    return `Level ${level} user ${username} entered the stream`;
  }
  if (level >= LEVEL_TIERS.MID) {
    return `Level ${level} user has joined`;
  }
  return null;
}

function getBadgeConfig(badge: UserBadge) {
  switch (badge) {
    case 'event_winner':
      return { icon: Trophy, label: 'Event Winner', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    case 'top_broadcaster':
      return { icon: Radio, label: 'Top Broadcaster', color: 'text-purple-400', bg: 'bg-purple-500/20' };
    case 'top_buyer':
      return { icon: ShoppingCart, label: 'Top Buyer', color: 'text-green-400', bg: 'bg-green-500/20' };
    case 'level_1000':
      return { icon: Crown, label: 'Lvl 1000+', color: 'text-amber-400', bg: 'bg-amber-500/20' };
    case 'level_500':
      return { icon: Star, label: 'Lvl 500+', color: 'text-orange-400', bg: 'bg-orange-500/20' };
    case 'level_200':
      return { icon: Zap, label: 'Lvl 200+', color: 'text-cyan-400', bg: 'bg-cyan-500/20' };
    default:
      return { icon: Sparkles, label: '', color: 'text-white', bg: 'bg-white/10' };
  }
}

function getEntranceEffectIcon(effectKey: string | null): string | null {
  if (!effectKey) return null;
  const iconMap: Record<string, string> = {
    effect_queen_arrival: '👸',
    effect_apex_arrival: '👑',
    effect_kingpin_walk: '🕴️',
    effect_diamond_drop: '💎',
    effect_runway_light: '🔦',
    effect_thunder_crack: '⚡',
    effect_alpha_entry: '🦁',
    effect_crown_flicker: '👑',
    effect_master_mechanic: '👨‍🔧',
  };
  return iconMap[effectKey] ?? '✨';
}

// ============================================================================
// SPEECH SYNTHESIS
// ============================================================================

function speak(text: string, priority: number) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = priority >= AUDIO_PRIORITY.TOP_BUYER ? 1.1 : 1.0;
  utterance.volume = priority >= AUDIO_PRIORITY.LEVEL_1000_PLUS ? 1.0 : 0.8;

  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) => v.lang.startsWith('en') && v.name.includes('Google') && !v.name.includes('Female')
  ) || voices.find((v) => v.lang.startsWith('en'));
  if (preferred) utterance.voice = preferred;

  window.speechSynthesis.speak(utterance);
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function EntranceParticles({ tier }: { tier: 'elite' | 'high' | 'mid' | 'default' }) {
  const count = tier === 'elite' ? 20 : tier === 'high' ? 12 : tier === 'mid' ? 6 : 0;
  if (count === 0) return null;

  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 1.5 + Math.random() * 2,
    size: tier === 'elite' ? 6 + Math.random() * 8 : 3 + Math.random() * 5,
    emoji: ['✨', '💎', '⭐', '🌟'][Math.floor(Math.random() * 4)],
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: '100%', x: `${p.x}%`, opacity: 0, scale: 0 }}
          animate={{
            y: '-120%',
            opacity: [0, 1, 1, 0],
            scale: [0, 1.2, 1, 0.5],
            rotate: [0, 180, 360],
          }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut' }}
          className="absolute text-xs"
          style={{ fontSize: p.size }}
        >
          {p.emoji}
        </motion.div>
      ))}
    </div>
  );
}

function SpotlightSweep({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-y-0 w-24 -skew-x-12"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.3), transparent)',
        }}
        initial={{ left: '-10%' }}
        animate={{ left: '110%' }}
        transition={{ duration: 1.5, ease: 'easeInOut', delay: 0.3 }}
      />
    </motion.div>
  );
}

function ScreenFlash({ active, color }: { active: boolean; color: string }) {
  if (!active) return null;

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none rounded-2xl"
      initial={{ opacity: 0.7 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      style={{ background: color }}
    />
  );
}

// ============================================================================
// NOTIFICATION CARD
// ============================================================================

interface NotificationCardProps {
  notification: JoinNotification;
  onDismiss: () => void;
}

function NotificationCard({ notification, onDismiss }: NotificationCardProps) {
  const bannerTier = getBannerTier(notification.level);
  const avatarSize = getAvatarSize(notification.level);
  const entranceIcon = getEntranceEffectIcon(notification.entranceEffectKey);
  const voiceText = getVoiceAnnouncement(notification);
  const isElite = bannerTier === 'elite';
  const isHigh = bannerTier === 'high';
  const showSpotlight = isElite;
  const showFlash = notification.badges.some(
    (b) => b === 'top_buyer' || b === 'top_broadcaster' || b === 'event_winner'
  );

  const frameTier = getFrameForLevel(notification.level);

  const specialType: 'top_buyer' | 'top_broadcaster' | 'mvp' | null =
    notification.badges.includes('top_buyer') ? 'top_buyer' :
    notification.badges.includes('top_broadcaster') ? 'top_broadcaster' :
    null;

  useEffect(() => {
    const timer = setTimeout(onDismiss, NOTIFICATION_DURATION);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  useEffect(() => {
    if (voiceText && notification.level >= LEVEL_TIERS.MID) {
      const ttsDelay = setTimeout(() => {
        speak(voiceText, notification.priority);
      }, 500);
      return () => clearTimeout(ttsDelay);
    }
  }, [voiceText, notification.level, notification.priority]);

  const bannerStyles = {
    elite: 'w-full max-w-md border-2 border-amber-400/60 shadow-[0_0_40px_rgba(251,191,36,0.4)]',
    high: 'w-full max-w-sm border border-orange-400/40 shadow-[0_0_25px_rgba(249,115,22,0.3)]',
    mid: 'w-full max-w-xs border border-purple-400/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]',
    default: 'w-full max-w-[240px] border border-white/10',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -80, scale: 0.7, filter: 'blur(8px)' }}
      animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, x: 80, scale: 0.7, filter: 'blur(8px)' }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className={cn(
        'relative overflow-hidden rounded-2xl backdrop-blur-xl',
        'bg-gradient-to-r from-black/80 via-black/70 to-black/60',
        bannerStyles[bannerTier]
      )}
    >
      {/* Visual effects layer */}
      <EntranceParticles tier={bannerTier} />
      <SpotlightSweep active={showSpotlight} />
      <ScreenFlash
        active={showFlash}
        color={
          notification.badges.includes('event_winner')
            ? 'rgba(251,191,36,0.25)'
            : notification.badges.includes('top_broadcaster')
            ? 'rgba(168,85,247,0.2)'
            : 'rgba(34,197,94,0.2)'
        }
      />

      {/* Glow background for elite */}
      {isElite && (
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent pointer-events-none" />
      )}
      {isHigh && (
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/8 via-transparent to-transparent pointer-events-none" />
      )}

      {/* Content */}
      <div className="relative z-10 flex items-center gap-3 p-3">
        {/* Left: Diamond Avatar */}
        <div className="flex-shrink-0 relative">
          <DiamondAvatar
            avatarUrl={notification.avatarUrl || ''}
            username={notification.username}
            size={avatarSize}
            level={notification.level}
            specialType={specialType}
            isJoining
          />
          {frameTier.has_particles && (
            <motion.div
              className="absolute -top-1 -right-1"
              animate={{ rotate: 360, scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles size={14} className="text-amber-400" />
            </motion.div>
          )}
        </div>

        {/* Center: Username + Badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'font-bold truncate',
                isElite
                  ? 'text-lg bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent'
                  : isHigh
                  ? 'text-base bg-gradient-to-r from-orange-300 to-amber-200 bg-clip-text text-transparent'
                  : notification.level >= LEVEL_TIERS.MID
                  ? 'text-sm text-purple-200'
                  : 'text-sm text-white'
              )}
            >
              {notification.username}
            </span>
          </div>

          {/* Level badge */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                isElite
                  ? 'bg-amber-500/30 text-amber-300'
                  : isHigh
                  ? 'bg-orange-500/30 text-orange-300'
                  : notification.level >= LEVEL_TIERS.MID
                  ? 'bg-purple-500/30 text-purple-300'
                  : 'bg-white/10 text-white/60'
              )}
            >
              Lvl {notification.level}
            </span>

            {/* Status badges */}
            {notification.badges.slice(0, 2).map((badge) => {
              const config = getBadgeConfig(badge);
              const Icon = config.icon;
              return (
                <span
                  key={badge}
                  className={cn(
                    'flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                    config.bg,
                    config.color
                  )}
                >
                  <Icon size={10} />
                  {config.label}
                </span>
              );
            })}
          </div>

          {/* Voice-over text */}
          {voiceText && notification.level >= LEVEL_TIERS.MID && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={cn(
                'text-[10px] mt-1 italic',
                isElite ? 'text-amber-300/70' : 'text-white/40'
              )}
            >
              <Mic size={9} className="inline mr-1" />
              {voiceText}
            </motion.p>
          )}
        </div>

        {/* Right: Entrance effect icon */}
        {entranceIcon && (
          <motion.div
            className="flex-shrink-0"
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.2 }}
          >
            <span className={cn('text-2xl', isElite && 'text-3xl drop-shadow-lg')}>
              {entranceIcon}
            </span>
          </motion.div>
        )}
      </div>

      {/* Progress bar */}
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: NOTIFICATION_DURATION / 1000, ease: 'linear' }}
        className={cn(
          'absolute bottom-0 left-0 right-0 h-0.5',
          isElite
            ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400'
            : isHigh
            ? 'bg-gradient-to-r from-orange-400 to-amber-400'
            : notification.level >= LEVEL_TIERS.MID
            ? 'bg-gradient-to-r from-purple-400 to-pink-400'
            : 'bg-gradient-to-r from-white/30 to-white/10'
        )}
        style={{ transformOrigin: 'left' }}
      />
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EnhancedJoinExperience({ streamId, isVisible }: EnhancedJoinExperienceProps) {
  const [notifications, setNotifications] = useState<JoinNotification[]>([]);
  const queueRef = useRef<JoinNotification[]>([]);
  const shownUsersRef = useRef<Set<string>>(new Set());
  const previousUserIdsRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flushQueue = useCallback(() => {
    if (queueRef.current.length === 0) return;

    const batch = [...queueRef.current];
    queueRef.current = [];

    batch.sort((a, b) => b.priority - a.priority);

    setNotifications((prev) => {
      if (prev.length > 0) {
        queueRef.current.unshift(...batch);
        return prev;
      }
      return [batch[0]];
    });

    if (batch.length > 1) {
      queueRef.current.push(...batch.slice(1));
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setNotifications((prev) => prev.slice(1));
  }, []);

  // Process next in queue when notification list becomes empty
  useEffect(() => {
    if (notifications.length === 0 && queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      setNotifications([next]);
    }
  }, [notifications]);

  useEffect(() => {
    if (!streamId || !isVisible) return;

    flushTimerRef.current = setInterval(flushQueue, QUEUE_FLUSH_INTERVAL);

    const channel = supabase.channel(`room:${streamId}`, {
      config: { presence: { key: streamId } },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const currentUserIds = new Set<string>();

      Object.values(state).forEach((presences: any) => {
        presences.forEach((p: any) => {
          if (p.user_id) {
            currentUserIds.add(p.user_id);
          }
        });
      });

      currentUserIds.forEach((userId) => {
        if (!previousUserIdsRef.current.has(userId) && !shownUsersRef.current.has(userId)) {
          Object.values(state).forEach((presences: any) => {
            presences.forEach((p: any) => {
              if (p.user_id === userId) {
                shownUsersRef.current.add(userId);

                const presenceUser: PresenceUser = {
                  user_id: p.user_id,
                  username: p.username || 'Anonymous',
                  avatar_url: p.avatar_url || null,
                  level: p.level || 1,
                  entrance_effect: p.entrance_effect || null,
                  badges: p.badges || [],
                };

                const levelBadges: UserBadge[] = [];
                if (presenceUser.level >= LEVEL_TIERS.ELITE && !presenceUser.badges.includes('level_1000')) {
                  levelBadges.push('level_1000');
                }
                if (presenceUser.level >= LEVEL_TIERS.HIGH && !presenceUser.badges.includes('level_500')) {
                  levelBadges.push('level_500');
                }
                if (presenceUser.level >= LEVEL_TIERS.MID && !presenceUser.badges.includes('level_200')) {
                  levelBadges.push('level_200');
                }

                const allBadges = [...new Set([...presenceUser.badges, ...levelBadges])];

                const notification: JoinNotification = {
                  id: `${p.user_id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  userId: p.user_id,
                  username: presenceUser.username,
                  avatarUrl: presenceUser.avatar_url,
                  level: presenceUser.level,
                  entranceEffectKey: presenceUser.entrance_effect,
                  badges: allBadges,
                  priority: getPriority(presenceUser),
                  timestamp: Date.now(),
                };

                queueRef.current.push(notification);
              }
            });
          });
        }
      });

      previousUserIdsRef.current = currentUserIds;
    });

    channel.subscribe();

    return () => {
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current);
      }
      supabase.removeChannel(channel);
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [streamId, isVisible, flushQueue]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-20 left-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-md">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            onDismiss={handleDismiss}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
