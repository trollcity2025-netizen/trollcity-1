import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, 
  Heart, Coins, MessageCircle, Share2, Minimize2, Maximize2, 
  X, Repeat, Shuffle, ListMusic 
} from 'lucide-react';
import { Howl } from 'howler';
import { trollCityTheme } from '@/styles/trollCityTheme';
import type { Song } from '@/types/media';
import { TIP_AMOUNTS } from '@/types/media';
import { useSong } from '@/lib/hooks/useMedia';

interface AudioPlayerProps {
  song: Song;
  queue: Song[];
  currentIndex: number;
  isPlaying: boolean;
  onIsPlayingChange: (playing: boolean) => void;
  isMinimized: boolean;
  onMinimizeToggle: () => void;
  onClose: () => void;
  onChangeSong: (index: number) => void;
}

export default function AudioPlayer({ 
  song, queue, currentIndex, isPlaying, onIsPlayingChange, isMinimized, onMinimizeToggle, onClose, onChangeSong 
}: AudioPlayerProps) {
  const [internalIsPlaying, setInternalIsPlaying] = useState(false);
  const currentIsPlaying = isPlaying !== undefined ? isPlaying : internalIsPlaying;
  const setCurrentIsPlaying = useCallback((playing: boolean) => {
    if (onIsPlayingChange) {
      onIsPlayingChange(playing);
    } else {
      setInternalIsPlaying(playing);
    }
  }, [onIsPlayingChange]);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'one' | 'all'>('none');
  const [shuffleMode, setShuffleMode] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const howlRef = useRef<Howl | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const { toggleLike, sendTip, song: currentSongData } = useSong(song.id);

  // Initialize Howl when song changes
  useEffect(() => {
    if (!song.audio_url) {
      setLoadError('No audio URL available');
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    // Clean up previous Howl instance
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }

    // Create new Howl instance
    const howl = new Howl({
      src: [song.audio_url],
      html5: true, // Force HTML5 Audio to support streaming
      volume: isMuted ? 0 : volume,
      preload: true,
      onload: () => {
        setIsLoading(false);
        setDuration(howl.duration());
        // Auto-play when loaded if should be playing
        if (currentIsPlaying) {
          howl.play();
        }
      },
      onloaderror: (_id, error) => {
        console.error('Audio load error:', error);
        setIsLoading(false);
        setLoadError('Failed to load audio');
      },
      onplay: () => {
        setIsLoading(false);
        setCurrentIsPlaying(true);
      },
      onpause: () => {
        setCurrentIsPlaying(false);
      },
      onstop: () => {
        setCurrentIsPlaying(false);
      },
      onend: () => {
        handleEnded();
      },
      onseek: () => {
        setCurrentTime(howl.seek() as number);
      }
    });

    howlRef.current = howl;

    // Play if should be playing
    if (currentIsPlaying) {
      howl.play();
    }

    return () => {
      // Don't unload on component unmount, just stop
      // howl.unload() is called when song changes
    };
  }, [song.id, song.audio_url]);

  // Update play/pause state
  useEffect(() => {
    if (!howlRef.current) return;

    if (currentIsPlaying && !howlRef.current.playing()) {
      howlRef.current.play();
    } else if (!currentIsPlaying && howlRef.current.playing()) {
      howlRef.current.pause();
    }
  }, [currentIsPlaying]);

  // Update volume
  useEffect(() => {
    if (howlRef.current) {
      howlRef.current.volume(isMuted ? 0 : volume);
    }
  }, [volume, isMuted]);

  // Update current time periodically
  useEffect(() => {
    if (!howlRef.current || !currentIsPlaying) return;

    const interval = setInterval(() => {
      if (howlRef.current && howlRef.current.playing()) {
        setCurrentTime(howlRef.current.seek() as number);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [currentIsPlaying]);

  const handleEnded = () => {
    if (repeatMode === 'one') {
      if (howlRef.current) {
        howlRef.current.seek(0);
        howlRef.current.play();
      }
    } else if (currentIndex < queue.length - 1) {
      onChangeSong(currentIndex + 1);
    } else if (repeatMode === 'all') {
      onChangeSong(0);
    } else {
      setCurrentIsPlaying(false);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !howlRef.current || duration === 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    howlRef.current.seek(newTime);
    setCurrentTime(newTime);
  };

  const handlePrevious = () => {
    if (currentTime > 3) {
      if (howlRef.current) {
        howlRef.current.seek(0);
        setCurrentTime(0);
      }
    } else if (currentIndex > 0) {
      onChangeSong(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (shuffleMode) {
      const randomIndex = Math.floor(Math.random() * queue.length);
      onChangeSong(randomIndex);
    } else if (currentIndex < queue.length - 1) {
      onChangeSong(currentIndex + 1);
    } else if (repeatMode === 'all') {
      onChangeSong(0);
    }
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (howlRef.current) {
        howlRef.current.unload();
        howlRef.current = null;
      }
    };
  }, []);

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-80 md:right-4 z-50">
        <div className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-2xl p-3 shadow-2xl flex items-center gap-4`}>
          <img 
            src={song.cover_url || '/assets/default-cover.png'} 
            alt={song.title}
            className="w-12 h-12 rounded-lg object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white truncate">{song.title}</p>
            <p className="text-sm text-gray-400 truncate">{song.artist?.artist_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentIsPlaying(!currentIsPlaying)} 
              className="p-2 rounded-full bg-pink-500 hover:bg-pink-400 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : currentIsPlaying ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white ml-0.5" />
              )}
            </button>
            <button onClick={onMinimizeToggle} className="p-2 text-gray-400 hover:text-white">
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 md:left-80 md:right-4 z-50">
        <div className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-2xl shadow-2xl overflow-hidden`}>
          {/* Error/Loading Banner */}
          {loadError && (
            <div className="bg-red-500/20 border-b border-red-500/30 px-4 py-2 text-red-400 text-sm">
              {loadError}
            </div>
          )}
          {isLoading && !loadError && (
            <div className="bg-blue-500/20 border-b border-blue-500/30 px-4 py-2 text-blue-400 text-sm flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              Loading audio...
            </div>
          )}

          {/* Progress Bar */}
          <div 
            ref={progressRef}
            className="h-1 bg-white/10 cursor-pointer group"
            onClick={handleProgressClick}
          >
            <div 
              className="h-full bg-gradient-to-r from-pink-500 to-purple-500 relative"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-center gap-4">
              {/* Cover Art */}
              <div className="relative group">
                <img 
                  src={song.cover_url || '/assets/default-cover.png'} 
                  alt={song.title}
                  className="w-16 h-16 md:w-20 md:h-20 rounded-xl object-cover"
                />
                <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ListMusic className="w-6 h-6 text-white" />
                </div>
              </div>

              {/* Song Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate text-lg">{song.title}</h3>
                <p className="text-gray-400 truncate">{song.artist?.artist_name}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
                  <span className="flex items-center gap-1">
                    <Coins className="w-3 h-3" />
                    {song.tips_total} tips
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 md:gap-4">
                <button 
                  onClick={() => setShuffleMode(!shuffleMode)}
                  className={`p-2 rounded-full transition-colors ${shuffleMode ? 'text-pink-400 bg-pink-500/20' : 'text-gray-400 hover:text-white'}`}
                >
                  <Shuffle className="w-5 h-5" />
                </button>

                <button onClick={handlePrevious} className="p-2 text-gray-300 hover:text-white transition-colors">
                  <SkipBack className="w-6 h-6" fill="currentColor" />
                </button>

                <button 
                  onClick={() => setCurrentIsPlaying(!currentIsPlaying)} 
                  className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 flex items-center justify-center transition-all disabled:opacity-50"
                  disabled={isLoading || !!loadError}
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : currentIsPlaying ? (
                    <Pause className="w-6 h-6 text-white" />
                  ) : (
                    <Play className="w-6 h-6 text-white ml-1" />
                  )}
                </button>

                <button onClick={handleNext} className="p-2 text-gray-300 hover:text-white transition-colors">
                  <SkipForward className="w-6 h-6" fill="currentColor" />
                </button>

                <button 
                  onClick={() => setRepeatMode(repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none')}
                  className={`p-2 rounded-full transition-colors ${repeatMode !== 'none' ? 'text-pink-400 bg-pink-500/20' : 'text-gray-400 hover:text-white'}`}
                >
                  <Repeat className="w-5 h-5" />
                  {repeatMode === 'one' && <span className="absolute text-[8px] font-bold">1</span>}
                </button>
              </div>

              {/* Volume & Actions */}
              <div className="hidden md:flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => setIsMuted(!isMuted)} className="text-gray-400 hover:text-white">
                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01" 
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
                  />
                </div>

                <div className="w-px h-8 bg-white/10" />

                <button 
                  onClick={() => toggleLike()}
                  className={`p-2 rounded-full transition-colors ${currentSongData?.is_liked ? 'text-red-400' : 'text-gray-400 hover:text-red-400'}`}
                >
                  <Heart className="w-5 h-5" fill={currentSongData?.is_liked ? 'currentColor' : 'none'} />
                </button>

                <button 
                  onClick={() => setShowTipModal(true)}
                  className="p-2 text-yellow-400 hover:text-yellow-300"
                >
                  <Coins className="w-5 h-5" />
                </button>

                <button className="p-2 text-gray-400 hover:text-white">
                  <Share2 className="w-5 h-5" />
                </button>

                <button onClick={onMinimizeToggle} className="p-2 text-gray-400 hover:text-white">
                  <Minimize2 className="w-5 h-5" />
                </button>

                <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tip Modal */}
      {showTipModal && (
        <TipModal 
          song={song} 
          onClose={() => setShowTipModal(false)} 
          onTip={sendTip}
        />
      )}
    </>
  );
}

interface TipModalProps {
  song: Song;
  onClose: () => void;
  onTip: (amount: number, message?: string) => Promise<any>;
}

function TipModal({ song, onClose, onTip }: TipModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleTip = async () => {
    if (!selectedAmount) return;
    setLoading(true);
    await onTip(selectedAmount, message);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className={`${trollCityTheme.backgrounds.card} border ${trollCityTheme.borders.glass} rounded-2xl p-6 max-w-md w-full`}>
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Coins className="w-6 h-6 text-yellow-400" />
          Tip the Artist
        </h3>
        
        <div className="flex items-center gap-3 mb-6 p-3 bg-white/5 rounded-xl">
          <img src={song.cover_url} alt={song.title} className="w-12 h-12 rounded-lg object-cover" />
          <div>
            <p className="font-medium text-white">{song.title}</p>
            <p className="text-sm text-gray-400">{song.artist?.artist_name}</p>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-3">Select amount:</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {TIP_AMOUNTS.map((tip) => (
            <button
              key={tip.amount}
              onClick={() => setSelectedAmount(tip.amount)}
              className={`
                p-3 rounded-xl border-2 transition-all text-left
                ${selectedAmount === tip.amount 
                  ? 'border-yellow-400 bg-yellow-400/10' 
                  : 'border-white/10 hover:border-white/30'
                }
              `}
            >
              <span className="text-lg font-bold text-yellow-400">{tip.label}</span>
            </button>
          ))}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a message (optional)..."
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 resize-none h-20 mb-3"
          maxLength={200}
        />

        <label className="flex items-center gap-2 mb-6 text-sm text-gray-400 cursor-pointer">
          <input 
            type="checkbox" 
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="rounded border-gray-600"
          />
          Tip anonymously
        </label>

        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/20 text-gray-300 hover:bg-white/5"
          >
            Cancel
          </button>
          <button 
            onClick={handleTip}
            disabled={!selectedAmount || loading}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold disabled:opacity-50"
          >
            {loading ? 'Sending...' : `Send ${selectedAmount || ''} Coins`}
          </button>
        </div>
      </div>
    </div>
  );
}
