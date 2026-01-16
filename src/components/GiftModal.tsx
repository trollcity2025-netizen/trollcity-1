import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../lib/store';
import { useCoins } from '../lib/hooks/useCoins';
import { toast } from 'sonner';
import { Gift, Coins, Zap, X, Loader2 } from 'lucide-react';
import LuckyWinOverlay from './LuckyWinOverlay';

interface GiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: string;
  recipientUsername: string;
}

interface LuckyResult {
  multiplier: number;
  trollmondsAwarded: number;
}

const GiftModal: React.FC<GiftModalProps> = ({
  isOpen,
  onClose,
  recipientId,
  recipientUsername
}) => {
  const { user } = useAuthStore();
  const { balances } = useCoins();
  const [amount, setAmount] = useState<number>(100);
  const [loading, setLoading] = useState(false);
  const [luckyResult, setLuckyResult] = useState<LuckyResult | null>(null);
  const [showLuckyOverlay, setShowLuckyOverlay] = useState(false);

  const presetAmounts = [50, 100, 200, 500, 1000, 2500, 5000];
      }
    };

    if (isOpen && user) {
      loadBalance();
    }
  }, [isOpen, user]);

  const sendGift = async () => {
    if (!user || amount <= 0 || amount > balances.troll_coins) {
      toast.error('Invalid gift amount or insufficient balance');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('process_gift_with_lucky', {
        p_sender_id: user.id,
        p_receiver_id: recipientId,
        p_troll_coins: amount
      });

      if (error) throw error;

      if (data.success) {
        // Check for lucky win
        if (data.lucky_multiplier) {
          setLuckyResult({
            multiplier: data.lucky_multiplier,
            trollmondsAwarded: data.trollmonds_awarded
          });
          setShowLuckyOverlay(true);

          // Update trollmonds balance
          setBalance(prev => ({
            ...prev,
            trollmonds: prev.trollmonds + data.trollmonds_awarded
          }));
        } else {
          toast.success(`Gift sent successfully!`);
        }

        // Close modal after a delay if no lucky win
        if (!data.lucky_multiplier) {
          setTimeout(() => {
            onClose();
            setAmount(100);
          }, 1500);
        }
      } else {
        toast.error(data.error || 'Failed to send gift');
      }
    } catch (error: any) {
      console.error('Gift error:', error);
      toast.error(error.message || 'Failed to send gift');
    } finally {
      setLoading(false);
    }
  };

  const handleLuckyComplete = () => {
    setShowLuckyOverlay(false);
    setLuckyResult(null);
    onClose();
    setAmount(100);
  };

  // const getMultiplierColor = (mult: number) => {
  //   switch (mult) {
  //     case 100: return 'text-yellow-400';
  //     case 200: return 'text-orange-400';
  //     case 500: return 'text-pink-400';
  //     case 1000: return 'text-cyan-400';
  //     case 10000: return 'text-red-400';
  //     default: return 'text-yellow-400';
  //   }
  // };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Gift className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Send Gift</h3>
                <p className="text-sm text-gray-400">to {recipientUsername}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Balance Display */}
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-gray-400">Troll Coins</span>
              </div>
              <span className="text-lg font-bold text-yellow-400">
                {balance.troll_coins.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-green-400" />
                <span cls.troll_coins.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">Trollmonds</span>
              </div>
              <span className="text-lg font-bold text-green-400">
                {balances.troll_coin
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Gift Amount
            </label>

            {/* Preset Amounts */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {presetAmounts.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAmount(preset)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    amount === preset
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {preset.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Custom Amount */}
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter amount"
                min="1"
              />
              <Coins className="absolute right-3 top-3 w-5 h-5 text-yellow-400" />
            </div>
          </div>

          {/* Lucky Info */}
          <div className="bg-gradient-to-r from-yellow-500/10 to-purple-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-yellow-400">Lucky Chance!</span>
            </div>
            <p className="text-xs text-gray-300 mb-3">
              Every gift has a chance to win Trollmonds multipliers!
            </p>
            <div className="grid grid-cols-5 gap-1 text-xs">
              <div className="text-center">
                <div className="text-yellow-400 font-bold">x100</div>
                <div className="text-gray-400">6.0%</div>
              </div>
              <div className="text-center">
                <div className="text-orange-400 font-bold">x200</div>
                <div className="text-gray-400">2.5%</div>
              </div>
              <div className="text-center">
                <div className="text-pink-400 font-bold">x500</div>
                <div className="text-gray-400">1.0%</div>
              </div>
              <div className="text-center">
                <div className="text-cyan-400 font-bold">x1000</div>
                <div className="text-gray-400">0.25%</div>
              </div>
              <div className="text-center">
                <div className="text-red-400 font-bold">x10k</div>
                <div className="text-gray-400">0.01%</div>
              </div>
            </div>
          </div>

          {/* Send Button */}
          <button
            onClick={sendGift}
            disabled={loading || amount <= 0 || amount > balances.troll_coins}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Gift className="w-5 h-5" />
                Send Gift ({amount.toLocaleString()} Coins)
              </>
            )}
          </button>

          {amount > balances.troll_coins && (
            <p className="text-red-400 text-sm mt-2 text-center">
              Insufficient Troll Coins balance
            </p>
          )}
        </div>
      </div>

      {/* Lucky Win Overlay */}
      <LuckyWinOverlay
        multiplier={luckyResult?.multiplier || 0}
        trollmondsAwarded={luckyResult?.trollmondsAwarded || 0}
        isVisible={showLuckyOverlay}
        onComplete={handleLuckyComplete}
      />
    </>
  );
};

export default GiftModal;