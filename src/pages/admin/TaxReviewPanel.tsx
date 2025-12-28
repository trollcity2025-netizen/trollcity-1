import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { FileText, CheckCircle2, XCircle, Download, Eye } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function TaxReviewPanel() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  // Check admin access
  useEffect(() => {
    if (profile && !['admin', 'troll_officer'].includes(profile.role)) {
      toast.error('Access denied')
      navigate('/')
    }
  }, [profile, navigate])

  useEffect(() => {
    if (!profile || !['admin', 'troll_officer'].includes(profile.role)) return
    loadReviews()
  }, [profile])

  const loadReviews = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('admin_tax_reviews')
        .select('*')
        .order('tax_last_updated', { ascending: false })

      if (error) throw error
      setReviews(data || [])
    } catch (error: any) {
      console.error('Error loading tax reviews:', error)
      toast.error('Failed to load tax reviews')
    } finally {
      setLoading(false)
    }
  }

  const approveTaxForm = async (userId: string) => {
    setProcessing(userId)
    try {
      const { error } = await supabase.rpc('approve_tax_form', {
        user_id_input: userId
      })

      if (error) throw error

      toast.success('Tax form approved')
      loadReviews()
    } catch (error: any) {
      console.error('Error approving tax form:', error)
      toast.error(error.message || 'Failed to approve tax form')
    } finally {
      setProcessing(null)
    }
  }

  const rejectTaxForm = async (userId: string) => {
    setProcessing(userId)
    try {
      const { error } = await supabase.rpc('reject_tax_form', {
        user_id_input: userId
      })

      if (error) throw error

      toast.success('Tax form rejected')
      loadReviews()
    } catch (error: any) {
      console.error('Error rejecting tax form:', error)
      toast.error(error.message || 'Failed to reject tax form')
    } finally {
      setProcessing(null)
    }
  }

  const downloadTaxForm = async (filePath: string, username: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('tax_forms')
        .download(filePath)

      if (error) throw error

      // Create download link
      const url = window.URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `w9_${username}_${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Tax form downloaded')
    } catch (error: any) {
      console.error('Error downloading tax form:', error)
      toast.error('Failed to download tax form')
    }
  }

  const viewTaxForm = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('tax_forms')
        .createSignedUrl(filePath, 3600) // 1 hour expiry

      if (error) throw error

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
      }
    } catch (error: any) {
      console.error('Error viewing tax form:', error)
      toast.error('Failed to view tax form')
    }
  }

  if (!profile || !['admin', 'troll_officer'].includes(profile.role)) {
    return null
  }

  if (loading) {
    return (
      <div className="p-6 text-slate-300 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p>Loading tax reviews…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#0A0814] text-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-purple-400" />
          <h1 className="text-3xl font-bold text-transparent bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text">
            Tax Form Reviews
          </h1>
        </div>
        <button
          onClick={loadReviews}
          className="px-4 py-2 rounded-lg bg-[#1A1A1A] border border-[#2C2C2C] hover:bg-[#2A2A2A] transition-colors"
        >
          Refresh
        </button>
      </div>

      {reviews.length === 0 ? (
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-8 text-center">
          <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No tax forms pending review</p>
        </div>
      ) : (
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#1A1A1A]">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-300 font-semibold">User</th>
                  <th className="px-4 py-3 text-left text-gray-300 font-semibold">Status</th>
                  <th className="px-4 py-3 text-left text-gray-300 font-semibold">Submitted</th>
                  <th className="px-4 py-3 text-left text-gray-300 font-semibold">Balance</th>
                  <th className="px-4 py-3 text-center text-gray-300 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2C2C2C]">
                {reviews.map((review) => (
                  <tr key={review.id} className="hover:bg-[#1A1A1A]">
                    <td className="px-4 py-3">
                      <div className="font-medium">@{review.username}</div>
                      <div className="text-xs text-gray-400">ID: {review.id.substring(0, 8)}...</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                          review.tax_status === 'submitted'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {review.tax_status === 'submitted' ? (
                          <>
                            <FileText className="w-3 h-3" />
                            Pending
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            Rejected
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {review.tax_last_updated
                        ? new Date(review.tax_last_updated).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-yellow-400 font-semibold">
                        {(review.troll_coins || 0).toLocaleString()} coins
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-center">
                        {review.tax_form_url && (
                          <>
                            <button
                              type="button"
                              onClick={() => viewTaxForm(review.tax_form_url)}
                              className="p-2 rounded-lg bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-[#2C2C2C] transition-colors"
                              title="View PDF"
                            >
                              <Eye className="w-4 h-4 text-blue-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadTaxForm(review.tax_form_url, review.username)}
                              className="p-2 rounded-lg bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-[#2C2C2C] transition-colors"
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4 text-green-400" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => approveTaxForm(review.id)}
                          disabled={processing === review.id}
                          className="px-3 py-1 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectTaxForm(review.id)}
                          disabled={processing === review.id}
                          className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center gap-1"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

