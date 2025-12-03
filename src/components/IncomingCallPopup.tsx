import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { useNavigate } from 'react-router-dom';

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
  const { profile } = useAuthStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Play ringtone
    if (audioRef.current) {
      audioRef.current.loop = true;
      audioRef.current.play().catch(console.error);
    }

    // Auto-decline after 20 seconds
    timeoutRef.current = setTimeout(() => {
      onDecline();
    }, 20000);

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isOpen, onDecline]);

  const handleAccept = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
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
    onDecline();
  };

  if (!isOpen) return null;

  return (
    <>
      <audio ref={audioRef} src="/ringtone.mp3" />
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

