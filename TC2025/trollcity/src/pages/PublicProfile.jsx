
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import OGBadge from "../components/OGBadge";
import UserBadges from "@/components/UserBadges";
import TrollFamilyBadge from "../components/TrollFamilyBadge";

export default function PublicProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  let userId = urlParams.get("userId");
  const username = urlParams.get("username");
  const isValidUuid = typeof userId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

  // If username provided but no userId, look up the user ID
  const { data: userIdFromUsername } = useQuery({
    queryKey: ['userIdFromUsername', username],
    queryFn: async () => {
      if (!username) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .limit(1);
      if (!error && data && data[0]) {
        return data[0].id;
      }
      return null;
    },
    enabled: !!username && !userId,
  });

  // Update userId if we found it from username
  if (userIdFromUsername && !userId) {
    userId = userIdFromUsername;
  }

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

  // Admin action mutations
  const kickUserMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser?.id || !userId) throw new Error('Missing user information');
      
      // Create kick record in kicked_users table
      const { error: kickError } = await supabase.from('kicked_users').insert({
        user_id: userId,
        kicked_by: currentUser.id,
        reason: `Kicked by admin @${currentUserProfile?.username || 'Admin'}`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      });
      
      if (kickError) throw kickError;
      
      // Create kick notification
      const { error: notifyError } = await supabase.from('notifications').insert({
        user_id: userId,
        type: 'admin_action',
        title: 'Kicked by Admin',
        message: `You have been kicked by admin @${currentUserProfile?.username || 'Admin'}`,
        icon: '⚠️',
        is_read: false,
        created_date: new Date().toISOString(),
      });
      
      if (notifyError) throw notifyError;
      return true;
    },
    onSuccess: () => {
      toast.success('User kicked successfully');
      // Redirect user to payment page
      navigate('/paymentrequired?reason=kicked');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to kick user');
    }
  });

  const banUserMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser?.id || !userId) throw new Error('Missing user information');
      
      // Ban the user by setting is_banned to true
      const { error: banError } = await supabase
        .from('profiles')
        .update({ is_banned: true })
        .eq('id', userId);
      
      if (banError) throw banError;
      
      // Create ban notification
      const { error: notifyError } = await supabase.from('notifications').insert({
        user_id: userId,
        type: 'admin_action',
        title: 'Banned by Admin',
        message: `You have been banned by admin @${currentUserProfile?.username || 'Admin'}`,
        icon: '🚫',
        is_read: false,
        created_date: new Date().toISOString(),
      });
      
      if (notifyError) throw notifyError;
      return true;
    },
    onSuccess: () => {
      toast.success('User banned successfully');
      // Redirect to payment page
      navigate('/paymentrequired?reason=banned');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to ban user');
    }
  });

  // Handle admin profile click
  const handleProfileClick = () => {
    if (!isCurrentUserAdmin || isOwnProfile) return;
    
    // Show admin actions dialog/confirmation
    if (window.confirm(`Admin Actions for @${profileUser?.username || 'User'}:\n\nKick - Remove from current session\nBan - Permanently ban user\n\nClick OK to Kick, Cancel to Ban`)) {
      kickUserMutation.mutate();
    } else {
      if (window.confirm('Are you sure you want to BAN this user?')) {
        banUserMutation.mutate();
      }
    }
  };

  const { data: profileUser, isLoading } = useQuery({
    queryKey: ['publicProfile', userId],
    queryFn: async () => {
      if (!userId || !isValidUuid) return null;
      // Primary: fetch from profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .limit(1);
      if (!error && data && data[0]) return data[0];
      // Fallback: legacy entity
      try {
        const users = await supabase.entities?.User?.filter ? await supabase.entities.User.filter({ id: userId }) : [];
        return users[0] || null;
      } catch (_) {
        return null;
      }
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
      console.log('Checking isFollowing status:', { currentUser, userId, isValidUuid });
      if (!currentUser || !userId || !isValidUuid) return false;
      
      try {
        // Try using direct Supabase query first
        const { data, error } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', currentUser.id)
          .eq('following_id', userId)
          .limit(1);
        
        console.log('Direct follows query result:', { data, error });
        if (data && data.length > 0) return true;
        
        // Fallback to entities if direct query fails
        const follows = await supabase.entities.Follow.filter({
          follower_id: currentUser.id,
          following_id: userId
        });
        console.log('Entities Follow.filter result:', follows);
        return follows.length > 0;
      } catch (error) {
        console.error('Error checking follow status:', error);
        return false;
      }
    },
    enabled: !!currentUser && !!userId && isValidUuid,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      console.log('Follow mutation started:', { currentUser, userId, isFollowing });
      if (!currentUser?.id) throw new Error('User not authenticated');
      if (!userId) throw new Error('Target user not found');
      
      if (isFollowing) {
        // Unfollow logic - use direct Supabase queries
        console.log('Unfollowing user...');
        
        // First, find the follow record
        const { data: followRecords, error: findError } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', currentUser.id)
          .eq('following_id', userId)
          .limit(1);
        
        if (findError) {
          console.error('Error finding follow record:', findError);
          throw new Error('Failed to find follow record');
        }
        
        if (followRecords && followRecords.length > 0) {
          // Delete the follow record
          const { error: deleteError } = await supabase
            .from('follows')
            .delete()
            .eq('id', followRecords[0].id);
          
          if (deleteError) {
            console.error('Error deleting follow record:', deleteError);
            throw new Error('Failed to delete follow record');
          }
          console.log('Follow record deleted successfully');
        }
        
        // Update follower/following counts in profiles table
        const { error: unfollowTargetErr } = await supabase
          .from('profiles')
          .update({ follower_count: (profileUser.follower_count || 0) - 1 })
          .eq('id', userId);
        if (unfollowTargetErr) throw unfollowTargetErr;
        
        // Get current user's profile to update their following count
        const { data: currentUserProfile } = await supabase
          .from('profiles')
          .select('following_count')
          .eq('id', currentUser.id)
          .single();
          
        const { error: unfollowSelfErr } = await supabase
          .from('profiles')
          .update({ following_count: (currentUserProfile?.following_count || 0) - 1 })
          .eq('id', currentUser.id);
        if (unfollowSelfErr) throw unfollowSelfErr;
        
        console.log('Unfollow completed successfully');
      } else {
        // Follow logic - use direct Supabase queries
        console.log('Following user...');
        
        const { error: insertError } = await supabase.from('follows').insert({
          follower_id: currentUser.id,
          following_id: userId,
          created_at: new Date().toISOString()
        });
        
        if (insertError) {
          console.error('Error inserting follow record:', insertError);
          throw new Error('Failed to create follow relationship');
        }
        
        console.log('Follow record inserted successfully');
        
        const { error: followTargetErr } = await supabase
          .from('profiles')
          .update({ follower_count: (profileUser.follower_count || 0) + 1 })
          .eq('id', userId);
        if (followTargetErr) throw followTargetErr;
        
        // Get current user's profile to update their following count
        const { data: currentUserProfileData } = await supabase
          .from('profiles')
          .select('following_count')
          .eq('id', currentUser.id)
          .single();
          
        const { error: followSelfErr } = await supabase
          .from('profiles')
          .update({ following_count: (currentUserProfileData?.following_count || 0) + 1 })
          .eq('id', currentUser.id);
        if (followSelfErr) throw followSelfErr;
        
        // Send notification - use currentUserProfile for notification details
        const followerName = currentUserProfile?.username || currentUserProfile?.full_name || 'Someone';
        try {
          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'new_follower',
            title: 'New Follower',
            message: `${followerName} started following you!`,
            icon: '👥',
            related_user_id: currentUser.id,
            related_user_name: followerName,
            is_read: false,
            created_date: new Date().toISOString(),
          });
        } catch (err) {
          console.log("Notification creation failed, but follow was successful");
        }
        
        console.log('Follow completed successfully');
      }
    },
    onSuccess: () => {
      console.log('Follow mutation success, invalidating queries');
      queryClient.invalidateQueries(['isFollowing']);
      queryClient.invalidateQueries(['publicProfile']);
      queryClient.invalidateQueries(['currentUserProfile']);
      toast.success(isFollowing ? "Unfollowed" : "Following!");
    },
    onError: (error) => {
      console.error('Follow mutation error:', error);
      toast.error(error.message || 'Failed to follow user');
    },
  });

  const [openMessage, setOpenMessage] = React.useState(false);
  const [messageText, setMessageText] = React.useState("");

  const startConversation = async () => {
    // ADDED: Admin can message anyone regardless of privacy settings
    if (profileUser.messages_closed && !isCurrentUserAdmin) {
      toast.error("This user has closed their messages");
      return;
    }

    if (profileUser.messages_closed && isCurrentUserAdmin) {
      toast.info("🛡️ Admin access: Messaging user with closed messages");
    }

    try {
      // Check if conversation already exists
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('*')
        .eq('participant1_id', currentUser.id)
        .eq('participant2_id', userId)
        .limit(1);
      
      const { data: existingConv2 } = await supabase
        .from('conversations')
        .select('*')
        .eq('participant1_id', userId)
        .eq('participant2_id', currentUser.id)
        .limit(1);

      let convId = existingConv?.[0]?.id || existingConv2?.[0]?.id || null;

      if (!convId) {
        const { data: newConv, error } = await supabase
          .from('conversations')
          .insert({ participant1_id: currentUser.id, participant2_id: userId })
          .select('*')
          .single();
        if (!error && newConv) {
          convId = newConv.id;
        }
      }
      
      if (convId) {
        toast.success("Opening conversation...");
        navigate(`${createPageUrl("Messages")}?conversation=${convId}`);
      } else {
        toast.error("Failed to create conversation");
      }
    } catch (err) {
      console.error("Error starting conversation:", err);
      toast.error("Failed to start conversation");
    }
  };

  const sendProfileMessage = async () => {
    const text = messageText.trim();
    if (!text) return;
    try {
      // Find or create conversation minimal
      const { data: convsA } = await supabase.from('conversations').select('*').eq('participant1_id', currentUser.id).eq('participant2_id', userId).limit(1);
      const { data: convsB } = await supabase.from('conversations').select('*').eq('participant1_id', userId).eq('participant2_id', currentUser.id).limit(1);
      let convId = (convsA?.[0]?.id) || (convsB?.[0]?.id) || null;
      if (!convId) {
        const { data } = await supabase.from('conversations').insert({ participant1_id: currentUser.id, participant2_id: userId }).select('*').single();
        convId = data?.id || convId;
      }
      if (!convId) {
        const created = await supabase.entities.Conversation.create({ participant1_id: currentUser.id, participant2_id: userId });
        convId = created?.id || convId;
      }
      // Prefer direct_messages table
      let payload = { conversation_id: convId, sender_id: currentUser.id, message: text, created_date: new Date().toISOString() };
      let sent = false;
      for (let attempt = 0; attempt < 3 && !sent; attempt++) {
        const { error } = await supabase.from('direct_messages').insert(payload);
        if (!error) { sent = true; break; }
        const m = String(error?.message || error);
        const colMatch = m.match(/column\s+"?(\w+)"?\s+does not exist/i);
        const col = colMatch?.[1];
        if (col && payload.hasOwnProperty(col)) { delete payload[col]; continue; }
        break;
      }
      if (!sent) {
        await supabase.from('messages').insert({ conversation_id: convId, sender_id: currentUser.id, content: text });
      }
      // Update unread counter for the recipient if columns exist
      try {
        const { data: conv } = await supabase.from('conversations').select('*').eq('id', convId).limit(1);
        const row = conv?.[0] || null;
        const isP1 = row?.participant1_id === currentUser.id;
        const updateObj = isP1
          ? { unread_count_p2: (row?.unread_count_p2 || 0) + 1, last_message: text.slice(0,100), last_message_time: new Date().toISOString() }
          : { unread_count_p1: (row?.unread_count_p1 || 0) + 1, last_message: text.slice(0,100), last_message_time: new Date().toISOString() };
        await supabase.from('conversations').update(updateObj).eq('id', convId);
      } catch (_) {}
      // Notify recipient
      try {
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'message',
          title: 'New Message',
          message: `${currentUser.username || currentUser.full_name} sent you a message`,
          link_url: createPageUrl('Messages'),
          is_read: false,
          created_date: new Date().toISOString(),
        });
      } catch (_) {}
      toast.success('Message sent');
      setOpenMessage(false);
      setMessageText('');
      navigate(`${createPageUrl('Messages')}?conversation=${convId}`);
    } catch (e) {
      toast.error(e?.message || 'Failed to send message');
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
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <Card className="bg-[#1a1a24] border-[#2a2a3a] p-8 mb-6">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Avatar */}
            <div 
              className={`relative ${isCurrentUserAdmin && !isOwnProfile ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
              onClick={handleProfileClick}
              title={isCurrentUserAdmin && !isOwnProfile ? "Click for admin actions (Kick/Ban)" : ""}
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
              {isCurrentUserAdmin && !isOwnProfile && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1">
                  <Shield className="w-4 h-4" />
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 
                  className={`text-3xl font-bold text-white ${isCurrentUserAdmin && !isOwnProfile ? 'cursor-pointer hover:text-purple-300 transition-colors' : ''}`}
                  onClick={handleProfileClick}
                  title={isCurrentUserAdmin && !isOwnProfile ? "Click for admin actions (Kick/Ban)" : ""}
                >
                  <div className="flex items-center gap-2">
                    @{profileUser.username || "NoUsername"}
                    <UserBadges user={profileUser} size="md" />
                  </div>
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
                  <Button
                    type="button"
                    onClick={() => followMutation.mutate()}
                    disabled={followMutation.isPending}
                    className={isFollowing ? "bg-gray-600 hover:bg-gray-700" : "bg-purple-600 hover:bg-purple-700"}
                  >
                    {isFollowing ? (
                      <>
                        <UserMinus className="w-4 h-4 mr-2" />
                        Unfollow
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Follow
                      </>
                    )}
                  </Button>
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
                  type="button"
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
        {/* Message Dialog */}
        <Dialog open={openMessage} onOpenChange={setOpenMessage}>
          <DialogContent className="bg-[#1a1a24] border-[#2a2a3a] max-w-lg w-full">
            <DialogHeader>
              <DialogTitle className="text-white">Message @{profileUser.username || profileUser.full_name}</DialogTitle>
            </DialogHeader>
            <Textarea value={messageText} onChange={(e)=>setMessageText(e.target.value)} placeholder="Type your message" className="bg-[#0f0f16] border-[#2a2a3a] text-white" />
            <div className="flex gap-2 justify-end mt-3">
              <Button variant="outline" className="border-[#2a2a3a]" onClick={()=>setOpenMessage(false)}>Cancel</Button>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={sendProfileMessage}>Send</Button>
            </div>
          </DialogContent>
        </Dialog>
    </div>
  );
}
