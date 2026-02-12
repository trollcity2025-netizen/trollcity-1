import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/store';

interface VoiceNotification {
  id: string;
  message: string;
  type: 'warning' | 'info' | 'alert' | 'error';
  timestamp: Date;
}

export function useAdminVoiceNotifications() {
  const { profile } = useAuthStore();
  const [enabled, setEnabled] = useState(() => {
    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('voiceNotificationsEnabled') === 'true';
    }
    return false;
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);
  const queueRef = useRef<VoiceNotification[]>([]);
  const isSpeakingRef = useRef(false);

  // Initialize speech synthesis
  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech Synthesis API not supported');
      return;
    }

    // Check if voices are available
    const checkVoices = () => {
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        setVoiceReady(true);
      }
    };

    checkVoices();
    speechSynthesis.onvoiceschanged = checkVoices;

    return () => {
      speechSynthesis.cancel();
    };
  }, []);

  // Listen for voice toggle shortcut event
  useEffect(() => {
    const handleToggleVoice = (evt: Event) => {
      const customEvent = evt as CustomEvent;
      if (customEvent.detail?.enabled !== undefined) {
        setEnabled(customEvent.detail.enabled);
      } else {
        setEnabled(prev => !prev);
      }
    };

    window.addEventListener('toggleVoiceNotifications', handleToggleVoice);
    return () => {
      window.removeEventListener('toggleVoiceNotifications', handleToggleVoice);
    };
  }, []);

  // Get British male voice
  const getBritishMaleVoice = () => {
    const voices = speechSynthesis.getVoices();
    
    // Try to find a British male voice
    const britishVoices = voices.filter(v => 
      v.lang.includes('en-GB') || v.lang.includes('en_GB')
    );
    
    if (britishVoices.length > 0) {
      // Prioritize male voices explicitly
      const maleKeywords = ['male', 'man', 'boy', 'deep'];
      const maleVoice = britishVoices.find(v => 
        maleKeywords.some(keyword => v.name.toLowerCase().includes(keyword))
      );
      if (maleVoice) return maleVoice;
      
      // Try Google UK English - usually has good male option
      const googleUK = britishVoices.find(v => 
        v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('standard')
      );
      if (googleUK) return googleUK;
      
      // Avoid female voices - skip obvious female names
      const femaleKeywords = ['female', 'woman', 'girl', 'allison', 'victoria', 'moira', 'karen', 'fiona'];
      const notFemaleVoice = britishVoices.find(v => 
        !femaleKeywords.some(keyword => v.name.toLowerCase().includes(keyword))
      );
      if (notFemaleVoice) return notFemaleVoice;
      
      return britishVoices[0];
    }

    // Fallback to English voices with male preference
    const englishVoices = voices.filter(v => v.lang.startsWith('en'));
    if (englishVoices.length > 0) {
      const maleKeywords = ['male', 'man', 'boy', 'deep'];
      const maleVoice = englishVoices.find(v => 
        maleKeywords.some(keyword => v.name.toLowerCase().includes(keyword))
      );
      if (maleVoice) return maleVoice;
      
      return englishVoices[0];
    }

    // Last resort
    return voices[0];
  };

  // Speak a message
  const speak = (message: string) => {
    if (!voiceReady || !enabled) return;

    const utterance = new SpeechSynthesisUtterance(message);
    
    // Set voice properties
    const voice = getBritishMaleVoice();
    utterance.voice = voice;
    utterance.rate = 1.0; // Natural speech rate
    utterance.pitch = 0.9; // Slightly lower pitch for 28-year-old male effect
    utterance.volume = 1.0;
    utterance.lang = 'en-GB'; // British English

    utterance.onstart = () => {
      setIsSpeaking(true);
      isSpeakingRef.current = true;
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      
      // Process next item in queue
      if (queueRef.current.length > 0) {
        const next = queueRef.current.shift();
        if (next) {
          setTimeout(() => speak(next.message), 500);
        }
      }
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
      setIsSpeaking(false);
      isSpeakingRef.current = false;
    };

    speechSynthesis.cancel(); // Cancel any ongoing speech
    speechSynthesis.speak(utterance);
  };

  // Queue notification for speaking
  const announceNotification = (notification: VoiceNotification) => {
    if (!enabled || !profile?.is_admin) return;

    // Queue the notification as-is (message formatting handled during speaking)
    queueRef.current.push(notification);

    // If not currently speaking, start immediately
    if (!isSpeakingRef.current) {
      const next = queueRef.current.shift();
      if (next) {
        speak(next.message);
      }
    }
  };

  // Only enable if user is admin
  const toggleVoiceNotifications = (value: boolean) => {
    if (profile?.is_admin) {
      setEnabled(value);
      localStorage.setItem('voiceNotificationsEnabled', String(value));
    }
  };

  // Persist enabled state to localStorage
  useEffect(() => {
    localStorage.setItem('voiceNotificationsEnabled', String(enabled));
  }, [enabled]);

  return {
    enabled,
    toggleVoiceNotifications,
    isSpeaking,
    voiceReady: voiceReady && profile?.is_admin,
    announceNotification,
    speak,
    cancelSpeech: () => speechSynthesis.cancel()
  };
}
