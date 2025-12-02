import React from 'react'
import { Link } from 'react-router-dom'
import { Shield, AlertTriangle, Lock, Eye, MessageSquare, Ban, Users, FileText } from 'lucide-react'

export default function Safety() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center mb-8">
          <Shield className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">Safety & Policies</h1>
          <p className="text-gray-400">Your safety and privacy are our top priorities</p>
        </div>

        {/* Community Guidelines */}
        <section className="bg-[#1A1A1A] border border-purple-500/30 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-purple-300 mb-4 flex items-center gap-2">
            <Users className="w-6 h-6" />
            Community Guidelines
          </h2>
          <div className="space-y-4 text-gray-300">
            <div>
              <h3 className="font-semibold text-white mb-2">Respect Others</h3>
              <p className="text-sm">Treat all users with respect. Harassment, bullying, hate speech, or discrimination of any kind is strictly prohibited.</p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">No Illegal Content</h3>
              <p className="text-sm">Do not share, promote, or engage in any illegal activities. This includes but is not limited to drugs, weapons, or other prohibited content.</p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">No Scams or Fraud</h3>
              <p className="text-sm">Do not attempt to scam, defraud, or deceive other users. All transactions must be legitimate and transparent.</p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">Age Restrictions</h3>
              <p className="text-sm">You must be 18+ to use TrollCity. Do not share content that is inappropriate for minors.</p>
            </div>
          </div>
        </section>

        {/* Reporting System */}
        <section className="bg-[#1A1A1A] border border-purple-500/30 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-purple-300 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6" />
            Reporting Violations
          </h2>
          <div className="space-y-4 text-gray-300">
            <p className="text-sm">If you encounter any violations of our community guidelines, please report them immediately:</p>
            <ul className="list-disc list-inside space-y-2 text-sm ml-4">
              <li>Click the "Report" button on any user profile or stream</li>
              <li>Select the appropriate reason for your report</li>
              <li>Provide a detailed description of the violation</li>
              <li>Our Troll Officers will review your report within 24 hours</li>
            </ul>
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mt-4">
              <p className="text-sm text-yellow-300">
                <strong>Important:</strong> False reports may result in account restrictions. Only report genuine violations.
              </p>
            </div>
          </div>
        </section>

        {/* Privacy & Security */}
        <section className="bg-[#1A1A1A] border border-purple-500/30 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-purple-300 mb-4 flex items-center gap-2">
            <Lock className="w-6 h-6" />
            Privacy & Security
          </h2>
          <div className="space-y-4 text-gray-300">
            <div>
              <h3 className="font-semibold text-white mb-2">Your Data</h3>
              <p className="text-sm">We protect your personal information and never share it with third parties without your consent. All payment information is encrypted and secure.</p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">Account Security</h3>
              <p className="text-sm">Keep your account secure by using a strong password and never sharing your login credentials. Enable two-factor authentication if available.</p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">Blocking Users</h3>
              <p className="text-sm">You can block any user from your profile settings. Blocked users cannot message you or view your profile.</p>
            </div>
          </div>
        </section>

        {/* Moderation Actions */}
        <section className="bg-[#1A1A1A] border border-purple-500/30 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-purple-300 mb-4 flex items-center gap-2">
            <Ban className="w-6 h-6" />
            Moderation Actions
          </h2>
          <div className="space-y-4 text-gray-300">
            <div>
              <h3 className="font-semibold text-yellow-400 mb-2">⚠️ Warning</h3>
              <p className="text-sm">For minor first-time offenses. You'll receive a notification about the violation.</p>
            </div>
            <div>
              <h3 className="font-semibold text-orange-400 mb-2">⏸️ Stream Suspension</h3>
              <p className="text-sm">For repeated violations. Your stream will be temporarily suspended.</p>
            </div>
            <div>
              <h3 className="font-semibold text-red-400 mb-2">🚫 Account Ban</h3>
              <p className="text-sm">For serious violations or after multiple warnings. Bans can be temporary or permanent. Being honest about why you were banned will help you get back on the app.</p>
            </div>
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mt-4">
              <p className="text-sm text-blue-300">
                <strong>Appeal Process:</strong> If you believe a moderation action was incorrect, you can appeal through the Support page. Honesty and understanding the reason for your ban can lead to account restoration.
              </p>
            </div>
          </div>
        </section>

        {/* Contact Support */}
        <section className="bg-[#1A1A1A] border border-purple-500/30 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-purple-300 mb-4 flex items-center gap-2">
            <MessageSquare className="w-6 h-6" />
            Need Help?
          </h2>
          <div className="space-y-4 text-gray-300">
            <p className="text-sm">If you have questions, concerns, or need assistance:</p>
            <ul className="list-disc list-inside space-y-2 text-sm ml-4">
              <li>Visit the Support page in your dashboard</li>
              <li>Contact our Troll Officers through the moderation system</li>
              <li>Email support for urgent matters</li>
            </ul>
          </div>
        </section>

        {/* Legal Links */}
        <section className="bg-[#1A1A1A] border border-purple-500/30 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-purple-300 mb-4 flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Legal Documents
          </h2>
          <div className="space-y-2">
            <Link to="/legal/terms" className="block text-purple-400 hover:text-purple-300 text-sm">Terms of Service</Link>
            <Link to="/legal/refunds" className="block text-purple-400 hover:text-purple-300 text-sm">Refund Policy</Link>
            <Link to="/legal/payouts" className="block text-purple-400 hover:text-purple-300 text-sm">Payout Policy</Link>
            <Link to="/legal/safety" className="block text-purple-400 hover:text-purple-300 text-sm">Safety Guidelines</Link>
          </div>
        </section>
      </div>
    </div>
  )
}

