import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { 
  MessageSquare, Heart, Plus, Video, Sword, Users, Trophy, 
  Zap, ExternalLink, Trash2
} from 'lucide-react'
import { WallPost, WallPostType } from '../types/trollWall'
import CreatePostModal from '../components/trollWall/CreatePostModal'
import ClickableUsername from '../components/ClickableUsername'

export default function TrollCityWall() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [posts, setPosts] = useState<WallPost[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [likingPosts, setLikingPosts] = useState<Set<string>>(new Set())

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('troll_wall_posts_view')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      if (data && user?.id) {
        // Check which posts the user has liked
        const postIds = data.map(p => p.id)
        const { data: userLikes } = await supabase
          .from('troll_wall_likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postIds)

        const likedPostIds = new Set(userLikes?.map(l => l.post_id) || [])

        // Merge posts with like status
        const postsWithLikes = data.map(post => ({
          ...post,
          user_liked: likedPostIds.has(post.id)
        }))

        setPosts(postsWithLikes as WallPost[])
      } else {
        setPosts(data || [])
      }
    } catch (err: any) {
      console.error('Error loading wall posts:', err)
      toast.error('Failed to load wall posts')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadPosts()

    // Real-time subscription for new posts
    const channel = supabase
      .channel('troll_wall_posts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'troll_wall_posts'
        },
        (payload) => {
          const newPost = payload.new as any
          // Fetch user info for the new post
          supabase
            .from('user_profiles')
            .select('username, avatar_url, is_admin, is_troll_officer, is_og_user')
            .eq('id', newPost.user_id)
            .single()
            .then(({ data: userData }) => {
              setPosts(prev => [{
                ...newPost,
                ...userData,
                user_liked: false
              } as WallPost, ...prev])
            })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'troll_wall_posts'
        },
        (payload) => {
          const updatedPost = payload.new as any
          setPosts(prev =>
            prev.map(p => p.id === updatedPost.id ? { ...p, ...updatedPost } : p)
          )
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'troll_wall_posts'
        },
        (payload) => {
          const deletedId = (payload.old as any).id
          setPosts(prev => prev.filter(p => p.id !== deletedId))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadPosts])

  const handleLike = async (postId: string) => {
    if (!user?.id) {
      toast.error('Please log in to like posts')
      return
    }

    if (likingPosts.has(postId)) return // Prevent double-click

    setLikingPosts(prev => new Set(prev).add(postId))

    try {
      const { data, error } = await supabase
        .rpc('toggle_wall_post_like', {
          p_post_id: postId,
          p_user_id: user.id
        })

      if (error) throw error

      if (data) {
        // Update local state optimistically
        setPosts(prev =>
          prev.map(p =>
            p.id === postId
              ? {
                  ...p,
                  likes: data.likes_count,
                  user_liked: data.liked
                }
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

  const handleDelete = async (postId: string) => {
    if (!user?.id) {
      return
    }

    if (!confirm('Are you sure you want to delete this post?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('troll_wall_posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.id) // Ensure user can only delete their own posts

      if (error) throw error

      toast.success('Post deleted')
      setPosts(prev => prev.filter(p => p.id !== postId))
    } catch (err: any) {
      console.error('Error deleting post:', err)
      toast.error('Failed to delete post')
    }
  }

  const getPostIcon = (type: WallPostType) => {
    switch (type) {
      case 'stream_announce':
        return <Video className="w-4 h-4 text-red-400" />
      case 'battle_result':
        return <Sword className="w-4 h-4 text-purple-400" />
      case 'family_announce':
        return <Users className="w-4 h-4 text-blue-400" />
      case 'badge_earned':
        return <Trophy className="w-4 h-4 text-yellow-400" />
      case 'system':
        return <Zap className="w-4 h-4 text-cyan-400" />
      default:
        return <MessageSquare className="w-4 h-4 text-gray-400" />
    }
  }

  const handlePostClick = (post: WallPost) => {
    if (post.metadata?.stream_id) {
      navigate(`/stream/${post.metadata.stream_id}`)
    } else if (post.metadata?.battle_id) {
      navigate('/battles')
    } else if (post.metadata?.family_id) {
      navigate('/family')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
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

        {/* Posts Feed */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No posts yet. Be the first to share something!</p>
            </div>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C] hover:border-purple-500/30 transition-colors"
              >
                {/* Post Header */}
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {post.avatar_url ? (
                      <img
                        src={post.avatar_url}
                        alt={post.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-bold text-lg">
                        {post.username?.[0]?.toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <ClickableUsername
                        username={post.username || 'Unknown'}
                        userId={post.user_id}
                        className="font-semibold text-white hover:text-purple-400"
                      />
                      {post.is_admin && (
                        <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded">
                          ADMIN
                        </span>
                      )}
                      {post.is_troll_officer && (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded">
                          OFFICER
                        </span>
                      )}
                      {post.is_og_user && (
                        <span className="px-2 py-0.5 bg-yellow-600 text-white text-xs font-bold rounded">
                          OG
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-gray-400 text-xs">
                        {getPostIcon(post.post_type)}
                        {post.post_type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(post.created_at).toLocaleString()}
                    </p>
                  </div>
                  {user && post.user_id === user.id && (
                    <button
                      type="button"
                      onClick={() => handleDelete(post.id)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400"
                      title="Delete post"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Post Content */}
                <div
                  className={`mb-4 ${post.metadata?.stream_id || post.metadata?.battle_id ? 'cursor-pointer hover:text-purple-400 transition-colors' : ''}`}
                  onClick={() => handlePostClick(post)}
                >
                  <p className="text-white whitespace-pre-wrap break-words">{post.content}</p>
                  
                  {/* Stream Link */}
                  {post.metadata?.stream_id && (
                    <div className="mt-3 flex items-center gap-2 text-purple-400 text-sm">
                      <ExternalLink className="w-4 h-4" />
                      <span>Watch Stream</span>
                    </div>
                  )}

                  {/* Battle Link */}
                  {post.metadata?.battle_id && (
                    <div className="mt-3 flex items-center gap-2 text-purple-400 text-sm">
                      <Sword className="w-4 h-4" />
                      <span>View Battle</span>
                    </div>
                  )}
                </div>

                {/* Post Actions */}
                <div className="flex items-center gap-4 pt-4 border-t border-[#2C2C2C]">
                  <button
                    type="button"
                    onClick={() => handleLike(post.id)}
                    disabled={!user || likingPosts.has(post.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      post.user_liked
                        ? 'bg-pink-600/20 text-pink-400'
                        : 'hover:bg-gray-800 text-gray-400 hover:text-pink-400'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Heart className={`w-5 h-5 ${post.user_liked ? 'fill-current' : ''}`} />
                    <span>{post.likes || 0}</span>
                  </button>
                </div>
              </div>
            ))
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
    </div>
  )
}
