import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { toast } from 'sonner'
import { Loader2, CheckCircle, ExternalLink, DollarSign, Coins, Clock3, Trash2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

interface ManualOrderRow {
  id: string
  user_id: string
  package_id: string | null
  coins: number
  amount_cents: number
  status: string
  note_suggested: string | null
   payer_cashtag?: string | null
  paid_at: string | null
  fulfilled_at: string | null
  created_at: string | null
  metadata: Record<string, any> | null
}

interface UserProfileLite {
  id: string
  username: string | null
  email: string | null
  rgb_username_expires_at?: string | null
  role?: string | null
}

interface CoinPackageLite {
  id: string
  name: string | null
  coins: number | null
  price_usd: number | null
  amount_cents?: number | null
}

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-200 border border-yellow-500/30',
  paid: 'bg-blue-500/15 text-blue-200 border border-blue-500/30',
  fulfilled: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30',
  canceled: 'bg-gray-500/15 text-gray-200 border border-gray-500/30',
}

const MANUAL_ORDER_COINS_PER_DOLLAR = 222.3

export default function AdminManualOrders() {
  const [orders, setOrders] = useState<ManualOrderRow[]>([])
  const [profiles, setProfiles] = useState<Record<string, UserProfileLite>>({})
  const [packages, setPackages] = useState<Record<string, CoinPackageLite>>({})
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [txRefs, setTxRefs] = useState<Record<string, string>>({})
  const [searchParams] = useSearchParams()
  const focusOrderId = searchParams.get('orderId')
  const focusRef = useRef<HTMLDivElement | null>(null)
  const [activeTab, setActiveTab] = useState<'orders' | 'transactions'>('orders')

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('manual_coin_orders')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      const rows = data || []
      setOrders(rows)

      const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)))
      const pkgIds = Array.from(new Set(rows.map((r: any) => r.package_id).filter(Boolean))) as string[]

      // Note: Cannot use embedded relationship 'user:user_profiles' due to multiple FKs
      // to user_profiles (user_id, processed_by). Must fetch separately.
      if (userIds.length) {
        const { data: userData, error: userError } = await supabase
          .from('user_profiles')
          .select('id, username, email, rgb_username_expires_at, role')
          .in('id', userIds)
        if (!userError && userData) {
          const map: Record<string, UserProfileLite> = {}
          userData.forEach((u) => { map[u.id] = u })
          setProfiles(map)
        }
      }

      if (pkgIds.length) {
        const { data: pkgData, error: pkgError } = await supabase
          .from('coin_packages')
          .select('id, name, coins, price_usd, amount_cents')
          .in('id', pkgIds)
        if (!pkgError && pkgData) {
          const map: Record<string, CoinPackageLite> = {}
          pkgData.forEach((p) => { map[p.id] = p })
          setPackages(map)
        }
      }
    } catch (e: any) {
      console.error('Manual orders load error', e)
      toast.error(e?.message || 'Failed to load manual orders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const approveOrder = useCallback(async (orderId: string) => {
    setActionId(orderId)
    try {
      const { data, error } = await supabase.rpc('process_manual_coin_order', {
        p_order_id: orderId,
        p_external_tx_id: txRefs[orderId] || null
      })

      if (error) throw error
      if (data && !data.success) throw new Error(data.error || 'Approval failed')

      toast.success('Order credited successfully')
      loadOrders()
    } catch (e: any) {
      console.error('Approve manual order error', e)
      toast.error(e?.message || 'Failed to approve order')
    } finally {
      setActionId(null)
    }
  }, [txRefs, loadOrders])

  const deleteOrder = useCallback(async (orderId: string) => {
    if (!window.confirm('Delete this manual Cash App order? This cannot be undone.')) return
    setActionId(orderId)
    try {
      // Soft delete
      const { error } = await supabase
        .from('manual_coin_orders')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', orderId)

      if (error) throw error

      toast.success('Manual order deleted')
      loadOrders()
    } catch (e: any) {
      console.error('Delete manual order error', e)
      toast.error(e?.message || 'Failed to delete order')
    } finally {
      setActionId(null)
    }
  }, [loadOrders])

  const rows = useMemo(() => orders.map((o) => {
    const user = profiles[o.user_id]
    const pkg = o.package_id ? packages[o.package_id] : undefined
    const hasRgb = user?.rgb_username_expires_at && new Date(user.rgb_username_expires_at) > new Date()
    const amountUsd = o.amount_cents ? o.amount_cents / 100 : (pkg?.price_usd ?? 0)
    return { o, user, pkg, hasRgb, amountUsd }
  }), [orders, profiles, packages])

  const transactionRows = useMemo(() => {
    return rows.map(({ o, user, amountUsd }) => {
      const usd = amountUsd || 0
      const isCredited = o.status === 'fulfilled'
      const adminPoolCoinsRaw = usd * MANUAL_ORDER_COINS_PER_DOLLAR
      const adminPoolCoins = isCredited ? Math.round(adminPoolCoinsRaw) : 0
      const adminPoolUsd = adminPoolCoins > 0 ? adminPoolCoins / MANUAL_ORDER_COINS_PER_DOLLAR : 0
      return {
        id: o.id,
        date: o.created_at ? new Date(o.created_at).toLocaleString() : '',
        username: user?.username || 'unknown',
        status: o.status,
        usdAmount: usd,
        coins: o.coins,
        adminPoolCoins,
        adminPoolUsd,
      }
    })
  }, [rows])

  useEffect(() => {
    if (focusOrderId && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [focusOrderId, rows.length])

  return (
    <div className="p-4 text-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Manual Cash App Orders</h2>
          <p className="text-sm text-gray-400">Mark paid & credit coins. Syncs wallet ledger for economy dashboards.</p>
        </div>
        <button
          onClick={loadOrders}
          className="px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded text-sm font-semibold"
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-3 py-2 rounded-md text-sm font-semibold ${
            activeTab === 'orders'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Orders Queue
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-3 py-2 rounded-md text-sm font-semibold ${
            activeTab === 'transactions'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Manual Order Transactions
        </button>
      </div>

      {activeTab === 'orders' && (
        <>
          {rows.length === 0 && !loading && (
            <div className="text-gray-400">No manual orders yet.</div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading orders…</div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
            {rows.map(({ o, user, pkg, hasRgb, amountUsd }) => {
              const isFocused = focusOrderId === o.id
              const payerTag = o.payer_cashtag || o.metadata?.payer_cashtag || o.metadata?.cashapp_tag
              return (
              <div
                key={o.id}
                ref={isFocused ? focusRef : undefined}
                className={`bg-gray-900 border rounded-lg p-4 space-y-3 ${isFocused ? 'border-emerald-400 shadow-[0_0_0_2px_rgba(52,211,153,0.4)]' : 'border-purple-500/20'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-400">{new Date(o.created_at || '').toLocaleString()}</div>
                  <span className={`px-2 py-1 rounded-full text-[11px] uppercase tracking-wide ${statusStyles[o.status] || 'bg-gray-700 text-gray-200'}`}>
                    {o.status}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Coins className="w-4 h-4 text-yellow-400" />
                    <span className="font-semibold text-yellow-300">{o.coins.toLocaleString()} coins</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-green-300">
                    <DollarSign className="w-4 h-4" />
                    <span>${amountUsd?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {pkg?.name && (
                    <div className="text-xs text-gray-300">Package: {pkg.name}</div>
                  )}
                </div>

                <div className="bg-black/30 border border-white/5 rounded p-3 text-sm">
                  <div className="font-semibold mb-1">User</div>
                  <div className={`text-sm ${hasRgb ? 'rgb-username font-bold' : ''}`}>
                    @{user?.username || 'unknown'}
                  </div>
                  <div className="text-xs text-gray-400">{user?.email || 'no email'}</div>
                  <div className="text-[11px] text-gray-500">Role: {user?.role || 'n/a'}</div>
                </div>

                <div className="text-xs text-gray-300">
                  <div className="font-semibold mb-1">Payer Cash App Tag</div>
                  <div className="bg-white/5 rounded px-2 py-1 inline-flex items-center gap-2 text-green-100 border border-green-500/30">
                    {payerTag ? `$${payerTag}` : 'Not provided'}
                  </div>
                  {!payerTag && <div className="text-[11px] text-gray-500 mt-1">Ask user to resubmit if tag is missing.</div>}
                </div>

                <div className="text-xs text-gray-300">
                  <div className="font-semibold mb-1">Cash App Note</div>
                  <div className="bg-white/5 rounded px-2 py-1 inline-flex items-center gap-2 text-purple-100 border border-purple-500/30">
                    <Clock3 className="w-4 h-4" /> {o.note_suggested || '—'}
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="External TX ID (optional)"
                    value={txRefs[o.id] || ''}
                    onChange={(e) => setTxRefs((prev) => ({ ...prev, [o.id]: e.target.value }))}
                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm focus:border-purple-400 outline-none"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => approveOrder(o.id)}
                      disabled={actionId === o.id || o.status === 'fulfilled'}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded text-sm font-semibold flex items-center gap-2"
                    >
                      {actionId === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      {o.status === 'fulfilled' ? 'Already Credited' : 'Mark Paid & Credit'}
                    </button>
                    <a
                      href={`/admin/manual-orders?orderId=${o.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm font-semibold flex items-center gap-2 border border-white/10"
                    >
                      <ExternalLink className="w-4 h-4" /> Open in new tab
                    </a>
                    <button
                      onClick={() => deleteOrder(o.id)}
                      disabled={actionId === o.id}
                      className="px-3 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-60 rounded text-sm font-semibold flex items-center gap-2"
                    >
                      {actionId === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )})}
          </div>
        </>
      )}

      {activeTab === 'transactions' && (
        <div className="mt-3 bg-gray-900 border border-purple-500/20 rounded-lg p-4 overflow-x-auto">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading transactions…
            </div>
          ) : transactionRows.length === 0 ? (
            <div className="text-gray-400">No manual orders yet.</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-300 border-b border-white/10">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">User</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Cash Amount</th>
                  <th className="py-2 px-3">Coins To User</th>
                  <th className="py-2 px-3">Admin Pool Coins</th>
                  <th className="py-2 px-3">Admin Pool Value</th>
                </tr>
              </thead>
              <tbody>
                {transactionRows.map(row => (
                  <tr key={row.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 px-3">{row.date}</td>
                    <td className="py-2 px-3">@{row.username}</td>
                    <td className="py-2 px-3 uppercase text-xs">{row.status}</td>
                    <td className="py-2 px-3">
                      ${row.usdAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3">{row.coins.toLocaleString()}</td>
                    <td className="py-2 px-3">
                      {row.adminPoolCoins > 0 ? row.adminPoolCoins.toLocaleString() : '0'}
                    </td>
                    <td className="py-2 px-3">
                      {row.adminPoolCoins > 0
                        ? `$${row.adminPoolUsd.toFixed(2)}`
                        : '$0.00'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
