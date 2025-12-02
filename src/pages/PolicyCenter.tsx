// PolicyCenter: Central legal hub
import React from 'react'
import { Link } from 'react-router-dom'
import { FileText, Shield, DollarSign, Users, AlertTriangle, Scale } from 'lucide-react'

export default function PolicyCenter() {
  const policies = [
    {
      title: 'Terms of Service',
      description: 'Platform rules and user agreements',
      icon: <FileText className="w-6 h-6" />,
      path: '/legal/terms',
      color: 'text-blue-400',
    },
    {
      title: 'Refund Policy',
      description: 'Coin purchase and gift refund guidelines',
      icon: <DollarSign className="w-6 h-6" />,
      path: '/legal/refund',
      color: 'text-green-400',
    },
    {
      title: 'Safety & Community Guidelines',
      description: 'Community standards and safety rules',
      icon: <Shield className="w-6 h-6" />,
      path: '/legal/safety',
      color: 'text-yellow-400',
    },
    {
      title: 'Creator Earnings Policy',
      description: 'How creators earn and get paid',
      icon: <Users className="w-6 h-6" />,
      path: '/legal/creator-earnings',
      color: 'text-purple-400',
    },
    {
      title: 'Gambling Disclosure',
      description: 'Legal notice about coin usage',
      icon: <AlertTriangle className="w-6 h-6" />,
      path: '/legal/gambling-disclosure',
      color: 'text-red-400',
    },
    {
      title: 'Partner Program Terms',
      description: 'Troll Empire Partner Program rules',
      icon: <Scale className="w-6 h-6" />,
      path: '/legal/partner-program',
      color: 'text-orange-400',
    },
  ]

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Policy Center</h1>
          <p className="text-gray-400">All legal documents, policies, and guidelines in one place</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {policies.map((policy) => (
            <Link
              key={policy.path}
              to={policy.path}
              className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6 hover:border-purple-500 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className={policy.color}>{policy.icon}</div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-1">{policy.title}</h3>
                  <p className="text-sm text-gray-400">{policy.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 bg-[#141414] border border-[#2C2C2C] rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Questions?</h2>
          <p className="text-gray-400">
            If you have questions about our policies, please contact support or review the RFC page for detailed platform rules.
          </p>
        </div>
      </div>
    </div>
  )
}

