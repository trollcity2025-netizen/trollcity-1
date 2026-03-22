import React, { useEffect, useRef, useState, useCallback } from "react";
import ReelActions from "./ReelActions";
import ReelCommentsOverlay from "../components/ReelCommentsOverlay";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";
import { parseTextWithLinks } from "../lib/utils";

const ReelSlide: React.FC<{ post: any; isActive: boolean }> = ({
  post,
  isActive,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showComments, setShowComments] = useState(false);
  const { user } = useAuthStore();

  const recordView = useCallback(async (postId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.rpc("record_post_view", {
        p_post_id: postId,
        p_user_id: user.id,
      });

      if (error) {
        console.warn("Error recording view:", error);
      }
    } catch (err) {
      console.warn("Failed to record view:", err);
    }
  }, [user]);

  const triggerEarnings = useCallback(async (postId: string) => {
    try {
      const { error } = await supabase.functions.invoke("calc_post_earnings", {
        body: { postId },
      });
      if (error) console.error("Earnings error:", error);
    } catch (err) {
      console.error("Earnings error:", err);
    }
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(() => {});
        // Record view and trigger earnings when reel becomes active
        recordView(post.id);
        triggerEarnings(post.id);
      } else {
        videoRef.current.pause();
      }
    }
  }, [isActive, post.id, recordView, triggerEarnings]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={post.video_url}
        className="w-full h-full object-cover"
        muted
        loop
        playsInline
      />

      {/* dim overlay tap zone at bottom to open comments */}
      <div
        className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 via-black/30 to-transparent"
        onClick={() => setShowComments(true)}
      />

      {/* actions on the right side */}
      <ReelActions post={post} onCommentsClick={() => setShowComments(true)} />

      {/* basic text caption area */}
      <div className="absolute left-3 bottom-28 text-xs text-white max-w-[60%] space-y-1">
        <div className="font-semibold text-sm">@{post.user_profiles?.username}</div>
        {post.content && (
          <div className="text-[11px] text-gray-200 line-clamp-3">
            {parseTextWithLinks(post.content)}
          </div>
        )}
        <div className="text-[10px] text-gray-400">
          {post.coins_earned || 0} coins •{" "}
          {new Date(post.created_at).toLocaleDateString()}
        </div>
      </div>

      {showComments && (
        <ReelCommentsOverlay
          postId={post.id}
          onClose={() => setShowComments(false)}
        />
      )}
    </div>
  );
};

export default ReelSlide;