import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { CheckCircle, XCircle } from 'lucide-react'

export default function VerificationComplete() {
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const { user, refreshProfile } = useAuthStore()
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [message, setMessage] = useState('Completing verification...')

  useEffect(() => {
    const orderId = search.get('token') || search.get('orderId') || sessionStorage.getItem('verification_order_id')
    
    if (!orderId || !user) {
      setStatus('error')
      setMessage('Missing order ID or user not logged in')
      return
    }

    const completeVerification = async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        const token = session.session?.access_token

        if (!token) {
          throw new Error('Not authenticated')
        }

        const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
          'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'

        const response = await fetch(`${edgeFunctionsUrl}/verify-user-complete`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ orderId })
        })

        if (!response.ok) {
          throw new Error('Failed to complete verification')
        }

        const data = await response.json()
        
        if (data.success) {
          setStatus('success')
          setMessage('Verification successful! Your badge is now active.')
          toast.success('You are now verified!')
          
          if (refreshProfile) await refreshProfile()
          sessionStorage.removeItem('verification_order_id')
        } else {
          throw new Error(data.error || 'Verification failed')
        }
      } catch (error: any) {
        console.error('Error completing verification:', error)
        setStatus('error')
        setMessage(error?.message || 'Failed to complete verification')
        toast.error('Verification failed')
      }
    }

    completeVerification()
  }, [search, user, refreshProfile])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center p-6">
      <div className="max-w-md mx-auto bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-8 text-center">
        {status === 'pending' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold mb-2">Processing Verification</h1>
            <p>{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Verification Complete!</h1>
            <p className="opacity-80 mb-6">{message}</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
            >
              Go Home
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Verification Failed</h1>
            <p className="opacity-80 mb-6">{message}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate('/verify')}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
              >
                Go Home
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

