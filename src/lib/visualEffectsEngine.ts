// Premium Visual Effects Engine
// Uses Web Animations API + DOM manipulation for hardware-accelerated effects

interface ParticleConfig {
  count: number
  colors: string[]
  size: { min: number; max: number }
  duration: { min: number; max: number }
  spread: number
  gravity: number
  fadeOut: boolean
}

const DEFAULT_PARTICLES: ParticleConfig = {
  count: 20,
  colors: ['#a78bfa', '#818cf8', '#6366f1', '#8b5cf6', '#c084fc'],
  size: { min: 3, max: 8 },
  duration: { min: 800, max: 2000 },
  spread: 300,
  gravity: 0.5,
  fadeOut: true,
}

class VisualEffectsEngine {
  private container: HTMLDivElement | null = null
  private activeEffects = new Set<HTMLElement>()
  private reducedMotion = false

  constructor() {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.ensureContainer()
  }

  private ensureContainer() {
    if (this.container) return
    this.container = document.createElement('div')
    this.container.id = 'trollcity-vfx-engine'
    this.container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden'
    document.body.appendChild(this.container)
  }

  private createEl(tag = 'div') {
    const el = document.createElement(tag)
    this.container?.appendChild(el)
    this.activeEffects.add(el)
    return el
  }

  private removeEl(el: HTMLElement, delay: number) {
    setTimeout(() => {
      el.remove()
      this.activeEffects.delete(el)
    }, delay)
  }

  // Particle burst from a point
  particleBurst(x: number, y: number, config: Partial<ParticleConfig> = {}) {
    if (this.reducedMotion) return
    const cfg = { ...DEFAULT_PARTICLES, ...config }
    
    for (let i = 0; i < cfg.count; i++) {
      const el = this.createEl()
      const size = cfg.size.min + Math.random() * (cfg.size.max - cfg.size.min)
      const color = cfg.colors[Math.floor(Math.random() * cfg.colors.length)]
      const angle = (Math.PI * 2 * i) / cfg.count + Math.random() * 0.5
      const velocity = cfg.spread * (0.5 + Math.random() * 0.5)
      const duration = cfg.duration.min + Math.random() * (cfg.duration.max - cfg.duration.min)
      const dx = Math.cos(angle) * velocity
      const dy = Math.sin(angle) * velocity + cfg.gravity * duration * 0.3

      el.style.cssText = `
        position:absolute;width:${size}px;height:${size}px;
        background:${color};border-radius:50%;
        left:${x}px;top:${y}px;
        box-shadow:0 0 ${size * 2}px ${color}, 0 0 ${size * 4}px ${color};
        will-change:transform,opacity;
      `
      el.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) scale(0)`, opacity: 0 }
      ], { duration, easing: 'cubic-bezier(0,.9,.3,1)', fill: 'forwards' })
      
      this.removeEl(el, duration + 50)
    }
  }

  // Energy ring expanding from point
  energyRing(x: number, y: number, color = '#6366f1', size = 200) {
    if (this.reducedMotion) return
    const el = this.createEl()
    el.style.cssText = `
      position:absolute;left:${x - size/2}px;top:${y - size/2}px;
      width:${size}px;height:${size}px;
      border:3px solid ${color};border-radius:50%;
      box-shadow:0 0 20px ${color}, inset 0 0 20px ${color};
      will-change:transform,opacity;
    `
    el.animate([
      { transform: 'scale(0.3)', opacity: 1 },
      { transform: 'scale(2.5)', opacity: 0 }
    ], { duration: 800, easing: 'ease-out', fill: 'forwards' })
    this.removeEl(el, 850)
  }

  // Lightning strike between two points
  lightningStrike(x1: number, y1: number, x2: number, y2: number, color = '#818cf8') {
    if (this.reducedMotion) return
    const el = this.createEl()
    const dx = x2 - x1
    const dy = y2 - y1
    const length = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx) * 180 / Math.PI

    el.style.cssText = `
      position:absolute;left:${x1}px;top:${y1}px;
      width:${length}px;height:3px;
      background:linear-gradient(90deg, transparent, ${color}, #fff, ${color}, transparent);
      transform-origin:0 50%;transform:rotate(${angle}deg);
      box-shadow:0 0 10px ${color}, 0 0 20px ${color}, 0 0 40px ${color};
      will-change:opacity;
    `
    el.animate([
      { opacity: 0 },
      { opacity: 1 },
      { opacity: 0.3 },
      { opacity: 1 },
      { opacity: 0 }
    ], { duration: 300, easing: 'steps(5)' })
    this.removeEl(el, 350)
  }

  // Screen flash effect
  screenFlash(color = 'rgba(99, 102, 241, 0.3)', duration = 400) {
    if (this.reducedMotion) return
    const el = this.createEl()
    el.style.cssText = `
      position:absolute;inset:0;background:${color};
      will-change:opacity;
    `
    el.animate([
      { opacity: 1 },
      { opacity: 0 }
    ], { duration, easing: 'ease-out', fill: 'forwards' })
    this.removeEl(el, duration + 50)
  }

  // Floating text that rises and fades
  floatingText(x: number, y: number, text: string, color = '#a78bfa', size = 18) {
    const el = this.createEl()
    el.textContent = text
    el.style.cssText = `
      position:absolute;left:${x}px;top:${y}px;
      color:${color};font-size:${size}px;font-weight:700;
      text-shadow:0 0 10px ${color}, 0 0 20px ${color};
      white-space:nowrap;pointer-events:none;
      will-change:transform,opacity;
      font-family:system-ui,-apple-system,sans-serif;
    `
    el.animate([
      { transform: 'translateY(0) scale(1)', opacity: 1 },
      { transform: `translateY(-${80 + Math.random() * 60}px) scale(0.8)`, opacity: 0 }
    ], { duration: 1500, easing: 'ease-out', fill: 'forwards' })
    this.removeEl(el, 1550)
  }

  // Meteor streak across screen
  meteorStreak(count = 5) {
    if (this.reducedMotion) return
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const el = this.createEl()
        const startX = Math.random() * window.innerWidth * 0.5
        const startY = -20
        const length = 60 + Math.random() * 80
        const duration = 600 + Math.random() * 400
        const hue = 200 + Math.random() * 60

        el.style.cssText = `
          position:absolute;left:${startX}px;top:${startY}px;
          width:${length}px;height:2px;
          background:linear-gradient(90deg, transparent, hsl(${hue}, 80%, 70%), #fff);
          transform:rotate(45deg);
          box-shadow:0 0 8px hsl(${hue}, 80%, 60%);
          will-change:transform,opacity;
        `
        el.animate([
          { transform: 'rotate(45deg) translateX(0)', opacity: 1 },
          { transform: 'rotate(45deg) translateX(400px)', opacity: 0 }
        ], { duration, easing: 'ease-in', fill: 'forwards' })
        this.removeEl(el, duration + 50)
      }, i * 200)
    }
  }

  // Aurora wave background
  auroraWave(duration = 5000) {
    if (this.reducedMotion) return
    const el = this.createEl()
    el.style.cssText = `
      position:absolute;inset:0;
      background:linear-gradient(135deg,
        rgba(99,102,241,0.1) 0%, rgba(168,85,247,0.08) 25%,
        rgba(236,72,153,0.06) 50%, rgba(59,130,246,0.08) 75%,
        rgba(16,185,129,0.1) 100%);
      background-size:400% 400%;
      will-change:background-position,opacity;
    `
    const anim = el.animate([
      { backgroundPosition: '0% 50%', opacity: 0 },
      { backgroundPosition: '100% 50%', opacity: 1 },
      { backgroundPosition: '0% 50%', opacity: 0 }
    ], { duration, easing: 'ease-in-out', fill: 'forwards' })
    anim.onfinish = () => this.removeEl(el, 50)
  }

  // Firework explosion
  firework(x: number, y: number, colors = ['#ef4444', '#f59e0b', '#10b981', '#6366f1', '#ec4899']) {
    if (this.reducedMotion) return
    const count = 30
    for (let i = 0; i < count; i++) {
      const el = this.createEl()
      const angle = (Math.PI * 2 * i) / count
      const velocity = 80 + Math.random() * 120
      const size = 2 + Math.random() * 4
      const color = colors[Math.floor(Math.random() * colors.length)]
      const dx = Math.cos(angle) * velocity
      const dy = Math.sin(angle) * velocity + 30

      el.style.cssText = `
        position:absolute;left:${x}px;top:${y}px;
        width:${size}px;height:${size}px;
        background:${color};border-radius:50%;
        box-shadow:0 0 ${size*3}px ${color};
        will-change:transform,opacity;
      `
      el.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) scale(0)`, opacity: 0 }
      ], { duration: 1000 + Math.random() * 500, easing: 'cubic-bezier(0,.9,.3,1)', fill: 'forwards' })
      this.removeEl(el, 1550)
    }
  }

  // Gift combo effect (for streaks)
  giftCombo(x: number, y: number, comboCount: number) {
    if (this.reducedMotion) return
    const colors = comboCount >= 10 
      ? ['#fbbf24', '#f59e0b', '#ef4444', '#fff']
      : comboCount >= 5 
      ? ['#a78bfa', '#818cf8', '#c084fc']
      : ['#6366f1', '#818cf8']
    
    this.particleBurst(x, y, { count: 10 + comboCount * 3, colors, size: { min: 3, max: 12 } })
    this.energyRing(x, y, colors[0], 150)
    this.floatingText(x, y - 30, `${comboCount}x COMBO!`, colors[0], 16 + comboCount)
    if (comboCount >= 10) this.screenFlash('rgba(251, 191, 36, 0.15)')
  }

  // Level up effect
  levelUp(x: number, y: number, level: number) {
    if (this.reducedMotion) return
    const isElite = level >= 200
    const isHigh = level >= 100
    const colors = isElite 
      ? ['#fbbf24', '#f59e0b', '#fff', '#fcd34d']
      : isHigh 
      ? ['#a78bfa', '#818cf8', '#c084fc']
      : ['#6366f1', '#818cf8']

    this.particleBurst(x, y, { count: 25, colors, size: { min: 4, max: 14 }, spread: 400 })
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.energyRing(x, y, colors[i % colors.length], 200 + i * 50), i * 150)
    }
    this.floatingText(x - 40, y - 20, `LEVEL ${level}`, colors[0], 24)
    if (isElite) {
      this.firework(x, y - 50)
      this.screenFlash('rgba(251, 191, 36, 0.2)', 600)
    }
  }

  // Stream energy meter boost effect
  energyBoost(x: number, y: number, intensity: number) {
    if (this.reducedMotion) return
    const hue = Math.max(0, 120 - intensity * 1.2) // green→yellow→red
    const color = `hsl(${hue}, 80%, 60%)`
    this.particleBurst(x, y, {
      count: Math.floor(5 + intensity * 0.3),
      colors: [color, '#fff'],
      size: { min: 2, max: 6 },
      spread: 100 + intensity,
    })
  }

  // Clear all effects
  clear() {
    this.container?.replaceChildren()
    this.activeEffects.clear()
  }

  destroy() {
    this.clear()
    this.container?.remove()
    this.container = null
  }
}

export const vfx = new VisualEffectsEngine()
export type { ParticleConfig }
