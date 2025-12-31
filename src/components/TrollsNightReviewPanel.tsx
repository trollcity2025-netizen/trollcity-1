import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { CheckCircle, RefreshCcw, Shield, Sparkles, XCircle } from 'lucide-react'

type TrollsNightApplicationWithProfile = {
  id: string
  user_id: string
  status: 'pending' | 'approved' | 'rejected' | 'disqualified'
  rejection_reason?: string | null
  rejection_count?: number
  category_preference?: string
  id_document_url?: string
  created_at?: string
  user_profiles?: {
    id: string
    username?: string | null
    avatar_url?: string | null
  }[]
}

export default function TrollsNightReviewPanel({ title }: { title?: string }) {
  const { profile } = useAuthStore()
  const [applications, setApplications] = useState<TrollsNightApplicationWithProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const [reasonInputs, setReasonInputs] = useState<Record<string, string>>({})

  const loadApplications = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('trolls_night_applications')
        .select(`
          id,
          user_id,
          status,
          rejection_reason,
          rejection_count,
          category_preference,
          id_document_url,
          created_at,
          user_profiles!user_id (
            id,
            username,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(25)

      if (error) throw error
      setApplications(data || [])
    } catch (error) {
      console.error('Failed to load Trolls Night applications', error)
      toast.error('Unable to load Trolls @ Night applications.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadApplications()
    const channel = supabase
      .channel('trolls-night-apps')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trolls_night_applications' }, () => {
        loadApplications()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const updateApplication = async (
    appId: string,
    status: 'approved' | 'rejected',
    extra: Record<string, any> = {}
  ) => {
    setProcessing(appId)
    try {
      const payload = {
        status,
        last_reviewed_by: profile?.id || null,
        last_reviewed_at: new Date().toISOString(),
        ...extra,
      }

      const { error } = await supabase.from('trolls_night_applications').update(payload).eq('id', appId)
      if (error) throw error
      toast.success('Application reviewed.')
      loadApplications()
    } catch (error) {
      console.error('Failed to review application', error)
      toast.error('Unable to update application.')
    } finally {
      setProcessing(null)
    }
  }

  const handleApprove = (appId: string) => {
    updateApplication(appId, 'approved', { rejection_reason: null })
  }

  const handleReject = (app: TrollsNightApplicationWithProfile) => {
    const reason = (reasonInputs[app.id] || '').trim()
    if (!reason) {
      toast.error('Please provide a rejection reason for the applicant.')
      return
    }
    updateApplication(app.id, 'rejected', { rejection_reason: reason })
  }

  return (
    <section className="space-y-4 rounded-[32px] border border-white/10 bg-[#03000b] p-6 shadow-[0_0_40px_rgba(2,10,40,0.5)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm uppercase tracking-[0.4em] text-white/70">
          <Shield className="h-4 w-4 text-amber-300" />
          <span>{title || 'Trolls @ Night applications'}</span>
        </div>
        <button
          onClick={loadApplications}
          className="flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/70"
        >
          <RefreshCcw className="h-3 w-3" />
          Refresh list
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-white/60">Loading applications…</p>
      ) : applications.length === 0 ? (
        <p className="text-sm text-white/60">No Trolls @ Night applications awaiting review.</p>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <div key={app.id} className="space-y-3 rounded-2xl border border-white/10 bg-[#050011] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {app.user_profiles?.[0]?.username || 'Unknown broadcaster'}
                  </p>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                    {app.category_preference || 'No category'}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] ${
                    app.status === 'approved'
                      ? 'border-emerald-400 text-emerald-300'
                      : app.status === 'rejected'
                      ? 'border-red-400 text-red-300'
                      : app.status === 'disqualified'
                      ? 'border-red-700 text-red-200'
                      : 'border-yellow-400 text-yellow-200'
                  }`}
                >
                  {app.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                <Sparkles className="h-4 w-4 text-yellow-400" />
                <p>
                  {app.rejection_count ? `${app.rejection_count} rejection(s)` : 'Fresh application'}
                  {app.status === 'disqualified' && ' • Disqualified after 3 denials'}
                </p>
                {app.id_document_url && (
                  <a
                    href={app.id_document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300"
                  >
                    View ID
                  </a>
                )}
              </div>
              <textarea
                value={reasonInputs[app.id] ?? app.rejection_reason ?? ''}
                placeholder="Rejection reason"
                onChange={(event) => setReasonInputs({ ...reasonInputs, [app.id]: event.target.value })}
                className="w-full rounded-2xl border border-white/10 bg-[#080513] px-3 py-2 text-xs text-white focus:border-pink-500 focus:outline-none"
              />
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleApprove(app.id)}
                  disabled={processing === app.id}
                  className="flex items-center gap-2 rounded-full border border-emerald-500/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </button>
                <button
                  onClick={() => handleReject(app)}
                  disabled={processing === app.id}
                  className="flex items-center gap-2 rounded-full border border-red-500/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
