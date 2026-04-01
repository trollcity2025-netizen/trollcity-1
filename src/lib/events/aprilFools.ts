/**
 * Troll City April Fools "Chaos Mode" Event
 *
 * Active ONLY on April 1st. Disables at 23:59.
 * Max 2 pranks per user per day. All changes are visual/temporary.
 * Coin balance pranks NEVER modify real stored balances.
 */

// ── TIME CONTROL ──────────────────────────────────────────────

export function isAprilFoolsActive(): boolean {
  const now = new Date();
  // Only active on April 1st
  if (now.getMonth() !== 3 || now.getDate() !== 1) return false; // month is 0-indexed, 3 = April
  // Disable at 23:59 (i.e., active only before 23:59:00)
  if (now.getHours() === 23 && now.getMinutes() >= 59) return false;
  return true;
}

export function getMsUntilAprilFoolsEnds(): number {
  const now = new Date();
  if (now.getMonth() !== 3 || now.getDate() !== 1) return 0;
  const end = new Date(now.getFullYear(), 3, 1, 23, 59, 0, 0);
  return Math.max(0, end.getTime() - now.getTime());
}

// ── PRANK LIMIT TRACKING ──────────────────────────────────────

const PRANK_STORAGE_KEY = 'tc_april_fools_2026';
const MAX_PRANKS = 2;

interface PrankState {
  count: number;
  usedTypes: string[];
  date: string; // YYYY-MM-DD
}

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getPrankState(): PrankState {
  try {
    const raw = localStorage.getItem(PRANK_STORAGE_KEY);
    if (!raw) return { count: 0, usedTypes: [], date: getTodayKey() };
    const state: PrankState = JSON.parse(raw);
    // Reset if different day
    if (state.date !== getTodayKey()) {
      return { count: 0, usedTypes: [], date: getTodayKey() };
    }
    return state;
  } catch {
    return { count: 0, usedTypes: [], date: getTodayKey() };
  }
}

function savePrankState(state: PrankState): void {
  localStorage.setItem(PRANK_STORAGE_KEY, JSON.stringify(state));
}

export function canTriggerPrank(): boolean {
  if (!isAprilFoolsActive()) return false;
  return getPrankState().count < MAX_PRANKS;
}

export function recordPrankUsed(prankType: string): void {
  const state = getPrankState();
  state.count += 1;
  state.usedTypes.push(prankType);
  savePrankState(state);
}

export function getRemainingPranks(): number {
  return Math.max(0, MAX_PRANKS - getPrankState().count);
}

// ── PRANK TYPE DEFINITIONS ────────────────────────────────────

export type PrankType =
  | 'coin_gain'
  | 'coin_loss'
  | 'coin_spike'
  | 'leaderboard_glitch'
  | 'fake_purchase'
  | 'jail_vip'
  | 'troll_wheel_nothing'
  | 'fake_notification'
  | 'ui_rename'
  | 'glitch_screen'
  | 'fake_charge'
  | 'invert_controls'
  | 'fake_ban';

export interface PrankDefinition {
  type: PrankType;
  label: string;
  description: string;
  weight: number; // Higher = more likely to be selected
}

export const PRANK_POOL: PrankDefinition[] = [
  { type: 'coin_gain', label: 'Fake Coin Gain', description: 'Show +1,000,000 coins', weight: 3 },
  { type: 'coin_loss', label: 'Fake Coin Loss', description: 'Show balance dropping to 0', weight: 2 },
  { type: 'coin_spike', label: 'Fake Coin Spike', description: 'Show absurd balance', weight: 2 },
  { type: 'leaderboard_glitch', label: 'Leaderboard Glitch', description: 'User appears 5 times at #1', weight: 2 },
  { type: 'fake_purchase', label: 'Fake Purchase', description: '"Invisible Car" purchased for 999,999 coins', weight: 2 },
  { type: 'jail_vip', label: 'Jail VIP Upgrade', description: 'Jail presented as luxury upgrade', weight: 2 },
  { type: 'troll_wheel_nothing', label: 'Troll Wheel Nothing', description: 'Win "Emotional Damage"', weight: 3 },
  { type: 'fake_notification', label: 'Fake Notification', description: 'Fake reward/win notification', weight: 3 },
  { type: 'ui_rename', label: 'UI Rename Chaos', description: 'Labels temporarily renamed', weight: 2 },
  { type: 'glitch_screen', label: 'Screen Glitch', description: 'Brief visual glitch effect', weight: 2 },
  { type: 'fake_charge', label: 'Fake Court Charge', description: 'Charged with bad vibes', weight: 2 },
  { type: 'invert_controls', label: 'Invert Controls', description: 'UI elements shift on hover', weight: 1 },
  { type: 'fake_ban', label: 'Fake Ban Warning', description: '"You have been banned" → April Fools', weight: 1 },
];

export function selectRandomPrank(): PrankDefinition {
  const state = getPrankState();
  const available = PRANK_POOL.filter(p => !state.usedTypes.includes(p.type));
  const pool = available.length > 0 ? available : PRANK_POOL;

  const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
  let random = Math.random() * totalWeight;

  for (const prank of pool) {
    random -= prank.weight;
    if (random <= 0) return prank;
  }
  return pool[pool.length - 1];
}

// ── POPUP MESSAGES (25+ UNIQUE) ──────────────────────────────

export interface PopupMessage {
  title?: string;
  message: string;
  buttonText?: string;
}

export const POPUP_MESSAGES: PopupMessage[] = [
  { title: 'SIKE', message: 'April Fools 😈', buttonText: 'I knew it' },
  { title: 'Gotcha!', message: "You really thought that was real? That's cute.", buttonText: 'Wow' },
  { title: 'Trolled', message: 'Congratulations! You played yourself.', buttonText: 'Nice' },
  { title: '', message: 'Plot twist: none of that was real. Happy April Fools!', buttonText: 'LOL' },
  { title: 'Oops', message: "Just kidding! Your coins are fine. Probably. 👀", buttonText: 'Phew' },
  { title: 'Reality Check', message: "That was faker than the cake. Happy April Fools' Day!", buttonText: 'The cake IS a lie' },
  { title: 'LOL', message: "You should've seen your face. April Fools!", buttonText: '*sigh*' },
  { title: 'Denied', message: 'The Troll President has reviewed your case and says... NO. April Fools!', buttonText: 'Appeal' },
  { title: 'April Fools!', message: "If you fell for that, I have a bridge to sell you.", buttonText: 'How much?' },
  { title: 'Rekt', message: 'You just got trolled on the official day of trolling. Respect.', buttonText: 'GG' },
  { title: 'Whoopsie', message: "That was just a prank, bro. Your stuff is still here. Maybe.", buttonText: 'Check' },
  { title: '😎', message: 'Chaos Mode says: April Fools! No refunds.', buttonText: 'Fair enough' },
  { title: 'Hehe', message: "We're not sorry. Happy April Fools' Day from Troll City!", buttonText: 'You monsters' },
  { title: 'Surprise!', message: "What you just experienced was 100% fake. Unlike your student loans.", buttonText: 'Dark' },
  { title: 'PRANKED', message: "This message will self-destruct in 3... 2... just kidding. April Fools!", buttonText: 'You got me' },
  { title: 'Error 418', message: "I'm a teapot. And that was a prank. Happy April Fools!", buttonText: 'Brew coffee' },
  { title: 'Breaking News', message: 'Local user falls for obvious prank. More at 11. April Fools!', buttonText: 'Subscribe' },
  { title: 'Important', message: "This was a test of the Emergency Troll System. It was only a test. April Fools!", buttonText: 'I feel tested' },
  { title: 'Achievement Unlocked', message: '"Gullible" — Fell for an April Fools prank. Badge not actually unlocked.', buttonText: 'Aw man' },
  { title: 'Notice', message: "The previous event was brought to you by Chaos Mode. April Fools!", buttonText: 'I want a refund' },
  { title: 'Fourth Wall', message: "Yes, a developer sat down and intentionally wrote code to mess with you. April Fools!", buttonText: 'Respect the grind' },
  { title: '🎵', message: "Never gonna give you up, never gonna let you down... oh wait, I just did. April Fools!", buttonText: 'Classic' },
  { title: 'Science', message: "Studies show 100% of users who fall for pranks are awesome. Happy April Fools!", buttonText: 'I am awesome' },
  { title: 'Dispatch', message: "A team of trolls has been dispatched to your location. ETA: already there. April Fools!", buttonText: 'Run' },
  { title: 'Spoiler Alert', message: "The prank was the friends we made along the way. April Fools!", buttonText: 'Deep' },
  { title: 'Final Answer?', message: "Are you SURE you want to believe what you just saw? April Fools!", buttonText: 'I trust nothing now' },
  { title: 'System32', message: "Just kidding, we didn't delete anything. Or did we? April Fools!", buttonText: '😰' },
  { title: 'GG WP', message: 'You got outplayed by a calendar date. April Fools!', buttonText: 'Rematch' },
];

export function getRandomPopup(): PopupMessage {
  return POPUP_MESSAGES[Math.floor(Math.random() * POPUP_MESSAGES.length)];
}

// ── FAKE NOTIFICATION MESSAGES ────────────────────────────────

export const FAKE_NOTIFICATIONS = [
  'You won 10,000,000 coins! (Not really. April Fools!)',
  'Someone just gifted you a Lamborghini! Just kidding.',
  'You have been promoted to Troll President! April Fools!',
  'Your account has been upgraded to Premium Ultra Deluxe! (Nope)',
  'A mysterious stranger left you 1 billion coins! (April Fools)',
  'You are now #1 on the leaderboard! (In our hearts)',
  'New follower: @RealElonMusk! Just kidding, it\'s Dave.',
  'Your stream just hit 1 million viewers! (Off by a few zeros)',
  'Congratulations! You won a free trip to Troll City! (You\'re already here)',
  'ALERT: Your vibe check has failed. Retrying...',
];

export function getRandomFakeNotification(): string {
  return FAKE_NOTIFICATIONS[Math.floor(Math.random() * FAKE_NOTIFICATIONS.length)];
}

// ── UI RENAME MAP ─────────────────────────────────────────────

export const UI_RENAMES: Record<string, string> = {
  'Wallet': 'Probably Broke',
  'Leaderboard': 'Ego Rankings',
  'Jail': 'VIP Lounge',
  'Marketplace': 'Totally Legit Store',
  'Profile': 'Your Digital Face',
  'Settings': "Don't Touch These",
  'Notifications': 'Anxiety Inbox',
  'Followers': 'Stalkers',
  'Messages': 'Secrets',
  'Home': 'The Void',
  'Explore': 'Get Lost',
  'Broadcast': 'Main Character Mode',
  'Coins': 'Internet Points',
  'Troll Bank': 'Definitely Not Sketchy',
  'Church': 'Vibes Temple',
  'Events': 'Chaos Calendar',
  'Badges': 'Flex Tokens',
  'Stats': 'Numbers That Lie',
};

// ── FAKE LOADING MESSAGES ────────────────────────────────────

export const FAKE_LOADING_MESSAGES = [
  'Scanning your vibes...',
  'Calling the Troll President...',
  'Verifying your existence...',
  'Calculating your troll level...',
  'Downloading more RAM...',
  'Asking ChatGPT for advice...',
  'Counting all your coins by hand...',
  'Consulting the ancient trolls...',
  'Rewriting reality...',
  'Buffering your personality...',
  'Running vibe diagnostics...',
  'Negotiating with the server hamsters...',
];

export function getRandomLoadingMessage(): string {
  return FAKE_LOADING_MESSAGES[Math.floor(Math.random() * FAKE_LOADING_MESSAGES.length)];
}

// ── CSS GLITCH KEYFRAMES ─────────────────────────────────────

export const APRIL_FOOLS_CSS = `
@keyframes af-glitch {
  0% { transform: translate(0); filter: none; }
  20% { transform: translate(-2px, 1px); filter: hue-rotate(90deg); }
  40% { transform: translate(1px, -1px); filter: hue-rotate(180deg); }
  60% { transform: translate(-1px, 2px); filter: hue-rotate(270deg); }
  80% { transform: translate(2px, -1px); filter: hue-rotate(360deg); }
  100% { transform: translate(0); filter: none; }
}

@keyframes af-flicker {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
  52% { opacity: 1; }
  54% { opacity: 0.6; }
  56% { opacity: 1; }
}

@keyframes af-skew {
  0% { transform: skewX(0deg); }
  25% { transform: skewX(2deg); }
  50% { transform: skewX(0deg); }
  75% { transform: skewX(-2deg); }
  100% { transform: skewX(0deg); }
}

@keyframes af-rainbow {
  0% { filter: hue-rotate(0deg); }
  100% { filter: hue-rotate(360deg); }
}

@keyframes af-shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
  20%, 40%, 60%, 80% { transform: translateX(2px); }
}

.af-glitch-effect {
  animation: af-glitch 0.3s ease-in-out;
}

.af-flicker-effect {
  animation: af-flicker 2s ease-in-out infinite;
}

.af-skew-effect {
  animation: af-skew 3s ease-in-out infinite;
}

.af-rainbow-effect {
  animation: af-rainbow 2s linear infinite;
}

.af-shake-effect {
  animation: af-shake 0.5s ease-in-out;
}

.af-wobble-button:hover {
  animation: af-shake 0.3s ease-in-out;
  transform: rotate(2deg);
}

.af-chaos-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9998;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(138, 43, 226, 0.03) 2px,
    rgba(138, 43, 226, 0.03) 4px
  );
  mix-blend-mode: screen;
}

.af-popup-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease-out;
}

.af-popup-card {
  background: linear-gradient(135deg, #1a0533, #2d1b69);
  border: 2px solid #8b5cf6;
  border-radius: 20px;
  padding: 32px;
  max-width: 380px;
  width: 90%;
  text-align: center;
  box-shadow: 0 0 40px rgba(139, 92, 246, 0.3), 0 0 80px rgba(139, 92, 246, 0.1);
  animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.af-popup-title {
  font-size: 28px;
  font-weight: 900;
  background: linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 12px;
  letter-spacing: -0.5px;
}

.af-popup-message {
  color: #e2e8f0;
  font-size: 15px;
  line-height: 1.6;
  margin-bottom: 24px;
}

.af-popup-button {
  background: linear-gradient(135deg, #8b5cf6, #6d28d9);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 12px 32px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.5px;
}

.af-popup-button:hover {
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.5);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes popIn {
  from { opacity: 0; transform: scale(0.8) translateY(20px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

/* Reality collapse messages */
.af-reality-message {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  backdrop-filter: blur(12px);
  color: #fca5a5;
  padding: 10px 24px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  z-index: 9997;
  pointer-events: none;
  animation: popIn 0.3s ease-out, af-flicker 3s ease-in-out infinite;
  text-align: center;
  max-width: 90%;
  white-space: nowrap;
}

/* Troll President announcement */
.af-president-announcement {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(239, 68, 68, 0.2));
  border: 1px solid rgba(245, 158, 11, 0.5);
  backdrop-filter: blur(12px);
  color: #fcd34d;
  padding: 12px 28px;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 700;
  z-index: 9997;
  pointer-events: none;
  animation: popIn 0.4s ease-out;
  text-align: center;
  max-width: 90%;
}
`;

// ── REALITY COLLAPSE MESSAGES ─────────────────────────────────

export const REALITY_MESSAGES = [
  '⚠️ Reality integrity at 47%... stabilizing...',
  '🔮 The Troll Matrix is experiencing turbulence',
  '🌀 Dimensional rift detected in your area',
  '📡 Chaos Mode signal strength: OVER 9000',
  '🎭 The fourth wall is cracking...',
  '🧠 Your perception has been temporarily altered',
  '🔮 Reality is now optional',
  '⚡ Glitch in the Troll Matrix detected',
  '🌍 Welcome to the Upside Down of Troll City',
  '🎪 The circus has taken over',
];

export function getRandomRealityMessage(): string {
  return REALITY_MESSAGES[Math.floor(Math.random() * REALITY_MESSAGES.length)];
}

// ── TROLL PRESIDENT ANNOUNCEMENTS ─────────────────────────────

export const PRESIDENT_ANNOUNCEMENTS = [
  '🏛️ The Troll President has declared today "Opposite Day"',
  '👑 Executive Order #404: All coins are now imaginary',
  '📢 PSA: Nothing you see today can be trusted',
  '🎩 The President is "definitely not" behind any pranks',
  '🏛️ Troll City National Emergency: Too much chaos detected',
  '👑 By decree of the Troll President: gravity is now optional',
  '📢 The President reminds you: this is all in good fun',
  '🎩 Breaking: President admits to being "a little bit of a troll"',
];

export function getRandomPresidentAnnouncement(): string {
  return PRESIDENT_ANNOUNCEMENTS[Math.floor(Math.random() * PRESIDENT_ANNOUNCEMENTS.length)];
}

// ── FAKE ITEMS FOR PURCHASE PRANK ─────────────────────────────

export const FAKE_ITEMS = [
  { name: 'Invisible Car', price: 999999, emoji: '🚗💨' },
  { name: 'Premium Air™', price: 500000, emoji: '💨✨' },
  { name: 'Nothing (Deluxe Edition)', price: 750000, emoji: '📦' },
  { name: 'Astral Projection License', price: 1200000, emoji: '🌌' },
  { name: 'NFT of This Popup', price: 2000000, emoji: '🖼️' },
  { name: 'Time Travel Pass (Expired)', price: 888888, emoji: '⏰' },
];

export function getRandomFakeItem(): { name: string; price: number; emoji: string } {
  return FAKE_ITEMS[Math.floor(Math.random() * FAKE_ITEMS.length)];
}

// ── FAKE COURT CHARGES ────────────────────────────────────────

export const FAKE_CHARGES = [
  'Charged with bad vibes in the first degree',
  'Accused of excessive trolling (ironic, we know)',
  'Found guilty of being too based',
  'Charged with crimes against fashion',
  'Convicted of suspicious levels of sigma energy',
  'Indicted for unauthorized flexing',
  'Charged with grand theft vibe',
  'Found guilty of existing without a permit',
];

export function getRandomFakeCharge(): string {
  return FAKE_CHARGES[Math.floor(Math.random() * FAKE_CHARGES.length)];
}
