import React, { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { useDeckStore } from '../../stores/deckStore';
import { useDeckPair, generatePairCode } from '../../hooks/useDeckPair';
import type { DeckPairMessage } from '../../hooks/useDeckPair';
import {
  X, Radio, CheckCircle
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
    setPhoneLink,
    setPairCode: storePairCode,
  } = useDeckStore();

  const [_installStatus, setInstallStatus] = useState<string>('checking');
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [deckJoined, setDeckJoined] = useState(false);
  const sendRef = useRef<((msg: any) => void) | null>(null);

  const handlePairMessage = useCallback((msg: DeckPairMessage) => {
    if (msg.type === 'deck-joined') {
      setDeckJoined(true);
      setDeckInstalled(true);
      setPhoneLink({
        status: 'connected',
        phoneReady: true,
        lastSeen: Date.now(),
      });
      sendRef.current?.({
        type: 'phone-ready',
        payload: {
          streamId: useDeckStore.getState().streamConfig.streamId,
          title: useDeckStore.getState().streamConfig.title,
          category: useDeckStore.getState().streamConfig.category,
        },
      });
    }
  }, [setDeckInstalled, setPhoneLink]);

  const { send, isConnected: isPairConnected } = useDeckPair({
    pairCode,
    onMessage: handlePairMessage,
  });

  // Keep ref in sync
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Check if Deck is already installed
  useEffect(() => {
    const checkInstalled = () => {
      if (window.location.pathname.startsWith('/deck') && isStandalone()) {
        setDeckInstalled(true);
        setInstallStatus('installed');
        return;
      }
      const deckFlag = localStorage.getItem('tc_deck_installed');
      if (deckFlag === 'true') {
        setDeckInstalled(true);
        setInstallStatus('installed');
        return;
      }
      const status = getInstallStatus(false);
      setInstallStatus(status);
    };
    checkInstalled();
  }, [setDeckInstalled]);

  // Send heartbeats to deck when paired
  useEffect(() => {
    if (!isPairConnected) return;
    const interval = setInterval(() => {
      send({
        type: 'phone-ready',
        payload: { streamId: useDeckStore.getState().streamConfig.streamId },
      });
    }, 5000);
    // Send immediately
    send({
      type: 'phone-ready',
      payload: { streamId: useDeckStore.getState().streamConfig.streamId },
    });
    return () => clearInterval(interval);
  }, [isPairConnected, send]);

  const handleConnectDeck = async () => {
    const code = generatePairCode();
    setPairCode(code);
    storePairCode(code);
    setDeckJoined(false);

    const deckUrl = `${window.location.origin}/deck/auth?pair=${code}`;
    try {
      const url = await QRCode.toDataURL(deckUrl, {
        width: 256,
        margin: 2,
        color: { dark: '#ffffff', light: '#00000000' },
      });
      setQrDataUrl(url);
    } catch {
      setQrDataUrl('');
    }
    setShowQrModal(true);
  };

  const handleCloseModal = () => {
    setShowQrModal(false);
    // Keep pairCode active so channel stays subscribed
  };

  const handleDismiss = () => {
    dismissInstallPrompt();
    onDismiss?.();
  };

  // Don't show if already installed or dismissed
  if (deckInstalled || !shouldShowInstallPrompt()) {
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
              {phoneLink.status === 'connected' ? 'Reconnect' : 'Connect Deck'}
            </button>
          </div>
          {showQrModal && (
            <QrModal
              qrDataUrl={qrDataUrl}
              pairCode={pairCode}
              deckJoined={deckJoined}
              onClose={handleCloseModal}
            />
          )}
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
          Scan the QR code with your other device to pair.
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
      {showQrModal && (
        <QrModal
          qrDataUrl={qrDataUrl}
          pairCode={pairCode}
          deckJoined={deckJoined}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}

function QrModal({
  qrDataUrl,
  pairCode,
  deckJoined,
  onClose,
}: {
  qrDataUrl: string;
  pairCode: string | null;
  deckJoined: boolean;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1a1a2e',
          border: '1px solid rgba(106, 0, 255, 0.3)',
          borderRadius: 16,
          padding: 24,
          maxWidth: 340,
          width: '90%',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: 16 }}>
            {deckJoined ? 'Deck Connected!' : 'Scan to Connect Deck'}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b6585',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {deckJoined ? (
          <div style={{ padding: '32px 16px' }}>
            <CheckCircle size={48} color="#22c55e" />
            <p style={{ color: '#22c55e', fontSize: 14, marginTop: 12, fontWeight: 600 }}>
              Your Deck device is now connected and ready to use.
            </p>
          </div>
        ) : (
          <>
            {qrDataUrl ? (
              <div style={{
                background: '#000',
                borderRadius: 12,
                padding: 16,
                display: 'inline-block',
                marginBottom: 12,
              }}>
                <img src={qrDataUrl} alt="Deck QR Code" style={{ width: 256, height: 256, display: 'block' }} />
              </div>
            ) : (
              <div style={{
                background: '#000',
                borderRadius: 12,
                padding: 32,
                marginBottom: 12,
                color: '#6b6585',
              }}>
                Failed to generate QR code
              </div>
            )}

            {pairCode && (
              <p style={{ margin: '8px 0', color: '#a855f7', fontSize: 18, fontWeight: 700, letterSpacing: 4 }}>
                {pairCode}
              </p>
            )}

            <p style={{ margin: 0, color: '#6b6585', fontSize: 12 }}>
              Scan with your camera or enter the code on your Deck device.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
