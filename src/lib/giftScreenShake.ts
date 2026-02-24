// Gift Screen Shake - Handles screen shake effect for high-value gifts

const SHAKE_THRESHOLD = 2500; // Gifts >= 2500 trigger shake
const SHAKE_DURATION = 500; // ms
const SHAKE_INTENSITY = 8; // pixels

let isShaking = false;
let shakeTimeoutId: ReturnType<typeof setTimeout> | null = null;

// CSS animation keyframes injected into document
const SHAKE_CSS = `
  @keyframes giftShakeX {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-${SHAKE_INTENSITY}px); }
    20%, 40%, 60%, 80% { transform: translateX(${SHAKE_INTENSITY}px); }
  }
  
  @keyframes giftShakeY {
    0%, 100% { transform: translateY(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateY(-${SHAKE_INTENSITY}px); }
    20%, 40%, 60%, 80% { transform: translateY(${SHAKE_INTENSITY}px); }
  }
  
  .gift-screen-shake {
    animation: giftShakeX 0.5s ease-in-out, giftShakeY 0.5s ease-in-out;
    will-change: transform;
  }
`;

// Inject CSS once
let cssInjected = false;

function injectShakeCSS(): void {
  if (cssInjected) return;
  
  const style = document.createElement('style');
  style.textContent = SHAKE_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

export function triggerScreenShake(cost: number): void {
  // Only shake for high-value gifts
  if (cost < SHAKE_THRESHOLD) {
    return;
  }

  // Don't trigger if already shaking
  if (isShaking) {
    return;
  }

  injectShakeCSS();
  
  isShaking = true;
  
  // Apply to body or root element
  const root = document.body;
  root.classList.add('gift-screen-shake');
  
  // Clear any existing timeout
  if (shakeTimeoutId) {
    clearTimeout(shakeTimeoutId);
  }
  
  // Remove class after animation completes
  shakeTimeoutId = setTimeout(() => {
    root.classList.remove('gift-screen-shake');
    isShaking = false;
    shakeTimeoutId = null;
  }, SHAKE_DURATION);
}

export function isScreenShaking(): boolean {
  return isShaking;
}
