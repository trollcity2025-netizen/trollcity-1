import React, { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, User, Calendar, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function FollowersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("userId");
  const username = searchParams.get("username");

  // Get target user's profile
  const { data: targetUser } = useQuery({
    queryKey: ['targetUser', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar, bio, level, is_verified')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching target user:', error);
        return null;
      }
      return data;
    },
    enabled: !!userId,
  });

  // Get followers list
  const { data: followers = [], isLoading } = useQuery({
    queryKey: ['followers', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      try {
        // Get followers from follows table
        const { data: followsData, error: followsError } = await supabase
          .from('follows')
          .select('follower_id, created_at')
          .eq('following_id', userId)
          .order('created_at', { ascending: false });

        if (followsError) {
          console.error('Error fetching follows:', followsError);
          return [];
        }

        if (!followsData || followsData.length === 0) {
          return [];
        }

        // Get follower profiles
        const followerIds = followsData.map(f => f.follower_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar, bio, level, is_verified, created_date')
          .in('id', followerIds);

        if (profilesError) {
          console.error('Error fetching follower profiles:', profilesError);
          return [];
        }

        // Combine follows data with profiles
        const followersWithDates = profilesData?.map(profile => {
          const follow = followsData.find(f => f.follower_id === profile.id);
          return {
            ...profile,
            followed_at: follow?.created_at
          };
        }) || [];

        return followersWithDates;
      } catch (error) {
        console.error('Error in followers query:', error);
        return [];
      }
    },
    enabled: !!userId,
  });

  // Get current user for follow status
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data?.user || null;
    },
  });

  const handleUserClick = (followerId) => {
    navigate(`${createPageUrl("PublicProfile")}?userId=${followerId}`);
  };

  const handleBackClick = () => {
    if (targetUser) {
      navigate(`${createPageUrl("PublicProfile")}?userId=${targetUser.id}`);
    } else {
      navigate(-1);
    }
  };

  if (!userId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] flex items-center justify-center p-6">
        <Card className="bg-[#1a1a24] border-[#2a2a3a] p-8 text-center">
          <p className="text-white">No user specified</p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Skeleton className="h-8 w-32 bg-[#1a1a24] mb-4" />
            <Skeleton className="h-12 w-64 bg-[#1a1a24] mb-2" />
            <Skeleton className="h-6 w-48 bg-[#1a1a24]" />
          </div>
          <div className="space-y-4">
            {Array(6).fill(0).map((_, i) => (
              <Card key={i} className="bg-[#1a1a24] border-[#2a2a3a] p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded-full bg-[#0a0a0f]" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 bg-[#0a0a0f] mb-2" />
                    <Skeleton className="h-3 w-48 bg-[#0a0a0f]" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={handleBackClick}
            variant="outline"
            className="mb-6 border-[#2a2a3a] text-gray-300 hover:bg-[#1a1a24]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Profile
          </Button>

          <div className="flex items-center gap-4 mb-4">
            <Users className="w-8 h-8 text-purple-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">
                {targetUser ? `@${targetUser.username}'s` : "User's"} Followers
              </h1>
              <p className="text-gray-400">
                {followers.length} {followers.length === 1 ? 'person follows' : 'people follow'} {targetUser ? targetUser.username : 'this user'}
              </p>
            </div>
          </div>
        </div>

        {/* Followers List */}
        {followers.length === 0 ? (
          <Card className="bg-[#1a1a24] border-[#2a2a3a] p-12 text-center">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-300 mb-2">No followers yet</h3>
            <p className="text-gray-500">
              {targetUser ? `@${targetUser.username}` : 'This user'} doesn't have any followers yet.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {followers.map((follower) => (
              <Card
                key={follower.id}
                className="bg-[#1a1a24] border-[#2a2a3a] p-4 hover:bg-[#1a1a24]/80 transition-all cursor-pointer"
                onClick={() => handleUserClick(follower.id)}
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="relative">
                    {follower.avatar ? (
                      <img
                        src={follower.avatar}
                        alt={follower.username}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <User className="w-6 h-6 text-white" />
                      </div>
                    )}
                    {follower.is_verified && (
                      <Badge className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs p-0 w-5 h-5 flex items-center justify-center">
                        ✓
                      </Badge>
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white">
                        @{follower.username}
                      </h3>
                      <Badge className="bg-purple-500 text-white text-xs">
                        Lvl {follower.level || 1}
                      </Badge>
                    </div>
                    {follower.bio && (
                      <p className="text-gray-400 text-sm line-clamp-2">
                        {follower.bio}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Followed {new Date(follower.followed_at).toLocaleDateString()}
                      </span>
                      {follower.created_date && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          Joined {new Date(follower.created_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* View Profile Button */}
                  <Button
                    variant="outline"
                    className="border-purple-500 text-purple-400 hover:bg-purple-500/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUserClick(follower.id);
                    }}
                  >
                    View Profile
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}