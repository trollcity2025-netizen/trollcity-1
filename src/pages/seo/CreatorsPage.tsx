import React from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, { Breadcrumb, SEOContentSection, CTASection } from './SEOLayout'
import { DollarSign, Play, Users, TrendingUp, Gift, Star, Crown, ArrowRight, CheckCircle, Wallet, PiggyBank, Gem, Zap, Globe, Camera, Mic, Monitor, Wifi, Clock, ThumbsUp, MessageCircle, Share2, Target, Rocket, Briefcase, Award } from 'lucide-react'

const benefits = [
  { icon: DollarSign, title: 'Earn Money', description: 'Keep up to 70% of all earnings from gifts, tips, and subscriptions' },
  { icon: Users, title: 'Build Audience', description: 'Grow your fanbase with powerful discoverability tools' },
  { icon: Gift, title: 'Virtual Gifts', description: 'Receive gifts that convert to real cash payouts' },
  { icon: Crown, title: 'Partner Program', description: 'Unlock exclusive perks and increased revenue shares' },
  { icon: TrendingUp, title: 'Analytics', description: 'Track performance and grow with detailed insights' },
  { icon: Globe, title: 'Global Reach', description: 'Stream to viewers from around the world' },
]

const howToEarn = [
  { title: 'Virtual Gifts', description: 'Fans send you virtual gifts during streams. Convert to Troll Coins and cash out.' },
  { title: 'Tips & Donations', description: 'Direct support from viewers who appreciate your content.' },
  { title: 'Subscriptions', description: 'Monthly recurring income from loyal fans.' },
  { title: 'Ad Revenue', description: 'Earn from ads displayed during your streams.' },
  { title: 'Battle Competitions', description: 'Win prizes in creator competitions.' },
  { title: 'Brand Deals', description: 'Partner with brands for sponsored content.' },
]

const requirements = [
  { step: '1', title: 'Create Account', description: 'Sign up free and complete your profile' },
  { step: '2', title: 'Verify Identity', description: 'Complete verification to enable payouts' },
  { step: '3', title: 'Start Streaming', description: 'Go live and build your audience' },
  { step: '4', title: 'Earn & Withdraw', description: 'Request payouts when you qualify' },
]

const tips = [
  'Stream consistently to build your audience',
  'Engage with every viewer who comments',
  'Create a unique brand and identity',
  'Use social media to promote your streams',
  'Collaborate with other creators',
  'Invest in quality audio and video equipment',
  'Run interactive content and games',
  'Thank every donor personally',
]

const trendingSearches = [
  { term: 'become a streamer', category: 'Career' },
  { term: 'make money online', category: 'Income' },
  { term: 'content creator jobs', category: 'Career' },
  { term: 'work from home', category: 'Remote' },
  { term: 'streaming career', category: 'Creator' },
  { term: 'how to earn money streaming', category: 'Guide' },
  { term: 'creator income', category: 'Money' },
  { term: 'partnership program', category: 'Program' },
]

export default function CreatorsPage() {
  return (
    <SEOLayout
      title="Become a Creator | Troll City"
      description="Start streaming and earn money as a content creator on Troll City. Join our creator program, build your audience, and turn your passion into income. Apply today."
      keywords={[
        'become a creator', 'content creator', 'streamer', 'make money online', 'work from home',
        'creator program', 'streaming career', 'income', 'earnings', 'monetize',
        'creator economy', 'work from home jobs', 'online income', 'side hustle',
        'become streamer', 'live streaming career', 'content creator jobs'
      ]}
    >
      <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'Creators' }]} />

      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/20 via-slate-900 to-emerald-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(34,197,94,0.2),transparent_50%)]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-600/20 border border-green-500/30 text-green-300 text-sm font-medium mb-6">
              <DollarSign className="w-4 h-4" />
              Earn Up to 70%
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Turn Your Passion{' '}
              <span className="bg-gradient-to-r from-green-400 via-emerald-400 to-green-400 bg-clip-text text-transparent">
                Into Profit
              </span>
            </h1>
            
            <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
              Become a Troll City creator and start earning today. 
              Stream games, music, chat, or any content you love. 
              Build your audience and get paid for what you do best.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/auth"
                className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-500 hover:to-emerald-500 transition-all flex items-center justify-center gap-2"
              >
                <Rocket className="w-5 h-5" />
                Start Streaming Free
              </Link>
              <Link
                to="/legal/creator-earnings"
                className="px-8 py-4 border border-slate-600 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <DollarSign className="w-5 h-5" />
                View Earnings
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
                to={`/explore?q=${encodeURIComponent(search.term)}`}
                className="px-4 py-2 bg-slate-800 hover:bg-green-600/20 border border-slate-700 hover:border-green-500/30 rounded-full text-slate-300 hover:text-green-300 text-sm transition-colors"
              >
                {search.term}
                <span className="ml-2 text-xs text-slate-500">• {search.category}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <SEOContentSection
        title="Creator Benefits"
        description="Everything you need to build a successful streaming career."
        icon={Briefcase}
      >
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon
            return (
              <div key={index} className="p-6 bg-slate-900/30 border border-slate-800 rounded-xl">
                <Icon className="w-6 h-6 text-green-400 mb-3" />
                <h4 className="text-white font-semibold mb-2">{benefit.title}</h4>
                <p className="text-slate-400 text-sm">{benefit.description}</p>
              </div>
            )
          })}
        </div>
      </SEOContentSection>

      <SEOContentSection
        title="Ways to Earn"
        description="Multiple revenue streams for creators."
        icon={PiggyBank}
      >
        <div className="grid md:grid-cols-2 gap-4">
          {howToEarn.map((method, index) => (
            <div key={index} className="flex items-start gap-4 p-4 bg-slate-900/30 border border-slate-800 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-green-600/20 flex items-center justify-center flex-shrink-0">
                <span className="text-green-400 font-bold">{index + 1}</span>
              </div>
              <div>
                <h4 className="text-white font-semibold">{method.title}</h4>
                <p className="text-slate-400 text-sm">{method.description}</p>
              </div>
            </div>
          ))}
        </div>
      </SEOContentSection>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">How to Get Started</h2>
            <p className="text-slate-400">Four simple steps to become a creator</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6">
            {requirements.map((req, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
                  {req.step}
                </div>
                <h3 className="text-white font-semibold mb-2">{req.title}</h3>
                <p className="text-slate-400 text-sm">{req.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SEOContentSection
        title='Success Tips'
        description='Advice from top Troll City creators.'
        icon={Award}
      >
        <div className="grid md:grid-cols-2 gap-4">
          {tips.map((tip, index) => (
            <div key={index} className="flex items-start gap-3 p-4 bg-slate-900/30 border border-slate-800 rounded-xl">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-slate-300 text-sm">{tip}</p>
            </div>
          ))}
        </div>
      </SEOContentSection>

      <section className="py-16 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6">
              <div className="text-4xl font-bold text-white mb-2">500K+</div>
              <div className="text-slate-400">Active Creators</div>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl font-bold text-white mb-2">$10M+</div>
              <div className="text-slate-400">Paid to Creators</div>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl font-bold text-white mb-2">70%</div>
              <div className="text-slate-400">Max Revenue Share</div>
            </div>
          </div>
        </div>
      </section>

      <CTASection
        title='Start Your Creator Journey'
        description='Join thousands of creators earning on Troll City. Sign up free and start streaming today.'
        primaryAction={{ label: 'Create Free Account', path: '/auth' }}
        secondaryAction={{ label: 'Learn More', path: '/about' }}
      />
    </SEOLayout>
  )
}