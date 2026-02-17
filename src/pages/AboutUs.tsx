import React, { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'

type InvestorSetting = {
  content?: string
}

export default function AboutUs() {
  const { profile, user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [investorContent, setInvestorContent] = useState('')

  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true

  useEffect(() => {
    const loadContent = async () => {
      try {
        const { data, error } = await supabase
          .from('admin_app_settings')
          .select('setting_value')
          .eq('setting_key', 'about_investor_opportunities')
          .maybeSingle()

        if (error && error.code !== 'PGRST116') {
          throw error
        }

        const settingValue = data?.setting_value as InvestorSetting | null
        setInvestorContent(settingValue?.content || '')
      } catch (err) {
        console.error('Failed to load investor opportunities', err)
        toast.error('Failed to load investor opportunities')
      } finally {
        setLoading(false)
      }
    }

    loadContent()
  }, [])

  const handleSave = async () => {
    if (!isAdmin) return

    try {
      setSaving(true)
      const { error } = await supabase
        .from('admin_app_settings')
        .upsert({
          setting_key: 'about_investor_opportunities',
          setting_value: { content: investorContent },
          description: 'About page investor opportunities blurb',
          updated_at: new Date().toISOString(),
          updated_by: user?.id || null
        })

      if (error) throw error
      toast.success('Investor opportunities saved')
    } catch (err) {
      console.error('Failed to save investor opportunities', err)
      toast.error('Failed to save investor opportunities')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-10">
          <header className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              About Us
            </h1>
            <p className="text-slate-400">
              Troll City is a creator-first entertainment platform built for bold communities, live events, and real-time culture.
            </p>
          </header>

          <section className="bg-[#14121D] border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-2xl font-semibold text-white">Investor Opportunities</h2>
            {loading ? (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading details...
              </div>
            ) : isAdmin ? (
              <>
                <textarea
                  value={investorContent}
                  onChange={(event) => setInvestorContent(event.target.value)}
                  rows={6}
                  className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  placeholder="Describe investor opportunities, updates, and contact expectations."
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-400 disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-300 whitespace-pre-line">
                {investorContent || 'Investor opportunities are available. Please contact our CEO for details.'}
              </p>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  )
}
