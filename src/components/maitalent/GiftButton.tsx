import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import giftCatalog from '@/lib/giftCatalog';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const GiftButton = ({ performer, showId }) => {
  const { profile } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  const handleGift = async (coins: number) => {
    if (!profile) {
      toast.error('Please login to send a gift');
      return;
    }

    // TODO: Implement coin spending logic

    const { error } = await supabase.from('mai_talent_votes').insert({
      audition_id: performer.id,
      voter_id: profile.id,
      amount: coins,
      show_id: showId,
    });

    if (error) {
      toast.error('Failed to send gift');
    } else {
      toast.success('Gift sent!');
      setIsOpen(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button size="sm">Vote / Gift</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-slate-800 border-slate-700">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none text-white">Send a Gift</h4>
            <p className="text-sm text-slate-400">
              Support your favorite performer and help them win!
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {giftCatalog.map((gift) => (
              <button
                key={gift.name}
                onClick={() => handleGift(gift.coins)}
                className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <span className="text-2xl">{gift.icon}</span>
                <span className="text-xs text-yellow-400">{gift.coins}</span>
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default GiftButton;
