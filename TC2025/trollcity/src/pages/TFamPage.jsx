import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useNavigate, Link } from 'react-router-dom';
import { Users, MessageSquare, Trophy, Settings, Send, Crown, Star, Zap, Target, Heart, Home } from 'lucide-react';
import AdminUserActions from '@/components/admin/AdminUserActions';

export default function TFamPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('chat');
  const [chatMessage, setChatMessage] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);

  // Check if user is a troll family member
  const { data: currentUser, isLoading: userLoading } = useQuery({ 
    queryKey: ['currentUser'], 
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    }
  });

  const isTrollFamilyMember = currentUser?.user_metadata?.troll_family_name || 
                             currentUser?.troll_family_name || 
                             currentUser?.role === 'admin' ||
                             currentUser?.user_metadata?.role === 'admin';

  // Show loading state while checking permissions
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2e] p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 bg-[#11121a] border-[#2a2a3a] text-center">
            <div className="w-16 h-16 mx-auto mb-4 animate-pulse bg-gray-600 rounded-full"></div>
            <h1 className="text-2xl font-bold text-white mb-4">Checking Permissions...</h1>
            <p className="text-gray-400">Please wait while we verify your access.</p>
          </Card>
        </div>
      </div>
    );
  }

  // Fetch all troll family members
  const { data: familyMembers = [], isLoading: membersLoading, error: membersError } = useQuery({
    queryKey: ['trollFamilyMembers'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, level, coins, created_at, troll_family_name')
          .not('troll_family_name', 'is', null)
          .order('created_at', { ascending: true });
        
        if (error) {
          console.error('Error fetching family members:', error);
          throw error;
        }
        return data || [];
      } catch (err) {
        console.error('Failed to fetch family members:', err);
        toast.error('Failed to load family data');
        return [];
      }
    },
    enabled: isTrollFamilyMember,
  });

  // Fetch family chat messages
  const { data: chatMessages = [], isLoading: chatLoading } = useQuery({
    queryKey: ['familyChatMessages'],
    queryFn: async () => {
      try {
        // Try to fetch from family_chats table, fallback to regular messages if it doesn't exist
        const { data, error } = await supabase
          .from('family_chats')
          .select(`
            *,
            profiles(id, username, full_name, avatar_url, level, troll_family_name)
          `)
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (error) {
          console.warn('Family chats table not found, using fallback chat system:', error);
          // Fallback: create mock chat data or use a different approach
          return [];
        }
        return data || [];
      } catch (err) {
        console.warn('Failed to fetch family chat messages, using fallback:', err);
        // Return empty array as fallback
        return [];
      }
    },
    enabled: isTrollFamilyMember,
  });

  // Fetch family announcements
  const { data: announcements = [] } = useQuery({
    queryKey: ['familyAnnouncements'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('admin_content')
          .select('*')
          .eq('page_name', 'family_announcements')
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching announcements:', error);
          throw error;
        }
        return data || [];
      } catch (err) {
        console.error('Failed to fetch announcements:', err);
        toast.error('Failed to load announcements');
        return [];
      }
    },
    enabled: isTrollFamilyMember,
  });

  // Send chat message mutation
  const sendChatMutation = useMutation({
    mutationFn: async (message) => {
      const { error } = await supabase
        .from('family_chats')
        .insert({
          member_id: currentUser.id,
          message: message,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['familyChatMessages']);
      toast.success('Message sent!');
    },
    onError: (error) => {
      toast.error('Failed to send message: ' + error.message);
    }
  });

  // Send announcement mutation (for admins)
  const sendAnnouncementMutation = useMutation({
    mutationFn: async (message) => {
      const { error } = await supabase
        .from('admin_content')
        .insert({
          page_name: 'family_announcements',
          field_name: 'announcement',
          content: message,
          updated_by: currentUser.id,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['familyAnnouncements']);
      toast.success('Announcement sent!');
    },
    onError: (error) => {
      toast.error('Failed to send announcement: ' + error.message);
    }
  });

  // Real-time subscription for chat messages
  useEffect(() => {
    if (!isTrollFamilyMember) return;

    const channel = supabase
      .channel('family_chat_changes')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'family_chats' 
        }, 
        (payload) => {
          queryClient.invalidateQueries(['familyChatMessages']);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isTrollFamilyMember, queryClient]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    
    sendChatMutation.mutate(chatMessage);
    setChatMessage('');
  };

  const handleSendAnnouncement = (e) => {
    e.preventDefault();
    if (!announcement.trim()) return;
    
    sendAnnouncementMutation.mutate(announcement);
    setAnnouncement('');
  };

  if (!isTrollFamilyMember) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2e] p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 bg-[#11121a] border-[#2a2a3a] text-center">
            <Home className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
            <p className="text-gray-300 mb-6">This area is restricted to Troll Family members only.</p>
            <Button 
              onClick={() => navigate('/')} 
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              Return to Home
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2e] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-r from-pink-600 to-purple-600 rounded-full">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">T Fam</h1>
                <p className="text-gray-300">Exclusive area for Troll Family members</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className="bg-gradient-to-r from-pink-600 to-purple-600 text-white">
                <Star className="w-4 h-4 mr-1" />
                Family Status
              </Badge>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-[#11121a] border-[#2a2a3a] p-1">
            <TabsTrigger value="chat" className="data-[state=active]:bg-pink-600">
              <MessageSquare className="w-4 h-4 mr-2" />
              Family Chat
            </TabsTrigger>
            <TabsTrigger value="roster" className="data-[state=active]:bg-pink-600">
              <Users className="w-4 h-4 mr-2" />
              Family Roster
            </TabsTrigger>
            <TabsTrigger value="announcements" className="data-[state=active]:bg-pink-600">
              <Target className="w-4 h-4 mr-2" />
              Announcements
            </TabsTrigger>
            <TabsTrigger value="tools" className="data-[state=active]:bg-pink-600">
              <Settings className="w-4 h-4 mr-2" />
              Family Tools
            </TabsTrigger>
          </TabsList>

          {/* Family Chat Tab */}
          <TabsContent value="chat" className="space-y-4">
            <Card className="p-6 bg-[#11121a] border-[#2a2a3a]">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <MessageSquare className="w-5 h-5 mr-2" />
                Family Chat
              </h2>
              
              {/* Chat Messages */}
              <div className="h-96 overflow-y-auto mb-4 space-y-3 p-4 bg-[#0a0a0f] rounded-lg border border-[#2a2a3a]">
                {chatLoading ? (
                  <div className="text-center text-gray-400 py-8">Loading messages...</div>
                ) : chatMessages.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">No messages yet. Start the conversation!</div>
                ) : (
                  chatMessages.map((message) => (
                    <div key={message.id} className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-pink-600 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">
                          {message.profiles?.full_name?.charAt(0) || message.profiles?.username?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <AdminUserActions 
                            username={message.profiles?.username || 'Unknown'} 
                            userId={message.profiles?.id}
                          >
                            <span className="font-semibold text-white text-sm hover:text-blue-400 cursor-pointer transition-colors">
                              {message.profiles?.full_name || message.profiles?.username || 'Unknown'}
                            </span>
                          </AdminUserActions>
                          <Badge className="bg-pink-500 text-white text-xs">
                            {message.profiles?.troll_family_name || 'Family'}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            {new Date(message.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-gray-200 text-sm">{message.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="space-y-3">
                <div className="flex space-x-2">
                  <Input
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                  />
                  <Button type="submit" className="bg-pink-600 hover:bg-pink-700">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </Card>
          </TabsContent>

          {/* Family Roster Tab */}
          <TabsContent value="roster" className="space-y-4">
            <Card className="p-6 bg-[#11121a] border-[#2a2a3a]">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Family Roster ({familyMembers.length} members)
              </h2>
              
              {membersLoading ? (
                <div className="text-center text-gray-400 py-8">Loading family members...</div>
              ) : familyMembers.length === 0 ? (
                <div className="text-center text-gray-400 py-8">No family members found</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {familyMembers.map((member) => (
                    <Card key={member.id} className="p-4 bg-[#0a0a0f] border-[#2a2a3a] hover:border-pink-500 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-pink-600 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold">
                            {member.full_name?.charAt(0) || member.username?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">{member.full_name || member.username}</h3>
                          <AdminUserActions username={member.username} userId={member.id}>
                            <p className="text-sm text-gray-400 hover:text-blue-400 cursor-pointer transition-colors">
                              @{member.username}
                            </p>
                          </AdminUserActions>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge className="bg-purple-500 text-white text-xs">Level {member.level}</Badge>
                            <Badge className="bg-pink-500 text-white text-xs">
                              {member.troll_family_name}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="announcements" className="space-y-4">
            <Card className="p-6 bg-[#11121a] border-[#2a2a3a]">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Target className="w-5 h-5 mr-2" />
                Family Announcements
              </h2>
              
              {/* Announcement Input (Admin only) */}
              {(currentUser?.role === 'admin' || currentUser?.user_metadata?.role === 'admin') && (
                <form onSubmit={handleSendAnnouncement} className="mb-6 space-y-3">
                  <div className="flex space-x-2">
                    <Input
                      value={announcement}
                      onChange={(e) => setAnnouncement(e.target.value)}
                      placeholder="Post a family announcement..."
                      className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                    />
                    <Button type="submit" className="bg-pink-600 hover:bg-pink-700">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </form>
              )}

              {/* Announcements List */}
              {announcements.length === 0 ? (
                <div className="text-center text-gray-400 py-8">No announcements yet</div>
              ) : (
                <div className="space-y-4">
                  {announcements.map((announcement) => (
                    <Card key={announcement.id} className="p-4 bg-[#0a0a0f] border-[#2a2a3a]">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-pink-600 to-purple-600 rounded-full flex items-center justify-center">
                          <Target className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-200">{announcement.content}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(announcement.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Family Tools Tab */}
          <TabsContent value="tools" className="space-y-4">
            <Card className="p-6 bg-[#11121a] border-[#2a2a3a]">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                Family Tools
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4 bg-[#0a0a0f] border-[#2a2a3a]">
                  <h3 className="font-semibold text-white mb-2">Family Statistics</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Members:</span>
                      <span className="text-white">{familyMembers.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Average Level:</span>
                      <span className="text-white">
                        {familyMembers.length > 0 
                          ? Math.round(familyMembers.reduce((sum, m) => sum + (m.level || 0), 0) / familyMembers.length)
                          : 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Coins:</span>
                      <span className="text-white">
                        {familyMembers.reduce((sum, m) => sum + (m.coins || 0), 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 bg-[#0a0a0f] border-[#2a2a3a]">
                  <h3 className="font-semibold text-white mb-2">Quick Actions</h3>
                  <div className="space-y-2">
                    <Button 
                      onClick={() => navigate('/TrollFamilyApplication')}
                      className="w-full bg-pink-600 hover:bg-pink-700 text-sm"
                    >
                      Invite to Family
                    </Button>
                    <Button 
                      onClick={() => navigate('/FamilyPayouts')}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-sm"
                    >
                      Family Payouts
                    </Button>
                  </div>
                </Card>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}