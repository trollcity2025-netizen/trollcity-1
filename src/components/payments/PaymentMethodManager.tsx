import React, { useState, useEffect, useCallback, useRef } from 'react'
import { CreditCard, Loader2, CheckCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'

const PROVIDER_SQUARE = 'square'

type SquarePayments = {
  cashAppPay: (options: any) => Promise<any>
}

declare global {
  interface Window {
    Square?: { payments: (appId: string, locationId: string) => SquarePayments }
  }
}

export default function PaymentMethodManager({
  title = 'Payment Methods',
  description = 'Manage your saved payment methods for faster checkout.'
}: PaymentMethodManagerProps) {
  const { profile } = useAuthStore()

  const [methods, setMethods] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState(false)
  const [squareLoading, setSquareLoading] = useState(false)
  const [squareAttached, setSquareAttached] = useState(false)
  const [setupCounter, setSetupCounter] = useState(0)

  const cashAppPayRef = useRef<any>(null)

  const loadMethods = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('user_payment_methods')
        .select('*')
        .eq('user_id', profile.id)
        .order('is_default', { ascending: false })

      if (error) throw error
      setMethods(data || [])
    } catch (err: any) {
      console.error('Load methods failed', err)
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    loadMethods()
  }, [loadMethods])

  useEffect(() => {
    const initSquare = async () => {
      if (!profile?.id) return
      if (squareAttached) return

      const appId = import.meta.env.VITE_SQUARE_APPLICATION_ID
      const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID
      const env = import.meta.env.VITE_SQUARE_ENVIRONMENT || 'sandbox'

      if (!appId || !locationId) {
        console.warn('Square not configured')
        return
      }

      setSquareLoading(true)
      try {
        const sdkUrl = env === 'production'
          ? 'https://web.squarecdn.com/v1/square.js'
          : 'https://sandbox.web.squarecdn.com/v1/square.js'

        if (!window.Square) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            script.src = sdkUrl
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('Failed to load Square SDK'))
            document.body.appendChild(script)
          })
        }

        const payments = window.Square?.payments?.(appId, locationId)
        if (!payments) throw new Error('Square failed to initialize')

        const cashAppPay = await payments.cashAppPay({
          redirectURL: window.location.href,
          referenceId: `tc_setup_${profile.id}_${Date.now()}`
        })

        const container = document.getElementById('cash-app-pay-element')
        if (!container) throw new Error('Cash App container not found')

        container.innerHTML = ''
        await cashAppPay.attach('#cash-app-pay-element')

        cashAppPay.addEventListener('ontokenization', async (event: any) => {
          const { token, errors } = event.detail
          if (errors) {
            console.error('CashApp tokenization error:', errors)
            toast.error(errors[0]?.message || 'Failed to connect Cash App')
            return
          }

          setLinking(true)
          try {
            const { data, error } = await supabase.functions.invoke('add-card', {
              body: {
                userId: profile.id,
                cardNonce: token,
                provider: PROVIDER_SQUARE
              }
            })

            if (error) throw error
            if (!data?.success) throw new Error(data?.error || 'Failed to save card')

            toast.success('Cash App connected successfully!')
            await loadMethods()
            setSetupCounter((c) => c + 1)
          } catch (err: any) {
            toast.error(err?.message || 'Linking failed')
          } finally {
            setLinking(false)
          }
        })

        cashAppPayRef.current = cashAppPay
        setSquareAttached(true)
      } catch (err: any) {
        console.error('Square setup error:', err)
      } finally {
        setSquareLoading(false)
      }
    }

    initSquare()

    return () => {
      if (cashAppPayRef.current) {
        try {
          cashAppPayRef.current.destroy()
        } catch {}
        cashAppPayRef.current = null
      }
      setSquareAttached(false)
    }
  }, [profile?.id, setupCounter, loadMethods])

  const remove = async (id: string) => {
    if (!profile) return

    const backup = methods
    setMethods((old) => old.filter((m) => m.id !== id))

    try {
      const { error } = await supabase
        .from('user_payment_methods')
        .delete()
        .eq('id', id)
        .eq('user_id', profile.id)

      if (error) throw error
      toast.success('Payment method removed')
    } catch (err: any) {
      setMethods(backup)
      toast.error(err?.message || 'Remove failed')
    }
  }

  const setDefault = async (id: string) => {
    if (!profile) return

    try {
      await supabase
        .from('user_payment_methods')
        .update({ is_default: false })
        .eq('user_id', profile.id)
        .neq('id', id)

      const { error } = await supabase
        .from('user_payment_methods')
        .update({ is_default: true })
        .eq('id', id)

      if (error) throw error

      setMethods((old) => old.map((x) => ({ ...x, is_default: x.id === id })))
      toast.success('Default payment method updated')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to set default')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-gray-400">{description}</p>
      </div>

      {/* Saved Payment Methods */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-400">Saved Methods</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : methods.length === 0 ? (
          <p className="text-sm text-gray-500">No saved payment methods</p>
        ) : (
          <div className="space-y-2">
            {methods.map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between p-4 bg-[#121212] rounded-lg border border-[#2C2C2C]"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    method.provider === PROVIDER_SQUARE ? 'bg-black' : 'bg-blue-600'
                  }`}>
                    {method.provider === PROVIDER_SQUARE ? (
                      <span className="text-white text-lg">💲</span>
                    ) : (
                      <CreditCard className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-white">
                      {method.brand || 'Cash App'} •••• {method.last4 || '****'}
                    </div>
                    {method.is_default && (
                      <span className="text-xs text-green-400">Default</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!method.is_default && (
                    <button
                      onClick={() => setDefault(method.id)}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => remove(method.id)}
                    className="p-2 text-gray-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New Payment Method */}
      <div className="p-6 bg-[#121212] rounded-lg border border-[#2C2C2C]">
        <h3 className="text-lg font-bold text-white mb-4">Add Payment Method</h3>
        
        <div id="cash-app-pay-element" className="min-h-[100px]">
          {squareLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              <span className="ml-2 text-gray-400">Loading payment options...</span>
            </div>
          )}
        </div>

        {linking && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-green-400" />
            <span className="ml-2 text-green-400">Connecting your account...</span>
          </div>
        )}
      </div>
    </div>
  )
}