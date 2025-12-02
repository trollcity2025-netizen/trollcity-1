import React from 'react'
import { useAuthStore } from '../../lib/store'
import { FileText } from 'lucide-react'

type SectionProps = {
  title: string
  children: React.ReactNode
}

function DocSection({ title, children }: SectionProps) {
  return (
    <section className="rounded-2xl border border-purple-600/30 bg-black/60 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-purple-300 mb-2">
        {title}
      </h2>
      <div className="mt-2 space-y-2 text-sm text-gray-200">{children}</div>
    </section>
  )
}

export default function AdminPoliciesDocsPage() {
  const { profile } = useAuthStore()
  const isAdmin = profile?.role === 'admin' || profile?.is_admin

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-white">
        Admin access only.
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto text-white min-h-screen">
      <header className="flex flex-col gap-1 mb-6">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-purple-400" />
          <p className="text-xs uppercase tracking-[0.2em] text-purple-300">
            Internal Docs
          </p>
        </div>
        <h1 className="text-2xl font-bold text-white">
          Troll City Policy & Economy Overview
        </h1>
        <p className="text-xs text-gray-400">
          Quick reference for admins: payouts, officer rules, bans, and economy
          logic. This page does not replace the public Terms of Service.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <DocSection title="Coin Economy">
          <p>
            • <strong>Free Coins:</strong> Earned via events, officer shifts, bonuses.
            Cannot be cashed out directly.
          </p>
          <p>
            • <strong>Paid Coins:</strong> Purchased or converted. Only balance that is
            eligible for payouts.
          </p>
          <p>
            • <strong>Current internal conversion:</strong> 100,000 Free → 10 Paid
            Coins (configurable in <code className="text-purple-300">app_settings</code>).
          </p>
          <p>
            • Admins must never manually mint or delete coins. Adjust via audited
            transactions only.
          </p>
        </DocSection>

        <DocSection title="Payout Rules">
          <p>
            • Minimum payout threshold: <strong>7,000 Paid Coins</strong>.
          </p>
          <p>
            • Payouts are processed manually via the Admin "Payout Requests"
            view, then marked as <code className="text-purple-300">paid_at</code>/<code className="text-purple-300">paid_by</code>.
          </p>
          <p>
            • KYC / ID verification & W-9 (US) required before first payout.
          </p>
          <p>
            • Accounts with chargebacks, fraud flags, or active bans are not eligible
            for payout.
          </p>
        </DocSection>

        <DocSection title="Troll Officers">
          <p>
            • Officers are independent contractors, not employees. Coins earned are
            logged in <code className="text-purple-300">officer_shift_logs</code>.
          </p>
          <p>
            • Pay bands (free coins per hour): 
            <strong className="text-blue-400"> Junior 500</strong>, 
            <strong className="text-orange-400"> Senior 800</strong>, 
            <strong className="text-red-400"> Commander 1200</strong>.
          </p>
          <p>
            • Auto clock-out when inactive for more than 20 minutes.
          </p>
          <p>
            • Monthly payroll summary available via <code className="text-purple-300">officer_monthly_payroll</code>{' '}
            view, with export to PDF.
          </p>
        </DocSection>

        <DocSection title="Moderation & Bans">
          <p>
            • Severe violations (self-harm, minors, hate, explicit content) → immediate
            ban and escalation.
          </p>
          <p>
            • Use the <code className="text-purple-300">moderation_reports</code> view to review AI and officer
            reports.
          </p>
          <p>
            • Bans are recorded with <code className="text-purple-300">is_banned</code> and{' '}
            <code className="text-purple-300">ban_expires_at</code> fields on <code className="text-purple-300">user_profiles</code>.
          </p>
          <p>
            • Admins should always log a <strong>ban_reason</strong> and timestamp.
          </p>
        </DocSection>

        <DocSection title="Badges & Eligibility">
          <p>• <strong>OG Badge:</strong> joined before Jan 1, 2026.</p>
          <p>• <strong>Officer Badge:</strong> approved Troll Officer role.</p>
          <p>• <strong>Influencer Badge:</strong> verified + influencer tier active (200+ followers, 5000+ coins received).</p>
          <p>• <strong>Verified Badge:</strong> AI verification passed + payment ($5 PayPal or 500 paid coins).</p>
          <p>• <strong>VIP / high-spender:</strong> based on coin purchases; thresholds stored in settings.</p>
        </DocSection>

        <DocSection title="Officer Tiers">
          <p>
            • <strong className="text-blue-400">🟦 Junior (Level 1):</strong> 500 free coins/hour, basic moderation duties
          </p>
          <p>
            • <strong className="text-orange-400">🟧 Senior (Level 2):</strong> 800 free coins/hour, report management
          </p>
          <p>
            • <strong className="text-red-400">🟥 Commander (Level 3):</strong> 1200 free coins/hour, training team lead
          </p>
          <p>
            • Shift rules: Manual clock-in required, auto clock-out after 20 mins inactivity
          </p>
          <p>
            • Earnings logged in <code className="text-purple-300">officer_shift_logs</code>
          </p>
        </DocSection>

        <DocSection title="Verification System">
          <p>
            • <strong>AI Verification:</strong> ID upload + selfie matching via OpenAI Vision API
          </p>
          <p>
            • <strong>Payment:</strong> $5 PayPal or 500 paid coins
          </p>
          <p>
            • <strong>Auto-approval:</strong> AI match score ≥75 AND behavior score ≥75
          </p>
          <p>
            • <strong>Review required:</strong> Scores 50-74 go to admin review
          </p>
          <p>
            • <strong>Denial:</strong> Scores &lt;50 automatically denied
          </p>
        </DocSection>

        <DocSection title="Audit & Safety Notes">
          <p>
            • All economy-critical changes (rates, thresholds, bonus campaigns) should
            be stored in <code className="text-purple-300">app_settings</code> and not hard-coded in frontend.
          </p>
          <p>
            • Never override or edit <code className="text-purple-300">coin_transactions</code> directly; use
            dedicated admin flows.
          </p>
          <p>
            • For legal questions about payouts, taxes, and labor classification,
            consult counsel before changing rules.
          </p>
          <p>
            • All moderation actions are logged in <code className="text-purple-300">moderation_events</code> and
            graded by Observer Bot AI.
          </p>
        </DocSection>
      </div>
    </div>
  )
}

