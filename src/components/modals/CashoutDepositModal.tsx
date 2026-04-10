import React, { useState } from 'react';
import { useCoins } from '@/lib/hooks/useCoins';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

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

    const success = await depositToCashout(numAmount);
    if (success) {
      setAmount('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deposit to Cashout Escrow</DialogTitle>
          <DialogDescription>
            Deposit gifted coins into non-reversible cashout escrow. Once deposited, coins cannot be withdrawn or spent.
            <br /><br />
            <span className="text-emerald-400">Only coins that other users purchased and gifted to you are eligible.</span>
            <br /><br />
            All deposited coins are automatically reserved for payouts every Thursday at 11:59pm MST.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm text-gray-400">Amount to deposit</label>
            <Input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter coin amount"
              className="mt-1"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleDeposit} loading={loading}>
              Deposit Coins
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
