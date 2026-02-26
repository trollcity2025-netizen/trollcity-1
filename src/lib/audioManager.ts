let audioContext: AudioContext | null = null;
let isUnlocked = false;

// We need to store buffers because you can only play a buffer source once.
const audioBuffers: { [src: string]: AudioBuffer } = {};

const initAudio = (): boolean => {
  if (isUnlocked || typeof window === 'undefined') {
    return false;
  }
  try {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    // A simple "unlock" trick: play a silent buffer on the first user interaction.
    const buffer = audioContext.createBuffer(1, 1, 22050);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
    isUnlocked = true;
    console.log('Audio context unlocked.');
    return true;
  } catch (e) {
    console.error('Failed to initialize AudioContext', e);
    return false;
  }
};

const loadSound = async (src: string): Promise<AudioBuffer | null> => {
  if (!audioContext) {
    console.warn('Audio context not initialized.');
    return null;
  }
  if (audioBuffers[src]) {
    return audioBuffers[src];
  }
  try {
    const response = await fetch(src);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    audioBuffers[src] = audioBuffer;
    return audioBuffer;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'EncodingError') {
      console.warn(`Audio file at ${src} could not be decoded. It may be corrupt or in an unsupported format.`);
    } else {
      console.error(`Failed to load sound: ${src}`, error);
    }
    return null;
  }
};

const playSound = async (src: string, volume: number = 0.5) => {
  if (!audioContext) {
    console.warn('Cannot play sound, audio context not initialized.');
    return;
  }
  let buffer = audioBuffers[src];
  if (!buffer) {
    buffer = await loadSound(src);
  }

  if (buffer) {
    try {
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      const gainNode = audioContext.createGain();
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      source.connect(gainNode).connect(audioContext.destination);
      source.start(0);
    } catch (error) {
      console.error(`Failed to play sound ${src}:`, error);
    }
  }
};

export const audioManager = {
  init: initAudio,
  playSound,
  loadSound,
};
