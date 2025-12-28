import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { CreditCard, Save, Mail, Coins } from 'lucide-react'

export default function PayoutSetupPage() {
  const { profile, user } = useAuthStore()
  const navigate = useNavigate()
  const [paypalEmail, setPaypalEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) {
      navigate('/auth')
      return
    }

    // Load current PayPal email
    if (profile?.payout_paypal_email) {
      setPaypalEmail(profile.payout_paypal_email)
    }
  }, [user, profile, navigate])

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleSave = async () => {
    if (!user || !profile) {
      toast.error('You must be logged in')
      return
    }

    if (!paypalEmail.trim()) {
      toast.error('Please enter your PayPal email')
      return
    }

    if (!validateEmail(paypalEmail)) {
      toast.error('Please enter a valid email address')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          payout_paypal_email: paypalEmail.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      toast.success('PayPal email saved successfully!')
      
      // Update local profile
      useAuthStore.getState().setProfile({
        ...profile,
        payout_paypal_email: paypalEmail.trim()
      } as any)

      // Navigate back or to earnings page
      setTimeout(() => {
        navigate('/earnings')
      }, 1500)
    } catch (error: any) {
      console.error('Error saving PayPal email:', error)
      toast.error(error?.message || 'Failed to save PayPal email')
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return null
  }

  const paidCoins = profile?.troll_coins || 0
  const earnedCoins = profile?.total_earned_coins || 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <CreditCard className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold text-purple-300">Payout Setup</h1>
          </div>

          <p className="text-gray-400 mb-6">
            Connect your PayPal account to receive payouts. Your PayPal email will be used to send payments when you request a withdrawal.
          </p>

          {/* Balance Display */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-purple-400" />
                <span className="text-sm text-gray-400">Paid Coins</span>
              </div>
              <div className="text-2xl font-bold text-purple-300">
                {paidCoins.toLocaleString()}
              </div>
            </div>
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-green-400" />
                <span className="text-sm text-gray-400">Total Earned</span>
              </div>
              <div className="text-2xl font-bold text-green-300">
                {earnedCoins.toLocaleString()}
              </div>
            </div>
          </div>

          {/* PayPal Email Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              PayPal Email Address *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              This email must match your PayPal account email address
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-300 mb-2">Payout Information</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Minimum payout: 7,000 coins ($21)</li>
              <li>• Conversion rate: 100 coins = $1 USD</li>
              <li>• Payouts are processed manually by admin</li>
              <li>• You'll receive payment via PayPal</li>
            </ul>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving || !paypalEmail.trim() || !validateEmail(paypalEmail)}
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save PayPal Email'}
          </button>

          {/* Back Button */}
          <button
            onClick={() => navigate('/earnings')}
            className="w-full mt-3 px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
          >
            Back to Earnings
          </button>
        </div>
      </div>
    </div>
  )
}

