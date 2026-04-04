import React, { useState, useEffect, useRef } from 'react'
import { CreditCard, Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'

interface SquareCardSaverProps {
  onCardSaved?: () => void;
  buttonText?: string;
  buttonClassName?: string;
}

declare global {
  interface Window {
    Square?: any;
  }
}

export default function SquareCardSaver({
  onCardSaved,
  buttonText = 'Add Card',
  buttonClassName = 'bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold'
}: SquareCardSaverProps) {
  const { profile } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [card, setCard] = useState<any>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const initSquare = async () => {
      if (!window.Square || !cardRef.current) return

      try {
        console.log('Initializing Square payments with:', {
          appId: import.meta.env.VITE_SQUARE_APPLICATION_ID,
          locationId: import.meta.env.VITE_SQUARE_LOCATION_ID
        })

        const payments = window.Square.payments(
          import.meta.env.VITE_SQUARE_APPLICATION_ID,
          import.meta.env.VITE_SQUARE_LOCATION_ID
        )

        const cardInstance = await payments.card()
        await cardInstance.attach('#square-card-element')

        cardInstance.addEventListener('cardBrandChanged', (event: any) => {
          console.log('Card brand changed:', event.detail)
        })

        cardInstance.addEventListener('focusClassAdded', () => {
          cardRef.current?.classList.add('focused')
        })

        cardInstance.addEventListener('focusClassRemoved', () => {
          cardRef.current?.classList.remove('focused')
        })

        setCard(cardInstance)
      } catch (error) {
        console.error('Failed to initialize Square card:', error)
        toast.error('Failed to load payment form')
      }
    }

    // Load Square SDK if not loaded
    if (!window.Square) {
      const script = document.createElement('script')
      script.src = 'https://web.squarecdn.com/v1/square.js'
      script.onload = initSquare
      document.head.appendChild(script)
    } else {
      initSquare()
    }
  }, [])

  const handleSaveCard = async () => {
    if (!card || !profile?.id) {
      console.error('Card not initialized or no user profile')
      return
    }

    setIsLoading(true)
    try {
      console.log('Tokenizing card...')
      // Tokenize the card
      const result = await card.tokenize()
      console.log('Tokenization result:', result)

      if (result.errors) {
        console.error('Tokenization errors:', result.errors)
        throw new Error(result.errors[0].message)
      }

      if (!result.token) {
        throw new Error('No token received from card tokenization')
      }

      console.log('Calling add-card function with token:', result.token.substring(0, 10) + '...')

      // Save the card using our Edge Function
      const { data, error } = await supabase.functions.invoke('add-card', {
        body: {
          userId: profile.id,
          cardNonce: result.token,
          provider: 'square'
        }
      })

      console.log('add-card response:', { data, error })

      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Failed to save card')

      toast.success('Card saved successfully!')
      onCardSaved?.()

    } catch (error: any) {
      console.error('Save card error:', error)
      toast.error(error?.message || 'Failed to save card')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Card Information
        </label>
        <div
          ref={cardRef}
          id="square-card-element"
          className="w-full h-12 border border-gray-600 rounded-lg bg-gray-800 p-3 focus-within:border-blue-500 transition-colors"
        />
      </div>

      <button
        onClick={handleSaveCard}
        disabled={isLoading || !card}
        className={`${buttonClassName} disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CreditCard className="w-4 h-4" />
        )}
        {isLoading ? 'Saving...' : buttonText}
      </button>
    </div>
  )
}