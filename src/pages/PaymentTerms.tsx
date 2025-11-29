import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard } from 'lucide-react';

export default function PaymentTerms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-[#1A1A1A] border border-[#2C2C2C] hover:bg-[#2A2A2A] transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <CreditCard className="w-8 h-8 text-troll-neon-blue" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text text-transparent">
            Payment Terms
          </h1>
        </div>

        {/* Content */}
        <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">1. Coin Purchases</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              All coin purchases are processed through secure third-party payment processors.
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
              <li>Purchases are final and non-refundable</li>
              <li>Coins have no real-world value</li>
              <li>Coins are entertainment purchases, not financial instruments</li>
              <li>Coins have no gambling value and cannot be redeemed for cash except as specified in creator earnings</li>
              <li>Price changes may occur without notice</li>
              <li>Failed payments may result in temporary account holds</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">2. Payment Methods</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              We accept various payment methods through our partners.
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
              <li>Credit/Debit Cards</li>
              <li>Digital Wallets (PayPal, Apple Pay, Google Pay)</li>
              <li>Bank transfers where available</li>
              <li>Cryptocurrency (future feature)</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">3. Chargebacks</h2>
            <p className="text-gray-300 leading-relaxed">
              Chargebacks are strictly prohibited and will result in immediate permanent account suspension.
              All disputes must be resolved through our support system before any payment disputes.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">4. Currency & Fees</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              All transactions are processed in USD unless otherwise specified.
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
              <li>Platform fees are clearly displayed before purchase</li>
              <li>Payment processor fees may apply</li>
              <li>Currency conversion fees may apply for international payments</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">5. Gambling Laws Compliance</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              Troll City coins are strictly for entertainment purposes only.
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
              <li>Coins have no gambling value and cannot be used for gambling activities</li>
              <li>Coins are entertainment purchases, not financial instruments</li>
              <li>No sweepstakes, lotteries, or gambling promotions are offered</li>
              <li>All games and features are for entertainment only</li>
              <li>Violation of gambling laws may result in account termination</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">6. Failed Payments</h2>
            <p className="text-gray-300 leading-relaxed">
              Failed payment attempts may result in temporary service restrictions.
              Contact support if you experience payment issues.
            </p>
          </div>

          <div className="pt-6 border-t border-[#2C2C2C]">
            <p className="text-gray-400 text-sm">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}