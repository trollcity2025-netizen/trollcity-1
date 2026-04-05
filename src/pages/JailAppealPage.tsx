import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Gavel, AlertTriangle, CheckCircle, Clock, DollarSign, FileText, X } from 'lucide-react';

interface Appeal {
  id: string;
  appeal_text: string;
  fee_paid: number;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
}

const APPEAL_FEE = 500;

export default function JailAppealPage() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [appealText, setAppealText] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingAppeal, setExistingAppeal] = useState<Appeal | null>(null);
  const [loadingAppeal, setLoadingAppeal] = useState(true);

  const isBackgroundJailed = profile?.is_background_jailed;
  const hasActiveJail = searchParams.get('active') === 'true';

  useEffect(() => {
    if (user) {
      fetchExistingAppeal();
    }
  }, [user]);

  const fetchExistingAppeal = async () => {
    try {
      const { data, error } = await supabase
        .from('jail_appeals')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setExistingAppeal(data);
    } catch (err) {
      console.error('Error fetching appeal:', err);
    } finally {
      setLoadingAppeal(false);
    }
  };

  const handleSubmitAppeal = async () => {
    if (!user || !appealText.trim()) return toast.error('Please provide appeal text');
    
    if (!confirm(`Submit appeal for ${APPEAL_FEE} Troll Coins? This fee is non-refundable.`)) return;

    // Check balance
    if ((profile?.troll_coins || 0) < APPEAL_FEE) {
      toast.error(`Insufficient Troll Coins. You need ${APPEAL_FEE} TC to file an appeal.`);
      return;
    }

    try {
      setLoading(true);

      // Deduct appeal fee
      await supabase
        .from('user_profiles')
        .update({ troll_coins: (profile?.troll_coins || 0) - APPEAL_FEE })
        .eq('id', user.id);

      // Get active jail record
      const { data: jailData } = await supabase
        .from('jail')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Create appeal
      const { error } = await supabase
        .from('jail_appeals')
        .insert({
          jail_id: jailData?.id,
          user_id: user.id,
          appeal_text: appealText,
          fee_paid: APPEAL_FEE,
          status: 'pending'
        });

      if (error) throw error;

      // Update background jail status
      await supabase
        .from('user_profiles')
        .update({ background_jail_appealed: true })
        .eq('id', user.id);

      toast.success('Appeal submitted! You will be notified when reviewed.');
      fetchExistingAppeal();
      setAppealText('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit appeal');
    } finally {
      setLoading(false);
    }
  };

  if (loadingAppeal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-red-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  // Show message if not jailed
  if (!isBackgroundJailed && !hasActiveJail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
        <div className="max-w-md mx-auto text-center py-20">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">No Active Appeal</h1>
          <p className="text-gray-400">You are not currently jailed or have a background jail record.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-6 px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center border border-red-500/30">
              <Gavel className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Jail Appeal</h1>
              <p className="text-gray-400 text-sm">
                {hasActiveJail ? 'Appeal your active jail sentence' : 'Appeal your background jail record'}
              </p>
            </div>
          </div>
        </div>

        {/* Current Status */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6">
          <h2 className="font-semibold mb-2">Your Status</h2>
          <div className="flex items-center gap-2">
            {hasActiveJailed ? (
              <span className="text-red-400 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Currently Incarcerated
              </span>
            ) : isBackgroundJailed ? (
              <span className="text-yellow-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Background Jail (Limited Access)
              </span>
            ) : null}
          </div>
        </div>

        {/* Existing Appeal */}
        {existingAppeal && (
          <div className={`bg-gray-800/50 border rounded-xl p-4 mb-6 ${
            existingAppeal.status === 'pending' ? 'border-yellow-500/30' :
            existingAppeal.status === 'approved' ? 'border-green-500/30' :
            existingAppeal.status === 'rejected' ? 'border-red-500/30' : 'border-gray-700'
          }`}>
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              {existingAppeal.status === 'pending' && <Clock className="w-5 h-5 text-yellow-400" />}
              {existingAppeal.status === 'approved' && <CheckCircle className="w-5 h-5 text-green-400" />}
              {existingAppeal.status === 'rejected' && <X className="w-5 h-5 text-red-400" />}
              Your Appeal - {existingAppeal.status.toUpperCase()}
            </h2>
            
            <div className="space-y-2 text-sm">
              <p className="text-gray-400">Filed: {new Date(existingAppeal.created_at).toLocaleDateString()}</p>
              <p className="text-gray-400">Fee Paid: {existingAppeal.fee_paid} TC</p>
              
              {existingAppeal.reviewed_at && (
                <>
                  <p className="text-gray-400">Reviewed: {new Date(existingAppeal.reviewed_at).toLocaleDateString()}</p>
                  {existingAppeal.review_notes && (
                    <div className="bg-gray-900/50 p-3 rounded mt-2">
                      <p className="text-gray-300">{existingAppeal.review_notes}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Appeal Form */}
        {!existingAppeal || existingAppeal.status !== 'pending' ? (
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-gray-400" />
              <h2 className="font-semibold">Submit Appeal</h2>
            </div>
            
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 text-yellow-400 mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="font-semibold">Appeal Fee: {APPEAL_FEE} Troll Coins</span>
              </div>
              <p className="text-sm text-gray-400">
                Your current balance: {profile?.troll_coins || 0} TC
              </p>
              <p className="text-xs text-gray-500 mt-2">
                This fee goes to the Troll City public pool. Appeal is non-refundable regardless of outcome.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Why should your sentence be reduced or overturned?
                </label>
                <textarea
                  value={appealText}
                  onChange={(e) => setAppealText(e.target.value)}
                  placeholder="Provide compelling reasons for your appeal..."
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 h-32 resize-none"
                />
              </div>

              <button
                onClick={handleSubmitAppeal}
                disabled={loading || !appealText.trim() || (profile?.troll_coins || 0) < APPEAL_FEE}
                className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Gavel className="w-5 h-5" />
                {loading ? 'Submitting...' : `Submit Appeal (${APPEAL_FEE} TC)`}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 text-center">
            <Clock className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Appeal Pending</h2>
            <p className="text-gray-400">Your appeal is being reviewed. You'll be notified once a decision is made.</p>
          </div>
        )}

        {/* Guidelines */}
        <div className="mt-6 bg-gray-800/30 border border-gray-700 rounded-xl p-4">
          <h3 className="font-semibold mb-3 text-gray-300">Appeal Guidelines</h3>
          <ul className="text-sm text-gray-400 space-y-2">
            <li>• Be specific about why your sentence should be reduced</li>
            <li>• Include any mitigating circumstances</li>
            <li>• Provide evidence if available</li>
            <li>• Appeals are reviewed by admin/lead officers</li>
            <li>• Fee is non-refundable regardless of outcome</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

import { Lock } from 'lucide-react';

const hasActiveJailed = false; // Helper for rendering