import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Room, RoomEvent, ConnectionState, ConnectionQuality } from 'livekit-client';
import { X, Activity, Wifi, WifiOff, Users, Clock, Radio } from 'lucide-react';

interface RTSSession {
  id: string;
  user_id: string;
  room_name: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  is_active: boolean;
}

interface RTCStats {
  totalMinutes: number;
  activeSessions: number;
  roomName: string | null;
}

export default function RTCAdminMonitor() {
  const { profile } = useAuthStore();
  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true;
  
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>(ConnectionQuality.Unknown);
  const [stats, setStats] = useState<RTCStats>({
    totalMinutes: 0,
    activeSessions: 0,
    roomName: null
  });
  const [prevConnected, setPrevConnected] = useState<boolean | null>(null);
  
  const roomRef = useRef<Room | null>(null);

  const fetchRTCStats = useCallback(async () => {
    try {
      const { data: sessions, error } = await supabase
        .from('rtc_sessions')
        .select('id, user_id, room_name, started_at, ended_at, duration_seconds, is_active');

      if (error) {
        console.error('[RTC Monitor] Error fetching sessions:', error);
        return;
      }

      const rtcSessions = sessions as RTSSession[] || [];
      
      const totalSeconds = rtcSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
      const totalMinutes = Math.floor(totalSeconds / 60);
      const activeCount = rtcSessions.filter(s => s.is_active).length;

      setStats(prev => ({
        ...prev,
        totalMinutes,
        activeSessions: activeCount
      }));
    } catch (err) {
      console.error('[RTC Monitor] Error:', err);
    }
  }, []);

  const cleanupDeadSessions = useCallback(async () => {
    if (!isConnected || connectionQuality === ConnectionQuality.Lost) {
      try {
        if (roomRef.current) {
          console.log('[RTC Monitor] Disconnecting dead session...');
          roomRef.current.disconnect();
        }

        await supabase
          .from('rtc_sessions')
          .update({ 
            is_active: false, 
            ended_at: new Date().toISOString() 
          })
          .eq('is_active', true);

        setStats(prev => ({ ...prev, roomName: null, activeSessions: 0 }));
      } catch (err) {
        console.error('[RTC Monitor] Cleanup error:', err);
      }
    }
  }, [isConnected, connectionQuality]);

  useEffect(() => {
    if (!isAdmin) return;

    fetchRTCStats();
    const statsInterval = setInterval(fetchRTCStats, 10000);
    
    return () => clearInterval(statsInterval);
  }, [isAdmin, fetchRTCStats]);

  useEffect(() => {
    if (!isAdmin) return;

    const cleanupInterval = setInterval(cleanupDeadSessions, 15000);
    
    return () => clearInterval(cleanupInterval);
  }, [isAdmin, cleanupDeadSessions]);

  useEffect(() => {
    if (prevConnected !== null && prevConnected !== isConnected) {
      console.log('[RTC Monitor] Connection state changed:', isConnected ? 'Connected' : 'Disconnected');
    }
    setPrevConnected(isConnected);
  }, [isConnected, prevConnected]);

  if (!isAdmin) return null;

  const statusColor = isConnected ? 'bg-green-500' : 'bg-red-500';
  const qualityColor = connectionQuality === ConnectionQuality.Lost ? 'text-red-400' : 
                      connectionQuality === ConnectionQuality.Good ? 'text-green-400' : 
                      connectionQuality === ConnectionQuality.Medium ? 'text-yellow-400' : 'text-gray-400';

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
        style={{
          backgroundColor: isConnected ? '#22c55e' : '#ef4444',
          boxShadow: `0 4px 20px ${isConnected ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`
        }}
        title={isConnected ? 'RTC Connected' : 'RTC Disconnected'}
      >
        <Activity className="w-6 h-6 text-white" />
      </button>

      {/* Admin Popup Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-[280px] bg-[#111] rounded-xl shadow-2xl border border-white/10 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-white text-sm">RTC Monitor</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Live Status */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-xs">Live Status</span>
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <Wifi className="w-4 h-4 text-green-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-400" />
                )}
                <span className={`text-xs font-medium ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>

            {/* Connection Quality */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-xs">Quality</span>
              <span className={`text-xs font-medium ${qualityColor}`}>
                {connectionQuality === ConnectionQuality.Lost ? 'Lost' : 
                 connectionQuality === ConnectionQuality.Good ? 'Good' : 
                 connectionQuality === ConnectionQuality.Medium ? 'Medium' : 'Unknown'}
              </span>
            </div>

            {/* Active Sessions */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-xs">Active Sessions</span>
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3 text-cyan-400" />
                <span className="text-xs font-medium text-cyan-400">{stats.activeSessions}</span>
              </div>
            </div>

            {/* Current Room */}
            {stats.roomName && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Room</span>
                <span className="text-xs font-medium text-white truncate max-w-[150px]">{stats.roomName}</span>
              </div>
            )}

            {/* Total RTC Usage */}
            <div className="pt-3 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-purple-400" />
                  <span className="text-gray-400 text-xs">Total RTC Usage</span>
                </div>
                <span className="text-xs font-bold text-purple-400">
                  {stats.totalMinutes.toLocaleString()} min
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
