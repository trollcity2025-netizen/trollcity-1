import React, { useState, useEffect, useCallback } from 'react';
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
import { useAuthStore } from '../../lib/store'; // Import useAuthStore
import { toast } from 'sonner';
import RequireRole from '../../components/RequireRole';
import { formatFullDateTime12hr } from '../../utils/timeFormat';

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

interface ScheduleSlot {
  id: string;
  officer_id: string;
  officer?: { username: string };
  shift_date: string;
  shift_start_time: string;
  shift_end_time: string;
  status: string;
}

export default function OfficerOperations() {
  const user = useAuthStore((state) => state.user); // Get user from store
  const [activeTab, setActiveTab] = useState('shifts');
  const [shifts, setShifts] = useState<OfficerShift[]>([]);
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);
  const [patrols, setPatrols] = useState<OfficerPatrol[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [panicAlerts, setPanicAlerts] = useState<PanicAlert[]>([]);
  const [officers, setOfficers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  
  // Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [newPatrolType, setNewPatrolType] = useState('general_patrol');
  const [newPatrolInstructions, setNewPatrolInstructions] = useState('');
  // const [newPatrolPriority, setNewPatrolPriority] = useState(1);

  const loadShifts = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_officer_shifts', limit: 50 }
      });
      if (error) throw error;
      
      const mappedData = (data.shifts || []).map((s: any) => ({
        id: s.id,
        officer_id: s.officer_id,
        officer: s.officer,
        shift_start: s.clock_in,
        shift_end: s.clock_out,
        shift_type: s.shift_type || 'Standard',
        status: s.clock_out ? 'completed' : 'active',
        patrol_area: s.patrol_area || 'General',
        owc_earned: s.coins_earned || 0
      }));
      setShifts(mappedData);
    } catch (err) {
      console.error('Error loading shifts:', err);
      // toast.error('Failed to load shifts');
    }
  }, []);

  const loadSchedule = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_officer_shift_slots' }
      });
      if (error) throw error;
      setScheduleSlots(data.slots || []);
    } catch (err) {
      console.error('Error loading schedule:', err);
    }
  }, []);

  const loadPatrols = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_officer_patrols', limit: 50 }
      });
      if (error) throw error;
      setPatrols(data.patrols || []);
    } catch (err) {
      console.error('Error loading patrols:', err);
    }
  }, []);

  const loadChatMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_officer_chat_messages', limit: 100 }
      });
      if (error) throw error;
      setChatMessages(data.messages || []);
    } catch (err) {
      console.error('Error loading chat:', err);
    }
  }, []);

  const loadPanicAlerts = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_panic_alerts' }
      });
      if (error) throw error;
      setPanicAlerts(data.alerts || []);
    } catch (err) {
      console.error('Error loading panic alerts:', err);
    }
  }, []);

  const loadOfficers = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_active_officers' }
      });
      if (error) throw error;
      setOfficers(data.officers || []);
    } catch (err) {
      console.error('Error loading officers:', err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([
        loadShifts(),
        loadSchedule(),
        loadPatrols(),
        loadChatMessages(),
        loadPanicAlerts(),
        loadOfficers()
      ]);
      setLoading(false);
    };
    init();

    // Polling every 30s
    const interval = setInterval(() => {
      loadShifts();
      loadSchedule();
      loadPatrols();
      loadChatMessages();
      loadPanicAlerts();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadShifts, loadSchedule, loadPatrols, loadChatMessages, loadPanicAlerts, loadOfficers]);

  // Realtime subscription for chat
  useEffect(() => {
    const channel = supabase
      .channel('officer-chat-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'officer_chat_messages'
        },
        () => {
          loadChatMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadChatMessages]);


  const syncMessages = async () => {
    if (!window.confirm('Sync legacy direct messages into the new inbox?')) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'sync_legacy_messages' }
      });

      if (error) throw error;
      toast.success(`Synced ${data.count || 0} legacy messages`);
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error('Failed to sync messages: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Note: _createShift was used internally or via console? Keeping it just in case, but updated to hub.
  const _createShift = async (officerId: string, startTime: string, endTime: string, patrolArea: string) => {
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: { 
            action: 'create_officer_shift',
            officerId,
            startTime,
            endTime,
            patrolArea
        }
      });
      if (error) throw error;
      await loadShifts();
      toast.success('Shift created');
    } catch (error) {
      console.error('Error creating shift:', error);
      toast.error('Failed to create shift');
    }
  };

  const handleAssignPatrol = async () => {
    if (!selectedOfficer) {
        toast.error('Select an officer');
        return;
    }
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
            action: 'assign_officer_patrol',
            officerId: selectedOfficer,
            patrolType: newPatrolType,
            instructions: newPatrolInstructions
            // Priority is not in the assign_officer_patrol RPC/Hub action currently?
            // The RPC definition in hub was: p_officer_id, p_patrol_type, p_instructions.
            // Priority might be default or missing in RPC. We'll send what we can.
        }
      });

      if (error) throw error;
      
      toast.success('Patrol assigned');
      setShowAssignModal(false);
      setNewPatrolInstructions('');
      setSelectedOfficer('');
      await loadPatrols();
    } catch (error) {
      console.error('Error assigning patrol:', error);
      toast.error('Failed to assign patrol');
    }
  };

  const sendChatMessage = async () => {
    if (!newMessage.trim() || !user) return;

    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: { 
          action: 'send_officer_chat', 
          message: newMessage.trim()
        }
      });

      if (error) throw error;

      setNewMessage('');
      await loadChatMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const assignPanicAlert = async (alertId: string, officerId: string) => {
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
            action: 'assign_panic_alert',
            alertId,
            officerId
        }
      });
      if (error) throw error;

      toast.success('Alert assigned');
      await loadPanicAlerts();
    } catch (error) {
      console.error('Error assigning panic alert:', error);
      toast.error('Failed to assign alert');
    }
  };

  const resolvePanicAlert = async (alertId: string) => {
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
            action: 'resolve_panic_alert',
            alertId
        }
      });
      if (error) throw error;

      toast.success('Alert resolved');
      await loadPanicAlerts();
    } catch (error) {
      console.error('Error resolving panic alert:', error);
      toast.error('Failed to resolve alert');
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

  if (loading && officers.length === 0 && shifts.length === 0) {
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
              Sync TCPS
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-zinc-800 p-1 rounded-lg overflow-x-auto">
            {[
              { id: 'shifts', name: 'Shift Logs', icon: Calendar },
              { id: 'schedule', name: 'Master Schedule', icon: Calendar },
              { id: 'patrols', name: 'Patrol Assignments', icon: MapPin },
              { id: 'chat', name: 'Officer Chat', icon: MessageSquare },
              { id: 'panic', name: 'Panic Alerts', icon: AlertTriangle }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
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
                <h2 className="text-xl font-bold">Officer Shifts</h2>
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
                          {formatFullDateTime12hr(shift.shift_start)} - {formatFullDateTime12hr(shift.shift_end)}
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
                    {shifts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          No shifts found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Master Schedule</h2>
              </div>
              <div className="bg-zinc-900/50 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-zinc-800">
                    <tr>
                      <th className="px-4 py-3 text-left">Officer</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Time</th>
                      <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleSlots.map((slot) => (
                      <tr key={slot.id} className="border-t border-zinc-700">
                        <td className="px-4 py-3">{slot.officer?.username || 'Unknown'}</td>
                        <td className="px-4 py-3">{new Date(slot.shift_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                           {slot.shift_start_time} - {slot.shift_end_time}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            slot.status === 'booked' ? 'bg-green-600' : 'bg-gray-600'
                          }`}>
                            {slot.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {scheduleSlots.length === 0 && (
                      <tr>
                         <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                           No active schedule slots found
                         </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'patrols' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Active Patrol Assignments</h2>
                <button 
                  onClick={() => setShowAssignModal(true)}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center gap-2"
                >
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
                {patrols.length === 0 && (
                  <div className="col-span-full text-center py-8 text-gray-500 bg-zinc-900/50 rounded-lg">
                    No active patrols
                  </div>
                )}
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
                  {chatMessages.length === 0 && (
                    <div className="text-center text-gray-500 py-12">
                      No messages yet. Start the conversation!
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Send message to officers..."
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
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
                            className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-white"
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
          {/* Assign Patrol Modal */}
          {showAssignModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
              <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-lg max-w-md w-full space-y-4">
                <h3 className="text-xl font-bold">Assign New Patrol</h3>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Officer</label>
                  <select
                    className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-white"
                    value={selectedOfficer}
                    onChange={(e) => setSelectedOfficer(e.target.value)}
                  >
                    <option value="">Select Officer...</option>
                    {officers.map(o => (
                      <option key={o.id} value={o.id}>{o.username}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Patrol Type</label>
                  <select
                    className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-white"
                    value={newPatrolType}
                    onChange={(e) => setNewPatrolType(e.target.value)}
                  >
                    <option value="general_patrol">General Patrol</option>
                    <option value="chat_monitoring">Chat Monitoring</option>
                    <option value="stream_audit">Stream Audit</option>
                    <option value="user_support">User Support</option>
                    <option value="investigation">Investigation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Priority</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(p => (
                      <button
                        key={p}
                        onClick={() => setNewPatrolPriority(p)}
                        className={`w-8 h-8 rounded flex items-center justify-center ${
                          newPatrolPriority === p 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Instructions</label>
                  <textarea
                    className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 h-24 text-white"
                    value={newPatrolInstructions}
                    onChange={(e) => setNewPatrolInstructions(e.target.value)}
                    placeholder="Specific instructions for this patrol..."
                  />
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setShowAssignModal(false)}
                    className="px-4 py-2 text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssignPatrol}
                    disabled={!selectedOfficer}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white disabled:opacity-50"
                  >
                    Assign Patrol
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </RequireRole>
  );
}
