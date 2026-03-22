import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type {
  TrollStation,
  TrollStationSong,
  TrollStationQueue,
  TrollStationSession,
  TrollStationCohost,
  TrollStationChat,
  TrollStationHost,
  StationTab,
  AudioState,
  VoiceState,
  StationPermissions,
} from '@/types/trollStation';

interface TrollStationState {
  // Station state
  station: TrollStation | null;
  currentSong: TrollStationSong | null;
  queue: TrollStationQueue[];
  currentSession: TrollStationSession | null;
  cohosts: TrollStationCohost[];
  hosts: TrollStationHost[];
  
  // Audio state
  audio: AudioState;
  voice: VoiceState;
  
  // UI state
  isExpanded: boolean;
  activeTab: StationTab;
  isPanelOpen: boolean;
  
  // Permissions
  permissions: StationPermissions;
  
  // Loading states
  isLoading: boolean;
  isLoadingQueue: boolean;
  isLoadingSession: boolean;
  
  // Actions
  fetchStation: () => Promise<void>;
  fetchQueue: () => Promise<void>;
  fetchCurrentSession: () => Promise<void>;
  fetchHosts: () => Promise<void>;
  checkPermissions: (userId: string) => Promise<void>;
  
  // Audio actions
  setPlaying: (isPlaying: boolean) => void;
  setVolume: (volume: number) => void;
  setMuted: (isMuted: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setBuffering: (isBuffering: boolean) => void;
  
  // Voice actions
  setVoiceConnected: (connected: boolean) => void;
  setSpeaking: (isSpeaking: boolean) => void;
  setAudienceCount: (count: number) => void;
  updateSpeakers: (speakers: VoiceState['speakers']) => void;
  
  // UI actions
  setExpanded: (expanded: boolean) => void;
  setActiveTab: (tab: StationTab) => void;
  setPanelOpen: (open: boolean) => void;
  
  // Queue actions
  addToQueue: (songId: string) => Promise<void>;
  removeFromQueue: (queueId: string) => Promise<void>;
  reorderQueue: (queue: TrollStationQueue[]) => Promise<void>;
  playNext: () => Promise<void>;
  
  // Session actions
  startSession: (title: string, description?: string) => Promise<void>;
  endSession: () => Promise<void>;
  inviteToStage: (userId: string, role: 'guest' | 'cohost') => Promise<void>;
  removeCohost: (cohostId: string) => Promise<void>;
  respondToInvitation: (invitationId: string, accept: boolean) => Promise<void>;
  
  // Song actions
  submitSong: (song: Omit<TrollStationSong, 'id' | 'created_at' | 'updated_at' | 'status' | 'plays_count' | 'likes_count' | 'submitter'>) => Promise<void>;
  approveSong: (songId: string) => Promise<void>;
  rejectSong: (songId: string, reason: string) => Promise<void>;
}

const defaultAudioState: AudioState = {
  isPlaying: false,
  isMuted: false,
  volume: 0.8,
  currentTime: 0,
  duration: 0,
  isBuffering: false,
};

const defaultVoiceState: VoiceState = {
  isSpeaking: false,
  isConnected: false,
  audienceCount: 0,
  speakers: [],
};

const defaultPermissions: StationPermissions = {
  isStationAdmin: false,
  isStationManager: false,
  isDJ: false,
  canControlQueue: false,
  canInvite: false,
  canModerate: false,
  canSubmit: true,
  canChat: true,
};

export const useTrollStationStore = create<TrollStationState>((set, get) => ({
  // Initial state
  station: null,
  currentSong: null,
  queue: [],
  currentSession: null,
  cohosts: [],
  hosts: [],
  audio: defaultAudioState,
  voice: defaultVoiceState,
  isExpanded: false,
  activeTab: 'nowPlaying',
  isPanelOpen: false,
  permissions: defaultPermissions,
  isLoading: false,
  isLoadingQueue: false,
  isLoadingSession: false,

  // Fetch station data
  fetchStation: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('troll_station')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (!data) {
        set({ station: null, currentSong: null, isLoading: false });
        return;
      }
      
      // Fetch current song if there's a song ID
      let currentSong = null;
      if (data.current_song_id) {
        const { data: songData } = await supabase
          .from('troll_station_songs')
          .select('*, submitter:user_profiles(id, username, avatar_url)')
          .eq('id', data.current_song_id)
          .maybeSingle();
        currentSong = songData;
      }

      set({ station: data, currentSong, isLoading: false });
    } catch (error) {
      console.error('Error fetching station:', error);
      set({ isLoading: false });
    }
  },

  // Fetch queue
  fetchQueue: async () => {
    set({ isLoadingQueue: true });
    try {
      const { data, error } = await supabase
        .from('troll_station_queue')
        .select('*, song:troll_station_songs(*, submitter:user_profiles(id, username, avatar_url))')
        .order('position', { ascending: true });

      if (error) throw error;
      set({ queue: data || [], isLoadingQueue: false });
    } catch (error) {
      console.error('Error fetching queue:', error);
      set({ isLoadingQueue: false });
    }
  },

  // Fetch current session
  fetchCurrentSession: async () => {
    set({ isLoadingSession: true });
    try {
      const { data, error } = await supabase
        .from('troll_station_sessions')
        .select('*, dj:user_profiles(id, username, avatar_url), cohosts:troll_station_cohosts(*, user:user_profiles(id, username, avatar_url))')
        .eq('status', 'live')
        .order('actual_start', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        set({ 
          currentSession: data, 
          cohosts: data.cohosts || [],
          isLoadingSession: false 
        });
        
        // Update station mode
        await supabase
          .from('troll_station')
          .update({ current_mode: 'live', is_online: true })
          .eq('id', '00000000-0000-0000-0000-000000000001');
      } else {
        set({ currentSession: null, cohosts: [], isLoadingSession: false });
        
        // Update station mode to auto
        await supabase
          .from('troll_station')
          .update({ current_mode: 'auto', is_online: false })
          .eq('id', '00000000-0000-0000-0000-000000000001');
      }
    } catch (error) {
      console.error('Error fetching session:', error);
      set({ isLoadingSession: false });
    }
  },

  // Fetch hosts
  fetchHosts: async () => {
    try {
      // Fetch hosts without embedding to avoid relationship issues
      const { data, error } = await supabase
        .from('troll_station_hosts')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      set({ hosts: data || [] });
    } catch (error) {
      console.error('Error fetching hosts:', error);
    }
  },

  // Check user permissions
  checkPermissions: async (userId: string) => {
    try {
      // Check if user is a host
      const { data: hostData } = await supabase
        .from('troll_station_hosts')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Check user role from profiles
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, is_admin')
        .eq('id', userId)
        .single();

      const isAdmin = profile?.role === 'admin' || profile?.is_admin;
      const isHost = !!hostData;

      const permissions: StationPermissions = {
        isStationAdmin: isAdmin || hostData?.role === 'admin',
        isStationManager: isAdmin || hostData?.role === 'manager',
        isDJ: isHost,
        canControlQueue: isHost || hostData?.can_invite === true,
        canInvite: isHost || isAdmin,
        canModerate: isAdmin || hostData?.can_moderate === true,
        canSubmit: true,
        canChat: true,
      };

      set({ permissions });
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  },

  // Audio actions
  setPlaying: (isPlaying) => set((state) => ({ 
    audio: { ...state.audio, isPlaying } 
  })),
  
  setVolume: (volume) => set((state) => ({ 
    audio: { ...state.audio, volume } 
  })),
  
  setMuted: (isMuted) => set((state) => ({ 
    audio: { ...state.audio, isMuted } 
  })),
  
  setCurrentTime: (currentTime) => set((state) => ({ 
    audio: { ...state.audio, currentTime } 
  })),
  
  setDuration: (duration) => set((state) => ({ 
    audio: { ...state.audio, duration } 
  })),
  
  setBuffering: (isBuffering) => set((state) => ({ 
    audio: { ...state.audio, isBuffering } 
  })),

  // Voice actions
  setVoiceConnected: (connected) => set((state) => ({ 
    voice: { ...state.voice, isConnected: connected } 
  })),
  
  setSpeaking: (isSpeaking) => set((state) => ({ 
    voice: { ...state.voice, isSpeaking } 
  })),
  
  setAudienceCount: (count) => set((state) => ({ 
    voice: { ...state.voice, audienceCount: count } 
  })),
  
  updateSpeakers: (speakers) => set((state) => ({ 
    voice: { ...state.voice, speakers } 
  })),

  // UI actions
  setExpanded: (expanded) => set({ isExpanded: expanded }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setPanelOpen: (open) => set({ isPanelOpen: open }),

  // Queue actions
  addToQueue: async (songId) => {
    const { queue } = get();
    const position = queue.length + 1;
    
    try {
      const { error } = await supabase
        .from('troll_station_queue')
        .insert({ song_id: songId, position });

      if (error) throw error;
      get().fetchQueue();
    } catch (error) {
      console.error('Error adding to queue:', error);
    }
  },

  removeFromQueue: async (queueId) => {
    try {
      const { error } = await supabase
        .from('troll_station_queue')
        .delete()
        .eq('id', queueId);

      if (error) throw error;
      get().fetchQueue();
    } catch (error) {
      console.error('Error removing from queue:', error);
    }
  },

  reorderQueue: async (queue) => {
    try {
      // Update positions
      for (let i = 0; i < queue.length; i++) {
        await supabase
          .from('troll_station_queue')
          .update({ position: i + 1 })
          .eq('id', queue[i].id);
      }
      get().fetchQueue();
    } catch (error) {
      console.error('Error reordering queue:', error);
    }
  },

  playNext: async () => {
    const { queue, station } = get();
    if (queue.length === 0 || !station) return;

    const nextSong = queue[0];
    
    try {
      // Mark current as played
      await supabase
        .from('troll_station_queue')
        .update({ played_at: new Date().toISOString() })
        .eq('id', nextSong.id);

      // Update station
      await supabase
        .from('troll_station')
        .update({
          current_song_id: nextSong.song_id,
          current_track_start: new Date().toISOString(),
        })
        .eq('id', station.id);

      // Remove from queue
      await supabase
        .from('troll_station_queue')
        .delete()
        .eq('id', nextSong.id);

      // Re-fetch
      get().fetchStation();
      get().fetchQueue();
    } catch (error) {
      console.error('Error playing next:', error);
    }
  },

  // Session actions
  startSession: async (title, description) => {
    const { permissions } = get();
    
    // For now, allow any logged-in user to start a session (for testing)
    // In production, you'd want: if (!permissions.isDJ && !permissions.isStationAdmin && !permissions.isStationManager)
    if (!permissions.isDJ && !permissions.isStationAdmin && !permissions.isStationManager) {
      console.log('Note: Starting session without DJ permissions (allowed for testing)');
    }

    try {
      console.log('Starting session:', title);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      console.log('User ID:', user.id);

      // Check if station exists first
      const { data: stationData, error: stationCheckError } = await supabase
        .from('troll_station')
        .select('id')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single();

      if (stationCheckError) {
        console.error('Station check error:', stationCheckError);
        throw new Error('Station not found. Please run the SQL first.');
      }

      console.log('Station exists:', stationData);

      // Generate unique room name for LiveKit
      const roomName = `troll-station-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      console.log('Inserting session with dj_id:', user.id);
      
      const { data, error } = await supabase
        .from('troll_station_sessions')
        .insert({
          dj_id: user.id,
          title,
          description,
          status: 'live',
          actual_start: new Date().toISOString(),
          livekit_room_name: roomName,
        })
        .select();

      if (error) {
        console.error('Error inserting session:', error);
        throw error;
      }

      console.log('Session inserted:', data);

      // Update station to online
      const { error: stationError } = await supabase
        .from('troll_station')
        .update({ 
          current_mode: 'live', 
          is_online: true,
          livekit_room_name: roomName,
          current_dj_id: user.id
        })
        .eq('id', '00000000-0000-0000-0000-000000000001');

      if (stationError) {
        console.error('Error updating station:', stationError);
      }

      get().fetchCurrentSession();
      get().fetchStation();
      console.log('Session started successfully with room:', roomName);
    } catch (error) {
      console.error('Error starting session:', error);
      throw error;
    }
  },

  endSession: async () => {
    const { currentSession, permissions } = get();
    if (!currentSession) {
      console.log('No current session to end');
      return;
    }

    // Check if user is the DJ of this session or is an admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('Not authenticated');
      return;
    }

    // Allow ending if: user is the DJ, or is admin, or has station permissions
    const isSessionDJ = currentSession.dj_id === user.id;
    if (!isSessionDJ && !permissions.isStationAdmin && !permissions.isStationManager) {
      console.error('Not authorized to end this session');
      return;
    }

    try {
      console.log('Ending session:', currentSession.id);
      
      const { error: sessionError } = await supabase
        .from('troll_station_sessions')
        .update({
          status: 'ended',
          actual_end: new Date().toISOString(),
        })
        .eq('id', currentSession.id);

      if (sessionError) {
        console.error('Error ending session:', sessionError);
        throw sessionError;
      }

      // Update station
      const { error: stationError } = await supabase
        .from('troll_station')
        .update({ current_mode: 'auto', is_online: false, livekit_room_name: null })
        .eq('id', '00000000-0000-0000-0000-000000000001');

      if (stationError) {
        console.error('Error updating station:', stationError);
      }

      set({ currentSession: null, cohosts: [] });
      get().fetchStation();
      console.log('Session ended successfully');
    } catch (error) {
      console.error('Error ending session:', error);
    }
  },

  inviteToStage: async (userId, role) => {
    const { currentSession, permissions } = get();
    if (!currentSession || !permissions.canInvite) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('troll_station_invitations')
        .insert({
          session_id: currentSession.id,
          invited_by: user.id,
          invited_user_id: userId,
          role,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error inviting to stage:', error);
      throw error;
    }
  },

  removeCohost: async (cohostId) => {
    try {
      await supabase
        .from('troll_station_cohosts')
        .update({ removed_at: new Date().toISOString() })
        .eq('id', cohostId);

      const { cohosts } = get();
      set({ cohosts: cohosts.filter(c => c.id !== cohostId) });
    } catch (error) {
      console.error('Error removing cohost:', error);
    }
  },

  respondToInvitation: async (invitationId, accept) => {
    try {
      if (accept) {
        // Add as cohost
        const { data: invitation } = await supabase
          .from('troll_station_invitations')
          .select('session_id, role')
          .eq('id', invitationId)
          .single();

        if (invitation) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Not authenticated');

          await supabase
            .from('troll_station_cohosts')
            .insert({
              session_id: invitation.session_id,
              user_id: user.id,
              role: invitation.role,
              can_control_queue: invitation.role === 'cohost',
            });
        }

        await supabase
          .from('troll_station_invitations')
          .update({ status: 'accepted', responded_at: new Date().toISOString() })
          .eq('id', invitationId);
      } else {
        await supabase
          .from('troll_station_invitations')
          .update({ status: 'declined', responded_at: new Date().toISOString() })
          .eq('id', invitationId);
      }

      get().fetchCurrentSession();
    } catch (error) {
      console.error('Error responding to invitation:', error);
      throw error;
    }
  },

  // Song actions
  submitSong: async (song) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('troll_station_songs')
        .insert({ ...song, submitted_by: user.id });

      if (error) throw error;
    } catch (error) {
      console.error('Error submitting song:', error);
      throw error;
    }
  },

  approveSong: async (songId) => {
    try {
      const { error } = await supabase
        .from('troll_station_songs')
        .update({ status: 'approved' })
        .eq('id', songId);

      if (error) throw error;
    } catch (error) {
      console.error('Error approving song:', error);
      throw error;
    }
  },

  rejectSong: async (songId, reason) => {
    try {
      const { error } = await supabase
        .from('troll_station_songs')
        .update({ status: 'rejected', rejection_reason: reason })
        .eq('id', songId);

      if (error) throw error;
    } catch (error) {
      console.error('Error rejecting song:', error);
      throw error;
    }
  },
}));
