import { useState, useEffect } from 'react';
import { Coins, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useTCNNTipping } from '@/hooks/useTCNNTipping';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface TipJournalistButtonProps {
  articleId: string;
  journalistId: string;
  journalistName: string;
  variant?: 'default' | 'outline' | 'ghost' | 'compact';
  className?: string;
}

const quickTipAmounts = [5, 10, 25, 50, 100];

export default function TipJournalistButton({
  articleId,
  journalistId,
  journalistName,
  variant = 'default',
  className = ''
}: TipJournalistButtonProps) {
  const { user } = useAuth();
  const { canTip, checkCanTip } = useTCNNTipping();
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState<string>('10');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canUserTip, setCanUserTip] = useState(true);

  // Check if user can tip when component mounts or user changes
  useEffect(() => {
    if (user && user.id !== journalistId) {
      checkCanTip(user.id, journalistId).then(setCanUserTip);
    } else {
      setCanUserTip(false);
    }
  }, [user, journalistId, checkCanTip]);

  const handleTip = async () => {
    if (!user) {
      toast.error('Please sign in to send tips');
      return;
    }

    const tipAmount = parseInt(amount);
    if (isNaN(tipAmount) || tipAmount < 1) {
      toast.error('Please enter a valid tip amount');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('tip_journalist', {
        p_article_id: articleId,
        p_journalist_id: journalistId,
        p_tipper_id: user.id,
        p_amount: tipAmount,
        p_message: message || null
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Sent ${tipAmount} coins to ${journalistName}!`);
        setIsOpen(false);
        setAmount('10');
        setMessage('');
      } else {
        toast.error(data?.error || 'Failed to send tip');
      }
    } catch (error) {
      console.error('Error sending tip:', error);
      toast.error('Failed to send tip. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCompact = variant === 'compact';

  if (user?.id === journalistId) {
    return null; // Can't tip yourself
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        disabled={!canUserTip}
        variant={variant === 'compact' ? 'ghost' : variant}
        size={isCompact ? 'sm' : 'default'}
        className={`${
          isCompact 
            ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10' 
            : 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black'
        } ${className}`}
        title={!canUserTip ? 'Insufficient coins or not logged in' : `Tip ${journalistName}`}
      >
        <Coins className={`${isCompact ? 'w-4 h-4' : 'w-4 h-4 mr-2'}`} />
        {!isCompact && 'Tip'}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Coins className="w-6 h-6 text-yellow-400" />
              Support {journalistName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            {/* Quick Amount Buttons */}
            <div>
              <label className="text-sm text-gray-400 mb-3 block">Select Amount</label>
              <div className="grid grid-cols-5 gap-2">
                {quickTipAmounts.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setAmount(amt.toString())}
                    className={`py-2.5 rounded-lg font-semibold transition-all ${
                      amount === amt.toString()
                        ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/25'
                        : 'bg-slate-800 hover:bg-slate-700 text-gray-300'
                    }`}
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Amount */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Or Enter Custom Amount</label>
              <div className="relative">
                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-yellow-400" />
                <Input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-10 bg-slate-800 border-white/10 text-white"
                  placeholder="Enter coin amount"
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">
                Message (Optional)
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="bg-slate-800 border-white/10 text-white resize-none"
                placeholder="Say something encouraging..."
                rows={3}
                maxLength={200}
              />
              <p className="text-xs text-gray-500 mt-1 text-right">
                {message.length}/200
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="flex-1 border-white/10 hover:bg-white/5"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleTip}
                disabled={isSubmitting || !amount || parseInt(amount) < 1}
                className="flex-1 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-semibold"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Send Tip
                  </span>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
