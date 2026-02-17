import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { trollCityTheme } from '@/styles/trollCityTheme'
import { useAuthStore } from '@/lib/store'

interface RentPayerRow {
  user_id: string
  username: string
  avatar_url: string | null
  on_time_payments: number
}

interface TopRentPayersWidgetProps {
  onRequireAuth: (intent?: string) => boolean
}

export default function TopRentPayersWidget({ onRequireAuth }: TopRentPayersWidgetProps) {
  const [rows, setRows] = useState<RentPayerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(true)
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    let mounted = true

    const fetchTopRentPayers = async () => {
      if (!user) {
        setHasAccess(false)
        setLoading(false)
        return
      }
      try {
        const { data: logs, error } = await supabase
          .from('rent_payment_log')
          .select('tenant_id, paid_at')
          .order('paid_at', { ascending: false })
          .limit(250)

        if (error) throw error

        const payments = (logs || []).reduce<Record<string, number>>((acc, log: any) => {
          if (!log.tenant_id) return acc
          acc[log.tenant_id] = (acc[log.tenant_id] || 0) + 1
          return acc
        }, {})

        const topIds = Object.entries(payments)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id]) => id)

        if (topIds.length === 0) {
          if (mounted) setRows([])
          return
        }

        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .in('id', topIds)

        if (profileError) throw profileError

        const nextRows = topIds.map((id) => {
          const profile = profiles?.find((p) => p.id === id)
          return {
            user_id: id,
            username: profile?.username || 'Unknown',
            avatar_url: profile?.avatar_url || null,
            on_time_payments: payments[id] || 0
          }
        })

        if (mounted) {
          setRows(nextRows)
          setHasAccess(true)
        }
      } catch (err) {
        console.error('Error fetching rent payers:', err)
        if (mounted) {
          setRows([])
          setHasAccess(false)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchTopRentPayers()
    return () => {
      mounted = false
    }
  }, [user])

  return (
    <div
      className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-2xl p-4`}
      onClick={() => onRequireAuth('view Top Rent Payers')}
    >
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="h-5 w-5 text-emerald-300" />
        <h3 className="text-lg font-semibold text-white">Top Rent Payers</h3>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-white/60">
          {hasAccess ? 'No rent payment data yet.' : 'Sign in to see the leaderboard.'}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={row.user_id} className="flex items-center gap-3">
              <div className="text-xs text-white/40 w-4">{index + 1}</div>
              <div className="h-9 w-9 rounded-full overflow-hidden bg-white/5">
                {row.avatar_url ? (
                  <img src={row.avatar_url} alt={row.username} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xs text-white/60">
                    {row.username?.[0]?.toUpperCase() || 'T'}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{row.username}</p>
                <p className="text-xs text-white/40">On-time payments: {row.on_time_payments}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
