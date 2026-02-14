import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Trophy, Zap, CheckCircle2, Info } from 'lucide-react';
import { sendGlobalNotification } from '../lib/ntfyNotify';

interface GoalMetric {
  current: number;
  threshold: number;
  met: boolean;
}

interface EligibilityData {
  eligible: boolean;
  season_name: string;
  metrics: Record<string, GoalMetric>;
}

export const CreatorSeasonalGoals = () => {
  const [data, setData] = useState<EligibilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [boosting, setBoosting] = useState(false);

  const fetchProgress = useCallback(async () => {
    try {
      // Get current batch first to know the week
      const { data: batchId, error: batchError } = await supabase.rpc('get_current_payout_batch');
      if (batchError) throw batchError;

      const { data: eligibility, error: eligibilityError } = await supabase.rpc('check_creator_weekly_eligibility', {
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_batch_id: batchId
      });

      if (eligibilityError) throw eligibilityError;
      setData(eligibility);
    } catch (error: any) {
      console.error('Error fetching seasonal goals:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const requestBoost = async (metric: string) => {
    setBoosting(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { error } = await supabase.from('creator_goal_boost').insert({
        user_id: user.user.id,
        help_text: `I'm close to my ${metric.replace(/_/g, ' ')} goal! Can someone help with a few gifts? 🎁`
      });

      if (error) throw error;
      
      // Trigger global notification
      const message = `I'm close to my ${metric.replace(/_/g, ' ')} goal! Can someone help with a few gifts? 🎁`;
      await sendGlobalNotification(`🚀 Creator Goal Boost!`, `${user.user.email?.split('@')[0]} needs your help: ${message}`);

      toast.success('Goal Boost requested! A notification has been sent to the city.');
    } catch (error: any) {
      toast.error('Failed to request boost: ' + error.message);
    } finally {
      setBoosting(false);
    }
  };

  if (loading) return <div className="animate-pulse h-48 bg-purple-900/10 rounded-xl border border-purple-500/20"></div>;
  if (!data) return null;

  const metrics = Object.entries(data.metrics);

  return (
    <div className="bg-gradient-to-br from-purple-900/20 to-black/40 rounded-xl border border-purple-500/30 p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-yellow-400" />
          <div>
            <h3 className="text-xl font-bold text-white">{data.season_name} Goals</h3>
            <p className="text-xs text-gray-400">Complete all weekly tasks for a +2.5% payout bonus!</p>
          </div>
        </div>
        {data.eligible && (
          <div className="flex items-center gap-2 bg-troll-green/20 text-troll-green px-3 py-1 rounded-full text-xs font-bold border border-troll-green/30">
            <CheckCircle2 className="w-4 h-4" /> BONUS ACTIVE
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {metrics.map(([key, metric]) => {
          const progress = Math.min((metric.current / metric.threshold) * 100, 100);
          const isNearGoal = !metric.met && progress >= 90;

          return (
            <div key={key} className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-sm font-medium text-gray-300 capitalize">
                  {key.replace(/_/g, ' ')}
                </span>
                <span className="text-xs font-mono text-gray-400">
                  {metric.current} / {metric.threshold}
                </span>
              </div>
              
              <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    metric.met ? 'bg-troll-green' : isNearGoal ? 'bg-yellow-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {isNearGoal && (
                <button
                  onClick={() => requestBoost(key)}
                  disabled={boosting}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 text-xs font-bold hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
                >
                  <Zap className="w-3 h-3 fill-current" />
                  {boosting ? 'SENDING BOOST...' : 'REQUEST GOAL BOOST'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg flex gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0" />
        <p className="text-xs text-gray-400 leading-relaxed">
          Your progress is updated every 24 hours. Unique gifters are counted per week. 
          Returning gifters are users who gifted you in the last 30 days and returned this week.
        </p>
      </div>
    </div>
  );
};
