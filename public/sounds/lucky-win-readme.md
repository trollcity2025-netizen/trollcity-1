# Lucky Win Sound Effect

This directory should contain the lucky win sound effect file: `lucky-win.mp3`

## Sound Requirements
- **Format**: MP3
- **Duration**: 2-3 seconds
- **Style**: Exciting, celebratory sound with rising pitch
- **Volume**: Medium-high, should be attention-grabbing but not overwhelming

## Suggested Sound Elements
- Rising musical scale (C4 to C6)
- Sparkle/chime effects
- Triumphant fanfare
- Magical "poof" or "sparkle" sounds

## Implementation
The sound is triggered in `LuckyWinOverlay.tsx` when a lucky multiplier is won:

```javascript
const audio = new Audio('/sounds/lucky-win.mp3');
audio.volume = 0.7;
audio.play().catch(() => {
  // Fallback: create beep sound
  // ... (browser-based fallback implemented)
});
```

## Fallback
If the sound file is missing, the component falls back to a browser-generated beep sound using the Web Audio API.