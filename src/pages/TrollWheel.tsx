import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../lib/store'
import { useNavigate } from 'react-router-dom'
import { Coins, Gift, Crown, Zap, ArrowLeft } from 'lucide-react'
import WheelModal from './WheelModal'
import { useCoins } from '../lib/hooks/useCoins'

export default function TrollWheelPage() {
  const { user } = useAuthStore()
  const { balances, loading: loadingBalance } = useCoins()
  const navigate = useNavigate()
  const [showWheel, setShowWheel] = useState(false)

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-4xl mx-auto bg-zinc-900 border border-gray-700 rounded-xl p-8 text-center">
          <p className="mb-4">Please log in to access the Troll Wheel</p>
          <button
            onClick={() => navigate('/auth')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
          >
            Log In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header with back button */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <span className="text-purple-400">dYZн</span>
            TROLL WHEEL
            <span className="text-purple-400">dYZн</span>
          </h1>
        </div>

        {/* Main content */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-8 border border-purple-500/30 shadow-lg">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Left side - Wheel info */}
            <div className="space-y-6">
              <div className="bg-zinc-900 rounded-lg p-6 border border-purple-500/20">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Zap className="text-yellow-400" />
                  How It Works
                </h2>
                <ul className="space-y-3 text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-1">Г?Ы</span>
                    <span>Spin the wheel for a chance to win Trollmonds!</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-1">Г?Ы</span>
                    <span>Cost: <span className="text-yellow-400 font-bold">500 Trollmonds</span> per spin</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-1">Г?Ы</span>
                    <span>Win prizes credited to your <span className="text-green-400 font-bold">Trollmond balance</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-1">Г?Ы</span>
                    <span>Chance to win up to <span className="text-yellow-400 font-bold">5,000 Trollmonds</span>!</span>
                  </li>
                </ul>
              </div>

              <div className="bg-zinc-900 rounded-lg p-6 border border-purple-500/20">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Crown className="text-yellow-400" />
                  Prizes
                </h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-sm font-bold">100</span>
                      <span className="text-gray-300">Trollmonds</span>
                    </div>
                    <span className="text-green-400 font-semibold">Common</span>
                  </div>
                  <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">250</span>
                      <span className="text-gray-300">Trollmonds</span>
                    </div>
                    <span className="text-green-400 font-semibold">Common</span>
                  </div>
                  <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-sm font-bold">500</span>
                      <span className="text-gray-300">Trollmonds</span>
                    </div>
                    <span className="text-yellow-400 font-semibold">Uncommon</span>
                  </div>
                  <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-pink-600 rounded-full flex items-center justify-center text-sm font-bold">750</span>
                      <span className="text-gray-300">Trollmonds</span>
                    </div>
                    <span className="text-yellow-400 font-semibold">Uncommon</span>
                  </div>
                  <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-sm font-bold">1000</span>
                      <span className="text-gray-300">Trollmonds</span>
                    </div>
                    <span className="text-orange-400 font-semibold">Rare</span>
                  </div>
                  <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-yellow-500/30">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center text-sm font-bold">5000</span>
                      <span className="text-gray-300 font-semibold">JACKPOT!</span>
                    </div>
                    <span className="text-yellow-400 font-semibold">dYOY Legendary</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side - Spin button and current balance */}
            <div className="space-y-6">
              <div className="bg-zinc-900 rounded-lg p-6 border border-green-500/30 text-center">
                <h2 className="text-xl font-bold mb-4 flex items-center justify-center gap-2">
                  <Coins className="text-green-400" />
                  Your Balance
                </h2>
                <div className="space-y-4">
                  <div className="bg-black/20 p-4 rounded-lg">
                    <p className="text-sm text-gray-400 mb-1">Trollmonds Available</p>
                    <p className="text-2xl font-bold text-yellow-400">
                      {loadingBalance ? '—' : (balances.troll_coins ?? 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowWheel(true)}
                  disabled={loadingBalance || (balances.troll_coins || 0) < 500}
                  className="w-full mt-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                >
                  {((balances.troll_coins || 0) >= 500) ? (
                    <>
                      <span className="mr-2">dYZн</span>
                      SPIN THE WHEEL - 500 TROLLMONDS
                    </>
                  ) : (
                    <>
                      <span className="mr-2">LOCKED</span>
                      NEED 500 TROLLMONDS
                    </>
                  )}
                </button>

                {((balances.troll_coins || 0) < 500) && (
                  <p className="text-sm text-gray-400 mt-3">
                    Get more Trollmonds from <button
                      onClick={() => navigate('/go-live')}
                      className="text-purple-400 hover:text-purple-300 font-semibold"
                    >Streaming</button> or <button
                      onClick={() => navigate('/store')}
                      className="text-purple-400 hover:text-purple-300 font-semibold"
                    >Coin Store</button>
                  </p>
                )}
              </div>

              <div className="bg-zinc-900 rounded-lg p-6 border border-purple-500/20">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Gift className="text-purple-400" />
                  Recent Wins
                </h2>
                <div className="space-y-3 text-gray-300">
                  <p className="text-sm">Your recent wheel spins will appear here...</p>
                  <p className="text-xs text-gray-500">Spin the wheel to see your prizes!</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rules and Info */}
        <div className="mt-8 bg-zinc-900 rounded-xl p-6 border border-purple-500/20">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-purple-400">Г,1Л,?</span>
            Rules & Information
          </h2>
          <ul className="space-y-3 text-gray-300 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-1">Г?Ы</span>
              <span>Only <span className="text-yellow-400 font-semibold">Trollmonds</span> can be used to spin the wheel</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-1">Г?Ы</span>
              <span>All prizes are awarded as <span className="text-green-400 font-semibold">Trollmonds</span></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-1">Г?Ы</span>
              <span>Jackpot triggers special confetti and sound effects!</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-1">Г?Ы</span>
              <span>Wheel activity is logged and can be viewed in your transaction history</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-1">Г?Ы</span>
              <span>Maximum 10 spins per day to keep it fair for everyone</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Wheel Modal */}
      {showWheel && (
        <WheelModal
          onClose={() => setShowWheel(false)}
          trollmonds={trollmonds}
          setTrollmonds={setTrollmonds}
        />
      )}
    </div>
  )
}
