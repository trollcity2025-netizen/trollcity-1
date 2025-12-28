import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../lib/store'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

const PaymentCallback = () => {
  const { user, profile, setProfile, refreshProfile } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('Processing payment...')
  const [coinsAwarded, setCoinsAwarded] = useState<number | null>(null)

  useEffect(() => {
    const processPayment = async () => {
      if (!user) {
        toast.error('Please sign in')
        navigate('/auth')
        return
      }

      const params = new URLSearchParams(location.search)
      const orderId = params.get('token') || params.get('orderId') || params.get('paymentId')
      const payerId = params.get('PayerID')
      const userId = params.get('userId')
      
      // Verify user matches if userId is provided
      if (userId && userId !== user.id) {
        setStatus('error')
        setMessage('User mismatch. Please contact support.')
        toast.error('User mismatch')
        return
      }

      // If we have an orderId, complete the payment
      if (orderId) {
        try {
          setStatus('processing')
          setMessage('Completing payment...')

          const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTION_URL}/paypal-complete-order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`
            },
            body: JSON.stringify({
              user_id: user.id,
              paypal_order_id: orderId
            })
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Payment failed' }))
            throw new Error(errorData.error || errorData.message || 'Payment failed')
          }

          const result = await response.json()

          if (!result.success) {
            throw new Error(result.error || 'Payment failed')
          }

          // Success!
          setStatus('success')
          setCoinsAwarded(result.coins_awarded || result.coinsAdded || null)
          
          // Handle Empire Partner fee payment
          if (result.type === 'empire_partner_fee') {
            setMessage('Empire Partner application fee paid successfully! Your application is pending admin review.')
            toast.success('Application fee paid! Your application is pending review.')
            
            // Refresh application status
            setTimeout(() => {
              navigate('/empire-partner-apply')
            }, 2000)
          } else {
            setMessage(result.coins_awarded 
              ? `Payment successful! ${result.coins_awarded.toLocaleString()} coins added to your account.`
              : 'Payment successful!'
            )
            toast.success(`Purchase complete! +${(result.coins_awarded || result.coinsAdded || 0).toLocaleString()} coins added`)
          }

          // Refresh profile to get updated balance
          if (refreshProfile) {
            await refreshProfile()
          } else {
            // Fallback: manually refresh profile
            const { data: updatedProfile } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', user.id)
              .single()
            
            if (updatedProfile && setProfile) {
              setProfile(updatedProfile)
            }
          }

        } catch (error: any) {
          console.error('Payment callback error:', error)
          setStatus('error')
          setMessage(error.message || 'Payment processing failed. Please contact support if you were charged.')
          toast.error(error.message || 'Payment failed')
        }
      } else {
        // No orderId - might be a cancel or error
        const cancel = params.get('cancel')
        const error = params.get('error')
        
        if (cancel === 'true' || error) {
          setStatus('error')
          setMessage(error || 'Payment was cancelled.')
          toast.info('Payment cancelled')
        } else {
          // Missing required parameters
          setStatus('error')
          setMessage('Invalid payment callback. Missing order information.')
          toast.error('Invalid payment callback')
        }
      }
    }

    processPayment()
  }, [location.search, navigate, user, refreshProfile, setProfile])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
      <div className="bg-[#1A1A1A] rounded-lg p-8 border border-[#2C2C2C] w-full max-w-md text-center shadow-xl">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold mb-4">Processing Payment</h1>
            <p className="text-[#E2E2E2]/80 mb-6">{message}</p>
            <p className="text-sm text-gray-500">Please wait...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold mb-4 text-green-400">Payment Successful!</h1>
            <p className="text-[#E2E2E2]/80 mb-4">{message}</p>
            {coinsAwarded && (
              <div className="bg-purple-900/30 border border-purple-600/50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-400">Coins Added</p>
                <p className="text-3xl font-bold text-purple-400">{coinsAwarded.toLocaleString()}</p>
                {profile && (
                  <p className="text-sm text-gray-500 mt-2">
                    New Balance: {((profile.troll_coins || 0) + coinsAwarded).toLocaleString()} coins
                  </p>
                )}
              </div>
            )}
            <button
              onClick={() => navigate('/store')}
              className="w-full py-2 bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white font-semibold rounded hover:shadow-lg transition"
            >
              Continue Shopping
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="w-full py-2 mt-3 bg-[#23232b] border border-gray-600 text-white font-semibold rounded hover:bg-[#23232b]/80 transition"
            >
              Go to Profile
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold mb-4 text-red-400">Payment Issue</h1>
            <p className="text-[#E2E2E2]/80 mb-6">{message}</p>
            <button
              onClick={() => navigate('/store')}
              className="w-full py-2 bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white font-semibold rounded hover:shadow-lg transition"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="w-full py-2 mt-3 bg-[#23232b] border border-gray-600 text-white font-semibold rounded hover:bg-[#23232b]/80 transition"
            >
              Go to Profile
            </button>
            <p className="text-xs text-gray-500 mt-4">
              If you were charged but didn't receive coins, please contact support with your order ID.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default PaymentCallback

