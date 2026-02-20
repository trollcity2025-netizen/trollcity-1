import React from 'react'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

export interface CreditScoreBadgeProps {
  score?: number
  tier?: string
  trend7d?: number
  trend30d?: number
  loading?: boolean
}

function trendIcon(trend?: number) {
  if (trend === 1) return <ArrowUpRight className="w-4 h-4 text-emerald-400" />
  if (trend === -1) return <ArrowDownRight className="w-4 h-4 text-red-400" />
  return <Minus className="w-4 h-4 text-gray-400" />
}

function tierColor(tier?: string) {
  switch (tier) {
    case 'Untrusted':
      return 'from-red-700/60 to-red-900/80 text-red-100 border-red-700/60'
    case 'Shaky':
      return 'from-amber-700/50 to-amber-900/70 text-amber-100 border-amber-700/50'
    case 'Building':
      return 'from-sky-700/50 to-sky-900/70 text-sky-100 border-sky-700/50'
    case 'Reliable':
      return 'from-cyan-700/50 to-cyan-900/70 text-cyan-100 border-cyan-700/50'
    case 'Trusted':
      return 'from-emerald-700/50 to-emerald-900/70 text-emerald-100 border-emerald-700/50'
    case 'Elite':
      return 'from-purple-700/50 to-purple-900/70 text-purple-100 border-purple-700/50'
    default:
      return 'from-slate-700/50 to-slate-900/70 text-slate-100 border-slate-700/50'
  }
}

export function CreditScoreBadge({ score, tier, trend7d, trend30d, loading }: CreditScoreBadgeProps) {
  const displayScore = loading ? '—' : score ?? '—'
  const displayTier = loading ? 'Loading…' : tier ?? 'Unknown'
  const trend = trend30d ?? trend7d
  const trendLabel = trend30d ? '30d' : '7d'

  return (
    <div
      className={`rounded-xl border bg-gradient-to-br p-4 flex items-center justify-between shadow-lg ${tierColor(
        tier
      )}`}
    >
      <div>
        <p className="text-xs uppercase tracking-wide text-white/70">Credit Score</p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{displayScore}</span>
          <span className="text-sm text-white/70">/ 800</span>
        </div>
        <p className="text-sm font-semibold mt-1">{displayTier}</p>
      </div>
      <div className="flex flex-col items-end gap-1 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-white/80">{trendLabel}</span>
          {trendIcon(trend)}
        </div>
      </div>
    </div>
  )
}

export default CreditScoreBadge
