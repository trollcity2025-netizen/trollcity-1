import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/supabaseClient';
import { useAuthStore } from '@/lib/store';

export interface Law {
  id: string;
  title: string;
  description: string;
  category: string;
  effect_type: string;
  effect_value: Record<string, any>;
  status: 'draft' | 'voting' | 'active' | 'expired' | 'rejected';
  created_by: string;
  created_at: string;
  voting_starts_at: string | null;
  voting_ends_at: string | null;
  activated_at: string | null;
  expires_at: string | null;
  required_votes: number;
  yes_votes: number;
  no_votes: number;
  is_emergency: boolean;
  created_by_profile?: {
    username: string;
    avatar_url: string;
  };
}

export interface LawVote {
  id: string;
  law_id: string;
  user_id: string;
  vote: 'yes' | 'no' | 'abstain';
  weight: number;
  voted_at: string;
}

export interface PoliticalParty {
  id: string;
  name: string;
  description: string;
  image_url: string;
  is_political_party: boolean;
  party_leader_id: string;
  party_ideology: string;
  party_established_at: string;
  party_membership_count: number;
  party_treasury: number;
  election_wins: number;
  leader_profile?: {
    username: string;
    avatar_url: string;
  };
}

export interface Bribe {
  id: string;
  briber_id: string;
  bribee_id: string | null;
  exposed_by: string | null;
  amount: number;
  purpose: string;
  is_exposed: boolean;
  exposed_at: string | null;
  created_at: string;
  status: 'secret' | 'exposed' | 'investigated';
  briber_profile?: {
    username: string;
    avatar_url: string;
  };
  bribee_profile?: {
    username: string;
    avatar_url: string;
  } | null;
  exposed_by_profile?: {
    username: string;
    avatar_url: string;
  } | null;
}

export interface Protest {
  id: string;
  title: string;
  description: string;
  organizer_id: string;
  target_law_id: string | null;
  intensity: number;
  status: 'active' | 'growing' | 'crisis' | 'resolved' | 'dispersed';
  participant_count: number;
  max_participants: number;
  started_at: string;
  ended_at: string | null;
  effect_on_law: number;
  effect_on_reputation: number;
  location: string;
  organizer_profile?: {
    username: string;
    avatar_url: string;
  };
}

export interface GovernmentReputation {
  id: string;
  user_id: string;
  government_trust: number;
  player_influence: number;
  party_reputation: number;
  last_updated: string;
}

export interface CityReputation {
  id: string;
  total_laws_passed: number;
  active_laws: number;
  average_trust: number;
  protest_count: number;
  corruption_exposed_count: number;
  emergency_declarations: number;
  last_election_date: string | null;
  election_participation_rate: number;
  updated_at: string;
}

export interface EmergencyPowerAction {
  id: string;
  president_id: string;
  action_type: string;
  target_user_id: string | null;
  target_law_id: string | null;
  target_protest_id: string | null;
  reason: string;
  backlash_score: number;
  created_at: string;
  cooldown_ends_at: string | null;
}

// Role-based tab permissions
export const ROLE_TABS = {
  officer: ['Officer Dashboard', 'Officer Lounge', 'Officer Moderation'],
  lead: ['Lead HQ', 'Officer Dashboard', 'Officer Lounge'],
  secretary: ['Secretary Console', 'Laws', 'Voting'],
  president: ['ALL'],
  admin: ['ALL']
};

export const TAB_PERMISSIONS: Record<string, string[]> = {
  'Laws': ['officer', 'lead', 'secretary', 'president', 'admin', 'citizen'],
  'Voting': ['officer', 'lead', 'secretary', 'president', 'admin', 'citizen'],
  'Enforcement': ['officer', 'lead', 'secretary', 'president', 'admin'],
  'Roles & Power': ['secretary', 'president', 'admin'],
  'History': ['officer', 'lead', 'secretary', 'president', 'admin', 'citizen'],
  'Elections': ['officer', 'lead', 'secretary', 'president', 'admin', 'citizen'],
  'Parties': ['officer', 'lead', 'secretary', 'president', 'admin', 'citizen'],
  'Corruption': ['officer', 'lead', 'secretary', 'president', 'admin'],
  'Protests': ['officer', 'lead', 'secretary', 'president', 'admin', 'citizen'],
  'Emergency': ['president', 'admin'],
  'Officer Dashboard': ['officer', 'lead', 'president', 'admin']
};

export const useGovernmentSystem = () => {
  const { user, profile } = useAuthStore();
  const [laws, setLaws] = useState<Law[]>([]);
  const [activeLaw, setActiveLaw] = useState<Law | null>(null);
  const [politicalParties, setPoliticalParties] = useState<PoliticalParty[]>([]);
  const [bribes, setBribes] = useState<Bribe[]>([]);
  const [protests, setProtests] = useState<Protest[]>([]);
  const [reputation, setReputation] = useState<GovernmentReputation | null>(null);
  const [cityReputation, setCityReputation] = useState<CityReputation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get user's role level
  const getUserRoleLevel = useCallback(() => {
    if (!profile) return 'citizen';
    if (profile.role === 'admin' || profile.is_admin) return 'admin';
    if (profile.role === 'president') return 'president';
    if (profile.role === 'secretary') return 'secretary';
    if (profile.is_lead_officer || profile.officer_role === 'lead_officer') return 'lead';
    if (profile.is_troll_officer || profile.role === 'troll_officer') return 'officer';
    return 'citizen';
  }, [profile]);

  // Get available tabs for user
  const getAvailableTabs = useCallback(() => {
    const roleLevel = getUserRoleLevel();
    const tabs = [
      { id: 'laws', name: 'Laws', icon: '📜' },
      { id: 'voting', name: 'Voting', icon: '🗳️' },
      { id: 'enforcement', name: 'Enforcement', icon: '👮' },
      { id: 'roles', name: 'Roles & Power', icon: '🏛️' },
      { id: 'history', name: 'History', icon: '📜' },
      { id: 'elections', name: 'Elections', icon: '🗳️' },
      { id: 'parties', name: 'Parties', icon: '🏛️' },
      { id: 'corruption', name: 'Corruption', icon: '💰' },
      { id: 'protests', name: 'Protests', icon: '✊' },
      { id: 'emergency', name: 'Emergency', icon: '🚨' },
      { id: 'officer-dashboard', name: 'Officer Dashboard', icon: '👮' }
    ];
    
    return tabs.filter(tab => {
      const permissions = TAB_PERMISSIONS[tab.name];
      if (!permissions) return false;
      if (permissions.includes('ALL')) return true;
      return permissions.includes(roleLevel);
    });
  }, [getUserRoleLevel]);

  // Fetch laws
  const fetchLaws = useCallback(async (status?: string) => {
    try {
      let query = supabase
        .from('government_laws')
        .select('*, created_by_profile:user_profiles(username, avatar_url)')
        .order('created_at', { ascending: false });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setLaws(data || []);
    } catch (err: any) {
      console.error('Error fetching laws:', err);
      setError(err.message);
    }
  }, []);

  // Create a new law
  const createLaw = useCallback(async (law: Partial<Law>) => {
    try {
      const { data, error } = await supabase
        .from('government_laws')
        .insert([{
          ...law,
          created_by: user?.id
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      // Log the action
      await supabase.rpc('log_government_action', {
        p_event_type: 'law_created',
        p_actor_id: user?.id,
        p_target_id: data.id,
        p_description: `Law created: ${law.title}`
      });
      
      await fetchLaws();
      return data;
    } catch (err: any) {
      console.error('Error creating law:', err);
      setError(err.message);
      throw err;
    }
  }, [user, fetchLaws]);

  // Vote on a law
  const voteOnLaw = useCallback(async (lawId: string, vote: 'yes' | 'no' | 'abstain') => {
    try {
      // Get vote weight
      const { data: weightData } = await supabase.rpc('get_vote_weight', {
        p_user_id: user?.id
      });
      const weight = weightData || 1;
      
      const { error } = await supabase
        .from('law_votes')
        .upsert([{
          law_id: lawId,
          user_id: user?.id,
          vote,
          weight
        }], { onConflict: 'law_id,user_id' });
      
      if (error) throw error;
      await fetchLaws();
    } catch (err: any) {
      console.error('Error voting on law:', err);
      setError(err.message);
      throw err;
    }
  }, [user, fetchLaws]);

  // Fetch political parties
  const fetchPoliticalParties = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('families')
        .select('*, leader_profile:user_profiles(username, avatar_url)')
        .eq('is_political_party', true)
        .order('party_membership_count', { ascending: false });
      
      if (error) throw error;
      setPoliticalParties(data || []);
    } catch (err: any) {
      console.error('Error fetching parties:', err);
      setError(err.message);
    }
  }, []);

  // Create a political party
  const createPoliticalParty = useCallback(async (party: Partial<PoliticalParty>) => {
    try {
      const { data, error } = await supabase
        .from('families')
        .insert([{
          name: party.name,
          description: party.description,
          image_url: party.image_url,
          is_political_party: true,
          party_leader_id: user?.id,
          party_ideology: party.party_ideology,
          party_established_at: new Date().toISOString(),
          party_membership_count: 1,
          leader_id: user?.id
        }])
        .select()
        .single();
      
      if (error) throw error;
      await fetchPoliticalParties();
      return data;
    } catch (err: any) {
      console.error('Error creating party:', err);
      setError(err.message);
      throw err;
    }
  }, [user, fetchPoliticalParties]);

  // Fetch bribes
  const fetchBribes = useCallback(async () => {
    try {
      const roleLevel = getUserRoleLevel();
      let query = supabase
        .from('bribe_logs')
        .select('*, briber_profile:user_profiles!bribe_logs_from_user_fkey(username, avatar_url), bribee_profile:user_profiles!bribe_logs_to_user_fkey(username, avatar_url), exposed_by_profile:user_profiles!bribe_logs_exposed_by_fkey(username, avatar_url)')
        .order('created_at', { ascending: false });
      
      // Only officers/admins can see all bribes
      if (!['officer', 'lead', 'secretary', 'president', 'admin'].includes(roleLevel)) {
        query = query.eq('briber_id', user?.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setBribes(data || []);
    } catch (err: any) {
      console.error('Error fetching bribes:', err);
      setError(err.message);
    }
  }, [user, getUserRoleLevel]);

  // Submit a bribe
  const submitBribe = useCallback(async (bribeeId: string, amount: number, purpose: string) => {
    try {
      const { data, error } = await supabase
        .from('bribe_logs')
        .insert([{
          briber_id: user?.id,
          bribee_id: bribeeId,
          amount,
          purpose,
          status: 'secret'
        }])
        .select()
        .single();
      
      if (error) throw error;
      await fetchBribes();
      return data;
    } catch (err: any) {
      console.error('Error submitting bribe:', err);
      setError(err.message);
      throw err;
    }
  }, [user, fetchBribes]);

  // Expose a bribe
  const exposeBribe = useCallback(async (bribeId: string, reason: string) => {
    try {
      const { error } = await supabase.rpc('expose_bribe', {
        p_bribe_id: bribeId,
        p_exposed_by: user?.id,
        p_reason: reason
      });
      
      if (error) throw error;
      await fetchBribes();
    } catch (err: any) {
      console.error('Error exposing bribe:', err);
      setError(err.message);
      throw err;
    }
  }, [user, fetchBribes]);

  // Fetch protests
  const fetchProtests = useCallback(async (status?: string) => {
    try {
      let query = supabase
        .from('protests')
        .select('*, organizer_profile:user_profiles(username, avatar_url)')
        .order('started_at', { ascending: false });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setProtests(data || []);
    } catch (err: any) {
      console.error('Error fetching protests:', err);
      setError(err.message);
    }
  }, []);

  // Create a protest
  const createProtest = useCallback(async (protest: Partial<Protest>) => {
    try {
      const { data, error } = await supabase
        .from('protests')
        .insert([{
          ...protest,
          organizer_id: user?.id
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      // Join as organizer
      await supabase
        .from('protest_participants')
        .insert([{
          protest_id: data.id,
          user_id: user?.id,
          contribution: 5
        }]);
      
      await fetchProtests();
      return data;
    } catch (err: any) {
      console.error('Error creating protest:', err);
      setError(err.message);
      throw err;
    }
  }, [user, fetchProtests]);

  // Join a protest
  const joinProtest = useCallback(async (protestId: string) => {
    try {
      const { error } = await supabase
        .from('protest_participants')
        .insert([{
          protest_id: protestId,
          user_id: user?.id
        }]);
      
      if (error) throw error;
      await fetchProtests();
    } catch (err: any) {
      console.error('Error joining protest:', err);
      setError(err.message);
      throw err;
    }
  }, [user, fetchProtests]);

  // Fetch user reputation
  const fetchReputation = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_reputation')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (error) throw error;
      setReputation(data);
    } catch (err: any) {
      console.error('Error fetching reputation:', err);
    }
  }, [user]);

  // Fetch city reputation
  const fetchCityReputation = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('city_reputation')
        .select('*')
        .maybeSingle();
      
      if (error) throw error;
      setCityReputation(data);
    } catch (err: any) {
      console.error('Error fetching city reputation:', err);
    }
  }, []);

  // Use emergency power
  const useEmergencyPower = useCallback(async (
    actionType: string,
    targetId?: string,
    reason?: string
  ) => {
    try {
      // Check cooldown
      const { data: canUse } = await supabase.rpc('check_emergency_cooldown', {
        p_president_id: user?.id
      });
      
      if (!canUse) {
        throw new Error('Emergency powers on cooldown. Please wait before using again.');
      }
      
      const { error } = await supabase
        .from('emergency_powers_log')
        .insert([{
          president_id: user?.id,
          action_type: actionType,
          target_user_id: actionType === 'jail_user' ? targetId : null,
          target_law_id: actionType === 'force_law' || actionType === 'override_vote' ? targetId : null,
          target_protest_id: actionType === 'end_protest' ? targetId : null,
          reason,
          cooldown_ends_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        }]);
      
      if (error) throw error;
      
      // Log the action
      await supabase.rpc('log_government_action', {
        p_event_type: 'emergency_power_used',
        p_actor_id: user?.id,
        p_target_id: targetId,
        p_description: `Emergency power used: ${actionType}`
      });
    } catch (err: any) {
      console.error('Error using emergency power:', err);
      setError(err.message);
      throw err;
    }
  }, [user]);

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await Promise.all([
        fetchLaws(),
        fetchPoliticalParties(),
        fetchBribes(),
        fetchProtests(),
        fetchReputation(),
        fetchCityReputation()
      ]);
      setLoading(false);
    };
    
    if (user) {
      initializeData();
    }
  }, [user]);

  return {
    // Data
    laws,
    activeLaw,
    politicalParties,
    bribes,
    protests,
    reputation,
    cityReputation,
    loading,
    error,
    
    // Methods
    fetchLaws,
    setActiveLaw,
    createLaw,
    voteOnLaw,
    fetchPoliticalParties,
    createPoliticalParty,
    fetchBribes,
    submitBribe,
    exposeBribe,
    fetchProtests,
    createProtest,
    joinProtest,
    fetchReputation,
    fetchCityReputation,
    useEmergencyPower,
    getUserRoleLevel,
    getAvailableTabs
  };
};
