import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useTCNNRoles } from '@/hooks/useTCNNRoles';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp,
  Loader2,
  Radio,
  Trash2,
  Play
} from 'lucide-react';
import { toast } from 'sonner';

// Simple date formatting helper
function formatDistanceToNow(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

interface TickerItem {
  id: string;
  message: string;
  type: 'standard' | 'breaking';
  status: 'pending' | 'approved' | 'rejected';
  submitted_by: string;
  submitter_name: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  priority: number;
}

export default function TickerQueueTab() {
  const { user } = useAuthStore();
  const { isNewsCaster, isChiefNewsCaster } = useTCNNRoles(user?.id);
  const [tickerQueue, setTickerQueue] = useState<TickerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTicker, setActiveTicker] = useState<TickerItem | null>(null);
  const [displayingTickers, setDisplayingTickers] = useState<TickerItem[]>([]);

  useEffect(() => {
    loadTickerQueue();
    
    const channel = supabase.channel('ticker-broadcast')
      .on('broadcast', { event: 'ticker-message' }, (payload) => {
        console.log('[TickerQueue] Received ticker message:', payload);
        const ticker = payload.payload as any;
        setDisplayingTickers(prev => {
          const filtered = prev.filter(t => t.id !== ticker.id);
          return [{ id: ticker.id, message: ticker.message.replace(/^🚨 BREAKING: |^📰 /, ''), type: ticker.priority === 'breaking' ? 'breaking' : 'standard', status: 'approved', submitted_by: '', submitter_name: 'Live', priority: ticker.priority === 'breaking' ? 3 : 1, created_at: ticker.created_at }, ...filtered].slice(0, 10);
        });
        loadTickerQueue();
      })
      .on('broadcast', { event: 'ticker-clear' }, (payload) => {
        console.log('[TickerQueue] Received ticker clear:', payload);
        const { id } = payload.payload as { id: string };
        setDisplayingTickers(prev => prev.filter(t => t.id !== id));
      })
      .subscribe((status) => {
        console.log('[TickerQueue] Channel status:', status);
      });

    const interval = setInterval(loadTickerQueue, 30000);

    return () => {
      channel.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const loadTickerQueue = async () => {
    try {
      const { data, error } = await supabase
        .from('tcnn_ticker_queue')
        .select(`
          *,
          submitter:submitted_by(stage_name)
        `)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedData = data?.map(item => ({
        ...item,
        submitter_name: item.submitter?.stage_name || 'Unknown'
      })) || [];

      setTickerQueue(formattedData);

      // Find active (most recent approved) ticker
      const active = formattedData.find(t => t.status === 'approved');
      setActiveTicker(active || null);
    } catch (error) {
      console.error('Error loading ticker queue:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string, type: 'standard' | 'breaking') => {
    if (!isChiefNewsCaster && type === 'breaking') {
      toast.error('Only Chief News Casters can approve breaking news tickers');
      return;
    }

    try {
      const { error } = await supabase
        .from('tcnn_ticker_queue')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast.success(`${type === 'breaking' ? 'Breaking news' : 'Standard'} ticker approved`);
      loadTickerQueue();
    } catch (error) {
      console.error('Error approving ticker:', error);
      toast.error('Failed to approve ticker');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tcnn_ticker_queue')
        .update({
          status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Ticker rejected');
      loadTickerQueue();
    } catch (error) {
      console.error('Error rejecting ticker:', error);
      toast.error('Failed to reject ticker');
    }
  };

  const handleRemoveFromDisplay = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tcnn_ticker_queue')
        .update({
          status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Ticker removed from display');
      loadTickerQueue();
    } catch (error) {
      console.error('Error removing ticker:', error);
      toast.error('Failed to remove ticker');
    }
  };

  const handleDeleteTicker = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this ticker?')) return;
    
    try {
      const { error } = await supabase
        .from('tcnn_ticker_queue')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Ticker deleted');
      loadTickerQueue();
    } catch (error) {
      console.error('Error deleting ticker:', error);
      toast.error('Failed to delete ticker');
    }
  };

  const handleBroadcastNow = async (ticker: TickerItem) => {
    try {
      await supabase.channel('ticker-broadcast').send({
        type: 'broadcast',
        event: 'ticker-message',
        payload: {
          id: ticker.id,
          type: ticker.type === 'breaking' ? 'tcnn_breaking' : 'tcnn_live',
          message: ticker.type === 'breaking' 
            ? `🚨 BREAKING: ${ticker.message}` 
            : `📰 ${ticker.message}`,
          priority: ticker.type === 'breaking' ? 'breaking' : 'medium',
          created_at: new Date().toISOString(),
          metadata: {
            category: ticker.type === 'breaking' ? 'breaking_news' : 'ticker_message'
          }
        }
      });

      toast.success('Ticker broadcast to global display!');
    } catch (error) {
      console.error('Error broadcasting ticker:', error);
      toast.error('Failed to broadcast ticker');
    }
  };

  const handleStopDisplay = async (id: string) => {
    if (!confirm('Stop displaying this ticker?')) return;
    
    try {
      // Send a clear event to remove from global ticker
      await supabase.channel('ticker-broadcast').send({
        type: 'broadcast',
        event: 'ticker-clear',
        payload: { id }
      });

      // Also update database status
      const { error } = await supabase
        .from('tcnn_ticker_queue')
        .update({
          status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Ticker stopped');
      loadTickerQueue();
    } catch (error) {
      console.error('Error stopping ticker:', error);
      toast.error('Failed to stop ticker');
    }
  };

  const pendingTickers = tickerQueue.filter(t => t.status === 'pending');
  const approvedTickers = tickerQueue.filter(t => t.status === 'approved');
  const rejectedTickers = tickerQueue.filter(t => t.status === 'rejected');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Currently Active Ticker */}
      {activeTicker && (
        <Card className="bg-gradient-to-r from-red-900/50 to-blue-900/50 border-red-500/30 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
                <Radio className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={activeTicker.type === 'breaking' 
                    ? 'bg-red-500 text-white' 
                    : 'bg-blue-500 text-white'
                  }>
                    {activeTicker.type === 'breaking' ? '🔴 BREAKING' : '📰 Standard'}
                  </Badge>
                  <span className="text-sm text-gray-400">
                    Currently Live
                  </span>
                </div>
                <p className="text-xl font-semibold text-white">
                  {activeTicker.message}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Submitted by {activeTicker.submitter_name} • {' '}
                  {formatDistanceToNow(activeTicker.created_at)}
                </p>
              </div>
            </div>
            {(isNewsCaster || isChiefNewsCaster) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRemoveFromDisplay(activeTicker.id)}
                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Remove
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Currently Displaying */}
      {displayingTickers.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Radio className="w-5 h-5 text-green-400 animate-pulse" />
            Currently Displaying ({displayingTickers.length})
          </h3>
          <div className="space-y-2">
            {displayingTickers.map((ticker) => (
              <Card key={ticker.id} className="bg-slate-900/50 border-blue-500/30 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <Badge className={ticker.type === 'breaking' ? 'bg-red-500' : 'bg-blue-500'}>
                      {ticker.type === 'breaking' ? '🚨 BREAKING' : '📰'}
                    </Badge>
                    <p className="text-white text-sm truncate max-w-lg">
                      {ticker.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {(isNewsCaster || isChiefNewsCaster) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStopDisplay(ticker.id)}
                        className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Stop
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Pending Approvals */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-yellow-400" />
          Pending Approval ({pendingTickers.length})
        </h3>
        
        {pendingTickers.length === 0 ? (
          <Card className="bg-slate-900/50 border-white/10 p-8 text-center">
            <p className="text-gray-400">No tickers awaiting approval</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingTickers.map((ticker) => (
              <Card 
                key={ticker.id} 
                className={`p-4 border-l-4 ${
                  ticker.type === 'breaking' 
                    ? 'bg-red-900/20 border-l-red-500' 
                    : 'bg-slate-900/50 border-l-blue-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={ticker.type === 'breaking' ? 'destructive' : 'default'}>
                        {ticker.type === 'breaking' ? '🔴 BREAKING' : '📰 Standard'}
                      </Badge>
                      {ticker.priority > 0 && (
                        <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Priority {ticker.priority}
                        </Badge>
                      )}
                    </div>
                    <p className="text-white font-medium">{ticker.message}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Submitted by {ticker.submitter_name} • {' '}
                      {formatDistanceToNow(ticker.created_at)}
                    </p>
                  </div>
                  
                  {(isNewsCaster || isChiefNewsCaster) && (
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(ticker.id, ticker.type)}
                        className="bg-green-600 hover:bg-green-500"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBroadcastNow(ticker)}
                        className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                        title="Broadcast now (skip queue)"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Push Live
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(ticker.id)}
                        className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Approved */}
      {approvedTickers.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            Approved ({approvedTickers.length})
          </h3>
          <div className="space-y-2">
            {approvedTickers.slice(0, 10).map((ticker) => (
              <Card key={ticker.id} className="bg-slate-900/30 border-white/5 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <Badge variant="outline" className="text-xs">
                      {ticker.type}
                    </Badge>
                    <p className="text-gray-300 text-sm truncate max-w-lg">
                      {ticker.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {(isNewsCaster || isChiefNewsCaster) && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBroadcastNow(ticker)}
                          className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                          title="Broadcast to global ticker"
                        >
                          <Play className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteTicker(ticker.id)}
                          className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                          title="Delete ticker"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(ticker.reviewed_at || ticker.created_at)}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Rejected */}
      {rejectedTickers.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-400" />
            Rejected ({rejectedTickers.length})
          </h3>
          <div className="space-y-2">
            {rejectedTickers.slice(0, 5).map((ticker) => (
              <Card key={ticker.id} className="bg-slate-900/20 border-white/5 p-3 opacity-60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <Badge variant="outline" className="text-xs text-gray-500">
                      {ticker.type}
                    </Badge>
                    <p className="text-gray-400 text-sm truncate max-w-lg">
                      {ticker.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {(isNewsCaster || isChiefNewsCaster) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteTicker(ticker.id)}
                        className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                        title="Delete ticker"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(ticker.reviewed_at || ticker.created_at)}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Guidelines */}
      <Card className="bg-slate-900/50 border-white/10 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-400">
            <p className="font-medium text-white mb-1">Ticker Guidelines</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Standard tickers: General news, updates, announcements</li>
              <li>Breaking tickers: Urgent news, emergencies, major events</li>
              <li>Only Chief News Casters can approve breaking news tickers</li>
              <li>Keep messages concise (max 200 characters)</li>
              <li>Breaking tickers show for longer and with priority styling</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
