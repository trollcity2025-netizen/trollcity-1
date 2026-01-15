// Entrance Effects Animation Engine
// Real-time animations for stream entrances

import { getEntranceEffectConfig, getRoleBasedEffectConfig, type EntranceEffectKey } from './entranceEffects';

/**
 * Main entrance animation trigger
 */
export async function playEntranceAnimation(userId: string, effectKey: string, targetElement?: HTMLElement) {
  // Try role-based effect first
  let effectConfig = getRoleBasedEffectConfig(effectKey);

  // If not role-based, try regular effect
  if (!effectConfig) {
    effectConfig = getEntranceEffectConfig(effectKey as EntranceEffectKey);
  }

  if (!effectConfig) {
    console.error('Invalid entrance effect:', effectKey);
    return;
  }

  console.log(`🎬 Playing entrance animation: ${effectConfig.name} for user ${userId}`);

  // Play sound effect
  void playSoundEffect(effectConfig.soundEffect);

  // Play animation based on type
  const animationType = effectConfig.animationType;
  switch (animationType) {
    case 'flame':
      await showFlameBurstAnimation(targetElement);
      break;
    case 'money_shower':
      await showMoneyShowerAnimation(targetElement);
      break;
    case 'electric':
      await showElectricFlashAnimation(targetElement);
      break;
    case 'throne':
      await showRoyalThroneAnimation(targetElement);
      break;
    case 'rainbow':
      await showRainbowDescentAnimation(targetElement);
      break;
    case 'car':
      await showTrollRollupAnimation(targetElement);
      break;
    case 'siren':
      await showVIPSirenAnimation(targetElement);
      break;
    case 'firework':
      await showFireworkExplosionAnimation(targetElement);
      break;
    case 'king':
      await showTrollKingAnimation(targetElement);
      break;
    // Role-based animations
    case 'troll_city_ceo':
      await showTrollCityCeoAnimation(targetElement);
      break;
    case 'admin_divine':
      await showAdminDivineAnimation(targetElement);
      break;
    case 'admin_best':
      await showAdminDivineAnimation(targetElement);
      break;
    case 'lead_officer_elite':
      await showLeadOfficerEliteAnimation(targetElement);
      break;
    case 'officer_authority':
      await showOfficerAuthorityAnimation(targetElement);
      break;
    default:
      console.warn('Unknown animation type:', animationType);
  }
}

/**
 * Play sound effect for entrance
 */
async function playSoundEffect(soundKey: string) {
  const soundUrl = `/sounds/entrance/${soundKey}.mp3`;
  try {
    const response = await fetch(soundUrl);
    if (!response.ok) {
      console.log(`Sound file not found (${response.status}): ${soundUrl}`);
      return;
    }

    const blob = await response.blob();
    if (!blob || blob.size === 0) {
      console.log(`Sound file empty: ${soundKey}.mp3`);
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    audio.volume = 0.6;
    audio.addEventListener('ended', () => URL.revokeObjectURL(objectUrl));

    audio.play().catch(err => {
      console.log('Audio play failed (likely user interaction required):', err);
      URL.revokeObjectURL(objectUrl);
    });
  } catch (err) {
    console.log('Sound effect failed:', err);
  }
}

/**
 * FLAME BURST ANIMATION
 */
async function showFlameBurstAnimation(targetElement?: HTMLElement) {
  const container = targetElement || document.body;

  const flame = document.createElement('div');
  flame.className = 'entrance-animation flame-burst';
  flame.innerHTML = '🔥';

  // Position near the target or center screen
  if (targetElement) {
    const rect = targetElement.getBoundingClientRect();
    flame.style.left = `${rect.left + rect.width / 2 - 50}px`;
    flame.style.top = `${rect.top - 50}px`;
  } else {
    flame.style.left = '50%';
    flame.style.top = '40%';
    flame.style.transform = 'translate(-50%, -50%)';
  }

  container.appendChild(flame);

  // Animate
  flame.animate([
    { transform: 'scale(0) rotate(0deg)', opacity: 0 },
    { transform: 'scale(1.5) rotate(180deg)', opacity: 1 },
    { transform: 'scale(2) rotate(360deg)', opacity: 0 }
  ], {
    duration: 1500,
    easing: 'ease-out'
  });

  setTimeout(() => flame.remove(), 1500);
}

/**
 * MONEY SHOWER ANIMATION
 */
async function showMoneyShowerAnimation(targetElement?: HTMLElement) {
  const container = targetElement || document.body;

  for (let i = 0; i < 20; i++) {
    setTimeout(() => {
      const money = document.createElement('div');
      money.className = 'entrance-animation money-particle';
      money.innerHTML = '💰';

      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        money.style.left = `${rect.left + Math.random() * rect.width}px`;
        money.style.top = `${rect.top - 20}px`;
      } else {
        money.style.left = `${Math.random() * 100}vw`;
        money.style.top = '-50px';
      }

      container.appendChild(money);

      // Animate falling
      money.animate([
        { transform: 'translateY(0px) rotate(0deg)', opacity: 1 },
        { transform: 'translateY(500px) rotate(720deg)', opacity: 0 }
      ], {
        duration: 3000,
        easing: 'ease-in'
      });

      setTimeout(() => money.remove(), 3000);
    }, i * 100);
  }
}

/**
 * ELECTRIC FLASH ANIMATION
 */
async function showElectricFlashAnimation(targetElement?: HTMLElement) {
  const container = targetElement || document.body;

  const flash = document.createElement('div');
  flash.className = 'entrance-animation electric-flash';

  if (targetElement) {
    const rect = targetElement.getBoundingClientRect();
    flash.style.left = `${rect.left}px`;
    flash.style.top = `${rect.top}px`;
    flash.style.width = `${rect.width}px`;
    flash.style.height = `${rect.height}px`;
  } else {
    flash.style.left = '0';
    flash.style.top = '0';
    flash.style.width = '100vw';
    flash.style.height = '100vh';
  }

  container.appendChild(flash);

  // Lightning bolt effect
  flash.innerHTML = '⚡';
  flash.animate([
    { opacity: 0, transform: 'scale(0)' },
    { opacity: 1, transform: 'scale(1.2)' },
    { opacity: 0, transform: 'scale(1.5)' }
  ], {
    duration: 800,
    easing: 'ease-out'
  });

  setTimeout(() => flash.remove(), 800);
}

/**
 * ROYAL THRONE ANIMATION
 */
async function showRoyalThroneAnimation(targetElement?: HTMLElement) {
  const container = targetElement || document.body;

  const throne = document.createElement('div');
  throne.className = 'entrance-animation royal-throne';
  throne.innerHTML = '👑';

  if (targetElement) {
    const rect = targetElement.getBoundingClientRect();
    throne.style.left = `${rect.left + rect.width / 2 - 50}px`;
    throne.style.top = `${rect.top - 100}px`;
  } else {
    throne.style.left = '50%';
    throne.style.top = '-100px';
    throne.style.transform = 'translateX(-50%)';
  }

  container.appendChild(throne);

  // Descend from above
  throne.animate([
    { transform: 'translateY(-200px) scale(0.5)', opacity: 0 },
    { transform: 'translateY(0px) scale(1)', opacity: 1 },
    { transform: 'translateY(20px) scale(1.1)', opacity: 1 },
    { transform: 'translateY(0px) scale(1)', opacity: 1 }
  ], {
    duration: 2000,
    easing: 'ease-out'
  });

  setTimeout(() => throne.remove(), 5000);
}

/**
 * RAINBOW DESCENT ANIMATION
 */
async function showRainbowDescentAnimation(targetElement?: HTMLElement) {
  const container = targetElement || document.body;

  const rainbow = document.createElement('div');
  rainbow.className = 'entrance-animation rainbow-descent';
  rainbow.innerHTML = '🌈';

  if (targetElement) {
    const rect = targetElement.getBoundingClientRect();
    rainbow.style.left = `${rect.left + rect.width / 2 - 50}px`;
    rainbow.style.top = `${rect.top - 50}px`;
  } else {
    rainbow.style.left = '50%';
    rainbow.style.top = '-50px';
    rainbow.style.transform = 'translateX(-50%)';
  }

  container.appendChild(rainbow);

  rainbow.animate([
    { transform: 'translateY(-300px) rotate(-45deg)', opacity: 0 },
    { transform: 'translateY(0px) rotate(0deg)', opacity: 1 },
    { transform: 'translateY(50px) rotate(10deg)', opacity: 0.8 },
    { transform: 'translateY(0px) rotate(0deg)', opacity: 1 }
  ], {
    duration: 2500,
    easing: 'ease-out'
  });

  setTimeout(() => rainbow.remove(), 4000);
}

/**
 * TROLL ROLL-UP ANIMATION
 */
async function showTrollRollupAnimation(targetElement?: HTMLElement) {
  const container = targetElement || document.body;

  const car = document.createElement('div');
  car.className = 'entrance-animation troll-rollup';
  car.innerHTML = '🚗';

  car.style.left = '-100px';
  car.style.bottom = '20px';

  container.appendChild(car);

  car.animate([
    { transform: 'translateX(0px)', opacity: 1 },
    { transform: 'translateX(calc(50vw - 50px))', opacity: 1 }
  ], {
    duration: 3000,
    easing: 'ease-out'
  });

  setTimeout(() => car.remove(), 6000);
}

/**
 * VIP SIREN ANIMATION
 */
async function showVIPSirenAnimation(targetElement?: HTMLElement) {
  const container = targetElement || document.body;

  const siren = document.createElement('div');
  siren.className = 'entrance-animation vip-siren';
  siren.innerHTML = '🚨';

  if (targetElement) {
    const rect = targetElement.getBoundingClientRect();
    siren.style.left = `${rect.left + rect.width / 2 - 50}px`;
    siren.style.top = `${rect.top - 50}px`;
  } else {
    siren.style.left = '50%';
    siren.style.top = '30%';
    siren.style.transform = 'translateX(-50%)';
  }

  container.appendChild(siren);

  // Flashing animation
  siren.animate([
    { opacity: 0, transform: 'scale(0)' },
    { opacity: 1, transform: 'scale(1.5)' },
    { opacity: 0, transform: 'scale(1)' },
    { opacity: 1, transform: 'scale(1.2)' },
    { opacity: 0, transform: 'scale(1)' }
  ], {
    duration: 2000,
    easing: 'ease-in-out'
  });

  setTimeout(() => siren.remove(), 5000);
}

/**
 * FIREWORK EXPLOSION ANIMATION
 */
async function showFireworkExplosionAnimation(targetElement?: HTMLElement) {
  const container = targetElement || document.body;

  for (let i = 0; i < 15; i++) {
    setTimeout(() => {
      const firework = document.createElement('div');
      firework.className = 'entrance-animation firework';
      firework.innerHTML = '🎆';

      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        firework.style.left = `${rect.left + Math.random() * rect.width}px`;
        firework.style.top = `${rect.top + Math.random() * rect.height}px`;
      } else {
        firework.style.left = `${Math.random() * 100}vw`;
        firework.style.top = `${Math.random() * 50 + 20}vh`;
      }

      container.appendChild(firework);

      firework.animate([
        { transform: 'scale(0) rotate(0deg)', opacity: 0 },
        { transform: 'scale(1) rotate(180deg)', opacity: 1 },
        { transform: 'scale(1.5) rotate(360deg)', opacity: 0 }
      ], {
        duration: 1500,
        easing: 'ease-out'
      });

      setTimeout(() => firework.remove(), 1500);
    }, i * 200);
  }
}

/**
 * TROLL KING ANIMATION
 */
async function showTrollKingAnimation(targetElement?: HTMLElement) {
  const container = targetElement || document.body;

  const king = document.createElement('div');
  king.className = 'entrance-animation troll-king';
  king.innerHTML = '🧌';

  if (targetElement) {
    const rect = targetElement.getBoundingClientRect();
    king.style.left = `${rect.left + rect.width / 2 - 50}px`;
    king.style.top = `${rect.top - 100}px`;
  } else {
    king.style.left = '50%';
    king.style.top = '-100px';
    king.style.transform = 'translateX(-50%)';
  }

  container.appendChild(king);

  king.animate([
    { transform: 'translateY(-300px) scale(0.3)', opacity: 0 },
    { transform: 'translateY(-50px) scale(1.2)', opacity: 1 },
    { transform: 'translateY(0px) scale(1)', opacity: 1 },
    { transform: 'translateY(-20px) scale(1.1)', opacity: 1 },
    { transform: 'translateY(0px) scale(1)', opacity: 1 }
  ], {
    duration: 4000,
    easing: 'ease-out'
  });

  setTimeout(() => king.remove(), 8000);
}

/**
 * ADMIN DIVINE ANIMATION - GOD-TIER EFFECT
 * Black void background split by gold lightning, massive gold+purple energy shockwave
 */
async function showAdminDivineAnimation(targetElement?: HTMLElement) {
  const container = targetElement || document.body;

  // Create void background
  const voidBg = document.createElement('div');
  voidBg.className = 'entrance-animation admin-void-bg';
  voidBg.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: radial-gradient(circle, #000000 0%, #1a0033 50%, #000000 100%);
    z-index: 999;
    opacity: 0;
    transition: opacity 0.5s ease-in-out;
  `;
  container.appendChild(voidBg);

  // Gold lightning bolts
  const lightning1 = document.createElement('div');
  lightning1.className = 'entrance-animation admin-lightning';
  lightning1.innerHTML = '⚡';
  lightning1.style.cssText = `
    position: fixed;
    top: 20%;
    left: 30%;
    font-size: 8rem;
    color: #ffd700;
    text-shadow: 0 0 50px #ffd700, 0 0 100px #ffd700;
    z-index: 1000;
    opacity: 0;
    transform: rotate(-15deg);
  `;
  container.appendChild(lightning1);

  const lightning2 = document.createElement('div');
  lightning2.className = 'entrance-animation admin-lightning';
  lightning2.innerHTML = '⚡';
  lightning2.style.cssText = `
    position: fixed;
    top: 60%;
    right: 25%;
    font-size: 6rem;
    color: #ffd700;
    text-shadow: 0 0 40px #ffd700, 0 0 80px #ffd700;
    z-index: 1000;
    opacity: 0;
    transform: rotate(25deg);
  `;
  container.appendChild(lightning2);

  // Crown sigil
  const crown = document.createElement('div');
  crown.className = 'entrance-animation admin-crown';
  crown.innerHTML = '👑';
  crown.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    font-size: 6rem;
    color: #ffd700;
    text-shadow: 0 0 30px #ffd700, 0 0 60px #ffd700, 0 0 90px #9932cc;
    z-index: 1001;
    opacity: 0;
    transform: translate(-50%, -50%) scale(0);
  `;
  container.appendChild(crown);

  // Troll City emblem
  const emblem = document.createElement('div');
  emblem.className = 'entrance-animation admin-emblem';
  emblem.textContent = '🏙️';
  emblem.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    font-size: 4rem;
    color: #9932cc;
    text-shadow: 0 0 20px #9932cc, 0 0 40px #9932cc;
    z-index: 1001;
    opacity: 0;
    transform: translate(-50%, -50%) scale(0);
  `;
  container.appendChild(emblem);

  // Massive shockwave
  const shockwave = document.createElement('div');
  shockwave.className = 'entrance-animation admin-shockwave';
  shockwave.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    width: 0px;
    height: 0px;
    border: 2px solid #ffd700;
    border-radius: 50%;
    z-index: 1000;
    opacity: 0.8;
    transform: translate(-50%, -50%);
  `;
  container.appendChild(shockwave);

  // Animation sequence
  setTimeout(() => {
    voidBg.style.opacity = '1';
  }, 100);

  setTimeout(() => {
    lightning1.style.opacity = '1';
    lightning1.animate([
      { transform: 'rotate(-15deg) scale(1)' },
      { transform: 'rotate(-15deg) scale(1.2)' },
      { transform: 'rotate(-15deg) scale(1)' }
    ], { duration: 500, easing: 'ease-in-out' });
  }, 300);

  setTimeout(() => {
    lightning2.style.opacity = '1';
    lightning2.animate([
      { transform: 'rotate(25deg) scale(1)' },
      { transform: 'rotate(25deg) scale(1.2)' },
      { transform: 'rotate(25deg) scale(1)' }
    ], { duration: 500, easing: 'ease-in-out' });
  }, 500);

  setTimeout(() => {
    crown.style.opacity = '1';
    crown.animate([
      { transform: 'translate(-50%, -50%) scale(0)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.5)', opacity: 1 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }
    ], { duration: 800, easing: 'ease-out' });
  }, 800);

  setTimeout(() => {
    emblem.style.opacity = '1';
    emblem.animate([
      { transform: 'translate(-50%, -50%) scale(0)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.2)', opacity: 1 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }
    ], { duration: 600, easing: 'ease-out' });
  }, 1000);

  setTimeout(() => {
    shockwave.animate([
      { width: '0px', height: '0px', opacity: 0.8 },
      { width: '800px', height: '800px', opacity: 0 }
    ], { duration: 1500, easing: 'ease-out' });
  }, 1200);

  // Screen blackout and explosion
  setTimeout(() => {
    voidBg.style.background = 'radial-gradient(circle, #ffffff 0%, #ffd700 30%, #9932cc 60%, #000000 100%)';
    voidBg.animate([
      { opacity: 1 },
      { opacity: 0 }
    ], { duration: 1000, easing: 'ease-in-out' });
  }, 2000);

  // Cleanup
  setTimeout(() => {
    [voidBg, lightning1, lightning2, crown, emblem, shockwave].forEach(el => el.remove());
  }, 6000);
}


/**
 * TROLL CITY CEO ANIMATION - RED & BLACK THEME
 * "Troll City CEO" text, red/black money rain, aggressive stomp effect
 */
async function showTrollCityCeoAnimation(targetElement?: HTMLElement) {
  const container = targetElement || document.body;

  // Red/Black overlay flash
  const overlay = document.createElement('div');
  overlay.className = 'entrance-animation ceo-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: radial-gradient(circle, rgba(220, 38, 38, 0.2) 0%, rgba(0, 0, 0, 0.8) 100%);
    z-index: 999;
    opacity: 0;
    pointer-events: none;
  `;
  container.appendChild(overlay);

  // CEO Text
  const text = document.createElement('div');
  text.className = 'entrance-animation ceo-text';
  text.innerHTML = 'TROLL CITY<br><span style="color: #ef4444; font-size: 1.5em;">CEO</span>';
  text.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0);
    font-family: 'Arial Black', sans-serif;
    font-weight: 900;
    font-size: 5rem;
    color: white;
    text-align: center;
    line-height: 1;
    text-shadow: 4px 4px 0px #000, 0 0 20px #dc2626;
    z-index: 1001;
    opacity: 0;
  `;
  container.appendChild(text);

  // Red & Black Money Rain
  for (let i = 0; i < 30; i++) {
    setTimeout(() => {
      const money = document.createElement('div');
      money.className = 'entrance-animation ceo-money';
      money.innerHTML = i % 2 === 0 ? '💸' : '💵';
      money.style.cssText = `
        position: fixed;
        left: ${Math.random() * 100}vw;
        top: -50px;
        font-size: ${Math.random() * 2 + 1}rem;
        filter: hue-rotate(${i % 2 === 0 ? '-50deg' : '0deg'}) grayscale(0.5) contrast(1.5);
        z-index: 1000;
      `;
      container.appendChild(money);

      money.animate([
        { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
        { transform: 'translateY(110vh) rotate(720deg)', opacity: 0 }
      ], {
        duration: 2000 + Math.random() * 1000,
        easing: 'ease-in'
      });

      setTimeout(() => money.remove(), 3000);
    }, i * 50);
  }

  // Stomp/Shake effect
  const shakeContainer = document.body;
  
  // Animation Sequence
  
  // 1. Flash Overlay
  overlay.animate([
    { opacity: 0 },
    { opacity: 1 },
    { opacity: 0 }
  ], { duration: 500, easing: 'ease-out' });

  // 2. Text Slam
  setTimeout(() => {
    text.style.opacity = '1';
    text.animate([
      { transform: 'translate(-50%, -50%) scale(5)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }
    ], { duration: 400, easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' });
    
    // Screen Shake on slam
    shakeContainer.animate([
      { transform: 'translate(0, 0)' },
      { transform: 'translate(-10px, -10px)' },
      { transform: 'translate(10px, 10px)' },
      { transform: 'translate(-10px, 10px)' },
      { transform: 'translate(10px, -10px)' },
      { transform: 'translate(0, 0)' }
    ], { duration: 300 });

  }, 200);

  // 3. Text fade out
  setTimeout(() => {
    text.animate([
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      { transform: 'translate(-50%, -50%) scale(1.5)', opacity: 0 }
    ], { duration: 500, easing: 'ease-in' });
    text.style.opacity = '0';
  }, 2500);

  // Cleanup
  setTimeout(() => {
    overlay.remove();
    text.remove();
  }, 3000);
}

/**
 * LEAD TROLL OFFICER ELITE ANIMATION
 * Dark purple + gold energy swirl, controlled lightning, gold officer badge
 */
async function showLeadOfficerEliteAnimation(targetElement?: HTMLElement) {
  const container = targetElement || document.body;

  // Energy swirl background
  const swirl = document.createElement('div');
  swirl.className = 'entrance-animation lead-officer-swirl';
  swirl.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    width: 400px;
    height: 400px;
    background: conic-gradient(from 0deg, #9932cc, #ffd700, #9932cc);
    border-radius: 50%;
    z-index: 1000;
    opacity: 0;
    transform: translate(-50%, -50%) scale(0);
    animation: lead-officer-spin 2s linear infinite;
  `;
  container.appendChild(swirl);

  // Controlled lightning
  const lightning = document.createElement('div');
  lightning.className = 'entrance-animation lead-officer-lightning';
  lightning.innerHTML = '⚡';
  lightning.style.cssText = `
    position: fixed;
    top: 40%;
    left: 50%;
    font-size: 4rem;
    color: #ffd700;
    text-shadow: 0 0 20px #ffd700, 0 0 40px #ffd700;
    z-index: 1001;
    opacity: 0;
    transform: translate(-50%, -50%);
  `;
  container.appendChild(lightning);

  // Gold officer badge
  const badge = document.createElement('div');
  badge.className = 'entrance-animation lead-officer-badge';
  badge.innerHTML = '⭐';
  badge.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    font-size: 5rem;
    color: #ffd700;
    text-shadow: 0 0 25px #ffd700, 0 0 50px #9932cc;
    z-index: 1002;
    opacity: 0;
    transform: translate(-50%, -50%) scale(0);
  `;
  container.appendChild(badge);

  // Subtle camera shake
  const shakeContainer = document.body;
  shakeContainer.style.animation = 'lead-officer-shake 0.5s ease-in-out';

  // Animation sequence
  setTimeout(() => {
    swirl.style.opacity = '1';
    swirl.animate([
      { transform: 'translate(-50%, -50%) scale(0)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.7 },
      { transform: 'translate(-50%, -50%) scale(1.2)', opacity: 0 }
    ], { duration: 2000, easing: 'ease-out' });
  }, 100);

  setTimeout(() => {
    lightning.style.opacity = '1';
    lightning.animate([
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.3)', opacity: 1 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 }
    ], { duration: 800, easing: 'ease-in-out' });
  }, 500);

  setTimeout(() => {
    badge.style.opacity = '1';
    badge.animate([
      { transform: 'translate(-50%, -50%) scale(0)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.5)', opacity: 1 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }
    ], { duration: 1000, easing: 'ease-out' });
  }, 800);

  // Cleanup
  setTimeout(() => {
    [swirl, lightning, badge].forEach(el => el.remove());
    shakeContainer.style.animation = '';
  }, 4000);
}

/**
 * TROLL OFFICER AUTHORITY ANIMATION - POLICE STYLE
 * Red & blue flashing light beams, siren sweep glow, officer shield
 */
async function showOfficerAuthorityAnimation(targetElement?: HTMLElement) {
  const container = targetElement || document.body;

  // Red light beam
  const redBeam = document.createElement('div');
  redBeam.className = 'entrance-animation officer-red-beam';
  redBeam.style.cssText = `
    position: fixed;
    top: 0;
    left: 20%;
    width: 4px;
    height: 100vh;
    background: linear-gradient(to bottom, transparent, #ff0000, transparent);
    box-shadow: 0 0 20px #ff0000, 0 0 40px #ff0000;
    z-index: 1000;
    opacity: 0;
    animation: officer-beam-sweep 1.5s ease-in-out;
  `;
  container.appendChild(redBeam);

  // Blue light beam
  const blueBeam = document.createElement('div');
  blueBeam.className = 'entrance-animation officer-blue-beam';
  blueBeam.style.cssText = `
    position: fixed;
    top: 0;
    right: 20%;
    width: 4px;
    height: 100vh;
    background: linear-gradient(to bottom, transparent, #0000ff, transparent);
    box-shadow: 0 0 20px #0000ff, 0 0 40px #0000ff;
    z-index: 1000;
    opacity: 0;
    animation: officer-beam-sweep-reverse 1.5s ease-in-out;
  `;
  container.appendChild(blueBeam);

  // Siren glow overlay
  const sirenGlow = document.createElement('div');
  sirenGlow.className = 'entrance-animation officer-siren-glow';
  sirenGlow.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(255,0,0,0.3) 0%, rgba(0,0,255,0.3) 50%, transparent 70%);
    border-radius: 50%;
    z-index: 1000;
    opacity: 0;
    transform: translate(-50%, -50%);
    animation: officer-siren-pulse 0.5s ease-in-out infinite alternate;
  `;
  container.appendChild(sirenGlow);

  // Officer shield
  const shield = document.createElement('div');
  shield.className = 'entrance-animation officer-shield';
  shield.innerHTML = '🛡️';
  shield.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    font-size: 4rem;
    color: #ffd700;
    text-shadow: 0 0 15px #ffd700;
    z-index: 1001;
    opacity: 0;
    transform: translate(-50%, -50%) scale(0);
  `;
  container.appendChild(shield);

  // Horizontal light streaks
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const streak = document.createElement('div');
      streak.className = 'entrance-animation officer-streak';
      streak.style.cssText = `
        position: fixed;
        top: ${30 + i * 20}%;
        left: -100px;
        width: 100px;
        height: 2px;
        background: linear-gradient(to right, transparent, ${i % 2 === 0 ? '#ff0000' : '#0000ff'}, transparent);
        box-shadow: 0 0 10px ${i % 2 === 0 ? '#ff0000' : '#0000ff'};
        z-index: 1000;
        opacity: 0;
      `;
      container.appendChild(streak);

      setTimeout(() => {
        streak.style.opacity = '1';
        streak.animate([
          { left: '-100px', opacity: 0 },
          { left: 'calc(100vw + 100px)', opacity: 1 }
        ], { duration: 800, easing: 'ease-in-out' });
      }, 100);

      setTimeout(() => streak.remove(), 1000);
    }, i * 200);
  }

  // Animation sequence
  setTimeout(() => {
    redBeam.style.opacity = '1';
    blueBeam.style.opacity = '1';
    sirenGlow.style.opacity = '1';
  }, 100);

  setTimeout(() => {
    shield.style.opacity = '1';
    shield.animate([
      { transform: 'translate(-50%, -50%) scale(0)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.2)', opacity: 1 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }
    ], { duration: 600, easing: 'ease-out' });
  }, 500);

  // Cleanup
  setTimeout(() => {
    [redBeam, blueBeam, sirenGlow, shield].forEach(el => el.remove());
  }, 3000);
}

/**
 * CSS for entrance animations
 */
export const ENTRANCE_ANIMATION_CSS = `
.entrance-animation {
  position: fixed;
  z-index: 1000;
  pointer-events: none;
  font-size: 4rem;
  user-select: none;
}

.flame-burst {
  font-size: 6rem;
  color: #ff4500;
  text-shadow: 0 0 20px #ff4500, 0 0 40px #ff4500;
}

.money-particle {
  font-size: 2rem;
  animation: money-fall linear infinite;
}

@keyframes money-fall {
  0% { transform: translateY(0px) rotate(0deg); }
  100% { transform: translateY(500px) rotate(720deg); }
}

.electric-flash {
  font-size: 8rem;
  color: #00ffff;
  text-shadow: 0 0 30px #00ffff, 0 0 60px #00ffff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.royal-throne {
  font-size: 5rem;
  filter: drop-shadow(0 0 20px gold);
}

.rainbow-descent {
  font-size: 4rem;
  filter: hue-rotate(0deg);
  animation: rainbow-rotate 2s infinite;
}

@keyframes rainbow-rotate {
  0%, 100% { filter: hue-rotate(0deg); }
  25% { filter: hue-rotate(90deg); }
  50% { filter: hue-rotate(180deg); }
  75% { filter: hue-rotate(270deg); }
}

.troll-rollup {
  font-size: 3rem;
  bottom: 20px;
}

.vip-siren {
  font-size: 5rem;
  color: #ff0000;
  text-shadow: 0 0 20px #ff0000;
}

.firework {
  font-size: 3rem;
}

.troll-king {
  font-size: 6rem;
  filter: drop-shadow(0 0 30px purple);
}

/* Role-based animations */
.admin-void-bg {
  background: radial-gradient(circle, #000000 0%, #1a0033 50%, #000000 100%);
}

.admin-lightning {
  filter: drop-shadow(0 0 30px #ffd700);
}

.admin-crown {
  filter: drop-shadow(0 0 30px #ffd700) drop-shadow(0 0 60px #9932cc);
}

.admin-emblem {
  filter: drop-shadow(0 0 20px #9932cc);
}

.admin-shockwave {
  border: 3px solid #ffd700;
  box-shadow: 0 0 50px #ffd700, 0 0 100px #9932cc;
}

@keyframes lead-officer-spin {
  0% { transform: translate(-50%, -50%) rotate(0deg); }
  100% { transform: translate(-50%, -50%) rotate(360deg); }
}

.lead-officer-swirl {
  animation: lead-officer-spin 2s linear infinite;
}

.lead-officer-lightning {
  filter: drop-shadow(0 0 20px #ffd700);
}

.lead-officer-badge {
  filter: drop-shadow(0 0 25px #ffd700) drop-shadow(0 0 50px #9932cc);
}

@keyframes lead-officer-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
}

@keyframes officer-beam-sweep {
  0% { transform: rotate(-10deg); opacity: 0; }
  50% { transform: rotate(0deg); opacity: 1; }
  100% { transform: rotate(10deg); opacity: 0; }
}

@keyframes officer-beam-sweep-reverse {
  0% { transform: rotate(10deg); opacity: 0; }
  50% { transform: rotate(0deg); opacity: 1; }
  100% { transform: rotate(-10deg); opacity: 0; }
}

@keyframes officer-siren-pulse {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
  100% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.6; }
}

.officer-red-beam {
  animation: officer-beam-sweep 1.5s ease-in-out;
}

.officer-blue-beam {
  animation: officer-beam-sweep-reverse 1.5s ease-in-out;
}

.officer-siren-glow {
  animation: officer-siren-pulse 0.5s ease-in-out infinite alternate;
}

.officer-shield {
  filter: drop-shadow(0 0 15px #ffd700);
}

.officer-streak {
  filter: blur(1px);
}
`;
