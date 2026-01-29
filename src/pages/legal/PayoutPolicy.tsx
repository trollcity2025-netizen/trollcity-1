import React from 'react'
import LegalLayout from '../../components/LegalLayout'

export default function PayoutPolicy() {
  return (
    <LegalLayout>
      <article className="prose prose-invert max-w-none prose-headings:text-slate-50 prose-a:text-purple-300 prose-strong:text-slate-100">
        <p className="text-xs uppercase tracking-[0.15em] text-purple-300">
          Legal
        </p>
        <h1 className="mb-2 text-2xl font-bold tracking-tight">
          Creator & Payout Policy
        </h1>
        <p className="text-xs text-slate-400 mb-6">
          Last updated: January 2025
        </p>

        <h2>1. Eligibility for Payouts</h2>
        <p>
          To be eligible for payouts, you must meet all of the following requirements:
        </p>
        <ul>
          <li>Hold at least <strong>7,000 troll_coins</strong> in your account</li>
          <li>Complete identity verification (KYC/ID check)</li>
          <li>Submit required tax forms (W-9 for US users, or equivalent for international)</li>
          <li>Have a verified email address on file</li>
          <li>Have no active bans, suspensions, or fraud flags</li>
          <li>Have no pending chargebacks or payment disputes</li>
        </ul>

        <h2>2. Payout Process</h2>
        <p>
          Payouts are processed 2 times a week, on Mondays and Fridays. You can submit a payout request at any time, 
          but it will only be processed during these windows.
        </p>

        <h2>3. Payout Tiers & Conversion Rates</h2>
        <p>
          Payouts are processed according to the following fixed tiers. You must reach the minimum balance for a tier to be eligible.
        </p>
        <ul className="list-none space-y-2 pl-0">
          <li className="flex items-center gap-2">
            <span className="w-32 font-bold text-slate-200">Starter Tier:</span>
            <span>7,000 coins = <span className="text-green-400">$21.00 USD</span></span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-32 font-bold text-bronze-400 text-amber-600">Bronze Tier:</span>
            <span>14,000 coins = <span className="text-green-400">$49.50 USD</span></span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-32 font-bold text-slate-400">Silver Tier:</span>
            <span>27,000 coins = <span className="text-green-400">$90.00 USD</span></span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-32 font-bold text-yellow-400">Gold Tier:</span>
            <span>47,000 coins = <span className="text-green-400">$150.00 USD</span></span>
          </li>
        </ul>
        <p className="mt-4 text-sm text-slate-400">
          Rates and tiers are subject to change. The system automatically selects the highest tier your balance qualifies for.
        </p>

        <h2>4. Minimum and Maximum Payouts</h2>
        <p>
          Minimum payout: <strong>7,000 troll_coins ($21.00 USD)</strong><br />
          Maximum payout per week: <strong>$10,000 USD</strong>
        </p>

        <h2>5. Tax Obligations</h2>
        <p>
          <strong>US Users:</strong> If you receive $600 or more in payouts in a
          calendar year, we are required to collect a W-9 form and may issue a
          1099-NEC or 1099-K form for tax reporting purposes.
        </p>
        <p>
          <strong>International Users:</strong> You are responsible for reporting
          and paying any taxes required by your local jurisdiction. We may request
          tax documentation as required by law.
        </p>
        <p>
          <strong>Important:</strong> Payouts may be delayed or denied if required
          tax forms are not submitted and approved.
        </p>

        <h2>6. Payout Denials</h2>
        <p>
          Payout requests may be denied for the following reasons:
        </p>
        <ul>
          <li>Insufficient Paid Coin balance</li>
          <li>Incomplete identity verification</li>
          <li>Missing or unapproved tax forms</li>
          <li>Active account restrictions (bans, suspensions)</li>
          <li>Suspected fraud or chargeback history</li>
          <li>Violation of Terms of Service</li>
          <li>PayPal account issues or restrictions</li>
        </ul>
        <p>
          If your payout is denied, you will receive a notification with the reason.
          You may address the issue and resubmit your request.
        </p>

        <h2>7. Processing Fees</h2>
        <p>
          Standard PayPal transaction fees may apply and will be deducted from the
          payout amount. We do not charge an additional platform fee for payouts.
        </p>

        <h2>8. Payment Method</h2>
        <p>
          Payouts are sent via PayPal. You must have a verified PayPal account
          matching your Troll City account details.
        </p>

        <h2>9. Payout Timeline</h2>
        <p>
          Payouts are processed on Mondays and Fridays. Once processed, funds usually
          arrive in your PayPal account within 24 hours, though some transactions
          may take longer depending on PayPal's processing times.
        </p>

        <h2>10. Disputes and Appeals</h2>
        <p>
          If you disagree with a payout denial or have questions about your payout
          status, contact support through the in-app support system. Include your
          payout request ID and any relevant documentation.
        </p>
      </article>
    </LegalLayout>
  )
}

