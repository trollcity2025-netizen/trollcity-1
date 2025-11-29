import React from 'react'
import { useAuthStore } from '../lib/store'
import {
  Shield,
  Coins,
  Banknote,
  Gift,
  Crown,
  Activity,
  DollarSign
} from 'lucide-react'

export default function AdminRFC() {
  const { profile } = useAuthStore()

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#0D0D1A] text-white p-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-2">Admin Only</h1>
          <p className="text-gray-400 text-sm">This RFC document is restricted to Administrators. Please contact an Admin for access.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0D0D1A] text-white p-6">
      <div className="max-w-6xl mx-auto">

        {/* PAGE HEADER */}
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-6">
          <Shield className="text-purple-400 w-8 h-8" />
          RFC — Rules, Fees & Costs (Admin Only)
        </h1>

        <p className="text-gray-400 text-sm mb-10">
          Internal document defining how Troll City handles pricing, payouts, moderation rewards, and platform fees.
        </p>

        {/* COIN STORE */}
        <Section title="Coin Store Pricing" icon={<Coins className="text-yellow-400 w-6 h-6" />}>
          <Table
            headers={['Package Name', 'Coins', 'Price (USD)', 'Value per $1']}
            rows={[
              ['Baby Troll', '500', '$6.49', '77'],
              ['Little Troller', '1,440', '$12.99', '110'],
              ['Mischief Pack', '3,200', '$24.99', '128'],
              ['Troll Family Pack', '6,000', '$44.99', '133'],
              ['Royal Troll Pack', '12,500', '$104.99', '119'],
              ['Ultimate Troll Pack', '51,800', '$279.99', '185'],
            ]}
          />
        </Section>

        {/* CASH OUT RULES */}
        <Section title="Cash-Out Rules" icon={<Banknote className="text-green-400 w-6 h-6" />}>
          <Table
            headers={['Free Coins Required', 'Cash Payout', 'Platform Fee', 'Profit Margin']}
            rows={[
              ['7,000', '$21', '$4', '$4.50'],
              ['14,000', '$49.50', '$9', '$7.00'],
              ['27,000', '$90', '$13', '$10.50'],
              ['47,000', '$155', '$19', '$14.50'],
            ]}
          />
          <p className="text-gray-400 text-sm mt-2">
            ⚠ Paid coins cannot be cashed out. Only free coins earned via streaming or gifting.
          </p>
        </Section>

        {/* GIFT SYSTEM */}
        <Section title="Gift Rules & Rewards" icon={<Gift className="text-pink-400 w-6 h-6" />}>
          <Table
            headers={['Gift Name', 'Cost (Coins)', 'Streamer Earns', 'Special Effect']}
            rows={[
              ['Blunt', '1', '0.8', 'No effect'],
              ['Lighter', '5', '4', 'Spark flash'],
              ['Pack of Cigs', '15', '12', 'Smoke puff'],
              ['Bong', '25', '20', 'Green vapor'],
              ['Troll Hat', '40', '32', 'Rotating hat'],
              ['Tool Box (Admin)', '75', '35', '+1% Store Profit'],
              ['Basketball - VIVED', '100', '5 paid coins', 'Tracks 5000 coin goal'],
              ['SAV Cat Scratch', '200', '5 paid coins', 'Screen-wide scratch'],
            ]}
          />
        </Section>

        {/* WHEEL RULES */}
        <Section title="Wheel Rules" icon={<Activity className="text-red-400 w-6 h-6" />}>
          <ul className="text-gray-300 space-y-2 pl-6 list-disc text-sm">
            <li>Only FREE coins can be used to spin the wheel.</li>
            <li>Wheel only awards FREE coins.</li>
            <li>Jackpot triggers confetti, troll laugh, and animated coin burst.</li>
            <li>Probability is system-defined (no user manipulation).</li>
          </ul>
        </Section>

        {/* OFFICER PAY STRUCTURE */}
        <Section title="Troll Officer Earnings" icon={<Shield className="text-blue-400 w-6 h-6" />}>
          <Table
            headers={['Action', 'Reputation Gain', 'Paid Coins?', 'Bonus']}
            rows={[
              ['Kick', '+3', 'No', 'Light violation'],
              ['Mute', '+1', 'No', 'Temporary discipline'],
              ['Ban', '+7', '1% future payout', 'Permanent block'],
              ['False Ban/Report', '-10', 'No', 'Penalty'],
            ]}
          />
          <p className="text-gray-400 text-sm mt-2">
            Officers do not get instant pay; rewards depend on streamer’s future payouts.
          </p>
        </Section>

        {/* PAYMENT PROCESSORS */}
        <Section title="Payment Processing Fees" icon={<DollarSign className="text-orange-400 w-6 h-6" />}>
          <Table
            headers={['Provider', 'Fee Structure', 'Avg Cost']}
            rows={[
              ['Square', '2.9% + $0.30', '1st choice'],
              ['PayPal', '3.49% + $0.49', 'High fees'],
              ['Venmo / Cash App', '1.5%', 'Wallet to wallet'],
              ['Apple Pay / Google Pay', '2.8% + $0.30', 'Tokenized payments'],
            ]}
          />
        </Section>

        {/* ENTRANCE EFFECTS */}
        <Section title="Entrance Effects (Paid Coins)" icon={<Crown className="text-yellow-500 w-6 h-6" />}>
          <Table
            headers={['Effect Name', 'Coin Cost', 'Duration', 'Eligibility']}
            rows={[
              ['Neon Troll Explosion', '5,000', '5s', 'VIP, Elite'],
              ['Royal Sparkle Crown', '10,000', '8s', 'VIP Only'],
              ['VIVED Meteor Shower', '50,000', '10s', 'Limited VIP'],
              ['SAV Thunder Scratch', '75,000', '12s', 'Elite Only'],
            ]}
          />
        </Section>

      </div>
    </div>
  )
}

/* SECTION WRAPPER */
function Section({ title, icon, children }: any) {
  return (
    <div className="bg-[#151520] p-6 rounded-lg mb-10 border border-gray-800 shadow-md">
      <h2 className="text-xl font-bold flex items-center gap-3 mb-4">{icon} {title}</h2>
      {children}
    </div>
  )
}

/* REUSABLE TABLE */
function Table({ headers, rows }: any) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border border-gray-800 text-sm">
        <thead>
          <tr>
            {headers.map((h: string, idx: number) => (
              <th
                key={idx}
                className="border border-gray-800 bg-[#1E1E2D] px-3 py-2 text-left text-gray-300 font-semibold"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any[], i: number) => (
            <tr key={i}>
              {row.map((cell: any, j: number) => (
                <td key={j} className="border border-gray-800 px-3 py-2 text-gray-400">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
