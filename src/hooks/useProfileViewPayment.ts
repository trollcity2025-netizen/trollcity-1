// Hook for profile view payment checking
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { checkProfileViewPayment, chargeProfileView, redirectToStore } from '../lib/profileViewPayment'
import { toast } from 'sonner'

interface UseProfileViewPaymentOptions {
  profileOwnerId: string
  profileViewPrice: number | null
  onPaymentComplete?: () => void
}

export function useProfileViewPayment({
  profileOwnerId,
  profileViewPrice,
  onPaymentComplete
}: UseProfileViewPaymentOptions) {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [canView, setCanView] = useState(false)
  const [paymentProcessed, setPaymentProcessed] = useState(false)

  useEffect(() => {
    const checkPayment = async () => {
      if (!user || !profileOwnerId) {
        setChecking(false)
        return
      }

      // Already processed payment for this view
      if (paymentProcessed) {
        setCanView(true)
        setChecking(false)
        return
      }

      setChecking(true)

      try {
        const { canView: canAccess, requiredCoins } = await checkProfileViewPayment(
          user.id,
          profileOwnerId,
          profileViewPrice
        )

        if (!canAccess) {
          // Redirect to store
          redirectToStore(navigate, requiredCoins || 0)
          setCanView(false)
          setChecking(false)
          return
        }

        // If there's a price and user is not exempt, charge them
        if (profileViewPrice && profileViewPrice > 0 && user.id !== profileOwnerId) {
          // Check if already paid (you might want to add a check here for recent payments)
          const chargeResult = await chargeProfileView(user.id, profileOwnerId, profileViewPrice)

          if (!chargeResult.success) {
            toast.error(chargeResult.error || 'Failed to process payment')
            redirectToStore(navigate, profileViewPrice)
            setCanView(false)
            setChecking(false)
            return
          }

          setPaymentProcessed(true)
          toast.success(`Profile view charged: ${profileViewPrice.toLocaleString()} coins`)
        }

        setCanView(true)
        if (onPaymentComplete) {
          onPaymentComplete()
        }
      } catch (error: any) {
        console.error('Error checking profile view payment:', error)
        toast.error('Error checking payment')
        setCanView(false)
      } finally {
        setChecking(false)
      }
    }

    checkPayment()
  }, [user, profileOwnerId, profileViewPrice, paymentProcessed, navigate, onPaymentComplete])

  return { checking, canView, paymentProcessed }
}

