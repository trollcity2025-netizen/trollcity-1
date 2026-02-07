import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Briefcase, Users, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

interface OfficerPoolStats {
  pool_balance: number;
  weekly_earnings: number;
  weekly_payouts: number;
  distributions: {
    officer_user_id: string;
    username: string;
    percentage_share: number;
    role: string;
  }[];
}

export default function OfficerPoolPanel() {
  const [stats, setStats] = useState<OfficerPoolStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [distributing, setDistributing] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_officer_payroll_stats');
      if (error) throw error;
      setStats(data);
    } catch (err) {
      console.error('Error fetching payroll stats:', err);
      toast.error('Failed to load payroll pool data');
    } finally {
      setLoading(false);
    }
  };

  const handleDistribute = async () => {
    if (!stats || stats.pool_balance <= 0) return;
    
    setDistributing(true);
    try {
      const { data: userResponse } = await supabase.auth.getUser();
      const userId = userResponse.user?.id;
      
      if (!userId) {
        toast.error('You must be logged in to distribute payroll');
        return;
      }

      const { data, error } = await supabase.rpc('distribute_officer_payroll', {
        p_admin_user_id: userId
      });
      
      if (error) throw error;
      
      if (data && data.success) {
        toast.success(`Successfully distributed payroll to ${data.officers_paid} officers`);
        fetchStats(); // Refresh stats
      } else {
        toast.error(data?.message || 'Failed to distribute payroll');
      }
    } catch (err) {
      console.error('Error distributing payroll:', err);
      toast.error('Failed to distribute payroll');
    } finally {
      setDistributing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const canDistribute = true; // Assuming component access is already restricted

  if (!stats) return <div className="p-8 text-center text-slate-500">Loading payroll data...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-blue-400" />
            Officer Payroll Pool
          </h2>
          <p className="text-slate-400">Funded by Asset Taxes & Purchases</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
                Refresh
            </Button>
            {canDistribute && (
                <Button 
                    variant="default" 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700 text-white border-none"
                    onClick={handleDistribute}
                    disabled={loading || distributing || (stats?.pool_balance || 0) <= 0}
                >
                    <DollarSign className="w-4 h-4 mr-1" />
                    {distributing ? 'Distributing...' : 'Distribute Payroll'}
                </Button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Pool Balance</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-blue-400">
                    {Number(stats.pool_balance).toLocaleString()}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                    Available for Distribution
                </p>
            </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Weekly Revenue</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-green-400">
                    +{Number(stats.weekly_earnings).toLocaleString()}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                    Collected this week
                </p>
            </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Weekly Payouts</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-red-400">
                    -{Number(stats.weekly_payouts).toLocaleString()}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                    Distributed this week
                </p>
            </CardContent>
        </Card>
      </div>

    </div>
  );
}
