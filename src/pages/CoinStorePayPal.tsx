import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'
import { supabase, CoinPackage } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import TrollerInsurance from './TrollerInsurance'

const DEFAULT_PACKAGES: CoinPackage[] = [
  {
    id: 'baby_troll',
    name: 'Baby Troll',
    coin_amount: 500,
    price: 6.49,
    currency: 'USD',
    description: 'Starter pack',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'little_troller',
    name: 'Little Troller',
    coin_amount: 1440,
    price: 12.99,
    currency: 'USD',
    description: 'Small bundle',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'troll_warrior',
    name: 'Troll Warrior',
    coin_amount: 3000,
    price: 24.99,
    currency: 'USD',
    description: 'Medium bundle',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'troll_empire',
    name: 'Troll Empire',
    coin_amount: 7000,
    price: 49.99,
    currency: 'USD',
    description: 'Large bundle',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'troll_royalty',
    name: 'Troll Royalty VIP',
    coin_amount: 15700,
    price: 99.99,
    currency: 'USD',
    description: 'Mega bundle',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'big_troller',
    name: 'Big Troller',
    coin_amount: 60000,
    price: 299.99,
    currency: 'USD',
    description: 'Ultra bundle',
    is_active: true,
    created_at: new Date().toISOString()
  }
]

export default function CoinStore() {
  // Hardcoded Supabase function URL for PayPal
  const functionUrl = 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1';
  
  console.log("FUNCTION_URL:", functionUrl);

  const { user, profile, refreshProfile } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [packages] = useState<CoinPackage[]>(DEFAULT_PACKAGES)
  const [promoCode, setPromoCode] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null)
  const [promoError, setPromoError] = useState('')
  const [processingPackage, setProcessingPackage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'coins' | 'calls'>('coins')

  useEffect(() => {
    const state = location.state as { requiredCoins?: number; message?: string } | null
    if (state?.requiredCoins || state?.message) {
      toast.error(
        state.message ||
        `You need ${state.requiredCoins?.toLocaleString()} coins to continue. Please purchase coins.`
      )
    }
  }, [location.state])

  const applyPromoCode = async () => {
    if (!promoCode.trim()) {
      setPromoError('Enter a promo code')
      return
    }

    try {
      const { data, error } = await supabase.rpc('validate_promo_code', {
        p_code: promoCode.trim().toUpperCase()
      })

      if (error) {
        setPromoError('Promo system temporarily unavailable')
        toast.error('Promo system temporarily unavailable')
        return
      }

      if (!data || !data.valid) {
        setPromoError(data?.message || 'Invalid promo code')
        return
      }

      setAppliedPromo({
        code: promoCode.trim().toUpperCase(),
        discount: data.discount_percent || 0,
      })
      toast.success(`Promo code "${promoCode.trim().toUpperCase()}" applied!`)
      setPromoError('')
    } catch (error: any) {
      console.error(error)
      setPromoError('Failed to apply promo')
    }
  }

  const getFinalPrice = useCallback((basePrice: number): number => {
    if (!appliedPromo) return basePrice
    if (appliedPromo.discount === 100) return 0
    const discount = (basePrice * appliedPromo.discount) / 100
    return Math.max(0, basePrice - discount)
  }, [appliedPromo])


  const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID

  const paypalOptions = useMemo(
    () => ({
      clientId: paypalClientId,
      intent: 'capture' as const,
      currency: 'USD',
      components: 'buttons' as const,
      'data-color': 'black' as const,
      'data-branding': true,
      'disable-funding': 'paylater,venmo' as const
    }),
    [paypalClientId]
  )


  if (!paypalClientId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400">
        Missing PayPal Client ID
      </div>
    )
  }

  return (
    <PayPalScriptProvider options={paypalOptions}>
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Troll City Coin Store</h1>

          <p className="text-gray-400 mb-6">
            Current Balance:{' '}
            <span className="font-bold text-purple-400">
              {(profile?.paid_coin_balance || 0).toLocaleString()} paid coins
            </span>
          </p>

          {/* Promo Code */}
          <div className="bg-black/60 border border-purple-600/30 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="Enter promo code"
                className="flex-1 px-4 py-2 bg-zinc-800 rounded-lg"
              />
              <button
                onClick={applyPromoCode}
                className="px-6 py-2 bg-purple-600 rounded-lg"
              >
                Apply
              </button>
            </div>
            {promoError && <p className="text-red-400 text-sm mt-2">{promoError}</p>}
            {appliedPromo && (
              <p className="text-green-400 text-sm mt-2">
                ✓ Promo "{appliedPromo.code}" applied ({appliedPromo.discount}% off)
              </p>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-6 border-b border-purple-600/30">
            <button
              onClick={() => setActiveTab('coins')}
              className={`px-6 py-3 font-semibold transition ${
                activeTab === 'coins'
                  ? 'border-b-2 border-purple-500 text-purple-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Coin Packages
            </button>
            <button
              onClick={() => setActiveTab('calls')}
              className={`px-6 py-3 font-semibold transition ${
                activeTab === 'calls'
                  ? 'border-b-2 border-purple-500 text-purple-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Call Time Packages
            </button>
          </div>

          {activeTab === 'coins' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg) => {
              const finalPrice = getFinalPrice(pkg.price)
              const isProcessing = processingPackage === pkg.id

              return (
                <div
                  key={pkg.id}
                  className="bg-black/60 border border-purple-600/30 rounded-xl p-6"
                >
                  <h3 className="text-2xl font-bold mb-2">{pkg.name}</h3>
                  <p className="text-3xl font-bold text-purple-400 mb-1">
                    {pkg.coin_amount.toLocaleString()} coins
                  </p>

                  <div className="mb-4">
                    {appliedPromo ? (
                      <>
                        <p className="text-gray-400 line-through text-sm">
                          ${pkg.price.toFixed(2)}
                        </p>
                        <p className="text-xl text-green-400 font-bold">
                          ${finalPrice.toFixed(2)}
                        </p>
                      </>
                    ) : (
                      <p className="text-xl font-bold">${pkg.price.toFixed(2)}</p>
                    )}
                  </div>

                  {isProcessing ? (
                    <div className="text-center py-4">
                      <div className="animate-spin h-8 w-8 border-2 border-purple-500 rounded-full border-b-transparent mx-auto"></div>
                      <p className="text-gray-400 text-sm mt-2">Processing...</p>
                    </div>
                  ) : (
                    <div className="rounded-lg overflow-hidden bg-[#0A0814] p-2">
                      <PayPalButtons
                        key={`paypal-${pkg.id}-${finalPrice}`}
                        style={{
                          layout: 'vertical',
                          color: 'gold',
                          shape: 'rect',
                          height: 45
                        }}
                        fundingSource="paypal"
                        createOrder={async () => {
                          setProcessingPackage(pkg.id);
                          try {
                            const res = await fetch(
                              `${functionUrl}/paypal-create-order`,
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                  amount: finalPrice
                                })
                              }
                            );

                            const data = await res.json();
                            console.log("PayPal CreateOrder Response:", data);

                            if (!data.id) throw new Error("No order ID returned");

                            return data.id;
                          } catch (err) {
                            console.error("CreateOrder Error:", err);
                            toast.error("Unable to create PayPal order");
                            setProcessingPackage(null);
                            throw err;
                          }
                        }}
                        onApprove={async (data) => {
                          try {
                            const res = await fetch(
                              `${functionUrl}/paypal-complete-order`,
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                  paypal_order_id: data.orderID,
                                  user_id: user.id,
                                }),
                              }
                            );

                            const json = await res.json();
                            console.log("PayPal Capture Response:", json);

                            if (!json.success) {
                              toast.error("Payment was not completed");
                              return;
                            }

                            toast.success(`Purchased ${json.coins_awarded} coins!`);
                            await refreshProfile();
                            setProcessingPackage(null);
                          } catch (err) {
                            console.error("onApprove Error:", err);
                            toast.error("Payment processing error");
                            setProcessingPackage(null);
                          }
                        }}
                        onError={(err) => {
                          console.error("PayPal Error:", err);
                          toast.error("PayPal checkout error");
                          setProcessingPackage(null);
                        }}
                        onCancel={() => {
                          toast.info("Payment cancelled");
                          setProcessingPackage(null);
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          )}

          {activeTab === 'calls' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Audio Call Packages */}
              <div className="col-span-full">
                <h3 className="text-xl font-bold text-purple-400 mb-4">Audio Call Packages</h3>
              </div>
              {[
                { id: 'audio_60', name: 'Base Audio', minutes: 60, price: 5, type: 'audio' },
                { id: 'audio_150', name: 'Standard Audio', minutes: 150, price: 10, type: 'audio' },
                { id: 'audio_400', name: 'Premium Audio', minutes: 400, price: 25, type: 'audio' },
                { id: 'audio_1000', name: 'Ultra Audio', minutes: 1000, price: 50, type: 'audio' },
              ].map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-black/60 border border-purple-600/30 rounded-xl p-6"
                >
                  <h3 className="text-2xl font-bold mb-2">{pkg.name}</h3>
                  <p className="text-3xl font-bold text-purple-400 mb-1">
                    {pkg.minutes.toLocaleString()} minutes
                  </p>
                  <p className="text-xl font-bold mb-4">${pkg.price.toFixed(2)}</p>
                  <button
                    onClick={async () => {
                      if (!user?.id) {
                        toast.error('Please log in to purchase');
                        return;
                      }
                      setProcessingPackage(pkg.id);
                      try {
                        const { data, error } = await supabase.rpc('add_call_minutes', {
                          p_user_id: user.id,
                          p_minutes: pkg.minutes,
                          p_type: pkg.type
                        });
                        if (error) throw error;
                        
                        // Add transaction record
                        await supabase.from('coin_transactions').insert({
                          user_id: user.id,
                          type: 'call_minutes',
                          amount: 0,
                          description: `Purchased ${pkg.minutes} ${pkg.type} call minutes for $${pkg.price}`,
                          metadata: { package_id: pkg.id, minutes: pkg.minutes, call_type: pkg.type }
                        });
                        
                        toast.success(`Added ${pkg.minutes} ${pkg.type} minutes!`);
                        if (refreshProfile) await refreshProfile();
                      } catch (err: any) {
                        console.error('Purchase error:', err);
                        toast.error(err.message || 'Failed to purchase minutes');
                      } finally {
                        setProcessingPackage(null);
                      }
                    }}
                    disabled={processingPackage === pkg.id || !user}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-cyan-500 text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {processingPackage === pkg.id ? 'Processing...' : 'Purchase'}
                  </button>
                </div>
              ))}

              {/* Video Call Packages */}
              <div className="col-span-full mt-8">
                <h3 className="text-xl font-bold text-purple-400 mb-4">Video Call Packages</h3>
                <p className="text-sm text-gray-400 mb-4">Video calls use minutes 2× faster</p>
              </div>
              {[
                { id: 'video_30', name: 'Base Video', minutes: 30, price: 5, type: 'video' },
                { id: 'video_75', name: 'Standard Video', minutes: 75, price: 10, type: 'video' },
                { id: 'video_200', name: 'Premium Video', minutes: 200, price: 25, type: 'video' },
                { id: 'video_500', name: 'Ultra Video', minutes: 500, price: 50, type: 'video' },
              ].map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-black/60 border border-purple-600/30 rounded-xl p-6"
                >
                  <h3 className="text-2xl font-bold mb-2">{pkg.name}</h3>
                  <p className="text-3xl font-bold text-purple-400 mb-1">
                    {pkg.minutes.toLocaleString()} minutes
                  </p>
                  <p className="text-xl font-bold mb-4">${pkg.price.toFixed(2)}</p>
                  <button
                    onClick={async () => {
                      if (!user?.id) {
                        toast.error('Please log in to purchase');
                        return;
                      }
                      setProcessingPackage(pkg.id);
                      try {
                        const { data, error } = await supabase.rpc('add_call_minutes', {
                          p_user_id: user.id,
                          p_minutes: pkg.minutes,
                          p_type: pkg.type
                        });
                        if (error) throw error;
                        
                        // Add transaction record
                        await supabase.from('coin_transactions').insert({
                          user_id: user.id,
                          type: 'call_minutes',
                          amount: 0,
                          description: `Purchased ${pkg.minutes} ${pkg.type} call minutes for $${pkg.price}`,
                          metadata: { package_id: pkg.id, minutes: pkg.minutes, call_type: pkg.type }
                        });
                        
                        toast.success(`Added ${pkg.minutes} ${pkg.type} minutes!`);
                        if (refreshProfile) await refreshProfile();
                      } catch (err: any) {
                        console.error('Purchase error:', err);
                        toast.error(err.message || 'Failed to purchase minutes');
                      } finally {
                        setProcessingPackage(null);
                      }
                    }}
                    disabled={processingPackage === pkg.id || !user}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-cyan-500 text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {processingPackage === pkg.id ? 'Processing...' : 'Purchase'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 bg-black/60 border border-purple-600/30 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4">Secure Payments</h2>
            <p className="text-gray-400 text-sm">
              All purchases are processed securely through PayPal.
            </p>
          </div>
        </div>
      </div>
    </PayPalScriptProvider>
  )
}
