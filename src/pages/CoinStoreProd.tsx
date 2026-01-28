// src/pages/CoinStoreProd.tsx
// Production-ready PayPal coin purchase component with centralized fulfillment

import React, { useState } from 'react'
import { useAuthStore } from '../lib/store'
import { AlertCircle, Coins, Wallet } from 'lucide-react'
import { paymentProviders } from '../lib/payments'
import { toast } from 'sonner'

const coinPackages = [
  { id: 'pkg-1000-promo', coins: 1000, price: 0.10, label: '1,000 Coins', popular: true, promo: true },
  { id: 'pkg-500', coins: 500, price: 4.99, label: '500 Coins' },
  { id: 'pkg-1000', coins: 1000, price: 9.99, label: '1,000 Coins' },
  { id: 'pkg-2500', coins: 2500, price: 19.99, label: '2,500 Coins', bestValue: true },
  { id: 'pkg-5000', coins: 5000, price: 36.99, label: '5,000 Coins' },
  { id: 'pkg-10000', coins: 10000, price: 69.99, label: '10,000 Coins' },
]

export default function CoinStoreProd() {
  const { user, profile, _refreshProfile } = useAuthStore()
  const [selectedProviderId, setSelectedProviderId] = useState(paymentProviders[0]?.id || 'paypal')
  const [selectedPackage, setSelectedPackage] = useState(coinPackages[0])
  const [loading, setLoading] = useState(false)

  const provider = paymentProviders.find(p => p.id === selectedProviderId)

  async function handleBuy() {
    if (!user) return toast.error('Please sign in')
    if (!provider) return toast.error('No payment provider selected')
    setLoading(true)
    try {
      const paymentSession = await provider.createPayment({
        userId: user.id,
        amount: selectedPackage.price,
        currency: 'USD',
        productType: 'coins',
        packageId: selectedPackage.id,
        metadata: { coins: selectedPackage.coins }
      })
      if (provider.id === 'paypal' && paymentSession.approvalUrl) {
        window.location.href = paymentSession.approvalUrl
      } else if (provider.id === 'cashapp') {
        toast.info('CashApp Pay integration coming soon')
      } else {
        toast.error('Unknown provider or missing approval URL')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to start payment')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
          <p>Please sign in to access the Coin Store</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Coins className="w-8 h-8 text-purple-500" />
            Troll Bank Coin Store
          </h1>
          <p className="text-gray-400">
            Current balance: <span className="text-purple-400 font-semibold">{(profile?.troll_coins || 0).toLocaleString()}</span> coins
          </p>
        </div>

        {/* Payment Provider Selector */}
        <div className="mb-8 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex gap-2">
            {paymentProviders.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProviderId(p.id)}
                className={`group relative px-5 py-2.5 rounded-full font-semibold flex items-center gap-2 border transition-all duration-200 ${
                  selectedProviderId === p.id
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-transparent shadow-lg shadow-purple-500/40 scale-105'
                    : 'bg-[#11111b] text-gray-300 border-[#2C2C2C] hover:border-purple-500/70 hover:bg-[#181825] hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                {p.logoUrl && <img src={p.logoUrl} alt={p.displayName} className="h-5 w-5" />}
                {p.displayName}
              </button>
            ))}
          </div>
        </div>

        {/* Coin Packages */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold mb-4 text-purple-300">Select Coin Package</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {coinPackages.map(pkg => (
              <button
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg)}
                className={`group relative p-6 rounded-2xl border flex flex-col items-center gap-3 transition-all duration-200 font-semibold ${
                  selectedPackage.id === pkg.id
                    ? 'bg-gradient-to-b from-purple-700/90 via-purple-600/80 to-indigo-700/80 border-purple-400/80 text-white shadow-xl shadow-purple-500/40 scale-105'
                    : 'bg-[#11111b]/90 border-[#2C2C2C] text-gray-200 hover:border-purple-500/60 hover:bg-[#181825] hover:shadow-lg hover:-translate-y-1'
                }`}
              >
                <span className="text-3xl">💰</span>
                <span className="text-lg font-bold text-white">{pkg.label}</span>
                <span className="text-yellow-400 font-extrabold text-2xl">${pkg.price.toFixed(2)}</span>
                {pkg.promo && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold mt-1 animate-pulse">HOT DEAL</span>}
                {pkg.popular && !pkg.promo && <span className="text-xs bg-yellow-400 text-black px-2 py-0.5 rounded-full font-bold mt-1">Popular</span>}
                {pkg.bestValue && <span className="text-xs bg-green-400 text-black px-2 py-0.5 rounded-full font-bold mt-1">Best Value</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Buy Button */}
        <div className="mb-12 flex justify-center">
          <button
            onClick={handleBuy}
            disabled={loading}
            className="px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold text-lg shadow-lg transition-all flex items-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : `Buy with ${provider?.displayName}`}
          </button>
        </div>

        {/* Troll Bank Loan Promo */}
        <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-xl p-8 text-center mb-12">
          <Wallet className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Need more coins?</h2>
          <p className="text-gray-300 mb-6 max-w-lg mx-auto">
            Apply for a Troll Bank Loan instantly! No external payments required.
            Repay automatically as you earn.
          </p>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-coin-store'))}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full transition-colors"
          >
            Open Troll Bank
          </button>
        </div>

        {/* Security Notice */}
        <div className="mt-12 max-w-2xl mx-auto bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <p className="text-sm text-blue-200">
            ✓ Payments secured by PayPal • ✓ Coins credited server-side • ✓ Fraud protection enabled • ✓ Transaction logging
          </p>
        </div>
      </div>
    </div>
  )
}
