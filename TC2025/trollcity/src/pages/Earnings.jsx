import React, { useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Gift, Heart, Users, Zap, DollarSign, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { debitCoins } from '@/lib/coins';

const DEFAULT_TIERS = [
  { id: 'bronze', name: 'Bronze', requirement: 7000, coins: '7,000', payout: 25, fixedFee: 4.0, color: 'from-amber-600 to-amber-700' },
  { id: 'silver', name: 'Silver', requirement: 14000, coins: '14,000', payout: 55, fixedFee: 5.5, color: 'from-gray-400 to-gray-500' },
  { id: 'gold', name: 'Gold', requirement: 27000, coins: '27,000', payout: 100, fixedFee: 10.0, color: 'from-yellow-400 to-yellow-600' },
  { id: 'platinum', name: 'Platinum', requirement: 48000, coins: '48,000', payout: 175, fixedFee: 20.0, color: 'from-blue-400 to-purple-600' },
];

const EARNING_METHODS = [
  { icon: <Gift className="w-5 h-5" />, title: 'Receive Gifts', desc: 'Viewers send you gifts during streams', earning: '100-500 coins' },
  { icon: <Heart className="w-5 h-5" />, title: 'Get Likes', desc: 'Each like from viewers earns coins', earning: '10-50 coins' },
  { icon: <Users className="w-5 h-5" />, title: 'Followers Bonus', desc: 'Earn coins per follower milestone', earning: '50-200 coins' },
  { icon: <Zap className="w-5 h-5" />, title: 'Streamer Bonus', desc: 'Stream time multiplier bonuses', earning: '500+ coins' },
];

export default function Earnings() {
  const [coins, setCoins] = useState('');
  const [payoutRequested, setPayoutRequested] = useState(false);
  const [supportText, setSupportText] = useState('');
  const [supportSending, setSupportSending] = useState(false);
    const queryClient = useQueryClient(); // Initialize query client
  const coinsNum = parseInt(coins || '0', 10) || 0;

  // Fetch current user profile
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      return profile;
    },
  });

  // Fetch earnings config from database
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['earningsConfig'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('earnings_config')
        .select('*')
        .eq('id', 1)
        .single();
      if (error) {
        console.warn('Failed to load earnings config, using defaults:', error.message);
        return null;
      }
      return data;
    },
    staleTime: 60000, // Cache for 1 minute
  });

  // Use fixed tiers defined above
  const TIERS = DEFAULT_TIERS;

  // Calculate transaction fees
  const calculateNetPayout = (grossPayout, fixedFee) => {
    if (typeof fixedFee === 'number' && fixedFee >= 0) return Number((grossPayout - fixedFee).toFixed(2));
    if (!config) return grossPayout;
    const grossCents = Math.round(grossPayout * 100);
    const percentageFee = Math.round((grossCents * (config.transaction_fee_percentage ?? 0)) / 100);
    const totalFee = percentageFee + (config.transaction_fee_fixed_cents ?? 0);
    return (grossCents - totalFee) / 100;
  };

  // Safe fee fallbacks when config is missing
  const feePercentage = config?.transaction_fee_percentage ?? 2.9;
  const feeFixedCents = Number.isFinite(config?.transaction_fee_fixed_cents) ? config.transaction_fee_fixed_cents : 30;

  // Compute tier estimates with net payout and unlocked state
  const estimated = TIERS.map((t) => {
    const requirement = Number(t.requirement) || 0;
    const grossPayout = Number(t.payout) || 0;
    const netPayout = calculateNetPayout(grossPayout, t.fixedFee);
    const meets = coinsNum >= requirement;
    return {
      ...t,
      requirement,
      payout: grossPayout,
      netPayout,
      meets,
    };
  });

  // Determine current unlocked tier (highest unlocked) and next tier to reach
  const unlockedTiers = estimated.filter(t => t.meets);
  const currentTier = unlockedTiers.length > 0 ? unlockedTiers[unlockedTiers.length - 1] : null;
  const nextTier = estimated.find(t => !t.meets) || null;

  // Payout request mutation
  const requestPayoutMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) throw new Error('Not authenticated');
      if (!currentTier) throw new Error('No eligible tier unlocked');

      const amountCents = Math.round(currentTier.netPayout * 100);
      const debitAmount = Number(currentTier.requirement || 0);
      
      // Get user's payout method from profile
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('payout_method, square_customer_id, cashapp_tag, apple_pay_id, google_wallet_id, chime_id')
        .eq('id', currentUser.id)
        .single();
      
      if (!userProfile?.payout_method) {
        throw new Error('No payout method configured. Please set up a payment method in your profile first.');
      }
      
      // Use the new cashout function with 24-hour wait limit
      const paymentDetails = {
        square_customer_id: userProfile.square_customer_id,
        cashapp_tag: userProfile.cashapp_tag,
        apple_pay_id: userProfile.apple_pay_id,
        google_wallet_id: userProfile.google_wallet_id,
        chime_id: userProfile.chime_id
      };
      
      const { data: cashoutResult, error: cashoutError } = await supabase
        .rpc('create_cashout_request', {
          p_user_id: currentUser.id,
          p_amount: currentTier.netPayout,
          p_payment_method: userProfile.payout_method,
          p_payment_details: paymentDetails
        });

      if (cashoutError) throw cashoutError;
      
      if (!cashoutResult.success) {
        if (cashoutResult.wait_hours > 0) {
          throw new Error(`${cashoutResult.message} Please wait ${cashoutResult.wait_hours} more hours.`);
        }
        throw new Error(cashoutResult.message);
      }

      // RAPID PROCESSING: Immediately trigger processing for level 40+ users
      if (currentUser.level >= 40) {
        // Trigger immediate processing in background
        setTimeout(async () => {
          try {
            const { data: pendingCashouts } = await supabase
              .from('cashout_requests')
              .select('id, user_id, amount, coins_cost')
              .eq('user_id', currentUser.id)
              .eq('status', 'pending')
              .order('created_at', { ascending: true })
              .limit(1);

            if (pendingCashouts && pendingCashouts.length > 0) {
              const cashout = pendingCashouts[0];
              
              // Auto-process for level 40+ users
              const { data: authData } = await supabase.auth.getUser();
              const response = await supabase.functions.invoke('processSquarePayout', {
                body: {
                  cashoutId: cashout.id,
                  amount: cashout.amount,
                  userId: cashout.user_id,
                  currency: 'USD',
                  paymentMethod: userProfile.payout_method
                },
                headers: {
                  'Authorization': `Bearer ${authData.data.session?.access_token}`
                }
              });

              if (response.data?.success) {
                toast.success(`💰 Cashout processed in ${response.data.processingTime/1000}s!`);
              }
            }
          } catch (error) {
            console.log('Auto-processing failed, will be processed manually:', error);
          }
        }, 1000); // Process after 1 second
      }
      
      return cashoutResult;
    },
    onSuccess: (result) => {
      const message = result.message || `✅ Payout request of $${currentTier.netPayout.toFixed(2)} submitted successfully!`;
      toast.success(message);
      queryClient.invalidateQueries(['currentUser']);
      setPayoutRequested(false);
      setCoins(''); // Clear coin input
    },
    onError: (err) => {
      toast.error(`❌ Payout failed: ${err?.message || 'Unknown error'}`);
    },
  });

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#09090d] to-[#07060a] py-10 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">💰 Earnings & Payout Tiers</h1>
          <p className="text-gray-400">Track your coins and unlock higher payout tiers</p>
          <div className="mt-3 space-y-2">
            <div className="p-3 rounded bg-yellow-900/20 border border-yellow-600/30 text-yellow-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Payouts are processed 30 minutes after you cash out.
            </div>
            {currentUser && (
              <div className={`p-3 rounded border text-sm flex items-center gap-2 ${
                currentUser.level >= 40 
                  ? 'bg-green-900/20 border-green-600/30 text-green-300' 
                  : 'bg-blue-900/20 border-blue-600/30 text-blue-300'
              }`}>
                <AlertCircle className="w-4 h-4" />
                {currentUser.level >= 40 
                  ? `✅ Level ${currentUser.level}+ - You have INSTANT cashout access! No 24-hour wait required.` 
                  : `⏰ Level ${currentUser.level} - 24-hour wait between cashouts. Reach level 40 for instant access!`
                }
              </div>
            )}
          </div>
        </div>

        {/* Coin Calculator */}
        <Card className="bg-gradient-to-r from-[#1a1a24] to-[#0f0f14] border-[#2a2a3a] p-6 mb-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Coin Calculator
          </h2>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="text-gray-400 text-sm mb-2 block">Enter Your Current Coins</label>
              <Input 
                value={coins} 
                onChange={(e) => setCoins(e.target.value)} 
                placeholder="e.g., 12500" 
                className="bg-[#0a0a0f] border-[#2a2a3a] text-white text-lg"
              />
            </div>
            <Button onClick={() => setCoins('')} variant="outline" className="bg-[#0a0a0f] border-[#2a2a3a] text-white hover:bg-[#1a1a24]">
              Clear
            </Button>
          </div>

          {/* Tier Status */}
          {coins && (
            <div className="mt-6 p-4 bg-[#0a0a0f] rounded-lg border border-[#2a2a3a]">
              {currentTier ? (
                <>
                  <p className="text-gray-300 mb-2">
                    ✅ You've unlocked <span className="font-bold text-green-400">{currentTier.name}</span> tier!
                  </p>
                  <p className="text-sm text-gray-500">
                    Gross payout: <span className="text-yellow-400 font-semibold">${currentTier.payout.toFixed(2)}</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    After fees: <span className="text-emerald-300 font-semibold">${currentTier.netPayout.toFixed(2)}</span>
                  </p>
                </>
              ) : nextTier ? (
                <>
                  <p className="text-gray-300 mb-2">
                    Next tier: <span className="font-bold text-cyan-400">{nextTier.name}</span>
                  </p>
                  <p className="text-sm text-gray-500">
                    Earn <span className="text-emerald-400 font-semibold">{(nextTier.requirement - coinsNum).toLocaleString()}</span> more coins to unlock ${nextTier.payout.toFixed(2)} payout
                  </p>
                </>
              ) : null}
            </div>
          )}
        </Card>

        {/* Payout Request Section */}
        {currentTier && (
          <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30 p-6 mb-6">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              Request Payout
            </h2>
            {!payoutRequested ? (
              <Button
                onClick={() => setPayoutRequested(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Request ${currentTier.netPayout.toFixed(2)} Payout
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="bg-[#0a0a0f] p-4 rounded-lg border border-[#2a2a3a]">
                  <p className="text-gray-300 text-sm mb-2">Payout Method: <span className="text-emerald-400 font-semibold">{currentUser?.payout_method || 'Not configured'}</span></p>
                  <p className="text-xs text-gray-500">
                    💡 Make sure you have configured a payout method in your profile (CashApp, Apple Pay, Google Wallet, or Chime).
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setPayoutRequested(false)}
                    variant="outline"
                    className="border-[#2a2a3a] text-gray-300 hover:bg-[#1a1a24] flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => requestPayoutMutation.mutate()}
                    disabled={!currentUser?.payout_method || requestPayoutMutation.isPending || (currentTier?.payout || 0) < 25}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                  >
                    {requestPayoutMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <DollarSign className="w-4 h-4 mr-2" />
                        Request Payout
                      </>
                    )}
                  </Button>
                </div>
                {!currentUser?.payout_method && (
                  <p className="text-xs text-red-400 mt-2">Please configure a payout method in your profile first.</p>
                )}
                {(currentTier?.payout || 0) < 25 && (
                  <p className="text-xs text-red-400 mt-2">Minimum payout is $25.</p>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Payout Tiers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {estimated.map((t, index) => (
            <Card key={`tier-${t.id}-${index}`} className={`border-2 bg-gradient-to-br ${t.meets ? `border-green-500 ${t.color}` : 'border-[#2a2a3a] from-[#1a1a24] to-[#0f0f14]'} p-6 transition-all ${t.meets ? 'shadow-lg shadow-green-500/20' : 'opacity-70'}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`font-bold text-lg ${t.meets ? 'text-white' : 'text-gray-300'}`}>{t.name}</h3>
                {t.meets && <Badge className="bg-green-500 text-white">✓ Unlocked</Badge>}
              </div>
              
              <div className="mb-4 p-3 bg-black/30 rounded">
                <p className="text-xs text-gray-400 mb-1">Requirement</p>
                <p className={`text-xl font-bold ${t.meets ? 'text-green-400' : 'text-gray-300'}`}>{t.coins}</p>
              </div>

              <div className="mb-4 p-3 bg-black/30 rounded">
                <p className="text-xs text-gray-400 mb-1">Gross Payout</p>
                <p className="text-2xl font-bold text-yellow-400">${t.payout.toFixed(2)}</p>
              </div>

              <div className="mb-4 p-3 bg-black/20 rounded border border-purple-500/20">
                <p className="text-xs text-gray-400 mb-1">After Fees</p>
                <p className="text-lg font-bold text-emerald-300">${t.netPayout.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">Fee: ${(t.payout - t.netPayout).toFixed(2)}</p>
              </div>

              {t.meets ? (
                <p className="text-green-300 text-xs font-semibold">You qualify for this tier</p>
              ) : (
                <p className="text-gray-400 text-xs">Need {t.coins} coins</p>
              )}
            </Card>
          ))}
        </div>

        {/* Support Ticket */}
        <Card className="bg-[#0f1014] border-[#2a2a3a] p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">🧾 Submit a Support Ticket</h3>
          <p className="text-gray-400 text-sm mb-3">Send a ticket to admin. It appears in Messages under Support Tickets.</p>
          <Textarea
            placeholder="Describe your issue or question"
            className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
            value={supportText}
            onChange={(e) => setSupportText(e.target.value)}
          />
          <div className="mt-3 flex justify-end">
            <Button
              disabled={!supportText.trim() || supportSending}
              onClick={async () => {
                if (!currentUser) { toast.error('Login required'); return; }
                setSupportSending(true);
                try {
                  await supabase.from('officer_chats').insert({ sender_id: currentUser.id, message: supportText.trim(), message_type: 'support_ticket', created_date: new Date().toISOString() });
                  setSupportText('');
                  toast.success('Support ticket submitted');
                } catch (e) {
                  toast.error(e?.message || 'Failed to submit ticket');
                } finally {
                  setSupportSending(false);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {supportSending ? 'Submitting...' : 'Submit Ticket'}
            </Button>
          </div>
        </Card>

        {/* Levels — Paid Coins Daily Bonus */}
        <Card className="bg-[#0f1014] border-[#2a2a3a] p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">All Levels — Paid Coins</h3>
          <div className="overflow-x-auto">
            <div className="min-w-[520px] grid grid-cols-3 gap-2">
              <div className="text-xs text-gray-400">Level</div>
              <div className="text-xs text-gray-400">Range</div>
              <div className="text-xs text-gray-400">Extra per day (paid)</div>
              {LEVEL_BONUSES.map((l, index) => (
                <React.Fragment key={`level-bonus-${l.name}-${index}`}>
                  <div className="p-2 bg-[#0a0a0f] text-white rounded">{l.name}</div>
                  <div className="p-2 bg-[#0a0a0f] text-gray-300 rounded">{l.range}</div>
                  <div className="p-2 bg-[#0a0a0f] text-emerald-300 rounded">{l.dailyPaid} coins</div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </Card>

        {/* Payout Information */}
        <Card className="bg-[#0f1014] border-[#2a2a3a] p-6">
          <h3 className="text-white font-semibold mb-4">💰 Payout Information</h3>
          <ul className="text-gray-400 text-sm space-y-3">
            <li className="flex gap-2">
              <span className="text-emerald-400">✓</span>
              <span>Payout amounts are estimates and subject to platform fees.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-400">✓</span>
              <span>Minimum payout is $25</span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-400">✓</span>
              <span>Payout eligibility may depend on account standing and verification.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400">📱</span>
              <span className="font-semibold text-emerald-400">In your profile, you must set up a payout method to ensure cashouts are sent.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-yellow-400">⏱️</span>
              <span>Payouts are processed 30 minutes after you cash out.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-400">❓</span>
              <span>Contact the admin team for questions about earnings and payouts.</span>
            </li>
          </ul>
        </Card>
      </div>
    </main>
  );
}
const LEVEL_BONUSES = [
  { name: 'Tiny Troller', range: '0–9', dailyPaid: 15 },
  { name: 'Gang Troller', range: '10–19', dailyPaid: 35 },
  { name: 'OG Troller', range: '20–40', dailyPaid: 75 },
  { name: 'Old Ass troller', range: '41–60', dailyPaid: 100 },
  { name: 'Dead troller', range: '61–70', dailyPaid: 200 },
  { name: 'Graveyard', range: '71–100', dailyPaid: 500 },
];
