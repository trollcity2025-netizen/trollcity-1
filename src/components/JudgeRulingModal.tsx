
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { X, Gavel, Scale, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface JudgeRulingModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: any;
  onSuccess: () => void;
}

export default function JudgeRulingModal({ isOpen, onClose, caseData, onSuccess }: JudgeRulingModalProps) {
  const [rulingType, setRulingType] = useState<'dismissed' | 'plaintiff_favored' | 'defendant_favored' | ''>('');
  const [rulingNotes, setRulingNotes] = useState('');
  const [awardAmount, setAwardAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  if (!isOpen || !caseData) return null;

  const handleRuling = async () => {
    if (!rulingType) return toast.error('Please select a verdict');
    if (!rulingNotes) return toast.error('Please provide ruling notes');
    if (rulingType === 'plaintiff_favored' && awardAmount < 0) return toast.error('Award amount cannot be negative');

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('rule_civil_lawsuit', {
        p_case_id: caseData.id,
        p_verdict: rulingType,
        p_ruling_notes: rulingNotes,
        p_award_amount: rulingType === 'plaintiff_favored' ? awardAmount : 0
      });

      if (error) throw error;

      if (data && data.success) {
        toast.success('Ruling issued successfully');
        onSuccess();
        onClose();
      } else {
        toast.error(data?.message || 'Failed to issue ruling');
      }
    } catch (err: any) {
      console.error('Error issuing ruling:', err);
      toast.error(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#120F1D] border border-purple-500/30 rounded-xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#1A1625]">
          <div className="flex items-center gap-3">
            <div className="bg-purple-500/20 p-2 rounded-lg">
              <Gavel className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Judge's Chambers</h2>
              <p className="text-xs text-gray-400">Case #{caseData.case_number} • {caseData.category}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 grid md:grid-cols-2 gap-6">
          
          {/* Case Details (Left) */}
          <div className="space-y-6 border-r border-white/5 pr-6">
            <div>
              <h3 className="text-sm font-bold text-purple-400 mb-2 uppercase tracking-wider">Parties Involved</h3>
              <div className="bg-black/20 p-4 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Plaintiff</span>
                  <span className="text-white font-semibold">{caseData.plaintiff?.username}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Defendant</span>
                  <span className="text-white font-semibold">{caseData.defendant?.username}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-purple-400 mb-2 uppercase tracking-wider">Complaint</h3>
              <div className="bg-black/20 p-4 rounded-lg">
                <p className="text-gray-300 text-sm whitespace-pre-wrap">{caseData.description}</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-purple-400 mb-2 uppercase tracking-wider">Claim</h3>
              <div className="bg-black/20 p-4 rounded-lg flex justify-between items-center">
                <span className="text-gray-400 text-sm">Seeking Damages</span>
                <span className="text-yellow-400 font-bold">{caseData.claim_amount} Coins</span>
              </div>
            </div>

            {caseData.evidence_url && (
               <div>
                <h3 className="text-sm font-bold text-purple-400 mb-2 uppercase tracking-wider">Evidence</h3>
                <a 
                  href={caseData.evidence_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm bg-blue-900/20 p-3 rounded-lg border border-blue-500/20"
                >
                  <ExternalLink size={16} />
                  View Submitted Evidence
                </a>
              </div>
            )}
          </div>

          {/* Ruling Form (Right) */}
          <div className="space-y-6">
             <div>
              <h3 className="text-sm font-bold text-purple-400 mb-4 uppercase tracking-wider">Official Ruling</h3>
              
              <div className="space-y-3">
                <button
                  onClick={() => setRulingType('dismissed')}
                  className={`w-full p-4 rounded-lg border flex items-center justify-between transition-all ${
                    rulingType === 'dismissed' 
                      ? 'bg-gray-700 border-gray-500 text-white' 
                      : 'bg-black/20 border-white/10 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <span className="font-semibold">Dismiss Case</span>
                  <span className="text-xs">No Action Taken</span>
                </button>

                <button
                  onClick={() => setRulingType('plaintiff_favored')}
                  className={`w-full p-4 rounded-lg border flex items-center justify-between transition-all ${
                    rulingType === 'plaintiff_favored' 
                      ? 'bg-green-900/40 border-green-500 text-green-100' 
                      : 'bg-black/20 border-white/10 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <span className="font-semibold">Rule for Plaintiff</span>
                  <span className="text-xs">Award Damages</span>
                </button>

                <button
                  onClick={() => setRulingType('defendant_favored')}
                  className={`w-full p-4 rounded-lg border flex items-center justify-between transition-all ${
                    rulingType === 'defendant_favored' 
                      ? 'bg-red-900/40 border-red-500 text-red-100' 
                      : 'bg-black/20 border-white/10 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <span className="font-semibold">Rule for Defendant</span>
                  <span className="text-xs">No Damages</span>
                </button>
              </div>
            </div>

            {rulingType === 'plaintiff_favored' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <label className="text-sm font-medium text-gray-300">Award Amount (Coins)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={awardAmount}
                    onChange={(e) => setAwardAmount(parseInt(e.target.value) || 0)}
                    className="w-full bg-black/30 border border-green-500/50 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400"
                    placeholder="Enter amount to transfer"
                  />
                  <span className="absolute right-4 top-3 text-gray-500 text-sm">MAX: {caseData.claim_amount}</span>
                </div>
                <p className="text-xs text-gray-500">
                  This amount will be automatically transferred from the Defendant's balance to the Plaintiff.
                  If the Defendant has insufficient funds, the maximum available balance will be transferred.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Ruling Notes / Justification</label>
              <textarea
                value={rulingNotes}
                onChange={(e) => setRulingNotes(e.target.value)}
                placeholder="Explain the reasoning for this verdict..."
                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white h-32 resize-none focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-[#1A1625] flex items-center justify-between">
          <div className="text-xs text-gray-500">
            * All rulings are final and recorded in the immutable court ledger.
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRuling}
              disabled={loading || !rulingType || !rulingNotes}
              className={`px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition-all flex items-center gap-2 ${
                (loading || !rulingType || !rulingNotes) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Submitting...' : 'Issue Final Ruling'}
              <Scale size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
