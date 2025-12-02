import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FileText, Shield, DollarSign, AlertTriangle } from 'lucide-react'

interface LegalLayoutProps {
  children: React.ReactNode
}

export default function LegalLayout({ children }: LegalLayoutProps) {
  const location = useLocation()

  const navItems = [
    { path: '/legal/terms', label: 'Terms of Service', icon: FileText },
    { path: '/legal/refunds', label: 'Refund & Purchase Policy', icon: DollarSign },
    { path: '/legal/payouts', label: 'Creator & Payout Policy', icon: DollarSign },
    { path: '/legal/safety', label: 'Safety & Community Guidelines', icon: Shield }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 lg:flex-row">
        <aside className="w-full max-w-xs rounded-2xl bg-black/60 border border-purple-600/30 p-4 shadow lg:sticky lg:top-6 lg:h-fit">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold tracking-wide text-purple-300">
              Troll City Policy Center
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-400 mb-4">
            Terms, refunds, payouts, and safety rules for the Troll City world.
          </p>
          <nav className="space-y-2 text-sm">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block rounded-lg px-3 py-2 transition-colors ${
                    isActive
                      ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                      : 'hover:bg-gray-800/50 text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              )
            })}
          </nav>
        </aside>

        <main className="flex-1 rounded-2xl bg-black/60 border border-purple-600/30 p-6 shadow-lg">
          {children}
        </main>
      </div>
    </div>
  )
}

