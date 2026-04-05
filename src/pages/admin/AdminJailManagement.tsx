import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface JailInmate {
  id: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  reason: string;
  sentenced_by: string;
  sentence_start: string;
  sentence_end: string;
  message_minutes: number;
  message_minutes_remaining: number;
  is_bond_posted: boolean;
  bond_amount: number;
  can_appeal: boolean;
  appeal_status?: string;
  created_at: string;
}

interface JailTransaction {
  id: string;
  inmate_id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

export default function AdminJailManagement() {
  const [inmates, setInmates] = useState<JailInmate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInmate, setSelectedInmate] = useState<JailInmate | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editMinutes, setEditMinutes] = useState(0);
  const [showTransactions, setShowTransactions] = useState(false);
  const [transactions, setTransactions] = useState<JailTransaction[]>([]);

  const loadInmates = async () => {
    try {
      const { data, error } = await supabase
        .from('jail_inmates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInmates(data || []);
    } catch (err: any) {
      console.error('Error loading inmates:', err);
      toast.error('Failed to load inmates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInmates();
  }, []);

  const handleRelease = async (inmate: JailInmate, refundCoins: boolean = false) => {
    try {
      const { error } = await supabase.functions.invoke('admin-jail-actions', {
        body: {
          action: 'release_inmate',
          inmate_id: inmate.id,
          user_id: inmate.user_id,
          refund_coins: refundCoins
        }
      });

      if (error) throw error;
      toast.success(`Inmate ${inmate.username} released${refundCoins ? ' with coin refund' : ''}`);
      loadInmates();
    } catch (err: any) {
      console.error('Error releasing inmate:', err);
      toast.error('Failed to release inmate');
    }
  };

  const handleEditSentence = async () => {
    if (!selectedInmate) return;
    
    try {
      const { error } = await supabase
        .from('jail_inmates')
        .update({ 
          message_minutes: editMinutes,
          message_minutes_remaining: editMinutes
        })
        .eq('id', selectedInmate.id);

      if (error) throw error;
      toast.success('Sentence updated');
      setShowEditModal(false);
      loadInmates();
    } catch (err: any) {
      console.error('Error updating sentence:', err);
      toast.error('Failed to update sentence');
    }
  };

  const handleAssignAttorney = async (inmate: JailInmate, attorneyId: string) => {
    try {
      const { error } = await supabase
        .from('jail_inmates')
        .update({ assigned_attorney_id: attorneyId })
        .eq('id', inmate.id);

      if (error) throw error;
      toast.success('Attorney assigned');
      loadInmates();
    } catch (err: any) {
      console.error('Error assigning attorney:', err);
      toast.error('Failed to assign attorney');
    }
  };

  const loadTransactions = async (inmateId: string) => {
    try {
      const { data, error } = await supabase
        .from('jail_transactions')
        .select('*')
        .eq('inmate_id', inmateId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
      setShowTransactions(true);
    } catch (err: any) {
      console.error('Error loading transactions:', err);
      toast.error('Failed to load transactions');
    }
  };

  const formatTimeRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Jail Management</h1>
          <div className="bg-black/40 rounded-lg p-8 text-center">Loading inmates...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Jail Management</h1>
          <button 
            onClick={loadInmates}
            className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700"
          >
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-black/40 rounded-lg p-4">
            <div className="text-2xl font-bold">{inmates.length}</div>
            <div className="text-gray-400">Total Inmates</div>
          </div>
          <div className="bg-black/40 rounded-lg p-4">
            <div className="text-2xl font-bold">{inmates.filter(i => i.is_bond_posted).length}</div>
            <div className="text-gray-400">With Bond Posted</div>
          </div>
          <div className="bg-black/40 rounded-lg p-4">
            <div className="text-2xl font-bold">{inmates.filter(i => i.can_appeal && i.appeal_status === 'pending').length}</div>
            <div className="text-gray-400">Pending Appeals</div>
          </div>
          <div className="bg-black/40 rounded-lg p-4">
            <div className="text-2xl font-bold">
              {inmates.reduce((acc, i) => acc + (i.message_minutes_remaining || 0), 0)}
            </div>
            <div className="text-gray-400">Total Minutes Remaining</div>
          </div>
        </div>

        {/* Inmates List */}
        <div className="bg-black/40 rounded-lg overflow-hidden">
          {inmates.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No inmates in jail</div>
          ) : (
            <table className="w-full">
              <thead className="bg-black/60">
                <tr>
                  <th className="px-4 py-3 text-left">Inmate</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-left">Sentenced By</th>
                  <th className="px-4 py-3 text-left">Time Remaining</th>
                  <th className="px-4 py-3 text-left">Messages</th>
                  <th className="px-4 py-3 text-left">Bond</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inmates.map((inmate) => (
                  <tr key={inmate.id} className="border-t border-gray-800">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {inmate.avatar_url ? (
                          <img src={inmate.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                            {inmate.username[0].toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium">{inmate.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{inmate.reason}</td>
                    <td className="px-4 py-3 text-gray-300">{inmate.sentenced_by}</td>
                    <td className="px-4 py-3">
                      <span className={new Date(inmate.sentence_end) < new Date() ? 'text-red-400' : 'text-green-400'}>
                        {formatTimeRemaining(inmate.sentence_end)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {inmate.message_minutes_remaining} / {inmate.message_minutes}
                    </td>
                    <td className="px-4 py-3">
                      {inmate.is_bond_posted ? (
                        <span className="text-green-400">{inmate.bond_amount} TC</span>
                      ) : (
                        <span className="text-gray-500">Not posted</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {inmate.appeal_status === 'pending' && (
                        <span className="text-yellow-400 text-sm">Appeal Pending</span>
                      )}
                      {inmate.appeal_status === 'approved' && (
                        <span className="text-green-400 text-sm">Appeal Approved</span>
                      )}
                      {inmate.appeal_status === 'rejected' && (
                        <span className="text-red-400 text-sm">Appeal Rejected</span>
                      )}
                      {!inmate.appeal_status && (
                        <span className="text-gray-500 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => loadTransactions(inmate.id)}
                          className="px-2 py-1 text-xs bg-blue-600 rounded hover:bg-blue-700"
                        >
                          View
                        </button>
                        <button
                          onClick={() => {
                            setSelectedInmate(inmate);
                            setEditMinutes(inmate.message_minutes);
                            setShowEditModal(true);
                          }}
                          className="px-2 py-1 text-xs bg-yellow-600 rounded hover:bg-yellow-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRelease(inmate, false)}
                          className="px-2 py-1 text-xs bg-green-600 rounded hover:bg-green-700"
                        >
                          Release
                        </button>
                        <button
                          onClick={() => handleRelease(inmate, true)}
                          className="px-2 py-1 text-xs bg-red-600 rounded hover:bg-red-700"
                        >
                          Release + Refund
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Edit Modal */}
        {showEditModal && selectedInmate && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-[#1a1a2e] rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Edit Sentence - {selectedInmate.username}</h2>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Message Minutes</label>
                <input
                  type="number"
                  value={editMinutes}
                  onChange={(e) => setEditMinutes(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-white"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleEditSentence}
                  className="flex-1 px-4 py-2 bg-yellow-600 rounded-lg hover:bg-yellow-700"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transactions Modal */}
        {showTransactions && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-[#1a1a2e] rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Jail Transactions</h2>
              {transactions.length === 0 ? (
                <div className="text-gray-400 text-center py-4">No transactions found</div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="bg-black/40 rounded p-3 flex justify-between">
                      <div>
                        <div className="font-medium">{tx.type}</div>
                        <div className="text-sm text-gray-400">{tx.description}</div>
                      </div>
                      <div className="text-right">
                        <div className={tx.amount > 0 ? 'text-green-400' : 'text-red-400'}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount} TC
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(tx.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowTransactions(false)}
                className="w-full mt-4 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}