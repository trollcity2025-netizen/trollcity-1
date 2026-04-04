import React, { useState, useEffect, useRef } from 'react'
import { CreditCard, Loader2, Shield, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'

interface TrollCardSaverProps {
  onCardSaved?: () => void
  onCancel?: () => void
  buttonText?: string
  showCancelButton?: boolean
}

/**
 * TrollCardSaver - Production-ready card saving component for Troll City
 *
 * Features:
 * - Uses Square Web Payments SDK for secure tokenization
 * - Never stores raw card data
 * - Creates proper Square card-on-file records
 * - Comprehensive error handling and user feedback
 * - Production-safe with proper loading states
 */
export default function TrollCardSaver({
  onCardSaved,
  onCancel,
  buttonText = 'Save Card',
  showCancelButton = false
}: TrollCardSaverProps) {
  const { profile } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [cardInstance, setCardInstance] = useState<any>(null)
  const [cardBrand, setCardBrand] = useState<string>('')
  const cardElementRef = useRef<HTMLDivElement>(null)

  // Initialize Square Web Payments SDK when DOM element is ready
  useEffect(() => {
    let isMounted = true

    const initializeSquare = async () => {
      try {
        console.log('[TrollCardSaver] Starting Square initialization')

        // Load Square SDK if not already loaded
        if (!window.Square) {
          console.log('[TrollCardSaver] Loading Square SDK')
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            script.src = 'https://web.squarecdn.com/v1/square.js'
            script.onload = () => {
              console.log('[TrollCardSaver] Square SDK loaded successfully')
              resolve()
            }
            script.onerror = () => reject(new Error('Failed to load Square SDK'))
            document.head.appendChild(script)
          })
        } else {
          console.log('[TrollCardSaver] Square SDK already loaded')
        }

        if (!isMounted) return

        // Initialize Square payments
        const appId = import.meta.env.VITE_SQUARE_APPLICATION_ID
        const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID

        console.log('[TrollCardSaver] Environment check:', { appId: !!appId, locationId: !!locationId })

        if (!appId || !locationId) {
          throw new Error('Square configuration missing')
        }

        console.log('[TrollCardSaver] Initializing Square payments for Troll City')

        const payments = window.Square.payments(appId, locationId)
        const card = await payments.card()

        console.log('[TrollCardSaver] Card instance created, attaching to DOM element')

        // Attach immediately since this effect only runs when ref is available
        if (cardElementRef.current) {
          try {
            await card.attach(cardElementRef.current)
            console.log('[TrollCardSaver] Card attached successfully')

            // Set up event listeners
            card.addEventListener('cardBrandChanged', (event: any) => {
              if (isMounted) {
                setCardBrand(event.detail.cardBrand || '')
              }
            })

            card.addEventListener('focusClassAdded', () => {
              cardElementRef.current?.classList.add('focused')
            })

            card.addEventListener('focusClassRemoved', () => {
              cardElementRef.current?.classList.remove('focused')
            })

            if (isMounted) {
              setCardInstance(card)
              setIsInitializing(false)
            }
          } catch (attachError) {
            console.error('[TrollCardSaver] Failed to attach card:', attachError)
            if (isMounted) {
              setIsInitializing(false)
              toast.error('Failed to load secure payment form. Please refresh and try again.')
            }
          }
        } else {
          console.error('[TrollCardSaver] Card element ref is null after effect triggered')
          if (isMounted) {
            setIsInitializing(false)
            toast.error('Payment form element not found')
          }
        }

      } catch (error) {
        console.error('[TrollCardSaver] Failed to initialize Troll Card Saver:', error)
        if (isMounted) {
          setIsInitializing(false)
          toast.error('Failed to load secure payment form. Please refresh and try again.')
        }
      }
    }

    // Only initialize if we have the DOM element
    if (cardElementRef.current) {
      console.log('[TrollCardSaver] DOM element available, starting initialization')
      initializeSquare()
    } else {
      console.log('[TrollCardSaver] DOM element not ready yet, waiting...')
      setIsInitializing(false) // Don't show loading if element isn't ready
    }

    return () => {
      isMounted = false
      // Cleanup card instance if component unmounts
      if (cardInstance) {
        try {
          cardInstance.destroy()
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  }, [cardElementRef.current]) // Run when DOM element becomes available

  const handleSaveCard = async () => {
    if (!cardInstance || !profile?.id) {
      toast.error('Payment form not ready. Please wait and try again.')
      return
    }

    setIsLoading(true)

    try {
      console.log('Troll City: Tokenizing card...')

      // Step 1: Tokenize the card using Square Web Payments SDK
      const tokenizationResult = await cardInstance.tokenize()

      if (tokenizationResult.errors) {
        const error = tokenizationResult.errors[0]
        console.error('Troll City: Tokenization failed:', error)
        throw new Error(error.message || 'Invalid card information')
      }

      if (!tokenizationResult.token) {
        throw new Error('Failed to secure card information')
      }

      console.log('Troll City: Card tokenized successfully')

      // Step 2: Send tokenized card to our backend
      const { data, error } = await supabase.functions.invoke('save-card', {
        body: {
          userId: profile.id,
          cardToken: tokenizationResult.token
        }
      })

      if (error) {
        console.error('Troll City: Save card function error:', error)
        throw error
      }

      if (!data?.success) {
        console.error('Troll City: Save card failed:', data)
        throw new Error(data?.error || 'Failed to save card')
      }

      console.log('Troll City: Card saved successfully!')
      toast.success('Card saved securely!')

      // Step 3: Notify parent component
      onCardSaved?.()

    } catch (error: any) {
      console.error('Troll City: Save card error:', error)

      // Provide user-friendly error messages
      let errorMessage = 'Failed to save card. Please try again.'
      if (error.message) {
        errorMessage = error.message
      }

      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        <span className="ml-2 text-gray-300">Loading secure payment form...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Security notice */}
      <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
        <Shield className="w-5 h-5 text-green-400" />
        <div className="text-sm">
          <span className="text-green-400 font-medium">Secure Payment</span>
          <span className="text-gray-300 ml-1">Your card information is encrypted and never stored on our servers.</span>
        </div>
      </div>

      {/* Card input form */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-200">
          Card Information
          {cardBrand && (
            <span className="ml-2 text-blue-400 font-normal">
              ({cardBrand})
            </span>
          )}
        </label>

        <div className="relative">
          <div
            ref={cardElementRef}
            id="troll-card-element"
            className="w-full h-12 border border-gray-600 rounded-lg bg-gray-800/50 p-3 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all duration-200"
            style={{ minHeight: '48px' }}
          />

          <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>

        <p className="text-xs text-gray-400">
          Enter your card number, expiration date, CVV, and billing zip code
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSaveCard}
          disabled={isLoading || !cardInstance}
          className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-500 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving Card...
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              {buttonText}
            </>
          )}
        </button>

        {showCancelButton && (
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 hover:text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Additional security info */}
      <div className="text-center">
        <p className="text-xs text-gray-500">
          Secured by <span className="text-blue-400 font-medium">Square</span> •
          PCI DSS compliant •
          Your data is protected
        </p>
      </div>
    </div>
  )
}

// Type declaration for Square SDK
declare global {
  interface Window {
    Square?: any
  }
}