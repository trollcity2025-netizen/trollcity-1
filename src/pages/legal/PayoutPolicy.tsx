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
          <li>Hold at least <strong>7,000 Paid Coins</strong> in your account</li>
          <li>Complete identity verification (KYC/ID check)</li>
          <li>Submit required tax forms (W-9 for US users, or equivalent for international)</li>
          <li>Have a verified PayPal email address on file</li>
          <li>Have no active bans, suspensions, or fraud flags</li>
          <li>Have no pending chargebacks or payment disputes</li>
        </ul>

        <h2>2. Payout Process</h2>
        <p>
          Payouts are processed as follows:
        </p>
        <ol>
          <li><strong>Request Submission:</strong> Submit a payout request through
            your account dashboard with the amount of Paid Coins you wish to cash out</li>
          <li><strong>Review Period:</strong> All requests are reviewed by our admin
            team, typically within 3-5 business days</li>
          <li><strong>Approval:</strong> Approved payouts are processed manually via
            PayPal Payouts API</li>
          <li><strong>Payment:</strong> Funds are sent to your verified PayPal email
            address within 5-10 business days of approval</li>
        </ol>

        <h2>3. Conversion Rate</h2>
        <p>
          Current conversion rate: <strong>100 Paid Coins = $1.00 USD</strong>
        </p>
        <p>
          This rate may be adjusted at any time. You will be notified of rate changes
          before they take effect. The rate at the time of your request submission
          will be honored.
        </p>

        <h2>4. Minimum and Maximum Payouts</h2>
        <ul>
          <li><strong>Minimum:</strong> 7,000 Paid Coins ($70 USD)</li>
          <li><strong>Maximum per request:</strong> No maximum, but large payouts
            may require additional verification</li>
          <li><strong>Frequency:</strong> You may submit one payout request at a time.
            After a payout is processed, you may submit another request</li>
        </ul>

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
          Troll City does not charge processing fees for payouts. However, PayPal
          may charge fees on the receiving end. These fees are your responsibility.
        </p>

        <h2>8. Payment Method</h2>
        <p>
          Currently, all payouts are processed via PayPal only. You must provide a
          valid PayPal email address that matches your verified identity. We do not
          support bank transfers, checks, or other payment methods at this time.
        </p>

        <h2>9. Payout Timeline</h2>
        <ul>
          <li><strong>Request Review:</strong> 3-5 business days</li>
          <li><strong>Payment Processing:</strong> 5-10 business days after approval</li>
          <li><strong>Total Timeline:</strong> Typically 8-15 business days from
            request to payment</li>
        </ul>
        <p>
          Delays may occur during holidays, high-volume periods, or if additional
          verification is required.
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

