import React, { useState } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

export default function ProsecutorApplication() {
  const { profile } = useAuthStore()
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    timezone: '',
    experience: '',
    legalBackground: '',
    whyApplying: '',
    strengths: '',
    references: ''
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!profile) return toast.error('Please sign in')

    try {
      const { data: lastApp } = await supabase
        .from('prosecutor_applications')
        .select('created_at, updated_at, status')
        .eq('user_id', profile.id)
        .in('status', ['rejected', 'suspended'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastApp) {
        const lastDate = new Date(lastApp.updated_at || lastApp.created_at)
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
        const timePassed = new Date().getTime() - lastDate.getTime()
        
        if (timePassed < sevenDaysMs) {
          toast.error(`Must wait 7 days to reapply.`)
          return
        }
      }
    } catch (err) {
      console.error('Cooldown check error:', err)
    }

    const requiredFields = ['fullName', 'email', 'timezone', 'experience', 'legalBackground', 'whyApplying']
    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData].trim())
    
    if (missingFields.length > 0) {
      return toast.error('Please complete all required fields')
    }

    try {
      setLoading(true)
      
      const applicationData = {
        user_id: profile.id,
        status: 'pending',
        experience: formData.experience,
        data: {
          username: profile.username,
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          timezone: formData.timezone,
          legalBackground: formData.legalBackground,
          whyApplying: formData.whyApplying,
          strengths: formData.strengths,
          references: formData.references
        }
      }
      
      const { error } = await supabase.from('prosecutor_applications').insert([applicationData])
      
      if (error) {
        console.error('[Prosecutor App] Submission error:', error)
        toast.error(error.message || 'Failed to submit application')
        return // Don't throw, just return
      }
      
      // Verify the insert worked by checking
      const { data: verify } = await supabase
        .from('prosecutor_applications')
        .select('id, status')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      console.log('[Prosecutor] Insert verification:', verify)
      
      toast.success('Application submitted! You will be notified once reviewed.')
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        timezone: '',
        experience: '',
        legalBackground: '',
        whyApplying: '',
        strengths: '',
        references: ''
      })
    } catch (err) {
      console.error('Submit error:', err)
      toast.error('Failed to submit application')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-8">
        <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-400 via-pink-400 to-red-400 bg-clip-text text-transparent mb-2">
            Troll Court Prosecutor Application
          </h1>
          <p className="text-[#E2E2E2]/60">Position: Troll Court Prosecutor</p>
        </div>

        <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C] mb-6">
          <h2 className="text-xl font-semibold text-red-400 mb-3">Position Overview</h2>
          <p className="text-[#E2E2E2]/80 mb-3">
            As a Troll Court Prosecutor, you will work directly for Troll City to prosecute cases on behalf of the city.
            You are not to be contacted by regular users - you work with attorneys and judges to ensure justice is served.
          </p>
          <div className="space-y-2 text-sm text-[#E2E2E2]/70">
            <h3 className="font-semibold text-white">Responsibilities:</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Prosecute cases on behalf of Troll City</li>
              <li>Work directly with judges and attorneys</li>
              <li>Present evidence and arguments in court</li>
              <li>Cannot be contacted by regular users directly</li>
              <li>Get a prosecutor badge when approved</li>
              <li>Access to all case details and court proceedings</li>
              <li>Have a chat box to communicate with judges and attorneys</li>
            </ul>
          </div>
        </div>

        <form onSubmit={submit} className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C] space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-pink-400 border-b border-[#2C2C2C] pb-2">Personal Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="First and Last Name"
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-red-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-red-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                  Phone Number <span className="text-[#E2E2E2]/50">(Optional)</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-red-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Timezone <span className="text-red-400">*</span>
              </label>
              <select
                name="timezone"
                value={formData.timezone}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-red-400 focus:outline-none"
              >
                <option value="">Select timezone</option>
                <option value="PST">PST (Pacific)</option>
                <option value="MST">MST (Mountain)</option>
                <option value="CST">CST (Central)</option>
                <option value="EST">EST (Eastern)</option>
                <option value="GMT">GMT (London)</option>
                <option value="CET">CET (Central Europe)</option>
                <option value="JST">JST (Japan)</option>
                <option value="AEST">AEST (Australia)</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-pink-400 border-b border-[#2C2C2C] pb-2">Legal Background</h3>
            
            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Previous Legal Experience <span className="text-red-400">*</span>
              </label>
              <textarea
                name="experience"
                value={formData.experience}
                onChange={handleChange}
                placeholder="List your legal experience, prosecutor background, and qualifications..."
                rows={5}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-red-400 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Legal Background <span className="text-red-400">*</span>
              </label>
              <textarea
                name="legalBackground"
                value={formData.legalBackground}
                onChange={handleChange}
                placeholder="Describe your background in law, education, and any prosecutor-specific training..."
                rows={4}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-red-400 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Why are you applying for this position? <span className="text-red-400">*</span>
              </label>
              <textarea
                name="whyApplying"
                value={formData.whyApplying}
                onChange={handleChange}
                placeholder="Describe your motivation for joining Troll Court as a prosecutor..."
                rows={4}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-red-400 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Key Strengths <span className="text-[#E2E2E2]/50">(Optional)</span>
              </label>
              <textarea
                name="strengths"
                value={formData.strengths}
                onChange={handleChange}
                placeholder="What are your key strengths as a prosecutor? (e.g., research, argumentation, case building, etc.)"
                rows={3}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-red-400 focus:outline-none resize-none"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-pink-400 border-b border-[#2C2C2C] pb-2">References</h3>
            
            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                References <span className="text-[#E2E2E2]/50">(Optional)</span>
              </label>
              <textarea
                name="references"
                value={formData.references}
                onChange={handleChange}
                placeholder="List any references from previous legal positions or prosecutor roles..."
                rows={3}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-red-400 focus:outline-none resize-none"
              />
            </div>
          </div>

          <div className="bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg p-4">
            <p className="text-sm text-[#E2E2E2]/70">
              By submitting this application, you confirm all information is accurate. You understand that:
            </p>
            <ul className="list-disc list-inside text-sm text-[#E2E2E2]/60 mt-2 space-y-1 ml-2">
              <li>Prosecutors receive a badge when approved</li>
              <li>Prosecutors work directly for Troll City</li>
              <li>Prosecutors cannot be contacted by regular users</li>
              <li>Prosecutors have chat access to judges and attorneys</li>
              <li>Prosecutors must maintain professionalism in court</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-4 bg-gradient-to-r from-red-600 to-pink-500 text-white rounded-lg font-bold text-lg hover:shadow-lg hover:shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Submitting Application...' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  )
}
