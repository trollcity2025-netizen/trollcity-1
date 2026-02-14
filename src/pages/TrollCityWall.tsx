import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { 
  MessageSquare, Heart, Plus, Video, Sword, Users, Trophy, 
  Zap, ExternalLink, Trash2, Share2, Reply, Gift, Smile, Pin
} from 'lucide-react'
import { WallPost, WallPostType } from '../types/trollWall'
import CreatePostModal from '../components/trollWall/CreatePostModal'
import GiftModal from '../components/trollWall/GiftModal'
import DailyLoginWall from '../components/trollWall/DailyLoginWall'
import UserNameWithAge from '../components/UserNameWithAge'
import { Virtuoso } from 'react-virtuoso'

// Available reactions
const REACTIONS = [
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'haha', emoji: '😂', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Sad' },
  { type: 'angry', emoji: '😡', label: 'Angry' },
  { type: 'fire', emoji: '🔥', label: 'Fire' },
  { type: 'lol', emoji: '🤣', label: 'LOL' },
  { type: 'clap', emoji: '👏', label: 'Clap' },
  { type: 'mindblown', emoji: '🤯', label: 'Mindblown' },
]

// Available gifts
const GIFTS = [
  { type: 'rose', emoji: '🌹', name: 'Rose', cost: 10 },
  { type: 'heart', emoji: '💖', name: 'Heart', cost: 25 },
  { type: 'star', emoji: '⭐', name: 'Star', cost: 50 },
  { type: 'crown', emoji: '👑', name: 'Crown', cost: 100 },
  { type: 'diamond', emoji: '💎', name: 'Diamond', cost: 200 },
  { type: 'trophy', emoji: '🏆', name: 'Trophy', cost: 500 },
  { type: 'coffee', emoji: '☕', name: 'Coffee', cost: 15 },
  { type: 'pizza', emoji: '🍕', name: 'Pizza', cost: 30 },
  { type: 'rocket', emoji: '🚀', name: 'Rocket', cost: 1000 },
  { type: 'dragon', emoji: '🐉', name: 'Dragon', cost: 5000 },
]

const MAX_POSTS = 100 // Memory cap for the wall feed

export default function TrollCityWall() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [posts, setPosts] = useState<WallPost[]>([])
  const postBufferRef = useRef<WallPost[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [likingPosts, setLikingPosts] = useState<Set<string>>(new Set())
  const [reactingPosts, setReactingPosts] = useState<Set<string>>(new Set())
  const [sendingGifts, setSendingGifts] = useState<Set<string>>(new Set())
  const [showReactions, setShowReactions] = useState<string | null>(null)
  const [showReplyModal, setShowReplyModal] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [giftModalPostId, setGiftModalPostId] = useState<string | null>(null)

  const loadPosts = useCallback(async () => {
    // Thundering Herd Prevention: Add random jitter to fetch (0-800ms)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 800));
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('troll_wall_posts')
        .select('*, user_profiles(username, avatar_url, is_admin, is_troll_officer, is_og_user, created_at)')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(MAX_POSTS)

      if (error) throw error

      if (data) {
        const postIds = data.map(p => p.id)
        let likedPostIds = new Set<string>()
        const userReactionTypes: Record<string, string> = {}
        const reactionsSummary: Record<string, Record<string, number>> = {}
        const giftsSummary: Record<string, Record<string, { count: number, coins: number }>> = {}

        if (user?.id) {
          // Check user likes
          const { data: userLikes } = await supabase
            .from('troll_wall_likes')
            .select('post_id')
            .eq('user_id', user.id)
            .in('post_id', postIds)
          
          likedPostIds = new Set(userLikes?.map(l => l.post_id) || [])

          // Check user reactions
          const { data: userReactions } = await supabase
            .from('troll_wall_reactions')
            .select('post_id, reaction_type')
            .eq('user_id', user.id)
            .in('post_id', postIds)
          
          userReactions?.forEach(r => {
            userReactionTypes[r.post_id] = r.reaction_type
          })
        }

        // Get reactions summary
        const { data: allReactions } = await supabase
          .from('troll_wall_reactions_summary')
          .select('post_id, reaction_type, reaction_count')
          .in('post_id', postIds)
        
        allReactions?.forEach(r => {
          if (!reactionsSummary[r.post_id]) {
            reactionsSummary[r.post_id] = {}
          }
          reactionsSummary[r.post_id][r.reaction_type] = r.reaction_count
        })

        // Get gifts summary
        const { data: allGifts } = await supabase
          .from('troll_wall_gifts_summary')
          .select('post_id, gift_type, total_quantity, total_coins')
          .in('post_id', postIds)
        
        allGifts?.forEach(g => {
          if (!giftsSummary[g.post_id]) {
            giftsSummary[g.post_id] = {}
          }
          giftsSummary[g.post_id][g.gift_type] = { 
            count: g.total_quantity, 
            coins: g.total_coins 
          }
        })

        // Merge posts with user profile data and like status
        const postsWithLikes = data.map((post: any) => {
          const profile = post.user_profiles || {}
          return {
            ...post,
            username: profile.username,
            avatar_url: profile.avatar_url,
            is_admin: profile.is_admin,
            is_troll_officer: profile.is_troll_officer,
            is_og_user: profile.is_og_user,
            user_created_at: profile.created_at,
            user_liked: likedPostIds.has(post.id),
            user_reaction: userReactionTypes[post.id],
            reactions: reactionsSummary[post.id] || {},
            gifts: giftsSummary[post.id] || {},
          }
        })

        setPosts(postsWithLikes as WallPost[])
      } else {
        setPosts([])
      }
    } catch (err: any) {
      console.error('Error loading wall posts:', err)
      toast.error('Failed to load wall posts')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    // 1. Initial Fetch
    loadPosts()

    // 2. Realtime Subscription for Live Updates
    // This replaces the 60s polling for high-scale performance
    const channel = supabase.channel('public:troll_wall_posts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'troll_wall_posts' },
        (payload) => {
          // Add to buffer for 150ms batching
          postBufferRef.current.push(payload.new as any)
        }
      )
      .subscribe()

    // 3. High-Frequency Social Update Buffer: Flush updates every 150ms
    const flushInterval = setInterval(() => {
      if (postBufferRef.current.length === 0) return
      
      const updates = [...postBufferRef.current]
      postBufferRef.current = []
      
      setPosts(prev => {
        let next = [...prev]
        updates.forEach(newPost => {
          // If it's an update to an existing post, merge it to preserve profile data
          const idx = next.findIndex(p => p.id === newPost.id)
          if (idx !== -1) {
            next[idx] = { ...next[idx], ...newPost }
          } else {
            // Otherwise prepend (standard wall behavior)
            next = [newPost, ...next]
          }
        })
        return next.slice(0, MAX_POSTS)
      })
    }, 150)

    return () => {
      clearInterval(flushInterval)
      supabase.removeChannel(channel)
    }
  }, [loadPosts])

  const handlePostClick = useCallback((post: WallPost) => {
    if (post.metadata?.stream_id) {
      navigate(`/stream/${post.metadata.stream_id}`)
    } else if (post.metadata?.battle_id) {
      navigate(`/battles/${post.metadata.battle_id}`)
    }
  }, [navigate])

  const handleLike = async (postId: string) => {
    if (!user?.id) {
      toast.error('Please log in to like posts')
      return
    }

    if (likingPosts.has(postId)) return

    setLikingPosts(prev => new Set(prev).add(postId))

    try {
      const { data, error } = await supabase
        .rpc('toggle_wall_post_like', {
          p_post_id: postId,
          p_user_id: user.id
        })

      if (error) throw error

      if (data) {
        setPosts(prev =>
          prev.map(p =>
            p.id === postId
              ? { ...p, likes: data.likes_count, user_liked: data.liked }
              : p
          )
        )
      }
    } catch (err: any) {
      console.error('Error toggling like:', err)
      toast.error('Failed to like post')
    } finally {
      setLikingPosts(prev => {
        const newSet = new Set(prev)
        newSet.delete(postId)
        return newSet
      })
    }
  }

  const handleReaction = async (postId: string, reactionType: string) => {
    if (!user?.id) {
      toast.error('Please log in to react')
      return
    }

    setReactingPosts(prev => new Set(prev).add(postId))

    try {
      const { data, error } = await supabase
        .rpc('toggle_wall_post_reaction', {
          p_post_id: postId,
          p_user_id: user.id,
          p_reaction_type: reactionType
        })

      if (error) throw error

      if (data) {
        setPosts(prev =>
          prev.map(p => {
            if (p.id === postId) {
              const newReactions = { ...p.reactions }
              newReactions[reactionType] = data.reaction_count
              return {
                ...p,
                reactions: newReactions,
                user_reaction: data.removed ? null : reactionType
              }
            }
            return p
          })
        )
      }
      setShowReactions(null)
    } catch (err: any) {
      console.error('Error toggling reaction:', err)
      toast.error('Failed to react')
    } finally {
      setReactingPosts(prev => {
        const newSet = new Set(prev)
        newSet.delete(postId)
        return newSet
      })
    }
  }

  const handleGift = async (postId: string, giftType: string) => {
    if (!user?.id) {
      toast.error('Please log in to send gifts')
      return
    }

    setSendingGifts(prev => new Set(prev).add(postId))

    try {
      const { data, error } = await supabase
        .rpc('send_wall_post_gift', {
          p_post_id: postId,
          p_gift_type: giftType,
          p_quantity: 1
        })

      if (error) throw error

      if (data && data.success) {
        setPosts(prev =>
          prev.map(p => {
            if (p.id === postId) {
              const newGifts = { ...p.gifts }
              const gift = GIFTS.find(g => g.type === giftType)
              if (gift) {
                if (!newGifts[giftType]) {
                  newGifts[giftType] = { count: 0, coins: 0 }
                }
                newGifts[giftType] = {
                  count: newGifts[giftType].count + 1,
                  coins: newGifts[giftType].coins + gift.cost
                }
              }
              return { ...p, gifts: newGifts }
            }
            return p
          })
        )
        toast.success(`Sent ${giftType}!`)
      } else {
        toast.error(data?.error || 'Failed to send gift')
      }
    } catch (err: any) {
      console.error('Error sending gift:', err)
      toast.error('Failed to send gift')
    } finally {
      setSendingGifts(prev => {
        const newSet = new Set(prev)
        newSet.delete(postId)
        return newSet
      })
    }
  }

  const handleReply = async (postId: string) => {
    if (!user?.id) {
      toast.error('Please log in to reply')
      return
    }

    if (!replyContent.trim()) {
      toast.error('Please enter a reply')
      return
    }

    try {
      const { data: _data, error } = await supabase
        .rpc('create_wall_post_reply', {
          p_original_post_id: postId,
          p_user_id: user.id,
          p_content: replyContent
        })

      if (error) throw error

      toast.success('Reply posted!')
      setShowReplyModal(null)
      setReplyContent('')
      loadPosts()
    } catch (err: any) {
      console.error('Error creating reply:', err)
      toast.error('Failed to post reply')
    }
  }

  const handleDelete = async (postId: string) => {
    if (!user?.id) return

    if (!confirm('Are you sure you want to delete this post?')) {
      return
    }

    try {
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role, is_admin, is_troll_officer, is_lead_officer')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Error fetching profile for delete:', profileError)
        toast.error('Failed to verify delete permissions')
        return
      }

      const isStaff = userProfile?.is_admin || 
                     userProfile?.is_troll_officer || 
                     userProfile?.is_lead_officer || 
                     userProfile?.role === 'admin' ||
                     userProfile?.role === 'troll_officer' ||
                     userProfile?.role === 'lead_troll_officer'

      console.log('Delete permissions - isStaff:', isStaff, 'userId:', user.id, 'postId:', postId)

      let query = supabase.from('troll_wall_posts').delete().eq('id', postId)

      if (!isStaff) {
        query = query.eq('user_id', user.id)
      }

      const { error } = await query

      if (error) {
        console.error('Delete error:', error)
        toast.error('Failed to delete post: ' + error.message)
        return
      }

      toast.success('Post deleted')
      setPosts(prev => prev.filter(p => p.id !== postId))
    } catch (err: any) {
      console.error('Error deleting post:', err)
      toast.error('Failed to delete post')
    }
  }

  const handlePin = async (post: WallPost) => {
    if (!user?.id) return

    try {
      const { data, error } = await supabase
        .rpc('toggle_wall_post_pin', {
          p_post_id: post.id,
          p_user_id: user.id
        })

      if (error) throw error

      const newPinnedStatus = data as boolean
      
      setPosts(prev => 
        prev.map(p => 
          p.id === post.id 
            ? { ...p, is_pinned: newPinnedStatus } 
            : p
        ).sort((a, b) => {
          // Re-sort: Pinned first, then by date
          if (a.id === post.id) a.is_pinned = newPinnedStatus // Ensure current item has updated status for sort
          
          if (a.is_pinned === b.is_pinned) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          }
          return (a.is_pinned ? -1 : 1)
        })
      )

      toast.success(newPinnedStatus ? 'Post pinned' : 'Post unpinned')
    } catch (err: any) {
      console.error('Error toggling pin:', err)
      toast.error('Failed to update pin status')
    }
  }

  const handleShare = (post: WallPost) => {
    const url = `${window.location.origin}/wall/${post.id}`
    navigator.clipboard.writeText(url)
    toast.success('Link copied to clipboard!')
  }

  const getPostIcon = (type: WallPostType) => {
    switch (type) {
      case 'video': return <Video className="w-4 h-4 text-pink-400" />
      case 'stream_announce': return <Video className="w-4 h-4 text-red-400" />
      case 'battle_result': return <Sword className="w-4 h-4 text-purple-400" />
      case 'family_announce': return <Users className="w-4 h-4 text-blue-400" />
      case 'badge_earned': return <Trophy className="w-4 h-4 text-yellow-400" />
      case 'system': return <Zap className="w-4 h-4 text-cyan-400" />
      default: return <MessageSquare className="w-4 h-4 text-gray-400" />
    }
  }

  const renderPost = (index: number, post: WallPost) => (
    <div key={post.id} className="pb-4">
      <div
        className={`rounded-xl p-6 border transition-colors ${
          post.post_type === 'announcement'
            ? 'bg-amber-950/20 border-amber-500/50 hover:border-amber-400'
            : 'bg-zinc-900 border-[#2C2C2C] hover:border-purple-500/30'
        }`}
      >
        {/* Post Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${
            post.post_type === 'announcement' 
              ? 'bg-gradient-to-br from-amber-400 to-yellow-600 ring-2 ring-amber-500' 
              : 'bg-gradient-to-br from-purple-500 to-pink-500'
          }`}>
            {post.avatar_url ? (
              <img src={post.avatar_url} alt={post.username} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-bold text-lg">{post.username?.[0]?.toUpperCase() || 'U'}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {post.username ? (
                <UserNameWithAge 
                  user={{
                    username: post.username, 
                    id: post.user_id,
                    is_admin: post.is_admin,
                    is_troll_officer: post.is_troll_officer,
                    is_og_user: post.is_og_user,
                    created_at: post.user_created_at
                  }}
                  className={`font-semibold hover:text-purple-400 ${post.post_type === 'announcement' ? 'text-amber-400' : 'text-white'}`} 
                />
              ) : (
                <span className="font-semibold text-gray-500">Deleted User</span>
              )}
              {post.post_type === 'announcement' && <span className="px-2 py-0.5 bg-amber-500 text-black text-xs font-bold rounded border border-amber-400">PRESIDENT</span>}
              {post.is_admin && <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded">ADMIN</span>}
              {post.is_troll_officer && <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded">OFFICER</span>}
              <span className="flex items-center gap-1 text-gray-400 text-xs">
                {getPostIcon(post.post_type)}
                {post.post_type.replace('_', ' ')}
              </span>
              {post.is_pinned && (
                <span className="flex items-center gap-1 text-yellow-400 text-xs font-bold">
                  <Pin className="w-3 h-3 fill-current" />
                  PINNED
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {new Date(post.created_at).toLocaleString()}
            </p>
            {/* Reply indicator */}
            {post.reply_to_post_id && (
              <p className="text-xs text-purple-400 mt-1">
                ↩ Replying to a post
              </p>
            )}
          </div>
          {user && (post.user_id === user.id || profile?.is_admin || profile?.is_troll_officer || profile?.is_lead_officer || profile?.role === 'lead_troll_officer') && (
            <div className="flex items-center gap-1">
              {(profile?.is_admin || profile?.role === 'admin') && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePin(post);
                  }}
                  className={`p-2 hover:bg-yellow-500/20 rounded-lg transition-colors ${post.is_pinned ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'}`}
                  title={post.is_pinned ? "Unpin post" : "Pin post"}
                >
                  <Pin className={`w-4 h-4 ${post.is_pinned ? 'fill-current' : ''}`} />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDelete(post.id)}
                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400"
                title="Delete post"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Post Content */}
        <div
          className={`mb-4 ${post.metadata?.stream_id || post.metadata?.battle_id ? 'cursor-pointer hover:text-purple-400 transition-colors' : ''}`}
          onClick={() => handlePostClick(post)}
        >
          <p className="text-white whitespace-pre-wrap break-words">{post.content}</p>
          {post.metadata?.stream_id && (
            <div className="mt-3 flex items-center gap-2 text-purple-400 text-sm">
              <ExternalLink className="w-4 h-4" />
              <span>Watch Stream</span>
            </div>
          )}
          {post.metadata?.battle_id && (
            <div className="mt-3 flex items-center gap-2 text-purple-400 text-sm">
              <Sword className="w-4 h-4" />
              <span>View Battle</span>
            </div>
          )}
        </div>

        {/* Reactions Display */}
        {Object.keys(post.reactions || {}).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {Object.entries(post.reactions || {}).map(([type, count]) => {
              const reaction = REACTIONS.find(r => r.type === type)
              if (!reaction) return null
              return (
                <span key={type} className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded-full text-xs">
                  {reaction.emoji} {count as number}
                </span>
              )
            })}
          </div>
        )}

        {/* Gifts Display */}
        {Object.keys(post.gifts || {}).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {Object.entries(post.gifts || {}).map(([type, giftData]) => {
              const gift = GIFTS.find(g => g.type === type)
              if (!gift) return null
              return (
                <span key={type} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-900/50 rounded-full text-xs">
                  {gift.emoji} {(giftData as { count: number }).count}
                </span>
              )
            })}
          </div>
        )}

        {/* Post Actions */}
        <div className="flex items-center gap-2 pt-4 border-t border-[#2C2C2C]">
          {/* Like Button */}
          <button
            type="button"
            onClick={() => handleLike(post.id)}
            disabled={!user || likingPosts.has(post.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
              post.user_liked
                ? 'bg-pink-600/20 text-pink-400'
                : 'hover:bg-gray-800 text-gray-400 hover:text-pink-400'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Heart className={`w-4 h-4 ${post.user_liked ? 'fill-current' : ''}`} />
            <span className="text-sm">{post.likes || 0}</span>
          </button>

          {/* Reaction Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowReactions(showReactions === post.id ? null : post.id)
              }}
              disabled={!user || reactingPosts.has(post.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors hover:bg-gray-800 text-gray-400 hover:text-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Smile className="w-4 h-4" />
            </button>
            {/* Reactions Dropdown */}
            {showReactions === post.id && (
              <div className="absolute bottom-full left-0 mb-2 bg-zinc-800 rounded-lg p-2 flex gap-1 shadow-lg z-10">
                {REACTIONS.map(reaction => (
                  <button
                    key={reaction.type}
                    type="button"
                    onClick={() => handleReaction(post.id, reaction.type)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-700 transition-colors ${post.user_reaction === reaction.type ? 'bg-zinc-700' : ''}`}
                    title={reaction.label}
                  >
                    {reaction.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Gift Button with GiftBox Modal */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setGiftModalPostId(post.id)}
              disabled={!user || sendingGifts.has(post.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors hover:bg-gray-800 text-gray-400 hover:text-purple-400 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Gift className="w-4 h-4" />
            </button>
          </div>

          {/* Reply Button */}
          <button
            type="button"
            onClick={() => setShowReplyModal(post.id)}
            disabled={!user}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Reply className="w-4 h-4" />
            <span className="text-sm">Reply</span>
          </button>

          {/* Share Button */}
          <button
            type="button"
            onClick={() => handleShare(post)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-blue-400 transition-colors ml-auto"
          >
            <Share2 className="w-4 h-4" />
            <span className="text-sm">Share</span>
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white overflow-hidden flex flex-col pt-24 px-6 pb-6">
      <div className="max-w-3xl mx-auto w-full h-full flex flex-col space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-purple-400" />
              Troll City Wall
            </h1>
            <p className="text-gray-400 mt-1">Share updates, achievements, and connect with the community</p>
          </div>
          {user && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Post
            </button>
          )}
        </div>

        {/* Daily Login Wall Section */}
        <div className="shrink-0">
          <DailyLoginWall onPostCreated={() => loadPosts()} />
        </div>

        {/* Posts Feed */}
        <div className="flex-1 min-h-0 bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No posts yet. Be the first to share something!</p>
            </div>
          ) : (
            <Virtuoso
              style={{ height: '100%' }}
              data={posts}
              itemContent={renderPost}
              increaseViewportBy={300}
            />
          )}
        </div>
      </div>

      {/* Create Post Modal */}
      {showCreateModal && (
        <CreatePostModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            loadPosts()
          }}
        />
      )}

      {/* Reply Modal */}
      {showReplyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-md border border-[#2C2C2C]">
            <h3 className="text-xl font-bold text-white mb-4">Reply to Post</h3>
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write your reply..."
              className="w-full h-32 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowReplyModal(null)
                  setReplyContent('')
                }}
                className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleReply(showReplyModal)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Post Reply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gift Modal */}
      {giftModalPostId && (
        <GiftModal
          postId={giftModalPostId}
          onClose={() => setGiftModalPostId(null)}
          onGiftSent={(giftType, _cost) => {
            handleGift(giftModalPostId, giftType)
          }}
        />
      )}
    </div>
  )
}
