// Perk Effect Implementations
// Real-time logic for applying perk effects throughout the app

import { isPerkActive, type PerkKey } from './perkSystem';

/**
 * GHOST MODE (30m)
 * Hide user from viewer lists and online status
 */
export async function shouldHideUserFromViewers(userId: string): Promise<boolean> {
  return await isPerkActive(userId, 'perk_ghost_mode');
}

/**
 * DISAPPEARING CHATS (30m)
 * Auto-hide chat messages after 10 seconds
 */
export async function shouldAutoHideMessage(userId: string): Promise<boolean> {
  return await isPerkActive(userId, 'perk_disappear_chat');
}

/**
 * MESSAGE ADMIN (Officer Only)
 * Unlock DM button to admin
 */
export async function canMessageAdmin(userId: string): Promise<boolean> {
  return await isPerkActive(userId, 'perk_message_admin');
}

/**
 * GLOWING USERNAME (1h)
 * Add neon glow effect to username
 */
export async function getUsernameGlowClass(userId: string): Promise<string> {
  if (await isPerkActive(userId, 'perk_rgb_username')) {
    return 'rgb-username';
  }
  const isActive = await isPerkActive(userId, 'perk_global_highlight');
  return isActive ? 'glowing-username' : '';
}

/**
 * SLOW-MOTION CHAT CONTROL (5hrs)
 * Allow user to toggle slow mode in streams
 */
export async function canControlSlowMode(userId: string): Promise<boolean> {
  return await isPerkActive(userId, 'perk_slowmo_chat');
}

/**
 * TROLL ALARM ARRIVAL (100hrs)
 * Play sound + flash when user joins
 */
export async function shouldPlayArrivalEffects(userId: string): Promise<boolean> {
  return await isPerkActive(userId, 'perk_troll_alarm');
}

/**
 * BAN SHIELD (2hrs)
 * Prevent moderation actions on user
 */
export async function isProtectedFromModeration(userId: string): Promise<boolean> {
  return await isPerkActive(userId, 'perk_ban_shield');
}

/**
 * DOUBLE XP MODE (1h)
 * Multiply XP rewards by 2
 */
export async function getXPMultiplier(userId: string): Promise<number> {
  const isActive = await isPerkActive(userId, 'perk_double_xp');
  return isActive ? 2 : 1;
}

/**
 * GOLDEN FLEX BANNER (100h)
 * Show golden crown banner on messages
 */
export async function shouldShowGoldenBanner(userId: string): Promise<boolean> {
  return await isPerkActive(userId, 'perk_flex_banner');
}

/**
 * TROLL SPELL (1h)
 * Allow user to change another user's username style temporarily
 */
export async function canCastTrollSpell(userId: string): Promise<boolean> {
  return await isPerkActive(userId, 'perk_troll_spell');
}

/**
 * UTILITY FUNCTIONS FOR PERK EFFECTS
 */

/**
 * Apply disappearing chat effect to a message
 */
export function applyDisappearingChat(messageElement: HTMLElement, userId: string) {
  shouldAutoHideMessage(userId).then(shouldHide => {
    if (shouldHide) {
      setTimeout(() => {
        messageElement.style.opacity = '0.3';
        messageElement.style.pointerEvents = 'none';
        // Optionally remove completely after another delay
        setTimeout(() => {
          messageElement.style.display = 'none';
        }, 2000);
      }, 10000); // 10 seconds
    }
  });
}

/**
 * Apply glowing username effect
 */
export function applyGlowingUsername(usernameElement: HTMLElement, userId: string) {
  getUsernameGlowClass(userId).then(glowClass => {
    if (glowClass) {
      usernameElement.classList.add(glowClass);
    }
  });
}

/**
 * Play arrival sound and flash effect
 */
export function playArrivalEffects(userId: string) {
  shouldPlayArrivalEffects(userId).then(shouldPlay => {
    if (shouldPlay) {
      // Play sound
      const audio = new Audio('/sounds/troll-alarm.mp3');
      audio.volume = 0.5;
      audio.play().catch(err => console.log('Audio play failed:', err));

      // Flash effect
      const flash = document.createElement('div');
      flash.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: white;
        opacity: 0.8;
        z-index: 9999;
        pointer-events: none;
        animation: flash 0.5s ease-out;
      `;
      document.body.appendChild(flash);
      setTimeout(() => document.body.removeChild(flash), 500);
    }
  });
}

/**
 * Check if moderation action should be blocked
 */
export async function shouldBlockModeration(targetUserId: string, action: 'kick' | 'mute' | 'ban'): Promise<boolean> {
  return await isProtectedFromModeration(targetUserId);
}

/**
 * Calculate XP with multiplier
 */
export async function calculateXP(baseXP: number, userId: string): Promise<number> {
  const multiplier = await getXPMultiplier(userId);
  return Math.floor(baseXP * multiplier);
}

/**
 * Get message styling for golden banner
 */
export async function getMessageBannerStyle(userId: string): Promise<string> {
  const shouldShow = await shouldShowGoldenBanner(userId);
  return shouldShow ? 'golden-banner' : '';
}

/**
 * CSS for glowing username effect (to be added to global styles)
 */
export const GLOWING_USERNAME_CSS = `
@keyframes glow {
  from { text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #fff, 0 0 20px #FFC93C; }
  to { text-shadow: 0 0 10px #FFC93C, 0 0 20px #FFC93C, 0 0 30px #FFC93C, 0 0 40px #FFD700; }
}

.glowing-username {
  animation: glow 2s ease-in-out infinite alternate;
  color: #FFD700;
  font-weight: bold;
}

@keyframes flash {
  0% { opacity: 0.8; }
  100% { opacity: 0; }
}
`;
