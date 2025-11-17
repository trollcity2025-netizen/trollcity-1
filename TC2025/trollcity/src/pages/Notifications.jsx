import React, { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, X, Radio, Gift, Users, MessageCircle, DollarSign, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");

  // ✅ Get current logged-in user
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data?.user;
    },
  });

  // ✅ Fetch notifications from Supabase
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Error fetching notifications:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!user,
    initialData: [],
    refetchInterval: 5000,
  });

  // ✅ Mark all notifications as read when page loads
  const markAllAsReadOnLoad = useMutation({
    mutationFn: async () => {
      if (!user) return;
      console.log('📝 Marking all notifications as read for user:', user.id);
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      
      if (error) {
        console.error('❌ Failed to mark notifications as read:', error);
        throw error;
      }
      console.log('✅ Successfully marked notifications as read');
    },
    onSuccess: () => {
      console.log('🔄 Invalidating queries after marking as read');
      // Invalidate both notifications and unread count queries
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotifications', user?.id] });
      // ✅ Force update the unread count to 0 immediately
      queryClient.setQueryData(['unreadNotifications', user?.id], 0);
    },
    onError: (error) => {
      console.warn('Failed to mark notifications as read:', error);
    },
  });

  // ✅ Auto-mark notifications as read when page loads
  useEffect(() => {
    if (user && notifications.length > 0) {
      const hasUnread = notifications.some(n => !n.is_read);
      console.log('🔔 Notifications page check:', {
        userId: user.id,
        totalNotifications: notifications.length,
        hasUnread: hasUnread,
        unreadCount: notifications.filter(n => !n.is_read).length,
        notifications: notifications.map(n => ({ id: n.id, is_read: n.is_read, type: n.type }))
      });
      if (hasUnread) {
        markAllAsReadOnLoad.mutate();
      }
    }
  }, [user, notifications.length]);

  // ✅ Mark a single notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotifications', user?.id] });
    },
  });

  // ✅ Mark all as read efficiently
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotifications', user?.id] });
      toast.success("All notifications marked as read");
    },
  });

  // ✅ Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId) => {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      toast.success("Notification deleted");
    },
  });

  // ✅ Click handler
  const handleNotificationClick = (notif) => {
    // Mark as read if it's unread
    if (!notif.is_read) {
      markAsReadMutation.mutate(notif.id);
    }
    // Handle navigation
    if (notif.link_url) {
      navigate(notif.link_url.replace('/#', ''));
    }
  };

  // ✅ Icons
  const getNotificationIcon = (type) => {
    switch (type) {
      case "stream_live": return <Radio className="w-5 h-5 text-red-400" />;
      case "new_follower": return <Users className="w-5 h-5 text-purple-400" />;
      case "gift_received": return <Gift className="w-5 h-5 text-pink-400" />;
      case "tip_received": return <DollarSign className="w-5 h-5 text-green-400" />;
      case "message": return <MessageCircle className="w-5 h-5 text-blue-400" />;
      case "system": return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      default: return <Bell className="w-5 h-5 text-gray-400" />;
    }
  };

  // ✅ Filter logic
  const filteredNotifications =
    filter === "all"
      ? notifications
      : filter === "unread"
      ? notifications.filter((n) => !n.is_read)
      : notifications.filter((n) => n.type === filter);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // ✅ Loading / login states
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] flex items-center justify-center">
        <Card className="bg-[#1a1a24] border-[#2a2a3a] p-8 text-center">
          <p className="text-white mb-4">Please log in to view notifications</p>
          <Button onClick={() => supabase.auth.signInWithOAuth({ provider: "google" })}>
            Login
          </Button>
        </Card>
      </div>
    );
  }

  // ✅ Main UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Bell className="w-10 h-10 text-purple-400" />
                <h1 className="text-4xl font-bold text-white">Notifications</h1>
              </div>
              <p className="text-gray-400">Stay updated with the latest activity</p>
              <p className="text-xs text-gray-600 mt-1">Times shown in {userTimezone}</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending || unreadCount === 0}
                variant="outline"
                className="border-purple-500 text-purple-400"
              >
                Mark all read
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {["all", "unread", "stream_live", "new_follower", "gift_received", "message"].map((f) => (
            <Button
              key={f}
              onClick={() => setFilter(f)}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              className={filter === f ? "bg-purple-600" : "border-[#2a2a3a]"}
            >
              {f.replace("_", " ")}
            </Button>
          ))}
        </div>

        {/* Notifications list */}
        {filteredNotifications.length === 0 ? (
          <Card className="bg-[#1a1a24] border-[#2a2a3a] p-12 text-center">
            <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No notifications</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notif) => {
              const notifDate = new Date(notif.created_at);
              const now = new Date();
              const isToday = now.toDateString() === notifDate.toDateString();
              const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === notifDate.toDateString();

              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <Card
                    className={`${
                      !notif.is_read 
                        ? 'bg-purple-500/20 border-purple-500/70 shadow-lg shadow-purple-500/20' 
                        : 'bg-purple-500/10 border-purple-500/50'
                    } cursor-pointer hover:border-purple-500 transition-all`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="text-3xl flex-shrink-0 relative">
                          {getNotificationIcon(notif.type)}
                          {!notif.is_read && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#1a1a24]"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-white font-bold">{notif.title}</h3>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotificationMutation.mutate(notif.id);
                              }}
                              className="text-gray-400 hover:text-red-400 flex-shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          <p className="text-gray-400 text-sm mt-1">{notif.message}</p>
                          <p className="text-gray-600 text-xs mt-2">
                            {isToday
                              ? format(notifDate, "h:mm a")
                              : isYesterday
                              ? "Yesterday " + format(notifDate, "h:mm a")
                              : format(notifDate, "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
