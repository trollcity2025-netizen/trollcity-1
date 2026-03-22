import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Howl } from 'howler';
import {
  Radio,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Mic,
  MicOff,
  Music,
  Users,
  Wifi,
  WifiOff,
  Eye,
} from 'lucide-react';
import { useTrollStationStore } from '@/stores/useTrollStationStore';
import { useAuthStore } from '@/lib/store';
import TrollStationPanel from './TrollStationPanel';
import { useTrollStationVoice } from '@/hooks/useTrollStationLiveKit';

export default function TrollStationWidget() {
  const { profile } = useAuthStore();
  const {
    station,
    currentSong,
    currentSession,
    cohosts,
    audio,
    voice,
    isExpanded,
    permissions,
    fetchStation,
    fetchQueue,
    fetchCurrentSession,
    fetchHosts,
    checkPermissions,
    setPlaying,
    setVolume,
    setMuted,
    setCurrentTime,
    setDuration,
    setBuffering,
    setExpanded,
    setSpeaking,
  } = useTrollStationStore();

  const { isConnected: isVoiceConnected, isConnecting: isVoiceConnecting, connect: connectVoice, disconnect: disconnectVoice, micMuted, setMicMuted, toggleMute } = useTrollStationVoice();

  const howlRef = useRef<Howl | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [localVolume, setLocalVolume] = useState(0.8);
  const [musicVolume, setMusicVolume] = useState(0.7);

  // Initialize
  useEffect(() => {
    fetchStation();
    fetchQueue();
    fetchCurrentSession();
    fetchHosts();
  }, []);

  // Check permissions when profile loads
  useEffect(() => {
    if (profile?.id) {
      checkPermissions(profile.id);
    }
  }, [profile?.id]);

  // Auto-connect to voice when live session starts
  useEffect(() => {
    if (station?.current_mode === 'live' && currentSession?.livekit_room_name && !isVoiceConnected) {
      connectVoice();
    }
    return () => {
      if (station?.current_mode !== 'live') {
        disconnectVoice();
      }
    };
  }, [station?.current_mode, currentSession?.livekit_room_name, isVoiceConnected]);

  // Handle audio ducking when voice is active
  useEffect(() => {
    if (howlRef.current && voice.isSpeaking && station?.current_mode === 'live') {
      // Duck music volume when someone is speaking
      const originalVolume = musicVolume;
      howlRef.current.volume(musicVolume * 0.2);
      return () => {
        if (howlRef.current) {
          howlRef.current.volume(originalVolume);
        }
      };
    }
  }, [voice.isSpeaking, musicVolume, station?.current_mode]);

  // Handle play/pause
  const handlePlayPause = useCallback(() => {
    if (!howlRef.current) {
      // Try to play if not connected
      if (station?.current_mode === 'live' || station?.is_online) {
        // Trigger re-mount of audio
        setPlaying(true);
      }
      return;
    }

    if (audio.isPlaying) {
      howlRef.current.pause();
    } else {
      setBuffering(true);
      howlRef.current.play();
    }
  }, [audio.isPlaying, station]);

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setLocalVolume(newVolume);
    if (howlRef.current) {
      howlRef.current.volume(newVolume);
    }
    setVolume(newVolume);
  }, []);

  // Toggle music mute (not mic)
  const toggleMusicMute = useCallback(() => {
    setMuted(!audio.isMuted);
  }, [audio.isMuted]);

  // Toggle expand
  const toggleExpand = useCallback(() => {
    setExpanded(!isExpanded);
    setShowPanel(!showPanel);
  }, [isExpanded, showPanel]);

  // Get DJ info
  const getDJInfo = () => {
    if (currentSession?.dj) {
      return currentSession.dj;
    }
    return null;
  };

  const dj = getDJInfo();

  // Get stream URL for music
  const streamUrl = station?.stream_url || station?.hls_url;

  // Determine if we can play
  const canPlay = station?.is_online || station?.current_mode === 'live' || !!streamUrl;

  return (
    <>
      <div className="bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-white/5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Radio className="w-5 h-5 text-purple-400" />
              {station?.is_online && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                Troll Station
                {station?.is_online && (
                  <span className="flex items-center gap-1 text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                    LIVE
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-gray-400">
                {station?.current_mode === 'live' ? 'Live Show' : 'Auto DJ'}
              </p>
            </div>
          </div>

          <button
            onClick={toggleExpand}
            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            {showPanel ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>

        {/* Content */}
        <div className="p-3 space-y-3">
          {/* Now Playing */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
              {currentSong?.cover_url ? (
                <img
                  src={currentSong.cover_url}
                  alt={currentSong.title}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <Music className="w-6 h-6 text-purple-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">
                {currentSong?.title || 'No Track Playing'}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {currentSong?.artist || 'Auto DJ'}
              </p>
            </div>
          </div>

          {/* Live Host Info */}
          {station?.current_mode === 'live' && (
            <div className="flex items-center gap-2 p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <div className="relative">
                {dj?.avatar_url ? (
                  <img
                    src={dj.avatar_url}
                    alt={dj.username}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-purple-500/30 flex items-center justify-center">
                    <Mic className="w-4 h-4 text-purple-400" />
                  </div>
                )}
                {isVoiceConnected ? (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                    <Mic className="w-1.5 h-1.5 text-white" />
                  </span>
                ) : (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-slate-600 rounded-full border-2 border-slate-900" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white truncate">
                  {currentSession?.title || 'Live Show'}
                </p>
                <p className="text-[10px] text-purple-400 truncate">
                  {dj?.username || 'DJ'}
                </p>
              </div>
              {cohosts.length > 0 && (
                <div className="flex -space-x-2">
                  {cohosts.slice(0, 2).map((cohost) => (
                    <div key={cohost.id} className="relative">
                      {cohost.user?.avatar_url ? (
                        <img
                          src={cohost.user.avatar_url}
                          alt={cohost.user.username}
                          className="w-6 h-6 rounded-full object-cover border-2 border-slate-900"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center border-2 border-slate-900">
                          <Users className="w-3 h-3 text-purple-400" />
                        </div>
                      )}
                      {cohost.is_speaking && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      )}
                    </div>
                  ))}
                  {cohosts.length > 2 && (
                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center border-2 border-slate-900 text-[10px] text-gray-400">
                      +{cohosts.length - 2}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Voice Connection Status */}
          {station?.current_mode === 'live' && (
            <div className="flex items-center gap-2 text-xs">
              {isVoiceConnected ? (
                <span className="flex items-center gap-1 text-green-400">
                  <Wifi className="w-3 h-3" />
                  Live
                </span>
              ) : isVoiceConnecting ? (
                <span className="flex items-center gap-1 text-yellow-400">
                  <Wifi className="w-3 h-3 animate-pulse" />
                  Connecting...
                </span>
              ) : (
                <span className="flex items-center gap-1 text-gray-500">
                  <WifiOff className="w-3 h-3" />
                  Offline
                </span>
              )}
              
              {/* Audience Counter */}
              <span className="flex items-center gap-1 text-gray-400 ml-auto">
                <Eye className="w-3 h-3" />
                {voice.audienceCount} listening
              </span>
            </div>
          )}

          {/* Mute Mic Button - Show when host is connected */}
          {station?.current_mode === 'live' && isVoiceConnected && permissions.isDJ && (
            <button
              onClick={() => {
                setMicMuted(!micMuted);
                toggleMute();
              }}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
                micMuted 
                  ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400' 
                  : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400'
              }`}
            >
              {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {micMuted ? 'Unmute Mic' : 'Mute Mic'}
            </button>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayPause}
              disabled={!canPlay}
              className="w-10 h-10 rounded-full bg-purple-500 hover:bg-purple-400 disabled:bg-slate-700 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              {audio.isPlaying ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white ml-0.5" />
              )}
            </button>

            <div className="flex-1 flex items-center gap-2">
              <button
                onClick={toggleMusicMute}
                className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                {audio.isMuted || localVolume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={audio.isMuted ? 0 : localVolume}
                onChange={handleVolumeChange}
                className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500"
              />
            </div>
          </div>

          {/* Queue indicator */}
          {station?.is_online && (
            <div className="flex items-center justify-between text-[10px] text-gray-500">
              <span>Queue: {useTrollStationStore.getState().queue.length} songs</span>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Panel */}
      {showPanel && (
        <TrollStationPanel onClose={() => setShowPanel(false)} />
      )}
    </>
  );
}
