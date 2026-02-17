import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { 
  Send, 
  Clock, 
  MessageSquare, 
  Calendar,
  Trash2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface ScheduledAnnouncement {
  id: string;
  message: string;
  scheduled_time: string;
  created_by: string;
  is_sent: boolean;
  created_at: string;
}

interface AdminBroadcast {
  id: string;
  message: string;
  admin_id: string;
  created_at: string;
}

const Announcements: React.FC = () => {
  const { profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'immediate' | 'broadcast' | 'scheduled' | 'history'>('immediate');
  
  // Form states
  const [immediateMessage, setImmediateMessage] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [scheduledMessage, setScheduledMessage] = useState('');
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [targetAudience, setTargetAudience] = useState<'all' | 'broadcasters' | 'officers' | 'officers_secretary' | 'specific_broadcaster'>('all');
  const [broadcasterSearch, setBroadcasterSearch] = useState('');
  const [broadcasters, setBroadcasters] = useState<{ id: string; username: string }[]>([]);
  const [selectedBroadcaster, setSelectedBroadcaster] = useState<{ id: string; username: string } | null>(null);
  
  // Loading states
  const [sending, setSending] = useState(false);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Data states
  const [scheduledAnnouncements, setScheduledAnnouncements] = useState<ScheduledAnnouncement[]>([]);
  const [broadcastHistory, setBroadcastHistory] = useState<AdminBroadcast[]>([]);
  
  // Time frame filter
  const [timeFrame, setTimeFrame] = useState<'all' | '1day' | '1week'>('all');
  const [deletingAll, setDeletingAll] = useState(false);
  
  // Load scheduled announcements on mount
  useEffect(() => {
    loadScheduledAnnouncements();
    loadBroadcastHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (targetAudience === 'specific_broadcaster' && broadcasterSearch.length > 2) {
        const searchBroadcasters = async () => {
            try {
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('id, username')
                    .eq('role', 'broadcaster')
                    .ilike('username', `%${broadcasterSearch}%`)
                    .limit(10);
                if (error) throw error;
                setBroadcasters(data || []);
            } catch (error) {
                console.error('Error searching broadcasters:', error);
                toast.error('Failed to search for broadcasters');
            }
        };
        searchBroadcasters();
    } else {
        setBroadcasters([]);
    }
}, [broadcasterSearch, targetAudience]);

  const loadScheduledAnnouncements = async () => {
    setLoadingScheduled(true);
    try {
      const { data, error } = await supabase
        .from('scheduled_announcements')
        .select('*')
        .order('scheduled_time', { ascending: true });

      if (error) throw error;
      setScheduledAnnouncements(data || []);
    } catch (error) {
      console.error('Error loading scheduled announcements:', error);
      toast.error('Failed to load scheduled announcements');
    } finally {
      setLoadingScheduled(false);
    }
  };

  const loadBroadcastHistory = async () => {
    setLoadingHistory(true);
    try {
      let query = supabase
        .from('admin_broadcasts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Apply time frame filter
      const now = new Date();
      if (timeFrame === '1day') {
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        query = query.gte('created_at', oneDayAgo.toISOString());
      } else if (timeFrame === '1week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        query = query.gte('created_at', oneWeekAgo.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setBroadcastHistory(data || []);
    } catch (error) {
      console.error('Error loading broadcast history:', error);
      toast.error('Failed to load broadcast history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const sendImmediateAnnouncement = async () => {
    if (!immediateMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setSending(true);
    try {
      let userIds: string[] = [];

      if (targetAudience === 'specific_broadcaster') {
        if (!selectedBroadcaster) {
            toast.error('Please select a broadcaster');
            setSending(false);
            return;
        }
        userIds = [selectedBroadcaster.id];
      } else if (targetAudience === 'officers_secretary') {
        // Fetch officers and secretaries combined
        const { data: officers } = await supabase
            .from('user_profiles')
            .select('id')
            .in('role', ['troll_officer', 'lead_troll_officer', 'secretary']);
            
        const { data: assignments } = await supabase
            .from('secretary_assignments')
            .select('secretary_id');

        const officerIds = officers?.map(u => u.id) || [];
        const secretaryIds = assignments?.map(a => a.secretary_id) || [];
        userIds = Array.from(new Set([...officerIds, ...secretaryIds]));
        
        if (userIds.length === 0) {
            toast.error('No officers or secretaries found');
            setSending(false);
            return;
        }
      } else {
        // Get all user IDs based on target audience
        let query = supabase.from('user_profiles').select('id');
        
        if (targetAudience === 'broadcasters') {
            query = query.eq('role', 'broadcaster');
        } else if (targetAudience === 'officers') {
            query = query.in('role', ['troll_officer', 'lead_troll_officer']);
        }
        // For 'all', we don't filter

        const { data: users, error: userError } = await query;
        
        if (userError) throw userError;
        
        if (!users || users.length === 0) {
            toast.error('No users found for the selected audience');
            setSending(false);
            return;
        }

        userIds = users.map(user => user.id);
      }

      // Call the edge function to send the announcement
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) throw new Error("Not logged in");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-announcement`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: '📢 Admin Announcement',
            body: immediateMessage,
            user_ids: userIds,
          }),
        }
      );

      const out = await res.json();

      if (!res.ok) {
        console.error("Edge function error:", out);
        throw new Error(out?.message || "Failed to send announcement");
      }

      console.log("Announcement sent:", out);
      alert(`✅ Announcement sent to ${out.count} users!`);
      setImmediateMessage('');
    } catch (error) {
      console.error("Error sending immediate announcement:", error);
      toast.error("Failed to send announcement");
    } finally {
      setSending(false);
    }
  };

  const sendBroadcastAnnouncement = async () => {
    if (!broadcastMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from('admin_broadcasts')
        .insert([{
          message: broadcastMessage,
          admin_id: profile?.id,
        }]);

      if (error) throw error;

      toast.success('Broadcast announcement sent');
      setBroadcastMessage('');
      loadBroadcastHistory();
    } catch (error) {
      console.error('Error sending broadcast announcement:', error);
      toast.error('Failed to send broadcast announcement');
    } finally {
      setSending(false);
    }
  };

  const scheduleAnnouncement = async () => {
    if (!scheduledMessage.trim() || !scheduledDateTime) {
      toast.error('Please enter a message and scheduled time');
      return;
    }

    const scheduledTime = new Date(scheduledDateTime);
    if (scheduledTime <= new Date()) {
      toast.error('Scheduled time must be in the future');
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from('scheduled_announcements')
        .insert([{
          message: scheduledMessage,
          scheduled_time: scheduledTime.toISOString(),
          created_by: profile?.id,
        }]);

      if (error) throw error;

      toast.success('Announcement scheduled successfully');
      setScheduledMessage('');
      setScheduledDateTime('');
      loadScheduledAnnouncements();
    } catch (error) {
      console.error('Error scheduling announcement:', error);
      toast.error('Failed to schedule announcement');
    } finally {
      setSending(false);
    }
  };

  const deleteScheduledAnnouncement = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduled announcement?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('scheduled_announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Scheduled announcement deleted');
      loadScheduledAnnouncements();
    } catch (error) {
      console.error('Error deleting scheduled announcement:', error);
      toast.error('Failed to delete scheduled announcement');
    }
  };

  const deleteBroadcast = async (id: string) => {
    if (!confirm('Are you sure you want to delete this broadcast?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('admin_broadcasts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Broadcast deleted');
      loadBroadcastHistory();
    } catch (error) {
      console.error('Error deleting broadcast:', error);
      toast.error('Failed to delete broadcast');
    }
  };

  const deleteAllBroadcasts = async () => {
    if (!confirm('Are you sure you want to DELETE ALL broadcasts? This cannot be undone!')) {
      return;
    }
    
    if (!confirm('This will permanently delete all broadcasts. Continue?')) {
      return;
    }

    setDeletingAll(true);
    try {
      // Get all broadcast IDs
      const { data: broadcasts, error: fetchError } = await supabase
        .from('admin_broadcasts')
        .select('id');
      
      if (fetchError) throw fetchError;
      
      if (!broadcasts || broadcasts.length === 0) {
        toast.info('No broadcasts to delete');
        return;
      }

      // Delete all broadcasts in batches
      const batchSize = 100;
      let deletedCount = 0;
      
      for (let i = 0; i < broadcasts.length; i += batchSize) {
        const batch = broadcasts.slice(i, i + batchSize);
        const ids = batch.map(b => b.id);
        
        const { error: deleteError } = await supabase
          .from('admin_broadcasts')
          .delete()
          .in('id', ids);
          
        if (deleteError) throw deleteError;
        deletedCount += ids.length;
      }

      toast.success(`Deleted ${deletedCount} broadcasts`);
      loadBroadcastHistory();
    } catch (error) {
      console.error('Error deleting all broadcasts:', error);
      toast.error('Failed to delete all broadcasts');
    } finally {
      setDeletingAll(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusIcon = (isSent: boolean, scheduledTime: string) => {
    if (isSent) {
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    }
    if (new Date(scheduledTime) <= new Date()) {
      return <AlertCircle className="w-4 h-4 text-yellow-400" />;
    }
    return <Clock className="w-4 h-4 text-blue-400" />;
  };

  const getStatusText = (isSent: boolean, scheduledTime: string) => {
    if (isSent) return 'Sent';
    if (new Date(scheduledTime) <= new Date()) return 'Pending';
    return 'Scheduled';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">📢 Announcements Management</h1>
          <p className="text-gray-400">
            Send immediate notifications, create broadcast messages, and schedule future announcements
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8 bg-black/40 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('immediate')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'immediate'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Send className="w-4 h-4 inline mr-2" />
            Immediate
          </button>
          <button
            onClick={() => setActiveTab('broadcast')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'broadcast'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            Broadcast
          </button>
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'scheduled'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-2" />
            Scheduled
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Calendar className="w-4 h-4 inline mr-2" />
            History
          </button>
        </div>

        {/* Immediate Announcements Tab */}
        {activeTab === 'immediate' && (
          <div className="bg-black/60 border border-purple-600/30 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Send Immediate Notification</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Target Audience</label>
                <select
                  value={targetAudience}
                  onChange={(e) => {
                      setTargetAudience(e.target.value as any);
                      setSelectedBroadcaster(null);
                      setBroadcasterSearch('');
                  }}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2"
                >
                  <option value="all">All Users</option>
                  <option value="broadcasters">Broadcasters Only</option>
                  <option value="officers">Officers Only</option>
                  <option value="officers_secretary">Officers & Secretary</option>
                  <option value="specific_broadcaster">Specific Broadcaster</option>
                </select>
              </div>

              {targetAudience === 'specific_broadcaster' && (
                  <div>
                      <label className="block text-sm font-medium mb-2">Search Broadcaster</label>
                      <input
                          type="text"
                          value={broadcasterSearch}
                          onChange={(e) => {
                              setBroadcasterSearch(e.target.value);
                              setSelectedBroadcaster(null);
                          }}
                          placeholder="Search by username..."
                          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2"
                      />
                      {broadcasters.length > 0 && !selectedBroadcaster && (
                          <ul className="bg-gray-900 border border-gray-700 rounded-lg mt-2 max-h-48 overflow-y-auto">
                              {broadcasters.map((broadcaster) => (
                                  <li
                                      key={broadcaster.id}
                                      onClick={() => {
                                          setSelectedBroadcaster(broadcaster);
                                          setBroadcasterSearch(broadcaster.username);
                                          setBroadcasters([]);
                                      }}
                                      className="px-4 py-2 cursor-pointer hover:bg-gray-800"
                                  >
                                      {broadcaster.username}
                                  </li>
                              ))}
                          </ul>
                      )}
                  </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Message</label>
                <textarea
                  value={immediateMessage}
                  onChange={(e) => setImmediateMessage(e.target.value)}
                  placeholder="Enter your announcement message..."
                  rows={4}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 resize-none"
                />
              </div>

              <button
                onClick={sendImmediateAnnouncement}
                disabled={sending || !immediateMessage.trim()}
                className="flex items-center px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                <Send className="w-4 h-4 mr-2" />
                {sending ? 'Sending...' : 'Send Immediate Notification'}
              </button>
            </div>
          </div>
        )}

        {/* Broadcast Announcements Tab */}
        {activeTab === 'broadcast' && (
          <div className="bg-black/60 border border-purple-600/30 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Send Broadcast Message</h2>
            <p className="text-gray-400 mb-4">
              Broadcast messages appear in real-time across all live streams and user feeds
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Message</label>
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Enter your broadcast message..."
                  rows={4}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 resize-none"
                />
              </div>

              <button
                onClick={sendBroadcastAnnouncement}
                disabled={sending || !broadcastMessage.trim()}
                className="flex items-center px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                {sending ? 'Sending...' : 'Send Broadcast'}
              </button>
            </div>
          </div>
        )}

        {/* Scheduled Announcements Tab */}
        {activeTab === 'scheduled' && (
          <div className="space-y-6">
            {/* Create Scheduled Announcement */}
            <div className="bg-black/60 border border-purple-600/30 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4">Schedule New Announcement</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Message</label>
                  <textarea
                    value={scheduledMessage}
                    onChange={(e) => setScheduledMessage(e.target.value)}
                    placeholder="Enter your scheduled announcement message..."
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Scheduled Time</label>
                  <input
                    type="datetime-local"
                    value={scheduledDateTime}
                    onChange={(e) => setScheduledDateTime(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2"
                  />
                </div>

                <button
                  onClick={scheduleAnnouncement}
                  disabled={sending || !scheduledMessage.trim() || !scheduledDateTime}
                  className="flex items-center px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  {sending ? 'Scheduling...' : 'Schedule Announcement'}
                </button>
              </div>
            </div>

            {/* Scheduled Announcements List */}
            <div className="bg-black/60 border border-purple-600/30 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Scheduled Announcements</h2>
                <button
                  onClick={loadScheduledAnnouncements}
                  disabled={loadingScheduled}
                  className="text-purple-400 hover:text-purple-300"
                >
                  {loadingScheduled ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {loadingScheduled ? (
                <div className="text-center py-8 text-gray-400">Loading scheduled announcements...</div>
              ) : scheduledAnnouncements.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No scheduled announcements</div>
              ) : (
                <div className="space-y-3">
                  {scheduledAnnouncements.map((announcement) => (
                    <div
                      key={announcement.id}
                      className="bg-gray-800/50 border border-gray-600 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusIcon(announcement.is_sent, announcement.scheduled_time)}
                            <span className="text-sm font-medium">
                              {getStatusText(announcement.is_sent, announcement.scheduled_time)}
                            </span>
                            <span className="text-gray-400 text-sm">
                              {formatDateTime(announcement.scheduled_time)}
                            </span>
                          </div>
                          <p className="text-white">{announcement.message}</p>
                          <p className="text-gray-400 text-sm mt-2">
                            Created: {formatDateTime(announcement.created_at)}
                          </p>
                        </div>
                        {!announcement.is_sent && (
                          <button
                            onClick={() => deleteScheduledAnnouncement(announcement.id)}
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-black/60 border border-purple-600/30 rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="text-xl font-semibold">Broadcast History</h2>
              
              {/* Time Frame Filter */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Time Frame:</span>
                <select
                  value={timeFrame}
                  onChange={(e) => {
                    setTimeFrame(e.target.value as any);
                    loadBroadcastHistory();
                  }}
                  className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="all">All Time</option>
                  <option value="1day">Last 24 Hours</option>
                  <option value="1week">Last 7 Days</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={loadBroadcastHistory}
                disabled={loadingHistory}
                className="text-purple-400 hover:text-purple-300 text-sm"
              >
                {loadingHistory ? 'Loading...' : 'Refresh'}
              </button>
              
              {broadcastHistory.length > 0 && (
                <button
                  onClick={deleteAllBroadcasts}
                  disabled={deletingAll}
                  className="ml-auto text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  {deletingAll ? 'Deleting...' : 'Delete All'}
                </button>
              )}
            </div>

            {loadingHistory ? (
              <div className="text-center py-8 text-gray-400">Loading broadcast history...</div>
            ) : broadcastHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No broadcast history found</div>
            ) : (
              <>
                <div className="text-sm text-gray-400 mb-3">
                  Showing {broadcastHistory.length} broadcast{broadcastHistory.length !== 1 ? 's' : ''}
                </div>
                <div className="space-y-3">
                  {broadcastHistory.map((broadcast) => (
                    <div
                      key={broadcast.id}
                      className="bg-gray-800/50 border border-gray-600 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="w-4 h-4 text-blue-400" />
                          <span className="text-sm text-gray-400">
                            {formatDateTime(broadcast.created_at)}
                          </span>
                        </div>
                        <button
                          onClick={() => deleteBroadcast(broadcast.id)}
                          className="text-red-400 hover:text-red-300 p-1"
                          title="Delete broadcast"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-white">{broadcast.message}</p>
                      <p className="text-gray-400 text-sm mt-2">
                        Admin ID: {broadcast.admin_id}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Announcements;