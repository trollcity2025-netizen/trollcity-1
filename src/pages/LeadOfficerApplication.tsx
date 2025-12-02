import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { Crown, Shield, CheckCircle } from 'lucide-react'

export default function LeadOfficerApplication() {
  const { profile, user } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    email: profile?.email || '',
    whyApplying: '',
    leadershipExperience: '',
    vision: '',
    availability: ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!profile || !user) return toast.error('Please sign in')
    
    const requiredFields = ['fullName', 'email', 'whyApplying', 'leadershipExperience', 'vision', 'availability']
    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData].trim())
    
    if (missingFields.length > 0) {
      return toast.error('Please complete all required fields')
    }

    try {
      setLoading(true)
      
      const applicationData = {
        user_id: profile.id,
        type: 'lead_officer',
        reason: formData.whyApplying,
        goals: formData.vision,
        data: {
          username: profile.username,
          fullName: formData.fullName,
          email: formData.email,
          leadershipExperience: formData.leadershipExperience,
          vision: formData.vision,
          availability: formData.availability
        },
        status: 'pending'
      }
      
      const { error } = await supabase.from('applications').insert([applicationData])
      
      if (error) {
        console.error('[Lead Officer App] Submission error:', error)
        toast.error(error.message || 'Failed to submit application')
        throw error
      }
      
      toast.success('Lead Officer application submitted successfully! We will review your application and contact you within 3-5 business days.')
      navigate('/')
    } catch (error: any) {
      console.error('Application submission error:', error)
      toast.error(error.message || 'Failed to submit application')
    } finally {
      setLoading(false)
    }
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <p>Please log in to apply</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full mb-4">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-2">Lead Officer Application</h1>
          <p className="text-gray-400">Apply to lead and manage Troll Officers</p>
        </div>

        <form onSubmit={submit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Full Name *</label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              className="w-full bg-[#1A1A1A] border border-[#2C2C2C] rounded-lg px-4 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full bg-[#1A1A1A] border border-[#2C2C2C] rounded-lg px-4 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Why are you applying for Lead Officer? *</label>
            <textarea
              name="whyApplying"
              value={formData.whyApplying}
              onChange={handleChange}
              required
              rows={4}
              className="w-full bg-[#1A1A1A] border border-[#2C2C2C] rounded-lg px-4 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Leadership Experience *</label>
            <textarea
              name="leadershipExperience"
              value={formData.leadershipExperience}
              onChange={handleChange}
              required
              rows={4}
              placeholder="Describe your experience leading teams, moderating communities, or managing people"
              className="w-full bg-[#1A1A1A] border border-[#2C2C2C] rounded-lg px-4 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Your Vision for Troll City *</label>
            <textarea
              name="vision"
              value={formData.vision}
              onChange={handleChange}
              required
              rows={4}
              placeholder="What changes or improvements would you bring as Lead Officer?"
              className="w-full bg-[#1A1A1A] border border-[#2C2C2C] rounded-lg px-4 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Availability *</label>
            <textarea
              name="availability"
              value={formData.availability}
              onChange={handleChange}
              required
              rows={3}
              placeholder="How many hours per week can you commit? What timezone are you in?"
              className="w-full bg-[#1A1A1A] border border-[#2C2C2C] rounded-lg px-4 py-2 text-white"
            />
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/apply')}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 rounded-lg font-semibold disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

