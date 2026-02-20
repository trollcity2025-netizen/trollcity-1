import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function ManualPurchaseModal({ pkg, provider, onClose, profile }) {
  const [payerId, setPayerId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!payerId) {
      toast.error('Please enter your payer ID');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manual-coin-order', {
        body: {
          action: 'create',
          package: pkg,
          purchase_type: `manual_${provider.id}`,
          provider_id: provider.provider_id, // e.g. $trollcity95
          payer_id: payerId,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to create order');

      toast.success('Manual order created. Please follow the instructions to complete your purchase.');
      onClose();
    } catch (e) {
      toast.error(e.message || 'Failed to create manual order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-zinc-900 border border-purple-500/40 rounded-xl p-8 shadow-2xl max-w-sm w-full text-center animate-fadeIn">
        <h2 className="text-xl font-bold text-white mb-4">Manual Purchase: {provider.name}</h2>
        <p className="mb-4 text-gray-300">To complete your purchase, please send ${pkg.price} to <span className="font-bold text-yellow-400">{provider.provider_id}</span> on {provider.name}.</p>
        <p className="mb-4 text-gray-300">Please include the following note in your payment: <span className="font-bold text-yellow-400">{`${profile.username.slice(0,6).toUpperCase()}-${pkg.coins}`}</span></p>
        <p className="mb-6 text-gray-300">After you have sent the payment, please enter your {provider.name} username or tag below to confirm your order.</p>
        <input
          type="text"
          placeholder={`Your ${provider.name} username/tag`}
          value={payerId}
          onChange={(e) => setPayerId(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm focus:border-purple-400 outline-none mb-4"
        />
        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm font-semibold"
          >
            {loading ? 'Submitting...' : 'Submit Order'}
          </button>
        </div>
      </div>
    </div>
  );
}