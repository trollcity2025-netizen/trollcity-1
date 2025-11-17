import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Edit, Trash2, Lock, Unlock, User, Users, Mail, Calendar, DollarSign, Shield, Plus, Filter, RefreshCw, ExternalLink } from "lucide-react";
import { creditCoins, creditFreeCoins } from "@/lib/coins";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ModernUserAdminPanel() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCoinsModal, setShowCoinsModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [coinAmount, setCoinAmount] = useState(100);
  const [coinType, setCoinType] = useState("real");
  const [statusFilter, setStatusFilter] = useState("all"); // Filter by user status (active, banned, officers, admins)
  const [activeActionTab, setActiveActionTab] = useState("users"); // Tab for organizing actions

  // Fetch users with modern query - always include all users, with admin prominently displayed
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["modernAdminUsers", searchQuery, statusFilter],
    queryFn: async () => {
      if (!supabase.__isConfigured) return [];
      
      let query = supabase
        .from("profiles")
        .select("id, username, full_name, email, avatar_url, coins, free_coins, purchased_coins, level, role, is_banned, is_troll_officer, is_admin, created_at")
        .order("is_admin", { ascending: false }) // Show admins first
        .order("created_at", { ascending: false });
      // Removed .limit(100) to show all users

      // Apply search filter
      if (searchQuery.trim().length >= 2) {
        const term = searchQuery.trim().toLowerCase();
        query = query.or(`username.ilike.%${term}%,full_name.ilike.%${term}%,email.ilike.%${term}%`);
      }

      // Apply status filter - but always include admins in "all" view
      if (statusFilter !== "all") {
        if (statusFilter === "active") {
          query = query.or(`is_banned.eq.false,is_admin.eq.true`); // Include admins with active users
        } else if (statusFilter === "banned") {
          query = query.eq("is_banned", true);
        } else if (statusFilter === "officers") {
          query = query.eq("is_troll_officer", true);
        } else if (statusFilter === "admins") {
          query = query.eq("is_admin", true);
        }
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching users:", error);
        throw error;
      }
      
      console.log(`Fetched ${data?.length || 0} users from database`);
      
      // Debug: Log admin users and users with role 'admin'
      const adminUsers = data?.filter(u => u.is_admin || u.role === 'admin') || [];
      console.log('Admin users found:', adminUsers.map(u => ({ 
        id: u.id, 
        username: u.username, 
        is_admin: u.is_admin, 
        role: u.role 
      })));
      
      return data || [];
    },
    staleTime: 5000,
  });

  // Real-time updates
  useEffect(() => {
    if (!supabase.__isConfigured) return;
    
    const channel = supabase.channel("profiles_admin_realtime");
    channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
      const row = payload?.new || null;
      if (!row) return;
      
      queryClient.setQueryData(["modernAdminUsers", searchQuery, statusFilter], (prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map(u => u.id === row.id ? { 
          ...u, 
          ...row,
          // Ensure fallback values for missing columns
          level: row.level || u.level || 0,
          coins: row.coins || u.coins || 0,
          free_coins: row.free_coins || u.free_coins || 0,
          purchased_coins: row.purchased_coins || u.purchased_coins || 0,
          is_banned: row.is_banned ?? u.is_banned ?? false,
          is_troll_officer: row.is_troll_officer ?? u.is_troll_officer ?? false,
          is_admin: row.is_admin ?? u.is_admin ?? false,
          role: row.role ?? u.role ?? null
        } : u);
      });
    }).subscribe();
    
    return () => { try { channel.unsubscribe(); } catch (_) {} };
  }, [searchQuery, statusFilter, queryClient]);

  // Mutations
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }) => {
      const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
      if (error) throw error;
      return { userId, updates };
    },
    onSuccess: ({ userId, updates }) => {
      queryClient.setQueryData(["modernAdminUsers", searchQuery, statusFilter], (prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map(u => u.id === userId ? { ...u, ...updates } : u);
      });
      toast.success("User updated successfully");
    },
    onError: (error) => toast.error(error.message || "Failed to update user")
  });

  const addCoinsMutation = useMutation({
    mutationFn: async ({ userId, amount, type }) => {
      if (type === "real") {
        await creditCoins(userId, amount, { source: "admin_dashboard" });
      } else {
        await creditFreeCoins(userId, amount, { source: "admin_dashboard" });
      }
      return { userId, amount, type };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["modernAdminUsers", searchQuery, statusFilter]);
      toast.success(`${coinAmount} ${coinType} coins added successfully`);
    },
    onError: (error) => toast.error(error.message || "Failed to add coins")
  });

  const banUserMutation = useMutation({
    mutationFn: async ({ userId, ban }) => {
      const updates = ban 
        ? { is_banned: true }
        : { is_banned: false };
      
      const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
      if (error) throw error;
      
      return { userId, ban };
    },
    onSuccess: ({ userId, ban }) => {
      queryClient.setQueryData(["modernAdminUsers", searchQuery, statusFilter], (prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map(u => u.id === userId ? { ...u, is_banned: ban } : u);
      });
      toast.success(ban ? "User banned successfully" : "User unbanned successfully");
    },
    onError: (error) => toast.error(error.message || "Failed to update ban status")
  });

  const kickUserMutation = useMutation({
    mutationFn: async ({ userId }) => {
      // Create a kick record that will redirect user to payment page
      const { error } = await supabase.from("kicked_users").insert({
        user_id: userId,
        kicked_at: new Date().toISOString(),
        reason: "Admin kick - payment required"
      });
      if (error) throw error;
      
      return { userId };
    },
    onSuccess: ({ userId }) => {
      toast.success("User kicked successfully - they will be redirected to payment page");
    },
    onError: (error) => toast.error(error.message || "Failed to kick user")
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, makeAdmin }) => {
      const updates = makeAdmin 
        ? { is_admin: true, role: 'admin' }
        : { is_admin: false, role: 'user' };
      
      const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
      if (error) throw error;
      
      return { userId, makeAdmin };
    },
    onSuccess: ({ userId, makeAdmin }) => {
      queryClient.setQueryData(["modernAdminUsers", searchQuery, statusFilter], (prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map(u => u.id === userId ? { 
          ...u, 
          is_admin: makeAdmin,
          role: makeAdmin ? 'admin' : 'user'
        } : u);
      });
      toast.success(makeAdmin ? "User promoted to admin" : "User demoted to regular user");
    },
    onError: (error) => toast.error(error.message || "Failed to update user role")
  });

  // Helper functions
  const getStatusColor = (user) => {
    if (user.is_banned) return "bg-red-600";
    if (user.is_admin || user.role === 'admin') return "bg-purple-600";
    if (user.is_troll_officer) return "bg-blue-600";
    return "bg-green-600";
  };

  const getStatusText = (user) => {
    if (user.is_banned) return "Banned";
    if (user.is_admin || user.role === 'admin') return "Admin";
    if (user.is_troll_officer) return "Officer";
    return "Active";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString();
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleAddCoins = (user) => {
    setSelectedUser(user);
    setShowCoinsModal(true);
  };

  const handleBanUser = (user) => {
    setSelectedUser(user);
    setShowBanModal(true);
  };

  const handleKickUser = (user) => {
    setSelectedUser(user);
    if (confirm(`Are you sure you want to kick ${user.username || user.full_name}? This will redirect them to the payment page.`)) {
      kickUserMutation.mutate({ userId: user.id });
    }
  };

  const handleChangeRole = (user) => {
    setSelectedUser(user);
    setShowRoleModal(true);
  };

  const handleViewUserProfile = (user) => {
    navigate(`${createPageUrl("PublicProfile")}?userId=${encodeURIComponent(user.id)}`);
  };

  const handleConfirmRoleChange = (makeAdmin) => {
    if (!selectedUser) return;
    updateRoleMutation.mutate({ userId: selectedUser.id, makeAdmin });
    setShowRoleModal(false);
  };

  const handleConfirmBan = () => {
    if (!selectedUser) return;
    banUserMutation.mutate({ userId: selectedUser.id, ban: !selectedUser.is_banned });
    setShowBanModal(false);
  };

  const handleConfirmAddCoins = () => {
    if (!selectedUser || !coinAmount) return;
    addCoinsMutation.mutate({ userId: selectedUser.id, amount: coinAmount, type: coinType });
    setShowCoinsModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">User Management</h2>
          <p className="text-gray-400">Manage user accounts, roles, and permissions</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-[#2a2a3a] text-gray-300 hover:border-purple-500"
            onClick={() => {
              queryClient.invalidateQueries(["modernAdminUsers", searchQuery, statusFilter]);
              toast.success("Users refreshed");
            }}
          >
            <RefreshCw className="w-4 h-4 mr-1" />Refresh
          </Button>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#0a0a0f] border-[#2a2a3a] text-white w-64"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0a0a0f] border-[#2a2a3a] text-white rounded px-3 py-2 text-sm"
          >
            <option value="all">All Users</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
            <option value="officers">Officers</option>
            <option value="admins">Admins</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Users</p>
              <p className="text-2xl font-bold text-white">{users.length}</p>
            </div>
            <Users className="w-8 h-8 text-blue-400" />
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Active Users</p>
              <p className="text-2xl font-bold text-white">
                {users.filter(u => !u.is_banned).length}
              </p>
            </div>
            <Shield className="w-8 h-8 text-green-400" />
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-red-500/20 to-pink-500/20 border-red-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Banned Users</p>
              <p className="text-2xl font-bold text-white">
                {users.filter(u => u.is_banned).length}
              </p>
            </div>
            <Lock className="w-8 h-8 text-red-400" />
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border-purple-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Coins</p>
              <p className="text-2xl font-bold text-white">
                {users.reduce((sum, u) => sum + (u.coins || 0), 0).toLocaleString()}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-400" />
          </div>
        </Card>
      </div>

      {/* Users Table with Tabs */}
      <Tabs value={activeActionTab} onValueChange={setActiveActionTab} className="space-y-6">
        <TabsList className="bg-[#1a1a24] border-[#2a2a3a]">
          <TabsTrigger value="users" className="data-[state=active]:bg-[#2a2a3a]">
            <User className="w-4 h-4 mr-2" />
            All Users
          </TabsTrigger>
          <TabsTrigger value="search" className="data-[state=active]:bg-[#2a2a3a]">
            <Search className="w-4 h-4 mr-2" />
            Search Users
          </TabsTrigger>
          <TabsTrigger value="moderation" className="data-[state=active]:bg-[#2a2a3a]">
            <Shield className="w-4 h-4 mr-2" />
            Moderation
          </TabsTrigger>
          <TabsTrigger value="economy" className="data-[state=active]:bg-[#2a2a3a]">
            <DollarSign className="w-4 h-4 mr-2" />
            Economy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="bg-[#0a0a0f] border-[#2a2a3a]">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Users</h3>
            <Badge variant="secondary" className="bg-[#1a1a24] text-gray-300">
              {users.length} users
            </Badge>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 mx-auto mb-4 animate-spin border-4 border-purple-600 border-t-transparent rounded-full"></div>
              <p className="text-gray-400">Loading users...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2a2a3a]">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">User</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Email</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Level</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Coins</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Joined</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-[#2a2a3a] hover:bg-[#1a1a24] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {user.full_name?.charAt(0) || user.username?.charAt(0) || '?'}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-white">@{user.username || user.full_name || 'Unknown'}</div>
                            <div className="text-sm text-gray-400">{user.id.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-300">{user.email || 'No email'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={`${getStatusColor(user)} text-white text-xs`}>
                          {getStatusText(user)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-cyan-400 font-semibold">{user.level || 0}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-yellow-400 font-semibold">{(user.coins || 0).toLocaleString()}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-400 text-sm">{formatDate(user.created_at)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="p-1 h-8 w-8 text-gray-400 hover:text-blue-400"
                            onClick={() => handleViewUserProfile(user)}
                            title="View user profile"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="p-1 h-8 w-8 text-gray-400 hover:text-blue-400"
                            onClick={() => handleEditUser(user)}
                            title="Edit user"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="p-1 h-8 w-8 text-gray-400 hover:text-green-400"
                            onClick={() => handleAddCoins(user)}
                            title="Add coins"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`p-1 h-8 w-8 ${user.is_admin || user.role === 'admin' ? 'text-purple-400 hover:text-gray-400' : 'text-gray-400 hover:text-purple-400'}`}
                            onClick={() => handleChangeRole(user)}
                            title={user.is_admin || user.role === 'admin' ? "Demote from admin" : "Promote to admin"}
                          >
                            <Shield className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`p-1 h-8 w-8 ${user.is_banned ? 'text-red-400 hover:text-green-400' : 'text-gray-400 hover:text-red-400'}`}
                            onClick={() => handleBanUser(user)}
                            title={user.is_banned ? "Unban user" : "Ban user"}
                          >
                            {user.is_banned ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="p-1 h-8 w-8 text-gray-400 hover:text-orange-400"
                            onClick={() => handleKickUser(user)}
                            title="Kick user (redirects to payment page)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {users.length === 0 && (
                <div className="text-center py-8">
                  <User className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-400">No users found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
        </TabsContent>

      {/* Edit User Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-[#1a1a24] border-[#2a2a3a]">
          <DialogHeader>
            <DialogTitle className="text-white">Edit User</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update user information for @{selectedUser?.username || selectedUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Edit form would go here */}
            <div className="flex gap-2">
              <Button 
                onClick={() => {
                  // Implement edit logic
                  setShowEditModal(false);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Save Changes
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowEditModal(false)}
                className="border-[#2a2a3a] text-white hover:bg-[#2a2a3a]"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Coins Modal */}
      <Dialog open={showCoinsModal} onOpenChange={setShowCoinsModal}>
        <DialogContent className="bg-[#1a1a24] border-[#2a2a3a]">
          <DialogHeader>
            <DialogTitle className="text-white">Add Coins</DialogTitle>
            <DialogDescription className="text-gray-400">
              Add coins to @{selectedUser?.username || selectedUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Coin Type</label>
              <select
                value={coinType}
                onChange={(e) => setCoinType(e.target.value)}
                className="w-full bg-[#0a0a0f] border-[#2a2a3a] text-white rounded px-3 py-2"
              >
                <option value="real">Real Coins (Purchased)</option>
                <option value="free">Free Coins</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Amount</label>
              <Input
                type="number"
                value={coinAmount}
                onChange={(e) => setCoinAmount(parseInt(e.target.value) || 0)}
                className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                min="1"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleConfirmAddCoins}
                className="bg-green-600 hover:bg-green-700"
              >
                Add Coins
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowCoinsModal(false)}
                className="border-[#2a2a3a] text-white hover:bg-[#2a2a3a]"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ban/Unban Modal */}
      <Dialog open={showBanModal} onOpenChange={setShowBanModal}>
        <DialogContent className="bg-[#1a1a24] border-[#2a2a3a]">
          <DialogHeader>
            <DialogTitle className="text-white">
              {selectedUser?.is_banned ? "Unban User" : "Ban User"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to {selectedUser?.is_banned ? "unban" : "ban"} @{selectedUser?.username || selectedUser?.full_name}?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button 
              onClick={handleConfirmBan}
              className={selectedUser?.is_banned ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
            >
              {selectedUser?.is_banned ? "Unban User" : "Ban User"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowBanModal(false)}
              className="border-[#2a2a3a] text-white hover:bg-[#2a2a3a]"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Change Modal */}
      <Dialog open={showRoleModal} onOpenChange={setShowRoleModal}>
        <DialogContent className="bg-[#1a1a24] border-[#2a2a3a]">
          <DialogHeader>
            <DialogTitle className="text-white">
              Change User Role
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Change role for @{selectedUser?.username || selectedUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button 
                onClick={() => handleConfirmRoleChange(true)}
                className={selectedUser?.is_admin || selectedUser?.role === 'admin' ? "bg-gray-600 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"}
                disabled={selectedUser?.is_admin || selectedUser?.role === 'admin'}
              >
                <Shield className="w-4 h-4 mr-2" />
                Make Admin
              </Button>
              <Button 
                onClick={() => handleConfirmRoleChange(false)}
                className={!(selectedUser?.is_admin || selectedUser?.role === 'admin') ? "bg-gray-600 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}
                disabled={!(selectedUser?.is_admin || selectedUser?.role === 'admin')}
              >
                <User className="w-4 h-4 mr-2" />
                Make User
              </Button>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setShowRoleModal(false)}
              className="border-[#2a2a3a] text-white hover:bg-[#2a2a3a] w-full"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </Tabs>
    </div>
  );
}