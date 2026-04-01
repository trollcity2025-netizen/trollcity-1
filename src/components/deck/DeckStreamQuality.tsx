import React, { useState } from 'react';
import { useDeckStore } from '../../stores/deckStore';
import { useAuthStore } from '../../lib/store';
import { Monitor, Zap, Lock, Unlock, Check, Loader2, Coins } from 'lucide-react';

export default function DeckStreamQuality() {
  const { user } = useAuthStore();
  const {
    streamConfig,
    hasQualityUpgrade,
    updateStreamConfig,
    purchaseQualityUpgrade,
  } = useDeckStore();

  const [purchasing, setPurchasing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');

  const currentQuality = streamConfig.quality;

  const handleQualityChange = (quality: '720p' | '1080p') => {
    if (quality === '1080p' && !hasQualityUpgrade) {
      setShowConfirm(true);
      return;
    }
    updateStreamConfig({ quality });
  };

  const handlePurchase = async () => {
    if (!user?.id) return;
    setPurchasing(true);
    setPurchaseError('');

    const result = await purchaseQualityUpgrade(user.id);
    if (!result.success) {
      setPurchaseError(result.error || 'Purchase failed');
    }
    setShowConfirm(false);
    setPurchasing(false);
  };

  return (
    <div className="deck-card">
      <div className="deck-card-header">
        <span className="deck-card-title">Stream Quality</span>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        {/* 720p option */}
        <button
          onClick={() => handleQualityChange('720p')}
          style={{
            flex: 1,
            padding: 14,
            background: currentQuality === '720p' ? 'rgba(106, 0, 255, 0.12)' : 'var(--deck-bg-input)',
            border: `2px solid ${currentQuality === '720p' ? 'var(--deck-accent)' : 'var(--deck-border)'}`,
            borderRadius: 'var(--deck-radius)',
            cursor: 'pointer',
            textAlign: 'center',
            color: 'var(--deck-text-primary)',
            transition: 'all 0.2s ease',
          }}
        >
          <Monitor size={20} style={{ marginBottom: 6 }} />
          <div style={{ fontSize: 14, fontWeight: 700 }}>720p</div>
          <div style={{ fontSize: 10, color: 'var(--deck-text-muted)', marginTop: 2 }}>Default</div>
          {currentQuality === '720p' && (
            <Check size={14} color="var(--deck-success)" style={{ marginTop: 4 }} />
          )}
        </button>

        {/* 1080p option */}
        <button
          onClick={() => handleQualityChange('1080p')}
          style={{
            flex: 1,
            padding: 14,
            background: currentQuality === '1080p' ? 'rgba(106, 0, 255, 0.12)' : 'var(--deck-bg-input)',
            border: `2px solid ${currentQuality === '1080p' ? 'var(--deck-accent)' : 'var(--deck-border)'}`,
            borderRadius: 'var(--deck-radius)',
            cursor: 'pointer',
            textAlign: 'center',
            color: 'var(--deck-text-primary)',
            transition: 'all 0.2s ease',
            position: 'relative',
          }}
        >
          <Zap size={20} style={{ marginBottom: 6 }} />
          <div style={{ fontSize: 14, fontWeight: 700 }}>1080p</div>
          <div style={{ fontSize: 10, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            {hasQualityUpgrade ? (
              <span className="deck-quality-badge unlocked">
                <Unlock size={10} /> Unlocked
              </span>
            ) : (
              <span className="deck-quality-badge locked">
                <Lock size={10} /> 200 Coins
              </span>
            )}
          </div>
          {currentQuality === '1080p' && (
            <Check size={14} color="var(--deck-success)" style={{ marginTop: 4 }} />
          )}
        </button>
      </div>

      {/* Purchase confirmation */}
      {showConfirm && !hasQualityUpgrade && (
        <div style={{
          background: 'var(--deck-bg-input)',
          border: '1px solid var(--deck-warning)',
          borderRadius: 'var(--deck-radius-sm)',
          padding: 14,
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Coins size={14} color="var(--deck-warning)" />
            Upgrade to 1080p
          </div>
          <div style={{ fontSize: 12, color: 'var(--deck-text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
            This will deduct <strong>200 Troll Coins</strong> from your balance and permanently unlock 1080p streaming quality for your account.
          </div>
          {purchaseError && (
            <div className="deck-auth-error" style={{ marginBottom: 10, fontSize: 11 }}>
              {purchaseError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="deck-btn deck-btn-success deck-btn-sm"
              onClick={handlePurchase}
              disabled={purchasing}
              style={{ flex: 1 }}
            >
              {purchasing ? <Loader2 size={12} className="animate-spin" /> : <Coins size={12} />}
              {purchasing ? 'Processing...' : 'Confirm Purchase'}
            </button>
            <button
              className="deck-btn deck-btn-ghost deck-btn-sm"
              onClick={() => setShowConfirm(false)}
              disabled={purchasing}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--deck-text-muted)' }}>
        Current: <strong style={{ color: 'var(--deck-text-primary)' }}>{currentQuality}</strong>
        {hasQualityUpgrade && ' (1080p permanently unlocked)'}
      </div>
    </div>
  );
}
