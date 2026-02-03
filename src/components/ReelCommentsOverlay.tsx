import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";
import { toast } from "sonner";
import { X, Send } from "lucide-react";
import UserNameWithAge from "./UserNameWithAge";

interface TrollComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_profiles?: {
    username: string;
    avatar_url: string | null;
    created_at?: string;
  }[];
}

interface ReelCommentsOverlayProps {
  postId: string;
  onClose: () => void;
}

const ReelCommentsOverlay: React.FC<ReelCommentsOverlayProps> = ({
  postId,
  onClose,
}) => {
  const { user, profile } = useAuthStore();
  const [comments, setComments] = useState<TrollComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("troll_post_comments")
        .select(
          `
          id,
          post_id,
          user_id,
          content,
          created_at,
          user_profiles!user_id (
            username,
            avatar_url,
            created_at
          )
        `
        )
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (err) {
      console.error("Error loading comments:", err);
      toast.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadComments();

    // Polling for new comments (every 15 seconds)
    const interval = setInterval(() => {
      loadComments();
    }, 15000);

    return () => {
      clearInterval(interval);
    };
  }, [loadComments]);

  const sendComment = async () => {
    if (!user || !profile) {
      toast.error("Login required");
      return;
    }
    if (!message.trim()) return;

    try {
      setSending(true);
      const content = message.trim();
      setMessage("");

      const { error } = await supabase.from("troll_post_comments").insert([
        {
          post_id: postId,
          user_id: profile.id,
          content,
        },
      ]);

      if (error) throw error;

      // local echo is handled by realtime listener
    } catch (err) {
      console.error("Error sending comment:", err);
      toast.error("Failed to send comment");
      setMessage(message); // put it back
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes tc-slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0%);
            opacity: 1;
          }
        }

        .animate-tc-slide-up {
          animation: tc-slide-up 0.3s ease-out;
        }
      `}</style>
      <div className="absolute inset-x-0 bottom-0 h-[70%] bg-black/85 backdrop-blur-xl border-t border-purple-500/70 rounded-t-2xl z-30 animate-tc-slide-up">
      {/* drag handle / header */}
      <div className="flex items-center justify-between px-4 pt-2 pb-3 border-b border-purple-900/70">
        <div className="flex-1 flex justify-center">
          <div className="w-12 h-1.5 bg-purple-500/70 rounded-full" />
        </div>
        <button
          onClick={onClose}
          className="ml-3 text-gray-300 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* comments list */}
      <div
        ref={listRef}
        className="px-4 pt-2 pb-24 overflow-y-auto space-y-3 custom-scrollbar"
      >
        {loading && (
          <div className="text-xs text-gray-400 text-center mt-4">
            Summoning troll comments...
          </div>
        )}

        {!loading && comments.length === 0 && (
          <div className="text-xs text-gray-400 text-center mt-4">
            No comments yet. Start the chaos 👹
          </div>
        )}

        {comments.map((c) => (
          <div key={c.id} className="flex items-start space-x-2 text-xs">
            <img
              src={
                c.user_profiles?.[0]?.avatar_url ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${
                  c.user_profiles?.[0]?.username || "troll"
                }`
              }
              alt={c.user_profiles?.[0]?.username || "user"}
              className="w-7 h-7 rounded-full border border-purple-500/60"
            />
            <div className="flex-1">
              <div className="flex items-center space-x-1">
                <UserNameWithAge
                  user={{
                    username: c.user_profiles?.[0]?.username || "Unknown",
                    id: c.user_id,
                    created_at: c.user_profiles?.[0]?.created_at
                  }}
                  className="font-semibold text-[11px] text-troll-purple"
                />
                <span className="text-[10px] text-gray-500">
                  {new Date(c.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="text-[11px] text-gray-100 whitespace-pre-wrap">
                {c.content}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* input bar */}
      <div className="absolute inset-x-0 bottom-0 px-3 pb-4 pt-2 bg-gradient-to-t from-black via-black/80 to-transparent">
        <div className="flex items-center space-x-2 bg-[#05010B] border border-purple-700/70 rounded-full px-3 py-1.5">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                sendComment();
              }
            }}
            placeholder="Drop your troll comment..."
            className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
          />
          <button
            onClick={sendComment}
            disabled={sending || !message.trim()}
            className="p-1.5 rounded-full bg-troll-green disabled:opacity-40 flex items-center justify-center"
          >
            <Send className="w-3 h-3 text-black" />
          </button>
        </div>
      </div>
    </div>
    </>
  );
};

export default ReelCommentsOverlay;