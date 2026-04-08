import React from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, { Breadcrumb, CTASection } from './SEOLayout'
import { Sparkles, Gamepad2, Music, Palette, MessageCircle, Utensils, Dumbbell, Code, Camera, Heart, Target, TrendingUp, ArrowRight, Search, Users, Play } from 'lucide-react'

const categories = [
  { 
    id: 'gaming', 
    name: 'Gaming', 
    icon: Gamepad2, 
    color: 'from-green-600 to-emerald-600',
    viewers: '2.5M+',
    streams: '15K+',
    description: 'Video games, esports, and gaming commentary',
    keywords: ['gaming streams', 'video game streaming', 'esports live', 'gamer streaming', 'twitch gaming']
  },
  { 
    id: 'just-chatting', 
    name: 'Just Chatting', 
    icon: MessageCircle, 
    color: 'from-purple-600 to-pink-600',
    viewers: '3.2M+',
    streams: '22K+',
    description: 'Casual conversations, hangouts, and Q&A sessions',
    keywords: ['just chatting', 'live chat', 'conversation stream', 'chatting app', 'talk streams']
  },
  { 
    id: 'music', 
    name: 'Music', 
    icon: Music, 
    color: 'from-pink-600 to-rose-600',
    viewers: '1.8M+',
    streams: '8K+',
    description: 'Live music performances, DJ sets, and music creation',
    keywords: ['live music', 'music streaming', 'DJ stream', 'live performance', 'music app']
  },
  { 
    id: 'art', 
    name: 'Art & Creativity', 
    icon: Palette, 
    color: 'from-violet-600 to-purple-600',
    viewers: '900K+',
    streams: '5K+',
    description: 'Digital art, painting, crafts, and creative projects',
    keywords: ['art stream', 'digital art', 'painting live', 'creative stream', 'art app']
  },
  { 
    id: 'food', 
    name: 'Food & Cooking', 
    icon: Utensils, 
    color: 'from-orange-600 to-amber-600',
    viewers: '650K+',
    streams: '3K+',
    description: 'Cooking shows, food reviews, and recipe tutorials',
    keywords: ['cooking stream', 'food show', 'live cooking', 'recipe stream', 'foodie']
  },
  { 
    id: 'sports', 
    name: 'Sports', 
    icon: Dumbbell, 
    color: 'from-blue-600 to-cyan-600',
    viewers: '800K+',
    streams: '4K+',
    description: 'Sports commentary, workouts, and athletic training',
    keywords: ['sports stream', 'workout live', 'fitness stream', 'sports commentary', 'training']
  },
  { 
    id: 'tech', 
    name: 'Tech & Code', 
    icon: Code, 
    color: 'from-slate-600 to-zinc-600',
    viewers: '500K+',
    streams: '2K+',
    description: 'Programming, coding, and tech discussions',
    keywords: ['coding stream', 'programming live', 'dev stream', 'code tutorial', 'tech stream']
  },
  { 
    id: 'beauty', 
    name: 'Beauty & Fashion', 
    icon: Camera, 
    color: 'from-rose-600 to-pink-600',
    viewers: '450K+',
    streams: '2.5K+',
    description: 'Makeup tutorials, fashion shows, and styling',
    keywords: ['beauty stream', 'makeup live', 'fashion show', 'styling stream', 'beauty tips']
  },
  { 
    id: 'health', 
    name: 'Health & Wellness', 
    icon: Heart, 
    color: 'from-red-600 to-rose-600',
    viewers: '350K+',
    streams: '1.5K+',
    description: 'Yoga, meditation, and wellness practices',
    keywords: ['yoga stream', 'meditation live', 'wellness stream', 'health tips', 'fitness']
  },
]

const featuredStreams = [
  { title: 'Epic Gaming Session', category: 'Gaming', viewers: '25K', time: 'LIVE NOW' },
  { title: 'Acoustic Sunday Vibes', category: 'Music', viewers: '18K', time: 'LIVE NOW' },
  { title: 'Learning to Draw', category: 'Art', viewers: '12K', time: 'LIVE NOW' },
  { title: 'Late Night Chat', category: 'Just Chatting', viewers: '8K', time: 'LIVE NOW' },
  { title: 'Healthy Cooking', category: 'Food', viewers: '5K', time: 'LIVE NOW' },
]

const trendingSearches = [
  { term: 'trending streams', category: 'Hot' },
  { term: 'popular streamers', category: 'Creators' },
  { term: 'gaming streams live', category: 'Gaming' },
  { term: 'music performance', category: 'Music' },
  { term: 'live art tutorial', category: 'Art' },
  { term: 'ASMR streams', category: 'Relaxing' },
  { term: 'cooking show', category: 'Food' },
  { term: 'workout stream', category: 'Fitness' },
]

export default function CategoriesPage() {
  return (
    <SEOLayout
      title="Browse Categories | Troll City"
      description="Discover trending content categories on Troll City. Browse live streams in gaming, music, art, chat, and more. Find your favorite creators and watch live."
      keywords={[
        'categories', 'browse streams', 'trending', 'gaming', 'music', 'art',
        'just chatting', 'live content', 'stream categories', 'find streams',
        'trending streams', 'popular streams', 'best streams', 'top streamers',
        'watch live', 'live video', 'streaming categories'
      ]}
    >
      <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'Categories' }]} />

      <section className="py-16 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">Explore Categories</h1>
            <p className="text-slate-400 text-lg">Find your favorite content and discover new creators</p>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text"
                placeholder="Search categories, creators, or content..."
                className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            {trendingSearches.map((search, index) => (
              <Link
                key={index}
                to={`/explore?q=${encodeURIComponent(search.term)}`}
                className="px-4 py-2 bg-slate-800 hover:bg-purple-600/20 border border-slate-700 hover:border-purple-500/30 rounded-full text-slate-300 hover:text-purple-300 text-sm transition-colors"
              >
                {search.term}
                <span className="ml-2 text-xs text-slate-500">• {search.category}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-bold text-white">Trending Now</h2>
          </div>
          <div className="grid md:grid-cols-5 gap-4">
            {featuredStreams.map((stream, index) => (
              <Link
                key={index}
                to="/live-swipe"
                className="p-4 bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 rounded-xl transition-all group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded animate-pulse">LIVE</span>
                  <span className="text-purple-400 text-xs">{stream.viewers}</span>
                </div>
                <h3 className="text-white font-medium mb-1 truncate">{stream.title}</h3>
                <p className="text-slate-400 text-sm">{stream.category}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-8">
            <Sparkles className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">All Categories</h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => {
              const Icon = category.icon
              return (
                <Link
                  key={category.id}
                  to={`/explore?category=${category.id}`}
                  className="group p-6 bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 rounded-2xl transition-all hover:bg-slate-800/50"
                >
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${category.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-semibold text-white">{category.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Users className="w-4 h-4" />
                      {category.viewers}
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm mb-3">{category.description}</p>
                  <div className="flex items-center text-purple-400 text-sm font-medium group-hover:text-purple-300">
                    Browse <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <CTASection
        title="Find Your Community"
        description="Join millions of viewers watching their favorite creators. Discover new content and connect with like-minded people."
        primaryAction={{ label: 'Start Watching', path: '/explore' }}
        secondaryAction={{ label: 'Go Live', path: '/live' }}
      />
    </SEOLayout>
  )
}