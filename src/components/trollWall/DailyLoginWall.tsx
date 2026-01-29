import React, { useEffect, useState } from 'react'
import { Calendar, Zap, Send } from 'lucide-react'
import { useAuthStore } from '../../lib/store'
import { useDailyLoginPost } from '../../lib/hooks/useDailyLoginPost'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

interface DailyLoginWallProps {
  onPostCreated?: (postId: string) => void
}

/**
 * Daily Login Wall Component
 * Allows users to make a post once per day to earn random coins (0-100)
 */
export default function DailyLoginWall({ onPostCreated }: DailyLoginWallProps) {
  const { user } = useAuthStore()
  const {
    loading,
    canPostToday,
    checkDailyPostStatus,
    submitDailyPost,
    generateRandomReward,
  } = useDailyLoginPost()

  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [previewReward, setPreviewReward] = useState<number | null>(null)

  // Check daily post status on mount
  useEffect(() => {
    checkDailyPostStatus()
  }, [checkDailyPostStatus])

  // Update preview reward when user hovers
  const handleMouseEnter = () => {
    if (canPostToday) {
      setPreviewReward(generateRandomReward())
    }
  }

  const handleMouseLeave = () => {
    setPreviewReward(null)
  }

  // Submit the daily post
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user?.id) {
      toast.error('You must be logged in')
      return
    }

    if (!content.trim()) {
      toast.error('Please write something to post')
      return
    }

    // Double-check before submitting - refresh the daily post status
    if (!canPostToday) {
      toast.error('You have already posted today!')
      return
    }

    setPosting(true)

    try {
      // Re-check daily post status to prevent race conditions
      const { data: existingPost, error: checkErr } = await supabase
        .from('daily_login_posts')
        .select('id')
        .eq('user_id', user.id)
        .gte('posted_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .lte('posted_at', new Date(new Date().setHours(23, 59, 59, 999)).toISOString())
        .limit(1)
        .maybeSingle()

      if (checkErr && checkErr.code !== 'PGRST116') {
        toast.error('Failed to verify post status')
        return
      }

      if (existingPost) {
        toast.error('You have already posted today! Come back tomorrow.')
        // Update local state to reflect actual database state
        await checkDailyPostStatus()
        return
      }

      // Create wall post
      const { data: postData, error: postError } = await supabase
        .from('troll_wall_posts')
        .insert({
          user_id: user.id,
          post_type: 'text',
          content: content.trim(),
          is_daily_login_post: true,
          metadata: {
            type: 'daily_login',
            posted_at: new Date().toISOString(),
          },
        })
        .select('id')
        .single()

      if (postError) {
        toast.error('Failed to create post')
        console.error('Post creation error:', postError)
        return
      }

      // Just reset form and callback, no coin reward
      setContent('')
      setPreviewReward(null)
      if (onPostCreated) {
        onPostCreated(postData.id)
      }
    } catch (err) {
      console.error('Error submitting daily post:', err)
      toast.error('An error occurred')
    } finally {
      setPosting(false)
    }
  }

  if (!user?.id) {
    return (
      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6 text-center">
        <Calendar className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
        <p className="text-gray-400">
          Log in to post daily and earn Troll Coins!
        </p>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 rounded-lg p-6 mb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Calendar className="w-5 h-5 text-cyan-400" />
        <h3 className="text-lg font-bold text-white">Daily Login Post</h3>
        {!canPostToday && (
          <span className="ml-auto text-sm bg-slate-700 text-yellow-300 px-3 py-1 rounded-full">
            ✓ Posted Today
          </span>
        )}
      </div>

      {/* Status Message */}
      <div className="mb-4 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
        <p className="text-sm text-gray-300">
          {canPostToday ? (
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              Post once daily to earn <span className="font-bold text-cyan-400">0-100 Troll Coins</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              Great! You already posted today. Come back tomorrow!
            </span>
          )}
        </p>
      </div>

      {/* Form */}
      {canPostToday ? (
        <form onSubmit={handleSubmit}>
          {/* Textarea */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind? Share your daily troll thoughts..."
            maxLength={500}
            disabled={posting || loading}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-400 disabled:opacity-50"
            rows={4}
          />

          {/* Character count */}
          <div className="text-right text-xs text-gray-500 mt-2">
            {content.length}/500
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!content.trim() || posting || loading}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="w-full mt-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {posting ? 'Posting...' : 'Post & Earn Coins'}
            {previewReward !== null && (
              <span className="ml-auto text-yellow-300 font-bold">
                +{previewReward} 🪙
              </span>
            )}
          </button>
        </form>
      ) : (
        /* Disabled State */
        <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg text-center">
          <p className="text-gray-400 mb-2">You can post again tomorrow!</p>
          <p className="text-xs text-gray-500">
            Posts reset daily at midnight UTC
          </p>
        </div>
      )}
    </div>
  )
}
