import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

import { trollCityTheme } from '../styles/trollCityTheme';

export default function RefundPolicy() {
  const navigate = useNavigate();

  return (
    <div className={`min-h-screen ${trollCityTheme.backgrounds.app} text-white`}>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className={`p-2 rounded-lg ${trollCityTheme.components.buttonSecondary}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Shield className="w-8 h-8 text-troll-neon-blue" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text text-transparent">
            Refund Policy
          </h1>
        </div>

        {/* Content */}
        <div className={`${trollCityTheme.components.card} p-8 space-y-6`}>
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">1. Virtual Currency Purchases</h2>
            <p className="text-gray-300 leading-relaxed">
              All purchases of virtual currency (coins) on Troll City are final and non-refundable.
              Coins are entertainment purchases only and have no real-world monetary value.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">2. No Chargebacks</h2>
            <p className="text-gray-300 leading-relaxed">
              Chargebacks initiated through your payment provider will result in immediate permanent ban
              of your account with complete loss of all progress, coins, and earnings.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">3. Service Interruptions</h2>
            <p className="text-gray-300 leading-relaxed">
              Troll City does not provide refunds for temporary service interruptions, maintenance,
              or account suspensions due to violations of our terms of service.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">4. Account Termination</h2>
            <p className="text-gray-300 leading-relaxed">
              Upon account termination for violations of our terms, all virtual currency and progress
              is permanently lost with no possibility of refund or recovery.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">5. Exceptions</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              Refunds may be considered in exceptional circumstances at the sole discretion of Troll City administration.
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
              <li>Technical errors preventing access to purchased content</li>
              <li>Duplicate charges due to system errors</li>
              <li>Other circumstances reviewed on a case-by-case basis</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">6. Contact for Refunds</h2>
            <p className="text-gray-300 leading-relaxed">
              For refund requests, please contact support at trollcity2025@gmail.com with detailed
              information about your purchase and the reason for the refund request.
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