/**
 * Gift Video Player
 * Plays MP4 video files for each gift with matching sound
 * Falls back to a styled placeholder if video file doesn't exist yet
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { findGiftVideo, playSound } from '../../lib/giftVideoMap';
import '../../pages/dev/gift-video.css';

interface GiftVideoPlayerProps {
  giftName: string;
  giftIcon: string;
  giftValue: number;
  duration: number;
  onComplete: () => void;
}

export function GiftVideoPlayer({ giftName, giftIcon, giftValue, duration, onComplete }: GiftVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [phase, setPhase] = useState<'enter' | 'active' | 'exit'>('enter');
  const [videoExists, setVideoExists] = useState(true);
  const completed = useRef(false);

  const entry = findGiftVideo(giftName, giftIcon);

  const handleComplete = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    onComplete();
  }, [onComplete]);

  // Play sound
  useEffect(() => {
    const soundSrc = entry?.sound || '/sounds/click.mp3';
    const audio = playSound(soundSrc);
    if (!audio && entry?.fallbackSound) {
      audioRef.current = playSound(entry.fallbackSound);
    } else {
      audioRef.current = audio;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [entry]);

  // Play video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onErr = () => setVideoExists(false);
    video.addEventListener('error', onErr);

    video.playbackRate = 1;
    // Slow down long videos, speed up short ones to fit duration
    if (video.duration && video.duration > 0) {
      video.playbackRate = video.duration / duration;
    }

    video.play().catch(() => {
      setVideoExists(false);
    });

    return () => {
      video.removeEventListener('error', onErr);
    };
  }, [duration, entry]);

  // Phase transitions
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('active'), 50);
    const t2 = setTimeout(() => setPhase('exit'), (duration - 0.5) * 1000);
    const t3 = setTimeout(handleComplete, duration * 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [duration, handleComplete]);

  const tierColor = giftValue >= 50000 ? '#ffd700' : giftValue >= 10000 ? '#ff3b5c' : giftValue >= 2500 ? '#f59e0b' : giftValue >= 500 ? '#a855f7' : '#00e5ff';

  return createPortal(
    <div className={`gv-overlay gv-${phase}`}>
      {/* Video background */}
      {entry && videoExists ? (
        <video
          ref={videoRef}
          className="gv-video"
          src={entry.video}
          muted
          loop={false}
          playsInline
          preload="auto"
          onEnded={handleComplete}
        />
      ) : (
        /* Fallback if no video file exists */
        <div className="gv-fallback">
          <div className="gv-fallback-icon">{giftIcon}</div>
          <div className="gv-fallback-label">
            No video file: <code>/public/gift-videos/{giftName.toLowerCase().replace(/_/g, '-')}.mp4</code>
          </div>
        </div>
      )}

      {/* Gift info overlay */}
      <div className="gv-info">
        <div className="gv-name" style={{ textShadow: `0 0 20px ${tierColor}` }}>
          {giftIcon} {giftName.replace(/_/g, ' ')}
        </div>
        <div className="gv-cost" style={{ color: tierColor }}>
          {giftValue.toLocaleString()} coins
        </div>
      </div>

      {/* Progress bar */}
      <div className="gv-progress">
        <div className="gv-progress-bar" style={{ background: tierColor, animationDuration: `${duration}s` }} />
      </div>
    </div>,
    document.body
  );
}
