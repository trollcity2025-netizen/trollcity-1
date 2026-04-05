import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Lock, Clock, MessageSquare, DollarSign, Search, X, Users, DollarSignIcon, Handshake } from 'lucide-react';
import BondRequestModal from '../components/jail/BondRequestModal';

interface Inmate {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string;
  reason: string;
  sentence_days: number;
  release_time: string;
  bond_amount: number;
  bond_posted: boolean;
  message_minutes: number;
  message_minutes_used: number;
  created_at: string;
}

export default function InmatesPage() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [inmates, setInmates] = useState<Inmate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'inmates' | 'messages' | 'bond'>('inmates');
  const [selectedInmate, setSelectedInmate] = useState<Inmate | null>(null);
  const [messageText, setMessageText] = useState('');
  const [buyingMinutes, setBuyingMinutes] = useState(false);
  const [minutesToBuy, setMinutesToBuy] = useState(1);
  const [postingBond, setPostingBond] = useState(false);
  const [showBondRequest, setShowBondRequest] = useState(false);
  
  const MESSAGE_COST = 10; // 10 troll coins per message
  const MINUTES_PRICE = 50; // 50 troll coins per message minute

  useEffect(() => {
    fetchInmates();
  }, []);

  const fetchInmates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('jail')
        .select(`
          *,
          user:user_profiles!jail_user_id_fkey(username, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out expired jail records
      const now = new Date();
      const validInmates = (data || []).filter((inmate: any) => {
        const releaseTime = new Date(inmate.release_time);
        return releaseTime > now;
      }).map((inmate: any) => ({
        id: inmate.id,
        user_id: inmate.user_id,
        username: inmate.user?.username || 'Unknown',
        avatar_url: inmate.user?.avatar_url || null,
        reason: inmate.reason || 'Pending review',
        sentence_days: inmate.sentence_days || 1,
        release_time: inmate.release_time,
        bond_amount: inmate.bond_amount || 0,
        bond_posted: inmate.bond_posted || false,
        message_minutes: inmate.message_minutes || 1,
        message_minutes_used: inmate.message_minutes_used || 0,
        created_at: inmate.created_at
      }));

      setInmates(validInmates);
    } catch (err) {
      console.error('Error fetching inmates:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatReleaseDate = (releaseTime: string) => {
    const release = new Date(releaseTime);
    const now = new Date();
    const diff = release.getTime() - now.getTime();
    
    if (diff <= 0) return 'Released';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  const getDaysRemaining = (releaseTime: string) => {
    const release = new Date(releaseTime);
    const now = new Date();
    const diff = release.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const handleSendMessage = async () => {
    if (!user || !selectedInmate || !messageText.trim()) return;
    
    if (selectedInmate.message_minutes - selectedInmate.message_minutes_used <= 0) {
      toast.error('No message minutes remaining. Purchase more to send messages.');
      return;
    }

    try {
      const { error } = await supabase
        .from('inmate_messages')
        .insert({
          inmate_id: selectedInmate.user_id,
          sender_id: user.id,
          recipient_id: selectedInmate.user_id,
          message: messageText,
          cost: MESSAGE_COST,
          is_free_message: false
        });

      if (error) throw error;

      // Deduct message minute
      await supabase
        .from('jail')
        .update({ 
          message_minutes_used: selectedInmate.message_minutes_used + 1 
        })
        .eq('id', selectedInmate.id);

      toast.success('Message sent!');
      setMessageText('');
      fetchInmates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    }
  };

  const handleBuyMinutes = async () => {
    if (!user || !selectedInmate) return;

    const totalCost = minutesToBuy * MINUTES_PRICE;
    
    if (!confirm(`Purchase ${minutesToBuy} message minute(s) for ${totalCost} Troll Coins? Proceeds go to Troll City public pool.`)) return;

    try {
      // Check balance
      const { data: balanceData } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', user.id)
        .single();

      if (!balanceData || balanceData.troll_coins < totalCost) {
        toast.error('Insufficient Troll Coins');
        return;
      }

      // Deduct coins from buyer
      await supabase
        .from('user_profiles')
        .update({ troll_coins: balanceData.troll_coins - totalCost })
        .eq('id', user.id);

      // Add minutes to inmate
      await supabase
        .from('jail')
        .update({ 
          message_minutes: (selectedInmate.message_minutes || 0) + minutesToBuy 
        })
        .eq('id', selectedInmate.id);

      // Log transaction - fees go to public pool
      await supabase
        .from('jail_transactions')
        .insert({
          jail_id: selectedInmate.id,
          user_id: user.id,
          transaction_type: 'message_fee',
          amount: totalCost,
          recipient_type: 'public_pool',
          notes: `Message minutes purchase for ${selectedInmate.username}`
        });

      toast.success(`Purchased ${minutesToBuy} message minute(s)! Fee of ${totalCost} TC goes to public pool.`);
      setBuyingMinutes(false);
      fetchInmates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to purchase minutes');
    }
  };

  const handlePostBond = async () => {
    if (!user || !selectedInmate) return;
    
    const bondAmount = selectedInmate.bond_amount || 100;
    
    if (!confirm(`Post bond of ${bondAmount} Troll Coins to release ${selectedInmate.username}? Bond fee goes to admin account.`)) return;

    try {
      // Check balance
      const { data: balanceData } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', user.id)
        .single();

      if (!balanceData || balanceData.troll_coins < bondAmount) {
        toast.error('Insufficient Troll Coins');
        return;
      }

      // Deduct coins - goes to admin
      await supabase
        .from('user_profiles')
        .update({ troll_coins: balanceData.troll_coins - bondAmount })
        .eq('id', user.id);

      // Update jail record
      await supabase
        .from('jail')
        .update({ 
          bond_posted: true,
          bond_posted_by: user.id,
          bond_amount: bondAmount
        })
        .eq('id', selectedInmate.id);

      // Log transaction - bond goes to admin
      await supabase
        .from('jail_transactions')
        .insert({
          jail_id: selectedInmate.id,
          user_id: user.id,
          transaction_type: 'bond',
          amount: bondAmount,
          recipient_type: 'admin',
          notes: `Bond posted for ${selectedInmate.username}`
        });

      // Create notification for inmate
      await supabase
        .from('jail_notifications')
        .insert({
          user_id: selectedInmate.user_id,
          notification_type: 'bond_posted',
          title: 'Bond Posted',
          message: `${user.identity?.email || 'Someone'} posted ${bondAmount} TC bond for your release.`,
          data: { amount: bondAmount, posted_by: user.id }
        });

      toast.success(`Bond of ${bondAmount} TC posted! Goes to admin account.`);
      setPostingBond(false);
      fetchInmates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to post bond');
    }
  };

  const filteredInmates = inmates.filter(inmate =>
    inmate.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inmate.reason?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canMod = profile?.role === 'admin' || 
    profile?.is_admin || 
    profile?.is_troll_officer || 
    profile?.is_lead_officer ||
    profile?.role === 'lead_troll_officer';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center border border-red-500/30">
              <Users className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Inmates</h1>
              <p className="text-gray-400 text-sm">{inmates.length} currently incarcerated</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700 pb-2">
          <button
            onClick={() => setSelectedTab('inmates')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              selectedTab === 'inmates' 
                ? 'bg-red-600/20 text-red-400 border border-red-500/30' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Lock className="w-4 h-4 inline mr-2" />
            Inmates ({inmates.length})
          </button>
          <button
            onClick={() => setSelectedTab('messages')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              selectedTab === 'messages' 
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            Message Minutes
          </button>
          <button
            onClick={() => setSelectedTab('bond')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              selectedTab === 'bond' 
                ? 'bg-green-600/20 text-green-400 border border-green-500/30' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <DollarSign className="w-4 h-4 inline mr-2" />
            Post Bond
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inmates by username or reason..."
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-red-500"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-red-500 rounded-full border-t-transparent"></div>
          </div>
        ) : selectedTab === 'inmates' ? (
          /* Inmates Grid */
          filteredInmates.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No inmates found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredInmates.map((inmate) => (
                <div
                  key={inmate.id}
                  onClick={() => setSelectedInmate(inmate)}
                  className={`bg-gray-800/50 border rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.02] ${
                    selectedInmate?.id === inmate.id 
                      ? 'border-red-500 shadow-lg shadow-red-500/20' 
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {/* Avatar and Username */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
                      {inmate.avatar_url ? (
                        <img src={inmate.avatar_url} alt={inmate.username} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-gray-400">
                          {inmate.username.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{inmate.username}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        incarcerated
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Days Sentenced</span>
                      <span className="font-semibold text-red-400">{inmate.sentence_days} days</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Release Date</span>
                      <span className="font-semibold text-white">
                        {new Date(inmate.release_time).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Time Remaining</span>
                      <span className="font-semibold text-orange-400">
                        {formatReleaseDate(inmate.release_time)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-gray-700">
                      <p className="text-gray-400 text-xs mb-1">Reason</p>
                      <p className="text-sm truncate">{inmate.reason || 'Pending review'}</p>
                    </div>
                    {inmate.bond_posted && (
                      <div className="mt-2 bg-green-900/30 border border-green-500/30 rounded-lg p-2 text-center">
                        <span className="text-green-400 text-sm font-semibold">Bond Posted</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : selectedTab === 'messages' ? (
          /* Message Minutes Tab */
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-400" />
              Purchase Message Minutes
            </h2>
            <p className="text-gray-400 mb-4">
              Inmates can receive messages from outside. Each message costs {MESSAGE_COST} Troll Coins.
              Purchase additional message minutes to allow inmates to communicate with the outside world.
            </p>
            
            {selectedInmate ? (
              <div className="space-y-4">
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400">Selected Inmate</p>
                  <p className="font-bold text-lg">{selectedInmate.username}</p>
                  <p className="text-sm text-gray-400">
                    Remaining Minutes: {selectedInmate.message_minutes - selectedInmate.message_minutes_used}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Minutes to Purchase</label>
                  <div className="flex gap-2">
                    {[1, 2, 5, 10].map(num => (
                      <button
                        key={num}
                        onClick={() => setMinutesToBuy(num)}
                        className={`px-4 py-2 rounded-lg border transition-all ${
                          minutesToBuy === num
                            ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                            : 'border-gray-700 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        {num} {num === 1 ? 'minute' : 'minutes'}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-sm text-gray-400">Total Cost</p>
                  <p className="text-2xl font-bold text-yellow-400">{minutesToBuy * MINUTES_PRICE} Troll Coins</p>
                </div>
                
                <button
                  onClick={handleBuyMinutes}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors"
                >
                  Purchase Minutes
                </button>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Select an inmate to purchase message minutes</p>
            )}
          </div>
        ) : (
          /* Bond Tab */
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              Post Bond
            </h2>
            <p className="text-gray-400 mb-4">
              Post bond to help release an inmate. The bond amount will be held until the inmate's case is resolved.
            </p>
            
            {selectedInmate ? (
              <div className="space-y-4">
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400">Selected Inmate</p>
                  <p className="font-bold text-lg">{selectedInmate.username}</p>
                  <p className="text-sm text-gray-400">
                    Bond Amount: {selectedInmate.bond_amount || 100} Troll Coins
                  </p>
                  {selectedInmate.bond_posted && (
                    <p className="text-green-400 text-sm mt-2">Bond already posted for this inmate</p>
                  )}
                </div>
                
                {!selectedInmate.bond_posted && (
                  <button
                    onClick={handlePostBond}
                    className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors"
                  >
                    Post Bond - {selectedInmate.bond_amount || 100} Troll Coins
                  </button>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Select an inmate to post bond</p>
            )}
          </div>
        )}

        {/* Selected Inmate Detail Panel */}
        {selectedInmate && (
          <div className="fixed right-0 top-0 h-full w-96 bg-gray-900 border-l border-gray-700 p-6 overflow-y-auto z-40 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Inmate Details</h2>
              <button onClick={() => setSelectedInmate(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
                  {selectedInmate.avatar_url ? (
                    <img src={selectedInmate.avatar_url} alt={selectedInmate.username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-gray-400">
                      {selectedInmate.username.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-xl font-bold">{selectedInmate.username}</p>
                  <p className="text-gray-400 text-sm">Incarcerated {new Date(selectedInmate.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Days Sentenced</span>
                  <span className="font-semibold text-red-400">{selectedInmate.sentence_days} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Release Date</span>
                  <span className="font-semibold">{new Date(selectedInmate.release_time).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Time Remaining</span>
                  <span className="font-semibold text-orange-400">{formatReleaseDate(selectedInmate.release_time)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Message Minutes</span>
                  <span className="font-semibold">
                    {selectedInmate.message_minutes - selectedInmate.message_minutes_used} / {selectedInmate.message_minutes}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Bond Status</span>
                  <span className={`font-semibold ${selectedInmate.bond_posted ? 'text-green-400' : 'text-gray-400'}`}>
                    {selectedInmate.bond_posted ? 'Posted' : 'Not Posted'}
                  </span>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Reason for Incarceration</p>
                <p className="font-semibold">{selectedInmate.reason || 'Pending review'}</p>
              </div>

              {/* Action Buttons for Staff */}
              {canMod && (
                <div className="space-y-2 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => navigate(`/troll-court?defendant=${selectedInmate.user_id}`)}
                    className="w-full py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 rounded-lg font-semibold transition-colors"
                  >
                    Summon to Court
                  </button>
                </div>
              )}
              
              {/* Bond Request Button for Friends/Family */}
              <div className="pt-4 border-t border-gray-700">
                <button
                  onClick={() => setShowBondRequest(true)}
                  className="w-full py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-400 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Handshake className="w-4 h-4" />
                  Request Bond from Followers
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bond Request Modal */}
        {showBondRequest && selectedInmate && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
              <BondRequestModal 
                inmateId={selectedInmate.user_id}
                onClose={() => setShowBondRequest(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
