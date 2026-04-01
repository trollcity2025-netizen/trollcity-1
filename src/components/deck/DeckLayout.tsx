import React, { useEffect, useState } from 'react';
import { useDeckStore } from '../../stores/deckStore';
import { supabase } from '../../lib/supabase';
import {
  Radio, Settings, MessageSquare, BarChart3, Shield, Bell, Layout,
  LogOut, Smartphone, Wifi, WifiOff
} from 'lucide-react';

interface DeckLayoutProps {
  children: React.ReactNode;
}

export default function DeckLayout({ children }: DeckLayoutProps) {
  const {
    session,
    sessionStatus,
    phoneLink,
    streamConfig,
    activePanel,
    unreadAlertCount,
    setActivePanel,
    validateSession,
    clearSession,
    setPhoneLink,
  } = useDeckStore();

  const [sessionTimeLeft, setSessionTimeLeft] = useState<string>('');

  // Validate session on mount and periodically
  useEffect(() => {
    const checkSession = () => {
      if (!validateSession()) return;
      const s = useDeckStore.getState().session;
      if (!s) return;
      const remaining = s.expiresAt - Date.now();
      if (remaining <= 0) return;

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      setSessionTimeLeft(`${hours}h ${minutes}m`);
    };

    checkSession();
    const interval = setInterval(checkSession, 30000);
    return () => clearInterval(interval);
  }, [validateSession]);

  // Periodic heartbeat check for phone connection
  useEffect(() => {
    const interval = setInterval(() => {
      const { phoneLink: link } = useDeckStore.getState();
      if (link.lastSeen && Date.now() - link.lastSeen > 30000) {
        setPhoneLink({ status: 'disconnected', phoneReady: false });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [setPhoneLink]);

  const handleSignOut = async () => {
    clearSession();
    localStorage.removeItem('tc_deck_pair_code');
    await supabase.auth.signOut();
    window.location.href = '/deck';
  };

  const navItems = [
    { id: 'setup' as const, label: 'Setup', icon: Settings },
    { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
    { id: 'moderation' as const, label: 'Mod', icon: Shield },
    { id: 'alerts' as const, label: 'Alerts', icon: Bell, badge: unreadAlertCount },
    { id: 'addons' as const, label: 'Addons', icon: Layout },
  ];

  const connectionLabel = phoneLink.status === 'connected'
    ? 'Phone Connected'
    : phoneLink.status === 'connecting'
    ? 'Connecting...'
    : 'Phone Disconnected';

  return (
    <div className="deck-app">
      <div className="deck-layout">
        {/* Header */}
        <header className="deck-header">
          <div className="deck-header-brand">
            <Radio size={18} color="#6a00ff" />
            <h1>DECK</h1>
            <span className="deck-badge">Broadcast Control</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {streamConfig.isLive && (
              <div className="deck-live-badge">
                <div className="deck-live-dot" />
                LIVE
              </div>
            )}
            <div className="deck-connection-indicator">
              <div className={`deck-connection-dot ${phoneLink.status}`} />
              {phoneLink.status === 'connected' ? (
                <Smartphone size={13} />
              ) : (
                <WifiOff size={13} />
              )}
              <span>{connectionLabel}</span>
            </div>
            {session && (
              <div className={`deck-session-timer ${sessionTimeLeft.includes('0h') ? 'expiring-soon' : ''}`}>
                Session: {sessionTimeLeft}
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="deck-btn deck-btn-ghost deck-btn-sm"
              title="Sign Out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </header>

        {/* Navigation */}
        <nav className="deck-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`deck-nav-item ${activePanel === item.id ? 'active' : ''}`}
              onClick={() => setActivePanel(item.id)}
            >
              <item.icon size={14} />
              {item.label}
              {item.badge ? <span className="deck-nav-badge">{item.badge}</span> : null}
            </button>
          ))}
        </nav>

        {/* Main content */}
        <main className="deck-main">
          <div className="deck-panel">
            {children}
          </div>
        </main>
      </div>

      {/* Session expired overlay */}
      {sessionStatus === 'expired' && (
        <div className="deck-session-overlay">
          <div className="deck-session-card">
            <Wifi size={36} color="#f59e0b" />
            <h2>Session Expired</h2>
            <p>
              Your Troll City Deck session has expired after 24 hours.
              Please sign in again to continue managing your broadcast.
            </p>
            <button
              className="deck-btn deck-btn-primary deck-btn-lg deck-btn-block"
              onClick={handleSignOut}
            >
              Sign In Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
