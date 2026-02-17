import React, { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { Mail, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type ContactSetting = {
  email?: string
}

export default function Contact() {
  const [loading, setLoading] = useState(true)
  const [contactEmail, setContactEmail] = useState('trollcity2025@gmail.com')

  useEffect(() => {
    const loadContact = async () => {
      try {
        const { data, error } = await supabase
          .from('admin_app_settings')
          .select('setting_value')
          .eq('setting_key', 'public_contact_email')
          .maybeSingle()

        if (error && error.code !== 'PGRST116') {
          throw error
        }

        const settingValue = data?.setting_value as ContactSetting | null
        if (settingValue?.email) {
          setContactEmail(settingValue.email)
        }
      } catch (err) {
        console.error('Failed to load contact email', err)
        toast.error('Failed to load contact details')
      } finally {
        setLoading(false)
      }
    }

    loadContact()
  }, [])

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white px-6 py-10">
        <div className="max-w-3xl mx-auto space-y-10">
          <header className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              Contact
            </h1>
            <p className="text-slate-400">
              Reach our executive team directly for platform, investor, or partnership inquiries.
            </p>
          </header>

          <section className="bg-[#14121D] border border-white/10 rounded-2xl p-6">
            {loading ? (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading contact...
              </div>
            ) : (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm uppercase tracking-widest text-slate-500">Executive Contact</div>
                  <div className="text-lg font-semibold text-white">CEO</div>
                  <div className="text-sm text-slate-300">Email</div>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="text-cyan-300 hover:text-cyan-200 transition-colors"
                  >
                    {contactEmail}
                  </a>
                </div>
                <div className="flex items-center gap-3 text-cyan-400">
                  <Mail className="w-5 h-5" />
                  <span className="text-sm">We respond within 2 business days.</span>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  )
}
