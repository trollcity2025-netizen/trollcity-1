import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Check, X, Shield, Coins, Trash2 } from 'lucide-react';

const DELETE_REASONS = [
  { value: 'privacy', label: 'Privacy concerns' },
  { value: ' harassment', label: 'Harassment or bullying' },
  { value: 'content', label: 'Disagree with platform policies' },
  { value: 'never_use', label: 'Never use the platform' },
  { value: 'other_platforms', label: 'Prefer other platforms' },
  { value: 'technical', label: 'Technical issues' },
  { value: 'cost', label: 'Too expensive / want refunds' },
  { value: 'other', label: 'Other' },
];

export default function DeleteAccount() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [confirmPermanent, setConfirmPermanent] = useState(false);
  const [confirmNoRefund, setConfirmNoRefund] = useState(false);
  const [confirmUsername, setConfirmUsername] = useState('');

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleDelete = async () => {
    if (!confirmPermanent || !confirmNoRefund || confirmUsername !== profile?.username) {
      toast.error('Please confirm all acknowledgements');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user-account', {
        body: {
          reason: reason === 'other' ? reasonDetail : reason,
          confirmPermanent: true,
          confirmNoRefund: true,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Account deleted. All your data has been removed.');
      
      // Sign out and redirect
      await supabase.auth.signOut();
      navigate('/auth?deleted=true');
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(err?.message || 'Failed to delete account');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-950 via-red-900 to-black text-white">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-red-400" />
            <h1 className="text-xl font-bold">Delete Account</h1>
          </div>
        </div>

        {/* Step 1: Why deleting */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-bold text-lg">We're sorry to see you go</h2>
                  <p className="text-red-200/70 text-sm mt-1">
                    Before you leave, please tell us why you're deleting your account.
                    This helps us improve Troll City.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Why are you deleting your account?</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white"
              >
                <option value="">Select a reason...</option>
                {DELETE_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {reason === 'other' && (
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Please tell us more (optional)</label>
                <textarea
                  value={reasonDetail}
                  onChange={(e) => setReasonDetail(e.target.value)}
                  placeholder="Tell us what we could do better..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white h-24 resize-none"
                />
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={!reason}
              className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 disabled:cursor-not-allowed rounded-lg font-medium"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Warnings */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <h2 className="font-bold text-lg mb-4">Important Warnings</h2>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">This cannot be undone</p>
                    <p className="text-red-200/70 text-sm">
                      Once you delete your account, there is NO way to recover it. All your data, progress, coins, items, badges, and history will be PERMANENTLY deleted.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Coins className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">No refunds</p>
                    <p className="text-red-200/70 text-sm">
                      All your coins, purchases, and virtual items are gone. We do NOT offer refunds for deleted accounts.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">You'll need to start over</p>
                    <p className="text-red-200/70 text-sm">
                      If you come back, you'll need to create a new account from scratch.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Confirmations */}
            <div className="space-y-3">
              <label className="text-sm text-gray-400">Please confirm:</label>
              
              <label className="flex items-start gap-3 p-3 bg-white/5 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmPermanent}
                  onChange={(e) => setConfirmPermanent(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-red-500"
                />
                <span className="text-sm">
                  I understand this is PERMANENT and cannot be undone
                </span>
              </label>

              <label className="flex items-start gap-3 p-3 bg-white/5 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmNoRefund}
                  onChange={(e) => setConfirmNoRefund(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-red-500"
                />
                <span className="text-sm">
                  I understand I will NOT receive any refunds for coins or purchases
                </span>
              </label>

              <div className="space-y-2 pt-2">
                <label className="text-sm text-gray-400">
                  Type <span className="text-red-400 font-bold">{profile?.username}</span> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmUsername}
                  onChange={(e) => setConfirmUsername(e.target.value)}
                  placeholder="Type your username"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white"
                />
              </div>
            </div>

            <button
              onClick={handleDelete}
              disabled={loading || !confirmPermanent || !confirmNoRefund || confirmUsername !== profile?.username}
              className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 disabled:cursor-not-allowed rounded-lg font-medium flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Deleting account...
                </>
              ) : (
                <>
                  <Trash2 className="w-5 h-5" />
                  Permanently Delete My Account
                </>
              )}
            </button>

            <button
              onClick={() => setStep(1)}
              className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-lg font-medium"
            >
              Go Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}