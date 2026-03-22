import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Radio,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Music,
  Users,
  ListMusic,
  MessageSquare,
  Upload,
  Plus,
  SkipForward,
  Trash2,
  UserPlus,
  Wifi,
  WifiOff,
  ChevronLeft,
  Image,
  FileAudio,
  X,
  Check,
} from 'lucide-react';
import { useTrollStationStore } from '@/stores/useTrollStationStore';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import type { TrollStationSong, TrollStationChat } from '@/types/trollStation';

export default function TrollStationPage() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const {
    station,
    currentSong,
    queue,
    currentSession,
    cohosts,
    hosts,
    permissions,
    audio,
    voice,
    fetchStation,
    fetchQueue,
    fetchCurrentSession,
    fetchHosts,
    checkPermissions,
    addToQueue,
    removeFromQueue,
    playNext,
    startSession,
    endSession,
    submitSong,
    approveSong,
    rejectSong,
    setPlaying,
    setMuted,
  } = useTrollStationStore();

  const [activeTab, setActiveTab] = useState<'nowPlaying' | 'queue' | 'hosts' | 'chat' | 'submit'>('nowPlaying');
  const [chatMessages, setChatMessages] = useState<TrollStationChat[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [pendingSongs, setPendingSongs] = useState<TrollStationSong[]>([]);
  const [submitForm, setSubmitForm] = useState({
    title: '',
    artist: '',
    audio_url: '',
    cover_url: '',
    category: '',
    tags: '',
  });
  const [localVolume, setLocalVolume] = useState(0.8);
  
  // File upload state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStation();
    fetchQueue();
    fetchCurrentSession();
    fetchHosts();
  }, []);

  useEffect(() => {
    if (profile?.id) {
      checkPermissions(profile.id);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (activeTab === 'chat') {
      fetchChatMessages();
    }
  }, [activeTab, currentSession?.id]);

  useEffect(() => {
    if (activeTab === 'queue' && permissions.canModerate) {
      fetchPendingSongs();
    }
  }, [activeTab, permissions.canModerate]);

  const fetchChatMessages = async () => {
    try {
      let query = supabase
        .from('troll_station_chat')
        .select('*, user:user_profiles(id, username, avatar_url)')
        .order('created_at', { ascending: true })
        .limit(100);

      if (currentSession?.id) {
        query = query.eq('session_id', currentSession.id);
      }

      const { data } = await query;
      setChatMessages(data || []);
    } catch (error) {
      console.error('Error fetching chat:', error);
    }
  };

  const fetchPendingSongs = async () => {
    try {
      const { data } = await supabase
        .from('troll_station_songs')
        .select('*, submitter:user_profiles(id, username, avatar_url)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      setPendingSongs(data || []);
    } catch (error) {
      console.error('Error fetching pending songs:', error);
    }
  };

  // File upload handlers
  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/flac'];
      if (!validTypes.includes(file.type)) {
        setUploadError('Invalid file type. Please upload MP3, WAV, OGG, M4A, or FLAC files.');
        return;
      }
      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        setUploadError('File too large. Maximum file size is 50MB.');
        return;
      }
      setAudioFile(file);
      setUploadError(null);
      // Create preview URL
      const url = URL.createObjectURL(file);
      setAudioPreviewUrl(url);
    }
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setUploadError('Invalid cover image type. Please upload JPG, PNG, GIF, or WebP.');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('Cover image too large. Maximum file size is 5MB.');
        return;
      }
      setCoverFile(file);
      setUploadError(null);
      // Create preview URL
      const url = URL.createObjectURL(file);
      setCoverPreviewUrl(url);
    }
  };

  const removeAudioFile = () => {
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
    }
    setAudioFile(null);
    setAudioPreviewUrl(null);
    if (audioInputRef.current) {
      audioInputRef.current.value = '';
    }
  };

  const removeCoverFile = () => {
    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl);
    }
    setCoverFile(null);
    setCoverPreviewUrl(null);
    if (coverInputRef.current) {
      coverInputRef.current.value = '';
    }
  };

  const uploadFile = async (file: File, bucket: string, folder: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !profile) return;

    try {
      await supabase
        .from('troll_station_chat')
        .insert({
          session_id: currentSession?.id || null,
          user_id: profile.id,
          message: chatInput.trim(),
        });

      setChatInput('');
      fetchChatMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleSubmitSong = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Must have either audio file or URL
    if (!submitForm.title || (!audioFile && !submitForm.audio_url)) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      let audioUrl = submitForm.audio_url;
      let coverUrl = submitForm.cover_url;

      // Upload audio file if selected
      if (audioFile) {
        setUploadProgress(20);
        try {
          audioUrl = await uploadFile(audioFile, 'troll-station', 'songs');
          setUploadProgress(50);
        } catch (uploadError) {
          console.error('Audio upload failed:', uploadError);
          setUploadError('Failed to upload audio file. Please try again or use a URL.');
          setUploading(false);
          return;
        }
      }

      // Upload cover image if selected
      if (coverFile) {
        setUploadProgress(70);
        try {
          coverUrl = await uploadFile(coverFile, 'troll-station', 'covers');
          setUploadProgress(90);
        } catch (uploadError) {
          console.error('Cover upload failed:', uploadError);
          // Continue with submission even if cover fails
        }
      }

      setUploadProgress(100);

      // Submit the song
      await submitSong({
        title: submitForm.title,
        artist: submitForm.artist || null,
        audio_url: audioUrl || '',
        cover_url: coverUrl || null,
        category: submitForm.category || null,
        tags: submitForm.tags ? submitForm.tags.split(',').map(t => t.trim()) : null,
        duration: null,
      });

      // Reset form
      setSubmitForm({ title: '', artist: '', audio_url: '', cover_url: '', category: '', tags: '' });
      removeAudioFile();
      removeCoverFile();
      alert('Song submitted for moderation!');
    } catch (error) {
      console.error('Error submitting song:', error);
      setUploadError('Failed to submit song. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleStartSession = async () => {
    const title = prompt('Enter show title:');
    if (!title) return;
    const description = prompt('Enter show description (optional):');
    try {
      await startSession(title, description || undefined);
    } catch (error) {
      alert('Failed to start session');
    }
  };

  const dj = currentSession?.dj;

  const tabs = [
    { id: 'nowPlaying', label: 'Now Playing', icon: <Music className="w-4 h-4" /> },
    { id: 'queue', label: 'Queue', icon: <ListMusic className="w-4 h-4" /> },
    { id: 'hosts', label: 'Hosts', icon: <Mic className="w-4 h-4" /> },
    { id: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'submit', label: 'Submit', icon: <Upload className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Radio className="w-8 h-8 text-purple-400" />
              {station?.is_online && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                Troll Station
                {station?.is_online && (
                  <span className="flex items-center gap-1 text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    LIVE
                  </span>
                )}
              </h1>
              <p className="text-gray-400">
                {station?.current_mode === 'live' ? 'Live Show' : 'Auto DJ'} • {queue.length} songs in queue
              </p>
            </div>
          </div>
        </div>

        {/* Main Player */}
        <div className="bg-slate-900/50 rounded-2xl border border-white/10 p-6 mb-6">
          <div className="flex items-center gap-6">
            {/* Album Art */}
            <div className="w-32 h-32 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
              {currentSong?.cover_url ? (
                <img src={currentSong.cover_url} alt="" className="w-full h-full object-cover rounded-xl" />
              ) : (
                <Music className="w-16 h-16 text-purple-400" />
              )}
            </div>

            {/* Track Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">
                {currentSong?.title || 'No Track Playing'}
              </h2>
              <p className="text-gray-400 truncate">
                {currentSong?.artist || 'Auto DJ'}
              </p>
              {station?.current_mode === 'live' && currentSession && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/20 rounded-lg">
                    {dj?.avatar_url ? (
                      <img src={dj.avatar_url} alt="" className="w-5 h-5 rounded-full" />
                    ) : (
                      <Mic className="w-4 h-4 text-purple-400" />
                    )}
                    <span className="text-sm text-purple-400">{dj?.username || 'DJ'}</span>
                  </div>
                  <span className="text-xs text-gray-500">{currentSession.title}</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => audio.isPlaying ? setPlaying(false) : setPlaying(true)}
                className="w-14 h-14 rounded-full bg-purple-500 hover:bg-purple-400 flex items-center justify-center transition-colors"
              >
                {audio.isPlaying ? (
                  <Pause className="w-7 h-7 text-white" />
                ) : (
                  <Play className="w-7 h-7 text-white ml-1" />
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMuted(!audio.isMuted)}
                  className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                  {audio.isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={audio.isMuted ? 0 : localVolume}
                  onChange={(e) => {
                    const vol = parseFloat(e.target.value);
                    setLocalVolume(vol);
                  }}
                  className="w-24 h-2 bg-slate-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Visualizer */}
          <div className="mt-6 h-16 bg-black/30 rounded-lg flex items-center justify-center gap-1">
            {audio.isPlaying ? (
              Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-purple-500 rounded-full animate-pulse"
                  style={{
                    height: `${Math.random() * 100}%`,
                    animationDelay: `${i * 50}ms`,
                  }}
                />
              ))
            ) : (
              <span className="text-gray-500">Paused</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-slate-900/50 rounded-2xl border border-white/10 p-6">
          {activeTab === 'nowPlaying' && (
            <div className="space-y-4">
              {/* Live Controls */}
              {(permissions.isDJ || permissions.isStationAdmin || permissions.isStationManager) && (
                <div className="flex gap-2">
                  {station?.current_mode === 'live' ? (
                    <button
                      onClick={endSession}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                    >
                      <MicOff className="w-4 h-4" />
                      End Live Show
                    </button>
                  ) : (
                    <button
                      onClick={handleStartSession}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white rounded-lg transition-colors"
                    >
                      <Mic className="w-4 h-4" />
                      Start Live Show
                    </button>
                  )}
                </div>
              )}

              {/* Cohosts */}
              {currentSession && cohosts.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Co-hosts</h3>
                  <div className="flex flex-wrap gap-2">
                    {cohosts.map((cohost) => (
                      <div key={cohost.id} className="flex items-center gap-2 px-3 py-1 bg-purple-500/20 rounded-lg">
                        {cohost.user?.avatar_url ? (
                          <img src={cohost.user.avatar_url} alt="" className="w-5 h-5 rounded-full" />
                        ) : (
                          <Users className="w-4 h-4 text-purple-400" />
                        )}
                        <span className="text-sm text-purple-400">{cohost.user?.username}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Voice Status */}
              {station?.current_mode === 'live' && (
                <div className="flex items-center gap-2 text-sm">
                  {voice.isConnected ? (
                    <span className="flex items-center gap-1 text-green-400">
                      <Wifi className="w-4 h-4" />
                      Voice Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-500">
                      <WifiOff className="w-4 h-4" />
                      Voice Disconnected
                    </span>
                  )}
                  {voice.isSpeaking && (
                    <span className="flex items-center gap-1 text-green-400 ml-auto">
                      <Mic className="w-4 h-4" />
                      Speaking
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'queue' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Up Next</h3>
                {queue.length > 0 && permissions.canControlQueue && (
                  <button
                    onClick={playNext}
                    className="flex items-center gap-1 text-purple-400 hover:text-purple-300"
                  >
                    <SkipForward className="w-4 h-4" />
                    Play Next
                  </button>
                )}
              </div>

              {queue.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Queue is empty</p>
              ) : (
                <div className="space-y-2">
                  {queue.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-500 w-6">{index + 1}</span>
                      <div className="w-12 h-12 rounded bg-purple-500/20 flex items-center justify-center">
                        {item.song?.cover_url ? (
                          <img src={item.song.cover_url} alt="" className="w-full h-full object-cover rounded" />
                        ) : (
                          <Music className="w-6 h-6 text-purple-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white truncate">{item.song?.title}</p>
                        <p className="text-gray-400 text-sm truncate">{item.song?.artist}</p>
                      </div>
                      {permissions.canControlQueue && (
                        <button
                          onClick={() => removeFromQueue(item.id)}
                          className="p-2 hover:bg-white/10 rounded text-gray-500 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Pending Songs */}
              {permissions.canModerate && pendingSongs.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-white mb-2">
                    Pending Approval ({pendingSongs.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingSongs.map((song) => (
                      <div key={song.id} className="flex items-center gap-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                        <div className="w-12 h-12 rounded bg-yellow-500/20 flex items-center justify-center">
                          <Music className="w-6 h-6 text-yellow-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white truncate">{song.title}</p>
                          <p className="text-gray-400 text-sm truncate">{song.artist}</p>
                        </div>
                        <button
                          onClick={() => approveSong(song.id)}
                          className="p-2 hover:bg-green-500/20 rounded text-green-400"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => rejectSong(song.id, 'Rejected')}
                          className="p-2 hover:bg-red-500/20 rounded text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'hosts' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Station Hosts</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {hosts.map((host) => (
                  <div key={host.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                    {host.user?.avatar_url ? (
                      <img src={host.user.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Mic className="w-5 h-5 text-purple-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-white font-medium">{host.user?.username}</p>
                      <p className="text-gray-400 text-sm capitalize">{host.role}</p>
                    </div>
                  </div>
                ))}
                {hosts.length === 0 && (
                  <p className="text-gray-500 col-span-full text-center py-8">No hosts assigned</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="flex flex-col h-[400px]">
              <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className="flex items-start gap-2">
                    {msg.user?.avatar_url ? (
                      <img src={msg.user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-700" />
                    )}
                    <div>
                      <p className="text-sm text-gray-400">
                        <span className="font-medium text-purple-400">{msg.user?.username}</span>
                      </p>
                      <p className="text-white">{msg.message}</p>
                    </div>
                  </div>
                ))}
              </div>
              {permissions.canChat ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Send a message..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!chatInput.trim()}
                    className="px-4 py-2 bg-purple-500 hover:bg-purple-400 disabled:bg-slate-700 rounded-lg text-white"
                  >
                    Send
                  </button>
                </div>
              ) : (
                <p className="text-gray-500 text-center">Sign in to chat</p>
              )}
            </div>
          )}

          {activeTab === 'submit' && (
            <form onSubmit={handleSubmitSong} className="space-y-4">
              {/* Upload Error */}
              {uploadError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {uploadError}
                </div>
              )}

              {/* Upload Progress */}
              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-400 mb-1">Song Title *</label>
                <input
                  type="text"
                  value={submitForm.title}
                  onChange={(e) => setSubmitForm({ ...submitForm, title: e.target.value })}
                  required
                  disabled={uploading}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Artist</label>
                <input
                  type="text"
                  value={submitForm.artist}
                  onChange={(e) => setSubmitForm({ ...submitForm, artist: e.target.value })}
                  disabled={uploading}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                />
              </div>

              {/* Audio File Upload */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Audio File *</label>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioFileChange}
                  disabled={uploading}
                  className="hidden"
                />
                {audioFile ? (
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-green-500/30">
                    <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <FileAudio className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white truncate">{audioFile.name}</p>
                      <p className="text-xs text-gray-400">{(audioFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    <button
                      type="button"
                      onClick={removeAudioFile}
                      disabled={uploading}
                      className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-red-400 disabled:opacity-50"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => audioInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-white/20 rounded-lg text-gray-400 hover:border-purple-500 hover:text-purple-400 transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-5 h-5" />
                    Click to upload audio file
                  </button>
                )}
              </div>

              {/* OR divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-gray-500 text-sm">OR</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Audio URL (alternative) */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Audio URL (alternative)</label>
                <input
                  type="url"
                  value={submitForm.audio_url}
                  onChange={(e) => setSubmitForm({ ...submitForm, audio_url: e.target.value })}
                  disabled={uploading || !!audioFile}
                  placeholder="https://example.com/song.mp3"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                />
              </div>

              {/* Cover Image Upload */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Cover Image</label>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverFileChange}
                  disabled={uploading}
                  className="hidden"
                />
                {coverPreviewUrl ? (
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-green-500/30">
                    <img src={coverPreviewUrl} alt="Cover" className="w-14 h-14 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white truncate">{coverFile?.name}</p>
                      <p className="text-xs text-gray-400">{(coverFile!.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    <button
                      type="button"
                      onClick={removeCoverFile}
                      disabled={uploading}
                      className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-red-400 disabled:opacity-50"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-white/20 rounded-lg text-gray-400 hover:border-purple-500 hover:text-purple-400 transition-colors disabled:opacity-50"
                  >
                    <Image className="w-5 h-5" />
                    Upload cover image (optional)
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <select
                  value={submitForm.category}
                  onChange={(e) => setSubmitForm({ ...submitForm, category: e.target.value })}
                  disabled={uploading}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                >
                  <option value="">Select category</option>
                  <option value="pop">Pop</option>
                  <option value="rock">Rock</option>
                  <option value="electronic">Electronic</option>
                  <option value="hip-hop">Hip Hop</option>
                  <option value="rnb">R&B</option>
                  <option value="country">Country</option>
                  <option value="jazz">Jazz</option>
                  <option value="classical">Classical</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={uploading || (!audioFile && !submitForm.audio_url)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-purple-500 hover:bg-purple-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {uploading ? (
                  <>Uploading...</>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Submit Song
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
