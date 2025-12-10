import React, { useState } from 'react';
import { useAuthStore } from '../lib/store';
import { applyTrollTractBonus, calculateTrollTractRankingBoost, getTrollTractFeatureAccess } from '../lib/trolltractUtils';
import TrollTractBadge from './TrollTractBadge';
import { TrollTractBadgeCard } from './TrollTractBadge';
import { 
  Gift, 
  TrendingUp, 
  Crown, 
  Star, 
  Zap, 
  Users, 
  Eye,
  BarChart3,
  CheckCircle,
  ArrowRight
} from 'lucide-react';

/**
 * Example component showing how to integrate TrollTract benefits
 * This demonstrates gift processing with TrollTract bonuses and ranking boosts
 */
export default function TrollTractIntegrationExample() {
  const { profile, user } = useAuthStore();
  const [giftAmount, setGiftAmount] = useState(100);
  const [calculationResult, setCalculationResult] = useState<any>(null);

  // Get TrollTract feature access
  const featureAccess = getTrollTractFeatureAccess(profile || {} as any);

  // Example: Calculate TrollTract bonus for a gift
  const handleCalculateBonus = async () => {
    if (!profile) return;

    const result = await applyTrollTractBonus(
      profile.id,
      giftAmount,
      'example-gift-id',
      'example-stream-id',
      'example-sender-id'
    );

    setCalculationResult(result);
  };

  // Example: Calculate ranking boost
  const rankingExample = calculateTrollTractRankingBoost(1000, profile || {} as any);

  const benefits = [
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "10% Bonus Earnings",
      description: "Get 10% bonus on every qualifying gift you receive",
      status: featureAccess.getsBonusEarnings ? 'active' : 'locked',
      value: `${featureAccess.bonusPercentage}% bonus`
    },
    {
      icon: <Crown className="w-6 h-6" />,
      title: "Creator Dashboard",
      description: "Advanced analytics, earnings tracking, and performance insights",
      status: featureAccess.canAccessCreatorDashboard ? 'active' : 'locked',
      value: featureAccess.canAccessCreatorDashboard ? 'Unlocked' : '20,000 coins'
    },
    {
      icon: <Star className="w-6 h-6" />,
      title: "Priority Ranking",
      description: "25% boost in discovery, recommendations, and search results",
      status: featureAccess.getsRankingBoost ? 'active' : 'locked',
      value: `+${featureAccess.rankingBoostPercentage}% boost`
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Featured Eligibility",
      description: "Qualify for Featured Shows, battles, and special events",
      status: featureAccess.canApplyForFeatured ? 'active' : 'locked',
      value: featureAccess.canApplyForFeatured ? 'Available' : 'Locked'
    },
    {
      icon: <Eye className="w-6 h-6" />,
      title: "Shadow Mode",
      description: "Hide viewer count until you reach 20+ concurrent viewers",
      status: featureAccess.hasShadowMode ? 'active' : 'locked',
      value: featureAccess.hasShadowMode ? 'Available' : 'Locked'
    },
    {
      icon: <Crown className="w-6 h-6" />,
      title: "Official Badge",
      description: "TrollTract Creator badge displayed on your profile",
      status: featureAccess.hasCreatorBadge ? 'active' : 'locked',
      value: featureAccess.hasCreatorBadge ? 'Active' : 'Locked'
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* TrollTract Status */}
      <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Crown className="w-6 h-6 text-gold-400" />
            TrollTract Status
          </h3>
          {featureAccess.hasTrollTract && (
            <TrollTractBadge profile={profile || {} as any} size="md" />
          )}
        </div>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Status:</span>
              <span className={featureAccess.hasTrollTract ? 'text-green-400' : 'text-yellow-400'}>
                {featureAccess.hasTrollTract ? 'Active Creator' : 'Not Activated'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Bonus Rate:</span>
              <span className="text-gold-400">{featureAccess.bonusPercentage}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Ranking Boost:</span>
              <span className="text-purple-400">+{featureAccess.rankingBoostPercentage}%</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Creator Dashboard:</span>
              <span className={featureAccess.canAccessCreatorDashboard ? 'text-green-400' : 'text-red-400'}>
                {featureAccess.canAccessCreatorDashboard ? 'Available' : 'Locked'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Featured Access:</span>
              <span className={featureAccess.canApplyForFeatured ? 'text-green-400' : 'text-red-400'}>
                {featureAccess.canApplyForFeatured ? 'Available' : 'Locked'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Shadow Mode:</span>
              <span className={featureAccess.hasShadowMode ? 'text-green-400' : 'text-red-400'}>
                {featureAccess.hasShadowMode ? 'Available' : 'Locked'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Grid */}
      <div className="bg-gradient-to-r from-purple-900/20 to-gold-900/20 rounded-xl p-6 border border-purple-500/30">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Star className="w-6 h-6 text-gold-400" />
          TrollTract Benefits
        </h3>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {benefits.map((benefit, index) => (
            <div 
              key={index} 
              className={`p-4 rounded-lg border transition-all ${
                benefit.status === 'active' 
                  ? 'bg-green-900/20 border-green-500/30' 
                  : 'bg-gray-900/30 border-gray-700/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-1 ${
                  benefit.status === 'active' ? 'text-green-400' : 'text-gray-500'
                }`}>
                  {benefit.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className={`font-semibold ${
                      benefit.status === 'active' ? 'text-white' : 'text-gray-400'
                    }`}>
                      {benefit.title}
                    </h4>
                    {benefit.status === 'active' ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <div className="w-4 h-4 border-2 border-gray-500 rounded-full" />
                    )}
                  </div>
                  <p className={`text-sm mb-2 ${
                    benefit.status === 'active' ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    {benefit.description}
                  </p>
                  <p className={`text-xs font-semibold ${
                    benefit.status === 'active' ? 'text-gold-400' : 'text-gray-500'
                  }`}>
                    {benefit.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Integration Examples */}
      <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-purple-400" />
          Integration Examples
        </h3>
        
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Gift Bonus Calculator */}
          <div className="space-y-4">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Gift Bonus Calculator
            </h4>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Gift Amount</label>
                <input
                  type="number"
                  value={giftAmount}
                  onChange={(e) => setGiftAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white"
                />
              </div>
              
              <button
                onClick={handleCalculateBonus}
                className="w-full bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                Calculate TrollTract Bonus
              </button>
              
              {calculationResult && (
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Base Amount:</span>
                      <span className="text-white">{calculationResult.baseAmount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">TrollTract Bonus:</span>
                      <span className="text-gold-400">+{calculationResult.bonusAmount}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span className="text-white">Total Earnings:</span>
                      <span className="text-green-400">{calculationResult.totalAmount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Bonus Rate:</span>
                      <span className="text-gold-400">{calculationResult.bonusPercentage}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Ranking Boost Example */}
          <div className="space-y-4">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Ranking Boost Example
            </h4>
            
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Base Ranking Score:</span>
                  <span className="text-white">1,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">TrollTract Boost:</span>
                  <span className="text-purple-400">+25%</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-white">Boosted Score:</span>
                  <span className="text-green-400">{rankingExample.toLocaleString()}</span>
                </div>
                <div className="text-xs text-gray-500 pt-2 border-t border-gray-600">
                  TrollTract creators get 25% higher visibility in discovery and recommendations
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      {!featureAccess.hasTrollTract && (
        <div className="bg-gradient-to-r from-purple-900/30 to-gold-900/30 rounded-xl p-6 border border-purple-500/50">
          <div className="text-center">
            <Crown className="w-12 h-12 text-gold-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Activate TrollTract Today</h3>
            <p className="text-gray-300 mb-4">
              Join the elite group of TrollTract Creators and unlock permanent monetization benefits
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-gray-400 mb-6">
              <span>• One-time payment</span>
              <span>• Permanent benefits</span>
              <span>• No renewals</span>
            </div>
            <button className="bg-gradient-to-r from-purple-600 to-gold-600 hover:from-purple-700 hover:to-gold-700 px-8 py-3 rounded-xl font-bold text-white transition-all flex items-center gap-2 mx-auto">
              Activate TrollTract (20,000 Coins)
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}