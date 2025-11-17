
import React, { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, Flame, Eye } from "lucide-react";
import StreamCard from "../components/stream/StreamCard";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils"; // Updated import path

export default function TrendingPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const { data: streams = [], isLoading } = useQuery({
    queryKey: ['trendingStreams'],
    queryFn: async () => {
      const liveStreams = await supabase.entities.Stream.filter({ 
        status: "live",
        is_live: true 
      }, "-viewer_count");
      return liveStreams;
    },
    initialData: [],
    refetchInterval: 3000,
  });

  const filteredStreams = streams.filter(stream => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return stream.title?.toLowerCase().includes(query) ||
           stream.streamer_name?.toLowerCase().includes(query);
  });

  const totalViewers = streams.reduce((sum, s) => sum + (s.viewer_count || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] pb-20">
      {/* Header */}
      <div className="text-center pt-12 pb-8 px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <TrendingUp className="w-10 h-10 text-red-400" />
            <h1 className="text-5xl font-black text-white">Trending</h1>
          </div>
          <p className="text-gray-400 text-lg mb-6">
            🔥 Hottest streams right now
          </p>

          {/* Stats */}
          <div className="flex items-center justify-center gap-3">
            <Badge className="bg-red-600/20 border border-red-500/50 text-red-400 px-5 py-2.5">
              <Flame className="w-4 h-4 mr-2" />
              {streams.length} Live
            </Badge>
            <Badge className="bg-purple-600/20 border border-purple-500/50 text-purple-400 px-5 py-2.5">
              <Eye className="w-4 h-4 mr-2" />
              {totalViewers} Watching
            </Badge>
          </div>
        </motion.div>
      </div>

      {/* Search */}
      <div className="px-6 mb-6">
        <div className="max-w-2xl mx-auto relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <Input
            placeholder="Search trending streams..."
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
              {Array(8).fill(0).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[16/10] w-full bg-[#1a1a24] rounded-2xl" />
                  <Skeleton className="h-4 w-3/4 bg-[#1a1a24]" />
                  <Skeleton className="h-4 w-1/2 bg-[#1a1a24]" />
                </div>
              ))}
            </div>
          ) : filteredStreams.length === 0 ? (
            <div className="bg-[#1a1a24]/50 backdrop-blur-sm border border-[#2a2a3a] rounded-3xl p-12 text-center">
              <TrendingUp className="w-20 h-20 text-gray-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-300 mb-2">No trending streams</h3>
              <p className="text-gray-500">Check back later for hot content!</p>
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
