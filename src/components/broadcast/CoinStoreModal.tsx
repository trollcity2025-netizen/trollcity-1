import { X, ShoppingCart, Shield, Zap, Coins as CoinsIcon, Sparkles, Smartphone, Banknote, CreditCard } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { useAuthStore } from "../../lib/store";
import { useBank } from "../../lib/hooks/useBank";
import { ENTRANCE_EFFECTS_CONFIG } from "../../lib/entranceEffects";
import CashAppPaymentModal from "./CashAppPaymentModal";

interface CoinPackage {
  id: number;
  coins: number;
  price: string;
  emoji: string;
  popular?: boolean;
  bestValue?: boolean;
}

const PROMO_EXPIRY = new Date('2026-01-28T00:51:27Z').getTime();

const coinPackages: CoinPackage[] = [
  { 
    id: 1, 
    coins: 1000, 
    price: Date.now() < PROMO_EXPIRY ? "$0.10" : "$1.00", 
    emoji: "🔥", 
    popular: true 
  },
  { id: 2, coins: 500, price: "$4.99", emoji: "💰" },
  { id: 3, coins: 1000, price: "$9.99", emoji: "💎" },
  { id: 4, coins: 2500, price: "$19.99", emoji: "👑" },
  { id: 5, coins: 5000, price: "$39.99", emoji: "🚀" },
  { id: 6, coins: 10000, price: "$69.99", emoji: "⭐", bestValue: true },
  { id: 7, coins: 13000, price: "$89.99", emoji: "🌟" },
  { id: 8, coins: 20000, price: "$129.00", emoji: "🏆" },
];

interface CoinStoreModalProps {
  onClose: () => void;
  onPurchase?: (coins: number) => void;
}

export default function CoinStoreModal({
  onClose,
}: CoinStoreModalProps) {
  const { profile, refreshProfile } = useAuthStore();
  const { loan, tiers, applyForLoan, loading: bankLoading } = useBank();
  const [activeTab, setActiveTab] = useState<'coins' | 'perks' | 'insurance' | 'effects' | 'loan'>('coins');
  const [selectedPackage, setSelectedPackage] = useState<CoinPackage | null>(null);
  const [perks, setPerks] = useState<any[]>([]);
  const [insuranceOptions, setInsuranceOptions] = useState<any[]>([]);
  const [ownedEffects, setOwnedEffects] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [cashAppModalOpen, setCashAppModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'cashapp'>('stripe');
  
  // Loan State
  const [loanAmount, setLoanAmount] = useState(100);
  const [loanProcessing, setLoanProcessing] = useState(false);
  const [eligibility, setEligibility] = useState<{ canApply: boolean; reasons: string[]; maxAmount: number; nextTier?: any }>({ 
    canApply: false, 
    reasons: [], 
    maxAmount: 0 
  });

  useEffect(() => {
    if (!profile) return;
    
    // Calculate eligibility (mirrors TrollBank.tsx logic)
    const checkEligibility = () => {
      const reasons: string[] = [];
      let canApply = true;

      if (loan) {
        reasons.push('You already have an active loan.');
        canApply = false;
      }

      // Calculate account age
      const created = new Date(profile.created_at || Date.now());
      const diffTime = Math.abs(Date.now() - created.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

      // Find eligible tier
      const sortedTiers = [...(tiers || [])].sort((a, b) => b.min_tenure_days - a.min_tenure_days);
      const eligibleTier = sortedTiers.find(t => diffDays >= t.min_tenure_days);
      const nextTier = sortedTiers.slice().reverse().find(t => t.min_tenure_days > diffDays);

      const maxAmount = eligibleTier ? eligibleTier.max_loan_coins : 0;
      
      // Removed legacy checks (7 days, starter coins) as per user request for tiered system starting at 0 days
      if (maxAmount === 0) {
        reasons.push('No eligible loan tier found.');
        canApply = false;
      }

      setEligibility({ canApply: canApply && maxAmount > 0, reasons, maxAmount, nextTier });
      // Clamp loan amount if needed
      if (loanAmount > maxAmount && maxAmount > 0) setLoanAmount(maxAmount);
    };

    checkEligibility();
  }, [profile, loan, tiers, loanAmount]);

  useEffect(() => {
    const fetchCatalog = async () => {
      const { data: p } = await supabase.from('perks').select('*').eq('is_active', true).order('cost', { ascending: true });
      const { data: i, error: insuranceError } = await supabase.from('insurance_options').select('*').eq('is_active', true).order('cost', { ascending: true });
      if (p) setPerks(p);
      if (i) {
        const filteredInsurance = i.filter((opt: any) => opt.protection_type !== 'bankrupt');
        setInsuranceOptions(filteredInsurance);
      } else if (insuranceError) {
        console.error('Failed to fetch insurance options:', insuranceError);
      }

      if (profile) {
        const { data: effects } = await supabase
          .from('user_entrance_effects')
          .select('effect_id')
          .eq('user_id', profile.id);
        
        if (effects) {
          setOwnedEffects(new Set(effects.map(e => e.effect_id)));
        }
      }
    };
    fetchCatalog();
  }, [profile]);

  const handleItemPurchase = async (item: any, type: 'perk' | 'insurance' | 'effect') => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !profile) {
        toast.error('You must be logged in');
        return;
      }

      // Use Troll Bank Secure Spending
      const { data: spendResult, error: spendError } = await supabase.rpc('troll_bank_spend_coins_secure', {
        p_user_id: user.id,
        p_amount: item.cost,
        p_bucket: 'paid', // Default bucket
        p_source: 'store_purchase',
        p_metadata: {
          item_type: type,
          item_id: item.id,
          item_name: item.name
        }
      });

      if (spendError) throw spendError;
      if (spendResult && !spendResult.success) {
        toast.error(spendResult.error || 'Insufficient funds');
        return;
      }

      if (type === 'perk') {
        const { error } = await supabase.from('user_perks').insert({
          user_id: user.id,
          perk_id: item.id,
          expires_at: new Date(Date.now() + item.duration_minutes * 60000).toISOString()
        });
        if (error) throw error;
        toast.success(`Purchased perk: ${item.name}`);
      } else if (type === 'insurance') {
        // Validate insurance_id exists in database before inserting
        const { data: insuranceExists } = await supabase
          .from('insurance_options')
          .select('id')
          .eq('id', item.id)
          .single();

        if (!insuranceExists) {
          toast.error(`Insurance option "${item.id}" not found in database`);
          return;
        }

        const { error } = await supabase.from('user_insurances').insert({
          user_id: user.id,
          insurance_id: item.id,
          expires_at: new Date(Date.now() + item.duration_hours * 3600000).toISOString(),
          protection_type: item.protection_type
        });
        if (error) throw error;
        toast.success(`Purchased insurance: ${item.name}`);
      } else if (type === 'effect') {
        const { error } = await supabase.from('user_entrance_effects').insert({
          user_id: user.id,
          effect_id: item.id,
          acquired_at: new Date().toISOString()
        });
        if (error) throw error;
        setOwnedEffects(prev => new Set([...prev, item.id]));
        toast.success(`Purchased effect: ${item.name}`);
      }

      await refreshProfile();
    } catch (e: any) {
      console.error('Purchase failed', e);
      if (e.code === '23505') {
        toast.error('You already own this item!');
      } else {
        toast.error('Purchase failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full purple-neon max-h-[80vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={24} className="text-yellow-400" />
            <h2 className="text-xl font-bold">STORE</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('coins')}
            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'coins' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            <CoinsIcon size={18} /> Coins
          </button>
          <button
            onClick={() => setActiveTab('perks')}
            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'perks' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Zap size={18} /> Perks
          </button>
          <button
            onClick={() => setActiveTab('insurance')}
            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'insurance' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Shield size={18} /> Insurance
          </button>
          <button
            onClick={() => setActiveTab('effects')}
            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'effects' ? 'bg-pink-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sparkles size={18} /> Effects
          </button>
          <button
            onClick={() => setActiveTab('loan')}
            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'loan' ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Banknote size={18} /> Loans
          </button>
        </div>

        {/* Payment Method Toggle (Only show on Coins tab) */}
        {activeTab === 'coins' && (
          <div className="flex justify-center mb-6">
            <div className="bg-gray-800 p-1 rounded-lg flex gap-2 border border-gray-700">
              <button
                onClick={() => setPaymentMethod('stripe')}
                className={`px-4 py-2 rounded-md font-bold text-sm transition-all flex items-center gap-2 ${
                  paymentMethod === 'stripe'
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <CreditCard size={16} /> Card (Stripe)
              </button>
              <button
                onClick={() => setPaymentMethod('cashapp')}
                className={`px-4 py-2 rounded-md font-bold text-sm transition-all flex items-center gap-2 ${
                  paymentMethod === 'cashapp'
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Smartphone size={16} /> Cash App
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {activeTab === 'coins' && (
            <div className="space-y-6">
              {/* Troll Pass Promo */}
              <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/30 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Troll Pass Premium</h3>
                    <p className="text-sm text-purple-200">Get 2x XP, gold username, exclusive badges, and 1 week Ghost Mode!</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const isActive = profile && (profile as any).troll_pass_expires_at && new Date((profile as any).troll_pass_expires_at) > new Date();
                    if (isActive) {
                      toast.error('You already have an active Troll Pass!');
                      return;
                    }
                    // For now, treat as a manual purchase if no direct flow
                    // Assuming price is $9.99 (matches 1000 coins package roughly, or custom)
                    // Let's use the package system or a specific handler
                    const trollPassPackage = { id: 999, coins: 0, price: "$9.99", emoji: "👑" }; // Dummy package for pass
                    setSelectedPackage(trollPassPackage);
                    if (paymentMethod === 'cashapp') {
                      setCashAppModalOpen(true);
                    } else {
                      toast.info('Please use Cash App for Troll Pass currently.');
                    }
                  }}
                  disabled={profile && (profile as any).troll_pass_expires_at && new Date((profile as any).troll_pass_expires_at) > new Date()}
                  className={`px-6 py-2 rounded-lg font-bold text-white shadow-lg transition-all ${
                    profile && (profile as any).troll_pass_expires_at && new Date((profile as any).troll_pass_expires_at) > new Date()
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-900/20'
                  }`}
                >
                  {profile && (profile as any).troll_pass_expires_at && new Date((profile as any).troll_pass_expires_at) > new Date() ? 'Active' : 'Get Access ($9.99)'}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {coinPackages.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => {
                      setSelectedPackage(pkg);
                      if (paymentMethod === 'cashapp') {
                        setCashAppModalOpen(true);
                      } else {
                        toast.error('Stripe payments are currently disabled. Please use Cash App.');
                      }
                    }}
                    className={`relative p-4 rounded-lg transition-all transform hover:scale-105 ${
                      selectedPackage?.id === pkg.id
                        ? "bg-purple-600 ring-2 ring-purple-400"
                        : "bg-gray-800 hover:bg-gray-700"
                    }`}
                  >
                  {pkg.popular && (
                    <div className="absolute -top-2 -right-2 bg-red-600 text-xs px-2 py-1 rounded-full font-bold">
                      POPULAR
                    </div>
                  )}
                  {pkg.bestValue && (
                    <div className="absolute -top-2 -right-2 bg-green-600 text-xs px-2 py-1 rounded-full font-bold">
                      BEST
                    </div>
                  )}
                  <div className="text-4xl mb-2">{pkg.emoji}</div>
                  <div className="text-xl font-bold mb-1 text-yellow-400">
                    {pkg.coins.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-300">coins</div>
                  <div className="text-lg font-bold mt-2 text-white">
                    {pkg.price}
                  </div>
                </button>
              ))}
            </div>
          </div>
          )}

          {activeTab === 'perks' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {perks.map((perk) => (
                <div key={perk.id} className="bg-gray-800 p-4 rounded-lg border border-purple-500/30 flex flex-col">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-2xl">{perk.icon || '⚡'}</div>
                    <div>
                      <div className="font-bold">{perk.name}</div>
                      <div className="text-xs text-yellow-400">{perk.cost} Coins</div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 mb-3 flex-1">{perk.description}</p>
                  <button
                    onClick={() => handleItemPurchase(perk, 'perk')}
                    disabled={loading}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-bold text-sm"
                  >
                    Buy ({perk.duration_minutes}m)
                  </button>
                </div>
              ))}
              {perks.length === 0 && <div className="col-span-2 text-center text-gray-500">No perks available</div>}
            </div>
          )}

          {activeTab === 'insurance' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {insuranceOptions.map((opt) => (
                <div key={opt.id} className="bg-gray-800 p-4 rounded-lg border border-blue-500/30 flex flex-col">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-2xl">{opt.icon || '🛡️'}</div>
                    <div>
                      <div className="font-bold">{opt.name}</div>
                      <div className="text-xs text-yellow-400">{opt.cost} Coins</div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 mb-3 flex-1">{opt.description}</p>
                  <button
                    onClick={() => handleItemPurchase(opt, 'insurance')}
                    disabled={loading}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold text-sm"
                  >
                    Buy ({opt.duration_hours}h)
                  </button>
                </div>
              ))}
              {insuranceOptions.length === 0 && <div className="col-span-2 text-center text-gray-500">No insurance available</div>}
            </div>
          )}

          {activeTab === 'effects' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(ENTRANCE_EFFECTS_CONFIG).map(([id, effect]) => {
                  const isOwned = ownedEffects.has(id);
                  return (
                    <div key={id} className="bg-gray-800 p-4 rounded-lg border border-pink-500/30 flex flex-col">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="text-2xl">✨</div>
                        <div>
                          <div className="font-bold">{effect.name}</div>
                          <div className="text-xs text-yellow-400">{effect.cost} Coins</div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mb-3 flex-1">{effect.description}</p>
                      <button
                        onClick={() => !isOwned && handleItemPurchase({ ...effect, id }, 'effect')}
                        disabled={loading || isOwned}
                        className={`w-full py-2 rounded font-bold text-sm ${
                          isOwned 
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-pink-600 hover:bg-pink-500 text-white'
                        }`}
                      >
                        {isOwned ? 'Owned' : 'Buy Now'}
                      </button>
                    </div>
                  );
                })}
              </div>
              
              <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-lg">
                <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                  <Shield size={16} />
                  IMPORTANT NOTICE
                </h3>
                <ul className="text-xs text-red-300 space-y-1 list-disc pl-4">
                  <li>No refunds on digital items. Sold as is.</li>
                  <li>Any chargeback or dispute will result in an <strong>INSTANT IP BAN</strong>.</li>
                  <li>Officers monitor all transactions. New accounts evading bans will be IP banned immediately.</li>
                  <li>Entrance effects are permanent purchases attached to your account.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'loan' && (
            <div className="space-y-6">
              <div className="bg-gray-800 p-6 rounded-lg border border-green-500/30">
                <h3 className="text-xl font-bold text-green-400 mb-4 flex items-center gap-2">
                  <Banknote /> Troll Bank Loan
                </h3>
                <p className="text-gray-300 mb-4">
                  Need coins now? Apply for a loan from the Troll Bank. 
                  Repayment is automatic (50% of future paid coin credits).
                </p>
                
                {eligibility.canApply ? (
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-bold text-gray-400">Requested Amount</label>
                      <span className="text-xs text-green-400 font-bold">Max: {eligibility.maxAmount}</span>
                    </div>
                    <input
                      type="number"
                      min="100"
                      max={eligibility.maxAmount}
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(Number(e.target.value))}
                      className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-white focus:border-green-500 focus:outline-none"
                    />
                    <div className="flex justify-between mt-1">
                      <p className="text-xs text-gray-500">Min: 100 coins</p>
                      {eligibility.nextTier && (
                        <p className="text-xs text-blue-400">
                          Next limit ({eligibility.nextTier.max_loan_coins}) in {eligibility.nextTier.min_tenure_days} days tenure
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-lg mb-6">
                    <h4 className="text-red-400 font-bold mb-2 text-sm">Not Eligible</h4>
                    <ul className="text-xs text-red-300 space-y-1 list-disc pl-4">
                      {eligibility.reasons.map((reason, i) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={async () => {
                    setLoanProcessing(true);
                    try {
                      const { success } = await applyForLoan(loanAmount);
                      if (success) {
                        // toast handled by hook
                        refreshProfile();
                        setActiveTab('coins'); // Switch back to coins or stay?
                      }
                    } catch (e: any) {
                      console.error('Loan error:', e);
                      toast.error('Failed to apply for loan');
                    } finally {
                      setLoanProcessing(false);
                    }
                  }}
                  disabled={loanProcessing || !eligibility.canApply || bankLoading}
                  className="w-full py-3 bg-green-600 hover:bg-green-500 rounded font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loanProcessing ? 'Processing...' : (bankLoading ? 'Checking Bank...' : 'Apply for Loan')}
                </button>
              </div>
              
              <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
                <h4 className="text-blue-400 font-bold mb-2 text-sm">Loan Tiers (Based on Account Age)</h4>
                <ul className="text-xs text-blue-300 space-y-1 list-disc pl-4">
                  {tiers.map((tier) => (
                    <li key={tier.id}>
                      {tier.tier_name}: {tier.max_loan_coins} coins ({'>'}{tier.min_tenure_days} days)
                    </li>
                  ))}
                  {tiers.length === 0 && <li>Loading tiers...</li>}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer for Coins Tab */}
        {activeTab === 'coins' && (
          <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
            <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg text-center">
              <h3 className="text-blue-400 font-bold mb-2">Short on Cash?</h3>
              <p className="text-sm text-blue-300 mb-4">
                You can apply for a Troll Bank Loan and pay it back automatically as you earn coins!
              </p>
              <button
                onClick={() => setActiveTab('loan')}
                className="w-full py-3 bg-green-600 hover:bg-green-500 rounded font-bold text-white transition-colors flex items-center justify-center gap-2"
              >
                <Banknote size={20} />
                Go to Troll Bank Loans
              </button>
            </div>
          </div>
        )}

        {/* Modals */}
        {cashAppModalOpen && selectedPackage && (
          <CashAppPaymentModal
            isOpen={cashAppModalOpen}
            onClose={() => setCashAppModalOpen(false)}
            packageId={selectedPackage.id.toString()}
            coins={selectedPackage.coins}
            amount={parseFloat(selectedPackage.price.replace('$', ''))}
            itemName={selectedPackage.coins === 0 ? "Troll Pass Premium" : `${selectedPackage.coins.toLocaleString()} Coins`}
            purchaseType={selectedPackage.id === 999 ? 'troll_pass' : 'coin_package'}
            onSuccess={() => {
              setCashAppModalOpen(false);
              // Notification is handled by modal
            }}
          />
        )}
      </div>
    </div>
  );
}
