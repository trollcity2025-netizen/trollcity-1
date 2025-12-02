import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Video, Gift, Users, Star, Zap } from 'lucide-react';
import { useAuthStore } from '../lib/store';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const handleEnterTrollCity = () => {
    // If user is logged in, go directly to /live
    // If not logged in, go to /auth to log in first
    if (user) {
      navigate('/live');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 via-pink-900/20 to-cyan-900/20 animate-pulse" />
        <div className="relative max-w-7xl mx-auto px-6 py-24">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <Crown className="w-20 h-20 text-yellow-400 animate-bounce" />
            </div>
            <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              Troll City
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
              The ultimate live streaming experience where trolls earn real money through chaos, gifts, and community
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                type="button"
                onClick={handleEnterTrollCity}
                className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold rounded-xl hover:scale-105 transition transform"
              >
                Enter Troll City
              </button>
              <button
                type="button"
                onClick={() => navigate('/onboarding/creator')}
                className="px-8 py-4 border-2 border-cyan-400 text-cyan-400 font-bold rounded-xl hover:bg-cyan-400 hover:text-black transition"
              >
                Become a Creator
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <h2 className="text-4xl font-bold text-center mb-16 bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
          Why Troll City?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="bg-[#1A1A1A] p-8 rounded-xl border border-purple-500/30 hover:border-purple-400 transition">
            <Video className="w-12 h-12 text-purple-400 mb-4" />
            <h3 className="text-2xl font-bold mb-4">Live Streaming</h3>
            <p className="text-gray-300">
              Go live and interact with your audience in real-time. Build your community and earn from every viewer.
            </p>
          </div>
          <div className="bg-[#1A1A1A] p-8 rounded-xl border border-pink-500/30 hover:border-pink-400 transition">
            <Gift className="w-12 h-12 text-pink-400 mb-4" />
            <h3 className="text-2xl font-bold mb-4">Gift Economy</h3>
            <p className="text-gray-300 mb-4">
              Send and receive virtual gifts. Streamers earn real money from gifts, creating a sustainable income stream.
            </p>
            <div className="text-sm text-pink-300">
              <p>• 70% of gift value goes to streamer</p>
              <p>• 20% platform fee</p>
              <p>• 10% troll officer rewards</p>
            </div>
          </div>
          <div className="bg-[#1A1A1A] p-8 rounded-xl border border-cyan-500/30 hover:border-cyan-400 transition">
            <Users className="w-12 h-12 text-cyan-400 mb-4" />
            <h3 className="text-2xl font-bold mb-4">Troll Families</h3>
            <p className="text-gray-300">
              Join or create troll families. Compete in wars, earn crowns, and build lasting communities.
            </p>
          </div>
          <div className="bg-[#1A1A1A] p-8 rounded-xl border border-yellow-500/30 hover:border-yellow-400 transition">
            <Star className="w-12 h-12 text-yellow-400 mb-4" />
            <h3 className="text-2xl font-bold mb-4">Level Up System</h3>
            <p className="text-gray-300">
              Progress through 100+ levels with unique rewards, badges, and exclusive perks.
            </p>
          </div>
          <div className="bg-[#1A1A1A] p-8 rounded-xl border border-green-500/30 hover:border-green-400 transition">
            <Zap className="w-12 h-12 text-green-400 mb-4" />
            <h3 className="text-2xl font-bold mb-4">Troll Wheel</h3>
            <p className="text-gray-300">
              Spin the wheel for coins, perks, and jackpots. Fair play with transparent odds.
            </p>
          </div>
          <div className="bg-[#1A1A1A] p-8 rounded-xl border border-red-500/30 hover:border-red-400 transition">
            <Crown className="w-12 h-12 text-red-400 mb-4" />
            <h3 className="text-2xl font-bold mb-4">Real Money</h3>
            <p className="text-gray-300">
              Cash out your earnings through multiple payment methods. Turn entertainment into income.
            </p>
          </div>
        </div>
      </div>

      {/* How Streamers Get Paid */}
      <div className="bg-[#0D0D1A] py-24">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-16 bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
            How Streamers Get Paid
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🎁</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Receive Gifts</h3>
              <p className="text-gray-300 text-sm">
                Viewers send virtual gifts during your stream
              </p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💰</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Earn Instantly</h3>
              <p className="text-gray-300 text-sm">
                70% of gift value credited to your account immediately
              </p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📊</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Track Earnings</h3>
              <p className="text-gray-300 text-sm">
                Real-time dashboard shows all your earnings and payouts
              </p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💸</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Cash Out</h3>
              <p className="text-gray-300 text-sm">
                Convert coins to cash via PayPal, bank transfer, and more
              </p>
            </div>
          </div>
          <div className="mt-12 text-center">
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-green-500/30 max-w-2xl mx-auto">
              <h3 className="text-2xl font-bold text-green-400 mb-4">Earning Example</h3>
              <p className="text-gray-300 mb-4">
                If viewers send you $100 worth of gifts in a month:
              </p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-green-400 font-bold">$70</div>
                  <div className="text-gray-400">Your Earnings</div>
                </div>
                <div>
                  <div className="text-blue-400 font-bold">$20</div>
                  <div className="text-gray-400">Platform Fee</div>
                </div>
                <div>
                  <div className="text-purple-400 font-bold">$10</div>
                  <div className="text-gray-400">Officer Rewards</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Screenshots/Mockups */}
      <div className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-16 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Experience Troll City
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-purple-500/30">
              <div className="w-full h-48 bg-gradient-to-br from-purple-900 to-black rounded-lg mb-4 flex items-center justify-center">
                <span className="text-4xl">📺</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Live Streaming</h3>
              <p className="text-gray-300 text-sm">
                High-quality live streams with interactive chat and real-time viewer engagement.
              </p>
            </div>
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-pink-500/30">
              <div className="w-full h-48 bg-gradient-to-br from-pink-900 to-black rounded-lg mb-4 flex items-center justify-center">
                <span className="text-4xl">🎁</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Gift Animations</h3>
              <p className="text-gray-300 text-sm">
                Spectacular gift animations that celebrate your supporters and boost engagement.
              </p>
            </div>
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-cyan-500/30">
              <div className="w-full h-48 bg-gradient-to-br from-cyan-900 to-black rounded-lg mb-4 flex items-center justify-center">
                <span className="text-4xl">👑</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Family Wars</h3>
              <p className="text-gray-300 text-sm">
                Join troll families and compete in epic wars for crowns and bragging rights.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How Coins Work */}
      <div className="bg-[#0D0D1A] py-24">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-16 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
            How Coins Work
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💰</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">Purchase Coins</h3>
              <p className="text-gray-300">
                Buy coins with real money through secure payment methods. Coins are used for gifts, effects, and more.
              </p>
            </div>
            <div>
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎁</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">Send Gifts</h3>
              <p className="text-gray-300">
                Support your favorite streamers with virtual gifts. Streamers earn from every gift received.
              </p>
            </div>
            <div>
              <div className="w-16 h-16 bg-gradient-to-r from-yellow-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💸</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">Cash Out</h3>
              <p className="text-gray-300">
                Convert earned coins to real money. Multiple payout options with competitive rates.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
            Ready to Join the Troll Revolution?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Start streaming, earning, and building your legacy in Troll City today.
          </p>
          <button
            type="button"
            onClick={handleEnterTrollCity}
            className="px-12 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-xl rounded-xl hover:scale-105 transition transform"
          >
            Get Started Now
          </button>
        </div>
      </div>
    </div>
  );
}