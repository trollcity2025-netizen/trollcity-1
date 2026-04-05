import React, { useState } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

export default function AttorneyApplication() {
  const { profile } = useAuthStore()
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    timezone: '',
    practiceAreas: '',
    whyApplying: '',
    experience: '',
    feeAmount: '',
    isProBono: false,
    references: ''
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }))
  }

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!profile) return toast.error('Please sign in')

    try {
      // Check for existing pending application first
      const { data: existingPending } = await supabase
        .from('attorney_applications')
        .select('id, status')
        .eq('user_id', profile.id)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle()

      if (existingPending) {
        toast.error('You already have a pending attorney application.')
        return
      }

      // Check cooldown for rejected/suspended applications
      const { data: lastApp } = await supabase
        .from('attorney_applications')
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

    const requiredFields = ['fullName', 'email', 'timezone', 'whyApplying', 'experience']
    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData].trim())
    
    if (missingFields.length > 0) {
      return toast.error('Please complete all required fields')
    }

    try {
      setLoading(true)
      
      const attorneyFee = formData.isProBono ? 0 : parseInt(formData.feeAmount) || 0
      
      const applicationData = {
        user_id: profile.id,
        status: 'pending',
        attorney_fee: attorneyFee,
        is_pro_bono: formData.isProBono,
        data: {
          username: profile.username,
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          timezone: formData.timezone,
          practiceAreas: formData.practiceAreas,
          whyApplying: formData.whyApplying,
          experience: formData.experience,
          references: formData.references
        }
      }

      console.log('[Attorney] Submitting for user_id:', profile.id, 'data:', JSON.stringify(applicationData))

      // Use RPC function to bypass RLS issues
      const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_attorney_application_full', {
        p_application_data: applicationData
      })

      if (rpcError) {
        console.error('[Attorney App] RPC error:', rpcError)
        toast.error(rpcError.message || 'Failed to submit application')
        return
      }

      if (rpcResult && !rpcResult.success) {
        console.error('[Attorney App] RPC result error:', rpcResult.error)
        toast.error(rpcResult.error || 'Failed to submit application')
        return
      }

console.log('[Attorney] RPC result:', rpcResult)
       
      toast.success('Application submitted! You will be notified once reviewed.')
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        timezone: '',
        practiceAreas: '',
        whyApplying: '',
        experience: '',
        feeAmount: '',
        isProBono: false,
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
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400 bg-clip-text text-transparent mb-2">
            Troll Court Attorney Application
          </h1>
          <p className="text-[#E2E2E2]/60">Position: Troll Court Defense Attorney</p>
        </div>

        <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C] mb-6">
          <h2 className="text-xl font-semibold text-amber-400 mb-3">Position Overview</h2>
          <p className="text-[#E2E2E2]/80 mb-3">
            As a Troll Court Attorney, you will represent defendants in Troll Court proceedings.
            You can choose to work as a pro bono attorney (receiving 200 Troll Coins per case from the Troll City public pool)
            or set your own fee.
          </p>
          <div className="space-y-2 text-sm text-[#E2E2E2]/70">
            <h3 className="font-semibold text-white">Benefits:</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Pro Bono: Receive 200 Troll Coins per case from public pool</li>
              <li>Private: Set your own attorney fee (paid by client)</li>
              <li>Receive attorney badge when approved</li>
              <li>Access to case details, victim info, and court docket</li>
              <li>Dedicated dashboard with case management</li>
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
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-amber-400 focus:outline-none"
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
                  className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-amber-400 focus:outline-none"
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
                  className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                  Timezone <span className="text-red-400">*</span>
                </label>
                <select
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-amber-400 focus:outline-none"
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
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-pink-400 border-b border-[#2C2C2C] pb-2">Legal Background</h3>
            
            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Areas of Practice
              </label>
              <input
                type="text"
                name="practiceAreas"
                value={formData.practiceAreas}
                onChange={handleChange}
                placeholder="e.g., Criminal Defense, Civil Litigation, Family Law"
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-amber-400 focus:outline-none"
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
                placeholder="Describe your motivation for joining Troll Court as an attorney..."
                rows={4}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-amber-400 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Previous Legal Experience <span className="text-red-400">*</span>
              </label>
              <textarea
                name="experience"
                value={formData.experience}
                onChange={handleChange}
                placeholder="List your legal experience, notable cases, and qualifications..."
                rows={5}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-amber-400 focus:outline-none resize-none"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-pink-400 border-b border-[#2C2C2C] pb-2">Fee Structure</h3>
            
            <div className="bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="isProBono"
                  checked={formData.isProBono}
                  onChange={handleChange}
                  className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500"
                />
                <div>
                  <p className="font-semibold text-amber-400">Pro Bono (Free Legal Service)</p>
                  <p className="text-sm text-gray-400">Receive 200 Troll Coins per case from Troll City public pool</p>
                </div>
              </label>
            </div>

            {!formData.isProBono && (
              <div>
                <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                  Your Attorney Fee (Troll Coins per case)
                </label>
                <input
                  type="number"
                  name="feeAmount"
                  value={formData.feeAmount}
                  onChange={handleChange}
                  placeholder="Enter your fee amount"
                  className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-amber-400 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Clients will pay this fee to hire you</p>
              </div>
            )}
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
                placeholder="List any references from previous legal positions..."
                rows={3}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-amber-400 focus:outline-none resize-none"
              />
            </div>
          </div>

          <div className="bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg p-4">
            <p className="text-sm text-[#E2E2E2]/70">
              By submitting this application, you confirm all information is accurate. You understand that:
            </p>
            <ul className="list-disc list-inside text-sm text-[#E2E2E2]/60 mt-2 space-y-1 ml-2">
              <li>Attorneys receive a badge when approved</li>
              <li>Pro Bono attorneys receive 200 TC per case from public pool</li>
              <li>Private attorneys set their own fees (paid by clients)</li>
              <li>Attorneys can message defendants in jail who have messaged first</li>
              <li>All attorneys must maintain professionalism in court</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-4 bg-gradient-to-r from-amber-600 to-yellow-500 text-black rounded-lg font-bold text-lg hover:shadow-lg hover:shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Submitting Application...' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  )
}
