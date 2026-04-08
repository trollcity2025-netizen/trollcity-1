import React, { lazy, Suspense, useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { Heart, MessageSquare, Pin, Reply, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { trollCityTheme } from '@/styles/trollCityTheme'
import { WallPost } from '@/types/trollWall'
import UserNameWithAge from '@/components/UserNameWithAge'
import NeonGlowUsername from '@/components/NeonGlowUsername'
import CreatePostComposer from './CreatePostComposer'
import { Virtuoso } from 'react-virtuoso'
import { parseTextWithLinks } from '@/lib/utils'

const UserProfilePopup = lazy(() => import('@/components/UserProfilePopup'))
const MentionTextarea = lazy(() => import('@/components/MentionTextarea'))

interface TrollWallFeedProps {
  onRequireAuth: (intent?: string) => boolean
}

const PAGE_SIZE = 10

export default function TrollWallFeed({ onRequireAuth }: TrollWallFeedProps) {
  const { user, isAdmin } = useAuthStore()
  const location = useLocation()
  const isMountedRef = useRef(true)
  const latestRequestId = useRef(0)
  const [posts, setPosts] = useState<WallPost[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [likingPosts, setLikingPosts] = useState<Set<string>>(new Set())
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null)

  const loadPosts = useCallback(async (pageIndex: number, append: boolean) => {
    const requestId = ++latestRequestId.current

    const isActiveRequest = () => isMountedRef.current && requestId === latestRequestId.current

    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setPage(0)
    }

    try {
      const start = pageIndex * PAGE_SIZE
      const end = start + PAGE_SIZE - 1

      const { data, error } = await supabase
        .from('troll_wall_posts')
        .select('*, user_profiles(username, avatar_url, is_admin, is_troll_officer, is_og_user, created_at, role, is_verified, is_gold, username_style, badge, empire_role, officer_level, troller_level, is_troller, rgb_username_expires_at, glowing_username_color)')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .range(start, end)

      if (error) throw error

      if (!isActiveRequest()) return

      const rows = (data as any[]) || []
      const postIds = rows.map((row) => row.id)

      let likedPostIds = new Set<string>()
      if (user?.id && postIds.length > 0) {
        const { data: likedData } = await supabase
          .from('troll_wall_likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postIds)

        likedPostIds = new Set(likedData?.map((like) => like.post_id) || [])
      }

      const normalized = rows.map((post: any) => {
        const author = post.user_profiles || {}
        return {
          ...post,
          username: author.username,
          avatar_url: author.avatar_url,
          is_admin: author.is_admin,
          is_troll_officer: author.is_troll_officer,
          is_og_user: author.is_og_user,
          user_created_at: author.created_at,
          user_liked: likedPostIds.has(post.id),
          reactions: post.reactions || {},
          gifts: post.gifts || {},
          // Extended profile fields for NeonGlowUsername
          user_role: author.role,
          is_verified: author.is_verified,
          is_gold: author.is_gold,
          username_style: author.username_style,
          badge: author.badge,
          empire_role: author.empire_role,
          officer_level: author.officer_level,
          troller_level: author.troller_level,
          is_troller: author.is_troller,
          rgb_username_expires_at: author.rgb_username_expires_at,
          glowing_username_color: author.glowing_username_color,
        } as WallPost
      })

      // Group replies under their parent posts
      const parentPosts = normalized.filter((p: WallPost) => !p.reply_to_post_id)
      const replies = normalized.filter((p: WallPost) => p.reply_to_post_id)
      
      // Create a map of parent id to replies
      const repliesMap: Record<string, WallPost[]> = {}
      replies.forEach((reply: WallPost) => {
        const parentId = reply.reply_to_post_id
        if (parentId) {
          if (!repliesMap[parentId]) {
            repliesMap[parentId] = []
          }
          repliesMap[parentId].push(reply)
        }
      })
      
      // Sort replies by created_at (oldest first for threaded view)
      Object.keys(repliesMap).forEach(parentId => {
        repliesMap[parentId].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      })
      
      // Attach replies to parent posts
      const postsWithReplies = parentPosts.map((post: WallPost) => ({
        ...post,
        replies: repliesMap[post.id] || []
      })) as WallPost[]

      if (!isActiveRequest()) return

      setPosts((prev) => (append ? [...prev, ...postsWithReplies] : postsWithReplies))
      setHasMore(rows.length === PAGE_SIZE)
    } catch (err: any) {
      if (!isActiveRequest()) return
      console.error('Error loading wall posts:', err)
      // Only show error toast to authenticated users to avoid RLS-related confusion on landing page
      if (user) {
        toast.error('Failed to load Wall posts')
      }
    } finally {
      if (!isActiveRequest()) return
      setLoading(false)
      setLoadingMore(false)
    }
  }, [user])

  useEffect(() => {
    isMountedRef.current = true

    // On initial mount and when returning to home via navigation
    if (location.pathname === '/') {
      loadPosts(0, false)
    }

    return () => {
      isMountedRef.current = false
    }
  }, [loadPosts, location.pathname])

  const handlePostCreated = (post: WallPost) => {
    setPosts((prev) => [post, ...prev])
  }

  const handleLike = async (postId: string) => {
    if (!user?.id) {
      onRequireAuth('like a post')
      return
    }

    if (likingPosts.has(postId)) return
    setLikingPosts((prev) => new Set(prev).add(postId))

    try {
      const { data, error } = await supabase.rpc('toggle_wall_post_like', {
        p_post_id: postId,
        p_user_id: user.id
      })

      if (error) throw error

      if (data) {
        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId
              ? { ...post, likes: data.likes_count, user_liked: data.liked }
              : post
          )
        )
      }
    } catch (err: any) {
      console.error('Error toggling like:', err)
      toast.error('Failed to like post')
    } finally {
      setLikingPosts((prev) => {
        const next = new Set(prev)
        next.delete(postId)
        return next
      })
    }
  }

  const handleReplySubmit = async (postId: string) => {
    if (!user?.id) {
      onRequireAuth('reply to a post')
      return
    }

    if (!replyText.trim()) {
      toast.error('Write a reply before posting')
      return
    }

    try {
      const { error } = await supabase.rpc('create_wall_post_reply', {
        p_original_post_id: postId,
        p_user_id: user.id,
        p_content: replyText.trim()
      })

      if (error) throw error

      toast.success('Reply posted')
      setReplyingTo(null)
      setReplyText('')
      setPage(0)
      loadPosts(0, false)
    } catch (err: any) {
      console.error('Error posting reply:', err)
      toast.error('Failed to post reply')
    }
  }

  const handlePinToggle = async (postId: string, currentlyPinned: boolean) => {
    if (!user?.id) {
      onRequireAuth('pin a post')
      return
    }

    try {
      const { data, error } = await supabase.rpc('toggle_wall_post_pin', {
        p_post_id: postId,
        p_user_id: user.id
      })

      if (error) throw error

      const pinned = typeof data === 'boolean' ? data : !currentlyPinned
      setPosts(prev =>
        prev.map(post =>
          post.id === postId ? { ...post, is_pinned: pinned } : post
        )
      )
      toast.success(pinned ? 'Post pinned' : 'Post unpinned')
    } catch (err: any) {
      console.error('Error toggling pin:', err)
      toast.error('Failed to pin/unpin post')
    }
  }

  const handleDelete = async (postId: string) => {
    if (!user?.id) {
      onRequireAuth('delete a post')
      return
    }

    if (!confirm('Are you sure you want to delete this post?')) return

    try {
      let query = supabase
        .from('troll_wall_posts')
        .delete()
        .eq('id', postId)

      if (!isAdmin) {
        query = query.eq('user_id', user.id)
      }

      const { error } = await query

      if (error) {
        toast.error('Failed to delete post: ' + error.message)
        return
      }

      setPosts(prev => prev.filter(p => p.id !== postId))
      toast.success('Post deleted')
    } catch (err: any) {
      console.error('Error deleting post:', err)
      toast.error('Failed to delete post')
    }
  }

  const renderPost = useCallback((index: number, post: WallPost) => (
    <div className="pb-3">
        <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {post.username ? (
                <NeonGlowUsername
                  username={post.username}
                  avatarUrl={post.avatar_url}
                  profile={{
                    is_admin: post.is_admin,
                    is_troll_officer: post.is_troll_officer,
                    is_og_user: post.is_og_user,
                    is_verified: post.user_verified,
                    is_gold: post.user_is_gold,
                    role: post.user_role,
                    officer_level: post.officer_level,
                    troller_level: post.troller_level,
                    is_troller: post.is_troller,
                    username_style: post.username_style,
                    badge: post.badge,
                    empire_role: post.empire_role,
                  }}
                  size="sm"
                  onClick={() => {
                    setSelectedUserId(post.user_id)
                    setSelectedUsername(post.username || null)
                  }}
                />
              ) : (
                <span className="font-semibold text-white/60 text-sm">Deleted User</span>
              )}
              <span className="text-[10px] text-white/40">
                {new Date(post.created_at).toLocaleString()}
              </span>
              {post.is_pinned && (
                <span className="flex items-center gap-1 text-yellow-400 text-[10px] font-bold">
                  <Pin className="w-2.5 h-2.5 fill-current" />
                  PINNED
                </span>
              )}
            </div>
            {post.reply_to_post_id && (
              <p className="mt-0.5 text-[10px] text-purple-300">Replying to a post</p>
            )}
            <p className="mt-2 text-white/90 text-sm whitespace-pre-wrap break-words">
              {parseTextWithLinks(post.content)}
            </p>
            {post.metadata?.image_url && (
              <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
                <img src={post.metadata.image_url} alt="Post media" loading="lazy" className="w-full max-h-48 object-cover" />
              </div>
            )}
            {post.metadata?.video_url && (
              <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
                <video controls className="w-full max-h-48">
                  <source src={post.metadata.video_url} />
                </video>
              </div>
            )}
            <div className="mt-2 flex items-center gap-2 text-xs text-white/60">
              <button
                type="button"
                onClick={() => handleLike(post.id)}
                disabled={likingPosts.has(post.id)}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 transition-colors ${
                  post.user_liked
                    ? 'bg-pink-600/20 text-pink-300'
                    : 'hover:bg-white/5'
                }`}
              >
                <Heart className={`h-3.5 w-3.5 ${post.user_liked ? 'fill-current' : ''}`} />
                {post.likes || 0}
              </button>
              <button
                type="button"
                onClick={() => setReplyingTo((prev) => (prev === post.id ? null : post.id))}
                className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-white/5"
              >
                <Reply className="h-3.5 w-3.5" />
                Reply
              </button>
              {user && (post.user_id === user.id || isAdmin) && (
                <>
                  <button
                    type="button"
                    onClick={() => handlePinToggle(post.id, !!post.is_pinned)}
                    className={`flex items-center gap-1 rounded-lg px-2 py-1 transition-colors ${
                      post.is_pinned
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'hover:bg-white/5 text-white/60'
                    }`}
                    title={post.is_pinned ? 'Unpin post' : 'Pin post'}
                  >
                    <Pin className={`h-3.5 w-3.5 ${post.is_pinned ? 'fill-current' : ''}`} />
                    {post.is_pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(post.id)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-red-500/20 text-red-400 transition-colors"
                    title={isAdmin && post.user_id !== user.id ? 'Admin delete post' : 'Delete post'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </>
              )}
            </div>
            {replyingTo === post.id && (
              <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-2.5">
                <Suspense fallback={<div className="w-full min-h-[60px] bg-transparent" />}>
                  <MentionTextarea
                    value={replyText}
                    onChange={setReplyText}
                    placeholder="Write a reply... Use # to tag users"
                    className="w-full min-h-[60px] bg-transparent text-white text-sm placeholder-white/40 focus:outline-none"
                  />
                </Suspense>
                <div className="mt-1.5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingTo(null)
                      setReplyText('')
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReplySubmit(post.id)}
                    className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-xs hover:bg-purple-500"
                  >
                    Post Reply
                  </button>
                </div>
              </div>
            )}
            
            {/* Nested Replies */}
            {post.replies && post.replies.length > 0 && (
              <div className="mt-2 ml-3 border-l-2 border-purple-500/30 pl-3 space-y-2">
                {post.replies.map((reply) => (
                  <div key={reply.id} className="bg-black/20 rounded-lg p-2">
                    <div className="flex items-start gap-2">
                      <div className="h-6 w-6 rounded-full overflow-hidden bg-white/5 flex-shrink-0">
                        {reply.avatar_url ? (
                          <img src={reply.avatar_url} alt={reply.username || 'User'} loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[10px] text-white/60">
                            {reply.username?.[0]?.toUpperCase() || 'T'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {reply.username ? (
                            <div 
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => {
                                setSelectedUserId(reply.user_id)
                                setSelectedUsername(reply.username || null)
                              }}
                            >
                              <UserNameWithAge
                                user={{
                                  username: reply.username,
                                  id: reply.user_id,
                                  is_admin: reply.is_admin,
                                  is_troll_officer: reply.is_troll_officer,
                                  is_og_user: reply.is_og_user,
                                  created_at: reply.user_created_at
                                }}
                                className="font-semibold text-xs text-white"
                              />
                            </div>
                          ) : (
                            <span className="font-semibold text-xs text-white/60">Deleted User</span>
                          )}
                          <span className="text-[10px] text-white/40">
                            {new Date(reply.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-white/80 whitespace-pre-wrap break-words">{reply.content}</p>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-white/50">
                          <button
                            type="button"
                            onClick={() => handleLike(reply.id)}
                            disabled={likingPosts.has(reply.id)}
                            className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
                              reply.user_liked
                                ? 'bg-pink-600/20 text-pink-300'
                                : 'hover:bg-white/5'
                            }`}
                          >
                            <Heart className={`h-3 w-3 ${reply.user_liked ? 'fill-current' : ''}`} />
                            {reply.likes || 0}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
      </div>
    </div>
  ), [user, isAdmin, likingPosts, replyingTo, replyText, handleLike, handleReplySubmit, handlePinToggle, handleDelete, setReplyingTo, setReplyText])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-1 flex-shrink-0">
        <div>
          <h2 className="text-base font-bold text-white">Wall</h2>
          <p className={`${trollCityTheme.text.muted} text-[10px]`}>The city timeline. Share updates and join the conversation.</p>
        </div>
      </div>

      {/* Posts - scrollable area above the input */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {loading && posts.length === 0 ? (
          <div className="py-10 text-center text-white/50">Loading Wall...</div>
        ) : posts.length === 0 ? (
          <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-10 text-center text-white/50`}>
            <MessageSquare className="mx-auto mb-3 h-8 w-8" />
            <p>No posts yet. Start the conversation.</p>
          </div>
        ) : (
          <Virtuoso
            style={{ height: '100%' }}
            data={posts}
            itemContent={renderPost}
            endReached={() => {
              if (hasMore && !loadingMore && user?.id) {
                const nextPage = page + 1
                setPage(nextPage)
                loadPosts(nextPage, true)
              }
            }}
            increaseViewportBy={200}
          />
        )}
      </div>

      {/* Input box - fixed at bottom like live chat */}
      <div className="flex-shrink-0 pt-1 mt-1 border-t border-white/10">
        <CreatePostComposer onPostCreated={handlePostCreated} onRequireAuth={onRequireAuth} />
      </div>

      {/* User Profile Popup */}
      {selectedUserId && selectedUsername && (
        <Suspense fallback={null}>
          <UserProfilePopup
            userId={selectedUserId}
            username={selectedUsername}
            onClose={() => {
              setSelectedUserId(null)
              setSelectedUsername(null)
            }}
          />
        </Suspense>
      )}
    </div>
  )
}
