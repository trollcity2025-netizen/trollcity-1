import { useState, useEffect } from 'react'
import { X, MessageSquare, Video, Sword, Users, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { WallPostType } from '../../types/trollWall'
import { useNavigate } from 'react-router-dom'

interface CreatePostModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CreatePostModal({
  isOpen,
  onClose,
  onSuccess
}: CreatePostModalProps) {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [postType, setPostType] = useState<WallPostType>('text')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedStreamId, setSelectedStreamId] = useState<string>('')
  const [availableStreams, setAvailableStreams] = useState<any[]>([])

  // Load user's streams for stream_announce type
  const loadStreams = async () => {
    if (!user?.id || postType !== 'stream_announce') return

    try {
      const { data } = await supabase
        .from('streams')
        .select('id, title, is_live')
        .eq('broadcaster_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (data) {
        setAvailableStreams(data)
        if (data.length > 0 && data[0].is_live) {
          setSelectedStreamId(data[0].id)
        }
      }
    } catch (err) {
      console.error('Error loading streams:', err)
    }
  }

  // Load streams when post type changes to stream_announce
  useEffect(() => {
    if (postType === 'stream_announce' && user?.id) {
      loadStreams()
    }
  }, [postType, user?.id])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user || !profile) {
      toast.error('Please log in to create posts')
      return
    }

    if (!content.trim()) {
      toast.error('Please enter some content')
      return
    }

    if (content.length > 240) {
      toast.error('Content must be 240 characters or less')
      return
    }

    setLoading(true)
    try {
      const metadata: any = {}

      // Add stream_id if stream_announce
      if (postType === 'stream_announce' && selectedStreamId) {
        metadata.stream_id = selectedStreamId
        const selectedStream = availableStreams.find(s => s.id === selectedStreamId)
        if (selectedStream) {
          metadata.stream_title = selectedStream.title
        }
      }

      const { error } = await supabase
        .from('troll_wall_posts')
        .insert({
          user_id: user.id,
          post_type: postType,
          content: content.trim(),
          metadata
        })

      if (error) throw error

      toast.success('Post created!')
      setContent('')
      setPostType('text')
      setSelectedStreamId('')
      onSuccess()
    } catch (err: any) {
      console.error('Error creating post:', err)
      toast.error(err?.message || 'Failed to create post')
    } finally {
      setLoading(false)
    }
  }

  const postTypeOptions: { value: WallPostType; label: string; icon: React.ReactNode; description: string }[] = [
    { value: 'text', label: 'Text Update', icon: <MessageSquare className="w-4 h-4" />, description: 'Share a text update (max 240 chars)' },
    { value: 'stream_announce', label: 'Stream Promo', icon: <Video className="w-4 h-4" />, description: 'Promote your live stream' },
    { value: 'battle_result', label: 'Battle Achievement', icon: <Sword className="w-4 h-4" />, description: 'Share a battle result' },
    { value: 'family_announce', label: 'Family Announcement', icon: <Users className="w-4 h-4" />, description: 'Announce to your family' },
  ]

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-xl border border-purple-500/30 max-w-2xl w-full p-6 relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-purple-400" />
            Create Post
          </h2>
          <p className="text-sm text-gray-400 mt-1">Share with the Troll City community</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Post Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Post Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {postTypeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPostType(option.value)}
                  className={`p-3 rounded-lg border-2 transition ${
                    postType === option.value
                      ? 'border-purple-500 bg-purple-900/30'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {option.icon}
                    <span className="text-sm font-semibold text-white">{option.label}</span>
                  </div>
                  <p className="text-xs text-gray-400">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Stream Selection (for stream_announce) */}
          {postType === 'stream_announce' && (
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Select Stream
              </label>
              {availableStreams.length === 0 ? (
                <div className="p-4 bg-zinc-800 rounded-lg border border-gray-700">
                  <p className="text-sm text-gray-400 mb-2">No streams found</p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      navigate('/go-live')
                    }}
                    className="text-sm text-purple-400 hover:text-purple-300"
                  >
                    Go Live to create a stream
                  </button>
                </div>
              ) : (
                <select
                  value={selectedStreamId}
                  onChange={(e) => setSelectedStreamId(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white"
                >
                  <option value="">Select a stream...</option>
                  {availableStreams.map((stream) => (
                    <option key={stream.id} value={stream.id}>
                      {stream.title || 'Untitled'} {stream.is_live ? '(Live)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Content Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Content <span className="text-gray-500">({content.length}/240)</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              rows={4}
              maxLength={240}
              className="w-full px-4 py-3 bg-zinc-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {240 - content.length} characters remaining
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!content.trim() || loading || content.length > 240}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

