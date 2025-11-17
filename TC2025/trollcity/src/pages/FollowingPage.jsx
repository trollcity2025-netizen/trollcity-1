
import React, { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Heart, Users, Eye, Radio } from "lucide-react"; // Added Radio icon
import StreamCard from "../components/stream/StreamCard";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button"; // Added Button component

export default function FollowingPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllStreams, setShowAllStreams] = useState(false); // Toggle for all streams

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => supabase.auth.me(),
  });

  const { data: following = [] } = useQuery({
    queryKey: ['myFollowing', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return await supabase.entities.Follow.filter({ follower_id: user.id });
    },
    enabled: !!user,
    initialData: [],
  });

  // Fetch followed streams
  const { data: followedStreams = [], isLoading: followedLoading } = useQuery({
    queryKey: ['followingStreams', user?.id],
    queryFn: async () => {
      if (!user || following.length === 0) return [];
      
      const followingIds = following.map(f => f.following_id);
      const allStreams = await supabase.entities.Stream.filter({ 
        status: "live",
        is_live: true 
      }, "-viewer_count");
      
      return allStreams.filter(stream => followingIds.includes(stream.streamer_id));
    },
    enabled: !!user && following.length > 0,
    initialData: [],
    refetchInterval: 5000, // Changed refetch interval
  });

  // Fetch ALL live streams (for search)
  const { data: allStreams = [], isLoading: allLoading } = useQuery({
    queryKey: ['allLiveStreams'],
    queryFn: async () => {
      const streams = await supabase.entities.Stream.filter({ 
        status: "live",
        is_live: true,
        agora_channel_name_ne: null // Added filter for non-null agora_channel_name
      }, "-viewer_count", 50); // Limit to 50 streams
      return streams;
    },
    enabled: showAllStreams, // Only enabled when showAllStreams is true
    initialData: [],
    refetchInterval: 10000, // New refetch interval
  });

  const isLoading = showAllStreams ? allLoading : followedLoading;
  const streams = showAllStreams ? allStreams : followedStreams;

  const filteredStreams = streams.filter(stream => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return stream.title?.toLowerCase().includes(query) ||
           stream.streamer_name?.toLowerCase().includes(query);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] pb-20">
      {/* Header */}
      <div className="text-center pt-12 pb-8 px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Heart className="w-10 h-10 text-pink-400" />
            <h1 className="text-5xl font-black text-white">
              {showAllStreams ? "All Streams" : "Following"}
            </h1>
          </div>
          <p className="text-gray-400 text-lg mb-6">
            {showAllStreams ? "🌍 Browse all live streams" : "💖 Streams from creators you follow"}
          </p>

          {/* Stats */}
          <div className="flex items-center justify-center gap-3">
            <Badge className="bg-pink-600/20 border border-pink-500/50 text-pink-400 px-5 py-2.5">
              <Users className="w-4 h-4 mr-2" />
              {following.length} Following
            </Badge>
            <Badge className="bg-purple-600/20 border border-purple-500/50 text-purple-400 px-5 py-2.5">
              <Eye className="w-4 h-4 mr-2" />
              {streams.length} Live Now
            </Badge>
          </div>
        </motion.div>
      </div>

      {/* Toggle between followed and all streams */}
      <div className="px-6 mb-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Button
            onClick={() => {
              setShowAllStreams(false);
              setSearchQuery(""); // Clear search when switching view
            }}
            className={`flex-1 ${!showAllStreams ? 'bg-pink-600 hover:bg-pink-700' : 'bg-[#1a1a24] hover:bg-[#2a2a3a] text-gray-300'}`}
          >
            <Heart className="w-4 h-4 mr-2" />
            Following
          </Button>
          <Button
            onClick={() => {
              setShowAllStreams(true);
              setSearchQuery(""); // Clear search when switching view
            }}
            className={`flex-1 ${showAllStreams ? 'bg-purple-600 hover:bg-purple-700' : 'bg-[#1a1a24] hover:bg-[#2a2a3a] text-gray-300'}`}
          >
            <Radio className="w-4 h-4 mr-2" />
            All Streams
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 mb-6">
        <div className="max-w-2xl mx-auto relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <Input
            placeholder={showAllStreams ? "Search all streamers..." : "Search followed streamers..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 py-6 bg-[#1a1a24]/50 backdrop-blur-sm border-[#2a2a3a] text-white rounded-2xl"
          />
        </div>
      </div>

      {/* Streams Grid */}
      <div className="px-6">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[16/10] w-full bg-[#1a1a24] rounded-2xl" />
                  <Skeleton className="h-4 w-3/4 bg-[#1a1a24]" />
                  <Skeleton className="h-4 w-1/2 bg-[#1a1a24]" />
                </div>
              ))}
            </div>
          ) : filteredStreams.length === 0 ? (
            <div className="bg-[#1a1a24]/50 backdrop-blur-sm border border-[#2a2a3a] rounded-3xl p-12 text-center">
              <Heart className="w-20 h-20 text-gray-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-300 mb-2">
                {!showAllStreams && following.length === 0 ? "Not following anyone yet" : "No streams found"}
              </h3>
              <p className="text-gray-500">
                {!showAllStreams && following.length === 0 
                  ? "Follow creators to see their streams here" 
                  : searchQuery
                    ? "Try a different search term or check for typos."
                    : "Check back later when streams go live."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredStreams.map((stream) => (
                <StreamCard 
                  key={stream.id} 
                  stream={stream}
                  onStreamClick={(streamId) => navigate(createPageUrl("StreamViewer") + `?streamId=${streamId}`)}
                  onUserClick={(userId) => navigate(createPageUrl("PublicProfile") + `?userId=${userId}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
