import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { Users, Crown, Search, Star, ArrowUpDown, ChevronDown, ChevronUp, Zap } from 'lucide-react'

// Optimized types - only select needed columns
interface FamilyRow {
  id: string
  name: string
  description: string | null
  icon_emoji: string | null
  emoji: string | null
  banner_url: string | null
  level: number | null
  total_coins: number | null
  member_count: number | null
  is_featured: boolean | null
  created_at: string | null
}

// Sort options for families
type SortOption = 'newest' | 'members' | 'coins'

// Pagination config
const PAGE_SIZE = 20

export default function FamilyBrowse() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  
  // State management
  const [families, setFamilies] = useState<FamilyRow[]>([])
  const [featuredFamilies, setFeaturedFamilies] = useState<FamilyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  
  // User membership state
  const [userFamilyId, setUserFamilyId] = useState<string | null>(null)
  const [membershipChecked, setMembershipChecked] = useState(false)

  // Build optimized query with selected columns only
  const buildFamilyQuery = useCallback((pageNum: number, sort: SortOption, searchQuery: string) => {
    const start = pageNum * PAGE_SIZE
    const end = start + PAGE_SIZE - 1
    
    let query = supabase
      .from('troll_families')
      .select('id, name, description, icon_emoji, emoji, banner_url, level, total_coins, member_count, is_featured, created_at')
    
    // Apply search filter (name + description)
    if (searchQuery.trim()) {
      const searchTerm = searchQuery.trim().toLowerCase()
      query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
    }
    
    // Apply sorting
    switch (sort) {
      case 'members':
        query = query.order('member_count', { ascending: false, nullsFirst: false })
        break
      case 'coins':
        query = query.order('total_coins', { ascending: false, nullsFirst: false })
        break
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false })
    }
    
    // Apply pagination
    query = query.range(start, end)
    
    return query
  }, [])

  // Fetch featured families (lightweight query)
  const fetchFeaturedFamilies = useCallback(async () => {
    const { data, error } = await supabase
      .from('troll_families')
      .select('id, name, description, icon_emoji, emoji, banner_url, level, total_coins, member_count, is_featured, created_at')
      .eq('is_featured', true)
      .limit(5)
      .order('member_count', { ascending: false })
    
    if (!error && data) {
      setFeaturedFamilies(data as FamilyRow[])
    }
  }, [])

  // Check user membership first - redirect if already in a family
  useEffect(() => {
    const checkFamilyMembership = async () => {
      if (!user) {
        setMembershipChecked(true)
        return
      }

      try {
        // Single optimized query to check membership
        const { data: membershipData, error } = await supabase
          .from('family_members')
          .select('family_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle()

        if (error) {
          console.error('Error checking family membership:', error)
          setMembershipChecked(true)
          return
        }

        if (membershipData?.family_id) {
          // User is already in a family - redirect immediately
          setUserFamilyId(membershipData.family_id)
          navigate('/family/home', { replace: true })
          return
        }

        // Also check if user is a leader
        const { data: leaderData } = await supabase
          .from('troll_families')
          .select('id')
          .eq('leader_id', user.id)
          .limit(1)
          .maybeSingle()

        if (leaderData?.id) {
          setUserFamilyId(leaderData.id)
          navigate('/family/home', { replace: true })
          return
        }

        setMembershipChecked(true)
      } catch (err) {
        console.error('Failed to check membership:', err)
        setMembershipChecked(true)
      }
    }

    checkFamilyMembership()
  }, [user, navigate])

  // Load families only after membership check passes
  useEffect(() => {
    if (!membershipChecked) return

    const loadFamilies = async () => {
      setLoading(true)
      try {
        // Fetch featured families first
        await fetchFeaturedFamilies()

        // Then fetch paginated families with optimized columns
        const { data, error } = await buildFamilyQuery(0, sortBy, query)

        if (error) {
          console.error('Error loading families:', error)
          setFamilies([])
        } else {
          setFamilies(data as FamilyRow[])
          // Check if we have more data
          setHasMore((data?.length || 0) >= PAGE_SIZE)
        }
      } catch (err) {
        console.error('Failed to load families:', err)
        setFamilies([])
      } finally {
        setLoading(false)
      }
    }

    loadFamilies()
  }, [membershipChecked, sortBy, query, buildFamilyQuery, fetchFeaturedFamilies])

  // Set up real-time subscription for family updates
  useEffect(() => {
    if (!membershipChecked) return

    const channel = supabase
      .channel('family-browse-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'troll_families'
        },
        (payload) => {
          console.log('Family update received:', payload)
          
          // Handle different event types
          if (payload.eventType === 'INSERT') {
            // New family created - reload to include it
            setFamilies(prev => [payload.new as FamilyRow, ...prev].slice(0, PAGE_SIZE))
          } else if (payload.eventType === 'UPDATE') {
            // Update existing family in list
            setFamilies(prev => 
              prev.map(f => (f.id === payload.new.id ? { ...f, ...payload.new } as FamilyRow : f))
            )
            // Also update featured if needed
            if (payload.new.is_featured) {
              fetchFeaturedFamilies()
            }
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted family
            setFamilies(prev => prev.filter(f => f.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [membershipChecked, fetchFeaturedFamilies])

  // Load more families (pagination)
  const loadMore = async () => {
    if (loadingMore || !hasMore) return

    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const { data, error } = await buildFamilyQuery(nextPage, sortBy, query)

      if (!error && data) {
        setFamilies(prev => [...prev, ...(data as FamilyRow[])])
        setPage(nextPage)
        setHasMore((data?.length || 0) >= PAGE_SIZE)
      }
    } catch (err) {
      console.error('Failed to load more families:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  // Handle sort change
  const handleSortChange = (newSort: SortOption) => {
    if (newSort === sortBy) return
    setSortBy(newSort)
    setPage(0)
    setFamilies([])
  }

  // Filter families client-side for search (after pagination)
  // Note: For better performance with large datasets, search should be server-side
  const filteredFamilies = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return families
    return families.filter((family) => {
      const name = family.name?.toLowerCase() || ''
      const description = family.description?.toLowerCase() || ''
      return name.includes(q) || description.includes(q)
    })
  }, [families, query])

  // Show loading while checking membership
  if (!membershipChecked) {
    return (
      <div className="min-h-screen tc-cosmic-bg text-white p-6 flex items-center justify-center">
        <div className="animate-pulse text-purple-300">Checking membership...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen tc-cosmic-bg text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Browse Troll Families</h1>
            <p className="text-sm text-gray-400">Find your perfect family community in Troll City</p>
          </div>
          
          {/* Search & Sort Controls */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 bg-[#0D0D0D] border border-purple-500/30 rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-purple-300" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(0)
                }}
                placeholder="Search families..."
                className="bg-transparent text-sm text-white outline-none w-40 sm:w-56"
              />
            </div>
            
            {/* Sort Dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-2 bg-[#0D0D0D] border border-purple-500/30 rounded-lg px-3 py-2 text-sm hover:bg-purple-900/30 transition-colors">
                <ArrowUpDown className="w-4 h-4 text-purple-300" />
                <span className="hidden sm:inline">
                  {sortBy === 'newest' && 'Newest'}
                  {sortBy === 'members' && 'Members'}
                  {sortBy === 'coins' && 'Coins'}
                </span>
                <ChevronDown className="w-3 h-3 text-purple-300" />
              </button>
              
              {/* Sort Options */}
              <div className="absolute right-0 top-full mt-2 bg-[#1a1a2e] border border-purple-500/30 rounded-lg overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 min-w-[140px]">
                <button
                  onClick={() => handleSortChange('newest')}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-purple-900/40 transition-colors ${sortBy === 'newest' ? 'text-purple-300 bg-purple-900/20' : 'text-gray-300'}`}
                >
                  🆕 Newest
                </button>
                <button
                  onClick={() => handleSortChange('members')}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-purple-900/40 transition-colors ${sortBy === 'members' ? 'text-purple-300 bg-purple-900/20' : 'text-gray-300'}`}
                >
                  👥 Most Members
                </button>
                <button
                  onClick={() => handleSortChange('coins')}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-purple-900/40 transition-colors ${sortBy === 'coins' ? 'text-purple-300 bg-purple-900/20' : 'text-gray-300'}`}
                >
                  💰 Most Coins
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Featured Families Section */}
        {featuredFamilies.length > 0 && !query && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              <h2 className="text-xl font-bold text-yellow-400">Featured Families</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {featuredFamilies.map((family) => (
                <FamilyCard 
                  key={family.id} 
                  family={family} 
                  onJoin={() => navigate(`/family/apply/${family.id}`)}
                  onView={() => navigate(`/family/profile/${family.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Families Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl font-bold">
                {query ? `Search Results` : 'All Families'}
                {filteredFamilies.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-400">
                    ({filteredFamilies.length}{hasMore && !query ? '+' : ''})
                  </span>
                )}
              </h2>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="troll-card p-4 border border-purple-500/20 animate-pulse">
                  <div className="h-28 bg-gray-800 rounded-lg mb-3" />
                  <div className="h-6 bg-gray-800 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-800 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredFamilies.length === 0 ? (
            <div className="troll-card p-8 text-center text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg">No families found</p>
              <p className="text-sm mt-1">
                {query ? 'Try a different search term' : 'Be the first to create a family!'}
              </p>
              {!query && (
                <button
                  onClick={() => navigate('/family/create')}
                  className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                >
                  Create Family
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredFamilies.map((family) => (
                  <FamilyCard 
                    key={family.id} 
                    family={family}
                    onJoin={() => navigate(`/family/apply/${family.id}`)}
                    onView={() => navigate(`/family/profile/${family.id}`)}
                  />
                ))}
              </div>
              
              {/* Load More Button */}
              {hasMore && !query && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    {loadingMore ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        <span>Load More Families</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Family Card Component - Extracted for reusability
interface FamilyCardProps {
  family: FamilyRow
  onJoin: () => void
  onView: () => void
}

function FamilyCard({ family, onJoin, onView }: FamilyCardProps) {
  const [showJoinConfirm, setShowJoinConfirm] = useState(false)
  const badgeEmoji = family.icon_emoji || family.emoji || '👑'
  const members = family.member_count ?? 0

  return (
    <div className="troll-card p-4 border border-purple-500/20 hover:border-purple-500/50 transition-all">
      {/* Banner */}
      {family.banner_url ? (
        <img
          src={family.banner_url}
          alt={`${family.name} banner`}
          className="h-28 w-full rounded-lg object-cover mb-3"
        />
      ) : (
        <div className="h-28 w-full rounded-lg bg-gradient-to-br from-purple-900/40 to-blue-900/40 mb-3 flex items-center justify-center">
          <span className="text-4xl">{badgeEmoji}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">{badgeEmoji}</span>
            <h3 className="text-lg font-semibold truncate">{family.name}</h3>
          </div>
          {family.description && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{family.description}</p>
          )}
        </div>
        <div className="text-xs text-purple-200 flex items-center gap-1 shrink-0">
          <Crown className="w-3 h-3" />
          Lv {family.level || 1}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 flex items-center justify-between text-xs text-gray-300">
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 text-purple-300" />
          <span>{members.toLocaleString()} members</span>
        </div>
        <div className="flex items-center gap-1 text-yellow-300">
          <Zap className="w-3 h-3" />
          <span>{(family.total_coins || 0).toLocaleString()}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={onJoin}
          className="flex-1 py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors"
        >
          Join Family
        </button>
        <button
          onClick={onView}
          className="px-4 py-2 text-sm rounded-lg border border-purple-500/30 hover:bg-purple-900/30 transition-colors"
        >
          View
        </button>
      </div>
    </div>
  )
}
