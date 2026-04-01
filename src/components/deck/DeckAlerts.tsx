import React from 'react';
import { useDeckStore } from '../../stores/deckStore';
import {
  Bell, Gift, UserPlus, Radio, Star, Heart, AlertTriangle, Trash2
} from 'lucide-react';

const ALERT_ICONS: Record<string, React.ReactNode> = {
  gift: <Gift size={16} color="#f59e0b" />,
  follow: <UserPlus size={16} color="#3b82f6" />,
  raid: <Radio size={16} color="#a855f7" />,
  host: <Star size={16} color="#eab308" />,
  subscription: <Heart size={16} color="#ec4899" />,
  donation: <Gift size={16} color="#22c55e" />,
  system: <AlertTriangle size={16} color="#6b6585" />,
};

export default function DeckAlerts() {
  const { alerts, unreadAlertCount, markAlertRead, clearAlerts } = useDeckStore();

  const timeAgo = (ts: number) => {
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  return (
    <div className="deck-panel-body">
      {/* Header */}
      <div className="deck-card">
        <div className="deck-card-header">
          <span className="deck-card-title">
            <Bell size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Alerts
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {unreadAlertCount > 0 && (
              <span className="deck-nav-badge">{unreadAlertCount}</span>
            )}
            {alerts.length > 0 && (
              <button
                className="deck-btn deck-btn-ghost deck-btn-sm"
                onClick={clearAlerts}
                title="Clear all"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alerts list */}
      <div className="deck-alerts-list">
        {alerts.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: 40,
            color: 'var(--deck-text-muted)',
            fontSize: 12,
          }}>
            <Bell size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
            <div>No alerts yet.</div>
            <div>Gifts, follows, and events will appear here during your live stream.</div>
          </div>
        )}
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`deck-alert-item ${alert.read ? 'read' : 'unread'}`}
            onClick={() => !alert.read && markAlertRead(alert.id)}
          >
            <div className="deck-alert-icon">
              {ALERT_ICONS[alert.type] || ALERT_ICONS.system}
            </div>
            <div className="deck-alert-message">
              {alert.message}
            </div>
            <div className="deck-alert-time">
              {timeAgo(alert.timestamp)}
            </div>
            {!alert.read && (
              <div style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--deck-accent)',
                flexShrink: 0,
              }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
