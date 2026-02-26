
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Coins, Gift, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { useCoins } from '@/lib/hooks/useCoins';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface VotingPanelProps {
  performerName: string;
  initialCoinBalance: number;
  isJudge: boolean;
  auditionId: string;
  onGoldenBuzzer: () => void;
}

const VotingPanel: React.FC<VotingPanelProps> = ({ performerName, initialCoinBalance, isJudge, auditionId, onGoldenBuzzer }) => {
  const { profile } = useAuthStore();
  const { spendCoins } = useCoins();
  const [coinBalance, setCoinBalance] = useState(initialCoinBalance);

  useEffect(() => {
    const fetchInitialVotes = async () => {
      const { data, error } = await supabase
        .from('mai_talent_votes')
        .select('amount')
        .eq('audition_id', auditionId);

      if (error) {
        console.error('Error fetching initial votes:', error);
      } else {
        const totalVotes = data.reduce((acc, vote) => acc + vote.amount, 0);
        setCoinBalance(totalVotes);
      }
    };

    fetchInitialVotes();

    const subscription = supabase
      .channel(`mai_talent_votes:${auditionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mai_talent_votes', filter: `audition_id=eq.${auditionId}` }, (payload) => {
        setCoinBalance((prev) => prev + payload.new.amount);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [auditionId]);

  const handleVote = async (amount: number) => {
    if (!profile) {
      toast.error('Please login to vote');
      return;
    }

    try {
      const success = await spendCoins({
        senderId: profile.id,
        amount,
        source: 'mai_talent_vote',
        item: auditionId,
      });

      if (!success) return;

      const { error } = await supabase.from('mai_talent_votes').insert({
        audition_id: auditionId,
        voter_id: profile.id,
        amount,
      });

      if (error) throw error;

      toast.success(`Voted ${amount} coins!`);
    } catch (err) {
      console.error('Error voting:', err);
      toast.error('Failed to record vote');
    }
  };

  return (
    <div className="absolute bottom-4 left-4 right-4 bg-black/50 backdrop-blur-sm p-4 rounded-lg text-white">
      {/* Performer Info */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-bold text-lg">{performerName}</p>
          <div className="flex items-center gap-2 text-yellow-400">
            <Coins size={16} />
            <p className="font-bold">{coinBalance.toLocaleString()}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button className="bg-blue-500 hover:bg-blue-600" onClick={() => handleVote(100)}><Gift size={16} className="mr-2" /> Gift</Button>
          <Button className="bg-green-500 hover:bg-green-600" onClick={() => handleVote(10)}><Coins size={16} className="mr-2" /> Vote</Button>
        </div>
      </div>

      {/* Judge Controls */}
      {isJudge && (
        <div className="border-t border-gold-700/50 pt-4 flex justify-between items-center">
          <div className="flex gap-2">
            <Button className="bg-red-600 hover:bg-red-700"><ThumbsDown size={16} /> NO</Button>
            <Button className="bg-green-600 hover:bg-green-700"><ThumbsUp size={16} /> YES</Button>
          </div>
          <Button className="bg-gold-500 hover:bg-gold-600 text-black font-bold animate-pulse" onClick={onGoldenBuzzer}>Golden Buzzer</Button>
        </div>
      )}
    </div>
  );
};

export default VotingPanel;
