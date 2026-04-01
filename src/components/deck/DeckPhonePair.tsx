import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../../lib/store';
import { useDeckStore } from '../../stores/deckStore';
import { supabase } from '../../lib/supabase';
import { renderPairCode, generatePairToken, createPairUrl } from '../../utils/deckQrCode';
import { QrCode, RefreshCw, CheckCircle, Loader2, Smartphone, X } from 'lucide-react';

interface DeckPhonePairProps {
  onClose: () => void;
  onPaired?: () => void;
}

const PAIR_CHANNEL_PREFIX = 'tc-deck-pair-';

export default function DeckPhonePair({ onClose, onPaired }: DeckPhonePairProps) {
  const { user } = useAuthStore();
  const { setPhoneLink, syncFromPhone } = useDeckStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasGeneratedRef = useRef(false);
  const [pairToken, setPairToken] = useState<string>('');
  const [pairUrl, setPairUrl] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [paired, setPaired] = useState(false);
  const [error, setError] = useState('');
  const [expiresIn, setExpiresIn] = useState<string>('');
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Generate a new pair token
  const generateToken = useCallback(async () => {
    if (!user?.id) return;
    setGenerating(true);
    setError('');

    try {
      // Invalidate any previous tokens for this user
      await supabase
        .from('deck_pair_tokens')
        .delete()
        .eq('user_id', user.id);

      const token = generatePairToken(user.id);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Store token in DB
      const { error: insertError } = await supabase
        .from('deck_pair_tokens')
        .insert({
          token,
          user_id: user.id,
          expires_at: expiresAt,
          used: false,
        });

      if (insertError) {
        // Table might not exist yet - fall back to local-only mode
        console.warn('[DeckPair] Could not store pair token in DB:', insertError.message);
      }

      const url = createPairUrl(token);
      setPairToken(token);
      setPairUrl(url);

      // Listen for pairing confirmation on this token's channel
      if (channelRef.current) {
        channelRef.current.close();
      }
      const channel = new BroadcastChannel(PAIR_CHANNEL_PREFIX + token);
      channelRef.current = channel;

      channel.onmessage = (event) => {
        const { type, payload } = event.data || {};
        if (type === 'phone-paired') {
          setPaired(true);
          setPhoneLink({
            status: 'connected',
            phoneReady: true,
            lastSeen: Date.now(),
            streamId: null,
          });

          // Close channel after successful pair
          setTimeout(() => {
            channel.close();
            onClose();
            // Auto-start broadcast after pairing
            if (onPaired) {
              onPaired();
            }
          }, 1500);
        } else if (type === 'phone-sync') {
          syncFromPhone(payload);
          setPhoneLink({
            status: 'connected',
            phoneReady: true,
            lastSeen: Date.now(),
          });
        }
      };
    } catch (err: any) {
      setError(err.message || 'Failed to generate pairing code');
    } finally {
      setGenerating(false);
    }
  }, [user?.id, setPhoneLink, syncFromPhone, onClose]);

  // Render QR code to canvas when token changes
  useEffect(() => {
    if (!canvasRef.current || !pairUrl) return;
    renderPairCode(canvasRef.current, pairUrl, {
      foreground: '#ffffff',
      background: 'transparent',
      size: 240,
    }).then((result) => {
      if (!result.success) {
        console.error('[DeckPair] QR render failed:', result.error.message);
      }
    });
  }, [pairUrl]);

  // Generate token on mount (once)
  useEffect(() => {
    if (hasGeneratedRef.current) return;
    hasGeneratedRef.current = true;
    generateToken();
    return () => {
      if (channelRef.current) {
        channelRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update expiry countdown
  useEffect(() => {
    const interval = setInterval(() => {
      if (!pairToken) return;
      // Tokens expire after 24 hours from generation
      const remaining = 24 * 60 * 60 * 1000; // simplified
      const mins = Math.floor(remaining / 60000);
      if (mins > 60) {
        setExpiresIn(`${Math.floor(mins / 60)}h ${mins % 60}m`);
      } else {
        setExpiresIn(`${mins}m`);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [pairToken]);

  // Invalidate token on logout
  useEffect(() => {
    if (!user?.id) return;

    const invalidate = async () => {
      await supabase
        .from('deck_pair_tokens')
        .delete()
        .eq('user_id', user.id);
    };

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        invalidate();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  if (paired) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
      }}>
        <div className="deck-card" style={{ textAlign: 'center', maxWidth: 360, margin: 0 }}>
          <CheckCircle size={48} color="var(--deck-success)" />
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '16px 0 8px' }}>
            Phone Connected!
          </h2>
          <p style={{ fontSize: 13, color: 'var(--deck-text-secondary)' }}>
            Your phone is now linked to Deck. You can start managing your broadcast.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: 16,
    }}
      onClick={onClose}
    >
      <div
        className="deck-card"
        style={{ textAlign: 'center', maxWidth: 380, width: '100%', margin: 0, position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'none',
            border: 'none',
            color: 'var(--deck-text-muted)',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <X size={16} />
        </button>

        <QrCode size={28} color="var(--deck-accent)" />
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '12px 0 4px' }}>
          Connect Your Phone
        </h2>
        <p style={{ fontSize: 12, color: 'var(--deck-text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
          Scan this code with your phone&apos;s camera to link it as your broadcast source device.
          This code is unique to your account.
        </p>

        {error && (
          <div className="deck-auth-error" style={{ marginBottom: 12, fontSize: 11 }}>
            {error}
          </div>
        )}

        {/* QR Code */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 16,
          padding: 16,
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: 12,
        }}>
          {generating ? (
            <div style={{ width: 240, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={32} className="animate-spin" color="var(--deck-text-muted)" />
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              style={{ width: 240, height: 240, imageRendering: 'pixelated' }}
            />
          )}
        </div>

        {/* Token display */}
        <div style={{
          background: 'var(--deck-bg-input)',
          borderRadius: 8,
          padding: '8px 12px',
          marginBottom: 12,
          fontFamily: 'monospace',
          fontSize: 12,
          color: 'var(--deck-text-secondary)',
          letterSpacing: 1,
          wordBreak: 'break-all',
        }}>
          {pairToken || 'Generating...'}
        </div>

        {/* Info */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
          <Smartphone size={13} color="var(--deck-text-muted)" />
          <span style={{ fontSize: 11, color: 'var(--deck-text-muted)' }}>
            Tied to: {user?.email || 'Your account'}
          </span>
        </div>

        {expiresIn && (
          <div style={{ fontSize: 10, color: 'var(--deck-text-muted)', marginBottom: 12 }}>
            Code expires in {expiresIn} or when you sign out
          </div>
        )}

        {/* Refresh button */}
        <button
          className="deck-btn deck-btn-ghost deck-btn-sm"
          onClick={generateToken}
          disabled={generating}
          style={{ width: '100%' }}
        >
          {generating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Generate New Code
        </button>

        <p style={{ fontSize: 10, color: 'var(--deck-text-muted)', marginTop: 12, lineHeight: 1.4 }}>
          Each code is tied to your account and expires after 24 hours or when you sign out.
          Generating a new code invalidates the previous one.
        </p>
      </div>
    </div>
  );
}
