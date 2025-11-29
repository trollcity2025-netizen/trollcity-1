import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-[#1A1A1A] border border-[#2C2C2C] hover:bg-[#2A2A2A] transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <FileText className="w-8 h-8 text-troll-neon-blue" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text text-transparent">
            Terms of Service
          </h1>
        </div>

        {/* Content */}
        <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              By accessing and using Troll City, you accept and agree to be bound by the terms and provision of this agreement.
              If you do not agree to abide by the above, please do not use this service.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">2. User Accounts</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              You are responsible for maintaining the confidentiality of your account and password.
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
              <li>You must be at least 18 years old to use Troll City</li>
              <li>You must provide accurate and complete information</li>
              <li>You are responsible for all activity on your account</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">3. Content and Conduct</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              Troll City has zero tolerance for harassment, hate speech, or illegal content.
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
              <li>No harassment or bullying</li>
              <li>No hate speech or discrimination</li>
              <li>No illegal content or activity</li>
              <li>No spam or abusive behavior</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">4. Virtual Currency</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              Coins purchased on Troll City are entertainment purchases only and have no real-world value.
              Coins have no gambling value and are not financial instruments.
            </p>
            <p className="text-gray-300 leading-relaxed">
              All purchases are final and non-refundable.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">5. Termination</h2>
            <p className="text-gray-300 leading-relaxed">
              We reserve the right to terminate or suspend your account at any time for violations of these terms.
              Upon termination, you lose access to all content and virtual currency.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">6. Limitation of Liability</h2>
            <p className="text-gray-300 leading-relaxed">
              Troll City shall not be liable for any indirect, incidental, special, or consequential damages
              arising out of or in connection with your use of the service.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">7. Changes to Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              We reserve the right to modify these terms at any time. Continued use of the service
              constitutes acceptance of the updated terms.
            </p>
          </div>

          <div className="pt-6 border-t border-[#2C2C2C]">
            <p className="text-gray-400 text-sm">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}