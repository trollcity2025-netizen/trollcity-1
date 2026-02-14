import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useChatStore } from '../../lib/chatStore';
import { formatDuration } from '../../utils/time';
import { 
  Users, 
  Clock, 
  Unlock, 
  MessageCircle, 
  Search,
  Calendar,
  TrendingDown
} from 'lucide-react';
import { toast } from 'sonner';

interface Inmate {
  user_id: string;
  release_time: string;
  reason: string;
  created_at: string;
  profile: {
    username: string;
    avatar_url: string | null;
  };
}

const AdminJailManagement: React.FC = () => {
  const [inmates, setInmates] = useState<Inmate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInmate, setSelectedInmate] = useState<Inmate | null>(null);
  const [reductionMinutes, setReductionMinutes] = useState(30);
  const openChat = useChatStore((s) => s.openChatBubble);

  const fetchInmates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('jail')
        .select(`
          user_id,
          release_time,
          reason,
          created_at,
          user_profiles (username, avatar_url)
        `)
        .gt('release_time', new Date().toISOString())
        .order('release_time', { ascending: true });

      if (error) throw error;
      
      const formattedData = (data as any[])?.map(item => ({
        ...item,
        profile: item.user_profiles
      })) || [];
      
      setInmates(formattedData);
    } catch (error: any) {
      console.error('Error fetching inmates:', error);
      toast.error('Failed to load inmates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInmates();

    const subscription = supabase
      .channel('jail_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jail' },
        () => fetchInmates()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const handleRelease = async (userId: string) => {
    if (!window.confirm('Are you sure you want to release this inmate immediately?')) return;

    try {
      const { error } = await supabase
        .from('jail')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      toast.success('Inmate released successfully');
      fetchInmates();
    } catch (error: any) {
      toast.error(error.message || 'Failed to release inmate');
    }
  };

  const handleReduceSentence = async (inmate: Inmate) => {
    try {
      const currentRelease = new Date(inmate.release_time);
      const newRelease = new Date(currentRelease.getTime() - reductionMinutes * 60000);
      
      // Don't allow negative sentence (just release if it goes past now)
      const now = new Date();
      if (newRelease <= now) {
        return handleRelease(inmate.user_id);
      }

      const { error } = await supabase
        .from('jail')
        .update({ release_time: newRelease.toISOString() })
        .eq('user_id', inmate.user_id);

      if (error) throw error;
      toast.success(`Sentence reduced by ${reductionMinutes} minutes`);
      setSelectedInmate(null);
      fetchInmates();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reduce sentence');
    }
  };

  const filteredInmates = inmates.filter(inmate => 
    inmate.profile?.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inmate.reason?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-red-500" />
            Jail Management
          </h1>
          <p className="text-gray-400 mt-1">Monitor and manage current city inmates</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search inmates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 w-full md:w-64"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
        </div>
      ) : filteredInmates.length === 0 ? (
        <div className="bg-gray-800/50 rounded-xl p-12 text-center border border-gray-700">
          <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-300">No active inmates</h3>
          <p className="text-gray-500 mt-2">The city jail is currently empty.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredInmates.map((inmate) => {
            const timeRemaining = new Date(inmate.release_time).getTime() - new Date().getTime();
            
            return (
              <div key={inmate.user_id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-red-500/50 transition-colors">
                <div className="p-5 flex items-start gap-4">
                  <img 
                    src={inmate.profile?.avatar_url || 'https://via.placeholder.com/150'} 
                    alt={inmate.profile?.username}
                    className="w-16 h-16 rounded-full border-2 border-red-900/50 object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-xl font-bold text-white truncate">{inmate.profile?.username}</h3>
                      <span className="px-2 py-1 bg-red-900/30 text-red-400 text-xs font-bold rounded uppercase">Incarcerated</span>
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-2 italic">&quot;{inmate.reason || 'No reason provided'}&quot;</p>
                  </div>
                </div>

                <div className="px-5 py-4 bg-black/20 border-t border-gray-700/50 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-500 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Incarcerated Since
                    </p>
                    <p className="text-sm text-gray-300">{new Date(inmate.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-500 mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Time Remaining
                    </p>
                    <p className="text-sm font-mono text-red-400">
                      {timeRemaining > 0 ? formatDuration(timeRemaining) : 'Released'}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-gray-900/50 border-t border-gray-700 flex flex-wrap gap-2">
                  <button
                    onClick={() => openChat(inmate.user_id, inmate.profile?.username, inmate.profile?.avatar_url)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    <MessageCircle className="w-4 h-4" /> Chat
                  </button>
                  <button
                    onClick={() => setSelectedInmate(inmate)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    <TrendingDown className="w-4 h-4" /> Reduce
                  </button>
                  <button
                    onClick={() => handleRelease(inmate.user_id)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    <Unlock className="w-4 h-4" /> Release
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reduce Sentence Modal */}
      {selectedInmate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Reduce Sentence</h2>
                <p className="text-sm text-gray-400">For {selectedInmate.profile?.username}</p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Reduction Amount (Minutes)</label>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 30, 60, 120].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setReductionMinutes(mins)}
                      className={`py-2 rounded-lg text-sm font-bold transition-all ${
                        reductionMinutes === mins 
                          ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' 
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative mt-2">
                <input
                  type="number"
                  value={reductionMinutes}
                  onChange={(e) => setReductionMinutes(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="Custom minutes..."
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold uppercase tracking-wider">Minutes</span>
              </div>

              <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                  <span>Current Release</span>
                  <span>{new Date(selectedInmate.release_time).toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-amber-500">
                  <span>New Release</span>
                  <span>{new Date(new Date(selectedInmate.release_time).getTime() - reductionMinutes * 60000).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedInmate(null)}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReduceSentence(selectedInmate)}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-amber-900/20"
              >
                Apply Reduction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminJailManagement;
