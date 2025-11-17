import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Ban, UserX, AlertTriangle, Clock, MessageSquare, Eye, EyeOff } from "lucide-react";

export default function AdminUserActions({ username, userId, children, isInLive = false }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("24"); // hours
  const [actionType, setActionType] = useState(null);
  const queryClient = useQueryClient();

  // Check if current user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ["isAdmin"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin, role")
        .eq("id", user.id)
        .single();
      
      return profile?.is_admin === true || profile?.role === 'admin';
    },
    enabled: open,
  });

  // Check if target user is admin (protected from moderation)
  const { data: targetIsAdmin } = useQuery({
    queryKey: ["targetIsAdmin", userId],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin, role")
        .eq("id", userId)
        .single();
      
      return profile?.is_admin === true || profile?.role === 'admin';
    },
    enabled: open && userId,
  });

  const blockUserMutation = useMutation({
    mutationFn: async ({ targetUserId, reason, duration }) => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Not authenticated");

      // Check if target is admin - admins cannot be blocked
      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("is_admin, role")
        .eq("id", targetUserId)
        .single();
      
      if (targetProfile?.is_admin === true || targetProfile?.role === 'admin') {
        throw new Error("Cannot block admin users");
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + parseInt(duration));

      const { error } = await supabase
        .from('blocked_users')
        .insert({
          user_id: targetUserId,
          blocked_by: currentUser.id,
          reason: reason || 'Admin block',
          expires_at: expiresAt.toISOString(),
          is_active: true
        });
      
      if (error) throw error;
      return targetUserId;
    },
    onSuccess: (targetUserId) => {
      toast.success(`User blocked for ${duration} hours`);
      queryClient.invalidateQueries(["user", targetUserId]);
      queryClient.invalidateQueries(["blockedUsers"]);
      setOpen(false);
      setReason("");
    },
    onError: (error) => {
      toast.error(`Failed to block user: ${error.message}`);
    }
  });

  const silenceUserMutation = useMutation({
    mutationFn: async ({ targetUserId, reason, duration }) => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Not authenticated");

      // Check if target is admin - admins can only be silenced, not kicked/banned
      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("is_admin, role")
        .eq("id", targetUserId)
        .single();
      
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + parseInt(duration));

      const { error } = await supabase
        .from('moderation_actions')
        .insert({
          user_id: targetUserId,
          action_type: 'silence',
          reason: reason || 'Admin silence',
          moderator_id: currentUser.id,
          expires_at: expiresAt.toISOString(),
          is_active: true
        });
      
      if (error) throw error;
      return targetUserId;
    },
    onSuccess: (targetUserId) => {
      toast.success(`User silenced for ${duration} hours`);
      queryClient.invalidateQueries(["user", targetUserId]);
      setOpen(false);
      setReason("");
    },
    onError: (error) => {
      toast.error(`Failed to silence user: ${error.message}`);
    }
  });

  const banUserMutation = useMutation({
    mutationFn: async ({ targetUserId, reason }) => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Not authenticated");

      // Check if target is admin - admins cannot be banned
      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("is_admin, role")
        .eq("id", targetUserId)
        .single();
      
      if (targetProfile?.is_admin === true || targetProfile?.role === 'admin') {
        throw new Error("Cannot ban admin users");
      }

      const { error } = await supabase
        .from('banned_users')
        .insert({
          user_id: targetUserId,
          banned_by: currentUser.id,
          reason: reason || 'Admin ban',
          is_active: true
        });
      
      if (error) throw error;
      return targetUserId;
    },
    onSuccess: (targetUserId) => {
      toast.success('User permanently banned');
      queryClient.invalidateQueries(["user", targetUserId]);
      queryClient.invalidateQueries(["bannedUsers"]);
      setOpen(false);
      setReason("");
    },
    onError: (error) => {
      toast.error(`Failed to ban user: ${error.message}`);
    }
  });

  const kickUserMutation = useMutation({
    mutationFn: async ({ targetUserId, reason }) => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Not authenticated");

      // For live streams, use the existing kick functionality
      if (isInLive) {
        const { error: rpcError } = await supabase.rpc('perform_permanent_kick', {
          broadcaster_id: currentUser.id,
          target_user_id: targetUserId,
          stream_id: null,
          coin_cost: 0, // Admin kicks are free
        });
        if (rpcError) throw rpcError;
      } else {
        // For regular kicks, add to kicked_users table
        const { error } = await supabase
          .from('kicked_users')
          .insert({
            user_id: targetUserId,
            kicked_by: currentUser.id,
            reason: reason || 'Admin kick',
            is_active: true
          });
        
        if (error) throw error;
      }
      
      return targetUserId;
    },
    onSuccess: (targetUserId) => {
      toast.success('User kicked successfully');
      queryClient.invalidateQueries(["user", targetUserId]);
      queryClient.invalidateQueries(["kickedUsers"]);
      setOpen(false);
      setReason("");
    },
    onError: (error) => {
      toast.error(`Failed to kick user: ${error.message}`);
    }
  });

  const handleAction = (type) => {
    setActionType(type);
    if (type === 'kick' || type === 'ban') {
      // Check if target is admin
      if (targetIsAdmin) {
        toast.error("Cannot kick/ban admin users. Use silence instead.");
        return;
      }
      // For kick and ban, execute immediately with confirmation
      if (confirm(`Are you sure you want to ${type} this user?`)) {
        if (type === 'kick') {
          kickUserMutation.mutate({ targetUserId: userId, reason });
        } else if (type === 'ban') {
          banUserMutation.mutate({ targetUserId: userId, reason });
        }
      }
    } else if (type === 'silence') {
      // For silence, show the dialog to set duration
      setActionType('silence');
    } else {
      // For block, show the dialog to set duration
      setActionType('block');
    }
  };

  const confirmSilence = () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for silencing");
      return;
    }
    silenceUserMutation.mutate({ targetUserId: userId, reason, duration });
  };

  const confirmBlock = () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for blocking");
      return;
    }
    blockUserMutation.mutate({ targetUserId: userId, reason, duration });
  };

  if (!isAdmin) {
    return children;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-[#111118] border-[#222] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            Admin Actions for @{username}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Choose an administrative action for this user. These actions are logged and cannot be undone without admin privileges.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-4">
          {targetIsAdmin && (
            <div className="bg-yellow-900/50 border border-yellow-600 rounded-lg p-3 mb-2">
              <div className="flex items-center gap-2 text-yellow-300">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">Admin User Protected</span>
              </div>
              <p className="text-xs text-yellow-200 mt-1">
                This user is an admin and cannot be kicked or banned. Use silence instead.
              </p>
            </div>
          )}

          <Button
            onClick={() => handleAction('kick')}
            variant="destructive"
            className="justify-start"
            disabled={kickUserMutation.isLoading || targetIsAdmin}
          >
            <UserX className="w-4 h-4 mr-2" />
            Kick User
            <span className="text-xs text-gray-300 ml-auto">
              {isInLive ? 'Remove from stream' : 'Remove from platform'}
            </span>
          </Button>

          <Button
            onClick={() => handleAction('silence')}
            variant="outline"
            className="justify-start border-orange-600 text-orange-400 hover:bg-orange-600 hover:text-white"
            disabled={silenceUserMutation.isLoading}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Silence User
            <span className="text-xs text-gray-300 ml-auto">Mute temporarily</span>
          </Button>

          <Button
            onClick={() => handleAction('block')}
            variant="destructive"
            className="justify-start"
            disabled={blockUserMutation.isLoading || targetIsAdmin}
          >
            <Clock className="w-4 h-4 mr-2" />
            Block User
            <span className="text-xs text-gray-300 ml-auto">Temporary restriction</span>
          </Button>

          <Button
            onClick={() => handleAction('ban')}
            variant="destructive"
            className="justify-start bg-red-600 hover:bg-red-700"
            disabled={banUserMutation.isLoading || targetIsAdmin}
          >
            <Ban className="w-4 h-4 mr-2" />
            Ban User Permanently
            <span className="text-xs text-gray-300 ml-auto">Permanent restriction</span>
          </Button>
        </div>

        {actionType === 'block' && (
          <div className="space-y-4 border-t border-[#222] pt-4">
            <div className="grid gap-2">
              <Label htmlFor="duration">Block Duration (hours)</Label>
              <Input
                id="duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min="1"
                max="8760" // 1 year
                className="bg-[#1a1a24] border-[#333] text-white"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason (required)</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for block..."
                className="bg-[#1a1a24] border-[#333] text-white"
              />
            </div>
            <Button
              onClick={confirmBlock}
              disabled={blockUserMutation.isLoading || !reason.trim()}
              className="w-full"
            >
              {blockUserMutation.isLoading ? 'Blocking...' : 'Confirm Block'}
            </Button>
          </div>
        )}

        {actionType === 'silence' && (
          <div className="space-y-4 border-t border-[#222] pt-4">
            <div className="grid gap-2">
              <Label htmlFor="duration">Silence Duration (hours)</Label>
              <Input
                id="duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min="1"
                max="8760" // 1 year
                className="bg-[#1a1a24] border-[#333] text-white"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason (required)</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for silence..."
                className="bg-[#1a1a24] border-[#333] text-white"
              />
            </div>
            <Button
              onClick={confirmSilence}
              disabled={silenceUserMutation.isLoading || !reason.trim()}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              {silenceUserMutation.isLoading ? 'Silencing...' : 'Confirm Silence'}
            </Button>
          </div>
        )}

        <DialogFooter className="text-xs text-gray-500">
          All admin actions are logged and monitored
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}