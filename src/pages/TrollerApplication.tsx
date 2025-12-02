import React, { useState } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { CheckCircle, XCircle } from 'lucide-react'

export default function TrollerApplication() {
  const { profile } = useAuthStore()
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    age: '',
    location: '',
    bio: '',
    contentStyle: '',
    streamingExperience: '',
    goals: '',
    uniqueValue: '',
    availability: '',
    equipment: '',
    socialMedia: ''
  })
  const [agreedToGuidelines, setAgreedToGuidelines] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!profile) return toast.error('Please sign in')
    
    const requiredFields = ['fullName', 'email', 'age', 'bio', 'contentStyle', 'goals', 'availability']
    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData].trim())
    
    if (missingFields.length > 0) {
      return toast.error('Please complete all required fields')
    }

    if (!agreedToGuidelines) {
      return toast.error('You must agree to the Community Guidelines')
    }

    try {
      setLoading(true)
      
      const applicationData = {
        user_id: profile.id,
        type: 'troller',
        reason: formData.bio,
        goals: formData.goals,
        data: {
          username: profile.username,
          fullName: formData.fullName,
          email: formData.email,
          age: formData.age,
          location: formData.location,
          contentStyle: formData.contentStyle,
          streamingExperience: formData.streamingExperience,
          uniqueValue: formData.uniqueValue,
          availability: formData.availability,
          equipment: formData.equipment,
          socialMedia: formData.socialMedia
        },
        status: 'pending'
      }
      
      const { error } = await supabase.from('applications').insert([applicationData])
      
      if (error) {
        console.error('[Troller App] Submission error:', error)
        toast.error(error.message || 'Failed to submit application')
        throw error
      }
      
      toast.success('Application submitted successfully! We will review your application and get back to you within 3-5 business days.')
      setFormData({
        fullName: '',
        email: '',
        age: '',
        location: '',
        bio: '',
        contentStyle: '',
        streamingExperience: '',
        goals: '',
        uniqueValue: '',
        availability: '',
        equipment: '',
        socialMedia: ''
      })
      setAgreedToGuidelines(false)
    } catch (err) {
      console.error('Submit error:', err)
      toast.error('Failed to submit application')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-2">
            Troller Application
          </h1>
          <p className="text-[#E2E2E2]/60">Join the Troll City streaming community</p>
        </div>

        {/* Guidelines Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* DO's */}
          <div className="bg-gradient-to-br from-green-900/20 to-green-800/10 rounded-xl p-6 border border-green-500/30">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="text-green-400" size={32} />
              <h2 className="text-2xl font-bold text-green-400">DO's - Best Practices</h2>
            </div>
            <ul className="space-y-3 text-sm text-[#E2E2E2]/90">
              <li className="flex items-start gap-2">
                <CheckCircle className="text-green-400 mt-0.5 flex-shrink-0" size={16} />
                <span><strong>Do troll with all means</strong> - Bring your unique trolling style and creativity</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-green-400 mt-0.5 flex-shrink-0" size={16} />
                <span>Create engaging, entertaining content that brings positive energy</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-green-400 mt-0.5 flex-shrink-0" size={16} />
                <span>Interact actively with your viewers and build community</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-green-400 mt-0.5 flex-shrink-0" size={16} />
                <span>Stream consistently and maintain a regular schedule</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-green-400 mt-0.5 flex-shrink-0" size={16} />
                <span>Respect all community members and promote inclusivity</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-green-400 mt-0.5 flex-shrink-0" size={16} />
                <span>Use high-quality audio and video equipment when possible</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-green-400 mt-0.5 flex-shrink-0" size={16} />
                <span>Follow Troll City's Terms of Service and Community Guidelines</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-green-400 mt-0.5 flex-shrink-0" size={16} />
                <span>Promote your streams on social media to grow your audience</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-green-400 mt-0.5 flex-shrink-0" size={16} />
                <span>Thank viewers for gifts and engagement</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-green-400 mt-0.5 flex-shrink-0" size={16} />
                <span>Collaborate with other streamers to cross-promote</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-green-400 mt-0.5 flex-shrink-0" size={16} />
                <span>Report any technical issues or violations to officers/admins</span>
              </li>
            </ul>
          </div>

          {/* DON'Ts */}
          <div className="bg-gradient-to-br from-red-900/20 to-red-800/10 rounded-xl p-6 border border-red-500/30">
            <div className="flex items-center gap-3 mb-4">
              <XCircle className="text-red-400" size={32} />
              <h2 className="text-2xl font-bold text-red-400">DON'Ts - Prohibited Actions</h2>
            </div>
            <ul className="space-y-3 text-sm text-[#E2E2E2]/90">
              <li className="flex items-start gap-2">
                <XCircle className="text-red-400 mt-0.5 flex-shrink-0" size={16} />
                <span>Stream illegal activities, violence, or harmful content</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="text-red-400 mt-0.5 flex-shrink-0" size={16} />
                <span>Engage in harassment, bullying, or hate speech</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="text-red-400 mt-0.5 flex-shrink-0" size={16} />
                <span>Share explicit adult content or nudity</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="text-red-400 mt-0.5 flex-shrink-0" size={16} />
                <span>Use bots or fake accounts to inflate viewer numbers</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="text-red-400 mt-0.5 flex-shrink-0" size={16} />
                <span>Spam chat or encourage spam from viewers</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="text-red-400 mt-0.5 flex-shrink-0" size={16} />
                <span>Stream copyrighted content without permission</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="text-red-400 mt-0.5 flex-shrink-0" size={16} />
                <span>Dox or share personal information of others</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="text-red-400 mt-0.5 flex-shrink-0" size={16} />
                <span>Engage in or promote illegal gambling or scams</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="text-red-400 mt-0.5 flex-shrink-0" size={16} />
                <span>Stream while intoxicated or under the influence</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="text-red-400 mt-0.5 flex-shrink-0" size={16} />
                <span>Attempt to manipulate the platform or abuse features</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Application Form */}
        <form onSubmit={submit} className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C] space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-pink-400 border-b border-[#2C2C2C] pb-2">Personal Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  required
                />
              </div>

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
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                  Age <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  placeholder="Must be 18+"
                  min="18"
                  className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                  Location <span className="text-[#E2E2E2]/50">(Optional)</span>
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="City, Country"
                  className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* About You */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-pink-400 border-b border-[#2C2C2C] pb-2">About You</h3>
            
            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Tell us about yourself <span className="text-red-400">*</span>
              </label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                placeholder="Share your personality, interests, and what makes you unique..."
                rows={4}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Content Style & Niche <span className="text-red-400">*</span>
              </label>
              <textarea
                name="contentStyle"
                value={formData.contentStyle}
                onChange={handleChange}
                placeholder="What type of content will you create? (e.g., gaming, music, talk shows, creative arts, lifestyle, etc.)"
                rows={3}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Previous Streaming Experience <span className="text-[#E2E2E2]/50">(Optional)</span>
              </label>
              <textarea
                name="streamingExperience"
                value={formData.streamingExperience}
                onChange={handleChange}
                placeholder="Have you streamed before? On which platforms? Share your experience..."
                rows={3}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Goals & Vision */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-pink-400 border-b border-[#2C2C2C] pb-2">Goals & Vision</h3>
            
            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Your Goals as a Troller <span className="text-red-400">*</span>
              </label>
              <textarea
                name="goals"
                value={formData.goals}
                onChange={handleChange}
                placeholder="What do you hope to achieve on Troll City? How will you engage and grow your community?"
                rows={4}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                What makes you unique? <span className="text-[#E2E2E2]/50">(Optional)</span>
              </label>
              <textarea
                name="uniqueValue"
                value={formData.uniqueValue}
                onChange={handleChange}
                placeholder="What will set you apart from other streamers? What unique value do you bring?"
                rows={3}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Technical & Logistics */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-pink-400 border-b border-[#2C2C2C] pb-2">Technical & Availability</h3>
            
            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Streaming Availability <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="availability"
                value={formData.availability}
                onChange={handleChange}
                placeholder="e.g., Weekdays 6PM-10PM EST, Weekends flexible"
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Equipment & Setup <span className="text-[#E2E2E2]/50">(Optional)</span>
              </label>
              <textarea
                name="equipment"
                value={formData.equipment}
                onChange={handleChange}
                placeholder="Describe your streaming setup (camera, microphone, internet speed, software, etc.)"
                rows={3}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Social Media Links <span className="text-[#E2E2E2]/50">(Optional)</span>
              </label>
              <input
                type="text"
                name="socialMedia"
                value={formData.socialMedia}
                onChange={handleChange}
                placeholder="Instagram, TikTok, Twitter/X, YouTube, etc."
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Agreement */}
          <div className="bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg p-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="guidelines"
                checked={agreedToGuidelines}
                onChange={(e) => setAgreedToGuidelines(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-600 bg-[#1A1A1A] focus:ring-cyan-400 focus:ring-offset-0"
                required
              />
              <label htmlFor="guidelines" className="text-sm text-[#E2E2E2]/80 cursor-pointer">
                I have read and agree to follow Troll City's Community Guidelines, Terms of Service, and the DO's and DON'Ts listed above. 
                I understand that violations may result in suspension or permanent ban from the platform.
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !agreedToGuidelines}
            className="w-full px-6 py-4 bg-gradient-to-r from-[#FFC93C] to-[#FFD700] text-black rounded-lg font-bold text-lg hover:shadow-lg hover:shadow-[#FFC93C]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Submitting Application...' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  )
}
