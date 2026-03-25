import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import type { 
  TMMatch, 
  TMProfileView, 
  TMInterest, 
  TMGender, 
  TMPreference,
  TMMessagePricing,
  TMAllUser 
} from '../types/trollMatch';

// Cache for matches
let matchesCache: { data: TMMatch[]; timestamp: number } | null = null;
const CACHE_DURATION = 30000; // 30 seconds

// Hook to get TM matches
export function useTMMatches(dating: boolean = false, limit: number = 20) {
  const { user, profile } = useAuthStore();
  const [matches, setMatches] = useState<TMMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    if (!user || !profile) {
      setLoading(false);
      return;
    }

    // Check cache
    const now = Date.now();
    if (matchesCache && matchesCache.timestamp > now - CACHE_DURATION) {
      const filtered = dating 
        ? matchesCache.data 
        : matchesCache.data.filter(m => m.shared_interests.length > 0);
      setMatches(filtered.slice(0, limit));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('get_tm_matches', {
        p_user_id: user.id,
        p_dating: dating,
        p_limit: limit
      });

      if (rpcError) throw rpcError;

      // Get message prices for all matches
      const userIds = data.map((m: TMMatch) => m.user_id);
      const { data: priceData } = await supabase
        .from('user_profiles')
        .select('id, message_price')
        .in('id', userIds);

      const pricesMap = new Map(priceData?.map((p: { id: string; message_price: number }) => 
        [p.id, p.message_price]
      ) || []);

      const matchesWithPrices = data.map((m: TMMatch) => ({
        ...m,
        message_price: pricesMap.get(m.user_id) || 0
      }));

      setMatches(matchesWithPrices);
      
      // Update cache
      matchesCache = { data: matchesWithPrices, timestamp: now };
    } catch (err: any) {
      console.error('Error fetching TM matches:', err);
      setError(err.message || 'Failed to fetch matches');
    } finally {
      setLoading(false);
    }
  }, [user, profile, dating, limit]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // Clear cache when fetching new matches
  const refetch = useCallback(() => {
    matchesCache = null;
    fetchMatches();
  }, [fetchMatches]);

  return { matches, loading, error, refetch };
}

// Hook to get users who viewed current user's profile
export function useTMViewedMe(limit: number = 50) {
  const { user } = useAuthStore();
  const [viewers, setViewers] = useState<TMProfileView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchViewers = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('get_viewed_me_users', {
        p_user_id: user.id,
        p_limit: limit
      });

      if (rpcError) throw rpcError;

      // Dedup: keep only latest view per user
      const deduped = data.reduce((acc: TMProfileView[], current: TMProfileView) => {
        const exists = acc.find(v => v.viewer_id === current.viewer_id);
        if (!exists) {
          acc.push(current);
        }
        return acc;
      }, []);

      setViewers(deduped);
    } catch (err: any) {
      console.error('Error fetching viewed me:', err);
      setError(err.message || 'Failed to fetch viewers');
    } finally {
      setLoading(false);
    }
  }, [user, limit]);

  useEffect(() => {
    fetchViewers();
  }, [fetchViewers]);

  const refetch = useCallback(() => {
    fetchViewers();
  }, [fetchViewers]);

  return { viewers, loading, error, refetch };
}

// Hook to record a profile view
export function useTMRecordView() {
  const { user } = useAuthStore();

  const recordView = useCallback(async (viewedUserId: string) => {
    if (!user || user.id === viewedUserId) return;

    try {
      await supabase.rpc('record_profile_view', {
        p_viewer_id: user.id,
        p_viewed_user_id: viewedUserId
      });
    } catch (err) {
      console.error('Error recording profile view:', err);
    }
  }, [user]);

  return { recordView };
}

// Hook to update TM profile
export function useTMUpdateProfile() {
  const { user } = useAuthStore();

  const updateProfile = useCallback(async (params: {
    interests?: TMInterest[];
    datingEnabled?: boolean;
    gender?: TMGender | null;
    preference?: TMPreference[];
    messagePrice?: number;
  }) => {
    if (!user) return;

    try {
      await supabase.rpc('update_tm_profile', {
        p_user_id: user.id,
        p_interests: params.interests || null,
        p_dating_enabled: params.datingEnabled ?? null,
        p_gender: params.gender || null,
        p_preference: params.preference || null,
        p_message_price: params.messagePrice ?? null
      });

      // Clear matches cache on profile update
      matchesCache = null;
    } catch (err) {
      console.error('Error updating TM profile:', err);
      throw err;
    }
  }, [user]);

  return { updateProfile };
}

// Hook to send TM message via TCPS
export function useTMSendMessage() {
  const { user, profile } = useAuthStore();

  const sendMessage = useCallback(async (
    receiverId: string, 
    message: string,
    price: number = 0
  ) => {
    if (!user || !profile) {
      throw new Error('Must be logged in to send messages');
    }

    // Check coin balance if price > 0
    if (price > 0) {
      if (profile.troll_coins < price) {
        throw new Error('Insufficient coins');
      }
    }

    try {
      // Deduct coins by updating user profile directly
      if (price > 0) {
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ 
            troll_coins: profile.troll_coins - price,
            total_spent_coins: (profile.total_spent_coins || 0) + price
          })
          .eq('id', user.id);

        if (updateError) throw updateError;
      }

      // Send message
      const { data, error: msgError } = await supabase.rpc('send_tm_message', {
        p_sender_id: user.id,
        p_receiver_id: receiverId,
        p_message: message,
        p_price_paid: price
      });

      if (msgError) throw msgError;

      return data;
    } catch (err: any) {
      console.error('Error sending TM message:', err);
      throw err;
    }
  }, [user, profile]);

  return { sendMessage };
}

// Hook to get message pricing for a user
export function useTMMessagePricing(userId: string) {
  const [pricing, setPricing] = useState<TMMessagePricing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchPricing = async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, username, message_price')
          .eq('id', userId)
          .single();

        if (error) throw error;

        setPricing({
          userId: data.id,
          price: data.message_price || 0,
          username: data.username
        });
      } catch (err) {
        console.error('Error fetching message pricing:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPricing();
  }, [userId]);

  return { pricing, loading };
}

// Hook to check if user needs onboarding
export function useTMNeedsOnboarding() {
  const { profile } = useAuthStore();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }

    // Check if user has any interests set
    const hasInterests = profile.interests && profile.interests.length > 0;
    setNeedsOnboarding(!hasInterests);
    setLoading(false);
  }, [profile]);

  return { needsOnboarding, loading };
}

// Hook to get user profile data for TM
export function useTMProfile() {
  const { profile } = useAuthStore();

  return {
    interests: (profile?.interests || []) as TMInterest[],
    datingEnabled: profile?.dating_enabled || false,
    gender: (profile?.gender || null) as TMGender | null,
    preference: (profile?.preference || []) as TMPreference[],
    messagePrice: profile?.message_price || 0,
  };
}

// Hook to handle family invites
export function useTMFamilyInvites() {
  const { user } = useAuthStore();

  const createInvite = useCallback(async (inviteeId: string, familyId: string) => {
    if (!user) throw new Error('Must be logged in');

    try {
      const { data, error } = await supabase.rpc('create_family_invite', {
        p_inviter_id: user.id,
        p_invitee_id: inviteeId,
        p_family_id: familyId
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error creating family invite:', err);
      throw err;
    }
  }, [user]);

  const respondToInvite = useCallback(async (inviteId: string, status: 'accepted' | 'declined') => {
    try {
      const { error } = await supabase.rpc('respond_family_invite', {
        p_invite_id: inviteId,
        p_status: status
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error responding to family invite:', err);
      throw err;
    }
  }, []);

  return { createInvite, respondToInvite };
}

// NEW USERS THRESHOLD (in milliseconds) - users created within this time are considered "new"
const NEW_USER_THRESHOLD = 7 * 24 * 60 * 60 * 1000; // 7 days

// Cache for all users
let allUsersCache: { data: TMAllUser[]; newUserIds: Set<string>; timestamp: number } | null = null;

// Hook to get all users with their live broadcasting status
export function useTMAllUsers(limit: number = 100) {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<TMAllUser[]>(() => {
    if (allUsersCache && allUsersCache.timestamp > Date.now() - 10000) {
      return allUsersCache.data;
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (allUsersCache && allUsersCache.timestamp > Date.now() - 10000) {
      return false;
    }
    return true;
  });
  const [error, setError] = useState<string | null>(null);
  const [newUserIds, setNewUserIds] = useState<Set<string>>(() => {
    if (allUsersCache && allUsersCache.timestamp > Date.now() - 10000) {
      return allUsersCache.newUserIds;
    }
    return new Set();
  });
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchUsers = useCallback(async (useCache: boolean = true) => {
    // Check cache first if useCache is true
    if (useCache && allUsersCache && allUsersCache.timestamp > Date.now() - 10000) {
      setUsers(allUsersCache.data);
      setNewUserIds(allUsersCache.newUserIds);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get all user profiles with their basic info
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, interests, is_online, last_active, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      // Get active sessions to determine who's really online
      const { data: activeSessionsData, error: sessionsError } = await supabase
        .from('active_sessions')
        .select('user_id, is_active, last_active')
        .eq('is_active', true);

      // Create a map of user_id -> session status
      const activeSessionsMap = new Map<string, { isActive: boolean; lastActive: string }>();
      activeSessionsData?.forEach((session) => {
        activeSessionsMap.set(session.user_id, {
          isActive: session.is_active,
          lastActive: session.last_active
        });
      });

      if (profilesError) throw profilesError;

      // Get all currently live streams to know who's broadcasting
      const { data: liveStreamsData, error: streamsError } = await supabase
        .from('streams')
        .select('id, user_id, current_viewers')
        .eq('is_live', true)
        .eq('status', 'live');

      if (streamsError) throw streamsError;

      // Create a map of user_id -> stream info
      const liveStreamsMap = new Map<string, { stream_id: string; current_viewers: number }>();
      liveStreamsData?.forEach((stream) => {
        liveStreamsMap.set(stream.user_id, {
          stream_id: stream.id,
          current_viewers: stream.current_viewers || 0
        });
      });

      // Calculate which users are new (joined within last 7 days)
      const now = new Date();
      const newUsers = new Set<string>();

      // Transform data into TMAllUser format
      const allUsers: TMAllUser[] = (profilesData || []).map((profile) => {
        const createdAt = new Date(profile.created_at || profile.last_active || now);
        const isNewUser = (now.getTime() - createdAt.getTime()) < NEW_USER_THRESHOLD;
        
        if (isNewUser) {
          newUsers.add(profile.id);
        }

        const streamInfo = liveStreamsMap.get(profile.id);
        
        // Check active_sessions for real online status
        const sessionInfo = activeSessionsMap.get(profile.id);
        const isOnlineNow = sessionInfo?.isActive === true || profile.is_online === true;

        return {
          user_id: profile.id,
          username: profile.username || 'Unknown',
          avatar_url: profile.avatar_url,
          interests: (profile.interests || []) as TMInterest[],
          is_online: isOnlineNow,
          last_active: sessionInfo?.lastActive || profile.last_active,
          created_at: profile.created_at,
          is_live: !!streamInfo,
          stream_id: streamInfo?.stream_id || null,
          current_viewers: streamInfo?.current_viewers || 0
        };
      });

      // Update cache
      allUsersCache = { data: allUsers, newUserIds: newUsers, timestamp: Date.now() };
      
      setUsers(allUsers);
      setNewUserIds(newUsers);
    } catch (err: any) {
      console.error('Error fetching all users:', err);
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Set up realtime subscription for new users and live status changes
  useEffect(() => {
    // Initial fetch
    fetchUsers();

    // Subscribe to user_profiles changes for new users
    const channel = supabase
      .channel('tm-all-users-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_profiles',
        },
        (payload) => {
          console.log('[useTMAllUsers] New user detected:', payload.new);
          // Add new user to the list and to newUserIds
          const newUser = payload.new as any;
          const now = new Date();
          const createdAt = new Date(newUser.created_at || now);
          const isNewUser = (now.getTime() - createdAt.getTime()) < NEW_USER_THRESHOLD;

          const tmUser: TMAllUser = {
            user_id: newUser.id,
            username: newUser.username || 'Unknown',
            avatar_url: newUser.avatar_url,
            interests: (newUser.interests || []) as TMInterest[],
            is_online: false,
            last_active: newUser.last_active,
            created_at: newUser.created_at,
            is_live: false,
            stream_id: null,
            current_viewers: 0
          };

          setUsers((prev) => [tmUser, ...prev]);
          if (isNewUser) {
            setNewUserIds((prev) => new Set([...prev, newUser.id]));
          }

          // Play a notification sound or show toast for new users
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
        },
        (payload) => {
          console.log('[useTMAllUsers] User profile updated:', payload.new);
          // Could update existing user data here if needed
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'streams',
          filter: 'is_live=eq.true',
        },
        (payload) => {
          console.log('[useTMAllUsers] Stream started:', payload.new);
          // User went live - update their status
          const stream = payload.new as any;
          setUsers((prev) =>
            prev.map((u) =>
              u.user_id === stream.user_id
                ? { ...u, is_live: true, stream_id: stream.id, current_viewers: stream.current_viewers || 0 }
                : u
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
          filter: 'is_live=eq.false',
        },
        (payload) => {
          console.log('[useTMAllUsers] Stream ended:', payload.old);
          // User went offline - update their status
          const stream = payload.old as any;
          setUsers((prev) =>
            prev.map((u) =>
              u.user_id === stream.user_id
                ? { ...u, is_live: false, stream_id: null, current_viewers: 0 }
                : u
            )
          );
        }
      )
      .subscribe((status) => {
        console.log('[useTMAllUsers] Realtime channel status:', status);
      });

    channelRef.current = channel;

    // Polling fallback to ensure we stay in sync
    const interval = setInterval(fetchUsers, 30000); // Refresh every 30 seconds

    return () => {
      clearInterval(interval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [fetchUsers]);

  const refetch = useCallback(() => {
    allUsersCache = null; // Clear cache on refetch
    fetchUsers(false);
  }, [fetchUsers]);

  // Prefetch users - can be called before navigating to the page
  const prefetch = useCallback(() => {
    fetchUsers(true);
  }, [fetchUsers]);

  return { users, loading, error, refetch, newUserIds, prefetch };
}

// Export a global prefetch function that can be used without the hook
export function prefetchTMUsers() {
  if (allUsersCache && allUsersCache.timestamp > Date.now() - 10000) {
    return; // Already cached
  }
  
  supabase
    .from('user_profiles')
    .select('id, username, avatar_url, interests, is_online, last_active, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
    .then(({ data: profilesData, error: profilesError }) => {
      if (profilesError) return;
      
      supabase
        .from('active_sessions')
        .select('user_id, is_active, last_active')
        .eq('is_active', true)
        .then(({ data: activeSessionsData }) => {
          const activeSessionsMap = new Map<string, { isActive: boolean; lastActive: string }>();
          activeSessionsData?.forEach((session) => {
            activeSessionsMap.set(session.user_id, {
              isActive: session.is_active,
              lastActive: session.last_active
            });
          });
          
          supabase
            .from('streams')
            .select('id, user_id, current_viewers')
            .eq('is_live', true)
            .eq('status', 'live')
            .then(({ data: liveStreamsData }) => {
              const liveStreamsMap = new Map<string, { stream_id: string; current_viewers: number }>();
              liveStreamsData?.forEach((stream) => {
                liveStreamsMap.set(stream.user_id, {
                  stream_id: stream.id,
                  current_viewers: stream.current_viewers || 0
                });
              });
              
              // Transform and cache the data
              const now = new Date();
              const newUsers = new Set<string>();
              const allUsers: TMAllUser[] = (profilesData || []).map((profile) => {
                const createdAt = new Date(profile.created_at || profile.last_active || now);
                const isNewUser = (now.getTime() - createdAt.getTime()) < NEW_USER_THRESHOLD;
                
                if (isNewUser) {
                  newUsers.add(profile.id);
                }

                const streamInfo = liveStreamsMap.get(profile.id);
                const sessionInfo = activeSessionsMap.get(profile.id);
                const isOnlineNow = sessionInfo?.isActive === true || profile.is_online === true;

                return {
                  user_id: profile.id,
                  username: profile.username || 'Unknown',
                  avatar_url: profile.avatar_url,
                  interests: (profile.interests || []) as TMInterest[],
                  is_online: isOnlineNow,
                  last_active: sessionInfo?.lastActive || profile.last_active,
                  created_at: profile.created_at,
                  is_live: !!streamInfo,
                  stream_id: streamInfo?.stream_id || null,
                  current_viewers: streamInfo?.current_viewers || 0
                };
              });
              
              allUsersCache = { 
                data: allUsers, 
                newUserIds: newUsers, 
                timestamp: Date.now() 
              };
            });
        });
    });
}
