import React, { useState, useEffect } from 'react';
import {
  Calendar,
  MessageSquare,
  AlertTriangle,
  MapPin,
  CheckCircle,
  Send,
  Shield,
  Radio,
  RefreshCw
} from 'lucide-react';
import { supabase, UserRole } from '../../lib/supabase';
import { toast } from 'sonner';
import RequireRole from '../../components/RequireRole';

interface OfficerShift {
  id: string;
  officer_id: string;
  officer?: { username: string };
  shift_start: string;
  shift_end: string;
  shift_type: string;
  status: string;
  patrol_area: string;
  owc_earned: number;
}

interface OfficerPatrol {
  id: string;
  officer_id: string;
  officer?: { username: string };
  patrol_type: string;
  priority_level: number;
  status: string;
  instructions: string;
  created_at: string;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  sender?: { username: string };
  content: string;
  message_type: string;
  priority: string;
  created_at: string;
}

interface PanicAlert {
  id: string;
  creator_id: string;
  creator?: { username: string };
  alert_type: string;
  severity: string;
  description: string;
  status: string;
  assigned_officer_id?: string;
  assigned_officer?: { username: string };
  created_at: string;
}

export default function OfficerOperations() {
  const [activeTab, setActiveTab] = useState('shifts');
  const [shifts, setShifts] = useState<OfficerShift[]>([]);
  const [patrols, setPatrols] = useState<OfficerPatrol[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [panicAlerts, setPanicAlerts] = useState<PanicAlert[]>([]);
  const [officers, setOfficers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [selectedOfficer, setSelectedOfficer] = useState('');

  const loadShifts = React.useCallback(async () => {
    const { data } = await supabase
      .from('officer_shifts')
      .select(`
        *,
        officer:user_profiles(username)
      `)
      .order('shift_start', { ascending: false })
      .limit(50);
    setShifts(data || []);
  }, []);

  const loadPatrols = React.useCallback(async () => {
    const { data } = await supabase
      .from('officer_patrols')
      .select(`
        *,
        officer:user_profiles(username)
      `)
      .order('created_at', { ascending: false })
      .limit(50);
    setPatrols(data || []);
  }, []);

  const loadChatMessages = React.useCallback(async () => {
    const { data } = await supabase
      .from('officer_chat_messages')
      .select(`
        *,
        sender:user_profiles(username)
      `)
      .order('created_at', { ascending: false })
      .limit(100);
    setChatMessages(data || []);
  }, []);

  const loadPanicAlerts = React.useCallback(async () => {
    const { data } = await supabase
      .from('creator_panic_alerts')
      .select(`
        *,
        creator:user_profiles(username),
        assigned_officer:user_profiles!creator_panic_alerts_assigned_officer_id_fkey(username)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    setPanicAlerts(data || []);
  }, []);

  const loadOfficers = React.useCallback(async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, username')
      .or('role.eq.troll_officer,is_troll_officer.eq.true');
    setOfficers(data || []);
  }, []);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadShifts(),
        loadPatrols(),
        loadChatMessages(),
        loadPanicAlerts(),
        loadOfficers()
      ]);
    } catch (error) {
      console.error('Error loading officer operations data:', error);
    } finally {
      setLoading(false);
    }
  }, [loadShifts, loadPatrols, loadChatMessages, loadPanicAlerts, loadOfficers]);

  useEffect(() => {
    loadData();
    // Set up real-time subscriptions
    const chatChannel = supabase
      .channel('officer-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'officer_chat_messages' }, () => {
        loadChatMessages();
      })
      .subscribe();

    const panicChannel = supabase
      .channel('panic-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'creator_panic_alerts' }, () => {
        loadPanicAlerts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(panicChannel);
    };
  }, [activeTab, loadData, loadChatMessages, loadPanicAlerts]);

  const syncMessages = async () => {
    if (!window.confirm('Sync legacy direct messages into the new inbox?')) return;

    setLoading(true);
    try {
      const { data: legacyData, error: legacyError } = await supabase
        .from('messages')
        .select('id,sender_id,receiver_id,content,created_at,stream_id')
        .is('stream_id', null);

      if (legacyError) throw legacyError;

      if (!legacyData || legacyData.length === 0) {
        toast.error('No legacy direct messages found in messages table');
        setLoading(false);
        return;
      }

      const pairKeys: Record<string, { a: string; b: string }> = {};

      for (const msg of legacyData as any[]) {
        const senderId = msg.sender_id as string | null;
        const receiverId = msg.receiver_id as string | null;
        if (!senderId || !receiverId) continue;
        const a = senderId < receiverId ? senderId : receiverId;
        const b = senderId < receiverId ? receiverId : senderId;
        const key = `${a}:${b}`;
        if (!pairKeys[key]) {
          pairKeys[key] = { a, b };
        }
      }

      const pairEntries = Object.entries(pairKeys);
      const convMap: Record<string, string> = {};

      for (const [key, pair] of pairEntries) {
        const { data: existingMembers, error: membersError } = await supabase
          .from('conversation_members')
          .select('conversation_id,user_id')
          .in('user_id', [pair.a, pair.b]);

        if (membersError) throw membersError;

        let conversationId: string | null = null;

        if (existingMembers && existingMembers.length > 0) {
          const byConv: Record<string, Set<string>> = {};
          for (const row of existingMembers as any[]) {
            const cid = row.conversation_id as string;
            const uid = row.user_id as string;
            if (!byConv[cid]) byConv[cid] = new Set();
            byConv[cid].add(uid);
          }
          const desired = new Set([pair.a, pair.b]);
          for (const [cid, membersSet] of Object.entries(byConv)) {
            if (membersSet.size === desired.size) {
              let match = true;
              for (const uid of membersSet) {
                if (!desired.has(uid)) {
                  match = false;
                  break;
                }
              }
              if (match) {
                conversationId = cid;
                break;
              }
            }
          }
        }

        if (!conversationId) {
          const { data: convData, error: convError } = await supabase
            .from('conversations')
            .insert({ created_by: pair.a })
            .select()
            .single();

          if (convError) throw convError;

          conversationId = (convData as any).id as string;

          const membersPayload = [
            { conversation_id: conversationId, user_id: pair.a, role: 'owner' },
            { conversation_id: conversationId, user_id: pair.b, role: 'member' }
          ];

          const { error: insertMembersError } = await supabase
            .from('conversation_members')
            .insert(membersPayload);

          if (insertMembersError) throw insertMembersError;
        }

        convMap[key] = conversationId;
      }

      let migratedCount = 0;
      const batchSize = 500;
      const legacy = legacyData as any[];

      for (let i = 0; i < legacy.length; i += batchSize) {
        const slice = legacy.slice(i, i + batchSize);
        const rows: any[] = [];

        for (const msg of slice) {
          const senderId = msg.sender_id as string | null;
          const receiverId = msg.receiver_id as string | null;
          const body = msg.content as string | null;
          const createdAt = msg.created_at as string | null;
          if (!senderId || !receiverId || !body) continue;

          const a = senderId < receiverId ? senderId : receiverId;
          const b = senderId < receiverId ? receiverId : senderId;
          const key = `${a}:${b}`;
          const conversationId = convMap[key];
          if (!conversationId) continue;

          rows.push({
            conversation_id: conversationId,
            sender_id: senderId,
            body,
            created_at: createdAt
          });
        }

        if (rows.length === 0) continue;

        const { error: insertError } = await supabase
          .from('conversation_messages')
          .insert(rows);

        if (insertError) throw insertError;

        migratedCount += rows.length;
      }

      toast.success(`Synced ${migratedCount} legacy messages into conversations`);
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error('Failed to sync messages: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const _createShift = async (officerId: string, startTime: string, endTime: string, patrolArea: string) => {
    try {
      await supabase.rpc('create_officer_shift', {
        p_officer_id: officerId,
        p_shift_start: startTime,
        p_shift_end: endTime,
        p_patrol_area: patrolArea
      });
      await loadShifts();
    } catch (error) {
      console.error('Error creating shift:', error);
    }
  };

  const _assignPatrol = async (officerId: string, patrolType: string, instructions: string) => {
    try {
      await supabase.rpc('assign_officer_patrol', {
        p_officer_id: officerId,
        p_patrol_type: patrolType,
        p_instructions: instructions
      });
      await loadPatrols();
    } catch (error) {
      console.error('Error assigning patrol:', error);
    }
  };

  const sendChatMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.rpc('send_officer_chat_message', {
        p_sender_id: user.id,
        p_content: newMessage
      });

      setNewMessage('');
      await loadChatMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const assignPanicAlert = async (alertId: string, officerId: string) => {
    try {
      await supabase
        .from('creator_panic_alerts')
        .update({
          assigned_officer_id: officerId,
          status: 'assigned'
        })
        .eq('id', alertId);

      await loadPanicAlerts();
    } catch (error) {
      console.error('Error assigning panic alert:', error);
    }
  };

  const resolvePanicAlert = async (alertId: string) => {
    try {
      await supabase
        .from('creator_panic_alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', alertId);

      await loadPanicAlerts();
    } catch (error) {
      console.error('Error resolving panic alert:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-400 border-red-500/20 bg-red-900/20';
      case 'high': return 'text-orange-400 border-orange-500/20 bg-orange-900/20';
      case 'normal': return 'text-blue-400 border-blue-500/20 bg-blue-900/20';
      default: return 'text-gray-400 border-gray-500/20 bg-gray-900/20';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 border-red-500/50 bg-red-900/30';
      case 'high': return 'text-orange-400 border-orange-500/50 bg-orange-900/30';
      case 'medium': return 'text-yellow-400 border-yellow-500/50 bg-yellow-900/30';
      default: return 'text-blue-400 border-blue-500/50 bg-blue-900/30';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="animate-pulse">Loading officer operations...</div>
      </div>
    );
  }

  return (
    <RequireRole roles={UserRole.ADMIN}>
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6 pt-16 lg:pt-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Officer Operations</h1>
                <p className="text-gray-400">Shift scheduling, patrol assignments, and emergency response</p>
              </div>
            </div>

            <button
              onClick={syncMessages}
              disabled={loading}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              title="Sync legacy direct messages into new conversations"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Sync Messages
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-zinc-800 p-1 rounded-lg">
            {[
              { id: 'shifts', name: 'Shift Scheduling', icon: Calendar },
              { id: 'patrols', name: 'Patrol Assignments', icon: MapPin },
              { id: 'chat', name: 'Officer Chat', icon: MessageSquare },
              { id: 'panic', name: 'Panic Alerts', icon: AlertTriangle }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-zinc-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.name}
                {tab.id === 'panic' && panicAlerts.length > 0 && (
                  <span className="bg-red-600 text-xs px-1.5 py-0.5 rounded-full">
                    {panicAlerts.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          {activeTab === 'shifts' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Officer Shift Scheduling</h2>
                <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Schedule Shift
                </button>
              </div>

              <div className="bg-zinc-900/50 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-zinc-800">
                    <tr>
                      <th className="px-4 py-3 text-left">Officer</th>
                      <th className="px-4 py-3 text-left">Shift Time</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Area</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">OWC Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((shift) => (
                      <tr key={shift.id} className="border-t border-zinc-700">
                        <td className="px-4 py-3">{shift.officer?.username || 'Unknown'}</td>
                        <td className="px-4 py-3 text-sm">
                          {new Date(shift.shift_start).toLocaleString()} - {new Date(shift.shift_end).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 capitalize">{shift.shift_type}</td>
                        <td className="px-4 py-3 capitalize">{shift.patrol_area || 'General'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            shift.status === 'completed' ? 'bg-green-600' :
                            shift.status === 'active' ? 'bg-blue-600' :
                            shift.status === 'scheduled' ? 'bg-yellow-600' : 'bg-gray-600'
                          }`}>
                            {shift.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-green-400">+{shift.owc_earned}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'patrols' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Active Patrol Assignments</h2>
                <button className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Assign Patrol
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {patrols.map((patrol) => (
                  <div key={patrol.id} className="bg-zinc-900/50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold">{patrol.officer?.username}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        patrol.priority_level >= 4 ? 'bg-red-600' :
                        patrol.priority_level >= 2 ? 'bg-orange-600' : 'bg-blue-600'
                      }`}>
                        Priority {patrol.priority_level}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-400">Type:</span>
                        <span className="ml-2 capitalize">{patrol.patrol_type.replace(/_/g, ' ')}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Status:</span>
                        <span className={`ml-2 px-2 py-1 rounded text-xs ${
                          patrol.status === 'completed' ? 'bg-green-600' :
                          patrol.status === 'in_progress' ? 'bg-blue-600' : 'bg-yellow-600'
                        }`}>
                          {patrol.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {patrol.instructions && (
                        <div>
                          <span className="text-gray-400">Instructions:</span>
                          <p className="ml-2 mt-1 text-xs">{patrol.instructions}</p>
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 mt-3">
                      Assigned {new Date(patrol.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Officer Internal Chat</h2>

              <div className="bg-zinc-900/50 rounded-lg p-4">
                <div className="h-96 overflow-y-auto mb-4 space-y-3">
                  {chatMessages.slice().reverse().map((message) => (
                    <div key={message.id} className={`flex ${getPriorityColor(message.priority)} p-3 rounded-lg`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{message.sender?.username}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(message.created_at).toLocaleString()}
                          </span>
                          {message.priority !== 'normal' && (
                            <span className="text-xs px-2 py-1 bg-red-600 rounded">
                              {message.priority.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm">{message.content}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Send message to officers..."
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={sendChatMessage}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'panic' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Active Panic Alerts</h2>
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">Live Emergency Response</span>
                </div>
              </div>

              {panicAlerts.length === 0 ? (
                <div className="bg-zinc-900/50 rounded-lg p-8 text-center">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">All Clear</h3>
                  <p className="text-gray-400">No active panic alerts at this time.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {panicAlerts.map((alert) => (
                    <div key={alert.id} className={`border-l-4 p-4 rounded-r-lg ${getSeverityColor(alert.severity)}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-red-400" />
                          <span className="font-semibold">{alert.creator?.username}</span>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${
                          alert.severity === 'critical' ? 'bg-red-600' :
                          alert.severity === 'high' ? 'bg-orange-600' : 'bg-yellow-600'
                        }`}>
                          {alert.severity.toUpperCase()}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm mb-3">
                        <div>
                          <span className="text-gray-400">Type:</span>
                          <span className="ml-2 capitalize">{alert.alert_type.replace(/_/g, ' ')}</span>
                        </div>
                        {alert.description && (
                          <div>
                            <span className="text-gray-400">Description:</span>
                            <p className="ml-2 mt-1">{alert.description}</p>
                          </div>
                        )}
                        {alert.assigned_officer && (
                          <div>
                            <span className="text-gray-400">Assigned to:</span>
                            <span className="ml-2 text-green-400">{alert.assigned_officer.username}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {!alert.assigned_officer_id && (
                          <select
                            value={selectedOfficer}
                            onChange={(e) => setSelectedOfficer(e.target.value)}
                            className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm"
                          >
                            <option value="">Assign Officer</option>
                            {officers.map((officer) => (
                              <option key={officer.id} value={officer.id}>
                                {officer.username}
                              </option>
                            ))}
                          </select>
                        )}
                        {!alert.assigned_officer_id && selectedOfficer && (
                          <button
                            onClick={() => assignPanicAlert(alert.id, selectedOfficer)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                          >
                            Assign
                          </button>
                        )}
                        {alert.assigned_officer_id && (
                          <button
                            onClick={() => resolvePanicAlert(alert.id)}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm flex items-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Resolve
                          </button>
                        )}
                      </div>

                      <div className="text-xs text-gray-500 mt-2">
                        Triggered {new Date(alert.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </RequireRole>
  );
}
