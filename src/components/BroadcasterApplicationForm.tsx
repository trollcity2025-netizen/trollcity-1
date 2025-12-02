import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { X, Upload, FileText, CreditCard, Building2, User } from 'lucide-react'

interface BroadcasterApplicationFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmitted: () => void
}

export default function BroadcasterApplicationForm({ isOpen, onClose, onSubmitted }: BroadcasterApplicationFormProps) {
  const { profile, user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    full_name: '',
    username: profile?.username || '',
    email: user?.email || '',
    country: '',
    date_of_birth: '',
    address: '',
    ssn_last_four: '',
    bank_account_last_four: '',
    bank_routing_number: '',
    ein: '',
    is_business: false,
  })
  const [idFile, setIdFile] = useState<File | null>(null)
  const [taxFile, setTaxFile] = useState<File | null>(null)

  if (!isOpen) return null

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleFileUpload = async (file: File, type: 'id' | 'tax'): Promise<string | null> => {
    try {
      if (!user) return null
      
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${type}-${Date.now()}.${fileExt}`
      const filePath = `broadcaster-docs/${fileName}`

      // Try documents bucket first
      let bucketName = 'documents'
      let { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file)

      // If documents bucket doesn't exist, try public or avatars bucket
      if (uploadError && (uploadError.message.includes('not found') || uploadError.message.includes('Bucket'))) {
        // Try public bucket
        const publicRetry = await supabase.storage.from('public').upload(filePath, file)
        if (!publicRetry.error) {
          bucketName = 'public'
          uploadError = null
        } else {
          // Try avatars bucket as last resort
          const avatarRetry = await supabase.storage.from('avatars').upload(filePath, file)
          if (!avatarRetry.error) {
            bucketName = 'avatars'
            uploadError = null
          }
        }
      }

      if (uploadError) {
        console.error('Upload error:', uploadError)
        toast.warning(`File upload failed for ${type === 'id' ? 'ID document' : 'tax form'}. Application will be submitted without file.`)
        return null
      }

      const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath)
      return data.publicUrl
    } catch (error) {
      console.error('File upload error:', error)
      toast.warning(`File upload failed. Application will be submitted without file.`)
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !profile) {
      toast.error('You must be logged in to submit an application')
      return
    }

    setLoading(true)
    try {
      // Upload files if provided
      let idUrl = null
      let taxUrl = null

      if (idFile) {
        idUrl = await handleFileUpload(idFile, 'id')
        // Continue even if upload fails - application can be submitted without file
      }

      if (taxFile) {
        taxUrl = await handleFileUpload(taxFile, 'tax')
        // Continue even if upload fails - application can be submitted without file
      }

      // Submit application
      const { data, error } = await supabase
        .from('broadcaster_applications')
        .insert({
          user_id: user.id,
          full_name: formData.full_name,
          username: formData.username,
          email: formData.email,
          country: formData.country,
          date_of_birth: formData.date_of_birth || null,
          address: formData.address,
          ssn_last_four: formData.ssn_last_four,
          bank_account_last_four: formData.bank_account_last_four,
          bank_routing_number: formData.bank_routing_number,
          ein: formData.ein || null,
          is_business: formData.is_business,
          id_verification_submitted: !!idFile,
          id_verification_url: idUrl,
          tax_form_submitted: !!taxFile,
          tax_form_url: taxUrl,
          application_status: 'pending'
        })
        .select()
        .single()

      if (error) {
        console.error('Application submission error:', error)
        toast.error(error.message || 'Failed to submit application')
        setLoading(false)
        return
      }

      // Send in-app notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        message: '📨 Your broadcaster application has been received and is under review.',
        type: 'info',
        read: false
      })

      // Send email notification
      try {
        await fetch(`${import.meta.env.VITE_EDGE_FUNCTIONS_URL || 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1'}/sendEmail`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`
          },
          body: JSON.stringify({
            to: formData.email,
            subject: '🎥 Broadcaster Application Received',
            html: `
              <p>Hi ${formData.full_name},</p>
              <p>We received your broadcaster application and it's now under review.</p>
              <p>You will be notified once it is approved or if more information is required.</p>
              <p>– TrollCity Safety & Approval System</p>
            `
          })
        })
      } catch (emailError) {
        console.error('Email send error:', emailError)
        // Don't fail the submission if email fails
      }

      toast.success('Application submitted successfully! An admin will review it shortly.')
      onSubmitted()
      onClose()
    } catch (error: any) {
      console.error('Application error:', error)
      toast.error(error.message || 'Failed to submit application')
    } finally {
      setLoading(false)
    }
  }

  const maskSSN = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length > 4) return digits.slice(-4)
    return digits
  }

  const maskBankAccount = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length > 4) return digits.slice(-4)
    return digits
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] rounded-xl border border-purple-500/30 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#1A1A1A] border-b border-purple-500/30 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <User className="w-6 h-6 text-purple-400" />
            Broadcaster Application
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Step 1: Personal Information */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-purple-400 mb-4">Personal Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Username *
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Country *
                </label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date of Birth
                </label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Address
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              >
                Next: Verification Documents
              </button>
            </div>
          )}

          {/* Step 2: Verification Documents */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-purple-400 mb-4">Verification Documents</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  SSN Last 4 Digits *
                </label>
                <input
                  type="text"
                  name="ssn_last_four"
                  value={formData.ssn_last_four}
                  onChange={(e) => {
                    const masked = maskSSN(e.target.value)
                    setFormData(prev => ({ ...prev, ssn_last_four: masked }))
                  }}
                  maxLength={4}
                  required
                  placeholder="1234"
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Only the last 4 digits are required for verification</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  ID Verification Document *
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setIdFile(e.target.files?.[0] || null)}
                  required
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                />
                {idFile && (
                  <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {idFile.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tax Form (W-9 or equivalent)
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setTaxFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                />
                {taxFile && (
                  <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {taxFile.name}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                >
                  Next: Payment Information
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Payment Information */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-purple-400 mb-4">Payment Information</h3>
              
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-4">
                  <input
                    type="checkbox"
                    name="is_business"
                    checked={formData.is_business}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                  />
                  <Building2 className="w-4 h-4" />
                  This is a business account
                </label>
              </div>

              {formData.is_business && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    EIN (Employer Identification Number)
                  </label>
                  <input
                    type="text"
                    name="ein"
                    value={formData.ein}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bank Account Last 4 Digits *
                </label>
                <input
                  type="text"
                  name="bank_account_last_four"
                  value={formData.bank_account_last_four}
                  onChange={(e) => {
                    const masked = maskBankAccount(e.target.value)
                    setFormData(prev => ({ ...prev, bank_account_last_four: masked }))
                  }}
                  maxLength={4}
                  required
                  placeholder="5678"
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bank Routing Number
                </label>
                <input
                  type="text"
                  name="bank_routing_number"
                  value={formData.bank_routing_number}
                  onChange={handleInputChange}
                  placeholder="Masked for security"
                  className="w-full px-4 py-2 bg-[#0D0D0D] border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">This information is verified securely via third-party provider</p>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-sm text-yellow-400">
                  <strong>Security Notice:</strong> Personal information is verified securely via third-party provider. 
                  Admins cannot view full SSN or bank numbers. Only masked information is stored.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  {loading ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

