// CreatorOnboarding: W9 form collection for creators
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { FileText, ArrowRight, Loader2 } from 'lucide-react'

export default function CreatorOnboarding() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    legal_full_name: '',
    date_of_birth: '',
    country: 'US',
    address_line1: '',
    address_line2: '',
    city: '',
    state_region: '',
    postal_code: '',
    tax_id_last4: '',
    tax_classification: 'individual',
  })

  useEffect(() => {
    if (!user) {
      navigate('/auth')
      return
    }

    // Load existing data if any
    if (profile) {
      setFormData({
        legal_full_name: profile.legal_full_name || '',
        date_of_birth: profile.date_of_birth || '',
        country: profile.country || 'US',
        address_line1: profile.address_line1 || '',
        address_line2: profile.address_line2 || '',
        city: profile.city || '',
        state_region: profile.state_region || '',
        postal_code: profile.postal_code || '',
        tax_id_last4: profile.tax_id_last4 || '',
        tax_classification: profile.tax_classification || 'individual',
      })
    }
  }, [user, profile, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    // Validation
    if (!formData.legal_full_name || !formData.date_of_birth || !formData.address_line1 || 
        !formData.city || !formData.state_region || !formData.postal_code || !formData.tax_id_last4) {
      toast.error('Please fill in all required fields')
      return
    }

    if (formData.tax_id_last4.length !== 4 || !/^\d{4}$/.test(formData.tax_id_last4)) {
      toast.error('Tax ID last 4 must be exactly 4 digits')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          ...formData,
          w9_status: 'submitted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      toast.success('Onboarding information submitted!')
      
      // Refresh profile
      const { data: updatedProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (updatedProfile) {
        useAuthStore.getState().setProfile(updatedProfile as any)
      }

      // Redirect to home or go live page
      setTimeout(() => {
        navigate('/')
      }, 1500)
    } catch (error: any) {
      console.error('Error submitting onboarding:', error)
      toast.error(error.message || 'Failed to submit information')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold">Creator Onboarding</h1>
          </div>
          <p className="text-gray-400">
            Complete your information to go live and receive payouts. We only store the last 4 digits of your SSN/EIN for 1099 tax forms.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-8 space-y-6">
          {/* Legal Name */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Legal Full Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.legal_full_name}
              onChange={(e) => setFormData({ ...formData, legal_full_name: e.target.value })}
              className="w-full px-4 py-2 bg-[#0A0814] border border-[#2C2C2C] rounded-lg focus:outline-none focus:border-purple-500"
              placeholder="John Doe"
            />
          </div>

          {/* Date of Birth */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Date of Birth <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.date_of_birth}
              onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              className="w-full px-4 py-2 bg-[#0A0814] border border-[#2C2C2C] rounded-lg focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Address Line 1 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.address_line1}
              onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
              className="w-full px-4 py-2 bg-[#0A0814] border border-[#2C2C2C] rounded-lg focus:outline-none focus:border-purple-500"
              placeholder="123 Main St"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Address Line 2 (Optional)</label>
            <input
              type="text"
              value={formData.address_line2}
              onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
              className="w-full px-4 py-2 bg-[#0A0814] border border-[#2C2C2C] rounded-lg focus:outline-none focus:border-purple-500"
              placeholder="Apt 4B"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">
                City <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-4 py-2 bg-[#0A0814] border border-[#2C2C2C] rounded-lg focus:outline-none focus:border-purple-500"
                placeholder="New York"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                State/Region <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.state_region}
                onChange={(e) => setFormData({ ...formData, state_region: e.target.value })}
                className="w-full px-4 py-2 bg-[#0A0814] border border-[#2C2C2C] rounded-lg focus:outline-none focus:border-purple-500"
                placeholder="NY"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">
                Postal Code <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                className="w-full px-4 py-2 bg-[#0A0814] border border-[#2C2C2C] rounded-lg focus:outline-none focus:border-purple-500"
                placeholder="10001"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Country <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-4 py-2 bg-[#0A0814] border border-[#2C2C2C] rounded-lg focus:outline-none focus:border-purple-500"
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="UK">United Kingdom</option>
                <option value="AU">Australia</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {/* Tax Classification */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Tax Classification <span className="text-red-400">*</span>
            </label>
            <select
              required
              value={formData.tax_classification}
              onChange={(e) => setFormData({ ...formData, tax_classification: e.target.value })}
              className="w-full px-4 py-2 bg-[#0A0814] border border-[#2C2C2C] rounded-lg focus:outline-none focus:border-purple-500"
            >
              <option value="individual">Individual</option>
              <option value="business">Business</option>
            </select>
          </div>

          {/* Tax ID Last 4 */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Tax ID Last 4 Digits (SSN or EIN) <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={4}
              pattern="[0-9]{4}"
              value={formData.tax_id_last4}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 4)
                setFormData({ ...formData, tax_id_last4: value })
              }}
              className="w-full px-4 py-2 bg-[#0A0814] border border-[#2C2C2C] rounded-lg focus:outline-none focus:border-purple-500"
              placeholder="1234"
            />
            <p className="text-xs text-gray-400 mt-1">
              We only store the last 4 digits for 1099 tax form purposes if you cross the $600 threshold.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                Submit Information
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

