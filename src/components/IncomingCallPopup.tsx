import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';

interface IncomingCallPopupProps {
  isOpen: boolean;
  callerId: string;
  callerUsername: string;
  callerAvatar: string | null;
  callType: 'audio' | 'video';
  roomId: string;
  onAccept: () => void;
  onDecline: () => void;
}

export default function IncomingCallPopup({
  isOpen,
  callerId,
  callerUsername,
  callerAvatar,
  callType,
  roomId,
  onAccept,
  onDecline,
}: IncomingCallPopupProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  // const [isMinimized, setIsMinimized] = React.useState(false);
  // const { profile } = useAuthStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const [ringtoneSrc, setRingtoneSrc] = React.useState('/sounds/calls/ringtone-classic.mp3');

  useEffect(() => {
    if (!isOpen) return;

    const loadActiveRingtone = async () => {
      if (!user?.id) return;
      try {
        const { data } = await supabase
          .from('user_call_sounds')
          .select('is_active,call_sound_catalog(asset_url,sound_type)')
          .eq('user_id', user.id)
          .eq('is_active', true);
        const rows = (data || []) as any[];
        const active = rows.find((row) => {
          const catalog = Array.isArray(row.call_sound_catalog)
            ? row.call_sound_catalog[0]
            : row.call_sound_catalog;
          return catalog?.sound_type === 'ringtone';
        });
        const soundCatalog = active
          ? Array.isArray(active.call_sound_catalog)
            ? active.call_sound_catalog[0]
            : active.call_sound_catalog
          : null;
        if (soundCatalog?.asset_url) {
          setRingtoneSrc(soundCatalog.asset_url);
        }
      } catch {
        // ignore
      }
    };

    loadActiveRingtone();

    const audioEl = audioRef.current;

    // Play ringtone
    if (audioEl) {
      audioEl.loop = true;
      audioEl.play().catch(() => {
        // Fallback: generate troll ringtone with WebAudio if asset missing
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioCtxRef.current = ctx;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = 550;
          gain.gain.value = 0.05;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          oscillatorRef.current = osc;
        } catch {
          // ignore
        }
      });
    }

    // Auto-decline after 20 seconds
    timeoutRef.current = setTimeout(() => {
      onDecline();
    }, 20000);

    return () => {
      if (audioEl) {
        audioEl.pause();
        audioEl.currentTime = 0;
      }
      if (oscillatorRef.current) {
        try {
          oscillatorRef.current.stop();
          oscillatorRef.current.disconnect();
        } catch {}
        oscillatorRef.current = null;
      }
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch {}
        audioCtxRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isOpen, onDecline, user?.id, ringtoneSrc]);

  const handleAccept = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      } catch {}
      oscillatorRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {}
      audioCtxRef.current = null;
    }
    navigate(`/call/${roomId}/${callType}/${callerId}`);
    onAccept();
  };

  const handleDecline = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      } catch {}
      oscillatorRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {}
      audioCtxRef.current = null;
    }
    onDecline();
  };

  if (!isOpen) return null;

  return (
    <>
      <audio ref={audioRef} src={ringtoneSrc} />
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-gradient-to-br from-purple-900 to-black border-2 border-purple-500 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
          <div className="text-center">
            {/* Caller Avatar */}
            <div className="mb-6">
              <img
                src={callerAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${callerUsername}`}
                alt={callerUsername}
                className="w-24 h-24 rounded-full mx-auto border-4 border-purple-500 animate-pulse"
              />
            </div>

            {/* Caller Info */}
            <h2 className="text-2xl font-bold text-white mb-2">Incoming {callType === 'audio' ? 'Audio' : 'Video'} Call</h2>
            <p className="text-purple-300 text-lg mb-6">@{callerUsername}</p>

            {/* Call Type Icon */}
            <div className="mb-8">
              {callType === 'audio' ? (
                <Phone className="w-16 h-16 text-purple-400 mx-auto animate-bounce" />
              ) : (
                <Video className="w-16 h-16 text-purple-400 mx-auto animate-bounce" />
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={handleDecline}
                className="p-4 bg-red-600 hover:bg-red-700 rounded-full text-white transition transform hover:scale-110"
              >
                <PhoneOff className="w-8 h-8" />
              </button>
              <button
                onClick={handleAccept}
                className="p-4 bg-green-600 hover:bg-green-700 rounded-full text-white transition transform hover:scale-110"
              >
                {callType === 'audio' ? <Phone className="w-8 h-8" /> : <Video className="w-8 h-8" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

