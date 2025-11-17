import React from 'react';
import { Card } from '@/components/ui/card';
import { Shield, Lock, Eye, Users, MessageSquare, AlertTriangle, CheckCircle } from 'lucide-react';

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2e] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Community Rules & Guidelines</h1>
          <p className="text-gray-400">Keeping TrollCity safe and fun for everyone</p>
        </div>

        <div className="grid gap-6">
          {/* Privacy & Safety Section */}
          <Card className="p-6 bg-[#11121a] border-[#2a2a3a]">
            <div className="flex items-center mb-4">
              <Lock className="w-6 h-6 text-blue-400 mr-3" />
              <h2 className="text-xl font-semibold text-white">Privacy & Safety</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Eye className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <h3 className="text-white font-medium">Personal Information</h3>
                  <p className="text-gray-300 text-sm">Never share personal information such as your real name, address, phone number, or financial details in public chats or with other users.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Users className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <h3 className="text-white font-medium">User Interactions</h3>
                  <p className="text-gray-300 text-sm">Be respectful in all interactions. Harassment, bullying, or any form of abuse will not be tolerated and may result in immediate account suspension.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <h3 className="text-white font-medium">Account Security</h3>
                  <p className="text-gray-300 text-sm">Keep your account credentials secure. Do not share your password or login information with anyone. Report suspicious activity immediately.</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Content Guidelines */}
          <Card className="p-6 bg-[#11121a] border-[#2a2a3a]">
            <div className="flex items-center mb-4">
              <MessageSquare className="w-6 h-6 text-green-400 mr-3" />
              <h2 className="text-xl font-semibold text-white">Content Guidelines</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                <div>
                  <h3 className="text-white font-medium">Appropriate Content</h3>
                  <p className="text-gray-300 text-sm">Keep all content family-friendly and suitable for a general audience. No explicit, violent, or hateful content is allowed.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div>
                  <h3 className="text-white font-medium">Spam & Abuse</h3>
                  <p className="text-gray-300 text-sm">Do not spam, flood chats, or use automated systems to disrupt the community. This includes excessive messaging, repetitive content, or malicious scripts.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Users className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <h3 className="text-white font-medium">Respectful Communication</h3>
                  <p className="text-gray-300 text-sm">Treat all users with respect regardless of their background, beliefs, or opinions. Constructive criticism is welcome, but personal attacks are not.</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Community Standards */}
          <Card className="p-6 bg-[#11121a] border-[#2a2a3a]">
            <div className="flex items-center mb-4">
              <Users className="w-6 h-6 text-purple-400 mr-3" />
              <h2 className="text-xl font-semibold text-white">Community Standards</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                <div>
                  <h3 className="text-white font-medium">Positive Environment</h3>
                  <p className="text-gray-300 text-sm">Contribute to a positive and welcoming environment. Help new users feel welcome and assist others when possible.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div>
                  <h3 className="text-white font-medium">Reporting Issues</h3>
                  <p className="text-gray-300 text-sm">Report any violations of these rules or suspicious behavior to moderators or administrators. Do not attempt to handle serious issues yourself.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <h3 className="text-white font-medium">Consequences</h3>
                  <p className="text-gray-300 text-sm">Violations of these rules may result in warnings, temporary suspensions, or permanent bans depending on the severity and frequency of the offense.</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Enforcement */}
          <Card className="p-6 bg-[#11121a] border-[#2a2a3a]">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400 mr-3" />
              <h2 className="text-xl font-semibold text-white">Enforcement & Appeals</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <p className="text-sm">Our moderation team actively monitors the platform to ensure compliance with these rules. We use a combination of automated systems and human review to identify violations.</p>
              <p className="text-sm">If you believe a moderation action was taken in error, you can appeal by contacting our support team. Provide relevant details and context for your appeal.</p>
              <p className="text-sm">These rules may be updated periodically. We encourage users to review them regularly to stay informed about any changes.</p>
            </div>
          </Card>

          {/* Contact */}
          <Card className="p-6 bg-[#11121a] border-[#2a2a3a]">
            <div className="flex items-center mb-4">
              <MessageSquare className="w-6 h-6 text-blue-400 mr-3" />
              <h2 className="text-xl font-semibold text-white">Contact & Support</h2>
            </div>
            <div className="text-gray-300 space-y-2">
              <p className="text-sm">For questions about these rules or to report violations:</p>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>Use the in-app reporting features</li>
                <li>Contact moderators through official channels</li>
                <li>Reach out to administrators for serious concerns</li>
              </ul>
              <p className="text-sm mt-4">Thank you for helping us maintain a safe and enjoyable community for everyone!</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}