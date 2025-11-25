import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { History } from 'lucide-react'

export default function PayoutHistoryCard() {
  const { profile } = useAuthStore()
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => {
    if (!profile) return
    ;(async () => {
      const { data, error } = await supabase
        .from('cashout_requests')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5)
      if (!error) setRows(data || [])
    })()
  }, [profile?.id])

  return (
    <div className="bg-[#1A1A1F] border border-purple-700/40 rounded-lg p-4 mt-4">
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <History className="w-4 h-4 text-troll-gold" />
        Manual Payout Requests
      </h3>
      {rows.length === 0 && (
        <p className="text-xs text-gray-400">No payout requests yet.</p>
      )}
      <div className="space-y-1 text-xs">
        {rows.map(r => (
          <div key={r.id} className="flex justify-between border-b border-purple-500/10 py-1">
            <div>
              <div className="font-semibold">
                {r.requested_coins.toLocaleString()} Coins → ${Number(r.usd_value).toFixed(2)}
              </div>
              <div className="text-[11px] text-gray-400">
                {r.payout_method} · {r.payout_details}
              </div>
            </div>
            <div className="text-right text-[11px]">
              <div
                className={
                  r.status === 'completed'
                    ? 'text-green-400'
                    : r.status === 'paid'
                    ? 'text-purple-300'
                    : r.status === 'processing'
                    ? 'text-yellow-300'
                    : 'text-orange-300'
                }
              >
                {r.status.toUpperCase()}
              </div>
              <div className="text-gray-500">
                {new Date(r.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
