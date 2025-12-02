// Partner Program Terms page
import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function PartnerProgram() {
  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <Link to="/legal" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Policy Center
        </Link>

        <h1 className="text-4xl font-bold mb-6">Troll Empire Partner Program</h1>

        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-8 space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Program Overview</h2>
            <p className="text-gray-300 leading-relaxed">
              The Troll Empire Partner Program allows approved creators to earn referral bonuses by recruiting
              new users who become active streamers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Eligibility</h2>
            <p className="text-gray-300 leading-relaxed">
              Partners must apply and pay a one-time fee ($15 or 1500 paid coins) to join. Only approved
              partners can earn referral bonuses.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Referral Bonus</h2>
            <p className="text-gray-300 leading-relaxed">
              Partners earn 5% of a referred user's earned coins once that user reaches 40,000 coins in a
              calendar month. Bonuses are paid in paid coins (not cash withdrawable).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Rules</h2>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Referrals must be real, unique, active users</li>
              <li>Abuse or fraud results in permanent program ban</li>
              <li>Bonuses are calculated monthly and paid automatically</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

