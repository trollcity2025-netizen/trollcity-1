import { useCallback, useEffect, useState } from 'react'
import { Heart, MessageSquare, Reply, MoreVertical, Trash2, Share, Flag } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { trollCityTheme } from '@/styles/trollCityTheme'
import { WallPost } from '@/types/trollWall'
import UserNameWithAge from '@/components/UserNameWithAge'
import CreatePostComposer from './CreatePostComposer'
import { Virtuoso } from 'react-virtuoso'
import TrollWallPostComment from './TrollWallPostComment'

interface TrollWallFeedProps {
  onRequireAuth: (intent?: string) => boolean
}

const PAGE_SIZE = 15

export default function TrollWallFeed({ onRequireAuth }: TrollWallFeedProps) {
  const { user, profile } = useAuthStore()
  const [posts, setPosts] = useState<WallPost[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [likingPosts, setLikingPosts] = useState<Set<string>>(new Set())
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [comments, setComments] = useState<Record<string, WallPost[]>>({})
  const [loadingComments, setLoadingComments] = useState<string | null>(null)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [hiddenPosts, setHiddenPosts] = useState<Set<string>>(new Set())

  useEffect(() => {
    const storedHiddenPosts = localStorage.getItem('hiddenPosts')
    if (storedHiddenPosts) {
      setHiddenPosts(new Set(JSON.parse(storedHiddenPosts)))
    }
  }, [])

  const loadPosts = useCallback(async (pageIndex: number, append: boolean) => {
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
        .select(`
          *,
          author:user_profiles(
            id,
            username,
            avatar_url,
            role,
            is_admin,
            is_troll_officer,
            is_og_user,
            created_at
          ),
          original_post:troll_wall_posts!original_post_id(*),
          reply_to_post:troll_wall_posts!reply_to_post_id(*),
          comment_count:troll_wall_posts!reply_to_post_id(count)
        `)
        .is('reply_to_post_id', null)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .range(start, end)

      if (error) throw error

      const rows = ((data as any[]) || []).filter(p => !hiddenPosts.has(p.id))
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
        const author = post.author || {}
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
          comment_count: post.comment_count ? post.comment_count[0].count : 0,
          // Preserve self-embeds for UI to use
          original_post: post.original_post || null,
          reply_to_post: post.reply_to_post || null
        } as WallPost
      })

      setPosts((prev) => (append ? [...prev, ...normalized] : normalized))
      setHasMore(rows.length === PAGE_SIZE)
    } catch (err: any) {
      console.error('Error loading wall posts:', err)
      // Only show error toast to authenticated users to avoid RLS-related confusion on landing page
      if (user) {
        toast.error('Failed to load Wall posts')
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [user])

  const loadComments = useCallback(async (postId: string) => {
    if (loadingComments === postId) return
    setLoadingComments(postId)

    try {
      const { data, error } = await supabase
        .from('troll_wall_posts')
        .select(`
          *,
          author:user_profiles(
            id,
            username,
            avatar_url,
            role,
            is_admin,
            is_troll_officer,
            is_og_user,
            created_at
          ),
          original_post:troll_wall_posts!original_post_id(*),
          reply_to_post:troll_wall_posts!reply_to_post_id(*)
        `)
        .eq('reply_to_post_id', postId)
        .order('created_at', { ascending: true })

      if (error) throw error

      const normalized = ((data as any[]) || []).map((post: any) => {
        const author = post.author || {}
        return {
          ...post,
          username: author.username,
          avatar_url: author.avatar_url,
          is_admin: author.is_admin,
          is_troll_officer: author.is_troll_officer,
          is_og_user: author.is_og_user,
          user_created_at: author.created_at,
          user_liked: false, // Comments don't have likes in this view
          reactions: post.reactions || {},
          gifts: post.gifts || {},
          original_post: post.original_post || null,
          reply_to_post: post.reply_to_post || null
        } as WallPost
      })

      setComments((prev) => ({ ...prev, [postId]: normalized }))
    } catch (err: any) {
      console.error('Error loading comments:', err)
      toast.error('Failed to load comments')
    } finally {
      setLoadingComments(null)
    }
  }, [loadingComments])

  const handleDelete = async (postId: string) => {
    if (!onRequireAuth('delete posts')) return

    if (!window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) return

    try {
      const { error } = await supabase.rpc('delete_troll_wall_post', { post_id: postId })
      if (error) throw error

      setPosts((prev) => prev.filter((p) => p.id !== postId))
      toast.success('Post deleted successfully')
    } catch (err: any) {
      console.error('Error deleting post:', err)
      toast.error(err.message || 'Failed to delete post')
    }
  }

  const handleHide = (postId: string) => {
    const newHiddenPosts = new Set(hiddenPosts)
    newHiddenPosts.add(postId)
    setHiddenPosts(newHiddenPosts)
    localStorage.setItem('hiddenPosts', JSON.stringify(Array.from(newHiddenPosts)))
    setPosts((prev) => prev.filter((p) => p.id !== postId))
    toast.success('Post hidden from your feed')
  }

  const handleReport = async (postId: string) => {
    if (!onRequireAuth('report posts')) return

    const reason = window.prompt('Please provide a reason for reporting this post:')
    if (reason === null) return // User cancelled

    try {
      const { error } = await supabase.rpc('report_post', { post_id: postId, reason })
      if (error) throw error
      toast.success('Post reported successfully')
    } catch (err: any) {
      console.error('Error reporting post:', err)
      toast.error(err.message || 'Failed to report post')
    }
  }

  const handleShare = async (postId: string) => {
    if (!onRequireAuth('share posts')) return

    try {
      const { error } = await supabase.rpc('share_post_to_profile', { original_post_id: postId })
      if (error) throw error
      toast.success('Post shared to your profile')
    } catch (err: any) {
      console.error('Error sharing post:', err)
      toast.error(err.message || 'Failed to share post')
    }
  }

  useEffect(() => {
    loadPosts(0, false)
  }, [loadPosts])

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

  const renderPost = (index: number, post: WallPost) => (
    <div className="pb-4">
      <div
        className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-5`}
      >
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-full overflow-hidden bg-white/5 flex-shrink-0">
            {post.avatar_url ? (
              <img src={post.avatar_url} alt={post.username || 'User'} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-sm text-white/60">
                {post.username?.[0]?.toUpperCase() || 'T'}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
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
                      className="font-semibold text-white"
                    />
                  ) : (
                    <span className="font-semibold text-white/60">Deleted User</span>
                  )}
                  <span className="text-xs text-white/40">
                    {new Date(post.created_at).toLocaleString()}
                  </span>
                </div>
                {post.reply_to_post_id && (
                  <p className="mt-1 text-xs text-purple-300">Replying to a post</p>
                )}
              </div>

              <div className="relative flex-shrink-0">
                <button type="button" onClick={() => setActiveMenu(activeMenu === post.id ? null : post.id)} className="p-1 rounded-full text-white/60 hover:bg-white/10 hover:text-white">
                  <MoreVertical size={18} />
                </button>
                {activeMenu === post.id && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10">
                    <ul className="py-1">
                      <li>
                    <button onClick={() => handleShare(post.id)} className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-slate-700 flex items-center gap-2">
                      <Share size={16} /> Share
                    </button>
                  </li>
                      <li>
                    <button onClick={() => handleReport(post.id)} className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-slate-700 flex items-center gap-2">
                      <Flag size={16} /> Report
                    </button>
                  </li>
                      {(profile?.role === 'admin' || profile?.role === 'secretary' || user?.id === post.user_id) && (
                    <li>
                      <button onClick={() => handleDelete(post.id)} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2">
                        <Trash2 size={16} /> Delete
                      </button>
                    </li>
                  )}
                  {!(profile?.role === 'admin' || profile?.role === 'secretary' || user?.id === post.user_id) && (
                    <li>
                      <button onClick={() => handleHide(post.id)} className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-slate-700 flex items-center gap-2">
                        <Trash2 size={16} /> Hide
                      </button>
                    </li>
                  )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-3 text-white/90 whitespace-pre-wrap break-words">
              {post.content}
            </p>
            {post.metadata?.image_url && (
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
                <img src={post.metadata.image_url} alt="Post media" className="w-full object-cover" />
              </div>
            )}
            {post.metadata?.video_url && (
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
                <video controls className="w-full">
                  <source src={post.metadata.video_url} />
                </video>
              </div>
            )}
            <div className="mt-4 flex items-center gap-3 text-sm text-white/60">
              <button
                type="button"
                onClick={() => handleLike(post.id)}
                disabled={likingPosts.has(post.id)}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 transition-colors ${
                  post.user_liked
                    ? 'bg-pink-600/20 text-pink-300'
                    : 'hover:bg-white/5'
                }`}
              >
                <Heart className={`h-4 w-4 ${post.user_liked ? 'fill-current' : ''}`} />
                {post.likes || 0}
              </button>
              <button
                type="button"
                onClick={() => setReplyingTo((prev) => (prev === post.id ? null : post.id))}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 hover:bg-white/5"
              >
                <Reply className="h-4 w-4" />
                Reply
              </button>
              {post.comment_count > 0 && (
                <button
                  type="button"
                  onClick={() => loadComments(post.id)}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 hover:bg-white/5"
                >
                  <MessageSquare className="h-4 w-4" />
                  {post.comment_count} {post.comment_count === 1 ? 'Comment' : 'Comments'}
                </button>
              )}
            </div>
            <div className="mt-4">
              {replyingTo === post.id && (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
                  <textarea
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    placeholder="Write a reply..."
                    className="w-full min-h-[80px] bg-transparent text-white placeholder-white/40 focus:outline-none"
                  />
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingTo(null)
                        setReplyText('')
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReplySubmit(post.id)}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-500"
                    >
                      Post Reply
                    </button>
                  </div>
                </div>
              )}
              {loadingComments === post.id && (
                <div className="mt-4 text-center text-white/50">Loading comments...</div>
              )}
              {comments[post.id] && (
                <div className="mt-4 space-y-4">
                  {comments[post.id].map((comment) => (
                    <TrollWallPostComment key={comment.id} comment={comment} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Wall</h2>
          <p className={`${trollCityTheme.text.muted} text-sm`}>The city timeline. Share updates and join the conversation.</p>
        </div>
      </div>

      <CreatePostComposer onPostCreated={handlePostCreated} onRequireAuth={onRequireAuth} />

      <div className="space-y-4">
        {loading ? (
          <div className="py-10 text-center text-white/50">Loading Wall...</div>
        ) : posts.length === 0 ? (
          <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-10 text-center text-white/50`}>
            <MessageSquare className="mx-auto mb-3 h-8 w-8" />
            <p>No posts yet. Start the conversation.</p>
          </div>
        ) : (
          <div className="h-[800px]">
            <Virtuoso
              style={{ height: '100%' }}
              data={posts}
              itemContent={renderPost}
              endReached={() => {
                if (hasMore && !loadingMore) {
                  const nextPage = page + 1
                  setPage(nextPage)
                  loadPosts(nextPage, true)
                }
              }}
              increaseViewportBy={200}
            />
          </div>
        )}
      </div>
    </div>
  )
}
