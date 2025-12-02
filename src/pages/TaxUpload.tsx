import { useState } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'

export default function TaxUploadPage() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploaded, setUploaded] = useState(false)

  if (!user) {
    navigate('/')
    return null
  }

  const uploadTaxForm = async () => {
    if (!file || !user) {
      toast.error('Please select a file')
      return
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are accepted')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    setLoading(true)

    try {
      // Upload to Supabase Storage
      const filePath = `w9/${user.id}_${Date.now()}.pdf`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('tax_forms')
        .upload(filePath, file, { 
          upsert: false,
          contentType: 'application/pdf'
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw uploadError
      }

      // Get public URL (or signed URL for private bucket)
      const { data: urlData } = supabase.storage
        .from('tax_forms')
        .getPublicUrl(filePath)

      // Update user profile
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          tax_form_url: filePath, // Store path, not full URL
          tax_status: 'submitted',
          tax_last_updated: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('Update error:', updateError)
        throw updateError
      }

      // Refresh profile
      const { data: updatedProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (updatedProfile) {
        useAuthStore.getState().setProfile(updatedProfile as any)
      }

      setUploaded(true)
      toast.success('W-9 form submitted successfully!')
      
      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/account/wallet')
      }, 2000)
    } catch (error: any) {
      console.error('Tax form upload error:', error)
      toast.error(error.message || 'Failed to upload tax form. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const currentStatus = profile?.tax_status || 'not_required'

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-purple-400" />
            <h1 className="text-2xl font-bold">Submit W-9 Tax Form</h1>
          </div>

          {/* Status Display */}
          <div className="mb-6 p-4 rounded-lg bg-[#1A1A1A] border border-[#2C2C2C]">
            <div className="flex items-center gap-2 mb-2">
              {currentStatus === 'approved' && (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span className="text-green-400 font-semibold">Tax Form Approved</span>
                </>
              )}
              {currentStatus === 'submitted' && (
                <>
                  <Upload className="w-5 h-5 text-yellow-400" />
                  <span className="text-yellow-400 font-semibold">Tax Form Submitted - Pending Review</span>
                </>
              )}
              {currentStatus === 'rejected' && (
                <>
                  <XCircle className="w-5 h-5 text-red-400" />
                  <span className="text-red-400 font-semibold">Tax Form Rejected</span>
                </>
              )}
              {currentStatus === 'required' && (
                <>
                  <AlertTriangle className="w-5 h-5 text-orange-400" />
                  <span className="text-orange-400 font-semibold">Tax Form Required</span>
                </>
              )}
            </div>
            <p className="text-sm text-gray-400">
              {currentStatus === 'approved' && 'Your tax form has been approved. You can now request payouts.'}
              {currentStatus === 'submitted' && 'Your tax form is under review. You will be notified once it\'s processed.'}
              {currentStatus === 'rejected' && 'Your tax form was rejected. Please upload a new, valid W-9 form.'}
              {currentStatus === 'required' && 'You\'ve earned over $600 this year! Please submit a W-9 form to continue cashing out.'}
              {currentStatus === 'not_required' && 'You haven\'t reached the $600 threshold yet. No tax form required at this time.'}
            </p>
          </div>

          {/* Upload Form */}
          {currentStatus !== 'approved' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Upload W-9 Form (PDF only)
                </label>
                <div className="border-2 border-dashed border-[#2C2C2C] rounded-lg p-6 text-center hover:border-purple-500 transition-colors">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="tax-file-input"
                    disabled={loading || uploaded}
                  />
                  <label
                    htmlFor="tax-file-input"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Upload className="w-8 h-8 text-gray-400" />
                    <span className="text-sm text-gray-400">
                      {file ? file.name : 'Click to select PDF file'}
                    </span>
                    <span className="text-xs text-gray-500">
                      Maximum file size: 10MB
                    </span>
                  </label>
                </div>
              </div>

              {file && (
                <div className="p-3 bg-[#1A1A1A] rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-gray-300">{file.name}</span>
                    <span className="text-xs text-gray-500">
                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="text-red-400 hover:text-red-300 text-sm"
                    disabled={loading}
                  >
                    Remove
                  </button>
                </div>
              )}

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-sm text-blue-300">
                  <strong>Privacy Notice:</strong> Your W-9 form is stored securely and privately. 
                  Only authorized administrators can access your tax documents.
                </p>
              </div>

              <button
                disabled={!file || loading || uploaded}
                onClick={uploadTaxForm}
                className="w-full px-4 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Uploading...
                  </>
                ) : uploaded ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Uploaded Successfully
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Submit W-9 Form
                  </>
                )}
              </button>
            </div>
          )}

          {/* Success Message */}
          {uploaded && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-green-400 text-sm">
                ✓ Your W-9 form has been submitted and is pending admin review. 
                You'll be notified once it's processed.
              </p>
            </div>
          )}

          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="mt-6 text-sm text-gray-400 hover:text-gray-300"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}

