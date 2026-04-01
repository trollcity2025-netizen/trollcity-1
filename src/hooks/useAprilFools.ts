/**
 * useAprilFools - React hook for the April Fools Chaos Mode event.
 *
 * Manages prank triggering, popup display, coin balance spoofing,
 * and UI chaos effects. Respects the 2-prank-per-user limit and
 * automatically disables at 23:59 on April 1st.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  isAprilFoolsActive,
  canTriggerPrank,
  recordPrankUsed,
  selectRandomPrank,
  getRandomPopup,
  getRandomLoadingMessage,
  getRandomRealityMessage,
  getRandomPresidentAnnouncement,
  getRandomFakeNotification,
  getRandomFakeItem,
  getRandomFakeCharge,
  getRemainingPranks,
  getMsUntilAprilFoolsEnds,
  APRIL_FOOLS_CSS,
  type PrankType,
  type PopupMessage,
  type PrankDefinition,
} from '../lib/events/aprilFools';

export interface AprilFoolsState {
  isActive: boolean;
  remainingPranks: number;
  showPopup: boolean;
  popupData: PopupMessage | null;
  // Coin prank state
  spoofedBalance: number | null; // null = no spoof, use real balance
  originalBalance: number | null;
  // UI chaos
  showRealityMessage: boolean;
  realityMessage: string;
  showPresidentAnnouncement: boolean;
  presidentMessage: string;
  fakeNotification: string | null;
  // Active prank type for fine-grained UI control
  activePrank: PrankType | null;
}

const INITIAL_STATE: AprilFoolsState = {
  isActive: false,
  remainingPranks: 2,
  showPopup: false,
  popupData: null,
  spoofedBalance: null,
  originalBalance: null,
  showRealityMessage: false,
  realityMessage: '',
  showPresidentAnnouncement: false,
  presidentMessage: '',
  fakeNotification: null,
  activePrank: null,
};

export function useAprilFools(realBalance?: number) {
  const [state, setState] = useState<AprilFoolsState>(INITIAL_STATE);
  const cssInjectedRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const autoDisableTimerRef = useRef<number | null>(null);

  // Inject CSS on mount
  useEffect(() => {
    if (cssInjectedRef.current) return;
    cssInjectedRef.current = true;
    const style = document.createElement('style');
    style.id = 'april-fools-css';
    style.textContent = APRIL_FOOLS_CSS;
    document.head.appendChild(style);
    return () => {
      const existing = document.getElementById('april-fools-css');
      if (existing) existing.remove();
    };
  }, []);

  // Check active state on mount and set auto-disable timer
  useEffect(() => {
    const checkActive = () => {
      const active = isAprilFoolsActive();
      setState(prev => ({
        ...prev,
        isActive: active,
        remainingPranks: getRemainingPranks(),
      }));

      // Auto-disable at 23:59
      if (active) {
        const msRemaining = getMsUntilAprilFoolsEnds();
        if (msRemaining > 0 && !autoDisableTimerRef.current) {
          autoDisableTimerRef.current = window.setTimeout(() => {
            // Restore everything and disable
            setState(prev => ({
              ...INITIAL_STATE,
              isActive: false,
              remainingPranks: prev.remainingPranks,
            }));
            // Remove chaos overlay
            document.querySelector('.af-chaos-overlay')?.remove();
            autoDisableTimerRef.current = null;
          }, msRemaining + 1000); // +1s buffer
        }
      }
    };

    checkActive();
    // Check every minute in case it crosses midnight or 23:59
    const interval = setInterval(checkActive, 60000);

    return () => {
      clearInterval(interval);
      if (autoDisableTimerRef.current) {
        clearTimeout(autoDisableTimerRef.current);
      }
      // Clean up all timers
      timersRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  // ── PRANK EXECUTION ────────────────────────────────────────

  const executePrank = useCallback((prank: PrankDefinition, currentBalance?: number) => {
    if (!canTriggerPrank()) return;

    recordPrankUsed(prank.type);

    switch (prank.type) {
      case 'coin_gain': {
        const originalBal = currentBalance ?? realBalance ?? 0;
        setState(prev => ({
          ...prev,
          activePrank: 'coin_gain',
          originalBalance: originalBal,
          spoofedBalance: originalBal + 1000000,
        }));
        // Show popup after brief delay
        const t1 = window.setTimeout(() => {
          const popup = getRandomPopup();
          setState(prev => ({
            ...prev,
            showPopup: true,
            popupData: popup,
          }));
        }, 1500);
        timersRef.current.push(t1);
        break;
      }

      case 'coin_loss': {
        const originalBal = currentBalance ?? realBalance ?? 0;
        setState(prev => ({
          ...prev,
          activePrank: 'coin_loss',
          originalBalance: originalBal,
          spoofedBalance: 0,
        }));
        const t1 = window.setTimeout(() => {
          const popup = getRandomPopup();
          setState(prev => ({
            ...prev,
            showPopup: true,
            popupData: popup,
          }));
        }, 1500);
        timersRef.current.push(t1);
        break;
      }

      case 'coin_spike': {
        const originalBal = currentBalance ?? realBalance ?? 0;
        const absurdAmount = 999999999999;
        setState(prev => ({
          ...prev,
          activePrank: 'coin_spike',
          originalBalance: originalBal,
          spoofedBalance: absurdAmount,
        }));
        const t1 = window.setTimeout(() => {
          const popup = getRandomPopup();
          setState(prev => ({
            ...prev,
            showPopup: true,
            popupData: popup,
          }));
        }, 2000);
        timersRef.current.push(t1);
        break;
      }

      case 'leaderboard_glitch':
      case 'fake_purchase':
      case 'jail_vip':
      case 'troll_wheel_nothing':
      case 'fake_charge':
      case 'invert_controls':
      case 'fake_ban': {
        // These show popup immediately
        const popup = getRandomPopup();
        setState(prev => ({
          ...prev,
          activePrank: prank.type,
          showPopup: true,
          popupData: popup,
        }));
        break;
      }

      case 'fake_notification': {
        const notif = getRandomFakeNotification();
        setState(prev => ({
          ...prev,
          activePrank: 'fake_notification',
          fakeNotification: notif,
        }));
        const t1 = window.setTimeout(() => {
          const popup = getRandomPopup();
          setState(prev => ({
            ...prev,
            showPopup: true,
            popupData: popup,
            fakeNotification: null,
          }));
        }, 3000);
        timersRef.current.push(t1);
        break;
      }

      case 'ui_rename': {
        setState(prev => ({
          ...prev,
          activePrank: 'ui_rename',
        }));
        const t1 = window.setTimeout(() => {
          const popup = getRandomPopup();
          setState(prev => ({
            ...prev,
            showPopup: true,
            popupData: popup,
          }));
        }, 5000);
        timersRef.current.push(t1);
        break;
      }

      case 'glitch_screen': {
        setState(prev => ({
          ...prev,
          activePrank: 'glitch_screen',
        }));
        // Show reality message during glitch
        const realityMsg = getRandomRealityMessage();
        setState(prev => ({
          ...prev,
          showRealityMessage: true,
          realityMessage: realityMsg,
        }));
        const t1 = window.setTimeout(() => {
          setState(prev => ({ ...prev, showRealityMessage: false }));
          const popup = getRandomPopup();
          setState(prev => ({
            ...prev,
            showPopup: true,
            popupData: popup,
          }));
        }, 3000);
        timersRef.current.push(t1);
        break;
      }
    }
  }, [realBalance]);

  // ── RANDOM PRANK TRIGGER ───────────────────────────────────

  const triggerRandomPrank = useCallback((currentBalance?: number) => {
    if (!isAprilFoolsActive() || !canTriggerPrank()) return false;
    const prank = selectRandomPrank();
    executePrank(prank, currentBalance);
    return true;
  }, [executePrank]);

  // ── DISMISS POPUP ──────────────────────────────────────────

  const dismissPopup = useCallback(() => {
    // Restore original balance if it was spoofed
    setState(prev => ({
      ...prev,
      showPopup: false,
      popupData: null,
      spoofedBalance: null,
      originalBalance: null,
      activePrank: null,
      remainingPranks: getRemainingPranks(),
    }));
  }, []);

  // ── RANDOM EVENTS (reality messages, president announcements) ─

  const triggerRandomEvent = useCallback(() => {
    if (!isAprilFoolsActive()) return;

    const eventRoll = Math.random();
    if (eventRoll < 0.4) {
      // Reality collapse message
      const msg = getRandomRealityMessage();
      setState(prev => ({ ...prev, showRealityMessage: true, realityMessage: msg }));
      const t = window.setTimeout(() => {
        setState(prev => ({ ...prev, showRealityMessage: false }));
      }, 4000);
      timersRef.current.push(t);
    } else if (eventRoll < 0.7) {
      // President announcement
      const msg = getRandomPresidentAnnouncement();
      setState(prev => ({ ...prev, showPresidentAnnouncement: true, presidentMessage: msg }));
      const t = window.setTimeout(() => {
        setState(prev => ({ ...prev, showPresidentAnnouncement: false }));
      }, 5000);
      timersRef.current.push(t);
    }
  }, []);

  // ── DISPLAY BALANCE ────────────────────────────────────────

  const displayBalance = state.spoofedBalance !== null
    ? state.spoofedBalance
    : (realBalance ?? 0);

  // ── EXPORTS ────────────────────────────────────────────────

  return {
    // State
    isActive: state.isActive,
    remainingPranks: state.remainingPranks,
    activePrank: state.activePrank,

    // Popup
    showPopup: state.showPopup,
    popupData: state.popupData,
    dismissPopup,

    // Coin spoof
    displayBalance,
    isBalanceSpoofed: state.spoofedBalance !== null,

    // UI chaos
    showRealityMessage: state.showRealityMessage,
    realityMessage: state.realityMessage,
    showPresidentAnnouncement: state.showPresidentAnnouncement,
    presidentMessage: state.presidentMessage,
    fakeNotification: state.fakeNotification,

    // Actions
    triggerRandomPrank,
    triggerRandomEvent,
    executePrank,

    // Helpers
    getRandomLoadingMessage,
  };
}
