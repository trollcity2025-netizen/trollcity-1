import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { formatDuration } from '@/utils/time';
import { Lock, Clock, User, AlertTriangle, ArrowLeft, Hand } from 'lucide-react';
import { toast } from 'sonner';

const JailPreviewPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [jailData, setJailData] = useState<any>(null);
  const [isJailed, setIsJailed] = useState(false);
  const [jailTimeRemaining, setJailTimeRemaining] = useState<number | null>(null);
  const [releaseTime, setReleaseTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJailData = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('jail')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error || !data) {
          setIsJailed(false);
          setJailData(null);
          return;
        }

        setJailData(data);
        setIsJailed(true);
        setReleaseTime(data.release_time);

        if (data.release_time) {
          const releaseDate = new Date(data.release_time);
          const updateTimer = () => {
            const now = new Date();
            const remaining = Math.max(0, Math.floor((releaseDate.getTime() - now.getTime()) / 1000));
            setJailTimeRemaining(remaining);
          };

          updateTimer();
          const interval = setInterval(updateTimer, 1000);
          return () => clearInterval(interval);
        }
      } catch (err) {
        console.error('Error fetching jail data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchJailData();
  }, [user]);

  const simulateJail = async () => {
    if (!user) {
      toast.error('Must be logged in');
      return;
    }

    try {
      const releaseTime = new Date(Date.now() + 3600000).toISOString();
      const { error } = await supabase
        .from('jail')
        .upsert({
          user_id: user.id,
          reason: 'Dev test - incarcerated',
          sentence_duration: 3600,
          release_time: releaseTime,
          created_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;
      
      setIsJailed(true);
      setJailTimeRemaining(3600);
      setReleaseTime(releaseTime);
      toast.success('You are now incarcerated!');
    } catch (err: any) {
      console.error('Error:', err);
      toast.error(err.message);
    }
  };

  const releaseFromJail = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('jail')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setIsJailed(false);
      setJailData(null);
      setJailTimeRemaining(null);
      setReleaseTime(null);
      toast.success('Released from jail!');
    } catch (err: any) {
      console.error('Error:', err);
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-xl font-bold">DEV: Jail Preview</h1>
          <div className="w-16" />
        </div>

        <div className="space-y-4">
          <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4">
            <h2 className="text-lg font-bold text-blue-400 mb-2">Dev Controls</h2>
            <div className="flex gap-2">
              <button
                onClick={simulateJail}
                disabled={isJailed}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 rounded-lg font-bold"
              >
                Simulate Incarceration
              </button>
              <button
                onClick={releaseFromJail}
                disabled={!isJailed}
                className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded-lg font-bold"
              >
                Release
              </button>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg shadow-lg p-8 text-center border-t-4 border-red-600">
            <h1 className="text-4xl font-bold text-red-500 mb-4 uppercase tracking-widest">Incarcerated</h1>
            {isJailed ? (
              <div className="space-y-6">
                <div className="bg-red-900/20 p-4 rounded-lg border border-red-900/50">
                  <p className="text-gray-300 mb-2">You are currently serving a sentence in Troll City Jail.</p>
                  <p className="text-red-400 text-sm italic">Access to city services has been suspended.</p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-gray-400 uppercase text-xs font-bold tracking-wider">Time Remaining</p>
                  <div className="text-5xl font-mono py-6 bg-black/40 border-2 border-red-500/30 rounded-xl text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                    {jailTimeRemaining !== null ? formatDuration(jailTimeRemaining) : 'Calculating...'}
                  </div>
                </div>

                <div className="text-sm text-gray-500 bg-black/20 p-3 rounded-lg">
                  <span className="block text-xs uppercase text-gray-600 mb-1">Scheduled Release</span>
                  {releaseTime ? new Date(releaseTime).toLocaleString() : 'Processing...'}
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <p className="text-xs text-gray-500">Think about what you&apos;ve done.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="bg-green-900/20 p-6 rounded-lg border border-green-900/50">
                  <p className="text-xl font-bold text-green-400 mb-2">Not Currently Jailed</p>
                  <p className="text-gray-300">Use the dev controls above to simulate incarceration.</p>
                </div>
              </div>
            )}
          </div>

          {jailData && (
            <div className="bg-gray-900/50 rounded-lg p-4">
              <h3 className="font-bold mb-2">Jail Record</h3>
              <pre className="text-xs text-gray-400 overflow-x-auto">
                {JSON.stringify(jailData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JailPreviewPage;