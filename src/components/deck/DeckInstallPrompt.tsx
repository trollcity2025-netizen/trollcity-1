import React, { useState, useEffect } from 'react';
import { useDeckStore } from '../../stores/deckStore';
import {
  Download, ExternalLink, X, Radio, CheckCircle, Loader2
} from 'lucide-react';
import { isStandalone, getInstallStatus } from '../../pwa/install';

interface DeckInstallPromptProps {
  onDismiss?: () => void;
}

export default function DeckInstallPrompt({ onDismiss }: DeckInstallPromptProps) {
  const {
    deckInstalled,
    setDeckInstalled,
    dismissInstallPrompt,
    shouldShowInstallPrompt,
    phoneLink,
  } = useDeckStore();

  const [installing, setInstalling] = useState(false);
  const [_installStatus, setInstallStatus] = useState<string>('checking');
  const [showQrModal, setShowQrModal] = useState(false);

  // Check if Deck is already installed
  useEffect(() => {
    const checkInstalled = () => {
      // Check if we're in the Deck standalone app
      if (window.location.pathname.startsWith('/deck') && isStandalone()) {
        setDeckInstalled(true);
        setInstallStatus('installed');
        return;
      }

      // Check localStorage for deck installed flag
      const deckFlag = localStorage.getItem('tc_deck_installed');
      if (deckFlag === 'true') {
        setDeckInstalled(true);
        setInstallStatus('installed');
        return;
      }

      // Check if we can open the deck URL in standalone
      const status = getInstallStatus(false);
      setInstallStatus(status);
    };

    checkInstalled();
  }, [setDeckInstalled]);

  const handleConnectDeck = () => {
    setShowQrModal(true);
  };

  const handleDismiss = () => {
    dismissInstallPrompt();
    onDismiss?.();
  };

  // Don't show if already installed or dismissed
  if (deckInstalled || !shouldShowInstallPrompt()) {
    // Show connected status instead
    if (deckInstalled) {
      return (
        <>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 10,
            marginBottom: 12,
          }}>
            <CheckCircle size={18} color="#22c55e" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>
                Troll City Deck
              </div>
              <div style={{ fontSize: 11, color: '#6b6585' }}>
                {phoneLink.status === 'connected'
                  ? 'Connected and ready'
                  : 'Installed - Open Deck to connect'}
              </div>
            </div>
            <button
              onClick={handleConnectDeck}
              style={{
                padding: '6px 12px',
                background: 'rgba(106, 0, 255, 0.15)',
                border: '1px solid rgba(106, 0, 255, 0.4)',
                borderRadius: 6,
                color: '#a855f7',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Radio size={12} />
              Connect Deck
            </button>
          </div>
        </>
      );
    }
    return null;
  }

  return (
    <>
      <div className="deck-install-prompt" style={{ position: 'relative' }}>
        <button
          onClick={handleDismiss}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'none',
            border: 'none',
            color: '#6b6585',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <X size={14} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <Radio size={20} color="#6a00ff" />
          <h3 style={{ margin: 0 }}>Troll City Deck</h3>
        </div>

        <p style={{ margin: 0 }}>
          Connect Deck to manage your broadcast from a second screen.
          Scan the QR code with your phone to link it.
        </p>

        <div className="deck-install-actions" style={{ marginTop: 14 }}>
          <button
            className="deck-btn deck-btn-primary"
            onClick={handleConnectDeck}
          >
            <Radio size={14} />
            Connect Deck
          </button>
          <button
            className="deck-btn deck-btn-ghost"
            onClick={handleDismiss}
          >
            Later
          </button>
        </div>
      </div>
    </>
  );
}
