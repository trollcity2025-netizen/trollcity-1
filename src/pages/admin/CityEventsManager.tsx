import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Users,
  Trophy,
  Gift,
  Play,
  Clock,
  TrendingUp,
  Star,
  Zap,
  Plus,
  Edit,
  Trash2,
  Eye,
  Settings,
  BarChart3,
  X
} from 'lucide-react';
import { supabase, UserRole } from '../../lib/supabase';
import RequireRole from '../../components/RequireRole';

interface CityEvent {
  id: string;
  event_type: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  global_announcement: boolean;
  participation_count: number;
  created_at: string;
}

interface StreamRanking {
  id: string;
  stream_id: string;
  final_score: number;
  rank_position: number;
  viewer_count: number;
  gift_velocity: number;
  engagement_score: number;
  creator_reputation: number;
  stream?: {
    title: string;
    category: string;
    broadcaster_id: string;
    broadcaster?: { username: string };
  };
}

export default function CityEventsManager() {
  const [activeTab, setActiveTab] = useState('events');
  const [events, setEvents] = useState<CityEvent[]>([]);
  const [streamRankings, setStreamRankings] = useState<StreamRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CityEvent | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);

      if (activeTab === 'events') {
        const { data } = await supabase
          .from('city_events')
          .select('*')
          .order('start_time', { ascending: false })
          .limit(50);

        setEvents(data || []);
      } else if (activeTab === 'ranking') {
        const { data } = await supabase
          .from('stream_ranking')
          .select(`
            *,
            stream:streams(
              title,
              category,
              broadcaster_id,
              broadcaster:user_profiles(username)
            )
          `)
          .order('final_score', { ascending: false })
          .limit(50);

        setStreamRankings(data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createEvent = async (eventData: any) => {
    try {
      await supabase.rpc('create_city_event', {
        p_event_type: eventData.event_type,
        p_title: eventData.title,
        p_description: eventData.description,
        p_start_time: eventData.start_time,
        p_end_time: eventData.end_time,
        p_global_announcement: eventData.global_announcement,
        p_event_config: eventData.event_config || {},
        p_rewards_config: eventData.rewards_config || {},
        p_created_by: (await supabase.auth.getUser()).data.user?.id
      });

      await loadData();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Error creating event. Please try again.');
    }
  };

  const updateEventStatus = async (eventId: string, isActive: boolean) => {
    try {
      await supabase
        .from('city_events')
        .update({ is_active: isActive })
        .eq('id', eventId);

      await loadData();
    } catch (error) {
      console.error('Error updating event:', error);
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      await supabase
        .from('city_events')
        .delete()
        .eq('id', eventId);

      await loadData();
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Error deleting event. Please try again.');
    }
  };

  const calculateRankings = async () => {
    try {
      await supabase.rpc('calculate_stream_ranking');
      await loadData();
    } catch (error) {
      console.error('Error calculating rankings:', error);
      alert('Error calculating rankings. Please try again.');
    }
  };

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case 'global_boost': return <Zap className="w-5 h-5 text-yellow-400" />;
      case 'coin_rain': return <Gift className="w-5 h-5 text-green-400" />;
      case 'special_stream': return <Play className="w-5 h-5 text-blue-400" />;
      case 'holiday_event': return <Calendar className="w-5 h-5 text-red-400" />;
      case 'competition': return <Trophy className="w-5 h-5 text-purple-400" />;
      default: return <Star className="w-5 h-5 text-gray-400" />;
    }
  };

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'global_boost': return 'border-yellow-500/20 bg-yellow-900/20';
      case 'coin_rain': return 'border-green-500/20 bg-green-900/20';
      case 'special_stream': return 'border-blue-500/20 bg-blue-900/20';
      case 'holiday_event': return 'border-red-500/20 bg-red-900/20';
      case 'competition': return 'border-purple-500/20 bg-purple-900/20';
      default: return 'border-gray-500/20 bg-gray-900/20';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="animate-pulse">Loading city events...</div>
      </div>
    );
  }

  return (
    <RequireRole roles={UserRole.ADMIN}>
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6 pt-16 lg:pt-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">City Events & Discovery</h1>
              <p className="text-gray-400">Manage city-wide events and stream discovery ranking</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-zinc-800 p-1 rounded-lg">
            {[
              { id: 'events', name: 'City Events', icon: Calendar },
              { id: 'ranking', name: 'Stream Ranking', icon: TrendingUp }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-zinc-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.name}
              </button>
            ))}
          </div>

          {/* Content */}
          {activeTab === 'events' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">City Events</h2>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Event
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {events.map((event) => (
                  <div key={event.id} className={`border-l-4 p-4 rounded-r-lg ${getEventTypeColor(event.event_type)}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getEventTypeIcon(event.event_type)}
                        <span className="font-semibold">{event.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {event.is_active && (
                          <span className="px-2 py-1 bg-green-600 text-xs rounded">Active</span>
                        )}
                        <div className="flex gap-1">
                          <button
                            onClick={() => updateEventStatus(event.id, !event.is_active)}
                            className={`p-1 rounded ${event.is_active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                            title={event.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {event.is_active ? <Eye className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => setEditingEvent(event)}
                            className="p-1 bg-blue-600 hover:bg-blue-700 rounded"
                            title="Edit"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => deleteEvent(event.id)}
                            className="p-1 bg-red-600 hover:bg-red-700 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-gray-300 mb-3 line-clamp-2">{event.description}</p>

                    <div className="space-y-1 text-xs text-gray-400">
                      <div className="flex justify-between">
                        <span>Start:</span>
                        <span>{new Date(event.start_time).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>End:</span>
                        <span>{new Date(event.end_time).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Participants:</span>
                        <span>{event.participation_count}</span>
                      </div>
                      {event.global_announcement && (
                        <div className="text-yellow-400 font-semibold">Global Announcement</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'ranking' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Stream Discovery Ranking</h2>
                <button
                  onClick={calculateRankings}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  Recalculate Rankings
                </button>
              </div>

              <div className="bg-zinc-900/50 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-zinc-800">
                    <tr>
                      <th className="px-4 py-3 text-left">Rank</th>
                      <th className="px-4 py-3 text-left">Stream</th>
                      <th className="px-4 py-3 text-left">Broadcaster</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">Viewers</th>
                      <th className="px-4 py-3 text-left">Score</th>
                      <th className="px-4 py-3 text-left">Breakdown</th>
                    </tr>
                  </thead>
                  <tbody>
                    {streamRankings.map((ranking, index) => (
                      <tr key={ranking.id} className="border-t border-zinc-700">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              index < 3 ? 'bg-yellow-600' :
                              index < 10 ? 'bg-blue-600' : 'bg-gray-600'
                            }`}>
                              #{ranking.rank_position || index + 1}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{ranking.stream?.title || 'Unknown'}</div>
                        </td>
                        <td className="px-4 py-3">{ranking.stream?.broadcaster?.username || 'Unknown'}</td>
                        <td className="px-4 py-3 capitalize">{ranking.stream?.category || 'N/A'}</td>
                        <td className="px-4 py-3">{ranking.viewer_count}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-green-400">
                            {ranking.final_score?.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs space-y-1">
                            <div>Gifts: {ranking.gift_velocity?.toFixed(1)}</div>
                            <div>Engage: {ranking.engagement_score?.toFixed(1)}</div>
                            <div>Rep: {ranking.creator_reputation?.toFixed(1)}</div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-zinc-900/50 rounded-lg p-6">
                <h3 className="text-lg font-bold mb-4">Ranking Algorithm</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-2">Score Components</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Viewer Count:</span>
                        <span className="text-blue-400">0-20 pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Gift Velocity:</span>
                        <span className="text-green-400">0-25 pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Engagement:</span>
                        <span className="text-purple-400">0-15 pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Trending:</span>
                        <span className="text-orange-400">0-15 pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Freshness:</span>
                        <span className="text-cyan-400">0-10 pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Creator Rep:</span>
                        <span className="text-yellow-400">0-15 pts</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">How It Works</h4>
                    <div className="text-sm text-gray-300 space-y-2">
                      <p>• Rankings update every 5 minutes automatically</p>
                      <p>• Higher scores appear first in discovery</p>
                      <p>• Fresh streams get bonus points</p>
                      <p>• Creator reputation influences visibility</p>
                      <p>• User preferences can filter results</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create/Edit Event Modal */}
          {(showCreateModal || editingEvent) && (
            <EventModal
              event={editingEvent}
              onSave={editingEvent ? (data) => updateEventStatus(editingEvent.id, data.is_active) : createEvent}
              onClose={() => {
                setShowCreateModal(false);
                setEditingEvent(null);
              }}
            />
          )}
        </div>
      </div>
    </RequireRole>
  );
}

// Event Modal Component
function EventModal({ event, onSave, onClose }: {
  event: CityEvent | null;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    event_type: 'global_boost',
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    global_announcement: false,
    is_active: false,
    event_config: {},
    rewards_config: {}
  });

  useEffect(() => {
    if (event) {
      setFormData({
        event_type: event.event_type,
        title: event.title,
        description: event.description,
        start_time: new Date(event.start_time).toISOString().slice(0, 16),
        end_time: new Date(event.end_time).toISOString().slice(0, 16),
        global_announcement: event.global_announcement,
        is_active: event.is_active,
        event_config: {},
        rewards_config: {}
      });
    } else {
      setFormData({
        event_type: 'global_boost',
        title: '',
        description: '',
        start_time: new Date(Date.now() + 3600000).toISOString().slice(0, 16), // 1 hour from now
        end_time: new Date(Date.now() + 7200000).toISOString().slice(0, 16), // 2 hours from now
        global_announcement: false,
        is_active: false,
        event_config: {},
        rewards_config: {}
      });
    }
  }, [event]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">{event ? 'Edit Event' : 'Create New Event'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Event Type</label>
            <select
              value={formData.event_type}
              onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            >
              <option value="global_boost">Global Boost</option>
              <option value="coin_rain">Coin Rain</option>
              <option value="special_stream">Special Stream</option>
              <option value="holiday_event">Holiday Event</option>
              <option value="competition">Competition</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Start Time</label>
              <input
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">End Time</label>
              <input
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.global_announcement}
                onChange={(e) => setFormData({ ...formData, global_announcement: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Global Announcement</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Active</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
            >
              {event ? 'Update' : 'Create'} Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}