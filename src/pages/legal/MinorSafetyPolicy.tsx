import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Shield, AlertTriangle, Gavel, Scale } from 'lucide-react';

/**
 * Troll City Minor Safety Policy Page
 */
export default function MinorSafetyPolicy() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-purple-500/20 border-2 border-yellow-400 mb-6">
            <Users className="text-yellow-400" size={40} />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-purple-400 to-green-400 mb-4">
            Minor Safety Policy
          </h1>
          <p className="text-zinc-400 text-lg">
            Protecting minors on Troll City through community vigilance and clear guidelines
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* Overview */}
          <section className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <Shield className="text-green-400" />
              Platform Commitment
            </h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              Troll City is committed to creating a safe environment for all users. While our platform 
              is designed for adult users (18+), we recognize that minors may occasionally appear on 
              broadcasts when supervised by their adult guardians.
            </p>
            <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl p-4">
              <p className="text-yellow-400 font-bold">
                Important: Troll City accounts must be held by adults 18 years or older.
              </p>
            </div>
          </section>

          {/* Rules */}
          <section className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <Scale className="text-purple-400" />
              Minor Supervision Rules
            </h2>
            
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <span className="text-green-400 font-bold">1</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Adult Supervision Required</h3>
                  <p className="text-zinc-400">
                    Minors may appear on broadcasts ONLY when the adult account holder remains present 
                    and actively supervising at all times. The supervising adult must be visible and 
                    engaged with the broadcast.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <span className="text-green-400 font-bold">2</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Never Leave Minors Unattended</h3>
                  <p className="text-zinc-400">
                    If the adult account holder needs to leave, the broadcast must be ended or the 
                    minor must be removed from camera view. Leaving a minor unsupervised on a live 
                    stream is a serious violation.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <span className="text-green-400 font-bold">3</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Enable Minor Indicator</h3>
                  <p className="text-zinc-400">
                    Users who may have minors appear on their streams should enable the 
                    "Minor Supervision Indicator" in their profile settings. This displays 
                    a visible badge to inform viewers that minors may be present.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <span className="text-green-400 font-bold">4</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">No Exploitation</h3>
                  <p className="text-zinc-400">
                    Any form of harassment, exploitation, or inappropriate interaction with minors 
                    is strictly prohibited and will result in immediate account termination and 
                    potential legal action.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Violations */}
          <section className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <AlertTriangle className="text-red-400" />
              Violation Consequences
            </h2>
            
            <p className="text-zinc-400 mb-6">
              Leaving a minor unsupervised on a live stream will result in escalating penalties:
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
                <div className="text-yellow-400 font-bold mb-2">First Offense</div>
                <p className="text-sm text-zinc-400">Official warning and court summons to Troll Court</p>
              </div>
              
              <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
                <div className="text-orange-400 font-bold mb-2">Second Offense</div>
                <p className="text-sm text-zinc-400">24 hours in Troll Jail + broadcast restrictions</p>
              </div>
              
              <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
                <div className="text-red-400 font-bold mb-2">Third Offense</div>
                <p className="text-sm text-zinc-400">7-day broadcast ban</p>
              </div>
              
              <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
                <div className="text-red-500 font-bold mb-2">Fourth Offense</div>
                <p className="text-sm text-zinc-400">Permanent broadcast ban</p>
              </div>
            </div>
          </section>

          {/* Reporting */}
          <section className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <Gavel className="text-purple-400" />
              Reporting Violations
            </h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              All users are encouraged to report violations. If you observe a minor left unsupervised 
              on a broadcast, please use the "Minor Left Unsupervised" report option and 
              include screenshot evidence if possible.
            </p>
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
              <p className="text-purple-400 text-sm">
                Reports are reviewed by moderators. False reports may result in penalties against 
                the reporter. All reports are kept confidential.
              </p>
            </div>
          </section>

          {/* Related Links */}
          <section className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/legal/community-guidelines"
              className="px-6 py-3 bg-zinc-800 rounded-xl text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              Community Guidelines
            </Link>
            <Link
              to="/legal/terms"
              className="px-6 py-3 bg-zinc-800 rounded-xl text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              to="/legal/privacy"
              className="px-6 py-3 bg-zinc-800 rounded-xl text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              Privacy Policy
            </Link>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-zinc-600 text-sm">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          <p className="mt-2">Troll City Platform</p>
        </div>
      </div>
    </div>
  );
}
