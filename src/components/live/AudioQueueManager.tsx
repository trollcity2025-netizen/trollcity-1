import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import {
  BroadcastAudioSettings,
  AudioQueueStatus,
  AUDIO_PRIORITY,
} from '../../types/liveStreaming';
import {
  Volume2,
  VolumeX,
  SkipForward,
  Clock,
  AlertTriangle,
  Users,
  Crown,
  Star,
  Zap,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface EnqueuedAudio {
  id: string;
  userId: string;
  displayName: string;
  audioType: 'custom' | 'voice_over' | 'system';
  audioUrl: string | null;
  voiceText: string | null;
  priority: number;
  status: AudioQueueStatus;
  enqueuedAt: number;
  groupId: string | null;
}

interface CooldownEntry {
  userId: string;
  expiresAt: number;
}

interface AudioQueueManagerProps {
  streamId: string;
  settings: BroadcastAudioSettings;
  onQueueUpdate?: (queueLength: number) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COMPRESSION_WINDOW_MS = 2000;
const STALE_ITEM_MAX_AGE_MS = 30_000;
const CLEANUP_INTERVAL_MS = 5000;
const QUEUE_POLL_INTERVAL_MS = 250;
const INDICATOR_PREVIEW_COUNT = 3;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AudioQueueManager({
  streamId,
  settings,
  onQueueUpdate,
}: AudioQueueManagerProps) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [queue, setQueue] = useState<EnqueuedAudio[]>([]);
  const [currentItem, setCurrentItem] = useState<EnqueuedAudio | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDuringImportantMoment, setIsDuringImportantMoment] = useState(false);

  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------

  const queueRef = useRef<EnqueuedAudio[]>([]);
  const cooldownsRef = useRef<Map<string, CooldownEntry>>(new Map());
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isProcessingRef = useRef(false);
  const compressionBufferRef = useRef<EnqueuedAudio[]>([]);
  const compressionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const queueLength = queue.length;
  const previewItems = useMemo(() => queue.slice(0, INDICATOR_PREVIEW_COUNT), [queue]);

  // ---------------------------------------------------------------------------
  // Notify parent of queue changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    onQueueUpdate?.(queueLength);
  }, [queueLength, onQueueUpdate]);

  // ---------------------------------------------------------------------------
  // Cooldown helpers
  // ---------------------------------------------------------------------------

  const isInCooldown = useCallback(
    (userId: string): boolean => {
      const entry = cooldownsRef.current.get(userId);
      if (!entry) return false;
      if (Date.now() > entry.expiresAt) {
        cooldownsRef.current.delete(userId);
        return false;
      }
      return true;
    },
    []
  );

  const setCooldown = useCallback(
    (userId: string) => {
      cooldownsRef.current.set(userId, {
        userId,
        expiresAt: Date.now() + settings.cooldown_seconds * 1000,
      });
    },
    [settings.cooldown_seconds]
  );

  // ---------------------------------------------------------------------------
  // Priority icon helper
  // ---------------------------------------------------------------------------

  const getPriorityIcon = useCallback((priority: number) => {
    if (priority >= AUDIO_PRIORITY.EVENT_WINNER) return <Crown size={12} className="text-yellow-400" />;
    if (priority >= AUDIO_PRIORITY.TOP_BROADCASTER) return <Star size={12} className="text-purple-400" />;
    if (priority >= AUDIO_PRIORITY.TOP_BUYER) return <Zap size={12} className="text-green-400" />;
    if (priority >= AUDIO_PRIORITY.LEVEL_1000_PLUS) return <Crown size={12} className="text-amber-400" />;
    if (priority >= AUDIO_PRIORITY.LEVEL_200_CUSTOM) return <Star size={12} className="text-cyan-400" />;
    if (priority >= AUDIO_PRIORITY.LEVEL_200_VOICE) return <Users size={12} className="text-purple-300" />;
    return <Users size={12} className="text-white/50" />;
  }, []);

  // ---------------------------------------------------------------------------
  // Queue state sync
  // ---------------------------------------------------------------------------

  const syncQueueState = useCallback(() => {
    setQueue([...queueRef.current]);
  }, []);

  // ---------------------------------------------------------------------------
  // Insert into priority queue
  // ---------------------------------------------------------------------------

  const insertByPriority = useCallback(
    (item: EnqueuedAudio) => {
      const q = queueRef.current;
      let inserted = false;
      for (let i = 0; i < q.length; i++) {
        if (item.priority > q[i].priority) {
          q.splice(i, 0, item);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        q.push(item);
      }

      // Drop lowest priority if over max queue size
      while (q.length > settings.max_queue_size) {
        const dropped = q.pop();
        if (dropped) {
          dropped.status = 'dropped';
        }
      }

      syncQueueState();
    },
    [settings.max_queue_size, syncQueueState]
  );

  // ---------------------------------------------------------------------------
  // Compression: group low-priority joins
  // ---------------------------------------------------------------------------

  const flushCompressionBuffer = useCallback(() => {
    const buffer = compressionBufferRef.current;
    compressionBufferRef.current = [];
    compressionTimerRef.current = null;

    if (buffer.length === 0) return;

    if (buffer.length === 1) {
      insertByPriority(buffer[0]);
      return;
    }

    // Create a compressed group announcement
    const highestPriority = Math.max(...buffer.map((b) => b.priority));
    const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const userNames = buffer.map((b) => b.displayName);
    const displayText =
      userNames.length <= 3
        ? `${userNames.join(', ')} joined`
        : `${buffer.length} new viewers joined`;

    const compressed: EnqueuedAudio = {
      id: groupId,
      userId: 'system',
      displayName: displayText,
      audioType: 'voice_over',
      audioUrl: null,
      voiceText: displayText,
      priority: highestPriority,
      status: 'queued',
      enqueuedAt: Date.now(),
      groupId,
    };

    // Mark originals with groupId
    buffer.forEach((b) => {
      b.groupId = groupId;
    });

    insertByPriority(compressed);
  }, [insertByPriority]);

  const addToCompressionBuffer = useCallback(
    (item: EnqueuedAudio) => {
      compressionBufferRef.current.push(item);

      if (compressionTimerRef.current) {
        clearTimeout(compressionTimerRef.current);
      }

      compressionTimerRef.current = setTimeout(flushCompressionBuffer, COMPRESSION_WINDOW_MS);
    },
    [flushCompressionBuffer]
  );

  // ---------------------------------------------------------------------------
  // Enqueue audio item
  // ---------------------------------------------------------------------------

  const enqueueAudio = useCallback(
    (item: EnqueuedAudio) => {
      // Check if muted globally
      if (isMuted) return;

      // Check if user is muted by broadcaster
      if (settings.muted_users.includes(item.userId)) return;

      // Check per-user cooldown
      if (item.userId !== 'system' && isInCooldown(item.userId)) return;

      // Check broadcast awareness
      if (isDuringImportantMoment && item.priority < AUDIO_PRIORITY.EVENT_WINNER) return;

      // Low-priority items go through compression
      if (item.priority < AUDIO_PRIORITY.LEVEL_200_VOICE) {
        addToCompressionBuffer(item);
        return;
      }

      // High-priority items go directly into the queue
      insertByPriority(item);
    },
    [
      isMuted,
      settings.muted_users,
      isInCooldown,
      isDuringImportantMoment,
      addToCompressionBuffer,
      insertByPriority,
    ]
  );

  // ---------------------------------------------------------------------------
  // Audio playback
  // ---------------------------------------------------------------------------

  const playCustomAudio = useCallback(
    (item: EnqueuedAudio): Promise<void> => {
      return new Promise((resolve) => {
        if (!item.audioUrl) {
          resolve();
          return;
        }

        const audio = new Audio(item.audioUrl);
        audioElementRef.current = audio;
        audio.volume = 1.0;

        audio.onended = () => {
          audioElementRef.current = null;
          resolve();
        };

        audio.onerror = () => {
          audioElementRef.current = null;
          resolve();
        };

        audio.play().catch(() => {
          audioElementRef.current = null;
          resolve();
        });
      });
    },
    []
  );

  const playVoiceOver = useCallback(
    (item: EnqueuedAudio): Promise<void> => {
      return new Promise((resolve) => {
        if (!item.voiceText || typeof window === 'undefined' || !window.speechSynthesis) {
          resolve();
          return;
        }

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(item.voiceText);
        utterance.rate = 0.95;
        utterance.pitch = item.priority >= AUDIO_PRIORITY.TOP_BUYER ? 1.1 : 1.0;
        utterance.volume = item.priority >= AUDIO_PRIORITY.LEVEL_1000_PLUS ? 1.0 : 0.8;

        const voices = window.speechSynthesis.getVoices();
        const preferred =
          voices.find(
            (v) =>
              v.lang.startsWith('en') &&
              v.name.includes('Google') &&
              !v.name.includes('Female')
          ) || voices.find((v) => v.lang.startsWith('en'));
        if (preferred) utterance.voice = preferred;

        currentUtteranceRef.current = utterance;

        utterance.onend = () => {
          currentUtteranceRef.current = null;
          resolve();
        };

        utterance.onerror = () => {
          currentUtteranceRef.current = null;
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      });
    },
    []
  );

  const playItem = useCallback(
    async (item: EnqueuedAudio) => {
      setCurrentItem(item);
      setIsPlaying(true);
      item.status = 'playing';
      syncQueueState();

      if (item.audioType === 'custom' && item.audioUrl) {
        await playCustomAudio(item);
      } else if (item.audioType === 'voice_over' && item.voiceText) {
        await playVoiceOver(item);
      }

      item.status = 'played';
      setCooldown(item.userId);
      setIsPlaying(false);
      setCurrentItem(null);
      syncQueueState();
    },
    [playCustomAudio, playVoiceOver, setCooldown, syncQueueState]
  );

  // ---------------------------------------------------------------------------
  // Queue processor
  // ---------------------------------------------------------------------------

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    if (isMuted) return;
    if (isDuringImportantMoment) return;

    const next = queueRef.current.find((item) => item.status === 'queued');
    if (!next) return;

    isProcessingRef.current = true;

    queueRef.current = queueRef.current.filter((item) => item.id !== next.id);
    syncQueueState();

    await playItem(next);

    isProcessingRef.current = false;
  }, [isMuted, isDuringImportantMoment, playItem, syncQueueState]);

  // ---------------------------------------------------------------------------
  // Queue polling
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const interval = setInterval(processQueue, QUEUE_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [processQueue]);

  // ---------------------------------------------------------------------------
  // Cleanup stale items
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      const before = queueRef.current.length;
      queueRef.current = queueRef.current.filter(
        (item) => now - item.enqueuedAt < STALE_ITEM_MAX_AGE_MS
      );
      if (queueRef.current.length !== before) {
        syncQueueState();
      }
    }, CLEANUP_INTERVAL_MS);

    return () => clearInterval(cleanup);
  }, [syncQueueState]);

  // ---------------------------------------------------------------------------
  // Cleanup compression timer on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (compressionTimerRef.current) {
        clearTimeout(compressionTimerRef.current);
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Skip current item
  // ---------------------------------------------------------------------------

  const handleSkip = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    if (currentUtteranceRef.current && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      currentUtteranceRef.current = null;
    }
    setIsPlaying(false);
    setCurrentItem(null);
    isProcessingRef.current = false;
  }, []);

  // ---------------------------------------------------------------------------
  // Toggle mute
  // ---------------------------------------------------------------------------

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      if (!prev) {
        // Muting: stop current playback
        handleSkip();
      }
      return !prev;
    });
  }, [handleSkip]);

  // ---------------------------------------------------------------------------
  // Skip a queued item by id
  // ---------------------------------------------------------------------------

  const handleSkipQueued = useCallback(
    (id: string) => {
      const item = queueRef.current.find((i) => i.id === id);
      if (item) {
        item.status = 'skipped';
      }
      queueRef.current = queueRef.current.filter((i) => i.id !== id);
      syncQueueState();
    },
    [syncQueueState]
  );

  // ---------------------------------------------------------------------------
  // Public API: expose enqueueAudio via imperative handle or callback
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Listen for join events on the stream channel
    const channel = supabase.channel(`audio-queue:${streamId}`);

    channel.on('broadcast', { event: 'audio-announce' }, (payload: any) => {
      const { userId, displayName, audioType, audioUrl, voiceText, priority } = payload;

      const item: EnqueuedAudio = {
        id: `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId,
        displayName: displayName || 'Anonymous',
        audioType: audioType || 'voice_over',
        audioUrl: audioUrl || null,
        voiceText: voiceText || null,
        priority: priority ?? AUDIO_PRIORITY.DEFAULT,
        status: 'queued',
        enqueuedAt: Date.now(),
        groupId: null,
      };

      enqueueAudio(item);
    });

    channel.on('broadcast', { event: 'stream-moment' }, (payload: any) => {
      setIsDuringImportantMoment(payload.important === true);
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, enqueueAudio]);

  // ---------------------------------------------------------------------------
  // Render: Queue indicator overlay
  // ---------------------------------------------------------------------------

  return (
    <div className="fixed bottom-4 right-4 z-[90] pointer-events-auto">
      <motion.div
        layout
        className="relative flex flex-col items-end gap-1.5"
      >
        {/* Expanded queue list */}
        <AnimatePresence>
          {isExpanded && queueLength > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="mb-1 w-64 rounded-xl bg-black/85 backdrop-blur-xl border border-white/10 shadow-lg overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
                <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                  Audio Queue
                </span>
                <span className="text-[10px] text-white/40">
                  {queueLength} item{queueLength !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto">
                {queue.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: index * 0.03 }}
                    className="flex items-center gap-2 px-3 py-2 border-b border-white/5 last:border-b-0 hover:bg-white/5 group"
                  >
                    <span className="text-white/30 text-[10px] font-mono w-4 text-right">
                      {index + 1}
                    </span>
                    {getPriorityIcon(item.priority)}
                    <span className="flex-1 text-xs text-white/80 truncate">
                      {item.displayName}
                    </span>
                    <span className="text-[10px] text-white/30 font-mono">
                      {item.priority}
                    </span>
                    <button
                      onClick={() => handleSkipQueued(item.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10"
                      title="Remove from queue"
                    >
                      <SkipForward size={12} className="text-white/40 hover:text-white/70" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main indicator bar */}
        <motion.div
          layout
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 shadow-lg min-w-[200px]"
        >
          {/* Currently playing */}
          {currentItem && isPlaying ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 flex-1 min-w-0"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Volume2 size={14} className="text-green-400 flex-shrink-0" />
              </motion.div>
              <span className="text-xs text-white/80 truncate">
                {currentItem.displayName}
              </span>
              {getPriorityIcon(currentItem.priority)}
            </motion.div>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isMuted ? (
                <VolumeX size={14} className="text-red-400 flex-shrink-0" />
              ) : (
                <Volume2 size={14} className="text-white/40 flex-shrink-0" />
              )}
              <span className="text-xs text-white/40">
                {isMuted ? 'Muted' : isDuringImportantMoment ? 'Paused' : 'Audio Queue'}
              </span>
            </div>
          )}

          {/* Queue count badge */}
          {queueLength > 0 && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsExpanded((prev) => !prev)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/10 hover:bg-white/15 transition-colors"
            >
              <Clock size={10} className="text-white/50" />
              <span className="text-[10px] font-semibold text-white/70">{queueLength}</span>
            </motion.button>
          )}

          {/* Important moment indicator */}
          {isDuringImportantMoment && (
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <AlertTriangle size={12} className="text-amber-400" />
            </motion.div>
          )}

          {/* Control buttons */}
          <div className="flex items-center gap-0.5">
            {currentItem && isPlaying && (
              <button
                onClick={handleSkip}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                title="Skip current"
              >
                <SkipForward size={14} className="text-white/60 hover:text-white/90" />
              </button>
            )}
            <button
              onClick={handleToggleMute}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              title={isMuted ? 'Unmute all' : 'Mute all'}
            >
              {isMuted ? (
                <VolumeX size={14} className="text-red-400" />
              ) : (
                <Volume2 size={14} className="text-white/60 hover:text-white/90" />
              )}
            </button>
          </div>
        </motion.div>

        {/* Preview of next items (compact) */}
        {!isExpanded && previewItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1.5 px-2"
          >
            {previewItems.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/5 border border-white/5"
              >
                {getPriorityIcon(item.priority)}
                <span className="text-[10px] text-white/50 truncate max-w-[60px]">
                  {item.displayName}
                </span>
              </motion.div>
            ))}
            {queueLength > INDICATOR_PREVIEW_COUNT && (
              <span className="text-[10px] text-white/30">
                +{queueLength - INDICATOR_PREVIEW_COUNT}
              </span>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
