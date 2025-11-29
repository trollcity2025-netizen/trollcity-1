import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown } from 'lucide-react';

export default function CreatorAgreement() {
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
          <Crown className="w-8 h-8 text-troll-neon-blue" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text text-transparent">
            Creator Earning & Cashout Agreement
          </h1>
        </div>

        {/* Content */}
        <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">1. Earning Structure</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              As a content creator on Troll City, you earn from viewer gifts and platform features.
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
              <li>Gift earnings are paid directly to your account</li>
              <li>Platform takes a percentage fee on all transactions</li>
              <li>Earnings are tracked in real-time</li>
              <li>Minimum payout thresholds apply</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">2. Tax Reporting (1099)</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              If you earn $600 or more in a calendar year, you must provide tax information for 1099 reporting.
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
              <li>Full legal name and address required</li>
              <li>Social Security Number (SSN) or Employer ID (EIN)</li>
              <li>W-9 form completion mandatory</li>
              <li>Tax documents issued annually</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">3. Cashout Requirements</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              Cashouts are available once you meet minimum thresholds and complete verification.
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
              <li>Minimum 7,000 free coins for first cashout</li>
              <li>Identity verification required</li>
              <li>Payment method setup mandatory</li>
              <li>Processing fees apply to all payouts</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">4. Content Ownership</h2>
            <p className="text-gray-300 leading-relaxed">
              By streaming on Troll City, you grant us rights to use your content for promotional purposes.
              You retain ownership of your original content while allowing platform usage for marketing.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">5. Account Responsibility</h2>
            <p className="text-gray-300 leading-relaxed">
              You are responsible for maintaining accurate payout information and reporting all earnings.
              Failure to provide correct tax information may result in account suspension and legal action.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">6. Payment Methods</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              We support various payout methods with different processing times and fees.
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
              <li>PayPal (fastest, higher fees)</li>
              <li>Bank Transfer (slower, lower fees)</li>
              <li>Digital Wallets (Cash App, Venmo)</li>
            </ul>
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