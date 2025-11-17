import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  Search, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  XCircle, 
  User, 
  Calendar, 
  Filter, 
  RefreshCw, 
  CreditCard, 
  AlertTriangle,
  Zap,
  Settings,
  ExternalLink
} from "lucide-react";
import { getEarningsConfig, testSquareConnection } from "@/api/square";

export default function CashoutRecordsPanel() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [squareConfig, setSquareConfig] = useState(null);
  const [squareStatus, setSquareStatus] = useState({ loading: true, connected: false, error: null });
  const [showAutoPayout, setShowAutoPayout] = useState(false);

  // Check Square connection status
  useEffect(() => {
    const checkSquareStatus = async () => {
      try {
        setSquareStatus({ loading: true, connected: false, error: null });
        
        const config = await getEarningsConfig();
        setSquareConfig(config);
        
        const connectionTest = await testSquareConnection();
        setSquareStatus({
          loading: false,
          connected: connectionTest.success,
          error: connectionTest.error || null
        });
        
        if (!connectionTest.success) {
          console.warn('Square connection issues:', connectionTest.error);
        }
      } catch (error) {
        console.error('Error checking Square status:', error);
        setSquareStatus({
          loading: false,
          connected: false,
          error: error.message
        });
      }
    };

    checkSquareStatus();
  }, []);

  // Fetch cashout records
  const { data: cashouts = [], isLoading } = useQuery({
    queryKey: ["cashoutRecords", searchQuery, statusFilter],
    queryFn: async () => {
      if (!supabase.__isConfigured) return [];
      
      let query = supabase
        .from("cashout_requests")
        .select(`
          *,
          profiles!user_id(username, full_name, email)
        `)
        .order("created_at", { ascending: false })
        .limit(200);

      // Apply search filter
      if (searchQuery.trim().length >= 2) {
        const term = searchQuery.trim().toLowerCase();
        query = query.or(`profiles.username.ilike.%${term}%,profiles.full_name.ilike.%${term}%`);
      }

      // Apply status filter
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error("Error fetching cashouts:", error);
        toast.error("Failed to load cashout records");
        return [];
      }
      
      return data || [];
    },
  });

  // Process cashout mutation
  const processCashoutMutation = useMutation({
    mutationFn: async ({ cashoutId, approve, reason = "" }) => {
      const { error } = await supabase
        .from("cashout_requests")
        .update({
          status: approve ? "approved" : "rejected",
          processed_at: new Date().toISOString(),
          processed_by: "admin", // You might want to get the actual admin user ID
          rejection_reason: reason
        })
        .eq("id", cashoutId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["cashoutRecords"]);
      toast.success("Cashout processed successfully!");
    },
    onError: (error) => {
      toast.error("Failed to process cashout: " + error.message);
    }
  });

  // Auto-payout mutation for processing multiple pending cashouts
  const autoPayoutMutation = useMutation({
    mutationFn: async () => {
      if (!squareStatus.connected) {
        throw new Error("Square integration is not active");
      }

      // Fetch pending cashout requests
      const { data: pendingCashouts, error } = await supabase
        .from('cashout_requests')
        .select(`
          *,
          profiles!user_id(username, full_name, email, square_customer_id)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(10);

      if (error) throw error;
      if (!pendingCashouts || pendingCashouts.length === 0) {
        throw new Error("No pending cashout requests found");
      }

      let processedCount = 0;
      let errorCount = 0;

      // Process each payout
      for (const cashout of pendingCashouts) {
        try {
          // Process payout via Square using the secure edge function
          const { data: payoutData, error: payoutError } = await supabase.functions.invoke('processSquarePayout', {
            body: {
              cashoutId: cashout.id,
              amount: cashout.coins_cost / 100, // Convert coins to USD
              currency: 'USD',
              paymentMethod: cashout.payment_method,
              userId: cashout.user_id
            }
          });

          if (payoutError) {
            throw new Error(`Square payout failed: ${payoutError.message}`);
          }

          if (payoutData.success) {
            processedCount++;
          } else {
            throw new Error(payoutData.error || 'Payout failed');
          }
        } catch (payoutError) {
          errorCount++;
          console.error(`Error processing payout for cashout ${cashout.id}:`, payoutError);
          
          // Mark as failed
          await supabase
            .from('cashout_requests')
            .update({
              status: 'failed',
              processed_at: new Date().toISOString(),
              processed_by: 'auto_payout',
              rejection_reason: `Auto-payout failed: ${payoutError.message}`
            })
            .eq('id', cashout.id);
        }
      }

      return { processedCount, errorCount, total: pendingCashouts.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries(["cashoutRecords"]);
      toast.success(`Auto-payout completed! Processed: ${result.processedCount}, Errors: ${result.errorCount}`);
    },
    onError: (error) => {
      toast.error("Auto-payout failed: " + error.message);
    }
  });

  // Process individual Square payout using Supabase Edge Function
  const processSquarePayout = async (cashout) => {
    try {
      if (!squareStatus.connected) {
        return {
          success: false,
          error: 'Square integration not active'
        };
      }

      // Calculate USD amount (assuming 100 coins = $1.00)
      const usdAmount = cashout.coins_cost / 100;
      const amountCents = Math.round(usdAmount * 100);

      // Call the Supabase Edge Function for secure payout processing
      const { data, error } = await supabase.functions.invoke('processSquarePayout', {
        body: {
          cashoutId: cashout.id,
          amount: usdAmount,
          currency: 'USD',
          paymentMethod: cashout.payment_method,
          userId: cashout.user_id
        }
      });

      if (error) {
        console.error('Square payout function error:', error);
        return {
          success: false,
          error: error.message || 'Payout processing failed'
        };
      }

      return {
        success: data.success,
        transactionId: data.payoutId,
        amount: amountCents,
        currency: data.currency,
        message: data.message
      };

    } catch (error) {
      console.error('Square payout error:', error);
      return {
        success: false,
        error: error.message || 'Payout processing failed'
      };
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-600 text-white"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge className="bg-green-600 text-white"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-600 text-white"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const totalPending = cashouts.filter(c => c.status === "pending").reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalApproved = cashouts.filter(c => c.status === "approved").reduce((sum, c) => sum + (c.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Square Status and Controls */}
      <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Square Integration</h3>
          </div>
          <div className="flex items-center gap-3">
            {squareStatus.loading ? (
              <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                <Clock className="w-3 h-3 mr-1" /> Checking...
              </Badge>
            ) : squareStatus.connected ? (
              <Badge className="bg-green-600 text-white">
                <CheckCircle className="w-3 h-3 mr-1" /> Connected
              </Badge>
            ) : (
              <Badge className="bg-red-600 text-white">
                <XCircle className="w-3 h-3 mr-1" /> Disconnected
              </Badge>
            )}
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAutoPayout(!showAutoPayout)}
              className="border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-white"
            >
              <Settings className="w-4 h-4 mr-1" />
              Auto-Payout
            </Button>
            
            <Button
              size="sm"
              onClick={() => autoPayoutMutation.mutate()}
              disabled={!squareStatus.connected || autoPayoutMutation.isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {autoPayoutMutation.isLoading ? (
                <>
                  <Clock className="w-4 h-4 mr-1 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-1" />
                  Process All
                </>
              )}
            </Button>
          </div>
        </div>
        
        {squareStatus.error && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            {squareStatus.error}
          </div>
        )}
        
        {showAutoPayout && (
          <div className="mt-4 p-4 bg-[#2a2a3a] rounded-lg">
            <h4 className="text-white font-medium mb-2">Auto-Payout Settings</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Max Batch Size</p>
                <p className="text-white">10 requests</p>
              </div>
              <div>
                <p className="text-gray-400">Processing Delay</p>
                <p className="text-white">500ms per payout</p>
              </div>
              <div>
                <p className="text-gray-400">Coin Conversion</p>
                <p className="text-white">100 coins = $1.00</p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#1a1a24] border-[#2a2a3a] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Pending</p>
              <p className="text-2xl font-bold text-yellow-400">{formatCurrency(totalPending)}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-400" />
          </div>
        </Card>
        <Card className="bg-[#1a1a24] border-[#2a2a3a] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Approved</p>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(totalApproved)}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </Card>
        <Card className="bg-[#1a1a24] border-[#2a2a3a] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Pending Count</p>
              <p className="text-2xl font-bold text-white">{cashouts.filter(c => c.status === "pending").length}</p>
            </div>
            <Filter className="w-8 h-8 text-gray-400" />
          </div>
        </Card>
        <Card className="bg-[#1a1a24] border-[#2a2a3a] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Requests</p>
              <p className="text-2xl font-bold text-white">{cashouts.length}</p>
            </div>
            <DollarSign className="w-8 h-8 text-gray-400" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <Input
            placeholder="Search by username or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[#1a1a24] border-[#2a2a3a] text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#1a1a24] border-[#2a2a3a] text-white rounded-lg px-3 py-2"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Cashout Records Table */}
      <Card className="bg-[#1a1a24] border-[#2a2a3a]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-400 uppercase bg-[#1a1a24]">
              <tr>
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Requested</th>
                <th className="px-6 py-3">Payment Method</th>
                <th className="px-6 py-3">Square Transaction</th>
                <th className="px-6 py-3">Notes</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a3a]">
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-400">
                    Loading cashout records...
                  </td>
                </tr>
              ) : cashouts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-400">
                    No cashout records found
                  </td>
                </tr>
              ) : (
                cashouts.map((cashout) => (
                  <tr key={cashout.id} className="hover:bg-[#2a2a3a]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="text-white font-medium">
                            {cashout.profiles?.full_name || cashout.profiles?.username || "Unknown User"}
                          </div>
                          <div className="text-xs text-gray-400">
                            {cashout.profiles?.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-white font-medium">{formatCurrency(cashout.amount)}</div>
                      <div className="text-xs text-gray-400">{cashout.coins_cost} coins</div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(cashout.status)}</td>
                    <td className="px-6 py-4">
                      <div className="text-white">
                        {new Date(cashout.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(cashout.created_at).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-white text-sm">{cashout.payment_method}</div>
                      {cashout.payment_details && (
                        <div className="text-xs text-gray-400">
                          {cashout.payment_details.substring(0, 20)}...
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {cashout.square_transaction_id ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-green-400 border-green-400">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {cashout.square_transaction_id.substring(0, 8)}...
                          </Badge>
                          <ExternalLink className="w-4 h-4 text-blue-400 cursor-pointer hover:text-blue-300" />
                        </div>
                      ) : cashout.status === "approved" ? (
                        <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                          <Clock className="w-3 h-3 mr-1" />
                          Pending Sync
                        </Badge>
                      ) : (
                        <span className="text-gray-500 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {cashout.notes ? (
                        <div className="text-xs text-gray-300 max-w-40 truncate" title={cashout.notes}>
                          {cashout.notes}
                        </div>
                      ) : cashout.rejection_reason ? (
                        <div className="text-xs text-red-400 max-w-40 truncate" title={cashout.rejection_reason}>
                          {cashout.rejection_reason}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {cashout.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => processCashoutMutation.mutate({ cashoutId: cashout.id, approve: true })}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => {
                              const reason = prompt("Enter rejection reason:");
                              if (reason !== null) {
                                processCashoutMutation.mutate({ cashoutId: cashout.id, approve: false, reason });
                              }
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                      {cashout.status === "approved" && !cashout.square_transaction_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-white"
                          onClick={async () => {
                            try {
                              const result = await processSquarePayout(cashout);
                              if (result.success) {
                                await supabase
                                  .from('cashout_requests')
                                  .update({
                                    square_transaction_id: result.transactionId,
                                    notes: `Square payout processed - ${result.message}`
                                  })
                                  .eq('id', cashout.id);
                                toast.success('Square payout processed!');
                                queryClient.invalidateQueries(["cashoutRecords"]);
                              } else {
                                toast.error('Square payout failed: ' + result.error);
                              }
                            } catch (error) {
                              toast.error('Error processing payout: ' + error.message);
                            }
                          }}
                        >
                          <Zap className="w-3 h-3 mr-1" />
                          Process
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}