import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { ArrowLeft, Home, Filter, Activity, AlertTriangle } from 'lucide-react'
import ClickableUsername from '../../components/ClickableUsername'

type DeedTransferRow = {
  id: string
  property_id: string
  seller_user_id: string
  buyer_user_id: string
  sale_price: number
  deed_fee: number
  seller_net: number
  system_value_at_sale: number | null
  created_at: string
  seller_username?: string
  buyer_username?: string
}

type UserDeed = {
  deed_id: string
  property_id: string
}

type UserDeedGroup = {
  user_id: string
  username?: string
  deeds: UserDeed[]
}

export default function AdminTrollTownDeeds() {
  const { profile } = useAuthStore()
  const [rows, setRows] = useState<DeedTransferRow[]>([])
  const [loading, setLoading] = useState(true)
  const [adminPoolBalance, setAdminPoolBalance] = useState<number | null>(null)
  const [userDeedGroups, setUserDeedGroups] = useState<UserDeedGroup[]>([])
  const [filterSeller, setFilterSeller] = useState('')
  const [filterBuyer, setFilterBuyer] = useState('')
  const [filterMinPrice, setFilterMinPrice] = useState('')
  const [filterMaxPrice, setFilterMaxPrice] = useState('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('deed_transfers')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500)

        if (error) {
          if (error.code === '42P01' || error.code === 'PGRST116' || error.code === 'PGRST106') {
            setRows([])
          } else {
            throw error
          }
        } else {
          const transfers = (data || []) as any[]

          const { data: deedRows, error: deedsError } = await supabase
            .from('deeds')
            .select('id, property_id, current_owner_user_id')

          const userIds = new Set<string>()
          transfers.forEach(row => {
            if (row.seller_user_id) userIds.add(row.seller_user_id)
            if (row.buyer_user_id) userIds.add(row.buyer_user_id)
          })

          if (!deedsError && deedRows) {
            ;(deedRows as any[]).forEach(row => {
              if (row.current_owner_user_id) {
                userIds.add(row.current_owner_user_id as string)
              }
            })
          }

          let usernames = new Map<string, string>()
          if (userIds.size > 0) {
            const { data: profiles } = await supabase
              .from('user_profiles')
              .select('id, username')
              .in('id', Array.from(userIds))
            usernames = new Map(
              (profiles || []).map((p: any) => [p.id as string, p.username as string])
            )
          }

          const mapped: DeedTransferRow[] = transfers.map(row => ({
            id: row.id,
            property_id: row.property_id,
            seller_user_id: row.seller_user_id,
            buyer_user_id: row.buyer_user_id,
            sale_price: Number(row.sale_price || 0),
            deed_fee: Number(row.deed_fee || 0),
            seller_net: Number(row.seller_net || 0),
            system_value_at_sale: row.system_value_at_sale
              ? Number(row.system_value_at_sale)
              : null,
            created_at: row.created_at,
            seller_username: usernames.get(row.seller_user_id) || undefined,
            buyer_username: usernames.get(row.buyer_user_id) || undefined
          }))
          setRows(mapped)

          if (!deedsError && deedRows) {
            const groups = new Map<string, UserDeedGroup>()

            ;(deedRows as any[]).forEach(row => {
              const ownerId = row.current_owner_user_id as string | null
              if (!ownerId) return

              const existing = groups.get(ownerId)
              const deed: UserDeed = {
                deed_id: row.id as string,
                property_id: row.property_id as string
              }

              if (existing) {
                existing.deeds.push(deed)
              } else {
                groups.set(ownerId, {
                  user_id: ownerId,
                  username: usernames.get(ownerId),
                  deeds: [deed]
                })
              }
            })

            const sortedGroups = Array.from(groups.values()).sort((a, b) => {
              const an = (a.username || '').toLowerCase()
              const bn = (b.username || '').toLowerCase()
              if (an && bn) return an.localeCompare(bn)
              if (an) return -1
              if (bn) return 1
              return a.user_id.localeCompare(b.user_id)
            })

            setUserDeedGroups(sortedGroups)
          } else {
            setUserDeedGroups([])
          }
        }

        const { data: poolRow } = await supabase
          .from('admin_pool')
          .select('trollcoins_balance')
          .maybeSingle()
        if (poolRow) {
          setAdminPoolBalance(Number(poolRow.trollcoins_balance || 0))
        } else {
          setAdminPoolBalance(null)
        }
      } catch (error: any) {
        toast.error(error?.message || 'Failed to load Troll Town deeds')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      if (filterSeller) {
        const match = row.seller_username || ''
        if (!match.toLowerCase().includes(filterSeller.toLowerCase())) return false
      }
      if (filterBuyer) {
        const match = row.buyer_username || ''
        if (!match.toLowerCase().includes(filterBuyer.toLowerCase())) return false
      }
      if (filterMinPrice) {
        const min = Number(filterMinPrice)
        if (!Number.isNaN(min) && row.sale_price < min) return false
      }
      if (filterMaxPrice) {
        const max = Number(filterMaxPrice)
        if (!Number.isNaN(max) && row.sale_price > max) return false
      }
      if (filterStartDate) {
        const start = new Date(filterStartDate).getTime()
        if (new Date(row.created_at).getTime() < start) return false
      }
      if (filterEndDate) {
        const end = new Date(filterEndDate).getTime()
        if (new Date(row.created_at).getTime() > end) return false
      }
      return true
    })
  }, [rows, filterSeller, filterBuyer, filterMinPrice, filterMaxPrice, filterStartDate, filterEndDate])

  const summary = useMemo(() => {
    if (filteredRows.length === 0) {
      return {
        totalSales: 0,
        totalFees: 0,
        totalNetToSellers: 0,
        avgFeePercent: 0
      }
    }
    const totals = filteredRows.reduce(
      (acc, row) => {
        acc.totalSales += row.sale_price
        acc.totalFees += row.deed_fee
        acc.totalNetToSellers += row.seller_net
        return acc
      },
      { totalSales: 0, totalFees: 0, totalNetToSellers: 0 }
    )
    const avgFeePercent =
      totals.totalSales > 0 ? (totals.totalFees / totals.totalSales) * 100 : 0
    return {
      totalSales: totals.totalSales,
      totalFees: totals.totalFees,
      totalNetToSellers: totals.totalNetToSellers,
      avgFeePercent
    }
  }, [filteredRows])

  const hasAnomalies = useMemo(() => {
    return filteredRows.some(row => {
      if (!row.sale_price) return false
      const pct = (row.deed_fee / row.sale_price) * 100
      return pct < 8 || pct > 12
    })
  }, [filteredRows])

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Admin Dashboard
            </Link>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Home className="w-7 h-7 text-emerald-400" />
              Troll Town Deed Oversight
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              System-wide view of property transfers and deed fees. Designed for abuse monitoring.
            </p>
            {profile?.username && (
              <p className="text-xs text-slate-500 mt-1">
                Signed in as {profile.username}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3">
              <p className="text-slate-400">Total Sale Volume</p>
              <p className="text-lg font-semibold text-emerald-300">
                {summary.totalSales.toLocaleString()} TrollCoins
              </p>
            </div>
            <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3">
              <p className="text-slate-400">Total Deed Fees</p>
              <p className="text-lg font-semibold text-yellow-300">
                {summary.totalFees.toLocaleString()} TrollCoins
              </p>
            </div>
            <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3">
              <p className="text-slate-400">Admin Pool Balance</p>
              <p className="text-lg font-semibold text-emerald-300">
                {adminPoolBalance === null
                  ? '—'
                  : `${adminPoolBalance.toLocaleString()} TrollCoins`}
              </p>
            </div>
            <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3 col-span-2 sm:col-span-3 flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-slate-400">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>Average deed fee rate (filtered)</span>
                </div>
                <div className="text-xs text-slate-500">
                  Expected rate is 10%. Rows outside 8–12% are flagged.
                </div>
              </div>
              <div className="flex items-center gap-3">
                {hasAnomalies && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-400/40 text-amber-200 text-[11px] font-semibold">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Anomalies</span>
                  </div>
                )}
                <div className="text-lg font-semibold text-emerald-300">
                  {summary.avgFeePercent.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {userDeedGroups.length > 0 && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">Current Deeds by User</span>
              <span className="text-xs text-slate-500">
                Snapshot of deed ownership across Troll Town
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {userDeedGroups.map(group => (
                <div
                  key={group.user_id}
                  className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-slate-100 text-sm">
                      {group.username || group.user_id.slice(0, 6)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {group.deeds.length} deed
                      {group.deeds.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <select className="w-full px-2 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-xs text-slate-200">
                    {group.deeds.map(deed => (
                      <option key={deed.deed_id} value={deed.deed_id}>
                        Home {deed.property_id.slice(0, 6).toUpperCase()} • Deed{' '}
                        {deed.deed_id.slice(0, 6).toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Filter className="w-4 h-4 text-emerald-400" />
            <span>Filter transfers</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
            <input
              value={filterSeller}
              onChange={e => setFilterSeller(e.target.value)}
              placeholder="Filter by seller username"
              className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-emerald-500"
            />
            <input
              value={filterBuyer}
              onChange={e => setFilterBuyer(e.target.value)}
              placeholder="Filter by buyer username"
              className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-emerald-500"
            />
            <input
              value={filterMinPrice}
              onChange={e => setFilterMinPrice(e.target.value)}
              placeholder="Min sale price"
              className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-emerald-500"
            />
            <input
              value={filterMaxPrice}
              onChange={e => setFilterMaxPrice(e.target.value)}
              placeholder="Max sale price"
              className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-emerald-500"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={filterStartDate}
                onChange={e => setFilterStartDate(e.target.value)}
                className="flex-1 px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-emerald-500"
              />
              <input
                type="date"
                value={filterEndDate}
                onChange={e => setFilterEndDate(e.target.value)}
                className="flex-1 px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <div className="max-h-[520px] overflow-y-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-900/90 sticky top-0 z-10">
                  <tr className="text-slate-300">
                    <th className="px-3 py-2 text-left font-semibold">Date/Time</th>
                    <th className="px-3 py-2 text-left font-semibold">Property</th>
                    <th className="px-3 py-2 text-left font-semibold">Seller</th>
                    <th className="px-3 py-2 text-left font-semibold">Buyer</th>
                    <th className="px-3 py-2 text-right font-semibold">Sale Price</th>
                    <th className="px-3 py-2 text-right font-semibold">Deed Fee</th>
                    <th className="px-3 py-2 text-right font-semibold">Fee %</th>
                    <th className="px-3 py-2 text-right font-semibold">Seller Net</th>
                    <th className="px-3 py-2 text-right font-semibold">System Value</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-6 text-center text-slate-500"
                      >
                        Loading deeds...
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-6 text-center text-slate-500"
                      >
                        No deed transfers found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map(row => (
                      <tr
                        key={row.id}
                        className="border-t border-slate-800/80 hover:bg-slate-900/80"
                      >
                        <td className="px-3 py-2 text-slate-300">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          Home {row.property_id.slice(0, 6).toUpperCase()}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          {row.seller_username ? (
                            <ClickableUsername
                              username={row.seller_username}
                              userId={row.seller_user_id}
                              className="text-emerald-200"
                              prefix=""
                            />
                          ) : (
                            row.seller_user_id.slice(0, 6)
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          {row.buyer_username ? (
                            <ClickableUsername
                              username={row.buyer_username}
                              userId={row.buyer_user_id}
                              className="text-emerald-200"
                              prefix=""
                            />
                          ) : (
                            row.buyer_user_id.slice(0, 6)
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-300">
                          {row.sale_price.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-yellow-300">
                          {row.deed_fee.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {row.sale_price
                            ? `${((row.deed_fee / row.sale_price) * 100).toFixed(1)}%`
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-200">
                          {row.seller_net.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-300">
                          {row.system_value_at_sale
                            ? row.system_value_at_sale.toLocaleString()
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
