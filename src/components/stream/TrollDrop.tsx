import React, { useState, useEffect } from 'react';
import { TrollDrop as TrollDropType, TrollColor } from '../../types/trollDrop';
import { addCoins, deductCoins } from '../../lib/coinTransactions';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';

interface TrollDropProps {
  drop: TrollDropType;
  onExpire: (dropId: string) => void;
  onClaimSuccess: (dropId: string, amount: number) => void;
}

export default function TrollDrop({ drop, onExpire, onClaimSuccess }: TrollDropProps) {
  const { user, profile } = useAuthStore();
  const [isAnimating, setIsAnimating] = useState(true);
  const [claimed, setClaimed] = useState(drop.claimed);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(drop.expiresAt - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = drop.expiresAt - Date.now();
      setTimeLeft(Math.max(0, remaining));
      
      if (remaining <= 0) {
        clearInterval(interval);
        setIsAnimating(false);
        onExpire(drop.id);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [drop.expiresAt, drop.id, onExpire]);

  const handleTrollClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user?.id || !profile || claimed || isProcessing) return;
    
    setIsProcessing(true);

    try {
      const isGreenTroll = drop.color === 'green';
      const amountPerUser = 5000 / (drop.participants.length + 1);

      if (isGreenTroll) {
        const result = await addCoins({
          userId: user.id,
          amount: Math.floor(amountPerUser),
          type: 'reward',
          coinType: 'trollmonds',
          description: `Green troll drop bonus`,
          metadata: {
            troll_drop_id: drop.id,
            stream_id: drop.streamId,
            participants_count: drop.participants.length + 1,
          },
        });

        if (result.success) {
          setClaimed(true);
          onClaimSuccess(drop.id, Math.floor(amountPerUser));
          toast.success(`+${Math.floor(amountPerUser)} Trollmonds! 🧌`);
        } else {
          toast.error(result.error || 'Failed to claim reward');
        }
      } else {
        const balanceCheck = (profile.free_coin_balance || 0);
        if (balanceCheck < Math.floor(amountPerUser)) {
          toast.error('Not enough Trollmonds to click the red troll!');
          setIsProcessing(false);
          return;
        }

        const result = await deductCoins({
          userId: user.id,
          amount: Math.floor(amountPerUser),
          type: 'admin_deduct',
          coinType: 'trollmonds',
          description: `Red troll drop penalty`,
          metadata: {
            troll_drop_id: drop.id,
            stream_id: drop.streamId,
            participants_count: drop.participants.length + 1,
          },
        });

        if (result.success) {
          setClaimed(true);
          toast.error(`-${Math.floor(amountPerUser)} Trollmonds! 🧌`);
        } else {
          toast.error(result.error || 'Failed to process penalty');
        }
      }

      const updatePayload: any = {
        claimed: true,
      };

      if (!drop.participants.some((p) => p.userId === user.id)) {
        updatePayload.participants = [
          ...drop.participants,
          {
            userId: user.id,
            username: profile.username,
            claimedAt: Date.now(),
          },
        ];
      }

      await supabase
        .from('troll_drops')
        .update(updatePayload)
        .eq('id', drop.id);
    } catch (err) {
      console.error('Error claiming troll drop:', err);
      toast.error('Something went wrong');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isAnimating) return null;

  const isGreen = drop.color === 'green';
  const trollSvg = isGreen ? <GreenTroll /> : <RedTroll />;

  return (
    <div
      className="fixed top-1/2 transform -translate-y-1/2 z-50 cursor-pointer transition-opacity hover:opacity-80"
      style={{
        animation: `trollWalk 8s linear forwards`,
      }}
      onClick={handleTrollClick}
    >
      <style>{`
        @keyframes trollWalk {
          0% {
            left: -150px;
            opacity: 1;
          }
          100% {
            left: 100vw;
            opacity: 1;
          }
        }
      `}</style>

      <div className={`relative ${claimed ? 'opacity-50' : ''}`}>
        {trollSvg}
        
        {claimed && (
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-8 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded whitespace-nowrap pointer-events-none">
            ✓ Claimed
          </div>
        )}

        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 text-center pointer-events-none">
          <div className="text-sm font-bold text-white drop-shadow">
            {isGreen ? '+ 5000 Trollmonds' : '- 5000 Trollmonds'}
          </div>
          <div className="text-xs text-gray-300 drop-shadow">
            Split {drop.participants.length + 1} ways
          </div>
        </div>
      </div>
    </div>
  );
}

function GreenTroll() {
  return (
    <svg width="100" height="140" viewBox="0 0 100 140" className="drop-shadow-lg">
      <ellipse cx="35" cy="115" rx="12" ry="20" fill="#22c55e" opacity="1" />
      <ellipse cx="65" cy="115" rx="12" ry="20" fill="#22c55e" opacity="1" />
      
      <ellipse cx="35" cy="135" rx="14" ry="8" fill="#16a34a" opacity="1" />
      <ellipse cx="65" cy="135" rx="14" ry="8" fill="#16a34a" opacity="1" />
      
      <ellipse cx="50" cy="70" rx="28" ry="35" fill="#4ade80" opacity="1" />
      
      <path d="M 50 40 Q 48 70 50 85" stroke="#22c55e" strokeWidth="2" fill="none" opacity="0.6" />
      
      <ellipse cx="22" cy="55" rx="15" ry="20" fill="#4ade80" opacity="1" />
      <ellipse cx="78" cy="55" rx="15" ry="20" fill="#4ade80" opacity="1" />
      
      <rect x="8" y="50" width="16" height="35" rx="8" fill="#22c55e" opacity="1" />
      <rect x="76" y="50" width="16" height="35" rx="8" fill="#22c55e" opacity="1" />
      
      <circle cx="16" cy="90" r="10" fill="#16a34a" opacity="1" />
      <circle cx="84" cy="90" r="10" fill="#16a34a" opacity="1" />
      
      <polygon points="10,95 6,105 8,98" fill="#0d7948" opacity="1" />
      <polygon points="22,95 26,105 24,98" fill="#0d7948" opacity="1" />
      <polygon points="78,95 74,105 76,98" fill="#0d7948" opacity="1" />
      <polygon points="90,95 94,105 92,98" fill="#0d7948" opacity="1" />
      
      <rect x="42" y="25" width="16" height="20" rx="8" fill="#22c55e" opacity="1" />
      
      <ellipse cx="50" cy="18" rx="22" ry="24" fill="#10b981" opacity="1" />
      
      <circle cx="35" cy="12" r="4" fill="#22c55e" opacity="0.4" />
      <circle cx="65" cy="10" r="4" fill="#22c55e" opacity="0.4" />
      <circle cx="50" cy="28" r="3" fill="#22c55e" opacity="0.4" />
      
      <ellipse cx="50" cy="10" rx="20" ry="5" fill="#059669" opacity="0.5" />
      
      <ellipse cx="38" cy="15" rx="4" ry="6" fill="#00ff00" opacity="1" />
      <ellipse cx="62" cy="15" rx="4" ry="6" fill="#00ff00" opacity="1" />
      
      <circle cx="38" cy="14" r="2.5" fill="#00ff00" opacity="0.8" />
      <circle cx="62" cy="14" r="2.5" fill="#00ff00" opacity="0.8" />
      
      <polygon points="50,22 46,28 54,28" fill="#16a34a" opacity="1" />
      <ellipse cx="48" cy="26" rx="2" ry="3" fill="#0d7948" opacity="0.6" />
      <ellipse cx="52" cy="26" rx="2" ry="3" fill="#0d7948" opacity="0.6" />
      
      <path d="M 40 32 Q 50 37 60 32" stroke="#22c55e" strokeWidth="2.5" fill="none" opacity="1" />
      
      <line x1="43" y1="33" x2="43" y2="35" stroke="#fff" strokeWidth="1.5" opacity="0.8" />
      <line x1="47" y1="34" x2="47" y2="36" stroke="#fff" strokeWidth="1.5" opacity="0.8" />
      <line x1="53" y1="34" x2="53" y2="36" stroke="#fff" strokeWidth="1.5" opacity="0.8" />
      <line x1="57" y1="33" x2="57" y2="35" stroke="#fff" strokeWidth="1.5" opacity="0.8" />
      
      <path d="M 28 6 Q 15 2 12 12" stroke="#eab308" strokeWidth="4" fill="none" opacity="1" strokeLinecap="round" />
      <path d="M 72 6 Q 85 2 88 12" stroke="#eab308" strokeWidth="4" fill="none" opacity="1" strokeLinecap="round" />
      
      <path d="M 30 7 Q 22 4 20 11" stroke="#facc15" strokeWidth="1.5" fill="none" opacity="0.6" strokeLinecap="round" />
      <path d="M 70 7 Q 78 4 80 11" stroke="#facc15" strokeWidth="1.5" fill="none" opacity="0.6" strokeLinecap="round" />
    </svg>
  );
}

function RedTroll() {
  return (
    <svg width="100" height="140" viewBox="0 0 100 140" className="drop-shadow-lg">
      <ellipse cx="35" cy="115" rx="12" ry="20" fill="#dc2626" opacity="1" />
      <ellipse cx="65" cy="115" rx="12" ry="20" fill="#dc2626" opacity="1" />
      
      <ellipse cx="35" cy="135" rx="14" ry="8" fill="#991b1b" opacity="1" />
      <ellipse cx="65" cy="135" rx="14" ry="8" fill="#991b1b" opacity="1" />
      
      <ellipse cx="50" cy="70" rx="28" ry="35" fill="#ef4444" opacity="1" />
      
      <path d="M 50 40 Q 48 70 50 85" stroke="#dc2626" strokeWidth="2" fill="none" opacity="0.6" />
      
      <ellipse cx="22" cy="55" rx="15" ry="20" fill="#ef4444" opacity="1" />
      <ellipse cx="78" cy="55" rx="15" ry="20" fill="#ef4444" opacity="1" />
      
      <rect x="8" y="50" width="16" height="35" rx="8" fill="#dc2626" opacity="1" />
      <rect x="76" y="50" width="16" height="35" rx="8" fill="#dc2626" opacity="1" />
      
      <circle cx="16" cy="90" r="10" fill="#991b1b" opacity="1" />
      <circle cx="84" cy="90" r="10" fill="#991b1b" opacity="1" />
      
      <polygon points="10,95 6,105 8,98" fill="#7f1d1d" opacity="1" />
      <polygon points="22,95 26,105 24,98" fill="#7f1d1d" opacity="1" />
      <polygon points="78,95 74,105 76,98" fill="#7f1d1d" opacity="1" />
      <polygon points="90,95 94,105 92,98" fill="#7f1d1d" opacity="1" />
      
      <rect x="42" y="25" width="16" height="20" rx="8" fill="#dc2626" opacity="1" />
      
      <ellipse cx="50" cy="18" rx="22" ry="24" fill="#b91c1c" opacity="1" />
      
      <circle cx="35" cy="12" r="4" fill="#dc2626" opacity="0.4" />
      <circle cx="65" cy="10" r="4" fill="#dc2626" opacity="0.4" />
      <circle cx="50" cy="28" r="3" fill="#dc2626" opacity="0.4" />
      
      <ellipse cx="50" cy="10" rx="20" ry="5" fill="#991b1b" opacity="0.5" />
      
      <ellipse cx="38" cy="15" rx="4" ry="6" fill="#ff0000" opacity="1" />
      <ellipse cx="62" cy="15" rx="4" ry="6" fill="#ff0000" opacity="1" />
      
      <circle cx="38" cy="14" r="2.5" fill="#ff0000" opacity="0.8" />
      <circle cx="62" cy="14" r="2.5" fill="#ff0000" opacity="0.8" />
      
      <polygon points="50,22 46,28 54,28" fill="#991b1b" opacity="1" />
      <ellipse cx="48" cy="26" rx="2" ry="3" fill="#7f1d1d" opacity="0.6" />
      <ellipse cx="52" cy="26" rx="2" ry="3" fill="#7f1d1d" opacity="0.6" />
      
      <path d="M 40 32 Q 50 37 60 32" stroke="#dc2626" strokeWidth="2.5" fill="none" opacity="1" />
      
      <line x1="43" y1="33" x2="43" y2="35" stroke="#fff" strokeWidth="1.5" opacity="0.8" />
      <line x1="47" y1="34" x2="47" y2="36" stroke="#fff" strokeWidth="1.5" opacity="0.8" />
      <line x1="53" y1="34" x2="53" y2="36" stroke="#fff" strokeWidth="1.5" opacity="0.8" />
      <line x1="57" y1="33" x2="57" y2="35" stroke="#fff" strokeWidth="1.5" opacity="0.8" />
      
      <path d="M 28 6 Q 15 2 12 12" stroke="#eab308" strokeWidth="4" fill="none" opacity="1" strokeLinecap="round" />
      <path d="M 72 6 Q 85 2 88 12" stroke="#eab308" strokeWidth="4" fill="none" opacity="1" strokeLinecap="round" />
      
      <path d="M 30 7 Q 22 4 20 11" stroke="#facc15" strokeWidth="1.5" fill="none" opacity="0.6" strokeLinecap="round" />
      <path d="M 70 7 Q 78 4 80 11" stroke="#facc15" strokeWidth="1.5" fill="none" opacity="0.6" strokeLinecap="round" />
    </svg>
  );
}
