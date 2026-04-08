import React from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, { Breadcrumb, SEOContentSection, CTASection } from './SEOLayout'
import { Building2, Vote, Users, Scale, BookOpen, Shield, MessageSquare, Bell, Crown, Star, ArrowRight, CheckCircle, ChevronRight, Calendar, FileText, Target, UsersRound } from 'lucide-react'

const governmentRoles = [
  {
    title: 'President',
    description: 'The highest elected position. Sets policy direction and leads the executive branch.',
    requirements: 'Must have 500+ followers and no violations in 90 days',
    color: 'from-yellow-600 to-amber-600'
  },
  {
    title: 'Secretary',
    description: 'Manages government operations and coordinates between branches.',
    requirements: 'Must have 250+ followers and verified account',
    color: 'from-blue-600 to-cyan-600'
  },
  {
    title: 'Troll Officer',
    description: 'Enforces community guidelines and maintains safety.',
    requirements: 'Complete application and 30-day trial period',
    color: 'from-purple-600 to-pink-600'
  },
  {
    title: 'Attorney',
    description: 'Represents users in court and handles legal matters.',
    requirements: 'Legal experience required, pass bar exam',
    color: 'from-green-600 to-emerald-600'
  },
  {
    title: 'Prosecutor',
    description: 'Brings cases against violators on behalf of the community.',
    requirements: 'Apply and pass prosecution exam',
    color: 'from-red-600 to-rose-600'
  },
  {
    title: 'Pastor',
    description: 'Leads spiritual and community wellness programs.',
    requirements: 'Community leadership experience',
    color: 'from-teal-600 to-cyan-600'
  },
]

const features = [
  {
    icon: Vote,
    title: 'Democratic Elections',
    description: 'Vote for leaders who represent your interests. Every voice matters in Troll City democracy.',
  },
  {
    icon: Scale,
    title: 'Fair Courts',
    description: 'Our judicial system ensures justice. Users can file cases, appeal decisions, and seek fair resolution.',
  },
  {
    icon: Shield,
    title: 'Community Safety',
    description: 'Troll Officers work 24/7 to keep Troll City safe. Report issues and get help when you need it.',
  },
  {
    icon: FileText,
    title: 'Transparent Policies',
    description: 'All government decisions are documented. Access policies, meeting minutes, and government records.',
  },
  {
    icon: Users,
    title: 'Public Office',
    description: 'Run for government positions. Build your reputation and serve your community.',
  },
  {
    icon: MessageSquare,
    title: 'Open Communication',
    description: 'Direct access to government officials. Share concerns and participate in town halls.',
  },
]

const recentElections = [
  { position: 'President', candidates: 5, votes: '125K+', status: 'Active' },
  { position: 'Secretary', candidates: 8, votes: '89K+', status: 'Upcoming' },
  { position: 'Troll Officers', candidates: 23, votes: '67K+', status: 'Active' },
]

const trendingSearches = [
  { term: 'how to run for office', category: 'Elections' },
  { term: 'vote for president', category: 'Voting' },
  { term: ' Troll Court', category: 'Legal' },
  { term: 'report user', category: 'Safety' },
  { term: 'government policies', category: 'Info' },
  { term: 'become officer', category: 'Careers' },
  { term: 'election results', category: 'Elections' },
  { term: 'appeal ban', category: 'Legal' },
]

export default function GovernmentPage() {
  return (
    <SEOLayout
      title="Government System | Troll City"
      description="Learn about Troll City government. Vote in elections, run for office, and participate in our democratic system. Fair courts and community leadership."
      keywords={[
        'government', 'election', 'vote', 'democracy', 'president', 'voting',
        ' Troll Court', 'legal', 'court', 'attorney', 'prosecutor', 'officer',
        'run for office', 'political', 'elections 2026', 'candidate',
        'community leadership', 'public office', 'government system'
      ]}
    >
      <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'Government' }]} />

      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-slate-900 to-purple-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.2),transparent_50%)]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-300 text-sm font-medium mb-6">
              <Building2 className="w-4 h-4" />
              User-Led Democracy
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Your Voice Shapes{' '}
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                Troll City
              </span>
            </h1>
            
            <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
              Troll City is governed by its users. Vote in elections, run for office, 
              and participate in our democratic process. Fair courts ensure justice 
              for all community members.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/government"
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-500 hover:to-purple-500 transition-all flex items-center justify-center gap-2"
              >
                <Vote className="w-5 h-5" />
                View Elections
              </Link>
              <Link
                to="/troll-court"
                className="px-8 py-4 border border-slate-600 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <Scale className="w-5 h-5" />
                Troll Court
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-3">
            {trendingSearches.map((search, index) => (
              <Link
                key={index}
                to={`/government?q=${encodeURIComponent(search.term)}`}
                className="px-4 py-2 bg-slate-800 hover:bg-blue-600/20 border border-slate-700 hover:border-blue-500/30 rounded-full text-slate-300 hover:text-blue-300 text-sm transition-colors"
              >
                {search.term}
                <span className="ml-2 text-xs text-slate-500">• {search.category}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <SEOContentSection
        title="How Government Works"
        description="Troll City operates as a digital democracy. Users elect leaders, participate in decisions, and hold government accountable."
        icon={Building2}
      >
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div key={index} className="p-6 bg-slate-900/30 border border-slate-800 rounded-xl">
                <Icon className="w-6 h-6 text-blue-400 mb-3" />
                <h4 className="text-white font-semibold mb-2">{feature.title}</h4>
                <p className="text-slate-400 text-sm">{feature.description}</p>
              </div>
            )
          })}
        </div>
      </SEOContentSection>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Government Positions</h2>
            <p className="text-slate-400">Serve your community</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {governmentRoles.map((role, index) => (
              <div key={index} className="p-6 bg-slate-900/50 border border-slate-800 hover:border-blue-500/30 rounded-2xl transition-all">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${role.color} flex items-center justify-center mb-4`}>
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{role.title}</h3>
                <p className="text-slate-400 text-sm mb-3">{role.description}</p>
                <p className="text-slate-500 text-xs">{role.requirements}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SEOContentSection
        title="Active Elections"
        description="Participate in Troll City democracy. Your vote shapes the future of our platform."
        icon={Calendar}
      >
        <div className="space-y-4">
          {recentElections.map((election, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-slate-900/30 border border-slate-800 rounded-xl">
              <div>
                <h4 className="text-white font-semibold">{election.position}</h4>
                <p className="text-slate-400 text-sm">{election.candidates} candidates • {election.votes} votes cast</p>
              </div>
              <Link
                to="/government/elections"
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  election.status === 'Active' 
                    ? 'bg-green-600/20 text-green-400'
                    : 'bg-blue-600/20 text-blue-400'
                }`}
              >
                {election.status}
              </Link>
            </div>
          ))}
        </div>
      </SEOContentSection>

      <section className="py-16 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6">
              <div className="text-4xl font-bold text-white mb-2">500K+</div>
              <div className="text-slate-400">Total Voters</div>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl font-bold text-white mb-2">50+</div>
              <div className="text-slate-400">Elected Officials</div>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl font-bold text-white mb-2">10K+</div>
              <div className="text-slate-400">Court Cases</div>
            </div>
          </div>
        </div>
      </section>

      <CTASection
        title="Participate in Democracy"
        description="Your voice matters. Vote in elections, run for office, or serve your community."
        primaryAction={{ label: 'View Elections', path: '/government' }}
        secondaryAction={{ label: 'Apply for Office', path: '/application' }}
      />
    </SEOLayout>
  )
}