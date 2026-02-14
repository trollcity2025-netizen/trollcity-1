/**
 * Event System Usage Examples
 * 
 * This file demonstrates how to use the Global Event System.
 * Reference this when implementing event-aware features.
 */

import React from 'react';
import { useGlobalEvent } from '../../contexts/GlobalEventContext';
import { useEventGifts } from '../../lib/hooks/useEventGifts';
import { useEventBonuses } from '../../lib/hooks/useEventBonuses';
// import { useEventHighlights } from '../../lib/hooks/useEventHighlights';
import { useEventTheme } from '../GlobalEventThemeLayer';
// import type { EventGift, EventBonus } from '../../lib/events/types';

// ============================================================================
// Example 1: Basic Event Usage
// ============================================================================

export const EventBanner: React.FC = () => {
  const { activeEvent, featureFlags } = useGlobalEvent();

  if (!activeEvent) return null;

  return (
    <div 
      className="event-banner"
      style={{ 
        backgroundColor: featureFlags.hasEventTheme ? 'var(--event-primary)' : undefined 
      }}
    >
      <h2>🎉 {activeEvent.name}</h2>
      <p>{activeEvent.description}</p>
    </div>
  );
};

// ============================================================================
// Example 2: Gift Shop with Event Gifts
// ============================================================================

interface GiftShopProps {
  baseGifts: { id: string; name: string; emoji: string; price: number }[];
  userCoins: number;
}

export const GiftShopExample: React.FC<GiftShopProps> = ({ baseGifts: _baseGifts, userCoins: _userCoins }) => {
  const { activeEvent, featureFlags: _featureFlags } = useGlobalEvent();
  const { activeGifts, applyBonus, badgeLabel } = useEventGifts();
  const { hasBonuses, formatBonus } = useEventBonuses();
  const { isActive, buttonClass } = useEventTheme();

  return (
    <div className="gift-shop">
      {activeEvent && (
        <div className="event-header">
          <h3>🎊 {activeEvent.name}</h3>
          <p>{activeEvent.description}</p>
        </div>
      )}

      {badgeLabel && (
        <div className="limited-badge">⏰ {badgeLabel}</div>
      )}

      {hasBonuses && activeEvent?.bonuses?.map((bonus, i) => (
        <div key={i} className="bonus-badge">
          ⚡ {formatBonus(bonus)}
        </div>
      ))}

      <div className="gift-grid">
        {activeGifts.map((gift) => {
          const finalPrice = applyBonus(gift.coinPrice);
          return (
            <div 
              key={gift.id} 
              className={`gift-card ${isActive ? 'event-themed' : ''}`}
            >
              <span className="gift-emoji">{gift.emoji}</span>
              <span className="gift-name">{gift.name}</span>
              <span className="gift-price">
                {finalPrice} coins
              </span>
              <button className={isActive ? buttonClass : ''}>
                Send
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// Example 3: Stream Bonus Display
// ============================================================================

export const StreamBonuses: React.FC = () => {
  const { activeEvent } = useGlobalEvent();
  const { hasBonuses, xpMultiplier, streakBoost, formatBonus, activeBonuses } = useEventBonuses();

  if (!hasBonuses) return null;

  return (
    <div className="bonus-display">
      {activeEvent && <span className="event-label">🎉 {activeEvent.name}</span>}
      
      {activeBonuses.map((bonus, i) => (
        <span key={i} className="bonus-item">
          {formatBonus(bonus)}
        </span>
      ))}

      {xpMultiplier > 1 && (
        <span className="xp-badge">✨ +{Math.round((xpMultiplier - 1) * 100)}% XP</span>
      )}
      
      {streakBoost > 1 && (
        <span className="streak-badge">🔥 +{Math.round((streakBoost - 1) * 100)}% Streak</span>
      )}
    </div>
  );
};

// ============================================================================
// Example 4: Event Theme Button
// ============================================================================

interface EventButtonProps {
  children: React.ReactNode;
  onClick: () => void;
}

export const EventButton: React.FC<EventButtonProps> = ({ children, onClick }) => {
  const { isActive, buttonClass } = useEventTheme();

  return (
    <button 
      onClick={onClick}
      className={isActive ? buttonClass : ''}
      style={isActive ? { background: 'var(--event-primary)' } : undefined}
    >
      {children}
    </button>
  );
};

// ============================================================================
// Example 5: Pride-Safe Preferences
// ============================================================================

interface PridePreferencesProps {
  showPrideBadges: boolean;
  onUpdate: (value: boolean) => void;
}

export const PridePreferencesPanel: React.FC<PridePreferencesProps> = ({ 
  showPrideBadges, 
  onUpdate 
}) => {
  const { featureFlags } = useGlobalEvent();

  if (!featureFlags.isPrideEvent) return null;

  return (
    <div className="pride-preferences">
      <h3>🏳️‍🌈 Pride Preferences</h3>
      <label>
        <input
          type="checkbox"
          checked={showPrideBadges}
          onChange={(e) => onUpdate(e.target.checked)}
        />
        Show Pride badge on profile
      </label>
      <p className="privacy-note">
        🔒 Your preferences are private and never shared.
      </p>
    </div>
  );
};

// ============================================================================
// Example 6: Event Countdown Timer
// ============================================================================

export const EventCountdown: React.FC = () => {
  const { activeEvent, serverTime } = useGlobalEvent();

  if (!activeEvent) return null;

  const endTime = new Date(activeEvent.endTimestamp).getTime();
  const now = serverTime.getTime();
  const timeLeft = endTime - now;

  if (timeLeft <= 0) return null;

  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return (
    <div className="event-countdown">
      <span>⏰ Ends in {days}d {hours}h</span>
    </div>
  );
};

export default {
  EventBanner,
  GiftShopExample,
  StreamBonuses,
  EventButton,
  PridePreferencesPanel,
  EventCountdown,
};
