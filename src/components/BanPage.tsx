import React from 'react'
import { X, Ban, AlertTriangle } from 'lucide-react'

interface BanPageProps {
  onClose: () => void
}

export default function BanPage({ onClose }: BanPageProps) {
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center p-6 z-50">
      <div className="bg-[#1A0000] border-2 border-red-600 rounded-xl p-8 w-full max-w-2xl shadow-[0_0_60px_rgba(255,0,0,0.8)] relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Ban className="w-24 h-24 text-red-500 animate-pulse" />
              <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-red-400 mb-4">Account Banned</h1>
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 mb-6">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-300 text-lg font-semibold mb-2">Your account has been permanently banned</p>
            <p className="text-gray-300 text-sm">
              You have violated Troll City's community guidelines. This action cannot be reversed.
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="bg-[#0A0000] border border-red-500/30 rounded-lg p-4">
            <h3 className="text-red-400 font-semibold mb-2">Ban Details</h3>
            <div className="text-sm text-gray-300 space-y-1">
              <p><strong>Reason:</strong> Multiple violations of community guidelines</p>
              <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
              <p><strong>Status:</strong> Permanent</p>
            </div>
          </div>

          <div className="bg-[#0A0000] border border-red-500/30 rounded-lg p-4">
            <h3 className="text-red-400 font-semibold mb-2">What This Means</h3>
            <ul className="text-sm text-gray-300 list-disc list-inside space-y-1">
              <li>You cannot access Troll City</li>
              <li>All your data and progress are locked</li>
              <li>You cannot create a new account</li>
              <li>This ban is permanent and cannot be appealed</li>
            </ul>
          </div>

          <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-4">
            <h3 className="text-yellow-400 font-semibold mb-2">Restore Your Account</h3>
            <p className="text-sm text-gray-300 mb-3">
              You can restore your account by paying <strong className="text-yellow-400">2000 troll_coins</strong>.
              Your account will be reset to level 0 with 0 coins.
            </p>
            <button 
              onClick={async () => {
                try {
                  const { data, error } = await import('../lib/supabase').then(m => m.supabase.rpc('restore_banned_account'));
                  if (error) throw error;
                  if (data && data.success) {
                    window.location.reload();
                  } else {
                    alert(data?.message || 'Failed to restore account');
                  }
                } catch (e) {
                  console.error(e);
                  alert('Error restoring account');
                }
              }}
              className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-semibold transition-colors"
            >
              Pay 2000 Coins to Restore Account
            </button>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

