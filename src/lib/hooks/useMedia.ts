import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import type { 
  Song, Album, ArtistProfile, RecordLabel, SongTip, 
  StudioProject, ChartEntry, ArtistFollower 
} from '@/types/media';
import { toast } from 'sonner';

// Hook for fetching songs
export function useSongs(filters?: { 
  artistId?: string; 
  albumId?: string; 
  genre?: string;
  featured?: boolean;
  limit?: number;
  sortBy?: 'recent' | 'popular' | 'tipped';
}) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Serialize filters for stable dependency comparison
  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    let mounted = true;
    
    const fetchSongs = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('songs')
          .select(`
            *,
            artist:artist_profiles(*),
            album:albums(*)
          `)
          .eq('is_published', true);

        if (filters?.artistId) {
          query = query.eq('artist_id', filters.artistId);
        }
        if (filters?.albumId) {
          query = query.eq('album_id', filters.albumId);
        }
        if (filters?.genre) {
          query = query.eq('genre', filters.genre);
        }
        if (filters?.featured) {
          query = query.eq('featured', true);
        }

        // Apply sorting
        if (filters?.sortBy === 'popular') {
          query = query.order('plays', { ascending: false });
        } else if (filters?.sortBy === 'tipped') {
          query = query.order('tips_total', { ascending: false });
        } else {
          query = query.order('created_at', { ascending: false });
        }

        if (filters?.limit) {
          query = query.limit(filters.limit);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        if (mounted) setSongs(data as Song[] || []);
      } catch (err: any) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchSongs();
    
    return () => { mounted = false; };
  }, [filtersKey]);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('songs')
        .select(`
          *,
          artist:artist_profiles(*),
          album:albums(*)
        `)
        .eq('is_published', true);

      if (filters?.artistId) {
        query = query.eq('artist_id', filters.artistId);
      }
      if (filters?.albumId) {
        query = query.eq('album_id', filters.albumId);
      }
      if (filters?.genre) {
        query = query.eq('genre', filters.genre);
      }
      if (filters?.featured) {
        query = query.eq('featured', true);
      }

      if (filters?.sortBy === 'popular') {
        query = query.order('plays', { ascending: false });
      } else if (filters?.sortBy === 'tipped') {
        query = query.order('tips_total', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setSongs(data as Song[] || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filtersKey]);

  return { songs, loading, error, refetch };
}

// Hook for a single song
export function useSong(songId?: string) {
  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    let mounted = true;
    
    const fetchSong = async () => {
      if (!songId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('songs')
          .select(`
            *,
            artist:artist_profiles(*),
            album:albums(*),
            label:record_labels(*)
          `)
          .eq('id', songId)
          .single();

        if (fetchError) throw fetchError;

        // Check if user has liked this song
        if (user && data) {
          const { data: likeData } = await supabase
            .from('song_likes')
            .select('id')
            .eq('song_id', songId)
            .eq('user_id', user.id)
            .maybeSingle();
          
          (data as Song).is_liked = !!likeData;
        }

        if (mounted) setSong(data as Song);
      } catch (err: any) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchSong();
    return () => { mounted = false; };
  }, [songId, user?.id]);

  // Record play
  const recordPlay = useCallback(async (duration?: number) => {
    if (!songId || !user) return;
    
    try {
      await supabase.rpc('record_song_play', {
        p_song_id: songId,
        p_user_id: user.id,
        p_play_duration: duration,
        p_source: 'song_page'
      });
    } catch (err) {
      console.error('Failed to record play:', err);
    }
  }, [songId, user?.id]);

  // Toggle like
  const toggleLike = useCallback(async () => {
    if (!songId || !user) {
      toast.error('Please sign in to like songs');
      return;
    }

    try {
      if (song?.is_liked) {
        await supabase
          .from('song_likes')
          .delete()
          .eq('song_id', songId)
          .eq('user_id', user.id);
        setSong(prev => prev ? { ...prev, is_liked: false, likes_count: prev.likes_count - 1 } : null);
      } else {
        await supabase
          .from('song_likes')
          .insert({ song_id: songId, user_id: user.id });
        setSong(prev => prev ? { ...prev, is_liked: true, likes_count: prev.likes_count + 1 } : null);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [songId, user?.id, song?.is_liked]);

  // Send tip
  const sendTip = useCallback(async (amount: number, message?: string, isAnonymous = false) => {
    if (!songId || !user) {
      toast.error('Please sign in to tip');
      return null;
    }

    try {
      const { data, error } = await supabase.rpc('process_song_tip', {
        p_song_id: songId,
        p_tipper_user_id: user.id,
        p_amount: amount,
        p_message: message,
        p_is_anonymous: isAnonymous
      });

      if (error) throw error;

      if (data?.success) {
        setSong(prev => prev ? { ...prev, tips_total: prev.tips_total + amount } : null);
        toast.success(`Sent ${amount} coins!`);
        return data;
      } else {
        throw new Error(data?.error || 'Tip failed');
      }
    } catch (err: any) {
      toast.error(err.message);
      return null;
    }
  }, [songId, user?.id]);

  return { song, loading, error, recordPlay, toggleLike, sendTip };
}

// Hook for artist profile
export function useArtistProfile(userId?: string) {
  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();
  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    let mounted = true;
    
    const fetchProfile = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('artist_profiles')
          .select(`
            *,
            label:record_labels(*)
          `)
          .eq('user_id', userId)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (mounted) setProfile(data as ArtistProfile);
      } catch (err: any) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => { mounted = false; };
  }, [userId]);

  const updateProfile = useCallback(async (updates: Partial<ArtistProfile>) => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('artist_profiles')
        .update(updates)
        .eq('id', profile.id)
        .select()
        .single();

      if (error) throw error;
      setProfile(data as ArtistProfile);
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [profile?.id]);

  return { profile, loading, error, isOwnProfile, updateProfile };
}

// Hook for record labels
export function useRecordLabels(options?: { featured?: boolean; ownerId?: string }) {
  const [labels, setLabels] = useState<RecordLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const optionsKey = JSON.stringify(options);

  useEffect(() => {
    let mounted = true;
    
    const fetchLabels = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('record_labels')
          .select('*')
          .eq('is_active', true);

        if (options?.featured) {
          query = query.eq('featured', true);
        }
        if (options?.ownerId) {
          query = query.eq('owner_user_id', options.ownerId);
        }

        const { data, error: fetchError } = await query.order('total_tips', { ascending: false });

        if (fetchError) throw fetchError;
        if (mounted) setLabels(data as RecordLabel[] || []);
      } catch (err: any) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchLabels();
    return () => { mounted = false; };
  }, [optionsKey]);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('record_labels')
        .select('*')
        .eq('is_active', true);

      if (options?.featured) {
        query = query.eq('featured', true);
      }
      if (options?.ownerId) {
        query = query.eq('owner_user_id', options.ownerId);
      }

      const { data, error: fetchError } = await query.order('total_tips', { ascending: false });
      if (fetchError) throw fetchError;
      setLabels(data as RecordLabel[] || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [optionsKey]);

  return { labels, loading, error, refetch };
}

// Hook for a single record label
export function useRecordLabel(labelId?: string) {
  const [label, setLabel] = useState<RecordLabel | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    let mounted = true;
    
    const fetchLabel = async () => {
      if (!labelId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [{ data: labelData, error: labelError }, { data: membersData, error: membersError }] = await Promise.all([
          supabase.from('record_labels').select('*').eq('id', labelId).single(),
          supabase
            .from('label_members')
            .select(`
              *,
              artist:artist_profiles(*)
            `)
            .eq('label_id', labelId)
            .eq('is_active', true)
        ]);

        if (labelError) throw labelError;
        if (membersError) throw membersError;

        if (mounted) {
          setLabel(labelData as RecordLabel);
          setMembers(membersData || []);
        }
      } catch (err: any) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchLabel();
    return () => { mounted = false; };
  }, [labelId]);

  const createLabel = useCallback(async (data: Partial<RecordLabel>) => {
    if (!user) {
      toast.error('Please sign in');
      return null;
    }

    try {
      const { data: newLabel, error } = await supabase
        .from('record_labels')
        .insert({ ...data, owner_user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      toast.success('Record label created!');
      return newLabel as RecordLabel;
    } catch (err: any) {
      toast.error(err.message);
      return null;
    }
  }, [user?.id]);

  return { label, members, loading, error, createLabel };
}

// Hook for albums
export function useAlbums(filters?: { artistId?: string; labelId?: string; limit?: number }) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    let mounted = true;
    
    const fetchAlbums = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('albums')
          .select(`
            *,
            artist:artist_profiles(*)
          `)
          .eq('is_published', true);

        if (filters?.artistId) {
          query = query.eq('artist_id', filters.artistId);
        }
        if (filters?.labelId) {
          query = query.eq('label_id', filters.labelId);
        }

        query = query.order('created_at', { ascending: false });

        if (filters?.limit) {
          query = query.limit(filters.limit);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        if (mounted) setAlbums(data as Album[] || []);
      } catch (err: any) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchAlbums();
    return () => { mounted = false; };
  }, [filtersKey]);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('albums')
        .select(`
          *,
          artist:artist_profiles(*)
        `)
        .eq('is_published', true);

      if (filters?.artistId) {
        query = query.eq('artist_id', filters.artistId);
      }
      if (filters?.labelId) {
        query = query.eq('label_id', filters.labelId);
      }

      query = query.order('created_at', { ascending: false });

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setAlbums(data as Album[] || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filtersKey]);

  return { albums, loading, error, refetch };
}

// Hook for a single album with its songs
export function useAlbum(albumId?: string) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const fetchAlbum = async () => {
      if (!albumId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [{ data: albumData, error: albumError }, { data: songsData, error: songsError }] = await Promise.all([
          supabase
            .from('albums')
            .select(`
              *,
              artist:artist_profiles(*),
              label:record_labels(*)
            `)
            .eq('id', albumId)
            .single(),
          supabase
            .from('songs')
            .select(`
              *,
              artist:artist_profiles(*)
            `)
            .eq('album_id', albumId)
            .eq('is_published', true)
            .order('track_number', { ascending: true })
        ]);

        if (albumError) throw albumError;
        if (songsError) throw songsError;

        if (mounted) {
          setAlbum(albumData as Album);
          setSongs(songsData as Song[] || []);
        }
      } catch (err: any) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchAlbum();
    return () => { mounted = false; };
  }, [albumId]);

  return { album, songs, loading, error };
}

// Hook for trending/charts
export function useCharts(chartType: 'trending' | 'top_tipped' | 'new_releases' | 'local' = 'trending') {
  const [entries, setEntries] = useState<ChartEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const fetchCharts = async () => {
      setLoading(true);
      try {
        // Get songs based on chart type
        let query = supabase
          .from('songs')
          .select(`
            *,
            artist:artist_profiles(*)
          `)
          .eq('is_published', true);

        if (chartType === 'trending') {
          query = query.order('plays', { ascending: false });
        } else if (chartType === 'top_tipped') {
          query = query.order('tips_total', { ascending: false });
        } else if (chartType === 'new_releases') {
          query = query.order('published_at', { ascending: false });
        }

        query = query.limit(50);

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        
        // Map to chart entries format
        const chartEntries = (data as Song[] || []).map((song, index) => ({
          id: `${chartType}-${song.id}`,
          song_id: song.id,
          artist_id: song.artist_id,
          chart_type: chartType,
          position: index + 1,
          plays_count: song.plays,
          tips_count: song.tips_total,
          period_start: new Date().toISOString(),
          period_end: new Date().toISOString(),
          created_at: song.created_at,
          song,
          artist: song.artist
        }));

        if (mounted) setEntries(chartEntries);
      } catch (err: any) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchCharts();
    return () => { mounted = false; };
  }, [chartType]);

  return { entries, loading, error };
}

// Hook for user's uploads/management
export function useMyUploads() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const userIdRef = useRef(user?.id);

  useEffect(() => {
    // Only fetch when user ID changes, not on every user object change
    if (user?.id === userIdRef.current && !loading && songs.length > 0) {
      return;
    }
    userIdRef.current = user?.id;
    
    let mounted = true;
    
    const fetchUploads = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [{ data: songsData }, { data: albumsData }, { data: projectsData }] = await Promise.all([
          supabase.from('songs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('albums').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('studio_projects').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
        ]);

        if (mounted) {
          setSongs(songsData as Song[] || []);
          setAlbums(albumsData as Album[] || []);
          setProjects(projectsData as StudioProject[] || []);
        }
      } catch (err) {
        console.error('Failed to fetch uploads:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchUploads();
    return () => { mounted = false; };
  }, [user?.id]); // Only depend on user.id, not the whole user object

  const publishSong = useCallback(async (songId: string) => {
    try {
      const { error } = await supabase
        .from('songs')
        .update({ is_published: true, published_at: new Date().toISOString() })
        .eq('id', songId);

      if (error) throw error;
      toast.success('Song published!');
      // Refetch
      if (user) {
        const { data } = await supabase.from('songs').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        setSongs(data as Song[] || []);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [user?.id]);

  const deleteSong = useCallback(async (songId: string) => {
    try {
      const { error } = await supabase.from('songs').delete().eq('id', songId);
      if (error) throw error;
      toast.success('Song deleted');
      setSongs(prev => prev.filter(s => s.id !== songId));
    } catch (err: any) {
      toast.error(err.message);
    }
  }, []);

  return { songs, albums, projects, loading, publishSong, deleteSong };
}

// Hook for following artists
export function useArtistFollow(artistId?: string) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const { user } = useAuthStore();
  const artistIdRef = useRef(artistId);

  useEffect(() => {
    // Skip if artistId hasn't changed
    if (artistId === artistIdRef.current && !artistId) {
      return;
    }
    artistIdRef.current = artistId;
    
    if (!artistId || !user) return;

    let mounted = true;

    const checkFollowStatus = async () => {
      const { data } = await supabase
        .from('artist_followers')
        .select('id')
        .eq('artist_id', artistId)
        .eq('follower_user_id', user.id)
        .maybeSingle();

      if (mounted) setIsFollowing(!!data);
    };

    const fetchFollowersCount = async () => {
      const { count } = await supabase
        .from('artist_followers')
        .select('id', { count: 'exact' })
        .eq('artist_id', artistId);

      if (mounted) setFollowersCount(count || 0);
    };

    checkFollowStatus();
    fetchFollowersCount();
    
    return () => { mounted = false; };
  }, [artistId, user?.id]);

  const toggleFollow = useCallback(async () => {
    if (!artistId || !user) {
      toast.error('Please sign in to follow');
      return;
    }

    try {
      if (isFollowing) {
        await supabase
          .from('artist_followers')
          .delete()
          .eq('artist_id', artistId)
          .eq('follower_user_id', user.id);
        setIsFollowing(false);
        setFollowersCount(prev => prev - 1);
      } else {
        await supabase
          .from('artist_followers')
          .insert({ artist_id: artistId, follower_user_id: user.id });
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [artistId, user?.id, isFollowing]);

  return { isFollowing, followersCount, toggleFollow };
}
