import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useTCNNRoles } from '@/hooks/useTCNNRoles';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Radio, 
  Video,
  Mic,
  Settings,
  Users,
  AlertCircle,
  Loader2
} from 'lucide-react';

export default function LiveControlTab() {
  const { user } = useAuthStore();
  const { isNewsCaster, isChiefNewsCaster } = useTCNNRoles(user?.id);
  const [isLive, setIsLive] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const checkLiveStatus = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('streams')
        .select('id, is_live, current_viewers')
        .eq('user_id', user?.id)
        .eq('category', 'tcnn')
        .maybeSingle();

      if (data) {
        setIsLive(data.is_live);
        setViewerCount(data.current_viewers || 0);
      }
    } catch (error) {
      console.error('Error checking live status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    checkLiveStatus();
  }, [checkLiveStatus]);

  const handleGoLive = () => {
    // Navigate to broadcast setup with TCNN category
    window.location.href = '/broadcast/setup?category=tcnn';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isNewsCaster && !isChiefNewsCaster) {
    return (
      <Card className="bg-slate-900/50 border-white/10 p-8 text-center">
        <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Access Denied</h3>
        <p className="text-gray-400">
          Only News Casters and Chief News Casters can access live control.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className={`p-6 ${isLive ? 'bg-red-900/20 border-red-500/30' : 'bg-slate-900/50 border-white/10'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              isLive ? 'bg-red-500/20 animate-pulse' : 'bg-slate-700/50'
            }`}>
              <Radio className={`w-8 h-8 ${isLive ? 'text-red-400' : 'text-gray-400'}`} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">
                {isLive ? '🔴 ON AIR' : 'Offline'}
              </h3>
              <p className="text-gray-400">
                {isLive 
                  ? `Currently broadcasting to ${viewerCount} viewers` 
                  : 'Ready to start your TCNN broadcast'}
              </p>
            </div>
          </div>
          
          <Button
            onClick={handleGoLive}
            className={isLive 
              ? 'bg-red-600 hover:bg-red-500' 
              : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500'
            }
          >
            <Video className="w-4 h-4 mr-2" />
            {isLive ? 'End Broadcast' : 'Go Live'}
          </Button>
        </div>
      </Card>

      {/* Broadcast Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-slate-900/50 border-white/10 p-4">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-5 h-5 text-blue-400" />
            <h4 className="font-semibold text-white">Broadcast Settings</h4>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-gray-400">Stream Quality</span>
              <span className="text-white">720p HD</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-gray-400">Category</span>
              <span className="text-white">TCNN - News</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-400">Official Badge</span>
              <span className="text-green-400">Enabled</span>
            </div>
          </div>
        </Card>

        <Card className="bg-slate-900/50 border-white/10 p-4">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5 text-green-400" />
            <h4 className="font-semibold text-white">Audience Stats</h4>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-gray-400">Current Viewers</span>
              <span className="text-white">{viewerCount}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-gray-400">Peak Viewers</span>
              <span className="text-white">-</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-400">Total Watch Time</span>
              <span className="text-white">-</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-slate-900/50 border-white/10 p-4">
        <h4 className="font-semibold text-white mb-4">Quick Actions</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button variant="outline" className="border-white/10 h-auto py-4 flex flex-col items-center gap-2">
            <Mic className="w-5 h-5" />
            <span className="text-xs">Mute Mic</span>
          </Button>
          <Button variant="outline" className="border-white/10 h-auto py-4 flex flex-col items-center gap-2">
            <Video className="w-5 h-5" />
            <span className="text-xs">Hide Cam</span>
          </Button>
          <Button variant="outline" className="border-white/10 h-auto py-4 flex flex-col items-center gap-2">
            <Users className="w-5 h-5" />
            <span className="text-xs">Invite Guest</span>
          </Button>
          <Button variant="outline" className="border-white/10 h-auto py-4 flex flex-col items-center gap-2">
            <Settings className="w-5 h-5" />
            <span className="text-xs">Settings</span>
          </Button>
        </div>
      </Card>

      {/* Info */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-300">
            <p className="font-medium mb-1">Broadcasting as TCNN</p>
            <p>Your stream will appear on the TCNN widget on the home page and be marked as an official broadcast. Make sure to follow TCNN editorial guidelines.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
