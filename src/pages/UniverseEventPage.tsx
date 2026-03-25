import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { useCoins } from '../lib/hooks/useCoins'
import { addCoins } from '../lib/coinTransactions'
import { toast } from 'sonner'
import { Tournament, Participant } from '../components/universe-event/types'
import TournamentHero from '../components/universe-event/TournamentHero'
import TournamentTabs from '../components/universe-event/TournamentTabs'
import MyStatusCard from '../components/universe-event/MyStatusCard'
import CountdownCard from '../components/universe-event/CountdownCard'
import { Card, CardContent } from '../components/ui/card'
import { Calendar, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function UniverseEventPage() {
  const { user } = useAuthStore()
  const { refreshCoins, spendCoins, balances } = useCoins()
  const navigate = useNavigate()
  
  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(null)
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [upcomingTournaments, setUpcomingTournaments] = useState<Tournament[]>([])
  const [pastTournaments, setPastTournaments] = useState<Tournament[]>([])
  
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  const loadParticipant = useCallback(async (tournamentId?: string) => {
    const tId = tournamentId || currentTournament?.id
    if (!user || !tId) return
    try {
        const { data, error } = await supabase
            .from('tournament_participants')
            .select('*')
            .eq('tournament_id', tId)
            .eq('user_id', user.id)
            .maybeSingle()
        
        if (error) throw error

        if (data) {
            const isWithdrawn = data.status === 'withdrawn' || data.stats?.withdrawn === true
            if (!isWithdrawn) {
                setParticipant(data)
            } else {
                setParticipant(null)
            }
        } else {
            setParticipant(null)
        }
    } catch (e) {
        console.error('Error loading participant:', e)
        setParticipant(null)
    }
  }, [user, currentTournament?.id])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch current tournament (status open or live)
      const { data: currentData, error: currentError } = await supabase
        .from('tournaments')
        .select('*')
        .in('status', ['open', 'live'])
        .order('start_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (currentError) throw currentError

      // Fetch upcoming
      const { data: upcomingData } = await supabase
        .from('tournaments')
        .select('*')
        .eq('status', 'upcoming')
        .order('start_at', { ascending: true })
      
      // Fetch past
      const { data: pastData } = await supabase
        .from('tournaments')
        .select('*')
        .eq('status', 'ended')
        .order('end_at', { ascending: false })
        .limit(5)

      setCurrentTournament(currentData)
      setUpcomingTournaments(upcomingData || [])
      setPastTournaments(pastData || [])

      // Fetch participant status if user is logged in and there is a current tournament
      if (user && currentData) {
        // We can use the logic from loadParticipant but we need to pass the ID directly
        // or just duplicate the logic here to ensure we use the fresh currentData.id
        const { data: participantData, error: participantError } = await supabase
          .from('tournament_participants')
          .select('*')
          .eq('tournament_id', currentData.id)
          .eq('user_id', user.id)
          .maybeSingle()
        
        if (!participantError && participantData) {
           // Filter out withdrawn status (handle both column and stats fallback)
           const isWithdrawn = participantData.status === 'withdrawn' || participantData.stats?.withdrawn === true
           if (!isWithdrawn) {
             setParticipant(participantData)
           } else {
             setParticipant(null)
           }
        }
      }
    } catch (error) {
      console.error('Error loading tournament data:', error)
      // Don't toast on initial load error if it's just no data, but console log it
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleJoin = async () => {
    if (!user) {
      toast.error('Please log in to join')
      navigate('/auth')
      return
    }
    if (!currentTournament) return

    setJoining(true)
    try {
        // 1. Try RPC first
        const { data: rpcData, error: rpcError } = await supabase.rpc('join_tournament', {
            p_tournament_id: currentTournament.id
        })

        if (!rpcError && rpcData) {
            if (!rpcData.success) {
                toast.error(rpcData.message || 'Failed to join')
                return
            }
            toast.success(rpcData.message || 'Successfully joined!')
            await refreshCoins()
            await loadParticipant()
            return
        }

        // 2. Fallback: Client-side logic
        const entryFee = currentTournament.entry_fee || 0
        
        // Check balance
        if (entryFee > 0) {
            if ((balances.troll_coins || 0) < entryFee) {
                toast.error(`Insufficient coins. Need ${entryFee}, have ${balances.troll_coins}`)
                return
            }
            
            // Deduct coins
            const success = await spendCoins({
                senderId: user.id,
                amount: entryFee,
                source: 'purchase',
                item: `Entry fee for ${currentTournament.title}`
            })
            
            if (!success) {
                throw new Error('Failed to pay entry fee')
            }
        }

        // Check for existing row (handle re-join)
        const { data: existing } = await supabase
            .from('tournament_participants')
            .select('*')
            .eq('tournament_id', currentTournament.id)
            .eq('user_id', user.id)
            .maybeSingle()

        let error;
        if (existing) {
             // Upsert/Update
             const { error: updateError } = await supabase
                .from('tournament_participants')
                .update({ 
                    status: 'active', 
                    joined_at: new Date().toISOString() 
                })
                .eq('id', existing.id)
             error = updateError
        } else {
             // Insert
             const { error: insertError } = await supabase
                .from('tournament_participants')
                .insert({
                    tournament_id: currentTournament.id,
                    user_id: user.id,
                    joined_at: new Date().toISOString(),
                    status: 'active'
                })
             error = insertError
        }
        
        if (error) {
            if (error.code === '23505') { // Unique violation
                toast.error('You have already joined this tournament')
            } else {
                throw error
            }
        } else {
            toast.success('Successfully joined the tournament!')
            await refreshCoins()
            await loadParticipant()
        }
    } catch (error: any) {
        console.error('Error joining tournament:', error)
        toast.error(error.message || 'Failed to join tournament')
    } finally {
        setJoining(false)
    }
  }

  // Removed duplicate loadParticipant since it is now defined above with useCallback


  const handleWithdraw = async () => {
      if (!user || !currentTournament) return
      
      if (!window.confirm('Are you sure you want to withdraw from the tournament?')) return

      try {
          // 1. Try RPC first
          const { data: rpcData, error: rpcError } = await supabase.rpc('withdraw_tournament', { 
            p_tournament_id: currentTournament.id 
          })

          const result = rpcData as any
          if (!rpcError && result?.success) {
             toast.success(result.message)
             setParticipant(null)
             await refreshCoins()
             return
          }

          // 2. Fallback: Client-side logic
          console.log('Using client-side fallback for withdraw...')
          
          // A. Soft delete (Try updating status first)
          let softDeleteSuccess = false
          
          const { error: updateStatusError } = await supabase
            .from('tournament_participants')
            .update({ status: 'withdrawn' })
            .eq('tournament_id', currentTournament.id)
            .eq('user_id', user.id)
          
          if (!updateStatusError) {
              softDeleteSuccess = true
          } else {
              console.warn('Failed to update status, trying stats fallback...', updateStatusError)
              // B. If status update fails (e.g. column missing), update stats
              const { error: updateStatsError } = await supabase
                .from('tournament_participants')
                .update({ stats: { withdrawn: true, withdrawn_at: new Date().toISOString() } })
                .eq('tournament_id', currentTournament.id)
                .eq('user_id', user.id)
              
              if (!updateStatsError) softDeleteSuccess = true
          }

          // C. If update fails (e.g. RLS), try DELETE as last resort
          if (!softDeleteSuccess) {
             const { error: deleteError } = await supabase
                .from('tournament_participants')
                .delete()
                .eq('tournament_id', currentTournament.id)
                .eq('user_id', user.id)
             
             if (deleteError) {
                 console.error('All withdraw methods failed', deleteError)
                 throw new Error('Could not update participation status')
             }
          }

          // D. Refund if applicable
          if (currentTournament.entry_fee && currentTournament.entry_fee > 0) {
             const { success, error: refundError } = await addCoins({
                userId: user.id,
                amount: currentTournament.entry_fee,
                type: 'refund', 
                description: `Refund for ${currentTournament.title}`,
                sourceId: currentTournament.id
             })
             
             if (success) {
                toast.success(`Withdrawn & Refunded ${currentTournament.entry_fee} coins`)
             } else {
                toast.warning('Withdrawn, but refund failed: ' + refundError)
             }
          } else {
             toast.success('Withdrawn from tournament')
          }
          
          setParticipant(null)
          await refreshCoins()
      } catch (error: any) {
          console.error('Error withdrawing:', error)
          toast.error('Failed to withdraw: ' + (error.message || 'Unknown error'))
      }
  }

  if (loading && !currentTournament) {
      return (
          <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-white text-slate-900 p-8 flex items-center justify-center">
              <div className="animate-pulse text-purple-500">Loading Universe Event...</div>
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-white text-slate-900 pb-20 relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-[#050505] to-black pointer-events-none z-0" />
      
      {/* Grid Pattern */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(50,50,50,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(50,50,50,0.05)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,black_70%,transparent_100%)] pointer-events-none z-0" />
      
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-7xl">
        
        {/* Header Section */}
        {currentTournament ? (
          <div className="mb-12">
            <TournamentHero 
              tournament={currentTournament} 
              participant={participant}
              onJoin={handleJoin}
              loading={joining}
            />
          </div>
        ) : (
          <div className="mb-12 py-32 text-center border border-purple-500/10 rounded-3xl bg-black/40 backdrop-blur-md relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600 mb-6 tracking-tighter">
                NO ACTIVE EVENT
              </h1>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto font-light">
                The arena is currently silent. Prepare your decks and sharpen your skills. The next Universe Event will begin soon.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {currentTournament && (
               <TournamentTabs tournament={currentTournament} />
            )}
            
            {/* Upcoming Tournaments List */}
            {upcomingTournaments.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  Upcoming Events
                </h2>
                <div className="grid gap-4">
                  {upcomingTournaments.map(t => (
                    <Card key={t.id} className="bg-black/40 border-gray-800 hover:border-blue-500/50 transition-colors cursor-pointer group">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors">{t.title.replace(/Neon City/i, 'Troll City')}</h3>
                          <div className="text-sm text-gray-400 flex gap-4 mt-1">
                            <span>{new Date(t.start_at).toLocaleDateString()}</span>
                            {t.prize_pool && <span className="text-yellow-500/80">Pool: {t.prize_pool}</span>}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-blue-400" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            
            {/* Past Tournaments (Accordion style logic could be added here, just list for now) */}
            {pastTournaments.length > 0 && (
              <div className="space-y-4 pt-8 border-t border-gray-800">
                <h2 className="text-xl font-bold text-gray-400">Past Events</h2>
                <div className="grid gap-4">
                  {pastTournaments.map(t => (
                    <div key={t.id} className="flex justify-between items-center p-4 rounded bg-gray-900/30 border border-gray-800 text-gray-500">
                      <span>{t.title.replace(/Neon City/i, 'Troll City')}</span>
                      <span className="text-sm">Ended {new Date(t.end_at || '').toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <MyStatusCard 
              participant={participant} 
              tournament={currentTournament}
              onJoin={handleJoin}
              onWithdraw={handleWithdraw}
              loading={joining}
            />

            {currentTournament && (
              <CountdownCard 
                targetDate={currentTournament.status === 'open' || currentTournament.status === 'upcoming' ? currentTournament.start_at : (currentTournament.end_at || '')}
                label={currentTournament.status === 'open' || currentTournament.status === 'upcoming' ? 'Starts In' : 'Ends In'}
              />
            )}

            {/* Quick Stats or Promo */}
            <Card className="bg-gradient-to-br from-purple-900/20 to-black border-purple-500/30">
              <CardContent className="p-6 text-center space-y-4">
                <h3 className="font-bold text-white">Prize Pool Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-yellow-400 font-bold">
                    <span>1st Place</span>
                    <span>50%</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>2nd Place</span>
                    <span>25%</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>3rd Place</span>
                    <span>10%</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>4th-10th</span>
                    <span>Remaining</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  )
}
