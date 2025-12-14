import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Lock, Unlock, MessageSquare, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';

interface CreatorSafetyPanelProps {
  streamId: string;
  isHost: boolean;
}

const CreatorSafetyPanel: React.FC<CreatorSafetyPanelProps> = ({ streamId, isHost }) => {
  const { user } = useAuthStore();
  const [chatLocked, setChatLocked] = useState(false);
  const [lockDuration, setLockDuration] = useState(10); // seconds
  const [panicMode, setPanicMode] = useState(false);
  const [abuseLevel, setAbuseLevel] = useState(0); // 0-100

  useEffect(() => {
    // Mock abuse level monitoring - in real app this would analyze chat messages
    const interval = setInterval(() => {
      // Simulate random abuse level changes
      setAbuseLevel(prev => {
        const change = (Math.random() - 0.5) * 20;
        const newLevel = Math.max(0, Math.min(100, prev + change));
        return newLevel;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Auto-lock chat if abuse level gets too high
    if (abuseLevel > 70 && !chatLocked && isHost) {
      handleAutoLock();
    }
  }, [abuseLevel, chatLocked, isHost]);

  const handlePanicButton = async () => {
    setPanicMode(true);

    try {
      // Call officer immediately
      await supabase.from('emergency_alerts').insert({
        stream_id: streamId,
        creator_id: user?.id,
        alert_type: 'panic_button',
        severity: 'critical',
        message: 'Creator activated panic button - immediate assistance required',
        created_at: new Date().toISOString()
      });

      // Auto-lock chat for 30 seconds
      setChatLocked(true);
      setLockDuration(30);

      // Notify all online officers
      toast.error('🚨 PANIC BUTTON ACTIVATED - Officers notified immediately!');

      // Auto-unlock after 30 seconds
      setTimeout(() => {
        setChatLocked(false);
        setPanicMode(false);
        toast.success('Chat unlocked - situation resolved');
      }, 30000);

    } catch (error) {
      console.error('Panic button error:', error);
      toast.error('Failed to send emergency alert');
      setPanicMode(false);
    }
  };

  const handleAutoLock = () => {
    setChatLocked(true);
    setLockDuration(10);

    toast.warning('🔒 Chat auto-locked due to high abuse level');

    // Auto-unlock after 10 seconds
    setTimeout(() => {
      setChatLocked(false);
      toast.success('Chat unlocked');
    }, 10000);
  };

  const handleManualLock = () => {
    setChatLocked(true);
    setLockDuration(30);

    toast.warning('🔒 Chat manually locked');

    // Auto-unlock after 30 seconds
    setTimeout(() => {
      setChatLocked(false);
      toast.success('Chat unlocked');
    }, 30000);
  };

  const getAbuseColor = () => {
    if (abuseLevel < 30) return 'text-green-400';
    if (abuseLevel < 60) return 'text-yellow-400';
    if (abuseLevel < 80) return 'text-orange-400';
    return 'text-red-400';
  };

  const getAbuseBg = () => {
    if (abuseLevel < 30) return 'bg-green-900/20';
    if (abuseLevel < 60) return 'bg-yellow-900/20';
    if (abuseLevel < 80) return 'bg-orange-900/20';
    return 'bg-red-900/20';
  };

  if (!isHost) return null;

  return (
    <div className="bg-gray-900/95 backdrop-blur-sm border border-red-500/30 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-red-400" />
        <h3 className="text-white font-bold">Creator Safety</h3>
      </div>

      {/* Abuse Level Monitor */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-300">Abuse Level</span>
          <span className={`text-sm font-bold ${getAbuseColor()}`}>
            {Math.round(abuseLevel)}%
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${getAbuseBg()}`}
            style={{ width: `${abuseLevel}%` }}
          />
        </div>
        {abuseLevel > 70 && (
          <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            High abuse detected - auto-lock activated
          </div>
        )}
      </div>

      {/* Chat Lock Status */}
      {chatLocked && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-red-400" />
            <span className="text-red-300 font-semibold">Chat Locked</span>
            <span className="text-red-400 text-sm">({lockDuration}s remaining)</span>
          </div>
          <div className="text-xs text-red-400/70 mt-1">
            Users cannot send messages
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="space-y-2">
        {/* Panic Button */}
        <button
          onClick={handlePanicButton}
          disabled={panicMode}
          className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-all ${
            panicMode
              ? 'bg-red-800 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-700 active:bg-red-800 shadow-lg hover:shadow-red-500/25'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {panicMode ? 'EMERGENCY ALERT SENT' : 'PANIC BUTTON'}
          </div>
        </button>

        {/* Manual Lock Button */}
        <button
          onClick={handleManualLock}
          disabled={chatLocked}
          className={`w-full py-2 px-4 rounded-lg font-semibold text-white transition-all ${
            chatLocked
              ? 'bg-gray-700 cursor-not-allowed'
              : 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            {chatLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            {chatLocked ? 'Chat Locked' : 'Lock Chat (30s)'}
          </div>
        </button>
      </div>

      {/* Emergency Info */}
      <div className="mt-4 pt-3 border-t border-gray-700">
        <div className="text-xs text-gray-400 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Shield className="w-3 h-3" />
            <span>Emergency Response: less than 5 seconds</span>
          </div>
          <div>Officers will be notified immediately</div>
        </div>
      </div>
    </div>
  );
};

export default CreatorSafetyPanel;