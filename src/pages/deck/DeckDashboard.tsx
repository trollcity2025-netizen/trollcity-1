import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../lib/store';
import { useDeckStore } from '../../stores/deckStore';
import { useDeckPair, DECK_PAIR_STORAGE_KEY } from '../../hooks/useDeckPair';
import type { DeckPairMessage } from '../../hooks/useDeckPair';
import { useDeckPWA } from '../../pwa/useDeckPWA';
import DeckLayout from '../../components/deck/DeckLayout';
import DeckStreamSetup from '../../components/deck/DeckStreamSetup';
import DeckChat from '../../components/deck/DeckChat';
import DeckAnalytics from '../../components/deck/DeckAnalytics';
import DeckAlerts from '../../components/deck/DeckAlerts';
import DeckModeration from '../../components/deck/DeckModeration';
import DeckAddonsEditor from '../../components/deck/DeckAddonsEditor';
import '../../features/deck/styles/deck.css';

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

  const [pairCode, setPairCode] = useState<string | null>(null);

  // Read pair code from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(DECK_PAIR_STORAGE_KEY);
    if (stored) {
      setPairCode(stored);
    }
  }, []);

  // Validate session on mount
  useEffect(() => {
    if (!session || !validateSession()) {
      if (!user) {
        navigate('/deck/auth', { replace: true });
        return;
      }
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

  const handlePairMessage = useCallback((msg: DeckPairMessage) => {
    switch (msg.type) {
      case 'phone-sync':
        syncFromPhone(msg.payload as any);
        setPhoneLink({
          status: 'connected',
          phoneReady: true,
          lastSeen: Date.now(),
          streamId: (msg.payload as any)?.streamId || null,
        });
        break;
      case 'phone-ready':
        setPhoneLink({
          status: 'connected',
          phoneReady: true,
          lastSeen: Date.now(),
          streamId: (msg.payload as any)?.streamId || null,
        });
        break;
      case 'phone-stream-stats':
        setStreamStats(msg.payload as any);
        break;
      case 'phone-chat-message':
        addChatMessage(msg.payload as any);
        break;
      case 'phone-alert':
        addAlert(msg.payload as any);
        break;
      case 'phone-stream-started':
        useDeckStore.getState().updateStreamConfig({
          isLive: true,
          streamId: (msg.payload as any)?.streamId || null,
        });
        setPhoneLink({
          status: 'connected',
          phoneReady: true,
          streamId: (msg.payload as any)?.streamId || null,
          lastSeen: Date.now(),
        });
        break;
      case 'phone-stream-ended':
        useDeckStore.getState().updateStreamConfig({
          isLive: false,
          streamId: null,
        });
        break;
      case 'phone-disconnected':
        setPhoneLink({
          status: 'disconnected',
          phoneReady: false,
        });
        break;
    }
  }, [syncFromPhone, setPhoneLink, setStreamStats, addChatMessage, addAlert]);

  const { send, isConnected: isPairConnected } = useDeckPair({
    pairCode,
    onMessage: handlePairMessage,
  });

  // Send deck-joined message when connected to the pair channel
  useEffect(() => {
    if (isPairConnected && user) {
      send({
        type: 'deck-joined',
        userId: user.id,
      });
      setPhoneLink({
        status: 'connected',
        phoneReady: true,
        lastSeen: Date.now(),
      });
    }
  }, [isPairConnected, user, send, setPhoneLink]);

  // Periodic phone heartbeat check
  useEffect(() => {
    const interval = setInterval(() => {
      const link = useDeckStore.getState().phoneLink;
      if (link.lastSeen && Date.now() - link.lastSeen > 30000) {
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
