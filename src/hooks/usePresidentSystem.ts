import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';

export type ElectionState = 'draft' | 'open' | 'closed' | 'finalized';

export interface PresidentElection {
  id: string;
  starts_at: string;
  ends_at: string;
  title?: string;
  description?: string;
  status: ElectionState;
  winner_candidate_id: string | null;
  created_at: string;
  voting_strategy: 'standard' | 'coins';
  candidate_limit?: number;
  candidates?: PresidentCandidate[];
}

export interface PresidentCandidate {
  id: string;
  election_id: string;
  user_id: string;
  slogan: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  vote_count: number;
  score: number; // New score field
  created_at: string;
  is_approved?: boolean; // Derived helper
  username?: string; // Joined
  avatar_url?: string; // Joined
}

export interface PresidentAppointment {
  id: string;
  president_user_id: string;
  vice_president_user_id: string;
  starts_at: string;
  ends_at: string;
  status: 'active' | 'removed' | 'expired';
  appointee?: {
    username: string;
    avatar_url: string;
  };
}

export interface TreasuryEntry {
  id: string;
  kind: 'deposit' | 'reserve' | 'release' | 'spend' | 'refund';
  amount_cents: number;
  currency: string;
  created_by: string; // actor_id
  created_at: string;
}

export const usePresidentSystem = () => {
  const { user } = useAuthStore();
  const [currentElection, setCurrentElection] = useState<PresidentElection | null>(null);
  const [currentPresident, setCurrentPresident] = useState<{ user_id: string; username: string; avatar_url: string } | null>(null);
  const [currentVP, setCurrentVP] = useState<PresidentAppointment | null>(null);
  const [treasuryBalance, setTreasuryBalance] = useState<number>(0);
  const [proposals, setProposals] = useState<any[]>([]); // Added missing state
  const [allElections, setAllElections] = useState<PresidentElection[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCurrentElection = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('president_elections')
        .select(`
          *,
          candidates:president_candidates!president_candidates_election_id_fkey(
            *,
            user:user_profiles(username, avatar_url)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        // Transform candidates to flatten user info
        const formattedCandidates = data.candidates?.map((c: any) => ({
          ...c,
          username: c.user?.username,
          avatar_url: c.user?.avatar_url,
          is_approved: c.status === 'approved'
        })) || [];
        
        setCurrentElection({ ...data, candidates: formattedCandidates });
      }
    } catch (err) {
      console.error('Error fetching election:', err);
    }
  }, []);

  const fetchCurrentPresident = useCallback(async () => {
    try {
      // Find user with 'president' badge or gold style
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .or('badge.eq.president,username_style.eq.gold')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setCurrentPresident({
           user_id: data.id,
           username: data.username,
           avatar_url: data.avatar_url
        });
      } else {
        // Fallback: check last finalized election winner
        const { data: election } = await supabase
          .from('president_elections')
          .select('winner_candidate_id')
          .eq('status', 'finalized')
          .order('end_date', { ascending: false })
          .limit(1)
          .maybeSingle();

         if (election?.winner_candidate_id) {
             const { data: candidate } = await supabase
               .from('president_candidates')
               .select('user_id')
               .eq('id', election.winner_candidate_id)
               .maybeSingle();
               
             if (candidate) {
                const { data: user } = await supabase
                  .from('user_profiles')
                  .select('id, username, avatar_url')
                  .eq('id', candidate.user_id)
                  .maybeSingle();
                  
                if (user) {
                   setCurrentPresident({
                     user_id: user.id,
                     username: user.username,
                     avatar_url: user.avatar_url
                   });
                }
             }
         }
      }
    } catch (err) {
      console.error('Error fetching president:', err);
    }
  }, []);

  const fetchVicePresident = useCallback(async () => {
      try {
          const { data, error } = await supabase
            .from('president_appointments')
            .select(`
                *,
                appointee:user_profiles!president_appointments_vice_president_user_id_fkey(username, avatar_url)
            `)
            .eq('status', 'active')
            .maybeSingle();
          
          if (error) throw error;
            
          if (data) {
              setCurrentVP(data as any);
          } else {
              setCurrentVP(null);
          }
      } catch (err) {
          console.error('Error fetching VP:', err);
      }
  }, []);
  
  const fetchTreasuryBalance = useCallback(async () => {
      try {
          const { data } = await supabase
            .from('president_treasury_balance')
            .select('balance_cents')
            .eq('currency', 'USD')
            .maybeSingle(); // Changed from single() to maybeSingle()
            
          if (data) {
              setTreasuryBalance(data.balance_cents / 100);
          } else {
             setTreasuryBalance(0);
          }
      } catch (err) {
          console.error(err);
      }
  }, []);

  const fetchProposals = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('president_proposals')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setProposals(data || []);
    } catch (err) {
      console.error('Error fetching proposals:', err);
    }
  }, []);

  const createElection = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('create_president_election');
      if (error) throw error;
      toast.success('Election created successfully');
      fetchCurrentElection();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const finalizeElection = async (electionId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('finalize_president_election', {
        p_election_id: electionId
      });
      if (error) throw error;
      toast.success('Election finalized!');
      fetchCurrentElection();
      fetchCurrentPresident();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const endElection = async (electionId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('president_elections')
        .update({ status: 'closed', ends_at: new Date().toISOString() })
        .eq('id', electionId);
      
      if (error) throw error;
      toast.success('Election ended successfully');
      fetchCurrentElection();
      fetchAllElections();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllElections = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('president_elections')
        .select(`
          *,
          candidates:president_candidates(
            *,
            user:user_profiles(username, avatar_url)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data) {
        const formattedElections = data.map((election: any) => ({
          ...election,
          candidates: election.candidates?.map((c: any) => ({
            ...c,
            username: c.user?.username,
            avatar_url: c.user?.avatar_url,
            is_approved: c.status === 'approved'
          })) || []
        }));
        setAllElections(formattedElections);
      }
    } catch (err) {
      console.error('Error fetching all elections:', err);
    }
  }, []);

  const signupCandidate = async (electionId: string, slogan: string, statement: string, bannerPath: string = 'default') => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const displayName = user?.user_metadata?.username || 'Unknown';

      const { error } = await supabase.rpc('signup_president_candidate', {
        p_election_id: electionId,
        p_banner_path: bannerPath,
        p_display_name: displayName,
        p_slogan: slogan,
        p_statement: statement
      });
      
      if (error) throw error;

      toast.success('Signed up as candidate!');
      fetchCurrentElection();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const approveCandidate = async (candidateId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('approve_president_candidate', {
        p_candidate_id: candidateId
      });
      if (error) throw error;
      toast.success('Candidate approved');
      fetchCurrentElection();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const rejectCandidate = async (candidateId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('reject_president_candidate', {
        p_candidate_id: candidateId
      });
      if (error) throw error;
      toast.success('Candidate rejected');
      fetchCurrentElection();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const voteForCandidate = async (candidateId: string) => {
    setLoading(true);
    try {
      if (!currentElection) return;
      
      const { error } = await supabase.rpc('vote_for_president_candidate', {
        p_election_id: currentElection.id,
        p_candidate_id: candidateId
      });
      
      if (error) throw error;
      toast.success('Vote cast successfully!');
      fetchCurrentElection(); 
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const voteWithCoins = async (candidateId: string, amount: number) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('vote_candidate_with_coins', {
        p_candidate_id: candidateId,
        p_amount: amount
      });
      if (error) throw error;
      toast.success(`Cast ${amount} coin votes!`);
      await fetchCurrentElection();
    } catch (err: any) {
      toast.error(err.message || 'Failed to vote');
    } finally {
      setLoading(false);
    }
  };

  const createProposal = async (title: string, description: string, type: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('create_president_proposal', {
        p_title: title,
        p_description: description,
        p_type: type
      });
      if (error) throw error;
      toast.success('Proposal submitted successfully');
      fetchProposals();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const postAnnouncement = async (message: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('post_president_announcement', {
        p_message: message
      });
      if (error) throw error;
      toast.success('Announcement posted');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const spendTreasury = async (amount: number, reason: string) => {
    setLoading(true);
    try {
      // Amount in cents
      const amountCents = Math.floor(amount * 100);
      const { error } = await supabase.rpc('spend_president_treasury', {
        p_amount_cents: amountCents,
        p_reason: reason
      });
      if (error) throw error;
      toast.success('Treasury funds spent');
      fetchTreasuryBalance();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const flagUser = async (userId: string, reason: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('president_flag_user', {
        p_target_user_id: userId,
        p_reason: reason
      });
      if (error) throw error;
      toast.success('User flagged for review');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const raisePayouts = async (amount: number) => {
      setLoading(true);
      try {
          const { error } = await supabase.rpc('president_raise_payouts', {
              p_amount_cents: amount * 100 // Convert to cents
          });
          if (error) throw error;
          toast.success(`Payouts raised by $${amount}!`);
          fetchTreasuryBalance();
      } catch (err: any) {
          toast.error(err.message);
      } finally {
          setLoading(false);
      }
  };

  const appointVP = async (userId: string) => {
      setLoading(true);
      try {
          const { error } = await supabase.rpc('appoint_vice_president', {
              p_appointee_id: userId
          });
          if (error) throw error;
          toast.success('Vice President appointed!');
          fetchVicePresident();
      } catch (err: any) {
          toast.error(err.message);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
    fetchCurrentElection();
    fetchCurrentPresident();
    fetchVicePresident();
    fetchTreasuryBalance();
    fetchProposals();
  }, [fetchCurrentElection, fetchCurrentPresident, fetchVicePresident, fetchTreasuryBalance, fetchProposals]);

  const isPresident = currentPresident?.user_id === user?.id;
  const isVP = currentVP?.vice_president_user_id === user?.id;

  return {
    currentElection,
    currentPresident,
    currentVP,
    isPresident,
    isVP,
    treasuryBalance,
    proposals,
    loading,
    refresh: () => {
      fetchCurrentElection();
      fetchCurrentPresident();
      fetchVicePresident();
      fetchTreasuryBalance();
      fetchProposals();
    },
    createElection,
    finalizeElection,
    endElection,
    allElections,
    fetchAllElections,
    signupCandidate,
    approveCandidate,
    rejectCandidate,
    voteForCandidate,
    voteWithCoins,
    createProposal,
    postAnnouncement,
    spendTreasury,
    flagUser,
    raisePayouts,
    appointVP,
    fetchProposals
  };
};
