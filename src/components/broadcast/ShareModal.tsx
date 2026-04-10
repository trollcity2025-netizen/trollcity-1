import React, { useState } from 'react';
import { X, Copy, Check, MessageCircle, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamTitle: string;
  streamUrl: string;
  broadcasterName?: string;
}

const SOCIAL_PLATFORMS = [
  { 
    id: 'facebook', 
    name: 'Facebook', 
    color: '#1877F2',
    shares: (url: string, title: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(title)}`
  },
  { 
    id: 'twitter', 
    name: 'X / Twitter', 
    color: '#000000',
    shares: (url: string, title: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
  },
  { 
    id: 'reddit', 
    name: 'Reddit', 
    color: '#FF4500',
    shares: (url: string, title: string) => `https://reddit.com/submit?title=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
  },
  { 
    id: 'discord', 
    name: 'Discord', 
    color: '#5865F2',
    shares: null
  },
  { 
    id: 'whatsapp', 
    name: 'WhatsApp', 
    color: '#25D366',
    shares: (url: string, title: string) => `https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`
  },
  { 
    id: 'telegram', 
    name: 'Telegram', 
    color: '#0088CC',
    shares: (url: string, title: string) => `https://t.me/share/url?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
  },
  { 
    id: 'linkedin', 
    name: 'LinkedIn', 
    color: '#0A66C2',
    shares: (url: string, title: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
  },
  { 
    id: 'messenger', 
    name: 'Messenger', 
    color: '#0084FF',
    shares: null
  },
  { 
    id: 'snapchat', 
    name: 'Snapchat', 
    color: '#FFFC00',
    shares: null
  },
  { 
    id: 'instagram', 
    name: 'Instagram', 
    color: '#E4405F',
    shares: null
  },
  { 
    id: 'tiktok', 
    name: 'TikTok', 
    color: '#000000',
    shares: null
  },
  { 
    id: 'copy', 
    name: 'Copy Link', 
    color: '#6B7280',
    icon: Copy,
    shares: null
  },
];

export default function ShareModal({ isOpen, onClose, streamTitle, streamUrl, broadcasterName }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleShare = async (platform: typeof SOCIAL_PLATFORMS[0]) => {
    const title = `Check out this live stream by ${broadcasterName || 'someone'}!`;
    
    if (platform.id === 'copy') {
      await navigator.clipboard.writeText(streamUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
      return;
    }

    if (platform.id === 'discord' || platform.id === 'messenger' || platform.id === 'snapchat' || platform.id === 'instagram' || platform.id === 'tiktok') {
      await navigator.clipboard.writeText(streamUrl);
      toast.success(`${platform.name} link copied! Open ${platform.name} to share.`);
      return;
    }

    if (platform.shares) {
      const shareUrl = platform.shares(streamUrl, title);
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: streamTitle || 'Live Stream',
        text: `Check out this live stream by ${broadcasterName || 'someone'}!`,
        url: streamUrl
      });
    } catch (error) {
      // User cancelled or error
    }
  };

  const shareText = `Check out this live stream by ${broadcasterName || 'someone'}! ${streamUrl}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl max-h-[85vh] overflow-hidden">
        <div className="sticky top-0 z-10 bg-zinc-900 border-b border-white/10 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Share Stream</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-white/60 mt-1 truncate">{streamTitle || 'Untitled Stream'}</p>
        </div>

        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          <div className="grid grid-cols-4 gap-3">
            {SOCIAL_PLATFORMS.map((platform) => {
              const Icon = platform.icon;
              const bgColor = platform.color;
              
              return (
                <button
                  key={platform.id}
                  onClick={() => handleShare(platform)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  {platform.id === 'copy' && copied ? (
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                  ) : platform.id === 'messenger' || platform.id === 'discord' || platform.id === 'snapchat' || platform.id === 'instagram' || platform.id === 'tiktok' ? (
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: bgColor }}
                    >
                      <span className="text-xl">{platform.id === 'tiktok' ? '🎵' : platform.id === 'instagram' ? '📷' : platform.id === 'snapchat' ? '👻' : platform.id === 'discord' ? '🎮' : platform.id === 'messenger' ? '💬' : '🔗'}</span>
                    </div>
                  ) : Icon ? (
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: bgColor }}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                  ) : (
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: bgColor }}
                    >
                      <span className="text-xl">
                        {platform.id === 'facebook' ? '📘' : 
                         platform.id === 'twitter' ? '🐦' : 
                         platform.id === 'reddit' ? '🤖' : 
                         platform.id === 'whatsapp' ? '💚' : 
                         platform.id === 'telegram' ? '✈️' : 
                         platform.id === 'linkedin' ? '💼' : '🔗'}
                      </span>
                    </div>
                  )}
                  <span className="text-xs text-white/80 text-center">{platform.name}</span>
                </button>
              );
            })}
          </div>

          {navigator.share && (
            <button
              onClick={handleNativeShare}
              className="w-full mt-4 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl text-white font-medium flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              More Options
            </button>
          )}

          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={streamUrl}
                readOnly
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 outline-none"
              />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(streamUrl);
                  toast.success('Link copied!');
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}