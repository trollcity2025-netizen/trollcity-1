import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useGlobalActivity, { ActivityEvent } from '../../hooks/useGlobalActivity';
import '../../styles/ticker.css';

const GlobalTicker = () => {
  const events = useGlobalActivity();
  const navigate = useNavigate();
  const [isHeartbeating, setIsHeartbeating] = useState(false);

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

  // Check if we have any breaking news to highlight
  const hasBreakingNews = events.some(e => e.type === 'tcnn_breaking');

  return (
    <div className={`ticker-wrap ${isHeartbeating ? 'heartbeat' : ''} ${hasBreakingNews ? 'breaking-news-active' : ''}`}>
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
      
      {/* Breaking News Overlay - only shown when breaking news is active */}
      {hasBreakingNews && (
        <div className="breaking-news-overlay">
          <span className="breaking-pulse">BREAKING NEWS</span>
        </div>
      )}
    </div>
  );
};

export default GlobalTicker;
