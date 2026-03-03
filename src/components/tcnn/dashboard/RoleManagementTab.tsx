import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useTCNNRoles } from '@/hooks/useTCNNRoles';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  UserPlus,
  UserMinus,
  Crown,
  Mic,
  PenTool,
  Search,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface TCNNMember {
  id: string;
  user_id: string;
  role: 'journalist' | 'news_caster' | 'chief_news_caster';
  assigned_by: string;
  assigned_at: string;
  profile: {
    stage_name: string;
    avatar_url: string | null;
    email: string;
  };
}

const roleIcons = {
  journalist: PenTool,
  news_caster: Mic,
  chief_news_caster: Crown
};

const roleLabels = {
  journalist: 'Journalist',
  news_caster: 'News Caster',
  chief_news_caster: 'Chief News Caster'
};

export default function RoleManagementTab() {
  const { user } = useAuthStore();
  const { isChiefNewsCaster } = useTCNNRoles(user?.id);
  const [members, setMembers] = useState<TCNNMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'journalist' | 'news_caster' | 'chief_news_caster'>('journalist');
  const [isAssigning, setIsAssigning] = useState(false);
  const [chiefCount, setChiefCount] = useState(0);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tcnn_role_assignments')
        .select(`
          *,
          profile:user_id(
            stage_name,
            avatar_url,
            email
          )
        `)
        .order('assigned_at', { ascending: false });

      if (error) throw error;

      const formattedData = data?.map(item => ({
        ...item,
        profile: item.profile || { stage_name: 'Unknown', avatar_url: null, email: '' }
      })) || [];

      setMembers(formattedData);
      setChiefCount(formattedData.filter(m => m.role === 'chief_news_caster').length);
    } catch (error) {
      console.error('Error loading TCNN members:', error);
      toast.error('Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignRole = async () => {
    if (!newMemberUsername.trim()) {
      toast.error('Please enter a username');
      return;
    }

    if (newMemberRole === 'chief_news_caster' && chiefCount >= 3) {
      toast.error('Maximum of 3 Chief News Casters allowed');
      return;
    }

    setIsAssigning(true);
    try {
      // Find user by username/stage_name
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('id, stage_name')
        .ilike('stage_name', newMemberUsername.trim())
        .maybeSingle();

      if (userError || !userData) {
        toast.error('User not found');
        return;
      }

      // Check if user already has a TCNN role
      const { data: existingRole } = await supabase
        .from('tcnn_role_assignments')
        .select('id')
        .eq('user_id', userData.id)
        .maybeSingle();

      if (existingRole) {
        toast.error('User already has a TCNN role');
        return;
      }

      // Assign role
      const { error: assignError } = await supabase
        .from('tcnn_role_assignments')
        .insert({
          user_id: userData.id,
          role: newMemberRole,
          assigned_by: user?.id
        });

      if (assignError) {
        // Try RPC as fallback
        const { data: rpcData, error: rpcError } = await supabase.rpc('manage_tcnn_role', {
          p_user_id: userData.id,
          p_role: newMemberRole,
          p_action: 'assign'
        });

        if (rpcError) throw rpcError;
        if (!rpcData?.success) {
          toast.error(rpcData?.error || 'Failed to assign role');
          return;
        }
      }

      toast.success(`Assigned ${roleLabels[newMemberRole]} role to ${userData.stage_name}`);
      setShowAssignDialog(false);
      setNewMemberUsername('');
      setNewMemberRole('journalist');
      loadMembers();
    } catch (error) {
      console.error('Error assigning role:', error);
      toast.error('Failed to assign role');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveRole = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName}'s TCNN role?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tcnn_role_assignments')
        .delete()
        .eq('id', memberId);

      if (error) {
        // Try RPC as fallback
        const member = members.find(m => m.id === memberId);
        if (member) {
          const { error: rpcError } = await supabase.rpc('manage_tcnn_role', {
            p_user_id: member.user_id,
            p_role: member.role,
            p_action: 'remove'
          });

          if (rpcError) throw rpcError;
        }
      }

      toast.success(`Removed ${memberName}'s TCNN role`);
      loadMembers();
    } catch (error) {
      console.error('Error removing role:', error);
      toast.error('Failed to remove role');
    }
  };

  const filteredMembers = members.filter(member =>
    member.profile.stage_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.profile.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedMembers = {
    chief_news_caster: filteredMembers.filter(m => m.role === 'chief_news_caster'),
    news_caster: filteredMembers.filter(m => m.role === 'news_caster'),
    journalist: filteredMembers.filter(m => m.role === 'journalist')
  };

  if (!isChiefNewsCaster) {
    return (
      <Card className="bg-slate-900/50 border-white/10 p-8 text-center">
        <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Access Denied</h3>
        <p className="text-gray-400">
          Only Chief News Casters can manage TCNN roles.
        </p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Crown className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{chiefCount}/3</p>
              <p className="text-sm text-gray-400">Chief News Casters</p>
            </div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Mic className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{groupedMembers.news_caster.length}</p>
              <p className="text-sm text-gray-400">News Casters</p>
            </div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <PenTool className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{groupedMembers.journalist.length}</p>
              <p className="text-sm text-gray-400">Journalists</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search team members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800 border-white/10"
          />
        </div>
        <Button
          onClick={() => setShowAssignDialog(true)}
          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Assign Role
        </Button>
      </div>

      {/* Team Members List */}
      <div className="space-y-6">
        {(['chief_news_caster', 'news_caster', 'journalist'] as const).map((role) => (
          groupedMembers[role].length > 0 && (
            <div key={role}>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                {(() => {
                  const Icon = roleIcons[role];
                  return <Icon className="w-5 h-5" />;
                })()}
                {roleLabels[role]}s ({groupedMembers[role].length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groupedMembers[role].map((member) => (
                  <Card key={member.id} className="bg-slate-900/50 border-white/10 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {member.profile.avatar_url ? (
                          <img
                            src={member.profile.avatar_url}
                            alt={member.profile.stage_name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center">
                            <Users className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-white">{member.profile.stage_name}</p>
                          <p className="text-xs text-gray-500">
                            Since {new Date(member.assigned_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {role !== 'chief_news_caster' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveRole(member.id, member.profile.stage_name)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )
        ))}

        {filteredMembers.length === 0 && (
          <Card className="bg-slate-900/50 border-white/10 p-8 text-center">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">
              {searchQuery ? 'No members found matching your search' : 'No TCNN team members yet'}
            </p>
          </Card>
        )}
      </div>

      {/* Assign Role Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="bg-slate-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-400" />
              Assign TCNN Role
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Username</label>
              <Input
                placeholder="Enter user's stage name"
                value={newMemberUsername}
                onChange={(e) => setNewMemberUsername(e.target.value)}
                className="bg-slate-800 border-white/10"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">Role</label>
              <Select
                value={newMemberRole}
                onValueChange={(value: 'journalist' | 'news_caster' | 'chief_news_caster') => 
                  setNewMemberRole(value)
                }
              >
                <SelectTrigger className="bg-slate-800 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-white/10">
                  <SelectItem value="journalist">
                    <span className="flex items-center gap-2">
                      <PenTool className="w-4 h-4" />
                      Journalist
                    </span>
                  </SelectItem>
                  <SelectItem value="news_caster">
                    <span className="flex items-center gap-2">
                      <Mic className="w-4 h-4" />
                      News Caster
                    </span>
                  </SelectItem>
                  <SelectItem 
                    value="chief_news_caster"
                    disabled={chiefCount >= 3}
                  >
                    <span className="flex items-center gap-2">
                      <Crown className="w-4 h-4" />
                      Chief News Caster {chiefCount >= 3 && '(Max reached)'}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newMemberRole === 'chief_news_caster' && chiefCount >= 3 && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-400">
                  Maximum of 3 Chief News Casters allowed. Remove an existing Chief first.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowAssignDialog(false)}
                className="flex-1 border-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssignRole}
                disabled={isAssigning || !newMemberUsername.trim() || (newMemberRole === 'chief_news_caster' && chiefCount >= 3)}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500"
              >
                {isAssigning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Assign Role'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
