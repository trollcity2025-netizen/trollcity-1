import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import giftCatalog from '@/lib/giftCatalog';

const GiftAnnouncements = ({ showId }) => {
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    if (!showId) return;

    const subscription = supabase
      .channel(`mai_talent_votes:${showId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mai_talent_votes', filter: `show_id=eq.${showId}` }, (payload) => {
        const gift = giftCatalog.find(g => g.coins === payload.new.amount);
        if (gift) {
          setAnnouncements(prev => [...prev, { ...payload.new, giftName: gift.name, giftIcon: gift.icon }]);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [showId]);

  return (
    <div className="absolute bottom-4 left-4 z-50">
      {announcements.map((announcement, index) => (
        <div key={index} className="bg-slate-900/80 backdrop-blur-md border border-white/10 p-2 rounded-lg mb-2 flex items-center gap-2">
          <span className="text-2xl">{announcement.giftIcon}</span>
          <div>
            <p className="text-white text-sm">A new gift has been sent!</p>
            <p className="text-yellow-400 text-xs">{announcement.giftName}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GiftAnnouncements;
