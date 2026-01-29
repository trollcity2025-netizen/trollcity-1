import React, { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Zap, Lock, Clock } from 'lucide-react'

interface Perk {
  id: string
  name: string
  description: string
  category: string
  cost_tokens: number
  required_level: number
  metadata: any
}

export default function PerksStore() {
  const { profile, user } = useAuthStore()
  const [perks, setPerks] = useState<Perk[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0A0814] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return <PerksStoreContent profile={profile} user={user} />
}

function PerksStoreContent({ profile, user }: { profile: any, user: any }) {
  const [perks, setPerks] = useState<Perk[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)

  useEffect(() => {
    loadPerks()
  }, [])


  const loadPerks = async () => {
    try {
      const { data, error } = await supabase
        .from('perks')
        .select('*')
        .order('cost_tokens', { ascending: true })
      
      if (error) throw error
      setPerks(data || [])
    } catch (error) {
      console.error('Error loading perks:', error)
      toast.error('Failed to load perks')
    } finally {
      setLoading(false)
    }
  }

  const handlePrestige = async () => {
    if (!profile) return;
    if (!window.confirm('Are you sure you want to PRESTIGE? This will reset your level to 1, but give you permanent boosts and a prestige badge. This cannot be undone.')) {
      return;
    }
    
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('prestige_user', {
        p_user_id: user?.id
      });
      
      if (error) throw error;
      
      if (data && data.success) {
        toast.success(data.message);
        window.location.reload();
      } else {
        toast.error(data?.message || 'Prestige failed');
      }
    } catch (error: any) {
      console.error('Prestige error:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (perk: Perk) => {
    if (!profile) return

    if (profile.level < perk.required_level) {
      toast.error(`Requires Level ${perk.required_level}`)
      return
    }

    if ((profile.perk_tokens || 0) < perk.cost_tokens) {
      toast.error('Not enough tokens')
      return
    }

    setPurchasing(perk.id)
    try {
      const { data, error } = await supabase.rpc('purchase_perk', {
        p_perk_id: perk.id
      })

      if (error) throw error

      if (data && data.success) {
        toast.success(data.message)
        // Refresh profile to update tokens (handled by store subscription or manual re-fetch?)
        // Ideally useAuthStore would refresh, but let's manually trigger a profile update if possible, 
        // or just rely on the UI update if we had a method. 
        // For now, we might need to reload the page or fetch profile again.
        // Assuming real-time or optimistic update isn't setup for RPC side-effects on profile.
        window.location.reload() // Simple way to refresh tokens in Sidebar
      } else {
        toast.error(data?.error || 'Purchase failed')
      }
    } catch (error: any) {
      console.error('Purchase error:', error)
      toast.error(error.message || 'Failed to purchase perk')
    } finally {
      setPurchasing(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6 md:p-8 ml-20 md:ml-64">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-8 h-8 text-yellow-400" />
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
              Perk Store
            </h1>
          </div>
          <p className="text-gray-400">Redeem your Perk Tokens for exclusive rewards and boosts.</p>
        </header>

        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Your Balance</p>
            <div className="text-3xl font-bold text-yellow-400 flex items-center gap-2">
              {profile?.perk_tokens || 0} <span className="text-lg text-gray-400">Tokens</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Current Level</p>
            <div className="text-2xl font-bold text-purple-400 flex items-center gap-2 justify-end">
               {profile?.prestige_level && profile.prestige_level > 0 && (
                 <span className="text-yellow-500 text-lg flex items-center gap-1" title={`Prestige ${profile.prestige_level}`}>
                   <Zap className="w-4 h-4" fill="currentColor" /> {profile.prestige_level}
                 </span>
               )}
               Level {profile?.level || 1}
            </div>
            {(profile?.level || 1) >= 50 && (
              <button 
                onClick={handlePrestige}
                className="mt-2 text-xs bg-gradient-to-r from-red-600 to-yellow-600 px-3 py-1 rounded font-bold hover:brightness-110 transition-all animate-pulse"
              >
                PRESTIGE NOW
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {perks.map((perk) => {
            const isLocked = (profile?.level || 0) < perk.required_level
            const canAfford = (profile?.perk_tokens || 0) >= perk.cost_tokens
            
            return (
              <div 
                key={perk.id} 
                className={`relative bg-[#1A1A1A] border border-white/10 rounded-xl p-6 transition-all hover:border-purple-500/50 ${isLocked ? 'opacity-75' : ''}`}
              >
                {isLocked && (
                  <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center z-10 backdrop-blur-[1px]">
                    <div className="bg-black/80 px-4 py-2 rounded-lg flex items-center gap-2 border border-white/10">
                      <Lock className="w-4 h-4 text-red-400" />
                      <span className="text-red-400 font-bold">Unlocks at Level {perk.required_level}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-lg ${getCategoryColor(perk.category)} bg-opacity-20`}>
                    <Zap className={`w-6 h-6 ${getCategoryColor(perk.category).replace('bg-', 'text-')}`} />
                  </div>
                  <div className="px-3 py-1 bg-white/5 rounded-full text-sm font-medium border border-white/10">
                    {perk.cost_tokens} Tokens
                  </div>
                </div>

                <h3 className="text-xl font-bold mb-2">{perk.name}</h3>
                <p className="text-gray-400 text-sm mb-4 min-h-[40px]">{perk.description}</p>

                <div className="flex items-center gap-2 mb-6 text-xs text-gray-500">
                  <span className="uppercase tracking-wider">{perk.category}</span>
                  {perk.metadata?.duration_hours && (
                    <span className="flex items-center gap-1">
                      • <Clock className="w-3 h-3" /> {perk.metadata.duration_hours}h Duration
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handlePurchase(perk)}
                  disabled={isLocked || !canAfford || purchasing === perk.id}
                  className={`w-full py-2.5 rounded-lg font-bold transition-all flex items-center justify-center gap-2
                    ${isLocked 
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      : canAfford 
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-900/20'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  {purchasing === perk.id ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : isLocked ? (
                    'Locked'
                  ) : !canAfford ? (
                    'Not Enough Tokens'
                  ) : (
                    'Redeem'
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function getCategoryColor(category: string) {
  switch (category) {
    case 'streaming': return 'bg-blue-500'
    case 'chat': return 'bg-green-500'
    case 'coins': return 'bg-yellow-500'
    case 'profile': return 'bg-purple-500'
    default: return 'bg-gray-500'
  }
}
