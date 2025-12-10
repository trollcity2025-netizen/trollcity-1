import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { Crown, Check, AlertCircle, Zap, TrendingUp, Users, Star } from 'lucide-react';

interface TrollTractActivationProps {
  onActivationComplete?: () => void;
}

export default function TrollTractActivation({ onActivationComplete }: TrollTractActivationProps) {
  const { profile, user } = useAuthStore();
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentCoins = profile?.paid_coin_balance || 0;
  const requiredCoins = 20000;
  const hasEnoughCoins = currentCoins >= requiredCoins;
  const isAlreadyActivated = profile?.is_trolltract;

  const handleActivate = async () => {
    if (!user || !profile) return;
    
    setIsActivating(true);
    setError(null);
    setSuccess(null);

    try {
      // Call the activate-trolltract edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/activate-trolltract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          user_id: user.id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to activate TrollTract');
      }

      setSuccess(result.message);
      
      // Refresh profile to get updated data
      await supabase.auth.refreshSession();
      
      // Call completion callback
      if (onActivationComplete) {
        onActivationComplete();
      }

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsActivating(false);
    }
  };

  const benefits = [
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: "10% Bonus Earnings",
      description: "Get 10% bonus on all qualifying gifts"
    },
    {
      icon: <Crown className="w-5 h-5" />,
      title: "Creator Dashboard",
      description: "Access advanced analytics and earnings tracking"
    },
    {
      icon: <Star className="w-5 h-5" />,
      title: "Priority Ranking",
      description: "25% boost in discovery and recommendation algorithms"
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: "Featured Eligibility",
      description: "Qualify for Featured Shows, battles, and special events"
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Official Badge",
      description: "TrollTract Creator badge displayed on your profile"
    },
    {
      icon: <Crown className="w-5 h-5" />,
      title: "Permanent Contract",
      description: "One-time activation, permanent benefits"
    }
  ];

  if (isAlreadyActivated) {
    return (
      <div className="bg-gradient-to-br from-purple-900/20 to-gold-900/20 rounded-xl p-6 border border-purple-500/30">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-gold-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">TrollTract Activated!</h3>
          <p className="text-gray-300 mb-4">
            You're now an official TrollTract Creator with permanent access to all creator features.
          </p>
          <div className="bg-purple-900/30 rounded-lg p-3">
            <p className="text-sm text-purple-200">
              Activated on: {new Date(profile?.trolltract_activated_at || '').toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-20 h-20 bg-gradient-to-r from-purple-600 to-gold-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Crown className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Activate TrollTract</h2>
        <p className="text-gray-300 text-lg">
          Become an official TrollTract Creator with permanent monetization benefits
        </p>
      </div>

      {/* Cost Display */}
      <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <span className="text-white font-semibold">Activation Cost</span>
          <span className="text-2xl font-bold text-gold-400">
            {requiredCoins.toLocaleString()} Troll Coins
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Your Balance</span>
          <span className={`font-bold ${hasEnoughCoins ? 'text-green-400' : 'text-red-400'}`}>
            {currentCoins.toLocaleString()} Troll Coins
          </span>
        </div>

        {!hasEnoughCoins && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-200">
              You need {(requiredCoins - currentCoins).toLocaleString()} more coins
            </span>
          </div>
        )}
      </div>

      {/* Benefits Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {benefits.map((benefit, index) => (
          <div key={index} className="bg-gray-900/30 rounded-lg p-4 border border-gray-700/50">
            <div className="flex items-start gap-3">
              <div className="text-purple-400 mt-1">
                {benefit.icon}
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">{benefit.title}</h4>
                <p className="text-sm text-gray-300">{benefit.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Activation Button */}
      <div className="text-center">
        <button
          onClick={handleActivate}
          disabled={!hasEnoughCoins || isActivating}
          className={`px-8 py-4 rounded-xl font-bold text-lg transition-all ${
            hasEnoughCoins && !isActivating
              ? 'bg-gradient-to-r from-purple-600 to-gold-600 hover:from-purple-700 hover:to-gold-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isActivating ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Activating TrollTract...
            </div>
          ) : (
            `Activate TrollTract (${requiredCoins.toLocaleString()} Coins)`
          )}
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-200">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-4 flex items-center gap-2">
          <Check className="w-5 h-5 text-green-400" />
          <span className="text-green-200">{success}</span>
        </div>
      )}

      {/* Contract Terms */}
      <div className="bg-gray-900/30 rounded-lg p-4 border border-gray-700/50">
        <h4 className="font-semibold text-white mb-2">Contract Terms</h4>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• One-time payment of 20,000 Troll Coins</li>
          <li>• Permanent TrollTract Creator status</li>
          <li>• No recurring fees or renewals</li>
          <li>• Benefits remain active unless account is suspended for violations</li>
          <li>• No refunds after activation</li>
        </ul>
      </div>
    </div>
  );
}