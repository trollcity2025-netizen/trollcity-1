// AdminResetPanel: Admin-only reset and maintenance tools
import React, { useState } from 'react'
import { useAuthStore } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { Trash2, PowerOff, Coins, AlertTriangle, Loader2 } from 'lucide-react'

export default function AdminResetPanel() {
  const { profile } = useAuthStore()
  const [loading, setLoading] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')

  if (!profile || (profile.role !== 'admin' && !profile.is_admin)) {
    return (
      <div className="bg-red-500/10 border border-red-500 rounded-xl p-6 text-red-400">
        <AlertTriangle className="w-6 h-6 mb-2" />
        <p>Admin access required</p>
      </div>
    )
  }

  const handleReset = async (action: string, actionName: string) => {
    if (confirmText !== 'RESET') {
      toast.error('Please type "RESET" to confirm')
      return
    }

    setLoading(action)
    
    // Handle reset_coin_balances with direct RPC call
    if (action === 'reset_coin_balances') {
      try {
        const { error } = await supabase.rpc("reset_coin_balances", {})

        if (error) {
          console.error('Reset error:', error)
          toast.error('Failed to reset balances.')
          return
        }

        toast.success('Coin balances reset successfully!')
      } catch (err) {
        console.error('Error Reset Coin Balances:', err)
        toast.error('Failed to reset coin balances')
      } finally {
        setLoading(null)
        setConfirmText('')
      }
      return
    }

    // Handle delete all livestreams
    if (action === 'delete_all_livestreams') {
      try {
        toast.info('Deleting all livestreams... This may take a moment.')

        // First, get count of streams to be deleted
        const { count: streamCount } = await supabase
          .from('streams')
          .select('*', { count: 'exact', head: true })

        if (streamCount === 0) {
          toast.info('No livestreams found to delete')
          setLoading(null)
          setConfirmText('')
          return
        }

        // Delete all streams
        const { error } = await supabase
          .from('streams')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all (this condition is always true)

        if (error) {
          console.error('Delete streams error:', error)
          toast.error(`Failed to delete streams: ${error.message}`)
          return
        }

        toast.success(`Successfully deleted ${streamCount} livestream${streamCount === 1 ? '' : 's'}!`)
      } catch (err: any) {
        console.error('Error deleting livestreams:', err)
        toast.error(err.message || 'Failed to delete livestreams')
      } finally {
        setLoading(null)
        setConfirmText('')
      }
      return
    }

    // Handle comprehensive app reset
    if (action === 'reset_all_for_launch') {
      try {
        toast.info('Starting comprehensive reset... This may take a moment.')

        const { data, error } = await supabase.rpc("reset_app_for_launch", {})

        if (error) {
          console.error('Reset error:', error)
          toast.error(`Failed to reset app: ${error.message}`)
          return
        }

        if (data?.success) {
          toast.success('App reset for launch completed! All test data cleared.', {
            description: JSON.stringify(data.deleted_counts || {})
          })
        } else {
          toast.error(data?.error || 'Failed to reset app')
        }
      } catch (err: any) {
        console.error('Error resetting app:', err)
        toast.error(err.message || 'Failed to reset app')
      } finally {
        setLoading(null)
        setConfirmText('')
      }
      return
    }

    // Handle other actions with edge function call
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session?.access_token || ''}`
        },
        body: JSON.stringify({ action })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to perform action')
      }

      toast.success(`${actionName} completed`, {
        description: JSON.stringify(result.deleted || result),
      })
    } catch (error: any) {
      console.error(`Error ${actionName}:`, error)
      toast.error(error.message || `Failed to ${actionName.toLowerCase()}`)
    } finally {
      setLoading(null)
      setConfirmText('')
    }
  }

  return (
    <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Reset & Maintenance</h2>
        <p className="text-gray-400 text-sm">
          ⚠️ These actions cannot be undone. Use with extreme caution.
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-semibold mb-2">
          Type "RESET" to enable buttons:
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="w-full px-4 py-2 bg-[#0A0814] border border-[#2C2C2C] rounded-lg focus:outline-none focus:border-red-500"
          placeholder="RESET"
        />
      </div>

      <div className="space-y-4">
        <button
          type="button"
          onClick={() => handleReset('reset_test_data', 'Reset Test Data')}
          disabled={loading !== null || confirmText !== 'RESET'}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {loading === 'reset_test_data' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Resetting...
            </>
          ) : (
            <>
              <Trash2 className="w-5 h-5" />
              Reset Test Data
            </>
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleReset('reset_live_streams', 'End All Live Streams')
          }}
          disabled={loading !== null || confirmText !== 'RESET'}
          className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {loading === 'reset_live_streams' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Ending streams...
            </>
          ) : (
            <>
              <PowerOff className="w-5 h-5" />
              End All Live Streams
            </>
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleReset('delete_all_livestreams', 'Delete All Livestreams')
          }}
          disabled={loading !== null || confirmText !== 'RESET'}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {loading === 'delete_all_livestreams' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Deleting streams...
            </>
          ) : (
            <>
              <Trash2 className="w-5 h-5" />
              Delete All Livestreams
            </>
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleReset('reset_coin_balances', 'Reset Coin Balances')
          }}
          disabled={loading !== null || confirmText !== 'RESET'}
          className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {loading === 'reset_coin_balances' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Resetting balances...
            </>
          ) : (
            <>
              <Coins className="w-5 h-5" />
              Reset Coin Balances
            </>
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleReset('reset_all_for_launch', 'Reset All for Launch')
          }}
          disabled={loading !== null || confirmText !== 'RESET'}
          className="w-full bg-red-700 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors border-2 border-red-500"
        >
          {loading === 'reset_all_for_launch' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Resetting all data...
            </>
          ) : (
            <>
              <Trash2 className="w-5 h-5" />
              Reset All for Launch (Transactions, Payouts, Everything)
            </>
          )}
        </button>
      </div>
    </div>
  )
}

