import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  DollarSign, Check, X, Clock, AlertCircle, 
  User, Calendar, MessageSquare, Filter 
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AdminPayouts() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('all');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState('');

  // Fetch pending payouts
  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['adminPayouts', filterStatus],
    queryFn: async () => {
      let query = supabase
        .from('payouts')
        .select(`
          *,
          profiles!inner(username, full_name, level, email, payout_method, square_customer_id, cashapp_tag)
        `)
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  // Fetch payout approval levels
  const { data: approvalLevels = [] } = useQuery({
    queryKey: ['payoutApprovalLevels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payout_approval_levels')
        .select('*')
        .order('level', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  // Approve payout mutation
  const approvePayoutMutation = useMutation({
    mutationFn: async ({ payoutId, notes }) => {
      const { error } = await supabase
        .from('payouts')
        .update({
          approved_by_admin: true,
          approved_at: new Date().toISOString(),
          approval_notes: notes,
          status: 'approved'
        })
        .eq('id', payoutId);
      
      if (error) throw error;
      
      // Process the payout based on method
      await processPayout(payoutId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminPayouts']);
      toast.success('Payout approved and processed!');
      setApprovalNotes('');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to approve payout');
    }
  });

  // Reject payout mutation
  const rejectPayoutMutation = useMutation({
    mutationFn: async ({ payoutId, notes }) => {
      const { error } = await supabase
        .from('payouts')
        .update({
          approved_by_admin: false,
          approved_at: new Date().toISOString(),
          approval_notes: notes,
          status: 'rejected'
        })
        .eq('id', payoutId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminPayouts']);
      toast.success('Payout rejected');
      setRejectionNotes('');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reject payout');
    }
  });

  // Process payout based on method
  const processPayout = async (payoutId) => {
    try {
      const { data: payout } = await supabase
        .from('payouts')
        .select('*')
        .eq('id', payoutId)
        .single();

      if (!payout) throw new Error('Payout not found');

      // Get user's payout config
      const { data: profile } = await supabase
        .from('profiles')
        .select('payout_method, square_customer_id, cashapp_tag')
        .eq('id', payout.user_id)
        .single();

      // Process based on method
      switch (payout.payout_method) {
        case 'square':
          await processSquarePayout(payout, profile);
          break;
        case 'cashapp':
          await processCashAppPayout(payout, profile);
          break;
        default:
          throw new Error('Unsupported payout method');
      }

      // Update payout status
      await supabase
        .from('payouts')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString()
        })
        .eq('id', payoutId);

    } catch (error) {
      console.error('Error processing payout:', error);
      
      // Update payout status to failed
      await supabase
        .from('payouts')
        .update({
          status: 'failed',
          error_message: error.message
        })
        .eq('id', payoutId);
      
      throw error;
    }
  };

  // Process Square payout
  const processSquarePayout = async (payout, profile) => {
    // This would integrate with Square's payout API
    // For now, create a placeholder record
    const { error } = await supabase
      .from('square_payouts')
      .insert({
        user_id: payout.user_id,
        payout_id: payout.id,
        amount: payout.amount,
        square_customer_id: profile.square_customer_id,
        status: 'processing'
      });

    if (error) throw error;
  };

  // Process CashApp payout
  const processCashAppPayout = async (payout, profile) => {
    // This would integrate with CashApp's API
    // For now, create a placeholder record
    const { error } = await supabase
      .from('cashapp_payouts')
      .insert({
        user_id: payout.user_id,
        payout_id: payout.id,
        amount: payout.amount,
        cashapp_tag: profile.cashapp_tag,
        status: 'processing'
      });

    if (error) throw error;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'approved': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      case 'failed': return 'bg-red-600';
      default: return 'bg-gray-500';
    }
  };

  const getMethodIcon = (method) => {
    switch (method) {
      case 'square': return <DollarSign className="w-4 h-4" />;
      case 'cashapp': return <DollarSign className="w-4 h-4" />;
      default: return <DollarSign className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] p-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Payout Management</h1>
          <p className="text-gray-400">Review and process user payout requests</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-[#1a1a24] border-[#2a2a3a] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Payouts</p>
                <p className="text-white text-2xl font-bold">{payouts.length}</p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-400" />
            </div>
          </Card>
          
          <Card className="bg-[#1a1a24] border-[#2a2a3a] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Pending</p>
                <p className="text-white text-2xl font-bold">
                  {payouts.filter(p => p.status === 'pending').length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </Card>
          
          <Card className="bg-[#1a1a24] border-[#2a2a3a] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Approved</p>
                <p className="text-white text-2xl font-bold">
                  {payouts.filter(p => p.status === 'approved').length}
                </p>
              </div>
              <Check className="w-8 h-8 text-blue-400" />
            </div>
          </Card>
          
          <Card className="bg-[#1a1a24] border-[#2a2a3a] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Completed</p>
                <p className="text-white text-2xl font-bold">
                  {payouts.filter(p => p.status === 'completed').length}
                </p>
              </div>
              <Check className="w-8 h-8 text-green-400" />
            </div>
          </Card>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#1a1a24] border-[#2a2a3a] text-white rounded px-3 py-2"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Payouts List */}
        <div className="space-y-4">
          {payouts.length === 0 ? (
            <Card className="bg-[#1a1a24] border-[#2a2a3a] p-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">No payouts found</p>
            </Card>
          ) : (
            payouts.map((payout) => (
              <Card key={payout.id} className="bg-[#1a1a24] border-[#2a2a3a] p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* User Info */}
                    <div className="flex items-center gap-3 mb-4">
                      <User className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-white font-semibold">
                          @{payout.profiles.username} • Level {payout.profiles.level}
                        </p>
                        <p className="text-gray-400 text-sm">{payout.profiles.email}</p>
                      </div>
                    </div>

                    {/* Payout Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Amount</p>
                        <p className="text-white text-lg font-bold">${payout.amount}</p>
                      </div>
                      
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Method</p>
                        <div className="flex items-center gap-2">
                          {getMethodIcon(payout.payout_method)}
                          <span className="text-white capitalize">{payout.payout_method}</span>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Requested</p>
                        <p className="text-white text-sm">
                          {format(new Date(payout.created_at), 'MMM d, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>

                    {/* Payout Details */}
                    <div className="mb-4">
                      <p className="text-gray-400 text-sm mb-1">Payout Details</p>
                      <p className="text-white text-sm">
                        {payout.details || 
                          (payout.payout_method === 'square' 
                            ? `Square Customer: ${payout.profiles.square_customer_id}` 
                            : `CashApp: ${payout.profiles.cashapp_tag}`
                          )
                        }
                      </p>
                    </div>

                    {/* Status */}
                    <div className="mb-4">
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(payout.status)}>
                          {payout.status.toUpperCase()}
                        </Badge>
                        {payout.approval_level > 0 && (
                          <Badge className="bg-purple-500">
                            Level {payout.approval_level} Approval
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Approval Notes */}
                    {payout.approval_notes && (
                      <div className="mb-4">
                        <p className="text-gray-400 text-sm mb-1">Admin Notes</p>
                        <p className="text-white text-sm">{payout.approval_notes}</p>
                      </div>
                    )}

                    {/* Error Message */}
                    {payout.error_message && (
                      <div className="mb-4">
                        <p className="text-red-400 text-sm mb-1">Error</p>
                        <p className="text-red-300 text-sm">{payout.error_message}</p>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {payout.status === 'pending' && (
                    <div className="flex gap-2">
                      <div className="space-y-2">
                        <Input
                          value={approvalNotes}
                          onChange={(e) => setApprovalNotes(e.target.value)}
                          placeholder="Approval notes (optional)"
                          className="bg-[#0a0a0f] border-[#2a2a3a] text-white text-sm w-48"
                        />
                        <Button
                          onClick={() => approvePayoutMutation.mutate({ 
                            payoutId: payout.id, 
                            notes: approvalNotes 
                          })}
                          disabled={approvePayoutMutation.isPending}
                          className="w-full bg-green-600 hover:bg-green-700"
                          size="sm"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                      </div>
                      
                      <div className="space-y-2">
                        <Input
                          value={rejectionNotes}
                          onChange={(e) => setRejectionNotes(e.target.value)}
                          placeholder="Rejection reason (optional)"
                          className="bg-[#0a0a0f] border-[#2a2a3a] text-white text-sm w-48"
                        />
                        <Button
                          onClick={() => rejectPayoutMutation.mutate({ 
                            payoutId: payout.id, 
                            notes: rejectionNotes 
                          })}
                          disabled={rejectPayoutMutation.isPending}
                          className="w-full bg-red-600 hover:bg-red-700"
                          size="sm"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}