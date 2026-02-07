import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card.jsx';
import { Button } from '../../../components/ui/button';
import { AlertTriangle, Users, TrendingUp, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface CashoutForecast {
  eligible_users_count: number;
  total_eligible_coins: number;
  total_exposure_usd: number;
  top_earners: {
    user_id: string;
    username: string;
    coins_eligible_for_cashout: number;
  }[];
  median_payout: number;
}

export default function CashoutForecastPanel() {
  const [stats, setStats] = useState<CashoutForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [projection, setProjection] = useState(100);

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_cashout_forecast', {
        projection_percent: projection
      });

      if (error) throw error;
      setStats(data);
    } catch (err: any) {
      console.error('Error fetching forecast:', err);
      toast.error('Failed to load forecast data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshData = async () => {
    const toastId = toast.loading('Refreshing earnings data...');
    try {
        const { error: refreshError } = await supabase.rpc('refresh_user_earnings_summary');
        if (refreshError) {
            console.warn('Refresh RPC failed, fetching potentially stale data', refreshError);
        }
        await fetchForecast();
        toast.success('Data refreshed', { id: toastId });
    } catch (err) {
        toast.error('Refresh failed', { id: toastId });
    }
  };

  useEffect(() => {
    fetchForecast();
  }, [projection]);

  if (!stats) return <div className="p-8 text-center text-slate-500">Loading forecast...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-400" />
            Cashout Forecast
          </h2>
          <p className="text-slate-400">Monday/Friday Exposure Analysis</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-4">
                <span className="text-xs text-slate-400 mb-1">Projection: {projection}% Users</span>
                <input 
                    type="range" 
                    min="10" 
                    max="100" 
                    value={projection} 
                    onChange={(e) => setProjection(parseInt(e.target.value))}
                    className="w-32 accent-green-500"
                />
            </div>
            <Button variant="outline" size="sm" onClick={handleRefreshData} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh Data
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Total USD Exposure</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-green-400">
                    ${stats.total_exposure_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                    Based on {projection}% cashout rate
                </p>
            </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Eligible Users</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-white">
                    {stats.eligible_users_count.toLocaleString()}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                    Meeting all criteria (Age, Min Balance)
                </p>
            </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Total Coins Eligible</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-yellow-400">
                    {Number(stats.total_eligible_coins).toLocaleString()}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                    Median Payout: {Number(stats.median_payout).toLocaleString()} coins
                </p>
            </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="w-4 h-4 text-purple-400" />
                      Top 10 High-Risk Accounts
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="space-y-4">
                      {stats.top_earners.length === 0 ? (
                          <div className="text-slate-500 text-center py-4">No eligible accounts found</div>
                      ) : (
                          stats.top_earners.map((earner, i) => (
                              <div key={earner.user_id} className="flex justify-between items-center border-b border-slate-800 pb-2 last:border-0">
                                  <div className="flex items-center gap-3">
                                      <span className="text-slate-500 font-mono text-sm">#{i + 1}</span>
                                      <span className="text-white font-medium">{earner.username}</span>
                                  </div>
                                  <div className="text-right">
                                      <div className="text-yellow-400 font-bold">{earner.coins_eligible_for_cashout.toLocaleString()}</div>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                      <AlertTriangle className="w-4 h-4 text-orange-400" />
                      Risk Analysis
                  </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="p-4 bg-orange-950/20 border border-orange-900/50 rounded-lg">
                      <h4 className="text-orange-300 font-semibold mb-1">Safety Buffer Status</h4>
                      <p className="text-sm text-slate-400">
                          {stats.total_exposure_usd > 1000 ? (
                              <span className="text-red-400">High Exposure Warning. Ensure Treasury liquidity &gt; ${stats.total_exposure_usd.toFixed(0)}</span>
                          ) : (
                              <span className="text-green-400">Exposure within safe limits.</span>
                          )}
                      </p>
                  </div>
                  
                  <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Monday Forecast (50% Load)</span>
                          <span className="text-white">${(stats.total_exposure_usd * 0.5).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Friday Forecast (80% Load)</span>
                          <span className="text-white">${(stats.total_exposure_usd * 0.8).toFixed(2)}</span>
                      </div>
                  </div>
              </CardContent>
          </Card>
      </div>
    </div>
  );
}
