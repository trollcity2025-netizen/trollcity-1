import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Layers, Clock, DollarSign, User, Calendar, ArrowRight } from 'lucide-react';

interface PayoutBatch {
  id: string;
  week_end: string;
  payout_date: string;
  status: 'open' | 'locked' | 'processing' | 'completed' | 'cancelled';
  total_requests: number;
  total_usd: number;
  created_at: string;
}

interface PayoutRequest {
  id: string;
  user_id: string;
  coin_amount: number;
  cash_amount: number;
  bonus_amount: number;
  status: string;
  created_at: string;
  user_profiles: {
    username: string;
    display_name: string;
    payout_paypal_email: string;
  };
}

const PayoutBatches = () => {
  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      // Query to get batches with counts and sums
      const { data: batchesData, error } = await supabase
        .from('payout_batches')
        .select('*')
        .order('week_end', { ascending: false });

      if (error) throw error;

      // Augment with stats
      const augmentedBatches = await Promise.all((batchesData || []).map(async (batch) => {
        const { data: stats, error: _statsError } = await supabase
          .from('payout_requests')
          .select('cash_amount, bonus_amount', { count: 'exact' })
          .eq('batch_id', batch.id);
        
        const total_usd = (stats || []).reduce((sum, r) => sum + Number(r.cash_amount) + Number(r.bonus_amount), 0);
        return {
          ...batch,
          total_requests: stats?.length || 0,
          total_usd
        };
      }));

      setBatches(augmentedBatches);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const fetchBatchRequests = async (batchId: string) => {
    setRequestsLoading(true);
    setSelectedBatch(batchId);
    try {
      const { data, error } = await supabase
        .from('payout_requests')
        .select('*, user_profiles(username, display_name, payout_paypal_email)')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setRequestsLoading(false);
    }
  };

  const updateBatchStatus = async (batchId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('payout_batches')
        .update({ status: newStatus })
        .eq('id', batchId);

      if (error) throw error;

      // If marking as completed, we should also update the requests
      if (newStatus === 'completed') {
        const { error: reqError } = await supabase
          .from('payout_requests')
          .update({ status: 'paid' })
          .eq('batch_id', batchId)
          .eq('status', 'processing');
        
        if (reqError) console.error('Error updating requests to paid:', reqError);
      }

      toast.success(`Batch marked as ${newStatus}`);
      fetchBatches();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const processPayPalPayout = async (batchId: string) => {
    if (!window.confirm('Are you sure you want to trigger the PayPal Payout API for this entire batch? This will send real money.')) {
      return;
    }

    setProcessing(true);
    const toastId = toast.loading('Sending payouts via PayPal...');

    try {
      const { data, error } = await supabase.functions.invoke('process-payout-batch', {
        body: { batchId }
      });

      if (error) throw error;

      toast.success(`Successfully sent ${data.processedCount} payouts via PayPal!`, { id: toastId });
      fetchBatches();
      fetchBatchRequests(batchId);
    } catch (error: any) {
      console.error('PayPal processing error:', error);
      toast.error(error.message || 'Failed to process PayPal payouts', { id: toastId });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-white">Loading Payout Batches...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto text-white">
      <div className="flex items-center gap-3 mb-8">
        <Layers className="w-8 h-8 text-troll-green" />
        <h1 className="text-3xl font-bold">Friday Payout Batches</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Batches List */}
        <div className="lg:col-span-4 space-y-4">
          <h2 className="text-xl font-semibold mb-4">Weekly Batches</h2>
          {batches.map(batch => (
            <div 
              key={batch.id} 
              onClick={() => fetchBatchRequests(batch.id)}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                selectedBatch === batch.id 
                  ? 'border-troll-green bg-troll-green/10 ring-1 ring-troll-green' 
                  : 'border-purple-700/50 bg-black/40 hover:border-purple-500'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  <span className="font-bold">Week Ending {new Date(batch.week_end).toLocaleDateString()}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  batch.status === 'completed' ? 'bg-troll-green text-black' :
                  batch.status === 'processing' ? 'bg-blue-500 text-white' : 'bg-yellow-500 text-black'
                }`}>
                  {batch.status}
                </span>
              </div>
              
              <div className="flex justify-between text-sm text-gray-400">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" /> {batch.total_requests} requests
                </div>
                <div className="flex items-center gap-1 text-troll-gold font-bold">
                  <DollarSign className="w-3 h-3" /> {batch.total_usd.toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Batch Details */}
        <div className="lg:col-span-8">
          {selectedBatch ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  Batch Details
                  <ArrowRight className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-400 text-sm font-normal">
                    {batches.find(b => b.id === selectedBatch)?.id.slice(0, 8)}...
                  </span>
                </h2>
                <div className="flex gap-2">
                  {batches.find(b => b.id === selectedBatch)?.status === 'open' && (
                    <button 
                      onClick={() => processPayPalPayout(selectedBatch)}
                      disabled={processing}
                      className="bg-troll-gold hover:bg-yellow-600 text-black px-4 py-1 rounded text-sm font-bold flex items-center gap-2"
                    >
                      <DollarSign className="w-4 h-4" />
                      Send via PayPal API
                    </button>
                  )}
                  <button 
                    onClick={() => updateBatchStatus(selectedBatch, 'processing')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-bold"
                  >
                    Mark Processing
                  </button>
                  <button 
                    onClick={() => updateBatchStatus(selectedBatch, 'completed')}
                    className="bg-troll-green hover:bg-troll-green-dark text-black px-3 py-1 rounded text-sm font-bold"
                  >
                    Mark Paid
                  </button>
                </div>
              </div>

              {requestsLoading ? (
                <div className="p-12 text-center text-gray-500">Loading requests...</div>
              ) : (
                <div className="bg-black/40 rounded-lg border border-purple-700/50 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-purple-900/30 text-xs uppercase text-gray-400">
                      <tr>
                        <th className="px-4 py-3">Creator</th>
                        <th className="px-4 py-3">PayPal Email</th>
                        <th className="px-4 py-3">Coins</th>
                        <th className="px-4 py-3">Base USD</th>
                        <th className="px-4 py-3">Bonus (2.5%)</th>
                        <th className="px-4 py-3">Total</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {requests.map(req => (
                        <tr key={req.id} className="border-t border-purple-700/30">
                          <td className="px-4 py-3">
                            <div className="font-bold">{req.user_profiles?.display_name}</div>
                            <div className="text-xs text-gray-500">@{req.user_profiles?.username}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono bg-black/40 px-2 py-1 rounded">
                                {req.user_profiles?.payout_paypal_email || 'NOT SET'}
                              </span>
                              {req.user_profiles?.payout_paypal_email && (
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(req.user_profiles.payout_paypal_email);
                                    toast.success('Email copied');
                                  }}
                                  className="text-[10px] text-purple-400 hover:text-white"
                                >
                                  Copy
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono">{req.coin_amount.toLocaleString()}</td>
                          <td className="px-4 py-3">${req.cash_amount.toFixed(2)}</td>
                          <td className="px-4 py-3 text-troll-green">
                            {req.bonus_amount > 0 ? `+$${req.bonus_amount.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-4 py-3 font-bold text-troll-gold">
                            ${(Number(req.cash_amount) + Number(req.bonus_amount)).toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-bold uppercase text-gray-400">{req.status}</span>
                          </td>
                        </tr>
                      ))}
                      {requests.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No requests in this batch</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 bg-black/20 rounded-xl border border-dashed border-purple-700/50 text-gray-500">
              <Clock className="w-12 h-12 mb-4 opacity-20" />
              <p>Select a batch from the left to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PayoutBatches;
