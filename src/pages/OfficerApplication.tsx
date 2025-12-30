import React, { useState } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

export default function OfficerApplication() {
  const { profile } = useAuthStore()
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    timezone: '',
    availableHours: '',
    whyApplying: '',
    experience: '',
    conflictScenario: '',
    strengths: '',
    weeklyCommitment: '',
    startDate: '',
    references: ''
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!profile) return toast.error('Please sign in')
    
    const requiredFields = ['fullName', 'email', 'timezone', 'availableHours', 'whyApplying', 'experience', 'conflictScenario', 'weeklyCommitment']
    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData].trim())
    
    if (missingFields.length > 0) {
      return toast.error('Please complete all required fields')
    }

    try {
      setLoading(true)
      
      const applicationData = {
        user_id: profile.id,
        type: 'troll_officer',
        reason: formData.whyApplying,
        goals: formData.weeklyCommitment,
        data: {
          username: profile.username,
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          timezone: formData.timezone,
          availableHours: formData.availableHours,
          experience: formData.experience,
          conflictScenario: formData.conflictScenario,
          strengths: formData.strengths,
          weeklyCommitment: formData.weeklyCommitment,
          startDate: formData.startDate,
          references: formData.references
        },
        status: 'pending'
      }
      
      const { error } = await supabase.from('applications').insert([applicationData])
      
      if (error) {
        console.error('[Officer App] Submission error:', error)
        toast.error(error.message || 'Failed to submit application')
        throw error
      }
      
      toast.success('Application submitted successfully! We will review your application and contact you within 3-5 business days.')
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        timezone: '',
        availableHours: '',
        whyApplying: '',
        experience: '',
        conflictScenario: '',
        strengths: '',
        weeklyCommitment: '',
        startDate: '',
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
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-2">
            Troll Officer Employment Application
          </h1>
          <p className="text-[#E2E2E2]/60">Position: Community Moderation Officer</p>
        </div>

        <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C] mb-6">
          <h2 className="text-xl font-semibold text-cyan-400 mb-3">Position Overview</h2>
          <p className="text-[#E2E2E2]/80 mb-3">
            As a Troll Officer, you will be responsible for maintaining order and enforcing community guidelines across all Troll City streams. 
            This is a position of trust and requires professionalism, integrity, and excellent judgment.
          </p>
          <div className="space-y-2 text-sm text-[#E2E2E2]/70">
            <h3 className="font-semibold text-white">Responsibilities:</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Enforce Troll City community guidelines and terms of service</li>
              <li>Issue warnings, mutes, kicks, and bans when necessary</li>
              <li>Monitor chat for inappropriate behavior, spam, and rule violations</li>
              <li>Respond to user reports and escalate serious incidents</li>
              <li>Maintain detailed logs of moderation actions</li>
              <li>Collaborate with other officers and administrators</li>
            </ul>
          </div>
        </div>

        <form onSubmit={submit} className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C] space-y-6">
          {/* Personal Information */}
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
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none"
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
                  className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none"
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
                  className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none"
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
                  className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none"
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
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                  Available Hours (Per Week) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="availableHours"
                  value={formData.availableHours}
                  onChange={handleChange}
                  placeholder="e.g., Weekdays 6PM-10PM, Weekends flexible"
                  className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Qualifications */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-pink-400 border-b border-[#2C2C2C] pb-2">Qualifications & Experience</h3>
            
            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Why are you applying for this position? <span className="text-red-400">*</span>
              </label>
              <textarea
                name="whyApplying"
                value={formData.whyApplying}
                onChange={handleChange}
                placeholder="Describe your motivation and what makes you a good fit for this role..."
                rows={4}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Previous Moderation Experience <span className="text-red-400">*</span>
              </label>
              <textarea
                name="experience"
                value={formData.experience}
                onChange={handleChange}
                placeholder="List any previous moderation experience (Discord, Twitch, YouTube, forums, etc.). Include platforms, duration, and responsibilities..."
                rows={5}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Conflict Resolution Scenario <span className="text-red-400">*</span>
              </label>
              <p className="text-xs text-[#E2E2E2]/60 mb-2">
                A user is repeatedly spamming in chat despite warnings. They claim they're "just having fun" and other users are starting to defend them. How would you handle this situation?
              </p>
              <textarea
                name="conflictScenario"
                value={formData.conflictScenario}
                onChange={handleChange}
                placeholder="Describe your approach to handling this situation..."
                rows={5}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none resize-none"
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
                placeholder="What are your key strengths as a moderator? (e.g., patience, quick decision-making, communication skills, etc.)"
                rows={3}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Availability & Commitment */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-pink-400 border-b border-[#2C2C2C] pb-2">Availability & Commitment</h3>
            
            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Weekly Time Commitment <span className="text-red-400">*</span>
              </label>
              <select
                name="weeklyCommitment"
                value={formData.weeklyCommitment}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none"
              >
                <option value="">Select hours per week</option>
                <option value="5-10">5-10 hours/week</option>
                <option value="10-15">10-15 hours/week</option>
                <option value="15-20">15-20 hours/week</option>
                <option value="20-25">20-25 hours/week</option>
                <option value="25+">25+ hours/week</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                When can you start? <span className="text-[#E2E2E2]/50">(Optional)</span>
              </label>
              <input
                type="text"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                placeholder="e.g., Immediately, 2 weeks, 1 month"
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                References <span className="text-[#E2E2E2]/50">(Optional)</span>
              </label>
              <textarea
                name="references"
                value={formData.references}
                onChange={handleChange}
                placeholder="List any references from previous moderation positions or community leadership roles (names, roles, contact info if available)"
                rows={3}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Agreement */}
          <div className="bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg p-4">
            <p className="text-sm text-[#E2E2E2]/70">
              By submitting this application, you confirm that all information provided is accurate and complete. You understand that:
            </p>
            <ul className="list-disc list-inside text-sm text-[#E2E2E2]/60 mt-2 space-y-1 ml-2">
              <li>Officer positions are volunteer-based with performance incentives</li>
              <li>Officers receive 30% commission on enforcement fees collected</li>
              <li>This role requires maintaining high standards of professionalism</li>
              <li>Employment may be terminated for misconduct or policy violations</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-4 bg-gradient-to-r from-[#FFC93C] to-[#FFD700] text-black rounded-lg font-bold text-lg hover:shadow-lg hover:shadow-[#FFC93C]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Submitting Application...' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  )
}