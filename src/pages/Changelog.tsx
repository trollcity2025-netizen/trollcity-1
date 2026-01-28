import React, { useEffect } from 'react'
import { useAuthStore } from '../lib/store'
import { Navigate, useNavigate } from 'react-router-dom'
import { Calendar, CheckCircle, Code, Zap, Bug, Shield, Users, Star } from 'lucide-react'

export default function Changelog() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0A0814] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  // Prevent refresh redirect - only redirect if not admin
  useEffect(() => {
    if (profile?.role !== 'admin') {
      navigate('/', { replace: true })
    }
  }, [profile?.role, navigate])

  // Only admins can view this page
  if (profile?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  const updates = [
    {
      date: 'December 5, 2025',
      version: 'v1.6.0',
      category: 'fix',
      icon: <Bug className="w-5 h-5" />,
      changes: [
        {
          type: 'fix',
          title: 'Testing Mode Duplicate Key Error',
          description: 'Fixed critical duplicate key constraint violation in testing mode toggle/reset operations. Replaced unreliable upsert operations with update-then-insert pattern that handles race conditions gracefully. Testing mode buttons now work reliably without database errors.',
        },
        {
          type: 'fix',
          title: 'App Settings Column Name Mismatch',
          description: 'Fixed all references to app_settings table columns from "key" to "setting_key" throughout the admin edge function. This resolves schema cache errors and ensures all testing mode operations work correctly.',
        },
        {
          type: 'improvement',
          title: 'Square Connection Panel Enhancement',
          description: 'Completely redesigned Square Payment Connection panel in admin dashboard with real-time connection status, test button, credential verification, and detailed error reporting. Shows environment, connection status, and credential availability at a glance.',
        },
        {
          type: 'fix',
          title: 'Wheel Enable/Disable Buttons',
          description: 'Fixed wheel toggle functionality in admin dashboard. Updated endpoint calls to use correct /admin/wheel/toggle path. Wheel can now be properly enabled and disabled from the admin dashboard.',
        },
        {
          type: 'feature',
          title: 'Complete Route Coverage',
          description: 'Added all missing routes: /admin/payments (Payments Dashboard), /changelog (Changelog page), /account/wallet (Account Wallet), /account/payment-settings (Payment Settings), /account/payments-success and /account/payment-linked (Payment callbacks). All pages are now accessible via proper routes.',
        },
        {
          type: 'improvement',
          title: 'Admin Dashboard UI Reorganization',
          description: 'Reorganized admin dashboard with User Applications section moved to top (always visible) and replaced tab navigation with dropdown menu for better space management and usability.',
        },
        {
          type: 'fix',
          title: 'Edge Function Configuration',
          description: 'Added deno.json configuration files for create-square-checkout and verify-square-payment edge functions. Updated redirect URLs to use environment variables instead of hardcoded domains for better deployment flexibility.',
        },
      ],
    },
    {
      date: 'November 26, 2025',
      version: 'v1.5.0',
      category: 'major',
      icon: <Star className="w-5 h-5" />,
      changes: [
        {
          type: 'feature',
          title: 'Universal Clickable Usernames',
          description: 'All usernames across the entire application are now clickable and route to user profiles. Implemented reusable ClickableUsername component used in StreamRoom, Leaderboard, AdminDashboard, FamilyProfilePage, and 6+ other pages.',
        },
        {
          type: 'feature',
          title: 'New Trollerz Display Enhancement',
          description: 'All user profiles now appear in "New Trollerz" section regardless of profile completion status. Removed avatar filter - now shows ALL users (admin + 7 recent users).',
        },
        {
          type: 'feature',
          title: 'Profile Access for Incomplete Setups',
          description: 'Users without completed profile setup are now fully accessible. Added dual navigation system: username-based (/profile/{username}) and ID-based (/profile/id/{userId}) routes with intelligent fallback.',
        },
        {
          type: 'improvement',
          title: 'Enhanced Profile Lookup',
          description: 'Profile component now supports lookup by username (primary), email prefix (fallback), and user ID (for incomplete profiles). Graceful display with auto-generated dicebear avatars.',
        },
      ],
    },
    {
      date: 'November 25, 2025',
      version: 'v1.4.2',
      category: 'fix',
      icon: <Bug className="w-5 h-5" />,
      changes: [
        {
          type: 'fix',
          title: 'Service Worker API Caching Issue',
          description: 'Fixed service worker permanently caching API calls. Updated to v2 with smart caching - only caches static assets (.js, .css, images, fonts), skips all Supabase and backend API endpoints.',
        },
        {
          type: 'improvement',
          title: 'Admin Dashboard Auto-Refresh',
          description: 'Reduced auto-refresh interval from 10 seconds to 30 seconds to prevent excessive hard refreshes and improve UX.',
        },
        {
          type: 'improvement',
          title: 'Service Worker Registration',
          description: 'Enhanced SW registration in main.tsx with hourly update checks, better error handling, and automatic cleanup of old service workers.',
        },
      ],
    },
    {
      date: 'November 25, 2025',
      version: 'v1.4.1',
      category: 'feature',
      icon: <Shield className="w-5 h-5" />,
      changes: [
        {
          type: 'feature',
          title: 'Support Tickets Database Schema',
          description: 'Created comprehensive SQL migration file CREATE_SUPPORT_TICKETS_TABLE.sql with full schema including username, email, category, subject, message, status, admin_response fields, RLS policies, and proper indexes.',
        },
        {
          type: 'note',
          title: 'Database Migration Required',
          description: 'Support tickets table SQL file created but needs to be manually executed in Supabase SQL Editor to enable support ticket functionality.',
        },
      ],
    },
    {
      date: 'November 24, 2025',
      version: 'v1.4.0',
      category: 'major',
      icon: <Users className="w-5 h-5" />,
      changes: [
        {
          type: 'feature',
          title: 'Terms & Conditions System',
          description: 'Implemented comprehensive Terms Agreement flow with terms_accepted field in user_profiles, blocking modal for non-compliant users (admin exempt), and migration script for existing users.',
        },
        {
          type: 'feature',
          title: 'Reusable Components',
          description: 'Created ClickableUsername component for consistent username display and navigation throughout the app. Supports custom className, prefix, and onClick handlers with hover effects.',
        },
        {
          type: 'security',
          title: 'Admin Role Protection',
          description: 'Enhanced admin role assignment with automatic detection via isAdminEmail function. Prevents accidental admin demotion and ensures proper role maintenance.',
        },
      ],
    },
    {
      date: 'November 23, 2025',
      version: 'v1.3.0',
      category: 'improvement',
      icon: <Zap className="w-5 h-5" />,
      changes: [
        {
          type: 'improvement',
          title: 'Coin Balance Optimization',
          description: 'Implemented coin rotation system with coinOptimizer to intelligently manage paid/free coin balances during transactions.',
        },
        {
          type: 'feature',
          title: 'Gift Transaction System',
          description: 'Enhanced gift sending with proper transaction logging, XP rewards, and real-time updates. Supports wheel spins, entrance effects, and various gift types.',
        },
        {
          type: 'improvement',
          title: 'Progressive Web App (PWA)',
          description: 'Added PWA support with service worker, offline capabilities, install prompts, and manifest.webmanifest for mobile home screen installation.',
        },
      ],
    },
    {
      date: 'November 22, 2025',
      version: 'v1.2.0',
      category: 'feature',
      icon: <Code className="w-5 h-5" />,
      changes: [
        {
          type: 'feature',
          title: 'Admin Dashboard Enhancements',
          description: 'Added comprehensive admin controls including user management, cashout approvals, verification handling, broadcaster monitoring, support tickets, and user agreements tracking.',
        },
        {
          type: 'feature',
          title: 'Streaming Infrastructure',
          description: 'Integrated Agora RTC for live streaming with broadcaster controls, viewer management, multi-beam support, and real-time chat functionality.',
        },
        {
          type: 'feature',
          title: 'Payment Integration',
          description: 'Implemented Square payment processing for coin purchases, cashouts, and subscription management with proper webhook handling.',
        },
      ],
    },
  ]

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'major':
        return 'from-purple-500 to-pink-500'
      case 'feature':
        return 'from-blue-500 to-cyan-500'
      case 'fix':
        return 'from-red-500 to-orange-500'
      case 'improvement':
        return 'from-green-500 to-emerald-500'
      default:
        return 'from-gray-500 to-gray-600'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'feature':
        return <Star className="w-4 h-4" />
      case 'fix':
        return <Bug className="w-4 h-4" />
      case 'improvement':
        return <Zap className="w-4 h-4" />
      case 'security':
        return <Shield className="w-4 h-4" />
      case 'note':
        return <Calendar className="w-4 h-4" />
      default:
        return <CheckCircle className="w-4 h-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'feature':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'fix':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'improvement':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'security':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'note':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Changelog & Updates
              </h1>
              <p className="text-gray-400 text-sm">Admin-only view of all platform changes and improvements</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Shield className="w-4 h-4 text-red-400" />
            <span className="text-red-400 text-sm font-semibold">ADMIN ACCESS ONLY</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-8">
          {updates.map((update, index) => (
            <div key={index} className="relative">
              {/* Timeline Line */}
              {index < updates.length - 1 && (
                <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-gradient-to-b from-purple-500/50 to-transparent" />
              )}

              {/* Update Card */}
              <div className="bg-gradient-to-br from-[#1A1A1A] to-[#0F0F0F] rounded-xl border border-[#2C2C2C] overflow-hidden shadow-lg">
                {/* Header */}
                <div className={`bg-gradient-to-r ${getCategoryColor(update.category)} p-4`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                        {update.icon}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">{update.version}</h2>
                        <div className="flex items-center gap-2 text-sm opacity-90">
                          <Calendar className="w-3 h-3" />
                          <span>{update.date}</span>
                        </div>
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold uppercase">
                      {update.category}
                    </div>
                  </div>
                </div>

                {/* Changes */}
                <div className="p-6 space-y-4">
                  {update.changes.map((change, changeIndex) => (
                    <div
                      key={changeIndex}
                      className="bg-[#1A1A1A] rounded-lg p-4 border border-[#2C2C2C] hover:border-purple-500/30 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`px-2 py-1 rounded border flex items-center gap-1.5 text-xs font-semibold ${getTypeColor(change.type)}`}>
                          {getTypeIcon(change.type)}
                          <span className="uppercase">{change.type}</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-white mb-1">{change.title}</h3>
                          <p className="text-gray-400 text-sm leading-relaxed">{change.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-12 text-center">
          <div className="inline-block bg-[#1A1A1A] border border-[#2C2C2C] rounded-lg px-6 py-4">
            <p className="text-gray-400 text-sm">
              This changelog is automatically updated with each deployment.
              <br />
              Last updated: <span className="text-purple-400 font-semibold">December 5, 2025</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
