import React from 'react'
import LegalLayout from '../../components/LegalLayout'

export default function RefundPolicy() {
  return (
    <LegalLayout>
      <article className="prose prose-invert max-w-none prose-headings:text-slate-50 prose-a:text-purple-300 prose-strong:text-slate-100">
        <p className="text-xs uppercase tracking-[0.15em] text-purple-300">
          Legal
        </p>
        <h1 className="mb-2 text-2xl font-bold tracking-tight">
          Refund & Purchase Policy
        </h1>
        <p className="text-xs text-slate-400 mb-6">
          Last updated: January 2025
        </p>

        <h2>1. General Policy</h2>
        <p>
          All purchases of Coins, digital items, perks, entrance effects, and other
          virtual goods on Troll City are final and non-refundable, except where
          required by applicable law or as explicitly stated in this policy.
        </p>

        <h2>2. Coin Purchases</h2>
        <p>
          When you purchase Paid Coins through PayPal or other payment methods:
        </p>
        <ul>
          <li>Coins are credited to your account immediately upon successful payment</li>
          <li>All sales are final once coins are credited</li>
          <li>We do not offer refunds for coin purchases unless required by law</li>
          <li>Chargebacks may result in account suspension and coin balance reversal</li>
        </ul>

        <h2>3. Digital Items & Perks</h2>
        <p>
          Purchases of digital items such as:
        </p>
        <ul>
          <li>Entrance effects</li>
          <li>Perks (ghost mode, ban shield, etc.)</li>
          <li>Insurance</li>
          <li>Verification badges</li>
        </ul>
        <p>
          These are non-refundable once activated or used. If you experience a technical
          issue preventing use of a purchased item, contact support for assistance.
        </p>

        <h2>4. Refund Exceptions</h2>
        <p>
          We may consider refunds in the following circumstances:
        </p>
        <ul>
          <li><strong>Technical Errors:</strong> If a purchase fails to credit due to a
            system error, we will investigate and credit the purchase or provide a refund</li>
          <li><strong>Duplicate Charges:</strong> If you are charged multiple times for a
            single purchase, we will refund the duplicate charges</li>
          <li><strong>Legal Requirements:</strong> Where local consumer protection laws
            require refunds (e.g., EU 14-day cooling-off period for digital goods)</li>
        </ul>

        <h2>5. Chargebacks and Fraud</h2>
        <p>
          Initiating a chargeback or payment dispute without first contacting support
          may result in:
        </p>
        <ul>
          <li>Immediate account suspension</li>
          <li>Reversal of all coin balances and purchased items</li>
          <li>Permanent ban from the platform</li>
        </ul>
        <p>
          If you believe a charge was made in error, contact support immediately before
          initiating a chargeback.
        </p>

        <h2>6. Promotional Coins</h2>
        <p>
          Free Coins, bonus coins, promotional coins, and coins earned through events
          or officer shifts are non-refundable and cannot be converted to cash or
          refunded under any circumstances.
        </p>

        <h2>7. How to Request a Refund</h2>
        <p>
          If you believe you are eligible for a refund:
        </p>
        <ol>
          <li>Contact support through the in-app support system</li>
          <li>Provide your transaction ID and purchase details</li>
          <li>Explain the reason for your refund request</li>
          <li>Allow 5-7 business days for review</li>
        </ol>

        <h2>8. Processing Time</h2>
        <p>
          Approved refunds will be processed to your original payment method within
          5-10 business days. Refunded amounts may take additional time to appear
          in your account depending on your payment provider.
        </p>
      </article>
    </LegalLayout>
  )
}
