import React, { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Radio, Users, Gamepad2, Music, MessageCircle, Palette, User, Crown, Diamond } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import TrollCityShower from "@/components/TrollCityShower";
import TopTrollersCard from "@/components/TopTrollersCard";
import { getHighPayingBroadcasters } from "@/api/broadcasterMonetization";

export default function HomePage() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("all");

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => supabase.auth.me(),
    retry: false,
    staleTime: 5000,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  // FIXED: Fetch ONLY truly live streams with strict filtering
  const { data: streams = [], isLoading: streamsLoading } = useQuery({
    queryKey: ["liveStreams"],
    queryFn: async () => {
      try {
        // Step 1: Get streams marked as live
        const { data: allLiveStreams = [], error } = await supabase
          .from('streams')
          .select('*')
          .eq('is_live', true)
          // Order by created_at to avoid schema mismatches on last_heartbeat
          .order('created_at', { ascending: false })
          .limit(1000);
        if (error) throw error;
        
        // Step 2: Filter out stale streams (no heartbeat in last 60 seconds)
        const now = Date.now();
        const staleThreshold = 60 * 1000; // 60 seconds
        
        const trulyLiveStreams = allLiveStreams.filter(stream => {
          // Must have recent heartbeat
          if (!stream.last_heartbeat) return false;
          
          const lastHeartbeat = new Date(stream.last_heartbeat).getTime();
          const timeSinceHeartbeat = now - lastHeartbeat;
          
          // Stream is stale if no heartbeat in last 60 seconds
          if (timeSinceHeartbeat > staleThreshold) {
            console.log(`⏰ Filtering out stale stream: ${stream.title} (${Math.floor(timeSinceHeartbeat / 1000)}s ago)`);
            return false;
          }
          
          return true;
        });
        
        // Step 3: Filter out user's own stream and any streams where the current user is banned
        let visibleStreams = trulyLiveStreams;
        if (user) {
          visibleStreams = trulyLiveStreams.filter(s => s.streamer_id !== user.id);

          try {
            const streamerIds = Array.from(new Set(visibleStreams.map(s => s.streamer_id).filter(Boolean)));
            if (streamerIds.length > 0) {
              const { data: bans = [] } = await supabase
                .from('user_stream_bans')
                .select('streamer_id')
                .in('streamer_id', streamerIds)
                .eq('user_id', user.id)
                .eq('is_active', true);

              const bannedStreamerIds = new Set((bans || []).map(b => String(b.streamer_id)));
              visibleStreams = visibleStreams.filter(s => !bannedStreamerIds.has(String(s.streamer_id)));
            }
          } catch (e) {
            console.warn('Failed to fetch user stream bans', e?.message || e);
          }
        } else {
          visibleStreams = trulyLiveStreams;
        }

        console.log(`✅ Live streams: ${allLiveStreams.length} found, ${trulyLiveStreams.length} active, ${visibleStreams.length} visible`);
        return visibleStreams;
      } catch (err) {
        console.error("Failed to load streams:", err);
        return [];
      }
    },
    refetchInterval: 5000, // Refresh every 5 seconds
    retry: 1,
    initialData: [],
    staleTime: 3000,
  });

  const { data: newUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['newUsers'],
    queryFn: async () => {
      try {
        const { data = [], error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(12);
        if (error) throw error;
        return data;
      } catch (err) {
        console.error("Failed to load new users:", err);
        return [];
      }
    },
    initialData: [],
    staleTime: 5000,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  // Temporarily disabled: cleanupStreams call caused network errors when functions are unavailable.
  // If needed later, reintroduce behind a feature flag or admin-only toggle.

  const categories = [
    { id: "all", label: "All", icon: Radio },
    { id: "gaming", label: "Gaming", icon: Gamepad2 },
    { id: "music", label: "Music", icon: Music },
    { id: "talk", label: "Just Chatting", icon: MessageCircle },
    { id: "creative", label: "Creative", icon: Palette },
  ];

  const filteredStreams = selectedCategory === "all" 
    ? streams 
    : streams.filter(s => s.category === selectedCategory);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] py-10 px-4 relative">
      {/* Green Troll City shower overlay */}
      <TrollCityShower count={80} />
      <header className="w-full max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight mb-4 sm:mb-0">
          <span className="text-[#00ff88]">Troll</span>
          <span className="text-[#ff0844]">City</span>
        </h1>
        <p className="text-gray-400 text-center sm:text-right max-w-md">
          Dive into the live chaos — streams, games, and moments that only Troll City can bring.
        </p>
      </header>

      {/* Hero / Landing with Login CTA (MAI Introduces Troll City) */}
      <section className="w-full max-w-6xl mx-auto mb-10">
        <div className="relative rounded-xl overflow-hidden bg-black/50">
          <img
            src="/mai_trollcity.jpeg"
            alt="MAI Introduces Troll City"
            className="w-full h-72 object-cover opacity-95"
            onError={(e) => { e.target.style.opacity = 0.6 }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60 flex items-center">
            <div className="max-w-3xl mx-auto px-6 py-8 text-center text-white">
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-2">MAI Introduces Troll City</h2>
              <p className="text-gray-300 mb-4">A new line of reinventions. Join the live experience, send gifts, and be a part of the chaos.</p>
              {/* Removed Log In / Create Account CTAs from home hero per request */}
            </div>
          </div>
        </div>
      </section>

      <div className="w-full max-w-6xl mx-auto space-y-10">

        {/* Live Streams */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <h2 className="text-2xl font-semibold text-white">
              🔥 Live Now
            </h2>
            <Badge className="bg-red-500 text-white">
              {filteredStreams.length} Live
            </Badge>
            <Badge className="bg-green-500 text-white text-xs">
              Auto-updating
            </Badge>
          </div>

          {streamsLoading ? (
            <p className="text-gray-400 animate-pulse">Loading streams...</p>
          ) : filteredStreams.length === 0 ? (
            <Card className="bg-[#1a1a24] border-[#2a2a3a] p-12 text-center">
              <Radio className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {selectedCategory === "all" 
                  ? "No one's live right now. Be the first to go live!" 
                  : `No ${selectedCategory} streams live right now.`}
              </p>
              <Button
                onClick={() => navigate(createPageUrl("GoLive"))}
                className="mt-4 bg-gradient-to-r from-red-500 to-pink-500"
              >
                <Radio className="w-4 h-4 mr-2" />
                Go Live Now
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredStreams.map((stream) => {
                // Calculate time since last heartbeat
                const timeSinceHeartbeat = stream.last_heartbeat 
                  ? Math.floor((Date.now() - new Date(stream.last_heartbeat).getTime()) / 1000)
                  : null;
                
                return (
                  <div
                    key={stream.id}
                    onClick={() => navigate(createPageUrl("StreamViewer") + `?id=${stream.id}`)}
                    className="cursor-pointer group"
                  >
                    <Card className="bg-[#1a1a24] border-[#2a2a3a] overflow-hidden hover:border-red-500 transition-all group-hover:scale-105">
                      <div className="relative aspect-video">
                        {stream.thumbnail ? (
                          <img
                            src={stream.thumbnail}
                            alt={stream.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-purple-900/50 to-pink-900/50 flex items-center justify-center">
                            <Radio className="w-12 h-12 text-white/50" />
                          </div>
                        )}

                        <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded flex items-center gap-1 text-xs font-bold">
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                          LIVE
                        </div>

                        <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded flex items-center gap-1 text-xs">
                          <Eye className="w-3 h-3" />
                          {stream.viewer_count || 0}
                        </div>

                        {timeSinceHeartbeat !== null && timeSinceHeartbeat < 60 && (
                          <div className="absolute bottom-2 right-2 bg-green-500/80 text-white px-2 py-0.5 rounded text-xs">
                            Active {timeSinceHeartbeat}s ago
                          </div>
                        )}

                        <div className="absolute bottom-2 left-2">
                          <Badge className="bg-purple-500/90 text-white text-xs">
                            {stream.category}
                          </Badge>
                        </div>
                      </div>

                      <div className="p-3">
                        <h3 className="text-white font-semibold truncate mb-1">
                          {stream.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          {stream.streamer_avatar ? (
                            <img
                              src={stream.streamer_avatar}
                              alt={stream.streamer_name}
                              className="w-6 h-6 rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                              <span className="text-white text-xs font-bold">
                                {stream.streamer_name?.[0]?.toUpperCase()}
                              </span>
                            </div>
                          )}
                          <p className="text-gray-400 text-sm truncate">
                            @{stream.streamer_name}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Top Trollers Leaderboard */}
        <section>
          <TopTrollersCard />
        </section>

        {/* New Trollerz */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-6 h-6 text-cyan-400" />
            <h2 className="text-2xl font-semibold text-white">
              🆕 New Trollerz
            </h2>
            <Badge className="bg-cyan-500 text-white">
              {newUsers.length} Members
            </Badge>
          </div>

          {usersLoading ? (
            <p className="text-gray-400 animate-pulse">Loading new trollerz...</p>
          ) : newUsers.length === 0 ? (
            <Card className="bg-[#1a1a24] border-[#2a2a3a] p-12 text-center">
              <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No new members yet.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {newUsers.map((member) => (
                <div
                  key={member.id}
                  onClick={() => navigate(createPageUrl("PublicProfile") + `?userId=${member.id}`)}
                  className="cursor-pointer group"
                >
                  <Card className="bg-[#1a1a24] border-[#2a2a3a] p-4 hover:border-cyan-500 transition-all group-hover:scale-105">
                    <div className="flex flex-col items-center gap-2">
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.username || member.full_name}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <span className="text-white text-xl font-bold">
                            {(member.username || member.full_name)?.[0]?.toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="text-center w-full">
                        <p className="text-white text-sm font-semibold truncate">
                          @{member.username || member.full_name}
                        </p>
                        <Badge className="bg-purple-500 text-white text-xs mt-1">
                          Lv {member.level || 1}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer className="w-full mt-16 py-6 bg-transparent">
        <div className="w-full max-w-6xl mx-auto text-center text-gray-400 text-sm">
          <p>© {new Date().getFullYear()} MAI Corporation. All rights reserved.</p>
          <p className="mt-1">
            <a href="/Employment" className="underline mr-4">Employment</a>
            <a href="/ContactUs" className="underline">Contact Us</a>
          </p>
          <p className="mt-2">Contact: <a className="underline" href="mailto:trollcity2025@gmail.com">trollcity2025@gmail.com</a></p>
        </div>
      </footer>

    </main>
  );
}
