import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { addCoins } from '../../lib/coinTransactions'
import { toast } from 'sonner'
import { User, Search, Coins, Shield, AlertTriangle, CheckCircle, Loader2, Clock, ExternalLink } from 'lucide-react'

interface TargetUser {
  id: string
  username: string
  role: string
  troll_coins: number
  free_coin_balance: number
  is_banned?: boolean
  is_kicked?: boolean
}

type GrantType = 'paid' | 'free'

const GrantCoins: React.FC = () => {
  const { profile } = useAuthStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingUser, setLoadingUser] = useState(false)
  const [targetUser, setTargetUser] = useState<TargetUser | null>(null)
  const [grantType, setGrantType] = useState<GrantType>('free')
  const [amountInput, setAmountInput] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [grantHistory, setGrantHistory] = useState<any[]>([])
  const [historyFilter, setHistoryFilter] = useState<'all' | 'free' | 'paid'>('all')
  const isAdmin = !!profile && (profile.role === 'admin' || profile.is_admin)

  

  const loadGrantHistory = useCallback(async (userId: string) => {
    setHistoryLoading(true)
    try {
      let query = supabase
        .from('coin_transactions')
        .select('id, amount, type, coin_type, description, metadata, created_at')
        .eq('user_id', userId)
        .eq('type', 'admin_grant')
        .order('created_at', { ascending: false })
        .limit(20)

      if (historyFilter !== 'all') {
        query = query.eq('coin_type', historyFilter)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      setGrantHistory(data || [])
    } catch (err) {
      console.error('Failed to load grant history', err)
      setGrantHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [historyFilter])

  useEffect(() => {
    if (!targetUser) {
      setGrantHistory([])
      return
    }
    loadGrantHistory(targetUser.id)
  }, [targetUser, loadGrantHistory])

  const handleLookupUser = async () => {
    const query = searchTerm.trim()
    if (!query) {
      toast.error('Enter a username or user ID')
      return
    }

    setLoadingUser(true)
    setTargetUser(null)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, role, troll_coins, free_coin_balance, is_banned, is_kicked')
        .or(`id.eq.${query},username.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        toast.error('No matching user found')
        return
      }

      const row = data[0] as any
      setTargetUser({
        id: row.id,
        username: row.username,
        role: row.role,
        troll_coins: row.troll_coins || 0,
        free_coin_balance: row.free_coin_balance || 0,
        is_banned: row.is_banned,
        is_kicked: row.is_kicked
      })
    } catch (err) {
      console.error('Failed to lookup user', err)
      toast.error('Failed to lookup user')
    } finally {
      setLoadingUser(false)
    }
  }

  const handleSubmit = async () => {
    if (!targetUser) {
      toast.error('Select a user first')
      return
    }

    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      toast.error('Enter a reason for the grant')
      return
    }

    const amount = Number(amountInput)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a positive coin amount')
      return
    }

    setSubmitting(true)
    try {
      if (grantType === 'paid') {
        const result = await addCoins({
          userId: targetUser.id,
          amount: Math.round(amount),
          type: 'admin_grant',
          coinType: 'troll_coins',
          description: trimmedReason,
          metadata: {
            admin_reason: trimmedReason,
            admin_username: profile.username,
            admin_id: profile.id,
            source: 'grant_coins_panel'
          }
        })

        if (!result.success) {
          throw new Error(result.error || 'Failed to grant paid coins')
        }

        setTargetUser({
          ...targetUser,
          troll_coins: result.newBalance as number
        })
      } else {
        const { error } = await supabase.rpc('add_free_coins', {
          p_user_id: targetUser.id,
          p_amount: Math.round(amount)
        })

        if (error) {
          throw error
        }

        const { data, error: reloadError } = await supabase
          .from('user_profiles')
          .select('free_coin_balance')
          .eq('id', targetUser.id)
          .single()

        if (!reloadError && data) {
          setTargetUser({
            ...targetUser,
            free_coin_balance: data.free_coin_balance || 0
          })
        }
      }

      toast.success('Coins granted successfully')
      setAmountInput('')
      setReason('')
      loadGrantHistory(targetUser.id)
    } catch (err: any) {
      console.error('Failed to grant coins', err)
      toast.error(err?.message || 'Failed to grant coins')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      {!isAdmin ? (
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-2">Admin Only</h1>
          <p className="text-gray-400 text-sm">
            This tool is restricted to Administrators. Please contact an Admin for access.
          </p>
        </div>
      ) : (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center">
            <Coins className="w-6 h-6 text-yellow-300" />
          </div>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              Grant Coins
              <Shield className="w-6 h-6 text-purple-400" />
            </h1>
            <p className="text-sm text-gray-400">
              Safely grant free or paid coins to a user with full audit trail.
            </p>
          </div>
        </div>

        <div className="bg-black/60 border border-purple-600/30 rounded-xl p-6 space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-300">
              Target user
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by username or user ID"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                type="button"
                onClick={handleLookupUser}
                disabled={loadingUser}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-sm font-semibold flex items-center gap-2"
              >
                {loadingUser && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Lookup</span>
              </button>
            </div>
            {targetUser && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900/80 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-purple-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{targetUser.username}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-gray-300 border border-zinc-600">
                        {targetUser.role || 'user'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      Paid: <span className="text-purple-300">{targetUser.troll_coins.toLocaleString()} coins</span>{' '}
                      • Free:{' '}
                      <span className="text-green-300">
                        {targetUser.free_coin_balance.toLocaleString()} coins
                      </span>
                    </div>
                  </div>
                </div>
                {(targetUser.is_banned || targetUser.is_kicked) && (
                  <div className="flex items-center gap-1 text-xs text-red-300">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{targetUser.is_banned ? 'Banned' : 'Kicked'}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-300">
                Coin type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGrantType('free')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                    grantType === 'free'
                      ? 'bg-green-600/30 border-green-400 text-green-300'
                      : 'bg-zinc-900 border-zinc-700 text-gray-300'
                  }`}
                >
                  Free coins
                </button>
                <button
                  type="button"
                  onClick={() => setGrantType('paid')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                    grantType === 'paid'
                      ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                      : 'bg-zinc-900 border-zinc-700 text-gray-300'
                  }`}
                >
                  Paid coins
                </button>
              </div>
              <p className="text-xs text-gray-400">
                Free coins are eligible for payouts; paid coins are store currency.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-300">
                Amount
              </label>
              <input
                type="number"
                min="1"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g. 5000"
              />
              <p className="text-xs text-gray-400">
                Large grants may impact platform liability. Double-check before sending.
              </p>
            </div>

            <div className="space-y-2 md:col-span-1">
              <label className="block text-sm font-semibold text-gray-300">
                Reason
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                placeholder="Short explanation for the audit log"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>
                All grants are recorded with admin ID and reason for compliance review.
              </span>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !targetUser}
              className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-sm font-semibold flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                Grant {grantType === 'free' ? 'Free' : 'Paid'} Coins
              </span>
            </button>
          </div>
        </div>

        {targetUser && (
          <div className="bg-black/50 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-300" />
                <h2 className="text-lg font-semibold text-white">
                  Recent Admin Grants
                </h2>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-700">
                  {(['all', 'free', 'paid'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setHistoryFilter(filter)}
                      className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                        historyFilter === filter
                          ? 'bg-zinc-700 text-white shadow-sm'
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                <a
                  href={`/transactions?userId=${targetUser.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  <span>View full history</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="text-xs text-gray-400">
              {historyLoading
                ? 'Loading history...'
                : grantHistory.length === 0
                ? 'No admin grants found'
                : `Showing last ${grantHistory.length} grants`}
            </div>

            {grantHistory.length > 0 && (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {grantHistory.map((tx) => {
                  const isFree = tx.coin_type === 'free'
                  const adminReason = tx.metadata?.admin_reason || tx.description || 'Admin grant'
                  const createdAt = tx.created_at
                    ? new Date(tx.created_at).toLocaleString()
                    : ''

                  return (
                    <div
                      key={tx.id}
                      className="flex items-start justify-between rounded-lg border border-zinc-700 bg-zinc-900/70 px-4 py-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">
                            {isFree ? 'Free coins' : 'Paid coins'}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              isFree
                                ? 'bg-green-500/15 text-green-300 border border-green-500/30'
                                : 'bg-purple-500/15 text-purple-200 border border-purple-500/30'
                            }`}
                          >
                            {tx.amount > 0 ? '+' : ''}
                            {tx.amount.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xs text-gray-300 mt-1">
                          {adminReason}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">
                          {createdAt}
                        </div>
                      </div>
                      {tx.metadata?.admin_username && (
                        <div className="text-xs text-gray-400 text-right">
                          <div>By {tx.metadata.admin_username}</div>
                          {tx.metadata.admin_id && (
                            <div className="text-[11px] text-gray-500">
                              {tx.metadata.admin_id}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  )
}

export default GrantCoins
