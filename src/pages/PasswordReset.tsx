import React, { useEffect, useState } from 'react';
import { resetPasswordViaManager } from '@/services/passwordManager';
import { Mail, User as UserIcon, KeyRound, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';

export default function PasswordReset() {
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get('email') || '';
  const [email, setEmail] = useState(initialEmail);
  const [fullName, setFullName] = useState('');
  const [pin, setPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName || pin.length !== 6 || newPassword.length < 8) {
      toast.error('Fill all fields correctly');
      return;
    }
    setLoading(true);
    const { error } = await resetPasswordViaManager({
      email,
      full_name: fullName,
      pin,
      new_password: newPassword,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message || 'Reset failed');
    } else {
      toast.success('Password updated. You can now sign in.');
      setEmail('');
      setFullName('');
      setPin('');
      setNewPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-black/40 border border-white/10 rounded-2xl p-6 space-y-4">
        <h1 className="text-2xl font-bold">Reset Password</h1>
        <div className="text-sm text-gray-400 space-y-1">
          <p>To reset your password, enter:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Your registered <span className="text-gray-300 font-medium">full name</span> (as set in Profile).</li>
            <li>Your <span className="text-gray-300 font-medium">account email address</span>.</li>
            <li>Your <span className="text-gray-300 font-medium">6-digit PIN</span> (set in Profile Settings).</li>
          </ul>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300 flex items-center gap-2"><Mail className="w-4 h-4"/> Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300 flex items-center gap-2"><UserIcon className="w-4 h-4"/> Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300 flex items-center gap-2"><KeyRound className="w-4 h-4"/> 6-digit PIN</label>
          <input
            inputMode="numeric"
            pattern="\\d*"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white tracking-widest"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300 flex items-center gap-2"><Lock className="w-4 h-4"/> New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white"
            required
          />
          <p className="text-xs text-gray-500">Minimum 8 characters.</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold disabled:opacity-50"
        >
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>

        <p className="text-xs text-gray-500">Tip: Set your PIN in Profile Settings.</p>
      </form>
    </div>
  );
}
