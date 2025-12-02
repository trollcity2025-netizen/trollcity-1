import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { CreditCard, CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react'
import api from '../lib/api'

// Square Web Payments SDK types
declare global {
  interface Window {
    Square: any
  }
}

export default function AddCard() {
  const { user, profile, setProfile } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [squareLoaded, setSquareLoaded] = useState(false)
  const [cardElement, setCardElement] = useState<any>(null)
  const [payments, setPayments] = useState<any>(null)
  const cardContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) {
      navigate('/auth')
      return
    }

    loadSquareSDK()
  }, [user])

  const loadSquareSDK = async () => {
    try {
      // Check if Square SDK is already loaded
      if (window.Square) {
        initializeSquare()
        return
      }

      // Load Square Web Payments SDK (use sandbox or production based on env)
      const squareEnv = import.meta.env.VITE_SQUARE_ENVIRONMENT || 'sandbox'
      const squareSDKUrl = squareEnv === 'production' 
        ? 'https://web.squarecdn.com/v1/square.js'
        : 'https://sandbox.web.squarecdn.com/v1/square.js'
      
      const script = document.createElement('script')
      script.src = squareSDKUrl
      script.type = 'text/javascript'
      script.async = true
      script.onload = () => {
        console.log('Square SDK loaded')
        initializeSquare()
      }
      script.onerror = () => {
        console.error('Failed to load Square SDK')
        toast.error('Failed to load payment system')
      }
      document.body.appendChild(script)
    } catch (error) {
      console.error('Error loading Square SDK:', error)
      toast.error('Failed to load payment system')
    }
  }

  const initializeSquare = async () => {
    try {
      if (!window.Square) {
        console.error('Square SDK not available')
        return
      }

      // Get Square application ID from environment
      const appId = import.meta.env.VITE_SQUARE_APPLICATION_ID
      if (!appId) {
        console.error('Square Application ID not configured')
        toast.error('Payment system not configured')
        return
      }

      // Initialize Square Payments
      const paymentsInstance = window.Square.payments(appId, import.meta.env.VITE_SQUARE_LOCATION_ID || '')
      
      // Create card element
      const card = await paymentsInstance.card()
      
      // Mount card element
      if (cardContainerRef.current) {
        await card.attach(cardContainerRef.current)
        setCardElement(card)
        setPayments(paymentsInstance)
        setSquareLoaded(true)
        console.log('Square card element initialized')
      }
    } catch (error: any) {
      console.error('Error initializing Square:', error)
      toast.error('Failed to initialize payment form')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !cardElement || !payments) {
      toast.error('Payment form not ready')
      return
    }

    setLoading(true)
    try {
      // Tokenize the card
      const tokenResult = await cardElement.tokenize()
      
      if (tokenResult.status === 'OK') {
        const cardNonce = tokenResult.token

        // Send nonce to backend to vault the card
        console.log('[AddCard] Sending card nonce to backend...')
        const response = await api.post('/payments', {
          userId: user.id,
          nonce: cardNonce
        })

        console.log('[AddCard] Response received:', response)

        // Check if response indicates a network error
        if (!response.success && response.error && (response.error.includes('Failed to connect') || response.error.includes('Network error') || response.error.includes('fetch'))) {
          const apiUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'
          const fullUrl = `${apiUrl}/add-card`
          
          console.error('[AddCard] Network error in response:', {
            error: response.error,
            debug: response.debug,
            fullUrl
          })
          
          toast.error('Failed to connect to server', {
            description: response.error || 'Network error occurred. Please check your connection and try again.',
            duration: 8000
          })
          return
        }

        if (response.success && response.cardId) {
          // Update profile with card info
          const { data: updatedProfile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single()

          if (updatedProfile) {
            setProfile(updatedProfile as any)
          }

          toast.success('Card successfully added!')
          
          // Redirect back to coin store or previous page
          setTimeout(() => {
            navigate('/store')
          }, 1500)
        } else {
          // Log detailed error information
          console.error('[AddCard] API response error:', {
            success: response.success,
            error: response.error,
            fullResponse: response,
            debug: response.debug
          })
          
          // Check for missing secrets
          if (response.missingSecrets) {
            const missing = response.missingSecrets.join(', ')
            toast.error(`Missing Square credentials: ${missing}`, {
              description: 'Please contact support or check admin dashboard.',
              duration: 8000
            })
            return
          }
          
          throw new Error(response.error || 'Failed to add card')
        }
      } else {
        // Handle tokenization errors
        const errors = tokenResult.errors || []
        const errorMessage = errors[0]?.message || 'Failed to process card'
        throw new Error(errorMessage)
      }
    } catch (error: any) {
      console.error('Error adding card:', error)
      
      // Check if it's a network/fetch error from the API client
      const isNetworkError = error.message?.includes('fetch') || 
                            error.message?.includes('Failed to fetch') || 
                            error.message?.includes('Network error') ||
                            (error.debug && error.debug.message?.includes('fetch'))
      
      if (isNetworkError) {
        const apiUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'
        const fullUrl = `${apiUrl}/add-card`
        
        console.error('[AddCard] Network error details:', {
          apiUrl,
          endpoint: '/add-card',
          fullUrl,
          error: error.message,
          debug: error.debug,
          errorObject: error
        })
        
        // Check if response has error details
        if (error.debug) {
          toast.error('Failed to connect to server', {
            description: `Error: ${error.debug.message || error.message}\n\nURL: ${fullUrl}\n\nPossible causes:\n1. Edge function not accessible\n2. CORS issue\n3. Network connectivity problem\n\nCheck browser console for details.`,
            duration: 8000
          })
        } else {
          toast.error('Failed to connect to server. Please check your internet connection and try again.', {
            description: `API URL: ${fullUrl}`,
            duration: 5000
          })
        }
        return
      }
      
      // Parse Square error codes
      let errorMessage = error.message || 'Failed to add card'
      if (error.errorCode) {
        switch (error.errorCode) {
          case 'CARD_DECLINED':
            errorMessage = 'Card was declined. Please try a different card.'
            break
          case 'INSUFFICIENT_FUNDS':
            errorMessage = 'Insufficient funds. Please use a different card.'
            break
          case 'CARD_EXPIRED':
            errorMessage = 'Card has expired. Please use a different card.'
            break
          case 'INVALID_CARD':
            errorMessage = 'Invalid card details. Please check and try again.'
            break
        }
      }
      
      // Check for response error
      if (error.error) {
        errorMessage = error.error
      }
      
      toast.error(errorMessage, {
        description: error.debug ? `Request ID: ${error.debug.requestId}` : undefined,
        duration: 5000
      })
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-3 mb-2">
            <CreditCard className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold">Add Payment Card</h1>
          </div>
          <p className="text-gray-400">Securely store your card for faster checkout</p>
        </div>

        {/* Card Form */}
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-8">
          {!squareLoaded ? (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Loading payment form...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Card Element Container */}
              <div>
                <label className="block text-sm font-semibold mb-2">Card Details</label>
                <div
                  ref={cardContainerRef}
                  id="card-container"
                  className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4 min-h-[60px]"
                />
                <p className="text-xs text-gray-400 mt-2">
                  Your card details are securely processed by Square. We never store your full card number.
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Add Card
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Security Info */}
        <div className="mt-6 bg-[#141414] border border-[#2C2C2C] rounded-xl p-6">
          <h3 className="font-semibold mb-3">Security & Privacy</h3>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <span>PCI compliant - We never store your full card number</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <span>Card details are encrypted and secured by Square</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <span>You can remove your card anytime from account settings</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

