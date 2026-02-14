import { useRef, useState } from 'react'
import { Image, Smile } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { trollCityTheme } from '@/styles/trollCityTheme'
import { WallPost } from '@/types/trollWall'

const EMOJI_OPTIONS = [':)', ':D', '<3', ':-)', ';)', ':P']

interface CreatePostComposerProps {
  onPostCreated: (post: WallPost) => void
  onRequireAuth: (intent?: string) => boolean
}

export default function CreatePostComposer({ onPostCreated, onRequireAuth }: CreatePostComposerProps) {
  const { user, profile } = useAuthStore()
  const [content, setContent] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleRequireAuth = (intent?: string) => {
    if (user) return true
    onRequireAuth(intent)
    return false
  }

  const handleEmojiInsert = (emoji: string) => {
    setContent((prev) => `${prev}${prev ? ' ' : ''}${emoji}`)
    setShowEmoji(false)
  }

  const handleImagePick = () => {
    if (!handleRequireAuth('add an image')) return
    fileInputRef.current?.click()
  }

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB')
      return
    }

    setImageFile(file)
  }

  const handleSubmit = async () => {
    if (!handleRequireAuth('create a post')) return

    if (!content.trim()) {
      toast.error('Write something before posting')
      return
    }

    setSubmitting(true)
    try {
      const metadata: Record<string, string> = {}

      if (imageFile && user) {
        const extension = imageFile.name.split('.').pop() || 'png'
        const fileName = `${user.id}/${Date.now()}_img.${extension}`
        const { error: uploadError } = await supabase.storage
          .from('post-media')
          .upload(fileName, imageFile)

        if (uploadError) throw uploadError

        const { data: publicData } = supabase.storage
          .from('post-media')
          .getPublicUrl(fileName)

        metadata.image_url = publicData.publicUrl
      }

      const { data, error } = await supabase
        .from('troll_wall_posts')
        .insert({
          user_id: user?.id,
          post_type: imageFile ? 'image' : 'text',
          content: content.trim(),
          metadata
        })
        .select('*')
        .single()

      if (error) throw error

      const optimisticPost: WallPost = {
        ...(data as WallPost),
        username: profile?.username || 'You',
        avatar_url: profile?.avatar_url || null,
        is_admin: profile?.is_admin || false,
        is_troll_officer: profile?.is_troll_officer || false,
        is_og_user: profile?.is_og_user || false,
        user_created_at: profile?.created_at,
        user_liked: false,
        reactions: {},
        gifts: {}
      }

      onPostCreated(optimisticPost)
      setContent('')
      setImageFile(null)
      toast.success('Post created')
    } catch (err: any) {
      console.error('Error creating post:', err)
      toast.error(err?.message || 'Failed to create post')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-4`}
      onClick={() => handleRequireAuth('create a post')}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-white/5 overflow-hidden flex-shrink-0">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.username || 'Profile'} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-sm text-white/60">
              {profile?.username?.[0]?.toUpperCase() || 'T'}
            </div>
          )}
        </div>
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="What's happening in the City?"
            className="w-full min-h-[90px] bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-purple-400/60"
            maxLength={240}
            onFocus={() => handleRequireAuth('create a post')}
          />
          {imageFile && (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70">
              <span className="truncate">{imageFile.name}</span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setImageFile(null)
                }}
                className="text-red-300 hover:text-red-200"
              >
                Remove
              </button>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  handleImagePick()
                }}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70"
              >
                <Image className="h-4 w-4" />
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    if (!handleRequireAuth('add an emoji')) return
                    setShowEmoji((prev) => !prev)
                  }}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70"
                >
                  <Smile className="h-4 w-4" />
                </button>
                {showEmoji && (
                  <div className="absolute z-10 mt-2 rounded-xl border border-white/10 bg-slate-900 p-2 shadow-xl">
                    <div className="flex gap-2">
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleEmojiInsert(emoji)
                          }}
                          className="px-2 py-1 rounded-lg bg-white/5 text-white/80 hover:bg-white/10 text-xs"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                handleSubmit()
              }}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        className="hidden"
      />
    </div>
  )
}
