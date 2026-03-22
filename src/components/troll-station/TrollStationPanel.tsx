import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Music,
  ListMusic,
  Mic,
  MessageSquare,
  Send,
  Upload,
  Play,
  Pause,
  SkipForward,
  Trash2,
  UserPlus,
  MicOff,
  Check,
  XCircle,
  Clock,
  Heart,
} from 'lucide-react';
import { useTrollStationStore } from '@/stores/useTrollStationStore';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import type { StationTab, TrollStationSong, TrollStationChat } from '@/types/trollStation';

interface TrollStationPanelProps {
  onClose: () => void;
}

export default function TrollStationPanel({ onClose }: TrollStationPanelProps) {
  const { profile } = useAuthStore();
  const {
    station,
    currentSong,
    queue,
    currentSession,
    cohosts,
    hosts,
    permissions,
    activeTab,
    audio,
    fetchQueue,
    fetchCurrentSession,
    addToQueue,
    removeFromQueue,
    playNext,
    startSession,
    endSession,
    inviteToStage,
    removeCohost,
    submitSong,
    approveSong,
    rejectSong,
    setActiveTab,
  } = useTrollStationStore();

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

  const chatEndRef = useRef<HTMLDivElement>(null);

  const tabs: { id: StationTab; label: string; icon: React.ReactNode }[] = [
    { id: 'nowPlaying', label: 'Now Playing', icon: <Music className="w-4 h-4" /> },
    { id: 'queue', label: 'Queue', icon: <ListMusic className="w-4 h-4" /> },
    { id: 'hosts', label: 'Hosts', icon: <Mic className="w-4 h-4" /> },
    { id: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'submit', label: 'Submit', icon: <Upload className="w-4 h-4" /> },
  ];

  // Fetch chat messages
  useEffect(() => {
    if (activeTab === 'chat') {
      fetchChatMessages();
    }
  }, [activeTab, currentSession?.id]);

  // Fetch pending songs for moderators
  useEffect(() => {
    if (activeTab === 'queue' && permissions.canModerate) {
      fetchPendingSongs();
    }
  }, [activeTab, permissions.canModerate]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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

      const { data, error } = await query;
      if (error) throw error;
      setChatMessages(data || []);
    } catch (error) {
      console.error('Error fetching chat:', error);
    }
  };

  const fetchPendingSongs = async () => {
    try {
      const { data, error } = await supabase
        .from('troll_station_songs')
        .select('*, submitter:user_profiles(id, username, avatar_url)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPendingSongs(data || []);
    } catch (error) {
      console.error('Error fetching pending songs:', error);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !profile) return;

    try {
      const { error } = await supabase
        .from('troll_station_chat')
        .insert({
          session_id: currentSession?.id || null,
          user_id: profile.id,
          message: chatInput.trim(),
        });

      if (error) throw error;
      setChatInput('');
      fetchChatMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleSubmitSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitForm.title || !submitForm.audio_url) return;

    try {
      await submitSong({
        title: submitForm.title,
        artist: submitForm.artist || null,
        audio_url: submitForm.audio_url,
        cover_url: submitForm.cover_url || null,
        category: submitForm.category || null,
        tags: submitForm.tags ? submitForm.tags.split(',').map(t => t.trim()) : null,
        duration: null,
      });
      setSubmitForm({ title: '', artist: '', audio_url: '', cover_url: '', category: '', tags: '' });
      alert('Song submitted for moderation!');
    } catch (error) {
      console.error('Error submitting song:', error);
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

  return (
    <div className="bg-slate-900 rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-white/5 border-b border-white/5">
        <h3 className="text-sm font-bold text-white">Troll Station</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.icon}
            <span className="hidden lg:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-3 max-h-[400px] overflow-y-auto">
        {activeTab === 'nowPlaying' && (
          <NowPlayingTab
            currentSong={currentSong}
            station={station}
            permissions={permissions}
            onStartSession={handleStartSession}
            onEndSession={endSession}
            currentSession={currentSession}
            audio={audio}
          />
        )}

        {activeTab === 'queue' && (
          <QueueTab
            queue={queue}
            pendingSongs={pendingSongs}
            permissions={permissions}
            onAddToQueue={addToQueue}
            onRemoveFromQueue={removeFromQueue}
            onPlayNext={playNext}
            onApproveSong={approveSong}
            onRejectSong={rejectSong}
            isLive={station?.current_mode === 'live'}
          />
        )}

        {activeTab === 'hosts' && (
          <HostsTab
            hosts={hosts}
            currentSession={currentSession}
            cohosts={cohosts}
            permissions={permissions}
            onInviteToStage={inviteToStage}
            onRemoveCohost={removeCohost}
          />
        )}

        {activeTab === 'chat' && (
          <ChatTab
            messages={chatMessages}
            input={chatInput}
            onInputChange={setChatInput}
            onSend={sendChatMessage}
            canChat={permissions.canChat}
            chatEndRef={chatEndRef}
          />
        )}

        {activeTab === 'submit' && (
          <SubmitTab
            form={submitForm}
            onChange={setSubmitForm}
            onSubmit={handleSubmitSong}
            canSubmit={permissions.canSubmit}
          />
        )}
      </div>
    </div>
  );
}

// Now Playing Tab
function NowPlayingTab({
  currentSong,
  station,
  permissions,
  onStartSession,
  onEndSession,
  currentSession,
  audio,
}: {
  currentSong: TrollStationSong | null;
  station: any;
  permissions: any;
  onStartSession: () => void;
  onEndSession: () => void;
  currentSession: any;
  audio: any;
}) {
  return (
    <div className="space-y-4">
      {/* Current Track */}
      <div className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
        <div className="w-16 h-16 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
          {currentSong?.cover_url ? (
            <img src={currentSong.cover_url} alt="" className="w-full h-full object-cover rounded-lg" />
          ) : (
            <Music className="w-8 h-8 text-purple-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white truncate">{currentSong?.title || 'No Track Playing'}</p>
          <p className="text-sm text-gray-400 truncate">{currentSong?.artist || 'Auto DJ'}</p>
          {currentSong?.category && (
            <span className="text-xs text-purple-400">{currentSong.category}</span>
          )}
        </div>
      </div>

      {/* Live Show Controls */}
      {(permissions.isDJ || permissions.isStationAdmin || permissions.isStationManager) && (
        <div className="space-y-2">
          {station?.current_mode === 'live' ? (
            <button
              onClick={() => {
                console.log('Ending session...');
                onEndSession();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
            >
              <MicOff className="w-4 h-4" />
              End Live Show
            </button>
          ) : (
            <button
              onClick={() => {
                console.log('Starting session...');
                onStartSession();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-purple-500 hover:bg-purple-400 text-white rounded-lg transition-colors"
            >
              <Mic className="w-4 h-4" />
              Start Live Show
            </button>
          )}
        </div>
      )}

      {/* Debug info - remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 p-2 bg-gray-900 rounded">
          <p>isDJ: {String(permissions.isDJ)}</p>
          <p>isStationAdmin: {String(permissions.isStationAdmin)}</p>
          <p>isStationManager: {String(permissions.isStationManager)}</p>
          <p>current_mode: {station?.current_mode}</p>
        </div>
      )}

      {/* Live Show Info */}
      {currentSession && (
        <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
          <h4 className="font-medium text-white flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Live Now
          </h4>
          <p className="text-sm text-gray-400 mt-1">{currentSession.title}</p>
          {currentSession.description && (
            <p className="text-xs text-gray-500 mt-1">{currentSession.description}</p>
          )}
        </div>
      )}

      {/* Audio Visualizer Placeholder */}
      <div className="h-16 bg-black/30 rounded-lg flex items-center justify-center gap-1">
        {audio.isPlaying ? (
          Array.from({ length: 20 }).map((_, i) => (
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
          <span className="text-gray-500 text-sm">Paused</span>
        )}
      </div>
    </div>
  );
}

// Queue Tab
function QueueTab({
  queue,
  pendingSongs,
  permissions,
  onAddToQueue,
  onRemoveFromQueue,
  onPlayNext,
  onApproveSong,
  onRejectSong,
  isLive,
}: {
  queue: any[];
  pendingSongs: any[];
  permissions: any;
  onAddToQueue: (songId: string) => void;
  onRemoveFromQueue: (queueId: string) => void;
  onPlayNext: () => void;
  onApproveSong: (songId: string) => void;
  onRejectSong: (songId: string, reason: string) => void;
  isLive: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Queue */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-white">Up Next</h4>
          {queue.length > 0 && permissions.canControlQueue && (
            <button
              onClick={onPlayNext}
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              <SkipForward className="w-3 h-3" />
              Play Next
            </button>
          )}
        </div>

        {queue.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">Queue is empty</p>
        ) : (
          <div className="space-y-2">
            {queue.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-2 p-2 bg-white/5 rounded-lg"
              >
                <span className="text-xs text-gray-500 w-4">{index + 1}</span>
                <div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center shrink-0">
                  {item.song?.cover_url ? (
                    <img src={item.song.cover_url} alt="" className="w-full h-full object-cover rounded" />
                  ) : (
                    <Music className="w-4 h-4 text-purple-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{item.song?.title}</p>
                  <p className="text-xs text-gray-400 truncate">{item.song?.artist}</p>
                </div>
                {permissions.canControlQueue && (
                  <button
                    onClick={() => onRemoveFromQueue(item.id)}
                    className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Songs (Moderator Only) */}
      {permissions.canModerate && pendingSongs.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-white mb-2">
            Pending Approval ({pendingSongs.length})
          </h4>
          <div className="space-y-2">
            {pendingSongs.map((song) => (
              <div
                key={song.id}
                className="flex items-center gap-2 p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20"
              >
                <div className="w-8 h-8 rounded bg-yellow-500/20 flex items-center justify-center shrink-0">
                  <Music className="w-4 h-4 text-yellow-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{song.title}</p>
                  <p className="text-xs text-gray-400 truncate">{song.artist}</p>
                </div>
                <button
                  onClick={() => onApproveSong(song.id)}
                  className="p-1 hover:bg-green-500/20 rounded text-green-400"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    const reason = prompt('Rejection reason:');
                    if (reason) onRejectSong(song.id, reason);
                  }}
                  className="p-1 hover:bg-red-500/20 rounded text-red-400"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Hosts Tab
function HostsTab({
  hosts,
  currentSession,
  cohosts,
  permissions,
  onInviteToStage,
  onRemoveCohost,
}: {
  hosts: any[];
  currentSession: any;
  cohosts: any[];
  permissions: any;
  onInviteToStage: (userId: string, role: 'guest' | 'cohost') => void;
  onRemoveCohost: (cohostId: string) => void;
}) {
  const [showInviteModal, setShowInviteModal] = useState(false);

  return (
    <div className="space-y-4">
      {/* Current DJ */}
      {currentSession && (
        <div>
          <h4 className="text-sm font-medium text-white mb-2">DJ</h4>
          <div className="flex items-center gap-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
            {currentSession.dj?.avatar_url ? (
              <img src={currentSession.dj.avatar_url} alt="" className="w-10 h-10 rounded-full" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-purple-500/30 flex items-center justify-center">
                <Mic className="w-5 h-5 text-purple-400" />
              </div>
            )}
            <div>
              <p className="font-medium text-white">{currentSession.dj?.username}</p>
              <p className="text-xs text-purple-400">Live Host</p>
            </div>
          </div>
        </div>
      )}

      {/* Cohosts */}
      <div>
        <h4 className="text-sm font-medium text-white mb-2">
          Co-hosts ({cohosts.length}/{currentSession?.max_cohosts || 3})
        </h4>
        {cohosts.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-2">No co-hosts</p>
        ) : (
          <div className="space-y-2">
            {cohosts.map((cohost) => (
              <div
                key={cohost.id}
                className="flex items-center gap-2 p-2 bg-white/5 rounded-lg"
              >
                {cohost.user?.avatar_url ? (
                  <img src={cohost.user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Mic className="w-4 h-4 text-purple-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{cohost.user?.username}</p>
                  <p className="text-xs text-gray-400">{cohost.role}</p>
                </div>
                {(currentSession?.dj_id === useAuthStore.getState().profile?.id || permissions.isStationAdmin) && (
                  <button
                    onClick={() => onRemoveCohost(cohost.id)}
                    className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-red-400"
                  >
                    <MicOff className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Button */}
      {currentSession && permissions.canInvite && cohosts.length < (currentSession.max_cohosts || 3) && (
        <button
          onClick={() => setShowInviteModal(true)}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Invite to Stage
        </button>
      )}

      {/* Station Hosts List */}
      <div>
        <h4 className="text-sm font-medium text-white mb-2">Station Hosts</h4>
        <div className="space-y-2">
          {hosts.map((host) => (
            <div
              key={host.id}
              className="flex items-center gap-2 p-2 bg-white/5 rounded-lg"
            >
              {host.user?.avatar_url ? (
                <img src={host.user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                  <Mic className="w-4 h-4 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{host.user?.username}</p>
                <p className="text-xs text-gray-400 capitalize">{host.role}</p>
              </div>
            </div>
          ))}
          {hosts.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-2">No hosts assigned</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Chat Tab
function ChatTab({
  messages,
  input,
  onInputChange,
  onSend,
  canChat,
  chatEndRef,
}: {
  messages: TrollStationChat[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  canChat: boolean;
  chatEndRef: React.RefObject<HTMLDivElement>;
}) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex flex-col h-[300px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-2">
        {messages.map((msg) => (
          <div key={msg.id} className="flex items-start gap-2">
            {msg.user?.avatar_url ? (
              <img src={msg.user.avatar_url} alt="" className="w-6 h-6 rounded-full shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-slate-700 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-xs text-gray-400">
                <span className="font-medium text-purple-400">{msg.user?.username}</span>
              </p>
              <p className="text-sm text-white break-words">{msg.message}</p>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      {canChat ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Send a message..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={onSend}
            disabled={!input.trim()}
            className="p-2 bg-purple-500 hover:bg-purple-400 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-500 text-center py-2">Sign in to chat</p>
      )}
    </div>
  );
}

// Submit Tab
function SubmitTab({
  form,
  onChange,
  onSubmit,
  canSubmit,
}: {
  form: any;
  onChange: (form: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  canSubmit: boolean;
}) {
  if (!canSubmit) {
    return (
      <div className="text-center py-8">
        <Music className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">Sign in to submit songs</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Song Title *</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
          required
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          placeholder="Enter song title"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Artist</label>
        <input
          type="text"
          value={form.artist}
          onChange={(e) => onChange({ ...form, artist: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          placeholder="Enter artist name"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Audio URL *</label>
        <input
          type="url"
          value={form.audio_url}
          onChange={(e) => onChange({ ...form, audio_url: e.target.value })}
          required
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          placeholder="https://example.com/song.mp3"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Cover Image URL</label>
        <input
          type="url"
          value={form.cover_url}
          onChange={(e) => onChange({ ...form, cover_url: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          placeholder="https://example.com/cover.jpg"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Category</label>
        <select
          value={form.category}
          onChange={(e) => onChange({ ...form, category: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
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

      <div>
        <label className="block text-xs text-gray-400 mb-1">Tags (comma separated)</label>
        <input
          type="text"
          value={form.tags}
          onChange={(e) => onChange({ ...form, tags: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          placeholder="chill, upbeat, summer"
        />
      </div>

      <button
        type="submit"
        className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-purple-500 hover:bg-purple-400 text-white rounded-lg transition-colors"
      >
        <Upload className="w-4 h-4" />
        Submit Song
      </button>

      <p className="text-xs text-gray-500 text-center">
        Songs are subject to moderation before being added to the queue.
      </p>
    </form>
  );
}
