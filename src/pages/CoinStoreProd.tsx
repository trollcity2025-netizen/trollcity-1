// src/pages/CoinStoreProd.tsx
// Production-ready PayPal coin purchase component
import React, { useState, useEffect } from 'react'
import { PayPalScriptProvider, PayPalButtons, usePayPalScriptReducer } from '@paypal/checkout-js'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Loader2, AlertCircle, CheckCircle, Coins } from 'lucide-react'

interface CoinPackage {
  id: string
  name: string
  coins: number
  price_usd: number
  paypal_sku: string
  is_active: boolean
}

interface CaptureResponse {
  success: boolean
  coinsAdded: number
  orderId: string
  captureId: string
  error?: string
}

// Coin package data (mirrors database)
const COIN_PACKAGES: CoinPackage[] = [
  { id: '1', name: 'Bronze Pack', coins: 1000, price_usd: 4.49, paypal_sku: 'coins_1000', is_active: true },
  { id: '2', name: 'Silver Pack', coins: 5000, price_usd: 20.99, paypal_sku: 'coins_5000', is_active: true },
  { id: '3', name: 'Gold Pack', coins: 12000, price_usd: 49.99, paypal_sku: 'coins_12000', is_active: true },
  { id: '4', name: 'Platinum Pack', coins: 25000, price_usd: 99.99, paypal_sku: 'coins_25000', is_active: true },
  { id: '5', name: 'Diamond Pack', coins: 60000, price_usd: 239.99, paypal_sku: 'coins_60000', is_active: true },
  { id: '6', name: 'Legendary Pack', coins: 120000, price_usd: 459.99, paypal_sku: 'coins_120000', is_active: true },
]

interface PayPalButtonsProps {
  selectedPackage: CoinPackage | null
  onApprove: (details: any) => Promise<void>
}

const PayPalButtonsWrapper: React.FC<PayPalButtonsProps> = ({ selectedPackage, onApprove }) => {
  const [{ options }, dispatch] = usePayPalScriptReducer()
  const [isProcessing, setIsProcessing] = useState(false)
  const { user } = useAuthStore()

  if (!selectedPackage || !user) {
    return <div className="text-gray-400">Please select a package</div>
  }

  return (
    <div className="mt-4">
      <PayPalButtons
        fundingSource="paypal"
        createOrder={async () => {
          try {
            setIsProcessing(true)

            // Call edge function to create PayPal order
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-create-order`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                },
                body: JSON.stringify({
                  packageId: selectedPackage.id,
                }),
              }
            )

            if (!response.ok) {
              const error = await response.json()
              throw new Error(error.error || 'Failed to create order')
            }

            const data = await response.json()
            return data.orderId
          } catch (error) {
            console.error('Create order error:', error)
            toast.error(error instanceof Error ? error.message : 'Failed to create order')
            throw error
          } finally {
            setIsProcessing(false)
          }
        }}
        onApprove={async (data: any) => {
          try {
            setIsProcessing(true)
            await onApprove(data)
          } catch (error) {
            console.error('Approval error:', error)
            toast.error(error instanceof Error ? error.message : 'Payment approval failed')
          } finally {
            setIsProcessing(false)
          }
        }}
        onError={(error) => {
          console.error('PayPal error:', error)
          toast.error('PayPal payment failed')
        }}
        style={{
          layout: 'vertical',
          color: 'white',
          shape: 'rect',
          label: 'checkout',
        }}
      />
    </div>
  )
}

export default function CoinStoreProd() {
  const { user, profile, setProfile } = useAuthStore()
  const [selectedPackage, setSelectedPackage] = useState<CoinPackage | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [packages, setPackages] = useState<CoinPackage[]>(COIN_PACKAGES)
  const [transactionStatus, setTransactionStatus] = useState<{
    status: 'idle' | 'processing' | 'success' | 'error'
    message?: string
  }>({ status: 'idle' })

  // Load packages from database
  useEffect(() => {
    const loadPackages = async () => {
      try {
        const { data, error } = await supabase
          .from('coin_packages')
          .select('*')
          .eq('is_active', true)
          .order('price_usd', { ascending: true })

        if (error) throw error
        if (data) {
          setPackages(data)
        }
      } catch (error) {
        console.error('Failed to load packages:', error)
        // Fall back to hardcoded packages
      }
    }

    loadPackages()
  }, [])

  const handlePayPalApprove = async (orderDetails: any) => {
    if (!selectedPackage || !user) {
      toast.error('Invalid transaction state')
      return
    }

    try {
      setTransactionStatus({ status: 'processing', message: 'Processing payment...' })
      setIsProcessing(true)

      // Get current auth token
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token

      if (!token) {
        throw new Error('Not authenticated')
      }

      // Call capture edge function
      const captureResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-capture-order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            orderId: orderDetails.orderID,
          }),
        }
      )

      const captureData = (await captureResponse.json()) as CaptureResponse

      if (!captureResponse.ok) {
        throw new Error(captureData.error || 'Failed to capture payment')
      }

      if (!captureData.success) {
        throw new Error('Payment capture failed')
      }

      // Update local profile state
      if (profile) {
        setProfile({
          ...profile,
          troll_coins: (profile.troll_coins || 0) + captureData.coinsAdded,
          paid_coins: (profile.paid_coins || 0) + captureData.coinsAdded,
        })
      }

      // Refresh profile from database
      await new Promise(resolve => setTimeout(resolve, 1000))
      const { data: freshProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (freshProfile) {
        setProfile(freshProfile)
      }

      setTransactionStatus({
        status: 'success',
        message: `Successfully credited ${captureData.coinsAdded.toLocaleString()} coins!`,
      })

      toast.success(`+${captureData.coinsAdded.toLocaleString()} coins credited to your account!`)

      // Reset selection after 3 seconds
      setTimeout(() => {
        setSelectedPackage(null)
        setTransactionStatus({ status: 'idle' })
      }, 3000)
    } catch (error) {
      console.error('Payment capture error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Payment processing failed'

      setTransactionStatus({
        status: 'error',
        message: errorMessage,
      })

      toast.error(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6 flex items-center justify-center">
        <div className="bg-[#1A1A24] border border-gray-700 rounded-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
          <p>Please sign in to purchase coins</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Coins className="w-8 h-8 text-purple-500" />
            Purchase Coins
          </h1>
          <p className="text-gray-400">
            Current balance: <span className="text-purple-400 font-semibold">{(profile?.troll_coins || 0).toLocaleString()}</span> coins
          </p>
        </div>

        {/* Status Messages */}
        {transactionStatus.status === 'processing' && (
          <div className="mb-6 bg-blue-900/20 border border-blue-500/50 rounded-lg p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            <p className="text-blue-200">{transactionStatus.message}</p>
          </div>
        )}

        {transactionStatus.status === 'success' && (
          <div className="mb-6 bg-green-900/20 border border-green-500/50 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <p className="text-green-200">{transactionStatus.message}</p>
          </div>
        )}

        {transactionStatus.status === 'error' && (
          <div className="mb-6 bg-red-900/20 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-200">{transactionStatus.message}</p>
          </div>
        )}

        {/* Coin Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              onClick={() => setSelectedPackage(pkg)}
              className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all ${
                selectedPackage?.id === pkg.id
                  ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/50'
                  : 'border-gray-700 bg-[#1A1A24] hover:border-purple-500/50'
              }`}
            >
              {/* Popular Badge */}
              {(pkg.price_usd === 49.99 || pkg.price_usd === 99.99) && (
                <div className="absolute -top-3 right-4 bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                  Popular
                </div>
              )}

              <h3 className="text-lg font-bold mb-2">{pkg.name}</h3>
              <div className="mb-4">
                <p className="text-3xl font-bold text-purple-400">{pkg.coins.toLocaleString()}</p>
                <p className="text-gray-400 text-sm">coins</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-2xl font-bold">${pkg.price_usd.toFixed(2)}</p>
                <p className="text-gray-400 text-sm">
                  ${(pkg.price_usd / pkg.coins * 1000).toFixed(2)}/K
                </p>
              </div>

              {selectedPackage?.id === pkg.id && (
                <div className="mt-4 pt-4 border-t border-purple-500/50">
                  <p className="text-sm text-purple-300 font-semibold mb-3">Selected Package</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* PayPal Checkout */}
        {selectedPackage && (
          <div className="bg-[#1A1A24] border border-purple-500/30 rounded-xl p-8 max-w-md mx-auto">
            <h2 className="text-xl font-bold mb-4">Complete Purchase</h2>
            <p className="text-gray-400 mb-6">
              {selectedPackage.name} • {selectedPackage.coins.toLocaleString()} coins • ${selectedPackage.price_usd.toFixed(2)}
            </p>

            <PayPalScriptProvider
              options={{
                clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID,
                currency: 'USD',
              }}
            >
              <PayPalButtonsWrapper
                selectedPackage={selectedPackage}
                onApprove={handlePayPalApprove}
              />
            </PayPalScriptProvider>

            <button
              onClick={() => setSelectedPackage(null)}
              className="w-full mt-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Security Notice */}
        <div className="mt-12 max-w-2xl mx-auto bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <p className="text-sm text-blue-200">
            ✓ Payments secured by PayPal • ✓ Coins credited server-side • ✓ Fraud protection enabled
          </p>
        </div>
      </div>
    </div>
  )
}
