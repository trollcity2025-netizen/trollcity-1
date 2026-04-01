import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../lib/store';
import { useDeckStore } from '../../stores/deckStore';
import { useDeckPWA } from '../../pwa/useDeckPWA';
import DeckLayout from '../../components/deck/DeckLayout';
import DeckStreamSetup from '../../components/deck/DeckStreamSetup';
import DeckChat from '../../components/deck/DeckChat';
import DeckAnalytics from '../../components/deck/DeckAnalytics';
import DeckAlerts from '../../components/deck/DeckAlerts';
import DeckModeration from '../../components/deck/DeckModeration';
import DeckAddonsEditor from '../../components/deck/DeckAddonsEditor';
import '../../features/deck/styles/deck.css';

const DECK_SYNC_CHANNEL = 'trollcity-deck-sync';

export default function DeckDashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  useDeckPWA();
  const {
    session,
    activePanel,
    validateSession,
    setPhoneLink,
    syncFromPhone,
    setStreamStats,
    addChatMessage,
    addAlert,
    setHasQualityUpgrade,
  } = useDeckStore();

  // Validate session on mount
  useEffect(() => {
    if (!session || !validateSession()) {
      // Check if the main auth session exists
      if (!user) {
        navigate('/deck/auth', { replace: true });
        return;
      }
      // User is auth'd but Deck session expired - redirect to re-auth
      if (!session) {
        navigate('/deck/auth', { replace: true });
        return;
      }
    }
  }, [session, validateSession, user, navigate]);

  // Load quality upgrade status from profile
  useEffect(() => {
    if (profile?.deck_quality_upgrade) {
      setHasQualityUpgrade(true);
    }
  }, [profile, setHasQualityUpgrade]);

  // Listen for phone sync signals
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(DECK_SYNC_CHANNEL);
      channel.onmessage = (event) => {
        const { type, payload } = event.data || {};

        switch (type) {
          case 'phone-sync':
            syncFromPhone(payload);
            setPhoneLink({
              status: 'connected',
              phoneReady: true,
              lastSeen: Date.now(),
              streamId: payload?.streamId || null,
            });
            break;
          case 'phone-ready':
            setPhoneLink({
              status: 'connected',
              phoneReady: true,
              lastSeen: Date.now(),
              streamId: payload?.streamId || null,
            });
            break;
          case 'phone-stream-stats':
            setStreamStats(payload);
            break;
          case 'phone-chat-message':
            addChatMessage(payload);
            break;
          case 'phone-alert':
            addAlert(payload);
            break;
          case 'phone-stream-started':
            useDeckStore.getState().updateStreamConfig({
              isLive: true,
              streamId: payload?.streamId || null,
            });
            setPhoneLink({
              status: 'connected',
              phoneReady: true,
              streamId: payload?.streamId || null,
              lastSeen: Date.now(),
            });
            break;
          case 'phone-stream-ended':
            useDeckStore.getState().updateStreamConfig({
              isLive: false,
              streamId: null,
            });
            break;
        }
      };
    } catch {
      // BroadcastChannel not supported
    }

    // Storage-based fallback
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'tc_phone_sync' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          syncFromPhone(data.config || data);
          setPhoneLink({
            status: 'connected',
            phoneReady: true,
            lastSeen: Date.now(),
          });
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      channel?.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [setPhoneLink, syncFromPhone, setStreamStats, addChatMessage, addAlert]);

  // Periodic phone heartbeat check
  useEffect(() => {
    const interval = setInterval(() => {
      const link = useDeckStore.getState().phoneLink;
      if (link.lastSeen && Date.now() - link.lastSeen > 15000) {
        setPhoneLink({ status: 'disconnected', phoneReady: false });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [setPhoneLink]);

  const renderPanel = () => {
    switch (activePanel) {
      case 'setup':
        return <DeckStreamSetup />;
      case 'chat':
        return <DeckChat />;
      case 'analytics':
        return <DeckAnalytics />;
      case 'moderation':
        return <DeckModeration />;
      case 'alerts':
        return <DeckAlerts />;
      case 'addons':
        return <DeckAddonsEditor />;
      default:
        return <DeckStreamSetup />;
    }
  };

  return (
    <DeckLayout>
      {renderPanel()}
    </DeckLayout>
  );
}
