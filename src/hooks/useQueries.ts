 import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Query keys
export const queryKeys = {
  streams: ['streams'] as const,
  liveStreams: ['streams', 'live'] as const,
  newUsers: ['users', 'new'] as const,
  userProfile: (id: string) => ['users', 'profile', id] as const,
  followers: (id: string) => ['users', 'followers', id] as const,
  notifications: (id: string) => ['users', 'notifications', id] as const,
}

// Live streams query
export function useLiveStreams() {
  return useQuery({
    queryKey: queryKeys.liveStreams,
    queryFn: async () => {
      // Try cached rankings first
      const { data: ranked, error: rankedError } = await supabase.rpc('get_cached_home_rankings_30m')
      if (!rankedError && Array.isArray(ranked) && ranked.length > 0) {
        let normalizedRanked = ranked.map((s: any) => ({
          ...s,
          user_profiles: Array.isArray(s.user_profiles) ? s.user_profiles[0] : s.user_profiles,
          stream_momentum: Array.isArray(s.stream_momentum) ? s.stream_momentum[0] : s.stream_momentum,
        }))

        // Fill missing thumbnails
        const missingThumbIds = normalizedRanked
          .filter((s) => !s.thumbnail_url)
          .map((s) => s.id)
          .filter(Boolean)

        if (missingThumbIds.length > 0) {
          const { data: streamThumbs } = await supabase
            .from('streams')
            .select('id, thumbnail_url')
            .in('id', missingThumbIds)

          if (streamThumbs?.length) {
            const thumbMap = new Map(streamThumbs.map((row) => [row.id, row.thumbnail_url]))
            normalizedRanked = normalizedRanked.map((s) => ({
              ...s,
              thumbnail_url: s.thumbnail_url || thumbMap.get(s.id) || null,
            }))
          }
        }

        // Sort by birthday first, then momentum
        const today = new Date()
        return normalizedRanked.sort((a: any, b: any) => {
          const aBirthday = a.user_profiles?.date_of_birth
          const bBirthday = b.user_profiles?.date_of_birth

          const aIsBirthday = aBirthday ?
            new Date(aBirthday).getMonth() === today.getMonth() &&
            new Date(aBirthday).getDate() === today.getDate() : false
          const bIsBirthday = bBirthday ?
            new Date(bBirthday).getMonth() === today.getMonth() &&
            new Date(bBirthday).getDate() === today.getDate() : false

          if (aIsBirthday && !bIsBirthday) return -1
          if (!aIsBirthday && bIsBirthday) return 1

          const aMomentum = Number(a.stream_momentum?.momentum ?? 100)
          const bMomentum = Number(b.stream_momentum?.momentum ?? 100)
          if (aMomentum !== bMomentum) return bMomentum - aMomentum

          return 0
        })
      }

      // Fallback to direct query
      const { data, error } = await supabase
        .from('streams')
        .select(`
          id,
          title,
          category,
          current_viewers,
          is_live,
          livekit_url,
          start_time,
          broadcaster_id,
          thumbnail_url,
          stream_momentum (
            momentum,
            last_gift_at,
            last_decay_at
          ),
          user_profiles!broadcaster_id (
            username,
            avatar_url,
            date_of_birth
          )
        `)
        .eq('is_live', true)
        .order('start_time', { ascending: false })

      if (error) throw error

      return (data || []).map((s: any) => ({
        ...s,
        user_profiles: Array.isArray(s.user_profiles) ? s.user_profiles[0] : s.user_profiles,
        stream_momentum: Array.isArray(s.stream_momentum) ? s.stream_momentum[0] : s.stream_momentum,
      }))
    },
    refetchInterval: 10000, // Poll every 10 seconds
  })
}

// New users query
export function useNewUsers() {
  return useQuery({
    queryKey: queryKeys.newUsers,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, tier, level, troll_coins, created_at, role, is_banned, banned_until, rgb_username_expires_at')
        .order('created_at', { ascending: false })
        .limit(25)

      if (error) throw error

      // Filter real users
      return (data || []).filter(user => {
        if (user.role === 'admin') return false

        const username = (user.username || '').toLowerCase()

        const isRealUser = !username.includes('test') &&
                         !username.includes('demo') &&
                         !username.includes('mock')

        const isNotBanned = !user.is_banned && (!user.banned_until || new Date(user.banned_until) < new Date())

        return isRealUser && isNotBanned
      }).slice(0, 20) // Take top 20
    },
    refetchInterval: 30000, // Poll every 30 seconds
  })
}

// Stream by ID query
export function useStream(streamId: string) {
  return useQuery({
    queryKey: ['streams', streamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('streams')
        .select('*')
        .eq('id', streamId)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!streamId,
    staleTime: 5000, // Consider fresh for 5 seconds
  })
}

// User profile query
export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: queryKeys.userProfile(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute
  })
}
