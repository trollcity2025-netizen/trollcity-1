import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/api/supabaseClient";
import { Play, Pause, Download, DollarSign, Users, Clock, Star } from "lucide-react";

export default function TrollLiveShowAdmin() {
  const [isLive, setIsLive] = useState(false);
  const [currentPerformer, setCurrentPerformer] = useState(null);
  const [waitlist, setWaitlist] = useState([]);
  const [showStats, setShowStats] = useState({
    totalParticipants: 0,
    totalRevenue: 0,
    activeShows: 0
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchShowStatus();
    fetchWaitlist();
    fetchStats();

    // Real-time subscriptions
    const showSubscription = supabase
      .channel('troll-live-show-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'troll_live_show' }, (payload) => {
        handleShowUpdate(payload.new);
      })
      .subscribe();

    const waitlistSubscription = supabase
      .channel('troll-live-waitlist-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'troll_live_show_waitlist' }, (payload) => {
        fetchWaitlist();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(showSubscription);
      supabase.removeChannel(waitlistSubscription);
    };
  }, []);

  const fetchShowStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('troll_live_show')
        .select(`
          *,
          current_performer:profiles!troll_live_show_current_performer_id_fkey(*)
        `)
        .eq('is_active', true)
        .single();

      if (data && !error) {
        setIsLive(true);
        setCurrentPerformer(data.current_performer);
      } else {
        setIsLive(false);
        setCurrentPerformer(null);
      }
    } catch (error) {
      console.error('Error fetching show status:', error);
    }
  };

  const fetchWaitlist = async () => {
    try {
      const { data, error } = await supabase
        .from('troll_live_show_waitlist')
        .select(`
          *,
          user:profiles(*)
        `)
        .order('position', { ascending: true });

      if (data && !error) {
        setWaitlist(data);
      }
    } catch (error) {
      console.error('Error fetching waitlist:', error);
    }
  };

  const fetchStats = async () => {
    try {
      // Get total participants
      const { count: totalParticipants } = await supabase
        .from('troll_live_show_waitlist')
        .select('*', { count: 'exact', head: true });

      // Get total revenue from entry fees
      const { data: revenueData } = await supabase
        .from('coin_transactions')
        .select('amount')
        .eq('type', 'troll_live_show_entry');

      const totalRevenue = revenueData?.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) || 0;

      // Get active shows
      const { count: activeShows } = await supabase
        .from('troll_live_show')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      setShowStats({
        totalParticipants: totalParticipants || 0,
        totalRevenue: totalRevenue,
        activeShows: activeShows || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleShowUpdate = (showData) => {
    if (showData && showData.is_active) {
      setIsLive(true);
      setCurrentPerformer(showData.current_performer);
    } else {
      setIsLive(false);
      setCurrentPerformer(null);
    }
  };

  const startNewShow = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('troll_live_show')
        .insert({
          is_active: true,
          entry_fee_coins: 500,
          show_duration_minutes: 5
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Troll Live Show started successfully!');
      setIsLive(true);
    } catch (error) {
      console.error('Error starting show:', error);
      toast.error('Failed to start show');
    } finally {
      setIsLoading(false);
    }
  };

  const endCurrentShow = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('troll_live_show')
        .update({ is_active: false })
        .eq('is_active', true);

      if (error) throw error;

      toast.success('Troll Live Show ended successfully!');
      setIsLive(false);
      setCurrentPerformer(null);
    } catch (error) {
      console.error('Error ending show:', error);
      toast.error('Failed to end show');
    } finally {
      setIsLoading(false);
    }
  };

  const skipCurrentPerformer = async () => {
    if (!currentPerformer) return;

    setIsLoading(true);
    try {
      // Get current show
      const { data: currentShow } = await supabase
        .from('troll_live_show')
        .select('id')
        .eq('is_active', true)
        .single();

      if (!currentShow) throw new Error('No active show found');

      // End current performance
      const response = await fetch('/api/manageTrollLiveShow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          action: 'end_performance',
          userId: (await supabase.auth.getUser()).data.user?.id,
          showId: currentShow.id,
          performerId: currentPerformer.id
        })
      });

      if (!response.ok) throw new Error('Failed to skip performer');

      toast.success('Current performer skipped!');
    } catch (error) {
      console.error('Error skipping performer:', error);
      toast.error('Failed to skip performer');
    } finally {
      setIsLoading(false);
    }
  };

  const generateWeeklyStatement = async () => {
    setIsLoading(true);
    try {
      // Get current week's data
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      // Get all transactions for the week
      const { data: transactions } = await supabase
        .from('coin_transactions')
        .select(`
          *,
          user:profiles(id, username)
        `)
        .gte('created_at', oneWeekAgo.toISOString())
        .eq('type', 'troll_live_show_entry')
        .order('created_at', { ascending: false });

      // Get all participants
      const { data: participants } = await supabase
        .from('troll_live_show_waitlist')
        .select(`
          *,
          user:profiles(*)
        `)
        .gte('created_at', oneWeekAgo.toISOString())
        .order('created_at', { ascending: false });

      // Generate statement data
      const statementData = {
        weekEnding: new Date().toISOString().split('T')[0],
        totalRevenue: transactions?.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) || 0,
        totalParticipants: participants?.length || 0,
        successfulPerformances: participants?.filter(p => p.status === 'completed').length || 0,
        kickedPerformances: participants?.filter(p => p.status === 'kicked').length || 0,
        transactions: transactions?.map(tx => ({
          date: tx.created_at,
          user: tx.user?.username || 'Unknown',
          amount: Math.abs(tx.amount),
          type: tx.type
        })) || [],
        participants: participants?.map(p => ({
          username: p.user?.username || 'Unknown',
          status: p.status,
          duration: p.performance_duration_seconds,
          votesReceived: p.votes_received,
          votesAgainst: p.votes_against
        })) || []
      };

      // Create CSV content
      const csvContent = generateCSV(statementData);
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `troll-live-show-statement-${statementData.weekEnding}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Weekly statement generated and downloaded!');
    } catch (error) {
      console.error('Error generating statement:', error);
      toast.error('Failed to generate statement');
    } finally {
      setIsLoading(false);
    }
  };

  const generateCSV = (data) => {
    let csv = 'TROLL LIVE SHOW - WEEKLY STATEMENT\n';
    csv += `Week Ending: ${data.weekEnding}\n`;
    csv += `Total Revenue: ${data.totalRevenue} coins\n`;
    csv += `Total Participants: ${data.totalParticipants}\n`;
    csv += `Successful Performances: ${data.successfulPerformances}\n`;
    csv += `Kicked Performances: ${data.kickedPerformances}\n\n`;

    csv += 'TRANSACTIONS\n';
    csv += 'Date,User,Amount,Type\n';
    data.transactions.forEach(tx => {
      csv += `${tx.date},${tx.user},${tx.amount},${tx.type}\n`;
    });

    csv += '\nPARTICIPANTS\n';
    csv += 'Username,Status,Duration (seconds),Votes Received,Votes Against\n';
    data.participants.forEach(p => {
      csv += `${p.username},${p.status},${p.duration || 0},${p.votesReceived || 0},${p.votesAgainst || 0}\n`;
    });

    return csv;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">🎭 Troll Live Show Admin</h1>
        <p className="text-gray-400">Manage the ultimate variety show experience</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-black/30 backdrop-blur-sm border-purple-500/30 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-400 text-sm font-medium">Total Participants</p>
              <p className="text-2xl font-bold text-white">{showStats.totalParticipants}</p>
            </div>
            <Users className="w-8 h-8 text-purple-400" />
          </div>
        </Card>

        <Card className="bg-black/30 backdrop-blur-sm border-green-500/30 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-400 text-sm font-medium">Total Revenue</p>
              <p className="text-2xl font-bold text-white">{showStats.totalRevenue.toLocaleString()} coins</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-400" />
          </div>
        </Card>

        <Card className="bg-black/30 backdrop-blur-sm border-blue-500/30 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-400 text-sm font-medium">Active Shows</p>
              <p className="text-2xl font-bold text-white">{showStats.activeShows}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-400" />
          </div>
        </Card>

        <Card className="bg-black/30 backdrop-blur-sm border-yellow-500/30 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-400 text-sm font-medium">Show Status</p>
              <p className="text-2xl font-bold text-white">{isLive ? '🔴 LIVE' : '⏸️ OFFLINE'}</p>
            </div>
            <Star className="w-8 h-8 text-yellow-400" />
          </div>
        </Card>
      </div>

      {/* Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Show Controls */}
        <Card className="bg-black/30 backdrop-blur-sm border-red-500/30">
          <div className="p-6">
            <h2 className="text-xl font-bold text-white mb-6">🎮 Show Controls</h2>
            
            <div className="space-y-4">
              {!isLive ? (
                <Button
                  onClick={startNewShow}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start New Show
                </Button>
              ) : (
                <>
                  <Button
                    onClick={endCurrentShow}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    End Current Show
                  </Button>
                  
                  {currentPerformer && (
                    <Button
                      onClick={skipCurrentPerformer}
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800"
                    >
                      <Star className="w-4 h-4 mr-2" />
                      Skip Current Performer
                    </Button>
                  )}
                </>
              )}

              <Button
                onClick={generateWeeklyStatement}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                <Download className="w-4 h-4 mr-2" />
                Generate Weekly Statement
              </Button>
            </div>

            {currentPerformer && (
              <div className="mt-6 p-4 bg-black/20 rounded-lg">
                <h3 className="text-white font-bold mb-2">Current Performer</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{currentPerformer.username}</p>
                    <p className="text-gray-400 text-sm">ID: {currentPerformer.id}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Waitlist Management */}
        <Card className="bg-black/30 backdrop-blur-sm border-purple-500/30">
          <div className="p-6">
            <h2 className="text-xl font-bold text-white mb-6">👥 Waitlist ({waitlist.length})</h2>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {waitlist.map((item, index) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-yellow-400 font-bold w-6 text-center">
                      {item.position}
                    </div>
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{item.user?.username || 'Unknown'}</p>
                      <p className="text-gray-400 text-xs">Status: {item.status}</p>
                    </div>
                  </div>
                  <Badge className={`text-xs ${
                    item.status === 'waiting' ? 'bg-yellow-500/20 text-yellow-300' :
                    item.status === 'performing' ? 'bg-green-500/20 text-green-300' :
                    item.status === 'completed' ? 'bg-blue-500/20 text-blue-300' :
                    'bg-red-500/20 text-red-300'
                  }`}>
                    {item.status}
                  </Badge>
                </div>
              ))}
              
              {waitlist.length === 0 && (
                <div className="text-center text-gray-400 py-8">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No users in waitlist</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}