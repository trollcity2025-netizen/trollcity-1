import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useGlobalActivity, { ActivityEvent } from '../../hooks/useGlobalActivity';
import { useAuthStore } from '../../lib/store';
import { useTCNNRoles } from '../../hooks/useTCNNRoles';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import '../../styles/ticker.css';

const GlobalTicker = () => {
  const events = useGlobalActivity();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const { isNewsCaster, isChiefNewsCaster } = useTCNNRoles(user?.id);
  const [isHeartbeating, setIsHeartbeating] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [tickerMessage, setTickerMessage] = useState('');
  const [tickerType, setTickerType] = useState<'standard' | 'breaking'>('standard');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.is_admin;
  const canEditTicker = isAdmin || isNewsCaster || isChiefNewsCaster;

  useEffect(() => {
    if (events.length > 0 && (events[0].priority === 'high' || events[0].priority === 'breaking')) {
      setIsHeartbeating(true);
      const timer = setTimeout(() => setIsHeartbeating(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [events]);

  const handleTickerClick = (event: ActivityEvent) => {
    if (event.metadata?.url) {
      navigate(event.metadata.url);
    }
  };

  const handleTickerDoubleClick = () => {
    if (canEditTicker) {
      setShowEditModal(true);
    }
  };

  const handleSubmitTicker = async () => {
    if (!tickerMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('tcnn_ticker_queue')
        .insert({
          message: tickerMessage,
          ticker_type: tickerType,
          status: 'approved',
          submitted_by: user?.id,
          priority: tickerType === 'breaking' ? 3 : 1
        });

      if (error) throw error;

      // Broadcast the ticker message directly to all connected clients
      await supabase.channel('ticker-broadcast').send({
        type: 'broadcast',
        event: 'ticker-message',
        payload: {
          id: crypto.randomUUID(),
          type: tickerType === 'breaking' ? 'tcnn_breaking' : 'tcnn_live',
          message: tickerType === 'breaking' 
            ? `🚨 BREAKING: ${tickerMessage}` 
            : `📰 ${tickerMessage}`,
          priority: tickerType === 'breaking' ? 'breaking' : 'medium',
          created_at: new Date().toISOString(),
          metadata: {
            category: tickerType === 'breaking' ? 'breaking_news' : 'ticker_message'
          }
        }
      });

      toast.success(tickerType === 'breaking' ? 'Breaking news pushed!' : 'Ticker message pushed!');
      setShowEditModal(false);
      setTickerMessage('');
      setTickerType('standard');
    } catch (err: any) {
      console.error('Error pushing ticker:', err);
      toast.error(err.message || 'Failed to push ticker');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getEventStyles = (event: ActivityEvent): string => {
    switch (event.type) {
      case 'tcnn_breaking':
        return 'tcnn-breaking';
      case 'tcnn_live':
        return 'tcnn-live';
      case 'tcnn_article':
        return 'tcnn-article';
      case 'live':
        return 'event-live';
      case 'gift':
        return 'event-gift';
      case 'battle':
        return 'event-battle';
      default:
        return 'event-system';
    }
  };

  const getEventIcon = (event: ActivityEvent): string => {
    switch (event.type) {
      case 'tcnn_breaking':
        return '🚨';
      case 'tcnn_live':
        return '📺';
      case 'tcnn_article':
        return '📰';
      case 'live':
        return '🔴';
      case 'gift':
        return '🎁';
      case 'battle':
        return '⚔️';
      default:
        return '•';
    }
  };

  const hasBreakingNews = events.some(e => e.type === 'tcnn_breaking');

  return (
    <>
      <div 
        className={`ticker-wrap ${isHeartbeating ? 'heartbeat' : ''} ${hasBreakingNews ? 'breaking-news-active' : ''} ${canEditTicker ? 'cursor-pointer' : ''}`}
        onDoubleClick={handleTickerDoubleClick}
        title={canEditTicker ? 'Double-click to push new ticker message' : undefined}
      >
        <div className="ticker">
          {events.map((event) => (
            <div 
              key={`${event.id}-${event.type}`} 
              className={`ticker-item ${getEventStyles(event)} ${event.metadata?.url ? 'cursor-pointer hover:underline' : ''}`}
              onClick={() => handleTickerClick(event)}
              role={event.metadata?.url ? 'button' : undefined}
              tabIndex={event.metadata?.url ? 0 : undefined}
            >
              <span className="ticker-icon">{getEventIcon(event)}</span>
              <span className="ticker-message">{event.message}</span>
              {event.type === 'tcnn_breaking' && (
                <span className="breaking-badge">BREAKING</span>
              )}
              {event.type === 'tcnn_live' && (
                <span className="live-badge">LIVE</span>
              )}
            </div>
          ))}
        </div>
        
        {hasBreakingNews && (
          <div className="breaking-news-overlay">
            <span className="breaking-pulse">BREAKING NEWS</span>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md w-full max-h-[80vh] overflow-y-auto fixed top-[10%]">
            <div className="p-2">
              <h3 className="text-xl font-bold mb-4">Push Ticker Message</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Message</label>
                  <textarea
                    value={tickerMessage}
                    onChange={(e) => setTickerMessage(e.target.value)}
                    placeholder="Enter ticker message..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    rows={3}
                    maxLength={200}
                  />
                  <p className="text-xs text-slate-500 mt-1">{tickerMessage.length}/200 characters</p>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTickerType('standard')}
                      className={`px-4 py-2 rounded-lg border ${tickerType === 'standard' ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}
                    >
                      📰 Standard
                    </button>
                    <button
                      type="button"
                      onClick={() => setTickerType('breaking')}
                      className={`px-4 py-2 rounded-lg border ${tickerType === 'breaking' ? 'bg-red-600 border-red-500 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}
                    >
                      🚨 Breaking
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSubmitTicker}
                    disabled={isSubmitting || !tickerMessage.trim()}
                    className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    {isSubmitting ? 'Pushing...' : 'Push Live'}
                  </button>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 border border-slate-700 text-slate-400 rounded-lg hover:border-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default GlobalTicker;