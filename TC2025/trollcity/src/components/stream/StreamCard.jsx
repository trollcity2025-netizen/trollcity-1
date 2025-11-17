
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Heart, MessageCircle, Users, Radio, XCircle } from "lucide-react";
import OGBadge from "../OGBadge";
import TrollFamilyBadge from "../TrollFamilyBadge";
import { useNavigate } from "react-router-dom"; // Assuming react-router-dom for navigation
import { createPageUrl } from "@/utils"; // Updated import path

export default function StreamCard({ stream, onStreamClick, onUserClick, adminControls }) {
  const navigate = useNavigate();

  const { data: streamerProfile } = useQuery({
    queryKey: ["streamerProfileForCard", stream?.streamer_id],
    queryFn: async () => {
      if (!stream?.streamer_id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, avatar, avatar_url, username, created_date")
        .eq("id", stream.streamer_id)
        .single();
      if (error) return null;
      return data || null;
    },
    staleTime: 30000,
    enabled: !!stream?.streamer_id && !stream?.streamer_avatar,
  });

  const handleStreamClick = () => {
    if (onStreamClick) {
      onStreamClick(stream.id);
    } else {
      // Assuming createPageUrl is a function that generates a URL path
      navigate(createPageUrl("StreamViewer") + `?streamId=${stream.id}`);
    }
  };

  return (
    <div
      className="group relative bg-[#1a1a24] rounded-2xl overflow-hidden border border-[#2a2a3a] hover:border-purple-500/50 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
    >
      {/* Admin Controls */}
      {adminControls && (
        <div className="absolute top-2 right-2 z-20">
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              adminControls.onEndStream(stream.id);
            }}
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <XCircle className="w-4 h-4 mr-1" />
            End
          </Button>
        </div>
      )}

      {/* Thumbnail */}
      <div
        onClick={handleStreamClick}
        className="relative aspect-video bg-black/50 overflow-hidden"
      >
        {stream.thumbnail_url ? (
          <img
            src={stream.thumbnail_url}
            alt={stream.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextElementSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div className="w-full h-full bg-gradient-to-br from-purple-900/50 to-pink-900/50 flex items-center justify-center" style={{display: stream.thumbnail_url ? 'none' : 'flex'}}>
          <Radio className="w-16 h-16 text-purple-300/30" />
        </div>

        {/* Live Badge */}
        <div className="absolute top-3 left-3">
          <Badge className="bg-red-500 text-white px-3 py-1 font-bold">
            <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
            LIVE
          </Badge>
        </div>

        {/* Viewer Count */}
        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-2">
          <Eye className="w-4 h-4 text-white" />
          <span className="text-white text-sm font-semibold">{stream.viewer_count || 0}</span>
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* Stream Info */}
      <div className="p-4">
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (onUserClick) {
              onUserClick(stream.streamer_id);
            } else {
              // Default: navigate to public profile when clicking user area
              navigate(createPageUrl("PublicProfile") + `?userId=${stream.streamer_id}`);
            }
          }}
          className="flex items-start gap-3 mb-3 cursor-pointer hover:opacity-80 transition-opacity"
        >
          {(stream.streamer_avatar || streamerProfile?.avatar || streamerProfile?.avatar_url) ? (
            <img
              src={stream.streamer_avatar || streamerProfile?.avatar || streamerProfile?.avatar_url}
              alt={stream.streamer_name}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-500 flex-shrink-0"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center ring-2 ring-purple-500 flex-shrink-0" style={{display: (stream.streamer_avatar || streamerProfile?.avatar || streamerProfile?.avatar_url) ? 'none' : 'flex'}}>
            <span className="text-white font-bold text-sm">
              {stream.streamer_name?.[0]?.toUpperCase()}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <h3
              onClick={(e) => {
                e.stopPropagation(); // Prevent parent div's onClick from firing again
                handleStreamClick();
              }}
              className="text-white font-semibold text-base line-clamp-2 mb-1 hover:text-purple-400 transition-colors"
            >
              {stream.title}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-gray-400 text-sm font-medium hover:text-purple-400 transition-colors">
                {stream.streamer_name}
              </p>
              <OGBadge user={{created_date: stream.streamer_created_date}} />
            </div>
          </div>
        </div>

        {/* Category Badge */}
        <div className="mb-3">
          <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors">
            {stream.category}
          </Badge>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-1">
            <Heart className="w-4 h-4" />
            <span>{stream.likes || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageCircle className="w-4 h-4" />
            <span>{stream.chat_message_count || 0}</span>
          </div>
          {stream.stream_mode === "multi" && (
            <div className="flex items-center gap-1 text-cyan-400">
              <Users className="w-4 h-4" />
              <span>Multi-Beam</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
