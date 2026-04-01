import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Mic, MicOff, Settings, Users, Clock, Shield, Zap, Radio, Music, Bell, BellOff, Sliders } from 'lucide-react';
import { supabase, searchUsers } from '../../lib/supabase';
import type { BroadcastAudioSettings, StreamAudioMode } from '../../types/liveStreaming';

// ─── Props ────────────────────────────────────────────────────────────────────

interface BroadcastAudioControlsProps {
  streamId: string;
  broadcasterId: string;
  onSave?: (settings: BroadcastAudioSettings) => void;
}

// ─── Local types ──────────────────────────────────────────────────────────────

interface MutedUser {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface UserSearchResult {
  id: string;
  username: string;
  avatar_url: string | null;
}

type QueueBehavior = 'drop_oldest' | 'drop_lowest' | 'reject_new';

// ─── Constants ────────────────────────────────────────────────────────────────

const STREAM_MODES: { value: StreamAudioMode; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'silent',
    label: 'Silent',
    description: 'No audio announcements',
    icon: <VolumeX className="w-4 h-4" />,
  },
  {
    value: 'standard',
    label: 'Standard',
    description: 'Basic announcements only',
    icon: <Bell className="w-4 h-4" />,
  },
  {
    value: 'premium',
    label: 'Premium',
    description: 'Full announcements with custom audio',
    icon: <Music className="w-4 h-4" />,
  },
  {
    value: 'hype',
    label: 'Hype',
    description: 'Everything + enhanced effects',
    icon: <Zap className="w-4 h-4" />,
  },
];

const QUEUE_BEHAVIORS: { value: QueueBehavior; label: string; description: string }[] = [
  { value: 'drop_oldest', label: 'Drop Oldest', description: 'Remove the oldest item when queue is full' },
  { value: 'drop_lowest', label: 'Drop Lowest Priority', description: 'Remove the lowest priority item when queue is full' },
  { value: 'reject_new', label: 'Reject New', description: 'Reject incoming items when queue is full' },
];

// ─── Toggle Switch Component ─────────────────────────────────────────────────

function ToggleSwitch({
  enabled,
  onChange,
  disabled = false,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full transition-colors
        ${enabled ? 'bg-purple-600' : 'bg-zinc-700'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`
          inline-block h-4 w-4 rounded-full bg-white shadow
          ${enabled ? 'ml-6' : 'ml-1'}
        `}
      />
    </button>
  );
}

// ─── Range Slider Component ──────────────────────────────────────────────────

function RangeSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  unit = '',
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
  unit?: string;
}) {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">{label}</span>
          <span className="text-white font-semibold bg-zinc-800 px-2 py-0.5 rounded">
            {value}{unit}
          </span>
        </div>
      )}
      <div className="relative">
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg border-2 border-purple-500 pointer-events-none"
          style={{ left: `calc(${percent}% - 8px)` }}
        />
      </div>
    </div>
  );
}

// ─── Section Card Component ──────────────────────────────────────────────────

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 backdrop-blur-sm p-4 space-y-3"
    >
      <div className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
        {icon}
        {title}
      </div>
      {children}
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BroadcastAudioControls({
  streamId,
  broadcasterId,
  onSave,
}: BroadcastAudioControlsProps) {
  // ── Settings state ──
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [customAudioEnabled, setCustomAudioEnabled] = useState(true);
  const [minLevelVoice, setMinLevelVoice] = useState(200);
  const [minLevelCustom, setMinLevelCustom] = useState(200);
  const [cooldownSeconds, setCooldownSeconds] = useState(5);
  const [maxQueueSize, setMaxQueueSize] = useState(10);
  const [queueBehavior, setQueueBehavior] = useState<QueueBehavior>('drop_oldest');
  const [streamMode, setStreamMode] = useState<StreamAudioMode>('standard');
  const [mutedUsers, setMutedUsers] = useState<MutedUser[]>([]);

  // ── UI state ──
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // ── Load existing settings ──
  const loadSettings = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('broadcast_audio_settings')
        .select('*')
        .eq('stream_id', streamId)
        .maybeSingle();

      if (data) {
        setVoiceEnabled(data.voice_enabled ?? true);
        setCustomAudioEnabled(data.custom_audio_enabled ?? true);
        setMinLevelVoice(data.min_level_for_voice ?? 200);
        setMinLevelCustom(data.min_level_for_custom ?? 200);
        setCooldownSeconds(data.cooldown_seconds ?? 5);
        setMaxQueueSize(data.max_queue_size ?? 10);
        setStreamMode((data.stream_mode as StreamAudioMode) ?? 'standard');

        if (data.muted_users && data.muted_users.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url')
            .in('id', data.muted_users);

          if (profiles) {
            setMutedUsers(
              profiles.map((p: any) => ({
                id: p.id,
                username: p.username,
                avatar_url: p.avatar_url,
              }))
            );
          }
        }
      }
    } catch (err) {
      console.warn('[BroadcastAudioControls] Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, [streamId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ── Search users ──
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const results = await searchUsers({ query, limit: 10 });
      const mutedIds = new Set(mutedUsers.map((u) => u.id));
      setSearchResults(
        results
          .filter((r) => !mutedIds.has(r.id) && r.id !== broadcasterId)
          .map((r) => ({ id: r.id, username: r.username, avatar_url: r.avatar_url ?? null }))
      );
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [mutedUsers, broadcasterId]);

  // ── Mute user ──
  const handleMuteUser = (user: UserSearchResult) => {
    setMutedUsers((prev) => [...prev, { id: user.id, username: user.username, avatar_url: user.avatar_url }]);
    setSearchResults((prev) => prev.filter((r) => r.id !== user.id));
    setSearchQuery('');
    setShowSearch(false);
  };

  // ── Unmute user ──
  const handleUnmuteUser = (userId: string) => {
    setMutedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  // ── Save settings ──
  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    const settings: BroadcastAudioSettings = {
      stream_id: streamId,
      voice_enabled: voiceEnabled,
      custom_audio_enabled: customAudioEnabled,
      min_level_for_voice: minLevelVoice,
      min_level_for_custom: minLevelCustom,
      cooldown_seconds: cooldownSeconds,
      max_queue_size: maxQueueSize,
      stream_mode: streamMode,
      muted_users: mutedUsers.map((u) => u.id),
    };

    try {
      const { error } = await supabase
        .from('broadcast_audio_settings')
        .upsert(settings, { onConflict: 'stream_id' });

      if (error) throw error;

      setSaved(true);
      onSave?.(settings);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('[BroadcastAudioControls] Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="bg-zinc-900/90 backdrop-blur-md rounded-xl border border-zinc-800 p-8 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Settings className="w-6 h-6 text-zinc-500" />
        </motion.div>
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="bg-zinc-900/90 backdrop-blur-md rounded-xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="border-b border-zinc-800 px-4 py-3 flex items-center gap-2">
        <Radio className="w-5 h-5 text-purple-400" />
        <span className="text-sm font-semibold text-white">Broadcast Audio Controls</span>
      </div>

      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        {/* A. Voice Features Toggle */}
        <SectionCard
          title="Voice Announcements"
          icon={<Mic className="w-4 h-4 text-green-400" />}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 mr-3">
              <div className="text-sm text-white flex items-center gap-2">
                {voiceEnabled ? (
                  <Mic className="w-4 h-4 text-green-400" />
                ) : (
                  <MicOff className="w-4 h-4 text-zinc-500" />
                )}
                Voice Announcements
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Enable text-to-speech announcements when users join the stream
              </p>
            </div>
            <ToggleSwitch enabled={voiceEnabled} onChange={setVoiceEnabled} />
          </div>
        </SectionCard>

        {/* B. Custom Audio Toggle */}
        <SectionCard
          title="Custom Entrance Audio"
          icon={<Music className="w-4 h-4 text-pink-400" />}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 mr-3">
              <div className="text-sm text-white flex items-center gap-2">
                {customAudioEnabled ? (
                  <Volume2 className="w-4 h-4 text-pink-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-zinc-500" />
                )}
                Custom Entrance Audio
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Allow users to play their custom entrance audio when joining
              </p>
            </div>
            <ToggleSwitch enabled={customAudioEnabled} onChange={setCustomAudioEnabled} />
          </div>
        </SectionCard>

        {/* C. Minimum Level Controls */}
        <SectionCard
          title="Minimum Level Controls"
          icon={<Sliders className="w-4 h-4 text-blue-400" />}
        >
          <div className="space-y-4">
            <RangeSlider
              value={minLevelVoice}
              onChange={setMinLevelVoice}
              min={0}
              max={1000}
              step={10}
              label="Min Level for Voice Announcements"
            />
            <RangeSlider
              value={minLevelCustom}
              onChange={setMinLevelCustom}
              min={0}
              max={1000}
              step={10}
              label="Min Level for Custom Audio"
            />
          </div>
        </SectionCard>

        {/* D. Cooldown Settings */}
        <SectionCard
          title="Cooldown Settings"
          icon={<Clock className="w-4 h-4 text-orange-400" />}
        >
          <RangeSlider
            value={cooldownSeconds}
            onChange={setCooldownSeconds}
            min={1}
            max={30}
            step={1}
            label="Cooldown Between Audio Plays"
            unit="s"
          />
          <div className="flex items-center gap-2 mt-2">
            <div className="flex gap-0.5">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 w-1 rounded-full ${
                    i < cooldownSeconds ? 'bg-orange-400' : 'bg-zinc-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </SectionCard>

        {/* E. Queue Settings */}
        <SectionCard
          title="Queue Settings"
          icon={<Users className="w-4 h-4 text-cyan-400" />}
        >
          <RangeSlider
            value={maxQueueSize}
            onChange={setMaxQueueSize}
            min={1}
            max={20}
            step={1}
            label="Max Queue Size"
          />
          <div className="mt-3">
            <div className="text-xs text-zinc-400 mb-2">Queue Behavior When Full</div>
            <div className="space-y-1.5">
              {QUEUE_BEHAVIORS.map((behavior) => (
                <button
                  key={behavior.value}
                  onClick={() => setQueueBehavior(behavior.value)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors
                    ${queueBehavior === behavior.value
                      ? 'bg-cyan-500/20 border border-cyan-500/40'
                      : 'bg-zinc-800/50 border border-zinc-700/30 hover:bg-zinc-700/50'
                    }
                  `}
                >
                  <div
                    className={`
                      w-4 h-4 rounded-full border-2 flex items-center justify-center
                      ${queueBehavior === behavior.value ? 'border-cyan-400' : 'border-zinc-600'}
                    `}
                  >
                    {queueBehavior === behavior.value && (
                      <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-white">{behavior.label}</div>
                    <div className="text-[10px] text-zinc-400">{behavior.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* F. Stream Mode Selector */}
        <SectionCard
          title="Stream Mode"
          icon={<Radio className="w-4 h-4 text-purple-400" />}
        >
          <div className="space-y-1.5">
            {STREAM_MODES.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setStreamMode(mode.value)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
                  ${streamMode === mode.value
                    ? 'bg-purple-500/20 border border-purple-500/40'
                    : 'bg-zinc-800/50 border border-zinc-700/30 hover:bg-zinc-700/50'
                  }
                `}
              >
                <div
                  className={`
                    w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                    ${streamMode === mode.value ? 'border-purple-400' : 'border-zinc-600'}
                  `}
                >
                  {streamMode === mode.value && (
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                  )}
                </div>
                <div className={streamMode === mode.value ? 'text-purple-300' : 'text-zinc-400'}>
                  {mode.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white">{mode.label}</div>
                  <div className="text-[10px] text-zinc-400">{mode.description}</div>
                </div>
              </button>
            ))}
          </div>
        </SectionCard>

        {/* G. Muted Users List */}
        <SectionCard
          title="Muted Users"
          icon={<BellOff className="w-4 h-4 text-red-400" />}
        >
          {/* Search / Add */}
          <div className="relative">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/80 border border-zinc-700/50 text-sm text-zinc-300 hover:bg-zinc-700/80 transition-colors"
            >
              <Users className="w-4 h-4" />
              Mute a User
            </button>

            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="mt-2 space-y-2"
                >
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-purple-500"
                    autoFocus
                  />
                  {searching && (
                    <div className="text-xs text-zinc-500 px-1">Searching...</div>
                  )}
                  {searchResults.length > 0 && (
                    <div className="rounded-lg border border-zinc-700 bg-zinc-800 overflow-hidden max-h-40 overflow-y-auto">
                      {searchResults.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleMuteUser(user)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-700 transition-colors"
                        >
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt={user.username}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-zinc-600 flex items-center justify-center">
                              <Users className="w-3 h-3 text-zinc-400" />
                            </div>
                          )}
                          <span className="text-sm text-white">{user.username}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                    <div className="text-xs text-zinc-500 px-1">No users found</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Muted list */}
          {mutedUsers.length > 0 ? (
            <div className="space-y-1.5 mt-2">
              <AnimatePresence mode="popLayout">
                {mutedUsers.map((user) => (
                  <motion.div
                    key={user.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20"
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.username}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-zinc-600 flex items-center justify-center">
                        <Users className="w-3 h-3 text-zinc-400" />
                      </div>
                    )}
                    <span className="text-sm text-white flex-1 min-w-0 truncate">
                      {user.username}
                    </span>
                    <button
                      onClick={() => handleUnmuteUser(user.id)}
                      className="text-xs text-green-400 hover:text-green-300 font-medium transition-colors"
                    >
                      Unmute
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-xs text-zinc-500 text-center py-3">
              No muted users
            </div>
          )}
        </SectionCard>

        {/* H. Moderation */}
        <SectionCard
          title="Live Moderation"
          icon={<Shield className="w-4 h-4 text-yellow-400" />}
        >
          <p className="text-xs text-zinc-400">
            Use the Muted Users section above to disable specific users&apos; entrance audio during the live stream.
            Muted users will not be able to trigger voice announcements or custom audio.
          </p>
          <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <Shield className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            <span className="text-xs text-yellow-300">
              Quick mute: Search and add users above to instantly block their audio
            </span>
          </div>
        </SectionCard>
      </div>

      {/* Save button */}
      <div className="border-t border-zinc-800 p-4">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={saving}
          className={`
            w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors
            ${saving
              ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
              : saved
                ? 'bg-green-600 text-white'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500'
            }
          `}
        >
          {saving ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Settings className="w-4 h-4" />
              </motion.div>
              Saving...
            </>
          ) : saved ? (
            <>
              <Shield className="w-4 h-4" />
              Settings Saved
            </>
          ) : (
            <>
              <Settings className="w-4 h-4" />
              Save Audio Settings
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
