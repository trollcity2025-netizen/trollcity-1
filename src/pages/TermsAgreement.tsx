import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { CheckCircle, XCircle, FileText } from 'lucide-react'

export default function TermsAgreement() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleAgree = async () => {
    if (!agreed) {
      toast.error('You must agree to the terms to continue')
      return
    }

    setSubmitting(true)
    try {
      // Update profile to mark terms as accepted with timestamp
      if (profile) {
        console.log('[Terms] Updating profile to mark terms as accepted for user:', profile.username)
        
        // Update database first
        const { error: dbError } = await supabase
          .from('user_profiles')
          .update({ 
            terms_accepted: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', profile.id)
        
        if (dbError) {
          console.error('[Terms] Database update error:', dbError)
          toast.error('Failed to save agreement. Please try again.')
          setSubmitting(false)
          return
        }
        
        console.log('[Terms] Database updated successfully')
        
        // Then update local store
        const updatedProfile = { 
          ...profile, 
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString()
        } as any
        
        useAuthStore.getState().setProfile(updatedProfile)
        console.log('[Terms] Store updated, navigating to home')
      }

      toast.success('Welcome to Troll City!')
      navigate('/home')
    } catch (err) {
      console.error('[Terms] Agreement error:', err)
      toast.error('Failed to save agreement')
    } finally {
      setSubmitting(false)
    }
  }

  const terms = {
    pros: [
      { icon: '💰', title: 'Earn Real Money', desc: 'Cash out your earned coins through streaming and engagement' },
      { icon: '🎮', title: 'Interactive Features', desc: 'Engage with gifts, wheels, family wars, and more' },
      { icon: '🏆', title: 'Level Up System', desc: 'Progress through 100 levels with custom tier names and rewards' },
      { icon: '👑', title: 'Exclusive Badges', desc: 'Earn OG badges, admin badges, and family crowns' },
      { icon: '🎯', title: 'Fair Play', desc: 'Transparent rules and moderation for all users' },
      { icon: '🌟', title: 'Community', desc: 'Join troll families and compete in weekly wars' },
    ],
    rules: [
      { icon: '🚫', title: 'Zero Tolerance Policy', desc: 'Harassment, hate speech, or illegal content results in immediate permanent ban' },
      { icon: '⚠️', title: 'Account Responsibility', desc: 'You are responsible for all activity on your account. Secure your credentials.' },
      { icon: '💸', title: 'No Chargebacks', desc: 'All coin purchases are final. Chargebacks will result in permanent ban.' },
      { icon: '🔒', title: 'Account Reset on Ban', desc: 'Banned users lose ALL progress: coins, XP, level, badges reset to 0' },
      { icon: '📊', title: 'Platform Fees', desc: 'All transactions include platform fees. See cashout page for current rates.' },
      { icon: '🎥', title: 'Content Ownership', desc: 'By streaming, you grant Troll City rights to use your content for promotion' },
      { icon: '⚖️', title: 'Dispute Resolution', desc: 'All disputes must go through our support ticket system first' },
      { icon: '🔄', title: 'Terms Can Change', desc: 'We reserve the right to update these terms. Continued use means acceptance.' },
    ]
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <FileText className="w-16 h-16 mx-auto mb-4 text-troll-neon-blue" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text text-transparent mb-2">
            Welcome to Troll City
          </h1>
          <p className="text-gray-400">Please read and agree to our platform terms before continuing</p>
        </div>

        {/* Pros Section */}
        <div className="bg-[#1A1A1A] rounded-xl border border-green-500/30 p-6 mb-6">
          <h2 className="text-2xl font-bold text-green-400 mb-4 flex items-center gap-2">
            <CheckCircle className="w-6 h-6" />
            Platform Benefits
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {terms.pros.map((pro, i) => (
              <div key={i} className="flex gap-3 p-4 bg-[#0D0D1A] rounded-lg border border-[#2C2C2C]">
                <span className="text-3xl">{pro.icon}</span>
                <div>
                  <h3 className="font-semibold text-green-300">{pro.title}</h3>
                  <p className="text-sm text-gray-400">{pro.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rules Section */}
        <div className="bg-[#1A1A1A] rounded-xl border border-red-500/30 p-6 mb-6">
          <h2 className="text-2xl font-bold text-red-400 mb-4 flex items-center gap-2">
            <XCircle className="w-6 h-6" />
            Platform Rules & Consequences
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {terms.rules.map((rule, i) => (
              <div key={i} className="flex gap-3 p-4 bg-[#0D0D1A] rounded-lg border border-[#2C2C2C]">
                <span className="text-3xl">{rule.icon}</span>
                <div>
                  <h3 className="font-semibold text-red-300">{rule.title}</h3>
                  <p className="text-sm text-gray-400">{rule.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key Highlight */}
        <div className="bg-gradient-to-r from-red-900/50 to-orange-900/50 border-2 border-red-500 rounded-xl p-6 mb-6">
          <h3 className="text-xl font-bold text-red-300 mb-2">⚠️ CRITICAL: Ban Policy</h3>
          <p className="text-white">
            When you are banned, your account is <strong>completely reset</strong>. You will lose:
          </p>
          <ul className="list-disc list-inside mt-2 text-gray-200 space-y-1">
            <li>All paid coins (non-refundable)</li>
            <li>All free coins</li>
            <li>All XP and levels (back to Level 1)</li>
            <li>All badges and achievements</li>
            <li>All earnings history</li>
          </ul>
          <p className="mt-3 text-yellow-300 font-semibold">
            Follow the rules. Play fair. Build your legacy.
          </p>
        </div>

        {/* Agreement Checkbox */}
        <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] p-6 mb-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-5 h-5 accent-troll-purple"
            />
            <span className="text-gray-300">
              I have read and agree to all the terms, rules, and consequences listed above. 
              I understand that violating these terms may result in permanent ban with complete account reset. 
              I am at least 13 years old and have permission from a parent/guardian if under 18.
            </span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => {
              supabase.auth.signOut()
              navigate('/auth')
            }}
            className="px-8 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
          >
            Decline & Sign Out
          </button>
          <button
            onClick={handleAgree}
            disabled={!agreed || submitting}
            className="px-8 py-3 rounded-lg bg-gradient-to-r from-troll-purple to-troll-neon-blue 
                     disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition font-bold"
          >
            {submitting ? 'Processing...' : 'Agree & Continue'}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-8">
          Questions? Contact support at trollcity2025@gmail.com
        </p>
      </div>
    </div>
  )
}
