import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { LogIn, LogOut, Clock, User, Search, Coffee } from 'lucide-react';
import { format12hr } from '../../utils/timeFormat';

interface OfficerClockProps {
  onActionComplete?: () => void;
}

export default function OfficerClock({ onActionComplete }: OfficerClockProps) {
  const { user, profile } = useAuthStore();
  const [activeSession, setActiveSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Admin/Manual Mode
  const [targetUsername, setTargetUsername] = useState('');
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.troll_role === 'admin' || profile?.is_admin;
  const isLead = profile?.role === 'lead_troll_officer' || profile?.is_lead_officer;

  const fetchActiveSession = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('officer_work_sessions')
        .select('*')
        .eq('officer_id', uid)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    } catch (_err) {
      console.error('Error fetching session:', _err);
      return null;
    }
  };

  useEffect(() => {
    if (user) {
      fetchActiveSession(user.id).then(session => {
        setActiveSession(session);
        setLoading(false);
      });
    }
  }, [user]);

  const handleClockToggle = async (uid?: string) => {
    const targetId = uid ?? user?.id;
    if (!targetId) {
      toast.error('User not found');
      return;
    }
    setActionLoading(true);
    try {
      // Check for ANY active sessions to determine if we are clocking in or out
      const { data: activeSessions, error: fetchError } = await supabase
        .from('officer_work_sessions')
        .select('id')
        .eq('officer_id', targetId)
        .is('clock_out', null);

      if (fetchError) throw fetchError;

      const hasActiveSession = activeSessions && activeSessions.length > 0;
      
      if (hasActiveSession) {
        // Clock Out - Close ALL active sessions to fix "auto-start" loops
        let successCount = 0;
        for (const session of activeSessions) {
          const { error } = await supabase.rpc('manual_clock_out', { 
            p_session_id: session.id 
          });
          if (!error) successCount++;
        }
        
        if (successCount > 0) {
          toast.success(`Clocked out successfully${successCount > 1 ? ` (Closed ${successCount} active sessions)` : ''} at ${format12hr(new Date())}`);
        }
      } else {
        // Clock In
        const { error } = await supabase.rpc('manual_clock_in', { 
          p_officer_id: targetId 
        });
        if (error) throw error;
        toast.success(`Clocked in successfully at ${format12hr(new Date())}`);
      }
      
      if (targetId === user?.id) {
        const nextSession = await fetchActiveSession(targetId);
        setActiveSession(nextSession);
      }
      
      onActionComplete?.();
    } catch (err: any) {
      console.error('Clock toggle error:', err);
      toast.error(err.message || 'Failed to toggle clock status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBreakToggle = async (uid?: string) => {
    const targetId = uid ?? user?.id;
    if (!targetId) return;

    setActionLoading(true);
    try {
      const currentSession = targetId === user?.id ? activeSession : await fetchActiveSession(targetId);
      if (!currentSession) throw new Error("No active session");

      if (currentSession.status === 'break') {
        const { error } = await supabase.rpc('manual_end_break', { p_session_id: currentSession.id });
        if (error) throw error;
        toast.success("Break ended - Welcome back!");
      } else {
        const { error } = await supabase.rpc('manual_start_break', { p_session_id: currentSession.id });
        if (error) throw error;
        toast.success("Break started - Enjoy your rest!");
      }

      if (targetId === user?.id) {
        const nextSession = await fetchActiveSession(targetId);
        setActiveSession(nextSession);
      }
      onActionComplete?.();
    } catch (err: any) {
      console.error('Break toggle error:', err);
      toast.error(err.message || 'Failed to toggle break status');
    } finally {
      setActionLoading(false);
    }
  };

  const searchUser = async () => {
    if (!targetUsername) return;
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username')
        .ilike('username', `${targetUsername}%`)
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      if (data) {
        setTargetUserId(data.id);
        toast.success(`Found user: ${data.username}`);
      } else {
        toast.error('User not found');
        setTargetUserId(null);
      }
    } catch {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  if (loading) return null;

  return (
    <div className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-6 h-full flex flex-col justify-between`}>
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-bold">Officer Duty Terminal</h2>
          </div>
          {activeSession && (
            <span className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full animate-pulse ${
              activeSession.status === 'break' 
                ? 'text-yellow-400 bg-yellow-400/10' 
                : 'text-green-400 bg-green-400/10'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                activeSession.status === 'break' ? 'bg-yellow-400' : 'bg-green-400'
              }`} />
              {activeSession.status === 'break' ? 'ON BREAK' : 'ON DUTY'}
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <span className={`text-xs ${trollCityTheme.text.muted} uppercase tracking-wider font-bold`}>Current Time</span>
            <span className={`text-2xl font-mono ${trollCityTheme.text.primary}`}>{format12hr(new Date())}</span>
          </div>

          {activeSession && (
            <div className={`flex flex-col gap-1 p-3 bg-white/5 rounded-xl ${trollCityTheme.borders.glass}`}>
              <span className={`text-xs ${trollCityTheme.text.muted}`}>Shift Started At</span>
              <span className="text-lg font-medium text-purple-300">{format12hr(activeSession.clock_in)}</span>
              {activeSession.status === 'break' && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  <span className="text-xs text-yellow-400">Break Started: {format12hr(activeSession.last_break_start)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {/* Personal Clock Button */}
        <button
          onClick={() => handleClockToggle()}
          disabled={actionLoading}
          className={`w-full py-4 rounded-xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-xl ${
            activeSession 
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/20' 
              : 'bg-green-600 hover:bg-green-700 text-white shadow-green-900/20'
          }`}
        >
          {actionLoading ? 'Processing...' : (
            activeSession ? (
              <><LogOut size={24} /> CLOCK OUT</>
            ) : (
              <><LogIn size={24} /> CLOCK IN</>
            )
          )}
        </button>

        {/* Break Button */}
        {activeSession && (
          <button
            onClick={() => handleBreakToggle()}
            disabled={actionLoading}
            className={`w-full py-3 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 shadow-lg ${
              activeSession.status === 'break'
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white shadow-yellow-900/20'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-900/20'
            }`}
          >
            <Coffee size={20} />
            {activeSession.status === 'break' ? 'END BREAK' : 'START BREAK'}
          </button>
        )}

        {/* Admin/Lead Manual Clock */}
        {(isAdmin || isLead) && (
          <div className="pt-6 border-t border-white/10">
            <h3 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
              <User size={14} /> MANUAL CLOCK (ADMIN)
            </h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Username..."
                  value={targetUsername}
                  onChange={(e) => setTargetUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-purple-500/50 outline-none"
                />
                <button 
                  onClick={searchUser}
                  disabled={isSearching}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <Search size={16} />
                </button>
              </div>
              {targetUserId && (
                <button
                  onClick={() => handleClockToggle(targetUserId)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs font-bold whitespace-nowrap"
                >
                  TOGGLE STATUS
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
