
import React from "react";
import { supabase } from "@/api/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Users, Radio, MessageCircle, UserPlus, UserMinus, Crown, Shield, Calendar, DollarSign } from "lucide-react"; // Added DollarSign
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom"; // Added Link
import { createPageUrl } from "@/utils";
import OGBadge from "../components/OGBadge";
import TrollFamilyBadge from "../components/TrollFamilyBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createStripeCheckout } from "@/api/stripe";
import { notifyUnlock } from "@/lib/notifications";

export default function PublicProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get("userId");
  const isValidUuid = typeof userId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  const [showSubscribeDialog, setShowSubscribeDialog] = React.useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => supabase.auth.me(),
  });

  // Get current user profile to check admin status
  const { data: currentUserProfile } = useQuery({
    queryKey: ['currentUserProfile', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, role, is_admin, is_troll_officer')
        .eq('id', currentUser.id)
        .limit(1);
      if (!error && data && data[0]) return data[0];
      return null;
    },
    enabled: !!currentUser?.id,
  });

  // Check if current user is admin
  const isCurrentUserAdmin = currentUserProfile && (currentUserProfile.role === 'admin' || currentUserProfile.is_admin === true);

  const { data: profileUser, isLoading } = useQuery({
    queryKey: ['publicProfile', userId],
    queryFn: async () => {
      if (!userId || !isValidUuid) return null;
      const users = await supabase.entities.User.filter({ id: userId });
      return users[0] || null;
    },
    enabled: !!userId && isValidUuid,
  });

  // Fetch recent streams for display
  const { data: recentStreams = [] } = useQuery({
    queryKey: ['recentStreams', userId],
    queryFn: async () => {
      if (!userId || !isValidUuid) return [];
      return await supabase.entities.Stream.filter({ 
        streamer_id: userId 
      }, "-created_date", 5);
    },
    enabled: !!userId && isValidUuid,
    initialData: [],
  });

  const { data: myRecentStreams = [] } = useQuery({
    queryKey: ['userRecentStreams', profileUser?.id],
    queryFn: async () => {
      if (!profileUser?.id || !isValidUuid) return [];
      return await supabase.entities.Stream.filter({ 
        streamer_id: profileUser.id 
      }, "-created_date", 5);
    },
    enabled: !!profileUser?.id && isValidUuid,
    initialData: [],
  });

  // Determine current live stream for avatar badge / direct link
  const currentLiveStream = React.useMemo(() => {
    const all = [...(recentStreams || []), ...(myRecentStreams || [])];
    return all.find(s => s?.is_live === true || s?.is_live === "true" || s?.status === "live") || null;
  }, [recentStreams, myRecentStreams]);

  // FIXED: Calculate total streaming hours
  const totalStreamingHours = React.useMemo(() => {
    if (!myRecentStreams.length) return 0;
    
    let totalMinutes = 0;
    myRecentStreams.forEach(stream => {
      if (stream.created_date) {
        const startTime = new Date(stream.created_date);
        const endTime = stream.updated_date ? new Date(stream.updated_date) : new Date();
        const durationMs = endTime - startTime;
        totalMinutes += Math.floor(durationMs / 1000 / 60);
      }
    });
    
    return (totalMinutes / 60).toFixed(1);
  }, [myRecentStreams]);


  const { data: isFollowing = false } = useQuery({
    queryKey: ['isFollowing', currentUser?.id, userId],
    queryFn: async () => {
      if (!currentUser || !userId || !isValidUuid) return false;
      const follows = await supabase.entities.Follow.filter({
        follower_id: currentUser.id,
        following_id: userId
      });
      return follows.length > 0;
    },
    enabled: !!currentUser && !!userId && isValidUuid,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser?.id) throw new Error('User not authenticated');
      if (!userId) throw new Error('Target user not found');
      
      if (isFollowing) {
        const follows = await supabase.entities.Follow.filter({
          follower_id: currentUser.id,
          following_id: userId
        });
        if (follows[0]) {
          await supabase.entities.Follow.delete(follows[0].id);
        }
        await supabase.entities.User.update(userId, {
          follower_count: (profileUser.follower_count || 0) - 1
        });
        
        // Get current user's profile to update their following count
        const { data: currentUserProfile } = await supabase
          .from('profiles')
          .select('following_count')
          .eq('id', currentUser.id)
          .single();
          
        const { error: unfollowErr } = await supabase
          .from('profiles')
          .update({ following_count: (currentUserProfile?.following_count || 0) - 1 })
          .eq('id', currentUser.id);
        if (unfollowErr) throw unfollowErr;
      } else {
        // Get current user's profile for notification details
        const { data: currentUserProfile } = await supabase
          .from('profiles')
          .select('full_name, username, avatar')
          .eq('id', currentUser.id)
          .single();
          
        await supabase.entities.Follow.create({
          follower_id: currentUser.id,
          follower_name: currentUserProfile?.full_name || 'Unknown',
          follower_username: currentUserProfile?.username || 'unknown',
          follower_avatar: currentUserProfile?.avatar,
          following_id: userId,
          following_name: profileUser.full_name,
          following_username: profileUser.username,
          following_avatar: profileUser.avatar
        });
        await supabase.entities.User.update(userId, {
          follower_count: (profileUser.follower_count || 0) + 1
        });
        
        const { data: currentUserProfileData } = await supabase
          .from('profiles')
          .select('following_count')
          .eq('id', currentUser.id)
          .single();
          
        const { error: followErr } = await supabase
          .from('profiles')
          .update({ following_count: (currentUserProfileData?.following_count || 0) + 1 })
          .eq('id', currentUser.id);
        if (followErr) throw followErr;

        // Send notification
        const followerName = currentUserProfile?.username || currentUserProfile?.full_name || 'Someone';
        await supabase.entities.Notification.create({
          user_id: userId,
          type: "new_follower",
          title: "New Follower",
          message: `${followerName} started following you!`,
          icon: "👥",
          related_user_id: currentUser.id,
          related_user_name: followerName,
          is_read: false
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['isFollowing']);
      queryClient.invalidateQueries(['publicProfile']);
      queryClient.invalidateQueries(['currentUser']);
      toast.success(isFollowing ? "Unfollowed" : "Subscribed!");
    },
  });

  // Stripe: subscribe checkout (single-charge, same pattern as coin packages)
  const subscribeWithStripe = async () => {
    try {
      if (!currentUser?.id) {
        toast.error('Please log in to subscribe');
        return;
      }
      const amount = '1.50';
      const returnUrl = window.location.href;
      const cancelUrl = window.location.href;
      const { url } = await createStripeCheckout({ amount, currency: 'USD', return_url: returnUrl, cancel_url: cancelUrl, user_id: currentUser.id });
      if (url) {
        window.location.href = url;
      } else {
        toast.error('Failed to initialize Stripe checkout');
      }
    } catch (e) {
      console.error('Stripe subscribe error', e);
      toast.error(e?.message || 'Stripe checkout error');
    }
  };

  const openSubscribeDialog = async () => {
    setShowSubscribeDialog(true);
  };

  // Handle Stripe return to mark subscription
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const stripeSessionId = params.get('session_id');
    if (paymentStatus === 'stripe_success' && stripeSessionId) {
      followMutation.mutate();
      toast.success('Subscription completed');
      
      // Send unlock notification for subscription
      if (currentUser && profileUser) {
        try {
          notifyUnlock(
            currentUser.id,
            'feature',
            `Subscription to ${profileUser.username}`,
            `You can now access premium content from ${profileUser.username}`
          );
        } catch (notificationError) {
          console.error('Failed to send unlock notification:', notificationError);
        }
      }
      
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }
  }, [followMutation, currentUser, profileUser]);

  const startConversation = async () => {
    // ADDED: Admin can message anyone regardless of privacy settings
    if (profileUser.messages_closed && !isCurrentUserAdmin) {
      toast.error("This user has closed their messages");
      return;
    }

    if (profileUser.messages_closed && isCurrentUserAdmin) {
      toast.info("🛡️ Admin access: Messaging user with closed messages");
    }

    // Check if conversation already exists
    const existingConv = await supabase.entities.Conversation.filter({
      participant1_id: currentUser.id,
      participant2_id: userId
    });
    
    const existingConv2 = await supabase.entities.Conversation.filter({
      participant1_id: userId,
      participant2_id: currentUser.id
    });

    if (existingConv[0] || existingConv2[0]) {
      navigate(createPageUrl("Messages"));
      return;
    }

    // Create new conversation
    await supabase.entities.Conversation.create({
      participant1_id: currentUser.id,
      participant1_name: currentUser.full_name,
      participant1_username: currentUser.username,
      participant1_avatar: currentUser.avatar,
      participant1_created_date: currentUser.created_date,
      participant1_troll_family_id: currentUser.troll_family_id,
      participant1_troll_family_name: currentUser.troll_family_name,
      participant2_id: userId,
      participant2_name: profileUser.full_name,
      participant2_username: profileUser.username,
      participant2_avatar: profileUser.avatar,
      participant2_created_date: profileUser.created_date,
      participant2_troll_family_id: profileUser.troll_family_id,
      participant2_troll_family_name: profileUser.troll_family_name,
      last_message: "",
      last_message_time: new Date().toISOString(),
      unread_count_p1: 0,
      unread_count_p2: 0
    });

    navigate(createPageUrl("Messages"));
  };

  if (!userId || !isValidUuid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] flex items-center justify-center p-6">
        <Card className="bg-[#1a1a24] border-[#2a2a3a] p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Invalid Profile Link</h2>
          <p className="text-gray-400">This link is missing or malformed. Open profiles via the app UI.</p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] flex items-center justify-center p-6">
        <Card className="bg-[#1a1a24] border-[#2a2a3a] p-8 text-center">
          <p className="text-white">User not found</p>
        </Card>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === userId;

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <Card className="bg-[#1a1a24] border-[#2a2a3a] p-8 mb-6">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Avatar with live badge and optional direct link to live stream */}
            <div className="relative">
              <div className={currentLiveStream ? "cursor-pointer" : ""}
                   onClick={() => {
                     if (currentLiveStream) {
                       navigate(createPageUrl("StreamViewer") + `?id=${currentLiveStream.id}`);
                     }
                   }}
              >
                {profileUser.avatar ? (
                  <img
                    src={profileUser.avatar}
                    alt="Avatar"
                    className="w-32 h-32 rounded-full object-cover ring-4 ring-purple-500"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center ring-4 ring-purple-500">
                    <span className="text-5xl font-bold text-white">
                      {profileUser.username?.[0]?.toUpperCase() || profileUser.full_name?.[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              {currentLiveStream && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                  <Radio className="w-3 h-3 animate-pulse" />
                  Live Now — tap avatar to watch
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-3xl font-bold text-white">
                  @{profileUser.username || "NoUsername"}
                </h1>
                <Badge className="bg-purple-500 text-white">
                  Level {profileUser.level || 1}
                </Badge>
                <OGBadge user={profileUser} />
                {profileUser.is_troll_officer && (
                  <Badge className="bg-orange-500 text-white">
                    <Shield className="w-3 h-3 mr-1" />
                    Officer
                  </Badge>
                )}
                {profileUser.troll_family_name && (
                  <TrollFamilyBadge familyName={profileUser.troll_family_name} />
                )}
              </div>
              
              <p className="text-gray-400 mb-4">{profileUser.bio || "No bio yet"}</p>
              
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-[#0a0a0f] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Coins className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-gray-400">Level</span>
                  </div>
                  <p className="text-lg font-bold text-purple-400">
                    {profileUser.level || 1}
                  </p>
                </div>
                <Link 
                  to={createPageUrl("Followers") + `?userId=${profileUser.id}`}
                  className="bg-[#0a0a0f] rounded-lg p-3 hover:bg-[#1a1a24] transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span className="text-xs text-gray-400">Followers</span>
                  </div>
                  <p className="text-lg font-bold text-purple-400">
                    {profileUser.follower_count || 0}
                  </p>
                </Link>
                <div className="bg-[#0a0a0f] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Radio className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-gray-400">Streams</span>
                  </div>
                  <p className="text-lg font-bold text-red-400">
                    {profileUser.total_streams || 0}
                  </p>
                </div>
                <div className="bg-[#0a0a0f] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-gray-400">Earned</span>
                  </div>
                  <p className="text-lg font-bold text-green-400">
                    ${((profileUser.earned_coins || 0) * 0.00625).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              {!isOwnProfile && currentUser && (
                <div className="flex gap-3">
                  {isFollowing ? (
                    <Button
                      type="button"
                      onClick={() => followMutation.mutate()}
                      disabled={followMutation.isPending}
                      className="bg-gray-600 hover:bg-gray-700"
                    >
                      <UserMinus className="w-4 h-4 mr-2" />
                      Unfollow
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={openSubscribeDialog}
                      disabled={isInitializingPayPal}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Crown className="w-4 h-4 mr-2" />
                      Subscribe $1.50
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={startConversation}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                </div>
              )}

              {isOwnProfile && (
                <Button
                  type="button"
                  onClick={() => navigate(createPageUrl("Profile"))}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Streaming Stats */}
          <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Radio className="w-5 h-5 text-red-400" />
              Streaming Stats
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0a0a0f] rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm mb-1">Total Streams</p>
                <p className="text-2xl font-bold text-white">{myRecentStreams.length}</p>
              </div>
              <div className="bg-[#0a0a0f] rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm mb-1">Hours Streamed</p>
                <p className="text-2xl font-bold text-white">{totalStreamingHours}h</p>
              </div>
              <div className="bg-[#0a0a0f] rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm mb-1">Experience</p>
                <p className="text-2xl font-bold text-purple-400">{profileUser.streaming_hours || 0}h</p>
              </div>
            </div>
          </Card>

          {profileUser.troll_family_name && (
            <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                Troll Family
              </h3>
              <div className="space-y-3">
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                  <p className="text-purple-300 font-semibold text-lg">{profileUser.troll_family_name}</p>
                  {profileUser.owns_troll_family && (
                    <Badge className="mt-2 bg-yellow-500">
                      <Crown className="w-3 h-3 mr-1" />
                      Owner
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={() => navigate(createPageUrl("TrollFamily"))}
                  variant="outline"
                  className="w-full border-purple-500 text-purple-400"
                >
                  View Family
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Recent Streams Section */}
        {recentStreams.length > 0 && (
          <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6 mt-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Radio className="w-5 h-5 text-red-400" />
              Recent Streams
            </h3>
            <div className="space-y-3">
              {recentStreams.map((stream) => (
                <div 
                  key={stream.id}
                  onClick={() => {
                    if (stream.is_live) {
                      navigate(createPageUrl("StreamViewer") + `?id=${stream.id}`);
                    }
                  }}
                  className={`bg-[#0a0a0f] rounded-lg p-4 border border-[#2a2a3a] ${
                    stream.is_live ? 'cursor-pointer hover:border-purple-500 transition-all' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {stream.thumbnail ? (
                      <img 
                        src={stream.thumbnail} 
                        alt={stream.title}
                        className="w-24 h-16 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-24 h-16 rounded bg-gradient-to-br from-purple-900/50 to-pink-900/50 flex items-center justify-center flex-shrink-0">
                        <Radio className="w-6 h-6 text-white/50" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-white font-semibold truncate">{stream.title}</h4>
                        {stream.is_live ? (
                          <Badge className="bg-red-500 text-white text-xs flex-shrink-0">
                            <Radio className="w-3 h-3 mr-1 animate-pulse" />
                            LIVE
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-600 text-white text-xs flex-shrink-0">
                            Ended
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(stream.created_date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                        <span>
                          {new Date(stream.created_date).toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                        <Badge className="bg-purple-500/20 text-purple-300 text-xs">
                          {stream.category}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <span className="text-gray-500 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {stream.viewer_count || 0} viewers
                        </span>
                        {stream.total_gifts > 0 && (
                          <span className="text-yellow-400 flex items-center gap-1">
                            🎁 {stream.total_gifts} gifts
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>

    {/* Subscribe Dialog */}
    <Dialog open={showSubscribeDialog} onOpenChange={setShowSubscribeDialog}>
      <DialogContent className="bg-[#1a1a24] border-[#2a2a3a]">
        <DialogHeader>
          <DialogTitle className="text-white">Subscribe to @{profileUser?.username}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">Pay securely via Stripe. Current demo amount: $1.50.</p>
            <div className="flex justify-center">
            <Button type="button" onClick={subscribeWithStripe} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
              Pay with Stripe
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
