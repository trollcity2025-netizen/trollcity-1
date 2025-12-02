// Gambling Disclosure page
import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function GamblingDisclosure() {
  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <Link to="/legal" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Policy Center
        </Link>

        <h1 className="text-4xl font-bold mb-6">Gambling Disclosure</h1>

        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-8 space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Legal Notice</h2>
            <p className="text-gray-300 leading-relaxed">
              TrollCity coins are virtual currency with no gambling value. Coins cannot be used for gambling,
              betting, or games of chance. Coins are for platform features only (gifts, battles, etc.).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">No Real Money Value</h2>
            <p className="text-gray-300 leading-relaxed">
              Coins have no cash value except as specified in our Creator Earnings Policy for payouts.
              Coins cannot be traded, sold, or exchanged for real money except through official creator payouts.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Age Restrictions</h2>
            <p className="text-gray-300 leading-relaxed">
              Users must be 18+ to purchase coins or receive payouts. Users under 18 can use free coins only.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

