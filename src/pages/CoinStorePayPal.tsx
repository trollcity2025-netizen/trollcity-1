import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'
import { supabase, CoinPackage } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { createPayPalOrder, capturePayPalOrder, getPayPalConfig, testPayPalConnection, logPayPalAction } from '../lib/paypalUtils'
import TrollerInsurance from './TrollerInsurance'

// App version for cache busting
const APP_VERSION = '1.0.0-' + Date.now().toString();

export default function CoinStore() {
  const { user, profile, refreshProfile } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [packages, setPackages] = useState<CoinPackage[]>([])
  const [promoCode, setPromoCode] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null)
  const [promoError, setPromoError] = useState('')
  const [processingPackage, setProcessingPackage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'coins' | 'calls'>('coins')
  const [paypalConfig, setPaypalConfig] = useState<any>(null)
  const [connectionTest, setConnectionTest] = useState<{ tested: boolean; success: boolean; error?: string }>({ tested: false, success: false })

  // Load coin packages from database
  useEffect(() => {
    const loadPackages = async () => {
      try {
        const { data, error } = await supabase
          .from('coin_packages')
          .select('*')
          .eq('is_active', true)
          .order('price', { ascending: true })
        
        if (error) {
          console.error('Error loading packages:', error)
          // Fallback to default packages if database fails
          setPackages([
            {
              id: 'baby_troll',
              name: 'Baby Troll',
              coin_amount: 500,
              price: 6.49,
              currency: 'USD',
              description: 'Perfect for getting started',
              is_active: true,
              created_at: new Date().toISOString()
            },
            {
              id: 'little_troll',
              name: 'Little Troll',
              coin_amount: 1100,
              price: 12.99,
              currency: 'USD',
              description: 'Great value for casual users',
              is_active: true,
              created_at: new Date().toISOString()
            },
            {
              id: 'mischief_troll',
              name: 'Mischief Troll',
              coin_amount: 2500,
              price: 24.99,
              currency: 'USD',
              description: 'Popular choice for active users',
              is_active: true,
              created_at: new Date().toISOString()
            },
            {
              id: 'family_troll',
              name: 'Family Troll',
              coin_amount: 5500,
              price: 49.99,
              currency: 'USD',
              description: 'Best value for regular streamers',
              is_active: true,
              created_at: new Date().toISOString()
            },
            {
              id: 'empire_troll',
              name: 'Empire Troll',
              coin_amount: 12000,
              price: 99.99,
              currency: 'USD',
              description: 'For the ultimate Troll City experience',
              is_active: true,
              created_at: new Date().toISOString()
            },
            {
              id: 'king_troll',
              name: 'King Troll',
              coin_amount: 25000,
              price: 199.99,
              currency: 'USD',
              description: 'The ultimate package for power users',
              is_active: true,
              created_at: new Date().toISOString()
            }
          ])
        } else {
          setPackages(data || [])
        }
      } catch (error) {
        console.error('Error loading packages:', error)
        toast.error('Failed to load coin packages')
      }
    }
    
    loadPackages()
  }, [])

  // Initialize PayPal configuration and test connection
  useEffect(() => {
    try {
      const config = getPayPalConfig()
      setPaypalConfig(config)
      
      // Test PayPal connection in background
      testPayPalConnection().then(result => {
        setConnectionTest({
          tested: true,
          success: result.success,
          error: result.error
        })
        
        if (!result.success) {
          console.warn('PayPal connection test failed:', result.error)
        }
      })
    } catch (error: any) {
      console.error('PayPal configuration error:', error)
      setConnectionTest({
        tested: true,
        success: false,
        error: error.message
      })
    }
  }, [])

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

  // Show connection test results
  const showConnectionStatus = connectionTest.tested && (
    <div className={`p-3 rounded-lg border text-sm mb-4 ${
      connectionTest.success
        ? 'bg-green-900/20 border-green-600/40 text-green-300'
        : 'bg-red-900/20 border-red-600/40 text-red-300'
    }`}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          connectionTest.success ? 'bg-green-400' : 'bg-red-400'
        }`}></div>
        <span>
          PayPal {connectionTest.success ? 'Connected' : 'Connection Failed'}
          {paypalConfig && ` (${paypalConfig.environment})`}
        </span>
        {!connectionTest.success && connectionTest.error && (
          <span className="text-xs opacity-70">- {connectionTest.error}</span>
        )}
      </div>
    </div>
  )

  return (
    <PayPalScriptProvider key={APP_VERSION} options={paypalOptions}>
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold">Troll City Coin Store</h1>
            {connectionTest.tested && (
              <div className="text-sm text-gray-400">
                Environment: <span className="text-purple-400">{paypalConfig?.environment || 'unknown'}</span>
              </div>
            )}
          </div>

          {/* Connection Status */}
          {showConnectionStatus}

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
                            const res = await fetch('/api/paypal/create-order', {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                amount: finalPrice,
                                coins: pkg.coin_amount,
                                user_id: user.id,
                              }),
                            });
                            const data = await res.json();
                            console.log("Create Order Response", data);

                            if (!data?.id) {
                              console.error("FATAL: create-order did not return a valid PayPal order ID");
                              throw new Error("PayPal did not return a valid order ID. Cannot proceed with payment.");
                            }

                            // Validate PayPal order ID format
                            if (typeof data.id !== 'string' || data.id.length < 10 || data.id.length > 25) {
                              console.error("FATAL: Invalid PayPal order ID format:", data.id);
                              throw new Error("Invalid PayPal order ID received. Cannot proceed with payment.");
                            }

                            console.log("✅ Valid PayPal Order ID returned from create-order:", data.id);
                            return data.id;
                          } catch (err) {
                            console.error("createOrder error", err);
                            toast.error("Unable to create PayPal order.");
                            setProcessingPackage(null);
                            throw err;
                          }
                        }}
                        onApprove={async (data, actions) => {
                          try {
                            console.log("Order ID sent to capture-order:", data.orderID);
                            const res = await fetch('/api/paypal/complete-order', {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                orderID: data.orderID,
                                user_id: user.id,
                              }),
                            });
                            const json = await res.json();
                            console.log("Capture Order Response", json);
                            if (!json.success) {
                              toast.error(json.message || "Payment capture failed");
                              return;
                            }
                            toast.success(`Added ${json.coins_awarded} coins!`);
                            await refreshProfile();
                          } catch (err) {
                            console.error("onApprove error", err);
                            toast.error("Payment processing error");
                          } finally {
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
