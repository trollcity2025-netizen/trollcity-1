import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { toast } from "sonner";

const LikeButton = ({ userId, streamId, className = "" }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const queryClient = useQueryClient();

  // Check if user has liked this stream
  const { data: hasLiked } = useQuery({
    queryKey: ["streamLike", streamId, userId],
    queryFn: async () => {
      if (!userId || !streamId) return false;
      const { data, error } = await supabase
        .from("stream_likes")
        .select("id")
        .eq("user_id", userId)
        .eq("stream_id", streamId)
        .single();
      if (error) return false;
      return !!data;
    },
    enabled: !!userId && !!streamId,
    refetchInterval: 5000,
  });

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Please log in first");
      if (!streamId) throw new Error("Stream not found");

      // Check if already liked
      if (hasLiked) {
        // Remove like
        const { error } = await supabase
          .from("stream_likes")
          .delete()
          .eq("user_id", userId)
          .eq("stream_id", streamId);
        if (error) throw error;
        return { liked: false };
      } else {
        // Add like
        const { error } = await supabase.from("stream_likes").insert({
          user_id: userId,
          stream_id: streamId,
        });
        if (error) throw error;
        return { liked: true };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["streamLike", streamId, userId] });
      queryClient.invalidateQueries({ queryKey: ["streamLikeCount", streamId] });
    },
    onError: (error) => {
      console.error("Like error:", error);
      toast.error("Failed to like stream");
    },
  });

  const handleLike = () => {
    setIsAnimating(true);
    likeMutation.mutate();
    setTimeout(() => setIsAnimating(false), 300);
  };

  return (
    <Button
      onClick={handleLike}
      disabled={likeMutation.isPending}
      className={`flex items-center gap-2 transition-all duration-200 ${
        hasLiked
          ? "bg-red-600 hover:bg-red-700 text-white"
          : "bg-gray-700 hover:bg-gray-600 text-white"
      } ${isAnimating ? "scale-110" : "scale-100"} ${className}`}
    >
      <Heart
        className={`w-5 h-5 transition-all duration-200 ${
          hasLiked ? "fill-current" : "fill-none"
        } ${isAnimating ? "scale-125" : "scale-100"}`}
      />
      Like
    </Button>
  );
};

export default LikeButton;
