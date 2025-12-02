// Fix for boo button sound in broadcast
// Add to StreamRoom.tsx

export const playBooSound = () => {
  try {
    // Create audio context for boo sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Generate a "boo" sound using Web Audio API
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Set boo sound characteristics
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(80, audioContext.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
    
    // Alternative: Use a pre-recorded sound file if available
    // const audio = new Audio('/sounds/boo.mp3');
    // audio.volume = 0.5;
    // audio.play().catch(e => console.error('Error playing boo sound:', e));
  } catch (error) {
    console.error('Error playing boo sound:', error);
  }
};

// In StreamRoom.tsx boo button handler:
// const handleBoo = () => {
//   playBooSound();
//   // ... rest of boo logic
// };

