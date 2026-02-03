import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";
import { toast } from "sonner";
import UserNameWithAge from "../components/UserNameWithAge";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_profiles?: {
    username: string;
    avatar_url: string | null;
    created_at?: string;
  }[];
}

interface ReelCommentsProps {
  postId: string;
  isVisible: boolean;
  onClose: () => void;
}

const ReelComments: React.FC<ReelCommentsProps> = ({ postId, isVisible, onClose }) => {
  const { user, profile } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);

  const loadComments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("troll_post_comments")
        .select(`
          id,
          content,
          created_at,
          user_profiles!user_id (
            username,
            avatar_url,
            created_at
          )
        `)
        .eq("post_id", postId)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setComments(data || []);
    } catch (err) {
      console.error("Error loading comments:", err);
    }
  }, [postId]);

  useEffect(() => {
    if (isVisible && postId) {
      loadComments();
    }
  }, [isVisible, postId, loadComments]);

  const addComment = async () => {
    if (!user || !profile || !newComment.trim()) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("troll_post_comments")
        .insert({
          post_id: postId,
          user_id: profile.id,
          content: newComment.trim(),
        })
        .select(`
          id,
          content,
          created_at,
          user_profiles!user_id (
            username,
            avatar_url,
            created_at
          )
        `)
        .single();

      if (error) throw error;

      setComments((prev) => [data as Comment, ...prev]);
      setNewComment("");
      toast.success("Comment added!");
    } catch (err) {
      console.error("Error adding comment:", err);
      toast.error("Failed to add comment");
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="absolute bottom-0 w-full h-[65%] bg-black/80 backdrop-blur-lg border-t border-purple-500 rounded-t-2xl animate-slideUp">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-purple-500/30">
        <h3 className="text-white font-semibold">Comments ({comments.length})</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-xl"
        >
          ✕
        </button>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[calc(100%-140px)]">
        {comments.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No comments yet. Be the first! 👹
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex space-x-3">
              <img
                src={
                  comment.user_profiles?.[0]?.avatar_url ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.user_profiles?.[0]?.username || "troll"}`
                }
                alt={comment.user_profiles?.[0]?.username || "user"}
                className="w-8 h-8 rounded-full border border-purple-500/50"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <UserNameWithAge
                    user={{
                      username: comment.user_profiles?.[0]?.username || "Unknown",
                      id: comment.user_profiles?.[0]?.username || "unknown", // Fallback ID if missing
                      created_at: comment.user_profiles?.[0]?.created_at
                    }}
                    className="font-semibold text-sm text-white"
                  />
                  <span className="text-xs text-gray-400">
                    {new Date(comment.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-200 mt-1">{comment.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Comment Input */}
      <div className="p-4 border-t border-purple-500/30">
        <div className="flex space-x-2">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 bg-gray-800 border border-purple-500/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            onKeyPress={(e) => e.key === "Enter" && addComment()}
          />
          <button
            onClick={addComment}
            disabled={loading || !newComment.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-purple-500 transition"
          >
            {loading ? "..." : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReelComments;