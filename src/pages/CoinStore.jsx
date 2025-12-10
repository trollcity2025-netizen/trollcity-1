import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { Coins, DollarSign, ShoppingCart, CreditCard, CheckCircle, Loader2 } from 'lucide-react';
import { coinPackages, formatCoins, formatUSD } from '../lib/coinMath';
import RequireRole from '../components/RequireRole';

export default function CoinStore() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadingPackage, setLoadingPackage] = useState(null);
  const [walletData, setWalletData] = useState(null);

  useEffect(() => {
    if (!user || !profile) {
      navigate('/auth', { replace: true });
      return;
    }

    loadWalletData();
  }, [user, profile, navigate]);

  const loadWalletData = async () => {
    try {
      setLoading(true);

      // Load user profile data with coin balances
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('paid_coin_balance, free_coin_balance, total_earned_coins')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      setWalletData({
        paidCoins: profileData.paid_coin_balance || 0,
        freeCoins: profileData.free_coin_balance || 0,
        totalCoins: (profileData.paid_coin_balance || 0) + (profileData.free_coin_balance || 0)
      });

    } catch (err) {
      console.error('Error loading wallet data:', err);
      toast.error('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (pkg) => {
    setLoadingPackage(pkg.id);
    try {
      const res = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkg.id })
      });

      const data = await res.json();

      if (!data.approvalUrl) {
        throw new Error("Missing PayPal URL");
      }

      window.location.href = data.approvalUrl;
    } catch (err) {
      console.error("Failed to start PayPal checkout:", err);
      toast.error("Unable to start checkout.");
    } finally {
      setLoadingPackage(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Coins className="w-8 h-8 text-purple-400" />
              Troll City Coin Store
            </h1>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C] animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-700 rounded w-1/3 mt-2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!walletData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-4xl mx-auto bg-zinc-900 border border-gray-700 rounded-xl p-8 text-center">
          <Coins className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Wallet Data Not Available</h2>
          <p className="text-gray-400 mb-6">Unable to load your wallet information</p>
          <button
            onClick={loadWalletData}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <RequireRole roles={['user', 'broadcaster', 'admin']} fallbackPath="/dashboard">
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Coins className="w-8 h-8 text-purple-400" />
              Troll City Coin Store
            </h1>
          </div>

          {/* Wallet Summary */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-6 border border-purple-500/30 shadow-lg">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-purple-400" />
              Your Wallet Balance
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total Coins */}
              <div className="bg-zinc-900 rounded-lg p-4 border border-purple-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-5 h-5 text-purple-400" />
                  <span className="text-sm text-gray-400">Total Coins</span>
                </div>
                <p className="text-2xl font-bold text-purple-400">
                  {formatCoins(walletData.totalCoins)}
                </p>
                <p className="text-xs text-gray-500 mt-1">paid + free combined</p>
              </div>

              {/* Paid Coins */}
              <div className="bg-zinc-900 rounded-lg p-4 border border-yellow-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm text-gray-400">Paid Coins</span>
                </div>
                <p className="text-2xl font-bold text-yellow-400">
                  {formatCoins(walletData.paidCoins)}
                </p>
                <p className="text-xs text-gray-500 mt-1">withdrawable balance</p>
              </div>

              {/* Free Coins */}
              <div className="bg-zinc-900 rounded-lg p-4 border border-green-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-gray-400">Free Coins</span>
                </div>
                <p className="text-2xl font-bold text-green-400">
                  {formatCoins(walletData.freeCoins)}
                </p>
                <p className="text-xs text-gray-500 mt-1">earned from activities</p>
              </div>
            </div>
          </div>

          {/* Coin Packages Grid */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-6 border border-purple-500/30 shadow-lg">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-purple-400" />
              Available Coin Packages
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {coinPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-zinc-900 rounded-xl p-4 border border-purple-500/20 hover:border-purple-500/40 transition-all"
                >
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-bold text-purple-300">
                        {pkg.name}
                      </span>
                      <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
                        {pkg.id}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">Package</p>
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm text-gray-400">Coins</span>
                    </div>
                    <p className="text-2xl font-bold text-yellow-400">
                      {formatCoins(pkg.coins)}
                    </p>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-gray-400">Price</span>
                    </div>
                    <p className="text-xl font-bold text-green-400">
                      {formatUSD(pkg.price)}
                    </p>
                  </div>

                  <button
                    onClick={() => handleBuy(pkg)}
                    disabled={loadingPackage === pkg.id}
                    className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loadingPackage === pkg.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Starting Checkout...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4" />
                        Buy with PayPal
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Purchase Information */}
          <div className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C]">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-purple-400" />
              How It Works
            </h2>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm">1</span>
                </div>
                <div>
                  <p className="font-semibold">Select a Package</p>
                  <p className="text-sm text-gray-400">Choose from 6 coin packages based on your needs</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm">2</span>
                </div>
                <div>
                  <p className="font-semibold">Pay with PayPal</p>
                  <p className="text-sm text-gray-400">Secure payment processing through PayPal checkout</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm">3</span>
                </div>
                <div>
                  <p className="font-semibold">Coins Added After Payment</p>
                  <p className="text-sm text-gray-400">Coins are only added after successful PayPal payment completion</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RequireRole>
  );
}