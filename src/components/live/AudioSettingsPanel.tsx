import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import {
  Mic,
  Upload,
  Play,
  Pause,
  Trash2,
  Lock,
  Volume2,
  VolumeX,
  Check,
  AlertCircle,
  Music,
  Clock,
  Shield,
} from 'lucide-react';
import type { UserEntranceAudio, EntranceJoinType } from '../../types/liveStreaming';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AudioSettingsPanelProps {
  userId: string;
  userLevel: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UNLOCK_LEVEL = 200;
const MAX_DURATION_SECONDS = 4;
const MIN_DURATION_SECONDS = 2;

const JOIN_TYPES: { value: EntranceJoinType; label: string; description: string }[] = [
  { value: 'audio', label: 'Audio', description: 'Play your custom entrance audio clip' },
  { value: 'voice', label: 'Voice', description: 'Text-to-speech announcement of your name' },
  { value: 'effect', label: 'Effect', description: 'Use a system sound effect on join' },
  { value: 'none', label: 'None', description: 'Join silently with no audio' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AudioSettingsPanel({ userId, userLevel }: AudioSettingsPanelProps) {
  const isUnlocked = userLevel >= UNLOCK_LEVEL;
  const progressPercent = Math.min((userLevel / UNLOCK_LEVEL) * 100, 100);

  // ── Audio Library State ──
  const [audioList, setAudioList] = useState<UserEntranceAudio[]>([]);
  const [loadingAudio, setLoadingAudio] = useState(true);

  // ── Upload State ──
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Recording State ──
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [savingRecording, setSavingRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // ── Playback State ──
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Settings State ──
  const [joinType, setJoinType] = useState<EntranceJoinType>('audio');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [playbackEnabled, setPlaybackEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // ── Deleting State ──
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Load Audio Library ──
  const fetchAudioList = useCallback(async () => {
    setLoadingAudio(true);
    const { data } = await supabase
      .from('user_entrance_audio')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (data) {
      setAudioList(data as UserEntranceAudio[]);
    }
    setLoadingAudio(false);
  }, [userId]);

  // ── Load User Settings ──
  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('entrance_join_type, entrance_voice_enabled, entrance_playback_enabled')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      if (data.entrance_join_type) setJoinType(data.entrance_join_type as EntranceJoinType);
      if (typeof data.entrance_voice_enabled === 'boolean') setVoiceEnabled(data.entrance_voice_enabled);
      if (typeof data.entrance_playback_enabled === 'boolean') setPlaybackEnabled(data.entrance_playback_enabled);
    }
  }, [userId]);

  useEffect(() => {
    if (isUnlocked) {
      fetchAudioList();
      fetchSettings();
    }
  }, [isUnlocked, fetchAudioList, fetchSettings]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // ── Audio Playback ──
  const handlePlayPause = (audio: UserEntranceAudio) => {
    if (playingId === audio.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const el = new Audio(audio.audio_url);
    el.onended = () => setPlayingId(null);
    el.play();
    audioRef.current = el;
    setPlayingId(audio.id);
  };

  // ── File Upload ──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploading(true);

    try {
      // Validate duration
      const tempUrl = URL.createObjectURL(file);
      const duration = await new Promise<number>((resolve, reject) => {
        const el = new Audio(tempUrl);
        el.onloadedmetadata = () => {
          resolve(el.duration);
          URL.revokeObjectURL(tempUrl);
        };
        el.onerror = () => {
          URL.revokeObjectURL(tempUrl);
          reject(new Error('Could not read audio file'));
        };
      });

      if (duration < MIN_DURATION_SECONDS) {
        setUploadError(`Audio must be at least ${MIN_DURATION_SECONDS} seconds`);
        setUploading(false);
        return;
      }

      if (duration > MAX_DURATION_SECONDS) {
        setUploadError(`Audio must be ${MAX_DURATION_SECONDS} seconds or less`);
        setUploading(false);
        return;
      }

      // Upload to Supabase Storage
      const ext = file.name.split('.').pop() || 'webm';
      const path = `entrance-audio/${userId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('audio')
        .upload(path, file, { contentType: file.type });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('audio').getPublicUrl(path);

      // Insert record
      const { error: insertErr } = await supabase.from('user_entrance_audio').insert({
        user_id: userId,
        audio_url: urlData.publicUrl,
        audio_name: file.name.replace(/\.[^/.]+$/, ''),
        duration_seconds: Math.round(duration * 10) / 10,
        file_size_bytes: file.size,
        is_active: audioList.length === 0,
        is_approved: true,
      });

      if (insertErr) throw insertErr;

      await fetchAudioList();
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Recording ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      setRecordedBlob(null);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev + 1 >= MAX_DURATION_SECONDS) {
            stopRecording();
            return MAX_DURATION_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setUploadError('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handlePlayRecording = () => {
    if (!recordedBlob) return;
    if (audioRef.current) audioRef.current.pause();
    const url = URL.createObjectURL(recordedBlob);
    const el = new Audio(url);
    el.onended = () => URL.revokeObjectURL(url);
    el.play();
    audioRef.current = el;
  };

  const handleSaveRecording = async () => {
    if (!recordedBlob) return;
    setSavingRecording(true);
    setUploadError(null);

    try {
      const path = `entrance-audio/${userId}/${Date.now()}.webm`;
      const { error: uploadErr } = await supabase.storage
        .from('audio')
        .upload(path, recordedBlob, { contentType: 'audio/webm' });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('audio').getPublicUrl(path);

      const { error: insertErr } = await supabase.from('user_entrance_audio').insert({
        user_id: userId,
        audio_url: urlData.publicUrl,
        audio_name: `Recording ${new Date().toLocaleTimeString()}`,
        duration_seconds: recordingTime,
        file_size_bytes: recordedBlob.size,
        is_active: audioList.length === 0,
        is_approved: true,
      });

      if (insertErr) throw insertErr;

      setRecordedBlob(null);
      setRecordingTime(0);
      await fetchAudioList();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to save recording');
    } finally {
      setSavingRecording(false);
    }
  };

  // ── Set Active ──
  const handleSetActive = async (audioId: string) => {
    await supabase
      .from('user_entrance_audio')
      .update({ is_active: false })
      .eq('user_id', userId);

    await supabase
      .from('user_entrance_audio')
      .update({ is_active: true })
      .eq('id', audioId);

    await fetchAudioList();
  };

  // ── Delete ──
  const handleDelete = async (audio: UserEntranceAudio) => {
    setDeletingId(audio.id);
    try {
      // Remove from storage
      const urlParts = audio.audio_url.split('/audio/');
      if (urlParts[1]) {
        await supabase.storage.from('audio').remove([urlParts[1]]);
      }

      await supabase.from('user_entrance_audio').delete().eq('id', audio.id);
      await fetchAudioList();
    } finally {
      setDeletingId(null);
    }
  };

  // ── Save Settings ──
  const handleSaveJoinType = async (type: EntranceJoinType) => {
    setJoinType(type);
    setSavingSettings(true);
    await supabase
      .from('user_profiles')
      .update({ entrance_join_type: type })
      .eq('id', userId);
    setSavingSettings(false);
  };

  const handleToggleVoice = async () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    await supabase
      .from('user_profiles')
      .update({ entrance_voice_enabled: next })
      .eq('id', userId);
  };

  const handleTogglePlayback = async () => {
    const next = !playbackEnabled;
    setPlaybackEnabled(next);
    await supabase
      .from('user_profiles')
      .update({ entrance_playback_enabled: next })
      .eq('id', userId);
  };

  // ── Render ──
  return (
    <div className="relative bg-gray-900/50 backdrop-blur-md rounded-2xl border border-gray-800/60 overflow-hidden">
      {/* Gradient top border accent */}
      <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500" />

      <div className="p-5 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <Music className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Entrance Audio</h3>
            <p className="text-xs text-gray-400">Customize how you enter streams</p>
          </div>
        </div>

        {/* ── A. Lock Status ── */}
        {!isUnlocked && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-xl bg-gray-800/60 border border-gray-700/50 p-6 text-center space-y-4"
          >
            <div className="relative mx-auto w-24 h-24">
              {/* Circular progress background */}
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                <circle
                  cx="48"
                  cy="48"
                  r="42"
                  fill="none"
                  stroke="currentColor"
                  className="text-gray-700"
                  strokeWidth="6"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="42"
                  fill="none"
                  stroke="url(#progressGradient)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - progressPercent / 100)}`}
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Lock className="w-6 h-6 text-gray-400 mb-0.5" />
                <span className="text-lg font-bold text-white">{userLevel}</span>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-white">Unlocks at Level {UNLOCK_LEVEL}</p>
              <p className="text-xs text-gray-400 mt-1">
                {UNLOCK_LEVEL - userLevel} levels to go
              </p>
            </div>

            <div className="w-full bg-gray-700/50 rounded-full h-2">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        )}

        {/* ── Unlocked Content ── */}
        {isUnlocked && (
          <AnimatePresence mode="wait">
            <motion.div
              key="unlocked"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* ── G. Playback Toggle ── */}
              <div className="flex items-center justify-between rounded-xl bg-gray-800/40 border border-gray-700/40 p-4">
                <div className="flex items-center gap-3">
                  {playbackEnabled ? (
                    <Volume2 className="w-5 h-5 text-green-400" />
                  ) : (
                    <VolumeX className="w-5 h-5 text-gray-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">Entrance Audio</p>
                    <p className="text-xs text-gray-400">
                      {playbackEnabled ? 'Audio plays when you join' : 'No audio on join'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleTogglePlayback}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    playbackEnabled ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                >
                  <motion.div
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
                    animate={{ left: playbackEnabled ? '22px' : '2px' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              {/* ── E. Join Type Selector ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-semibold text-white">Join Type</span>
                  {savingSettings && (
                    <span className="text-[10px] text-gray-500 ml-auto">Saving...</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {JOIN_TYPES.map((jt) => (
                    <button
                      key={jt.value}
                      onClick={() => handleSaveJoinType(jt.value)}
                      className={`relative rounded-lg border p-3 text-left transition-all ${
                        joinType === jt.value
                          ? 'border-purple-500/60 bg-purple-500/10'
                          : 'border-gray-700/40 bg-gray-800/30 hover:bg-gray-800/50'
                      }`}
                    >
                      {joinType === jt.value && (
                        <Check className="absolute top-2 right-2 w-3.5 h-3.5 text-purple-400" />
                      )}
                      <p className="text-sm font-medium text-white">{jt.label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                        {jt.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── F. Voice Announcement Toggle ── */}
              <div className="flex items-center justify-between rounded-xl bg-gray-800/40 border border-gray-700/40 p-4">
                <div className="flex items-center gap-3">
                  <Mic className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-sm font-medium text-white">Voice Announcements</p>
                    <p className="text-xs text-gray-400">
                      Announce your name when joining streams
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleToggleVoice}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    voiceEnabled ? 'bg-blue-500' : 'bg-gray-600'
                  }`}
                >
                  <motion.div
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
                    animate={{ left: voiceEnabled ? '22px' : '2px' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              {/* ── B. Audio Upload ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-semibold text-white">Upload Audio</span>
                </div>

                <div className="rounded-xl border border-dashed border-gray-700/60 bg-gray-800/20 p-4 text-center space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 mx-auto text-gray-500" />
                  <div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 text-sm font-medium hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                    >
                      {uploading ? 'Uploading...' : 'Choose Audio File'}
                    </button>
                    <p className="text-[10px] text-gray-500 mt-2">
                      {MIN_DURATION_SECONDS}–{MAX_DURATION_SECONDS} seconds max &bull; Audio files only
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      Audio will be normalized automatically
                    </p>
                  </div>
                </div>

                {uploadError && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {uploadError}
                  </motion.div>
                )}
              </div>

              {/* ── C. Audio Recorder ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-pink-400" />
                  <span className="text-sm font-semibold text-white">Record Audio</span>
                </div>

                <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-4 space-y-3">
                  {!isRecording && !recordedBlob && (
                    <div className="text-center">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={startRecording}
                        className="w-14 h-14 rounded-full bg-pink-500/20 border-2 border-pink-500/50 flex items-center justify-center mx-auto hover:bg-pink-500/30 transition-colors"
                      >
                        <Mic className="w-6 h-6 text-pink-400" />
                      </motion.button>
                      <p className="text-xs text-gray-400 mt-2">
                        Tap to record (max {MAX_DURATION_SECONDS}s)
                      </p>
                    </div>
                  )}

                  {isRecording && (
                    <div className="text-center space-y-3">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="w-14 h-14 rounded-full bg-red-500/30 border-2 border-red-500 flex items-center justify-center mx-auto"
                      >
                        <div className="w-4 h-4 rounded-full bg-red-500" />
                      </motion.div>
                      <div className="flex items-center justify-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-lg font-mono font-bold text-red-400">
                          {recordingTime}s
                        </span>
                        <span className="text-xs text-gray-500">/ {MAX_DURATION_SECONDS}s</span>
                      </div>
                      <button
                        onClick={stopRecording}
                        className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-sm font-medium hover:bg-red-500/30 transition-colors"
                      >
                        Stop Recording
                      </button>
                    </div>
                  )}

                  {!isRecording && recordedBlob && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-lg bg-gray-700/40 p-3">
                        <div className="flex items-center gap-2">
                          <Mic className="w-4 h-4 text-pink-400" />
                          <div>
                            <p className="text-sm text-white font-medium">Recording</p>
                            <p className="text-[10px] text-gray-400">
                              {recordingTime}s &bull; {formatFileSize(recordedBlob.size)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handlePlayRecording}
                          className="p-2 rounded-lg bg-gray-600/50 hover:bg-gray-600 transition-colors"
                        >
                          <Play className="w-4 h-4 text-white" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setRecordedBlob(null);
                            setRecordingTime(0);
                          }}
                          className="flex-1 py-2 rounded-lg bg-gray-700/50 text-gray-300 text-sm font-medium hover:bg-gray-700 transition-colors"
                        >
                          Discard
                        </button>
                        <button
                          onClick={handleSaveRecording}
                          disabled={savingRecording}
                          className="flex-1 py-2 rounded-lg bg-pink-500/20 border border-pink-500/40 text-pink-300 text-sm font-medium hover:bg-pink-500/30 transition-colors disabled:opacity-50"
                        >
                          {savingRecording ? 'Saving...' : 'Save Recording'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── D. Audio Library ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-semibold text-white">Your Audio Library</span>
                  <span className="text-[10px] text-gray-500 ml-auto">
                    {audioList.length} clip{audioList.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {loadingAudio ? (
                  <div className="text-center py-6">
                    <div className="w-6 h-6 border-2 border-gray-600 border-t-purple-500 rounded-full animate-spin mx-auto" />
                  </div>
                ) : audioList.length === 0 ? (
                  <div className="text-center py-8 rounded-xl bg-gray-800/30 border border-gray-700/30">
                    <Music className="w-8 h-8 mx-auto text-gray-600 mb-2" />
                    <p className="text-sm text-gray-500">No audio clips yet</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Upload or record your first entrance audio
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <AnimatePresence>
                      {audioList.map((audio) => (
                        <motion.div
                          key={audio.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className={`flex items-center gap-3 rounded-xl p-3 border transition-colors ${
                            audio.is_active
                              ? 'bg-green-500/10 border-green-500/30'
                              : 'bg-gray-800/40 border-gray-700/40'
                          }`}
                        >
                          {/* Active indicator */}
                          {audio.is_active && (
                            <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3 text-green-400" />
                            </div>
                          )}

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {audio.audio_name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {formatDuration(audio.duration_seconds)}
                              </span>
                              {audio.file_size_bytes != null && (
                                <span className="text-[10px] text-gray-500">
                                  {formatFileSize(audio.file_size_bytes)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Play / Pause */}
                            <button
                              onClick={() => handlePlayPause(audio)}
                              className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
                            >
                              {playingId === audio.id ? (
                                <Pause className="w-3.5 h-3.5 text-white" />
                              ) : (
                                <Play className="w-3.5 h-3.5 text-white" />
                              )}
                            </button>

                            {/* Set Active */}
                            {!audio.is_active && (
                              <button
                                onClick={() => handleSetActive(audio.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-[10px] font-medium hover:bg-green-500/25 transition-colors"
                              >
                                Set Active
                              </button>
                            )}

                            {/* Delete */}
                            <button
                              onClick={() => handleDelete(audio)}
                              disabled={deletingId === audio.id}
                              className="p-2 rounded-lg bg-gray-700/50 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-400" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
