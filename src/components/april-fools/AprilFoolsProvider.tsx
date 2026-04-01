/**
 * AprilFoolsProvider - Global April Fools Chaos Mode layer.
 *
 * Wraps the app and handles:
 * - Random prank triggering (max 2 per day)
 * - Reality collapse messages
 * - Troll President announcements
 * - Scanline chaos overlay
 * - Easter egg: tapping logo flips UI
 * - Auto-disable at 23:59 on April 1st
 *
 * Does NOT modify real coin balances. Coin pranks are visual only.
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAprilFools } from '../../hooks/useAprilFools';
import AprilFoolsPopup from './AprilFoolsPopup';
import { useCoins } from '../../lib/hooks/useCoins';

// ── LOGO FLIP EASTER EGG ─────────────────────────────────────

const LOGO_FLIP_KEY = 'tc_af_logo_flips';

export default function AprilFoolsProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { troll_coins } = useCoins();
  const {
    isActive,
    showPopup,
    popupData,
    dismissPopup,
    showRealityMessage,
    realityMessage,
    showPresidentAnnouncement,
    presidentMessage,
    fakeNotification,
    triggerRandomPrank,
    triggerRandomEvent,
    remainingPranks,
  } = useAprilFools(troll_coins);

  const [logoFlipped, setLogoFlipped] = useState(false);
  const lastPrankRouteRef = useRef<string>('');
  const chaosOverlayRef = useRef<HTMLDivElement | null>(null);
  const eventIntervalRef = useRef<number | null>(null);

  // Inject chaos overlay when active
  useEffect(() => {
    if (isActive) {
      if (!chaosOverlayRef.current) {
        const overlay = document.createElement('div');
        overlay.className = 'af-chaos-overlay';
        overlay.style.cssText = `
          position: fixed; inset: 0; pointer-events: none; z-index: 9998;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(138, 43, 226, 0.03) 2px, rgba(138, 43, 226, 0.03) 4px);
          mix-blend-mode: screen;
        `;
        document.body.appendChild(overlay);
        chaosOverlayRef.current = overlay;
      }
    } else {
      if (chaosOverlayRef.current) {
        chaosOverlayRef.current.remove();
        chaosOverlayRef.current = null;
      }
    }
    return () => {
      if (chaosOverlayRef.current) {
        chaosOverlayRef.current.remove();
        chaosOverlayRef.current = null;
      }
    };
  }, [isActive]);

  // Random events every 45-90 seconds while active
  useEffect(() => {
    if (!isActive) {
      if (eventIntervalRef.current) {
        clearInterval(eventIntervalRef.current);
        eventIntervalRef.current = null;
      }
      return;
    }

    const scheduleNext = () => {
      const delay = 45000 + Math.random() * 45000; // 45-90 seconds
      return window.setTimeout(() => {
        triggerRandomEvent();
        eventIntervalRef.current = scheduleNext();
      }, delay);
    };

    eventIntervalRef.current = scheduleNext();
    return () => {
      if (eventIntervalRef.current) {
        clearTimeout(eventIntervalRef.current);
      }
    };
  }, [isActive, triggerRandomEvent]);

  // Trigger pranks on route changes (25% chance per navigation, max 2 total)
  useEffect(() => {
    if (!isActive) return;
    if (!canTriggerPrankSafe()) return;
    if (location.pathname === lastPrankRouteRef.current) return;
    if (location.pathname === '/' || location.pathname === '/auth') return; // Don't prank on home/auth

    lastPrankRouteRef.current = location.pathname;

    // 25% chance to trigger a prank on navigation
    if (Math.random() < 0.25) {
      // Small delay to let the page load
      const t = window.setTimeout(() => {
        triggerRandomPrank(troll_coins);
      }, 1000 + Math.random() * 2000);
      return () => clearTimeout(t);
    }
  }, [location.pathname, isActive, triggerRandomPrank, troll_coins]);

  // Easter egg: logo tap to flip UI
  useEffect(() => {
    const handleLogoTap = () => {
      const flips = parseInt(localStorage.getItem(LOGO_FLIP_KEY) || '0') + 1;
      localStorage.setItem(LOGO_FLIP_KEY, String(flips));

      if (flips >= 5) {
        setLogoFlipped(prev => !prev);
        localStorage.setItem(LOGO_FLIP_KEY, '0');
      }
    };

    // Listen for clicks on logo-like elements
    const logoSelectors = '[class*="logo"], [class*="Logo"], [alt*="Troll"], [alt*="logo"]';
    const logos = document.querySelectorAll(logoSelectors);
    logos.forEach(el => el.addEventListener('click', handleLogoTap));

    return () => {
      logos.forEach(el => el.removeEventListener('click', handleLogoTap));
    };
  }, [location.pathname]); // Re-bind on route change

  if (!isActive) {
    return <>{children}</>;
  }

  return (
    <div style={logoFlipped ? { transform: 'scaleY(-1)' } : undefined}>
      {children}

      {/* April Fools Popup */}
      {showPopup && popupData && (
        <AprilFoolsPopup popup={popupData} onDismiss={dismissPopup} />
      )}

      {/* Reality Collapse Message */}
      {showRealityMessage && (
        <div style={{
          position: 'fixed',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          backdropFilter: 'blur(12px)',
          color: '#fca5a5',
          padding: '10px 24px',
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 600,
          zIndex: 9997,
          pointerEvents: 'none',
          animation: 'popIn 0.3s ease-out',
          textAlign: 'center',
          maxWidth: '90%',
          whiteSpace: 'nowrap',
        }}>
          {realityMessage}
        </div>
      )}

      {/* Troll President Announcement */}
      {showPresidentAnnouncement && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(239, 68, 68, 0.2))',
          border: '1px solid rgba(245, 158, 11, 0.5)',
          backdropFilter: 'blur(12px)',
          color: '#fcd34d',
          padding: '12px 28px',
          borderRadius: 16,
          fontSize: 13,
          fontWeight: 700,
          zIndex: 9997,
          pointerEvents: 'none',
          animation: 'popIn 0.4s ease-out',
          textAlign: 'center',
          maxWidth: '90%',
        }}>
          {presidentMessage}
        </div>
      )}

      {/* Fake Notification Toast */}
      {fakeNotification && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
          border: '1px solid #8b5cf6',
          backdropFilter: 'blur(12px)',
          color: 'white',
          padding: '14px 20px',
          borderRadius: 14,
          fontSize: 13,
          fontWeight: 600,
          zIndex: 9999,
          pointerEvents: 'none',
          animation: 'popIn 0.3s ease-out',
          maxWidth: 320,
          boxShadow: '0 8px 32px rgba(139, 92, 246, 0.4)',
        }}>
          🎭 {fakeNotification}
        </div>
      )}

      {/* Prank Counter (subtle) */}
      {remainingPranks > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 6,
          right: 6,
          fontSize: 9,
          color: 'rgba(139, 92, 246, 0.4)',
          pointerEvents: 'none',
          fontFamily: 'monospace',
          zIndex: 9996,
        }}>
          chaos: {remainingPranks} left
        </div>
      )}
    </div>
  );
}

// Import from the hook module
function canTriggerPrankSafe(): boolean {
  try {
    const raw = localStorage.getItem('tc_april_fools_2026');
    if (!raw) return true;
    const state = JSON.parse(raw);
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (state.date !== todayKey) return true;
    return state.count < 2;
  } catch {
    return true;
  }
}
