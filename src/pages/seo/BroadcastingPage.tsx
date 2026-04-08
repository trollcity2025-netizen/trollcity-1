import React from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, { Breadcrumb, SEOContentSection, CTASection } from './SEOLayout'
import { Radio, Play, Users, DollarSign, Gift, MessageCircle, Eye, Mic, Camera, Monitor, Smartphone, TrendingUp, Zap, Shield, Star, ArrowRight, Wifi, Clock, ThumbsUp, Share2 } from 'lucide-react'

const features = [
  {
    icon: Monitor,
    title: 'HD Streaming Quality',
    description: 'Broadcast in crystal clear HD quality. Your viewers deserve the best visual experience, and we deliver.'
  },
  {
    icon: Users,
    title: 'Unlimited Viewers',
    description: 'No viewer limits. Whether you have 10 or 10,000 viewers, our infrastructure scales with you.'
  },
  {
    icon: MessageCircle,
    title: 'Real-Time Chat',
    description: 'Engage with your audience through live chat. Respond to comments, answer questions, and build community.'
  },
  {
    icon: Gift,
    title: 'Virtual Gifting',
    description: 'Receive virtual gifts from your fans that convert to real earnings. The more entertaining you are, the more you earn.'
  },
  {
    icon: Mic,
    title: 'Crystal Clear Audio',
    description: 'Professional audio processing ensures your voice comes through loud and clear. Background noise removal included.'
  },
  {
    icon: Shield,
    title: 'Moderation Tools',
    description: 'Keep your stream safe with powerful moderation tools. Ban bad actors, filter messages, and control your space.'
  },
]

const monetizationMethods = [
  {
    title: 'Virtual Gifts',
    description: 'Viewers send you virtual gifts during your stream. These convert to Troll Coins that can be redeemed for real cash.',
    icon: Gift
  },
  {
    title: 'Tips & Donations',
    description: 'Direct support from your fans. Receive instant tips during live broadcasts.',
    icon: DollarSign
  },
  {
    title: 'Subscriber Revenue',
    description: 'Build a loyal fanbase with subscriptions. Get recurring monthly income from dedicated viewers.',
    icon: Star
  },
  {
    title: 'Ad Revenue',
    description: 'Monetize your content with ads. Earn from every impression and viewer interaction.',
    icon: TrendingUp
  },
]

const streamingCategories = [
  { name: 'Just Chatting', viewers: '2.5M+', description: 'Casual conversations and hangouts' },
  { name: 'Gaming', viewers: '1.8M+', description: 'Video games and competitive play' },
  { name: 'Music', viewers: '1.2M+', description: 'Live music and performances' },
  { name: 'Art & Creativity', viewers: '800K+', description: 'Digital art, crafts, and creation' },
  { name: 'Sports', viewers: '600K+', description: 'Sports commentary and analysis' },
  { name: 'Food & Cooking', viewers: '500K+', description: 'Cooking shows and food reviews' },
]

const tips = [
  'Consistency is key – stream regularly to build your audience',
  'Interact with chat – responding to viewers increases engagement',
  'Use multiple platforms – promote your streams on social media',
  'Create a schedule – viewers are more likely to tune in when they know when to expect you',
  'Collaborate with other creators – cross-promotion expands your reach',
  'Invest in quality equipment – good audio and video keep viewers watching',
  'Engage with your community – remember names and build relationships',
  'Stay positive – a good attitude is contagious and viewers return for the vibe',
]

const trendingSearches = [
  { term: 'how to go live', category: 'Tutorial' },
  { term: 'best streaming software', category: 'Tools' },
  { term: 'stream setup guide', category: 'Guide' },
  { term: 'how to stream on phone', category: 'Mobile' },
  { term: 'live streaming tips', category: 'Advice' },
  { term: 'become a streamer', category: 'Career' },
  { term: 'streaming equipment', category: 'Gear' },
  { term: 'OBS streaming', category: 'Software' },
]

export default function BroadcastingPage() {
  return (
    <SEOLayout
      title="Live Broadcasting & Streaming Platform | Troll City"
      description="Start broadcasting live on Troll City. Stream to unlimited viewers, earn money through virtual gifts and tips, and build your creator career. Free to start, unlimited potential."
      keywords={[
        'live broadcasting', 'go live', 'streaming', 'stream live', 'broadcast live',
        'live stream', 'how to stream', 'streaming platform', 'live video', 'real-time streaming',
        'creator streaming', 'broadcasting software', 'live streaming app', 'stream to twitch',
        'video streaming', 'online streaming', 'webcam streaming', 'mobile streaming'
      ]}
    >
      <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'Broadcasting' }]} />

      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-900 to-pink-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(236,72,153,0.2),transparent_50%)]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-600/20 border border-pink-500/30 text-pink-300 text-sm font-medium mb-6">
                <Radio className="w-4 h-4" />
                #1 Streaming Platform
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                Broadcast Live.{' '}
                <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Go Viral.
                </span>
              </h1>
              
              <p className="text-xl text-slate-300 mb-8 leading-relaxed">
                Start streaming today and reach millions of viewers worldwide. 
                Our powerful broadcasting tools help you create engaging content that gets discovered. 
                Whether you're a gamer, musician, or just want to chat – go live and build your audience.
              </p>
              
              <div className="flex flex-col sm:flex-row items-start gap-4 mb-8">
                <Link
                  to="/live"
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all flex items-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Start Broadcasting
                </Link>
                <Link
                  to="/explore"
                  className="px-8 py-4 border border-slate-600 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2"
                >
                  <Eye className="w-5 h-5" />
                  Watch Streams
                </Link>
              </div>

              <div className="flex items-center gap-6 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-green-400" />
                  <span>99.9% Uptime</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span>Unlimited Viewers</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-pink-400" />
                  <span>24/7 Support</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-video rounded-2xl bg-slate-900 border border-slate-700 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-purple-600/80 flex items-center justify-center cursor-pointer hover:bg-purple-600 transition-colors">
                    <Play className="w-8 h-8 text-white ml-1" />
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 right-4 z-20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded animate-pulse">LIVE</span>
                    <span className="text-white text-sm font-medium">12,453 watching</span>
                  </div>
                  <h3 className="text-white font-semibold">Just Chatting with Fans! 🎉</h3>
                  <p className="text-slate-300 text-sm">StreamerName • Gaming</p>
                </div>
                <img 
                  src="https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=800&h=450&fit=crop" 
                  alt="Live streaming broadcast"
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div className="absolute -bottom-6 -right-6 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl" />
              <div className="absolute -top-6 -left-6 w-32 h-32 bg-pink-600/20 rounded-full blur-2xl" />
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
                className="px-4 py-2 bg-slate-800 hover:bg-pink-600/20 border border-slate-700 hover:border-pink-500/30 rounded-full text-slate-300 hover:text-pink-300 text-sm transition-colors"
              >
                {search.term}
                <span className="ml-2 text-xs text-slate-500">• {search.category}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Professional Broadcasting Tools
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Everything you need to create amazing live content. 
              Our platform provides all the features professional streamers need.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div
                  key={index}
                  className="p-6 bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 rounded-2xl transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <SEOContentSection
        title="How to Start Streaming"
        description="Getting started with live broadcasting is simple. Follow these steps to go live in minutes."
        icon={Zap}
      >
        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold mb-4">1</div>
            <h4 className="text-white font-semibold mb-2">Create Account</h4>
            <p className="text-slate-400 text-sm">Sign up for free and complete your profile. Add a profile picture and bio to attract viewers.</p>
          </div>
          <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold mb-4">2</div>
            <h4 className="text-white font-semibold mb-2">Set Up Stream</h4>
            <p className="text-slate-400 text-sm">Choose your category, add a title, and set your stream quality. You can stream from browser or OBS.</p>
          </div>
          <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold mb-4">3</div>
            <h4 className="text-white font-semibold mb-2">Go Live</h4>
            <p className="text-slate-400 text-sm">Hit the broadcast button and start engaging with your audience. Watch your viewer count grow!</p>
          </div>
        </div>
      </SEOContentSection>

      <SEOContentSection
        title="Earn Money Streaming"
        description="Turn your passion into profit. Troll City offers multiple ways to monetize your content and build a sustainable creator career."
        icon={DollarSign}
      >
        <div className="grid md:grid-cols-2 gap-6">
          {monetizationMethods.map((method, index) => {
            const Icon = method.icon
            return (
              <div key={index} className="flex items-start gap-4 p-6 bg-slate-900/30 border border-slate-800 rounded-xl">
                <div className="w-12 h-12 rounded-xl bg-green-600/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">{method.title}</h4>
                  <p className="text-slate-400 text-sm">{method.description}</p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-8 p-6 bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-500/30 rounded-xl">
          <div className="flex items-center gap-4">
            <DollarSign className="w-8 h-8 text-green-400" />
            <div>
              <h4 className="text-white font-semibold">Creator Revenue Share</h4>
              <p className="text-slate-300 text-sm">Creators keep up to 70% of all earnings from gifts, tips, and subscriptions. Start earning today!</p>
            </div>
          </div>
        </div>
      </SEOContentSection>

      <section className="py-20 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Popular Streaming Categories</h2>
            <p className="text-slate-400">Find your niche and start streaming</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {streamingCategories.map((category, index) => (
              <Link
                key={index}
                to={`/explore?category=${encodeURIComponent(category.name)}`}
                className="p-4 bg-slate-800/50 hover:bg-purple-600/20 border border-slate-700 hover:border-purple-500/30 rounded-xl transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white font-semibold">{category.name}</h3>
                  <span className="text-purple-400 text-sm">{category.viewers}</span>
                </div>
                <p className="text-slate-400 text-sm">{category.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <SEOContentSection
        title="Streaming Success Tips"
        description="Build a loyal audience and grow your channel with these proven strategies from top creators."
        icon={ThumbsUp}
      >
        <div className="grid md:grid-cols-2 gap-4">
          {tips.map((tip, index) => (
            <div key={index} className="flex items-start gap-3 p-4 bg-slate-900/30 border border-slate-800 rounded-xl">
              <div className="w-6 h-6 rounded-full bg-purple-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-purple-400 text-xs font-bold">{index + 1}</span>
              </div>
              <p className="text-slate-300 text-sm">{tip}</p>
            </div>
          ))}
        </div>
      </SEOContentSection>

      <section className="py-16 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6">
              <div className="text-4xl font-bold text-white mb-2">50K+</div>
              <div className="text-slate-400">Daily Active Streams</div>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl font-bold text-white mb-2">10M+</div>
              <div className="text-slate-400">Monthly Viewers</div>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl font-bold text-white mb-2">$10M+</div>
              <div className="text-slate-400">Paid to Creators</div>
            </div>
          </div>
        </div>
      </section>

      <CTASection
        title="Ready to Start Broadcasting?"
        description="Join thousands of creators who are building their audience and earning money on Troll City."
        primaryAction={{ label: 'Go Live Now', path: '/live' }}
        secondaryAction={{ label: 'Watch Streams', path: '/explore' }}
      />
    </SEOLayout>
  )
}
