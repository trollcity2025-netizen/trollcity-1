
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { X, Search, Gavel, AlertTriangle, Scale } from 'lucide-react';
import { toast } from 'sonner';

interface FileLawsuitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FileLawsuitModal({ isOpen, onClose, onSuccess }: FileLawsuitModalProps) {
  const [loading, setLoading] = useState(false);
  
  // Form Data
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedDefendant, setSelectedDefendant] = useState<any>(null);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [claimAmount, setClaimAmount] = useState<number>(0);

  const CASE_CATEGORIES = [
    'Debt / Unpaid Loan',
    'Scam / Fraud',
    'Breach of Contract',
    'Harassment Compensation',
    'Defamation / Slander',
    'Theft of Digital Assets',
    'Other Civil Dispute'
  ];

  useEffect(() => {
    if (searchQuery.length > 2) {
      const searchUsers = async () => {
        const { data } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .ilike('username', `%${searchQuery}%`)
          .limit(5);
        if (data) setSearchResults(data);
      };
      const timeout = setTimeout(searchUsers, 300);
      return () => clearTimeout(timeout);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleSubmit = async () => {
    if (!selectedDefendant) return toast.error('Please select a defendant');
    if (!category) return toast.error('Please select a category');
    if (!description) return toast.error('Please provide a description');
    if (claimAmount < 0) return toast.error('Claim amount cannot be negative');

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('file_civil_lawsuit', {
        p_defendant_id: selectedDefendant.id,
        p_category: category,
        p_description: description,
        p_evidence_url: evidenceUrl,
        p_claim_amount: claimAmount
      });

      if (error) throw error;

      if (data && data.success) {
        toast.success('Lawsuit filed successfully!');
        onSuccess();
        onClose();
      } else {
        toast.error(data?.message || 'Failed to file lawsuit');
      }
    } catch (err: any) {
      console.error('Error filing lawsuit:', err);
      toast.error(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#120F1D] border border-purple-500/30 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#1A1625]">
          <div className="flex items-center gap-3">
            <div className="bg-red-500/20 p-2 rounded-lg">
              <Scale className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">File Civil Lawsuit</h2>
              <p className="text-xs text-gray-400">Troll City Civil Court • Filing Fee: 500 Coins</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Step 1: Defendant Selection */}
          <div className="space-y-4">
            <label className="text-sm font-medium text-gray-300 block">1. Who are you suing?</label>
            {selectedDefendant ? (
              <div className="flex items-center justify-between bg-purple-900/20 border border-purple-500/30 p-3 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center font-bold text-white">
                    {selectedDefendant.username[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-white">{selectedDefendant.username}</div>
                    <div className="text-xs text-gray-400">Defendant</div>
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedDefendant(null); setSearchQuery(''); }}
                  className="text-xs text-red-400 hover:text-red-300 underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search user by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#1A1625] border border-white/10 rounded-lg shadow-xl z-10 max-h-60 overflow-y-auto">
                    {searchResults.map(user => (
                      <button
                        key={user.id}
                        onClick={() => setSelectedDefendant(user)}
                        className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center gap-3 transition-colors"
                      >
                        <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-xs">
                          {user.username[0]}
                        </div>
                        <span className="text-gray-200">{user.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Case Details */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">Select Category</option>
                {CASE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Claim Amount (Coins)</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={claimAmount}
                onChange={(e) => setClaimAmount(parseInt(e.target.value) || 0)}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Description of Complaint</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain why you are suing this user. Be specific."
              className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white h-32 resize-none focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Evidence (Optional)</label>
            <input
              type="text"
              placeholder="https://..."
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
            />
            <p className="text-xs text-gray-500">Link to screenshots, clips, or message logs.</p>
          </div>

          {/* Warning */}
          <div className="bg-yellow-900/10 border border-yellow-500/20 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-200/80">
              <p className="font-semibold text-yellow-400 mb-1">Important:</p>
              <p>Filing a frivolous lawsuit may result in counter-fines. The 500 coin filing fee is non-refundable unless the judge rules otherwise.</p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-[#1A1625] flex items-center justify-between">
          <div className="text-sm">
            <span className="text-gray-400">Cost:</span>
            <span className="text-white font-bold text-lg ml-2">500 Coins</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !selectedDefendant || !category || !description}
              className={`px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-all flex items-center gap-2 ${
                (loading || !selectedDefendant || !category || !description) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Filing...' : 'File Lawsuit'}
              <Gavel size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
