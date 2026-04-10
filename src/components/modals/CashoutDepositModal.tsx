import React, { useState } from 'react';
import { useCoins } from '@/lib/hooks/useCoins';
import { toast } from 'sonner';
import { X } from 'lucide-react';

interface CashoutDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CashoutDepositModal({ isOpen, onClose }: CashoutDepositModalProps) {
  const { depositToCashout, loading } = useCoins();
  const [amount, setAmount] = useState('');

  const handleDeposit = async () => {
    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    const result = await depositToCashout(numAmount);
    if (result.success) {
      toast.success(`Deposited ${numAmount} coins to cashout!`);
      setAmount('');
      onClose();
    } else {
      toast.error(result.error || 'Failed to deposit');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md mx-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-xl font-bold text-white mb-4">Deposit to Cashout</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
            />
          </div>
          
          <button
            onClick={handleDeposit}
            disabled={loading || !amount}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 text-white py-2 rounded-lg font-medium"
          >
            {loading ? 'Depositing...' : 'Deposit'}
          </button>
        </div>
      </div>
    </div>
  );
}