import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Eye, Radio, Users, Building2, Sparkles, Play, TrendingUp, DollarSign, Home, ChevronRight, Settings } from 'lucide-react'

interface SEOPageProps {
  children: React.ReactNode
  title: string
  description: string
  keywords?: string[]
}

const navLinks = [
  { path: '/about', label: 'About', icon: Home },
  { path: '/broadcasting', label: 'Broadcasting', icon: Radio },
  { path: '/categories', label: 'Categories', icon: Sparkles },
  { path: '/seo-government', label: 'Government', icon: Building2 },
  { path: '/creators', label: 'Creators', icon: DollarSign },
  { path: '/live', label: 'Go Live', icon: Play },
]

export default function SEOLayout({ children, title, description, keywords = [] }: SEOPageProps) {
  const location = useLocation()

  React.useEffect(() => {
    document.title = `${title} | Troll City`
    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) {
      metaDesc.setAttribute('content', description)
    } else {
      const newMeta = document.createElement('meta')
      newMeta.name = 'description'
      newMeta.content = description
      document.head.appendChild(newMeta)
    }
    if (keywords.length > 0) {
      const existingKeywords = document.querySelector('meta[name="keywords"]')
      if (existingKeywords) {
        existingKeywords.setAttribute('content', keywords.join(', '))
      } else {
        const newKeywords = document.createElement('meta')
        newKeywords.name = 'keywords'
        newKeywords.content = keywords.join(', ')
        document.head.appendChild(newKeywords)
      }
    }
    window.scrollTo(0, 0)
  }, [title, description, keywords])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Troll City</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon
                const isActive = location.pathname === link.path
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-purple-600/20 text-purple-300'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                )
              })}
            </nav>
            <div className="flex items-center gap-3">
              <Link
                to="/admin"
                className="p-2 text-slate-400 hover:text-white transition-colors"
                title="Admin Dashboard"
              >
                <Settings className="w-5 h-5" />
              </Link>
              <Link
                to="/auth"
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/auth"
                className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        {children}
      </main>

      <footer className="bg-slate-950 border-t border-slate-800 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-white font-semibold mb-4">Platform</h3>
              <ul className="space-y-2">
                <li><Link to="/about" className="text-slate-400 hover:text-purple-300 transition-colors">About</Link></li>
                <li><Link to="/broadcasting" className="text-slate-400 hover:text-purple-300 transition-colors">Broadcasting</Link></li>
                <li><Link to="/categories" className="text-slate-400 hover:text-purple-300 transition-colors">Categories</Link></li>
                <li><Link to="/seo-government" className="text-slate-400 hover:text-purple-300 transition-colors">Government</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Creators</h3>
              <ul className="space-y-2">
                <li><Link to="/creators" className="text-slate-400 hover:text-purple-300 transition-colors">Become a Creator</Link></li>
                <li><Link to="/live" className="text-slate-400 hover:text-purple-300 transition-colors">Go Live</Link></li>
                <li><Link to="/legal/creator-earnings" className="text-slate-400 hover:text-purple-300 transition-colors">Earnings</Link></li>
                <li><Link to="/legal/partner-program" className="text-slate-400 hover:text-purple-300 transition-colors">Partner Program</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Watch</h3>
              <ul className="space-y-2">
                <li><Link to="/explore" className="text-slate-400 hover:text-purple-300 transition-colors">Explore</Link></li>
                <li><Link to="/live-swipe" className="text-slate-400 hover:text-purple-300 transition-colors">Live Streams</Link></li>
                <li><Link to="/badges" className="text-slate-400 hover:text-purple-300 transition-colors">Top Creators</Link></li>
                <li><Link to="/tcnn" className="text-slate-400 hover:text-purple-300 transition-colors">TCNN News</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><Link to="/legal/terms" className="text-slate-400 hover:text-purple-300 transition-colors">Terms of Service</Link></li>
                <li><Link to="/legal/privacy" className="text-slate-400 hover:text-purple-300 transition-colors">Privacy Policy</Link></li>
                <li><Link to="/legal/safety" className="text-slate-400 hover:text-purple-300 transition-colors">Safety Guidelines</Link></li>
                <li><Link to="/support" className="text-slate-400 hover:text-purple-300 transition-colors">Support</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                <Eye className="w-4 h-4 text-white" />
              </div>
              <span className="text-slate-400">© 2026 Troll City. All rights reserved.</span>
              <Link
                to="/admin"
                className="ml-4 px-3 py-1 text-xs text-slate-500 hover:text-purple-400 transition-colors"
              >
                Admin
              </Link>
            </div>
            <div className="flex items-center gap-6 text-slate-400">
              <TrendingUp className="w-5 h-5" />
              <span>Trending Worldwide</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export function Breadcrumb({ items }: { items: { label: string; path?: string }[] }) {
  return (
    <nav className="flex items-center gap-2 text-sm mb-8">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <ChevronRight className="w-4 h-4 text-slate-500" />}
          {item.path ? (
            <Link to={item.path} className="text-purple-300 hover:text-purple-200 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-400">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}

export function SEOContentSection({ 
  title, 
  description, 
  icon: Icon,
  children 
}: { 
  title: string
  description: string
  icon?: React.ElementType
  children: React.ReactNode
}) {
  return (
    <section className="py-16 border-b border-slate-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-start gap-4">
          {Icon && (
            <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center flex-shrink-0">
              <Icon className="w-6 h-6 text-purple-400" />
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-white mb-3">{title}</h2>
            <p className="text-slate-300 leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="mt-8">
          {children}
        </div>
      </div>
    </section>
  )
}

export function CTASection({ 
  title, 
  description, 
  primaryAction, 
  secondaryAction 
}: { 
  title: string
  description: string
  primaryAction: { label: string; path: string }
  secondaryAction?: { label: string; path: string }
}) {
  return (
    <section className="py-20 bg-gradient-to-r from-purple-900/30 to-pink-900/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">{title}</h2>
        <p className="text-slate-300 mb-8">{description}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to={primaryAction.path}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all"
          >
            {primaryAction.label}
          </Link>
          {secondaryAction && (
            <Link
              to={secondaryAction.path}
              className="px-8 py-3 border border-slate-600 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
