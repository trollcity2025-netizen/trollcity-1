import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { Crown, Coins, CreditCard, CheckCircle2, XCircle, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import api from '../lib/api'

export default function EmpirePartnerApply() {
  const { profile, user, refreshProfile } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [hasApplication, setHasApplication] = useState(false)
  const [applicationStatus, setApplicationStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'coins' | 'card' | null>(null)

  useEffect(() => {
    if (!user) {
      navigate('/auth')
      return
    }

    // Check if user already has an application
    checkApplicationStatus()

    // If already approved, redirect to dashboard
    if (profile?.empire_partner === true || profile?.partner_status === 'approved' || profile?.role === 'empire_partner') {
      navigate('/empire/dashboard')
      return
    }
  }, [user, profile?.empire_role, navigate])

  const checkApplicationStatus = async () => {
    if (!user?.id) return

    try {
      const { data: application } = await supabase
        .from('empire_applications')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle()

      if (application) {
        setHasApplication(true)
        setApplicationStatus(application.status as 'pending' | 'approved' | 'rejected')
      }

      // If already approved, redirect will happen in useEffect
    } catch (error) {
      console.error('Error checking application status:', error)
    }
  }

  const handleCoinPayment = async () => {
    if (!user?.id || !profile) return

    const requiredCoins = 1500
    if (profile.paid_coin_balance < requiredCoins) {
      toast.error(`You need ${requiredCoins} paid coins. You have ${profile.paid_coin_balance}.`)
      return
    }

    setLoading(true)
    try {
      // Deduct coins
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ 
          paid_coin_balance: profile.paid_coin_balance - requiredCoins 
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      // Create application
      const { error: appError } = await supabase
        .from('empire_applications')
        .insert({
          user_id: user.id,
          status: 'pending',
          payment_type: 'paid_coins',
          amount_paid: 1500,
          payment_id: `coins_${Date.now()}`
        })

      if (appError) {
        // Rollback coin deduction
        await supabase
          .from('user_profiles')
          .update({ paid_coin_balance: profile.paid_coin_balance })
          .eq('id', user.id)
        throw appError
      }

      toast.success('Application submitted! Admin will review it shortly.')
      setHasApplication(true)
      setApplicationStatus('pending')
    } catch (error: any) {
      console.error('Error submitting application:', error)
      toast.error(error.message || 'Failed to submit application')
    } finally {
      setLoading(false)
    }
  }

  const handleCardPayment = async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      // Create pending application first
      const { error: appError } = await supabase
        .from('empire_applications')
        .insert({
          user_id: user.id,
          status: 'pending',
          payment_type: 'card_payment',
          amount_paid: 15,
          payment_id: `pending_${Date.now()}`
        })

      if (appError && !appError.message.includes('duplicate')) {
        console.error('Error creating application:', appError)
        throw new Error('Failed to create application')
      }

      // Create PayPal order for Empire Partner fee
      const session = await supabase.auth.getSession()
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTION_URL}/paypal-create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token || ''}`
        },
        body: JSON.stringify({
          user_id: user.id,
          coins: 0, // Not purchasing coins, just paying fee
          price: 15,
          type: 'empire_partner_fee'
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create order' }))
        throw new Error(errorData.error || 'Failed to create PayPal order')
      }

      const data = await response.json()

      if (data.orderId && data.approvalUrl) {
        // Redirect to PayPal checkout
        window.location.href = data.approvalUrl
      } else {
        throw new Error('No order ID or approval URL returned from server')
      }
    } catch (error: any) {
      console.error('Error initiating card payment:', error)
      toast.error(error.message || 'Failed to initiate payment')
      setLoading(false)
    }
  }

  if (!user) {
    return null
  }

  if (hasApplication && applicationStatus === 'approved') {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-green-500/20 border border-green-500 rounded-xl p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Application Approved!</h1>
            <p className="text-gray-300 mb-6">You are now an Empire Partner. Start recruiting and earning bonuses!</p>
            <button
              onClick={async () => {
                // Refresh profile first to get updated partner status
                await refreshProfile()
                navigate('/empire/dashboard')
              }}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg flex items-center gap-2 mx-auto"
            >
              Go to Partner Dashboard
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (hasApplication && applicationStatus === 'pending') {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-yellow-500/20 border border-yellow-500 rounded-xl p-8 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-400 mx-auto mb-4"></div>
            <h1 className="text-3xl font-bold mb-2">Application Pending</h1>
            <p className="text-gray-300 mb-6">Your application is under review. We'll notify you once it's processed.</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (hasApplication && applicationStatus === 'rejected') {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-500/20 border border-red-500 rounded-xl p-8 text-center">
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Application Rejected</h1>
            <p className="text-gray-300 mb-6">Your application was not approved. Please contact support for more information.</p>
            <button
              onClick={() => navigate('/support')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg"
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
    )
  }

  const hasEnoughCoins = (profile?.paid_coin_balance || 0) >= 1500

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mb-6">
            <Crown className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Join the Troll Empire Partner Program
          </h1>
          <p className="text-xl text-gray-400">
            Recruit users and earn 5% bonus when they reach 40,000+ coins per month
          </p>
        </div>

        {/* Benefits */}
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">Partner Benefits</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">5% Referral Bonus</h3>
                <p className="text-sm text-gray-400">Earn 5% of referred users' monthly earnings (paid coins)</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">40,000 Coin Threshold</h3>
                <p className="text-sm text-gray-400">Bonuses activate when referrals earn 40,000+ coins/month</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Monthly Payouts</h3>
                <p className="text-sm text-gray-400">Bonuses paid automatically at month end</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Empire Partner Badge</h3>
                <p className="text-sm text-gray-400">Showcase your partner status on your profile</p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Options */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Coin Payment */}
          <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Coins className="w-8 h-8 text-yellow-400" />
              <h3 className="text-xl font-bold">Pay with Coins</h3>
            </div>
            <div className="mb-6">
              <p className="text-3xl font-bold text-yellow-400 mb-2">1,500</p>
              <p className="text-sm text-gray-400">Paid coins required</p>
            </div>
            <div className="mb-6">
              <p className="text-sm text-gray-400 mb-2">Your balance:</p>
              <p className="text-lg font-semibold">
                {profile?.paid_coin_balance || 0} paid coins
              </p>
            </div>
            <button
              onClick={handleCoinPayment}
              disabled={loading || !hasEnoughCoins}
              className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors ${
                hasEnoughCoins
                  ? 'bg-yellow-600 hover:bg-yellow-500'
                  : 'bg-gray-600 cursor-not-allowed'
              }`}
            >
              {loading ? 'Processing...' : hasEnoughCoins ? 'Pay with Coins' : 'Insufficient Coins'}
            </button>
            {!hasEnoughCoins && (
              <p className="text-sm text-gray-400 mt-2 text-center">
                Need {1500 - (profile?.paid_coin_balance || 0)} more coins
              </p>
            )}
          </div>

          {/* Card Payment */}
          <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="w-8 h-8 text-blue-400" />
              <h3 className="text-xl font-bold">Pay with Card</h3>
            </div>
            <div className="mb-6">
              <p className="text-3xl font-bold text-blue-400 mb-2">$15.00</p>
              <p className="text-sm text-gray-400">One-time application fee</p>
            </div>
            <div className="mb-6">
              <p className="text-sm text-gray-400">Secure payment via PayPal</p>
            </div>
            <button
              onClick={handleCardPayment}
              disabled={loading}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Pay with Card'}
            </button>
          </div>
        </div>

        {/* Terms */}
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6">
          <p className="text-sm text-gray-400 text-center">
            By applying, you agree to the Empire Partner Program terms. Applications are subject to admin approval.
            Refunds are not available for rejected applications.
          </p>
        </div>
      </div>
    </div>
  )
}

