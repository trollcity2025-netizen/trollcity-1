import React, { useEffect, useState } from 'react';
import { useDeckStore } from '../../stores/deckStore';
import {
  Users, Gift, Coins, Activity, TrendingUp, Wifi
} from 'lucide-react';

export default function DeckAnalytics() {
  const { streamStats, streamConfig, phoneLink } = useDeckStore();
  const [durationStr, setDurationStr] = useState('00:00:00');

  // Update duration display
  useEffect(() => {
    if (!streamConfig.isLive) {
      setDurationStr('00:00:00');
      return;
    }
    const interval = setInterval(() => {
      const d = useDeckStore.getState().streamStats.duration;
      const hrs = Math.floor(d / 3600);
      const mins = Math.floor((d % 3600) / 60);
      const secs = d % 60;
      setDurationStr(
        `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [streamConfig.isLive]);

  const healthColor =
    streamStats.streamHealth === 'excellent' ? 'var(--deck-success)' :
    streamStats.streamHealth === 'good' ? 'var(--deck-success)' :
    streamStats.streamHealth === 'fair' ? 'var(--deck-warning)' :
    'var(--deck-danger)';

  return (
    <div className="deck-panel-body">
      {/* Stream status */}
      <div className="deck-card" style={{ textAlign: 'center' }}>
        {streamConfig.isLive ? (
          <div className="deck-live-badge" style={{ justifyContent: 'center', fontSize: 14 }}>
            <div className="deck-live-dot" />
            LIVE
          </div>
        ) : (
          <div style={{ fontSize: 14, color: 'var(--deck-text-muted)' }}>Stream Offline</div>
        )}
        <div style={{ fontSize: 28, fontWeight: 700, margin: '8px 0' }}>{durationStr}</div>
        <div style={{ fontSize: 11, color: 'var(--deck-text-muted)' }}>Stream Duration</div>
      </div>

      {/* Stats grid */}
      <div className="deck-stats-grid">
        <div className="deck-stat-card">
          <div className="deck-stat-value" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Users size={16} />
            {streamStats.viewerCount}
          </div>
          <div className="deck-stat-label">Viewers</div>
        </div>
        <div className="deck-stat-card">
          <div className="deck-stat-value">
            <TrendingUp size={16} style={{ display: 'inline', verticalAlign: 'middle' }} /> {streamStats.peakViewers}
          </div>
          <div className="deck-stat-label">Peak</div>
        </div>
        <div className="deck-stat-card">
          <div className="deck-stat-value">{streamStats.chatMessages}</div>
          <div className="deck-stat-label">Messages</div>
        </div>
        <div className="deck-stat-card">
          <div className="deck-stat-value">
            <Gift size={16} style={{ display: 'inline', verticalAlign: 'middle' }} /> {streamStats.giftsReceived}
          </div>
          <div className="deck-stat-label">Gifts</div>
        </div>
        <div className="deck-stat-card">
          <div className="deck-stat-value">
            <Coins size={16} style={{ display: 'inline', verticalAlign: 'middle' }} /> {streamStats.coinsEarned}
          </div>
          <div className="deck-stat-label">Coins</div>
        </div>
        <div className="deck-stat-card">
          <div className="deck-stat-value" style={{ color: healthColor }}>
            <Activity size={16} style={{ display: 'inline', verticalAlign: 'middle' }} />
            {streamStats.streamHealth}
          </div>
          <div className="deck-stat-label">Health</div>
        </div>
      </div>

      {/* Technical stats */}
      <div className="deck-card">
        <div className="deck-card-header">
          <span className="deck-card-title">
            <Wifi size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Stream Health
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{streamStats.bitrate || '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--deck-text-muted)' }}>Bitrate (kbps)</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{streamStats.fps || '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--deck-text-muted)' }}>FPS</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 16,
              fontWeight: 700,
              color: streamStats.droppedFrames > 100 ? 'var(--deck-danger)' : 'var(--deck-text-primary)',
            }}>
              {streamStats.droppedFrames}
            </div>
            <div style={{ fontSize: 10, color: 'var(--deck-text-muted)' }}>Dropped</div>
          </div>
        </div>
      </div>

      {/* Connection info */}
      <div className="deck-card">
        <div className="deck-card-header">
          <span className="deck-card-title">Connection</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--deck-text-secondary)', lineHeight: 1.6 }}>
          <div>
            Phone Status:{' '}
            <strong style={{ color: phoneLink.status === 'connected' ? 'var(--deck-success)' : 'var(--deck-danger)' }}>
              {phoneLink.status}
            </strong>
          </div>
          <div>
            Quality: <strong>{streamConfig.quality}</strong>
          </div>
          {phoneLink.lastSeen && (
            <div>
              Last Sync: <strong>{new Date(phoneLink.lastSeen).toLocaleTimeString()}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
