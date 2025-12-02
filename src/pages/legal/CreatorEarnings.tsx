// Creator Earnings Policy page
import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function CreatorEarnings() {
  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <Link to="/legal" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Policy Center
        </Link>

        <h1 className="text-4xl font-bold mb-6">Creator Earnings Policy</h1>

        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-8 space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">How Creators Earn</h2>
            <p className="text-gray-300 leading-relaxed">
              Creators earn coins when viewers send gifts during their streams. All gifted coins are added
              to the creator's paid coin balance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Payouts</h2>
            <p className="text-gray-300 leading-relaxed">
              Creators can request payouts when they reach the minimum threshold (10,000 coins = $100).
              Payouts are processed manually and subject to platform fees (20% commission).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Tax Requirements</h2>
            <p className="text-gray-300 leading-relaxed">
              Creators earning over $600 per year will receive a 1099 tax form as required by IRS regulations.
              You must complete onboarding (W9 information) before receiving payouts.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Platform Fees</h2>
            <p className="text-gray-300 leading-relaxed">
              Platform commission: 20% per gift. Payment processing fees: 2.9% + $0.30 per payout transaction.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

