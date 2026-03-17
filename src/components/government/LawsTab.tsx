import React, { useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { 
  Law, 
  LawVote, 
  PoliticalParty, 
  Bribe, 
  Protest, 
  GovernmentReputation, 
  CityReputation,
  createLaw,
  voteOnLaw,
  createPoliticalParty,
  submitBribe,
  exposeBribe,
  createProtest,
  joinProtest,
  useEmergencyPower
} from '@/hooks/useGovernmentSystem';
import { Scroll, Plus, ThumbsUp, ThumbsDown, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface LawsTabProps {
  laws: Law[];
  activeLaw: Law | null;
  politicalParties: PoliticalParty[];
  bribes: Bribe[];
  protests: Protest[];
  reputation: GovernmentReputation | null;
  cityReputation: CityReputation | null;
  onSetActiveLaw: (law: Law | null) => void;
  onCreateLaw: (law: Partial<Law>) => Promise<any>;
  onVoteOnLaw: (lawId: string, vote: 'yes' | 'no' | 'abstain') => Promise<void>;
  onFetchPoliticalParties: () => Promise<void>;
  onCreatePoliticalParty: (party: Partial<PoliticalParty>) => Promise<any>;
  onSubmitBribe: (bribeeId: string, amount: number, purpose: string) => Promise<void>;
  onExposeBribe: (bribeId: string, reason: string) => Promise<void>;
  onCreateProtest: (protest: Partial<Protests>) => Promise<any>;
  onJoinProtest: (protestId: string) => Promise<void>;
  onUseEmergencyPower: (actionType: string, targetId?: string, reason?: string) => Promise<void>;
  roleLevel: string;
}

const CATEGORIES = [
  { value: 'general', label: 'General', description: 'General city laws' },
  { value: 'tax', label: 'Tax & Economy', description: 'Taxation and economic policies' },
  { value: 'safety', label: 'Public Safety', description: 'Law enforcement and safety' },
  { value: 'social', label: 'Social', description: 'Social programs and welfare' },
  { value: 'marketplace', label: 'Marketplace', description: 'Commerce and trade regulations' },
  { value: 'family', label: 'Family', description: 'Family-related policies' },
  { value: 'emergency', label: 'Emergency', description: 'Emergency measures' }
];

const EFFECT_TYPES = [
  { value: 'none', label: 'No Effect', description: 'This law has no gameplay effect' },
  { value: 'xp_boost', label: 'XP Boost', description: 'Increase XP gains' },
  { value: 'coin_tax', label: 'Coin Tax', description: 'Tax on coin transactions' },
  { value: 'marketplace_fee', label: 'Marketplace Fee', description: 'Adjust marketplace fees' },
  { value: 'family_bonus', label: 'Family Bonus', description: 'Benefits for family members' },
  { value: 'officer_bonus', label: 'Officer Bonus', description: 'Benefits for officers' },
  { value: 'broadcast_bonus', label: 'Broadcast Bonus', description: 'Benefits for broadcasters' }
];

export default function LawsTab({
  laws,
  activeLaw,
  onSetActiveLaw,
  onCreateLaw,
  onVoteOnLaw,
  roleLevel
}: LawsTabProps) {
  const { user } = useAuthStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newLaw, setNewLaw] = useState({
    title: '',
    description: '',
    category: 'general',
    effect_type: 'none',
    effect_value: {},
    required_votes: 10
  });
  const [votingLawId, setVotingLawId] = useState<string | null>(null);
  
  const canCreateLaw = ['secretary', 'president', 'admin'].includes(roleLevel);
  const activeLaws = laws.filter(l => l.status === 'active');
  const votingLaws = laws.filter(l => l.status === 'voting');
  const draftLaws = laws.filter(l => l.status === 'draft');
  
  const handleCreateLaw = async () => {
    if (!newLaw.title.trim()) {
      toast.error('Please enter a law title');
      return;
    }
    
    try {
      await onCreateLaw(newLaw);
      toast.success('Law created successfully!');
      setShowCreateForm(false);
      setNewLaw({
        title: '',
        description: '',
        category: 'general',
        effect_type: 'none',
        effect_value: {},
        required_votes: 10
      });
    } catch (error) {
      toast.error('Failed to create law');
    }
  };
  
  const handleVote = async (lawId: string, vote: 'yes' | 'no') => {
    setVotingLawId(lawId);
    try {
      await onVoteOnLaw(lawId, vote);
      toast.success(`Vote recorded: ${vote.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to record vote');
    }
    setVotingLawId(null);
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'voting': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'draft': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'expired': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };
  
  const getTimeRemaining = (endDate: string | null) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    
    if (diff < 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Scroll className="text-blue-400" />
            City Laws
          </h2>
          <p className="text-slate-400 mt-1">View and vote on city legislation</p>
        </div>
        
        {canCreateLaw && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-colors"
          >
            <Plus size={20} />
            Create Law
          </button>
        )}
      </div>
      
      {/* Create Law Form */}
      {showCreateForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-bold">Draft New Law</h3>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Title</label>
              <input
                type="text"
                value={newLaw.title}
                onChange={(e) => setNewLaw({ ...newLaw, title: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                placeholder="Enter law title..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Category</label>
              <select
                value={newLaw.category}
                onChange={(e) => setNewLaw({ ...newLaw, category: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
            <textarea
              value={newLaw.description}
              onChange={(e) => setNewLaw({ ...newLaw, description: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500 h-24"
              placeholder="Describe what this law does..."
            />
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Effect Type</label>
              <select
                value={newLaw.effect_type}
                onChange={(e) => setNewLaw({ ...newLaw, effect_type: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                {EFFECT_TYPES.map(eff => (
                  <option key={eff.value} value={eff.value}>{eff.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Required Votes</label>
              <input
                type="number"
                value={newLaw.required_votes}
                onChange={(e) => setNewLaw({ ...newLaw, required_votes: parseInt(e.target.value) || 10 })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                min={1}
              />
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleCreateLaw}
              className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold transition-colors"
            >
              Submit for Voting
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-green-400">{activeLaws.length}</div>
          <div className="text-sm text-slate-400">Active Laws</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-blue-400">{votingLaws.length}</div>
          <div className="text-sm text-slate-400">In Voting</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-slate-400">{draftLaws.length}</div>
          <div className="text-sm text-slate-400">Drafts</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-yellow-400">{laws.length}</div>
          <div className="text-sm text-slate-400">Total Laws</div>
        </div>
      </div>
      
      {/* Voting Laws */}
      {votingLaws.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Clock className="text-blue-400" />
            Laws in Voting
          </h3>
          <div className="grid gap-4">
            {votingLaws.map(law => (
              <div key={law.id} className="bg-slate-900 border border-blue-500/30 rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-lg">{law.title}</h4>
                    <p className="text-slate-400 text-sm mt-1">{law.description}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(law.status)}`}>
                    VOTING
                  </span>
                </div>
                
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1 bg-slate-950 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${(law.yes_votes / (law.yes_votes + law.no_votes || 1)) * 100}%` }}
                    />
                  </div>
                  <div className="text-sm">
                    <span className="text-green-400 font-bold">{law.yes_votes}</span>
                    <span className="text-slate-500"> / </span>
                    <span className="text-red-400 font-bold">{law.no_votes}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-400">
                    {getTimeRemaining(law.voting_ends_at)} • {law.required_votes} votes needed
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleVote(law.id, 'yes')}
                      disabled={votingLawId === law.id}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg font-bold transition-colors"
                    >
                      <ThumbsUp size={16} />
                      Vote Yes
                    </button>
                    <button
                      onClick={() => handleVote(law.id, 'no')}
                      disabled={votingLawId === law.id}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg font-bold transition-colors"
                    >
                      <ThumbsDown size={16} />
                      Vote No
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Active Laws */}
      {activeLaws.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <CheckCircle className="text-green-400" />
            Active Laws
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {activeLaws.map(law => (
              <div key={law.id} className="bg-slate-900 border border-green-500/30 rounded-xl p-5">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-bold">{law.title}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getStatusColor(law.status)}`}>
                    ACTIVE
                  </span>
                </div>
                <p className="text-slate-400 text-sm">{law.description}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <span className="capitalize">{law.category}</span>
                  <span>•</span>
                  <span>{law.yes_votes} votes passed</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* All Laws List */}
      {laws.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Scroll className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-medium text-slate-300 mb-2">No Laws Yet</h3>
          <p>No city laws have been created. {canCreateLaw && 'Be the first to propose one!'}</p>
        </div>
      )}
    </div>
  );
}
