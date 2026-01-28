
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { BookOpen, Clock, Users, Gift, Shield, AlertTriangle, Calendar, Info, Loader2 } from 'lucide-react';
import DailyPassage from '@/components/church/DailyPassage';
import PrayerFeed from '@/components/church/PrayerFeed';
import { useCoins } from '@/lib/hooks/useCoins';
import { toast } from 'sonner';

export default function ChurchPage() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const { spendCoins, balances } = useCoins();
  const [isOpen, setIsOpen] = useState(false);
  const [isSunday, setIsSunday] = useState(false);
  const [timeUntilOpen, setTimeUntilOpen] = useState('');
  const [loading, setLoading] = useState(true);
  const [pastorId, setPastorId] = useState<string | null>(null);

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  useEffect(() => {
    checkTime();
    const interval = setInterval(checkTime, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isSunday && isOpen) {
       fetchActivePastor();
    }
  }, [isSunday, isOpen]);

  const fetchActivePastor = async () => {
      // 1. Check sermon notes for today
      const today = new Date().toISOString().split('T')[0];
      const { data: notes } = await supabase.from('church_sermon_notes').select('pastor_id').eq('date', today).maybeSingle();
      
      if (notes) {
          setPastorId(notes.pastor_id);
          return;
      }
      
      // 2. Fallback: Any pastor
      const { data: pastor } = await supabase.from('user_profiles').select('id').eq('is_pastor', true).limit(1).maybeSingle();
      if (pastor) {
          setPastorId(pastor.id);
          return;
      }

      // 3. Fallback: Any admin
      const { data: admin } = await supabase.from('user_profiles').select('id').eq('role', 'admin').limit(1).maybeSingle();
      if (admin) setPastorId(admin.id);
  };

  const handleGift = async () => {
      if (!pastorId || !profile) return;
      
      const amount = 50; // Fixed amount or prompt? Let's use fixed 50 for simplicity
      if (balances.troll_coins < amount) {
          toast.error(`Not enough coins! Need ${amount}.`);
          return;
      }

      const success = await spendCoins({
          senderId: profile.id,
          receiverId: pastorId,
          amount: amount,
          source: 'church_gift',
          item: 'Sunday Service Offering'
      });

      if (success) {
          toast.success(`Offering sent! (+${amount} coins)`);
      }
  };


  const checkTime = () => {
    const now = new Date();
    const day = now.getDay(); // 0 is Sunday
    const hours = now.getHours();
    
    // Church is open 1 PM (13:00) to 3 PM (15:00)
    const isOpenNow = hours >= 13 && hours < 15;
    
    setIsOpen(isOpenNow);
    setIsSunday(day === 0);
    
    if (!isOpenNow) {
       // Calculate time until next opening
       let nextOpen = new Date();
       nextOpen.setHours(13, 0, 0, 0);
       
       if (hours >= 15) {
          // Already closed for today, open tomorrow
          nextOpen.setDate(nextOpen.getDate() + 1);
       }
       
       const diff = nextOpen.getTime() - now.getTime();
       const daysLeft = Math.floor(diff / (1000 * 60 * 60 * 24));
       const hoursLeft = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
       const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
       
       let timeString = '';
       if (daysLeft > 0) timeString += `${daysLeft}d `;
       timeString += `${hoursLeft}h ${minutesLeft.toString().padStart(2, '0')}m`;
       
       setTimeUntilOpen(timeString);
    }
    setLoading(false);
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 pb-24">
      {/* Header */}
      <div className="max-w-4xl mx-auto space-y-8">
         <header className="text-center space-y-4">
            <div className="inline-flex items-center justify-center p-3 bg-purple-900/30 rounded-full mb-4 ring-1 ring-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.4)]">
               <BookOpen size={32} className="text-purple-400" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-purple-200 via-white to-purple-200 bg-clip-text text-transparent">
               Troll Church
            </h1>
            <p className="text-lg text-purple-200/60 max-w-2xl mx-auto">
               A sanctuary for reflection, community, and daily inspiration.
            </p>
            
            {/* Status Banner */}
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold border ${
               isOpen 
                 ? isSunday 
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 animate-pulse'
                    : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
                 : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}>
               {isOpen ? (
                  <>
                     <span className="relative flex h-2 w-2">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
                     </span>
                     SUNDAY SERVICE LIVE
                  </>
               ) : (
                  <>
                     <Clock size={14} className="text-purple-400" />
                     <span className="opacity-90">CLOSED • OPENS IN {timeUntilOpen}</span>
                  </>
               )}
            </div>
         </header>

         {/* Sunday Service Special Banner */}
         {isSunday && isOpen && (
            <div className="bg-gradient-to-r from-amber-900/40 via-purple-900/40 to-amber-900/40 border border-amber-500/30 p-6 rounded-2xl text-center relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50"></div>
               <h2 className="text-2xl font-bold text-amber-100 mb-2 flex items-center justify-center gap-2">
                  <Gift className="text-amber-400" />
                  Sunday Service is Live!
               </h2>
               <p className="text-amber-200/80 mb-4">
                  Join the pastor and the community for our weekly gathering. Gifts are enabled!
               </p>
               {/* Gift Button logic could go here */}
            </div>
         )}

         {/* Daily Passage */}
         <section>
            <DailyPassage />
         </section>

         {/* Content Grid */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Feed */}
            <div className="lg:col-span-2">
               <PrayerFeed isOpen={isOpen} />
            </div>

            {/* Sidebar Info */}
            <div className="space-y-6">
               <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl">
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                     <Info size={18} className="text-blue-400" />
                     Church Info
                  </h3>
                  <ul className="space-y-3 text-sm text-gray-400">
                     <li className="flex items-start gap-3">
                        <Clock size={16} className="mt-0.5 shrink-0" />
                        <span>Open Sundays: 1 PM – 3 PM</span>
                     </li>
                     <li className="flex items-start gap-3">
                        <Calendar size={16} className="mt-0.5 shrink-0" />
                        <span>Sunday Service: Special broadcast & gifting enabled.</span>
                     </li>
                     <li className="flex items-start gap-3">
                        <Shield size={16} className="mt-0.5 shrink-0" />
                        <span>Moderated by Pastors & Officers. Please be respectful.</span>
                     </li>
                  </ul>
               </div>

               {/* Badge Promo */}
               <div className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border border-purple-500/20 p-5 rounded-2xl text-center">
                  <div className="w-12 h-12 bg-purple-900/50 rounded-full flex items-center justify-center mx-auto mb-3 border border-purple-500/30">
                     <BookOpen className="text-purple-300" size={20} />
                  </div>
                  <h3 className="font-bold text-white mb-1">Church Attendee</h3>
                  <p className="text-xs text-gray-400 mb-3">Visit or participate to earn this badge.</p>
               </div>
               
               {/* Pastor Dashboard Link (only for pastors) */}
               {(profile?.is_pastor || profile?.role === 'admin' || (profile as any)?.is_admin) && (
                  <div className="bg-zinc-800/50 border border-zinc-700 p-4 rounded-xl">
                     <h3 className="font-bold text-white mb-2">Pastor Controls</h3>
                     <button 
                        onClick={() => navigate('/church/pastor')}
                        className="w-full py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-medium transition-colors"
                     >
                        Open Dashboard
                     </button>
                  </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}
