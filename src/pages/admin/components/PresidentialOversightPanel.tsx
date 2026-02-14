import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { usePresidentSystem } from '../../../hooks/usePresidentSystem';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { toast } from 'sonner';
import { Shield, UserMinus, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  target_id: string | null;
  details: any;
  created_at: string;
  actor?: {
    username: string;
    avatar_url: string;
  };
}

export default function PresidentialOversightPanel() {
  const { currentPresident, currentVP, currentElection, refresh } = usePresidentSystem();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('president_audit_logs')
        .select(`
          *,
          actor:user_profiles!actor_id(username, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (err: any) {
      console.error('Error fetching audit logs:', err);
      toast.error('Failed to load audit logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const handleEmergencyRemove = async (role: 'president' | 'vice_president', userId: string) => {
    if (!window.confirm(`⚠️ EMERGENCY ACTION\n\nAre you sure you want to IMMEDIATELY remove the current ${role.replace('_', ' ')}?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      // 1. Remove the role grant
      const { error: deleteError } = await supabase
        .from('user_role_grants')
        .delete()
        .eq('user_id', userId)
        .eq('role_id', (
            await supabase.from('system_roles').select('id').eq('name', role).single()
        ).data?.id);

      if (deleteError) throw deleteError;

      // 2. Log the action (using our own admin logging if available, or just console for now)
      console.log(`Admin removed ${role}: ${userId}`);
      toast.success(`${role.replace('_', ' ')} removed successfully`);
      
      refresh(); // Refresh system state
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove official');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Shield className="w-6 h-6 text-yellow-500" />
                Presidential Oversight
            </h2>
            <p className="text-slate-400">Monitor and manage elected officials</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { refresh(); fetchAuditLogs(); }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current Administration */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle>Current Administration</CardTitle>
            <CardDescription>Active elected officials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* President */}
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 relative group">
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {currentPresident && (
                        <Button 
                            variant="destructive" 
                            size="sm" 
                            className="h-7 text-xs"
                            onClick={() => handleEmergencyRemove('president', currentPresident.user_id)} 
                        >
                            <UserMinus className="w-3 h-3 mr-1" />
                            Remove
                        </Button>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center text-yellow-500 font-bold text-xl">
                        P
                    </div>
                    <div>
                        <div className="text-xs text-yellow-500 uppercase font-bold tracking-wider">President</div>
                        {currentPresident ? (
                            <>
                                <div className="font-bold text-white text-lg">{currentPresident.username}</div>
                                <div className="text-xs text-slate-400">Term ends: {currentElection ? format(new Date(currentElection.ends_at), 'MMM d, yyyy') : 'N/A'}</div>
                            </>
                        ) : (
                            <div className="text-slate-500 italic">Vacant</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Vice President */}
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 relative group">
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {currentVP && (
                        <Button 
                            variant="destructive" 
                            size="sm" 
                            className="h-7 text-xs"
                            onClick={() => handleEmergencyRemove('vice_president', currentVP.id)}
                        >
                            <UserMinus className="w-3 h-3 mr-1" />
                            Remove
                        </Button>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-700/20 border border-slate-600/50 flex items-center justify-center text-slate-400 font-bold text-xl">
                        VP
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Vice President</div>
                        {currentVP ? (
                            <div className="font-bold text-white text-lg">{currentVP.appointee?.username || 'Unknown'}</div>
                        ) : (
                            <div className="text-slate-500 italic">Vacant</div>
                        )}
                    </div>
                </div>
            </div>
          </CardContent>
        </Card>

        {/* Audit Log */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
                <span>Audit Log</span>
                <Badge variant="outline" className="ml-2">{auditLogs.length} Actions</Badge>
            </CardTitle>
            <CardDescription>Recent presidential actions</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
                {loadingLogs ? (
                    <div className="text-center py-8 text-slate-500">Loading logs...</div>
                ) : auditLogs.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">No actions recorded</div>
                ) : (
                    <div className="space-y-4">
                        {auditLogs.map((log) => (
                            <div key={log.id} className="text-sm border-l-2 border-slate-700 pl-4 py-1">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-slate-200">{log.action?.replace(/_/g, ' ').toUpperCase()}</span>
                                    <span className="text-xs text-slate-500">{format(new Date(log.created_at), 'MMM d, HH:mm')}</span>
                                </div>
                                <div className="text-slate-400 mb-1">
                                    by <span className="text-slate-300">{log.actor?.username || 'Unknown'}</span>
                                </div>
                                <div className="text-xs text-slate-500 font-mono bg-black/20 p-2 rounded">
                                    {JSON.stringify(log.details, null, 2)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
