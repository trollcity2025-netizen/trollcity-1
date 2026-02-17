import { WallPost } from '@/types/trollWall'
import UserNameWithAge from '@/components/UserNameWithAge'

interface TrollWallPostCommentProps {
  comment: WallPost
}

export default function TrollWallPostComment({ comment }: TrollWallPostCommentProps) {
  return (
    <div className="flex items-start gap-3 mt-4">
      <div className="h-9 w-9 rounded-full overflow-hidden bg-white/5 flex-shrink-0">
        {comment.avatar_url ? (
          <img src={comment.avatar_url} alt={comment.username || 'User'} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-white/60">
            {comment.username?.[0]?.toUpperCase() || 'T'}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 bg-black/20 rounded-xl px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {comment.username ? (
            <UserNameWithAge
              user={{
                username: comment.username,
                id: comment.user_id,
                is_admin: comment.is_admin,
                is_troll_officer: comment.is_troll_officer,
                is_og_user: comment.is_og_user,
                created_at: comment.user_created_at
              }}
              className="font-semibold text-white text-sm"
            />
          ) : (
            <span className="font-semibold text-white/60 text-sm">Deleted User</span>
          )}
          <span className="text-xs text-white/40">
            {new Date(comment.created_at).toLocaleString()}
          </span>
        </div>
        <p className="mt-1 text-white/80 whitespace-pre-wrap break-words text-sm">
          {comment.content}
        </p>
      </div>
    </div>
  )
}
