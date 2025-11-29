import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPolicy() {
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
          <Shield className="w-8 h-8 text-troll-neon-blue" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text text-transparent">
            Privacy Policy
          </h1>
        </div>

        {/* Content */}
        <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">1. Information We Collect</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              We collect information you provide directly to us, such as when you create an account, make purchases, or contact support.
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
              <li>Account information (username, email, profile data)</li>
              <li>Payment information (processed securely through third parties)</li>
              <li>Streaming content and chat messages</li>
              <li>Usage data and analytics</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">2. How We Use Your Information</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              We use collected information to provide, maintain, and improve our services.
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
              <li>Process transactions and send related information</li>
              <li>Provide customer support and respond to inquiries</li>
              <li>Moderate content and enforce community guidelines</li>
              <li>Analyze usage patterns to improve our platform</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">3. Information Sharing</h2>
            <p className="text-gray-300 leading-relaxed">
              We do not sell, trade, or otherwise transfer your personal information to third parties without your consent,
              except as described in this policy or required by law.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">4. Data Security</h2>
            <p className="text-gray-300 leading-relaxed">
              We implement appropriate security measures to protect your personal information against unauthorized access,
              alteration, disclosure, or destruction.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">5. Your Rights</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              You have certain rights regarding your personal information.
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
              <li>Access and update your personal information</li>
              <li>Request deletion of your account and data</li>
              <li>Opt out of certain data collection</li>
              <li>Data portability requests</li>
            </ul>
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