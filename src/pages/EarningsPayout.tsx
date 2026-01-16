// src/pages/EarningsPayout.tsx
import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import api from '../lib/api'
import { toast } from 'sonner'
import { startFlow, completeFlow } from '../lib/telemetry'
import { DollarSign, Banknote, Send, History } from 'lucide-react'

type PayoutMethod = 'Gift Card'

interface CashoutTier {
  id: string
  coins: number
  usd: number
  label: string
}

const CASHOUT_TIERS: CashoutTier[] = [
  { id: 'tier1', coins: 7000, usd: 21, label: '7,000 Troll Coins → $21' },
  { id: 'tier2', coins: 14000, usd: 49.5, label: '14,000 Troll Coins → $49.50' },
  { id: 'tier3', coins: 27000, usd: 90, label: '27,000 Troll Coins → $90' },
  { id: 'tier4', coins: 47000, usd: 155, label: '47,000 Troll Coins → $155' },
]

export default function EarningsPayout() {
  const { profile, user } = useAuthStore()
  const [payoutMethod] = useState<PayoutMethod>('Gift Card')
  const [payoutDetails, setPayoutDetails] = useState('')
  const [fullName, setFullName] = useState('')
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [recentRequests, setRecentRequests] = useState<any[]>([])

  const raw_troll_coins = profile?.troll_coins || 0
  const reserved_coins = profile?.reserved_troll_coins || 0
  const troll_coins = Math.max(0, raw_troll_coins - reserved_coins)
  
  const freeCoins = profile?.troll_coins || 0

  const eligibleTiers = useMemo(
    () => CASHOUT_TIERS.filter(t => t.coins <= troll_coins),
    [troll_coins]
  )

  useEffect(() => {
    if (eligibleTiers.length > 0 && !selectedTierId) {
      setSelectedTierId(eligibleTiers[0].id)
    }
  }, [eligibleTiers, selectedTierId])

  const loadRecent = useCallback(async () => {
    if (!profile) return
    const { data, error } = await supabase
      .from('cashout_requests')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(5)
    if (error) {
      console.error(error)
      return
    }
    setRecentRequests(data || [])
  }, [profile])

  useEffect(() => {
    loadRecent()
  }, [profile?.id, loadRecent])

  useEffect(() => {
    if (!profile?.id) return
    const channel = supabase
      .channel(`cashout_requests_${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cashout_requests', filter: `user_id=eq.${profile.id}` }, () => {
        loadRecent()
      })
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, loadRecent])

  useEffect(() => {
    startFlow('cashout')
  }, [])

  const cancelRequest = useCallback(async (id: string) => {
    if (!profile) return
    try {
      const j = await api.delete(`/payouts/cashouts/${id}`)
      if (!j.success) throw new Error(j?.error || 'Delete failed')

      toast.success('Cashout request cancelled')
      await loadRecent()
    } catch (e: any) {
      console.error('Cancel request error', e)
      toast.error('Cancel failed')
    }
  }, [profile, loadRecent])

  const placeholderForMethod = (_m: PayoutMethod) => 'Email for Gift Card'

  const handleSubmit = useCallback(async () => {
    if (!profile) {
      toast.error('You must be logged in to request a payout.')
      return
    }

    if (!eligibleTiers.length) {
      toast.error('Not enough Troll Coins to cash out yet.')
      return
    }

    const tier = CASHOUT_TIERS.find(t => t.id === selectedTierId)
    if (!tier) {
      toast.error('Select a cashout tier.')
      return
    }

    if (tier.coins > troll_coins) {
      toast.error('You no longer have enough Troll Coins for that tier.')
      return
    }

    if (!payoutDetails.trim()) {
      toast.error('Enter your payout details.')
      return
    }

    setLoading(true)

    try {
      const email = user?.email || ''
      const username = profile.username

      const { error } = await supabase.from('cashout_requests').insert([
        {
          user_id: profile.id,
          username,
          full_name: fullName,
          email,
          payout_method: payoutMethod,
          payout_details: payoutDetails.trim(),
          requested_coins: tier.coins,
          usd_value: tier.usd,
          status: 'pending',
        },
      ])

      if (error) {
        console.error('Cashout request error:', error)
        toast.error(`Database error: ${error.message}`)
        throw error
      }

      toast.success('Cashout request submitted! Admin will review and pay manually.')
      completeFlow('cashout')
      setPayoutDetails('')
      setFullName('')
      await loadRecent()
    } catch (err: any) {
      console.error('Cashout submission error:', err)
      toast.error(err.message || 'Failed to submit request.')
    } finally {
      setLoading(false)
    }
  }, [profile, eligibleTiers.length, selectedTierId, troll_coins, payoutDetails, user?.email, payoutMethod, fullName, loadRecent])

  return (
    <div className="min-h-screen bg-[#05030B] text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Balance Summary */}
        <div className="bg-[#0E0A1A] rounded-xl border border-purple-700/40 p-6 shadow-xl">
          <h1 className="text-3xl font-extrabold mb-2 flex items-center gap-2">
            <DollarSign className="text-troll-gold w-7 h-7" />
            Troll City Cashout
          </h1>
          <p className="text-sm text-gray-300 mb-4">
            Only <span className="text-troll-gold">Troll Coins (troll_coins)</span> count toward payouts.
            Free coins are for fun, wheel, and bonuses only.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-[#151027] rounded-lg p-4 border border-purple-500/30">
              <p className="text-gray-400">Paid Troll Coins</p>
              <p className="text-2xl font-bold text-troll-gold">{troll_coins.toLocaleString()}</p>
            </div>
            <div className="bg-[#101522] rounded-lg p-4 border border-green-500/20">
              <p className="text-gray-400">Free Coins (not cashout)</p>
              <p className="text-xl font-semibold text-green-400">{freeCoins.toLocaleString()}</p>
            </div>
            <div className="bg-[#17131F] rounded-lg p-4 border border-indigo-500/20">
              <p className="text-gray-400">Eligible Tiers</p>
              <p className="text-lg font-semibold">
                {eligibleTiers.length ? `${eligibleTiers.length} tier(s)` : 'None yet'}
              </p>
            </div>
          </div>
        </div>

        {/* Cashout Form */}
        <div className="bg-[#0E0A1A] rounded-xl border border-purple-700/40 p-6 shadow-lg space-y-4">
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            <Banknote className="text-troll-gold" />
            Request Manual Payout
          </h2>

          <div className="mb-3">
            <label className="block text-sm mb-1">Select Cashout Tier</label>
            <select
  className="w-full bg-[#171427] border border-purple-500/40 rounded-lg px-3 py-2 text-sm"
  value={selectedTierId ?? ''}
  onChange={e => setSelectedTierId(e.target.value)}
>
  {CASHOUT_TIERS.map(tier => (
    <option key={tier.id} value={tier.id} disabled={tier.coins > troll_coins}>
      {tier.label} {tier.coins > troll_coins ? '(not eligible)' : ''}
    </option>
  ))}
</select>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Payout Method</label>
              <div className="w-full bg-[#171427] border border-purple-500/40 rounded-lg px-3 py-2 text-sm">Gift Card</div>
            </div>
            <div>
              <label className="block text-sm mb-1">Full Name</label>
              <input
                type="text"
                className="w-full bg-[#171427] border border-purple-500/40 rounded-lg px-3 py-2 text-sm"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Payout Details</label>
              <input
                type="text"
                className="w-full bg-[#171427] border border-purple-500/40 rounded-lg px-3 py-2 text-sm"
                value={payoutDetails}
                onChange={e => setPayoutDetails(e.target.value)}
                placeholder={placeholderForMethod(payoutMethod)}
              />
            </div>
          </div>

          <button
            disabled={loading}
            onClick={handleSubmit}
            className="w-full mt-2 bg-gradient-to-r from-purple-600 to-indigo-500 text-white py-2 rounded-lg flex items-center justify-center gap-2"
          >
            {loading ? 'Submitting…' : <><Send className="w-4 h-4" />Submit Cashout Request</>}
          </button>
        </div>

        {/* Recent Requests */}
        <div className="bg-[#0E0A1A] rounded-xl border border-purple-700/40 p-6">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <History className="text-troll-gold" /> Recent Cashout Requests
          </h3>
          {recentRequests.length === 0 && (
            <p className="text-sm text-gray-400">No requests yet.</p>
          )}
          <div className="space-y-2 text-sm">
            {recentRequests.map(r => (
              <div
                key={r.id}
                className="flex items-center justify-between bg-[#151027] px-3 py-2 rounded border border-purple-500/20"
              >
                <div>
                  <p className="font-semibold">
                    {r.requested_coins.toLocaleString()} Troll Coins → ${Number(r.usd_value).toFixed(2)}
                  </p>
                  <p className="text-[11px] text-gray-400">{r.payout_method} · {r.payout_details}</p>
                </div>
                <div className="text-right text-[11px]">
                  <span className={r.status === 'completed'
                    ? 'text-green-400'
                    : r.status === 'paid'
                    ? 'text-purple-300'
                    : r.status === 'processing'
                    ? 'text-yellow-300'
                    : 'text-orange-300'}>
                    {r.status.toUpperCase()}
                  </span>
                  <div>{new Date(r.created_at).toLocaleDateString()}</div>
                  {(r.status === 'pending' || r.status === 'processing') && (
                    <button
                      onClick={() => cancelRequest(r.id)}
                      className="px-2 py-1 mt-2 rounded bg-red-600 hover:bg-red-700"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
