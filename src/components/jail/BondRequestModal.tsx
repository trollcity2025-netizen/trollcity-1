import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { DollarSign, Users, Send, X, CheckCircle, Clock } from 'lucide-react';

interface Follower {
  id: string;
  username: string;
  avatar_url: string;
  troll_coins: number;
}

interface BondRequest {
  id: string;
  requester_id: string;
  amount: number;
  status: string;
  created_at: string;
}

interface Props {
  inmateId: string;
  onClose?: () => void;
}

export default function BondRequestModal({ inmateId, onClose }: Props) {
  const { user, profile } = useAuthStore();
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFollower, setSelectedFollower] = useState<Follower | null>(null);
  const [requestAmount, setRequestAmount] = useState(100);
  const [requestMessage, setRequestMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [existingRequests, setExistingRequests] = useState<BondRequest[]>([]);

  useEffect(() => {
    if (user) {
      fetchFollowers();
      fetchExistingRequests();
    }
  }, [user, inmateId]);

  const fetchFollowers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_followers')
        .select(`
          follower_id,
          following_id,
          follower:user_profiles!user_followers_follower_id_fkey(id, username, avatar_url, troll_coins)
        `)
        .eq('following_id', inmateId);

      if (error) throw error;

      const followersList = (data || []).map((d: any) => d.follower).filter(Boolean);
      setFollowers(followersList);
    } catch (err) {
      console.error('Error fetching followers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('bond_requests')
        .select('*')
        .eq('inmate_id', inmateId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setExistingRequests(data || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
    }
  };

  const handleSendRequest = async () => {
    if (!user || !selectedFollower) return;

    if (selectedFollower.troll_coins < requestAmount) {
      toast.error('Follower does not have enough Troll Coins');
      return;
    }

    if (!confirm(`Send bond request for ${requestAmount} TC to ${selectedFollower.username}?`)) return;

    try {
      setSending(true);

      // Create bond request
      const { error } = await supabase
        .from('bond_requests')
        .insert({
          inmate_id: inmateId,
          requester_id: selectedFollower.id,
          amount: requestAmount,
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Update inmate's pending request status
      await supabase
        .from('user_profiles')
        .update({ has_pending_bond_request: true })
        .eq('id', inmateId);

      // Create notification for the follower
      await supabase
        .from('jail_notifications')
        .insert({
          user_id: selectedFollower.id,
          notification_type: 'bond_request',
          title: 'Bond Request',
          message: `@${profile?.username || 'Someone'} is requesting ${requestAmount} TC for bond. Message: ${requestMessage || 'None'}`,
          data: {
            inmate_id: inmateId,
            amount: requestAmount,
            message: requestMessage
          }
        });

      toast.success('Bond request sent!');
      setSelectedFollower(null);
      setRequestMessage('');
      fetchExistingRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send request');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-green-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-400" />
          Request Bond from Followers
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Existing Requests */}
      {existingRequests.length > 0 && (
        <div className="bg-gray-900/30 border border-gray-700 rounded-lg p-3">
          <p className="text-sm text-gray-400 mb-2">Recent Requests</p>
          <div className="space-y-2">
            {existingRequests.slice(0, 3).map((req) => (
              <div key={req.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{req.amount} TC</span>
                <span className={`flex items-center gap-1 text-xs ${
                  req.status === 'pending' ? 'text-yellow-400' :
                  req.status === 'accepted' ? 'text-green-400' :
                  req.status === 'rejected' ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {req.status === 'pending' && <Clock className="w-3 h-3" />}
                  {req.status === 'accepted' && <CheckCircle className="w-3 h-3" />}
                  {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Followers */}
      {followers.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No followers to request from</p>
          <p className="text-xs mt-1">Build your following to request bond assistance</p>
        </div>
      ) : (
        <>
          {/* Select Follower */}
          {!selectedFollower ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-400">Select a follower to request from:</p>
              {followers.slice(0, 5).map((follower) => (
                <button
                  key={follower.id}
                  onClick={() => setSelectedFollower(follower)}
                  className="w-full flex items-center gap-3 p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors"
                >
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
                    {follower.avatar_url ? (
                      <img src={follower.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold">{follower.username.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium">{follower.username}</p>
                    <p className="text-xs text-gray-400">{follower.troll_coins} TC</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            /* Request Form */
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-2 bg-gray-800/30 rounded-lg">
                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold">{selectedFollower.username.charAt(0)}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">{selectedFollower.username}</p>
                  <p className="text-xs text-gray-400">{selectedFollower.troll_coins} TC available</p>
                </div>
                <button onClick={() => setSelectedFollower(null)} className="text-gray-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-sm text-gray-400">Amount to Request</label>
                <input
                  type="number"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(parseInt(e.target.value) || 0)}
                  min={10}
                  max={selectedFollower.troll_coins}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white mt-1"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400">Message (Optional)</label>
                <textarea
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  placeholder="Add a message to your request..."
                  className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white mt-1 h-16"
                />
              </div>

              <button
                onClick={handleSendRequest}
                disabled={sending || requestAmount <= 0 || requestAmount > selectedFollower.troll_coins}
                className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          )}
        </>
      )}

      <p className="text-xs text-gray-500 text-center">
        Requests go directly to your bond when accepted
      </p>
    </div>
  );
}