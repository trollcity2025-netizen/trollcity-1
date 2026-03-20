import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Home, Trophy, Users, Heart, Gift, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';

export default function StreamSummary() {
  const navigate = useNavigate();
  const location = useLocation();
  const { streamId } = useParams();
  const { user } = useAuthStore();
  const [stats, setStats] = useState(location.state || null);
  const [loading, setLoading] = useState(!location.state);
  const [myGifts, setMyGifts] = useState(0);
  const [broadcasterGiftTotal, setBroadcasterGiftTotal] = useState(0);
  const [guestGiftTotal, setGuestGiftTotal] = useState(0);

   useEffect(() => {
     // If we have stats from location.state (passed from BroadcastPage), use them
     if (location.state) {
       setStats({
         title: location.state.title || 'Broadcast Ended',
         viewers: location.state.viewers || 0,
         likes: location.state.likes || 0
       });
       setMyGifts(location.state.myGifts || 0);
       setBroadcasterGiftTotal(location.state.broadcasterGiftTotal || 0);
       setGuestGiftTotal(location.state.guestGiftTotal || 0);
       setLoading(false);
       return;
     }
 
     if (!streamId) {
       setLoading(false);
       return;
     }
 
     const fetchStreamStats = async () => {
       try {
         // First get stream info and broadcaster ID
         const { data: stream, error } = await supabase
           .from('streams')
           .select('title, viewer_count, current_viewers, total_likes, user_id')
           .eq('id', streamId)
           .single();
 
         if (error) throw error;
 
         // Fetch broadcaster's received gifts (gifts sent to broadcaster)
         let broadcasterGifts = 0;
         if (stream?.user_id) {
           // Try gift_ledger first
           const { data: broadcasterGiftData } = await supabase
             .from('gift_ledger')
             .select('amount')
             .eq('stream_id', streamId)
             .eq('receiver_id', stream.user_id)
             .eq('status', 'processed');
           
           if (broadcasterGiftData && broadcasterGiftData.length > 0) {
             broadcasterGifts = broadcasterGiftData.reduce((sum, g) => sum + (g.amount || 0), 0);
           } else {
             // Fallback to gifts table
             const { data: fallbackBroadcasterGifts } = await supabase
               .from('gifts')
               .select('coins_spent')
               .eq('stream_id', streamId)
               .eq('receiver_id', stream.user_id);
             
             if (fallbackBroadcasterGifts && fallbackBroadcasterGifts.length > 0) {
               broadcasterGifts = fallbackBroadcasterGifts.reduce((sum, g) => sum + (g.coins_spent || 0), 0);
             }
           }
         }
 
         // Fetch guest gifts (gifts sent to guests in seats)
         // First get all guest user_ids from seat sessions
         const { data: seatSessions } = await supabase
           .from('stream_seat_sessions')
           .select('user_id, guest_id')
           .eq('stream_id', streamId)
           .eq('status', 'active');

         let guestGifts = 0;
         if (seatSessions && seatSessions.length > 0) {
           // Get all guest user IDs (both user_id and guest_id columns)
           const guestUserIds = seatSessions
             .filter(s => s.user_id || s.guest_id)
             .map(s => s.user_id || s.guest_id)
             .filter(Boolean);

           if (guestUserIds.length > 0) {
             // Try gift_ledger for guests
             const { data: guestGiftData } = await supabase
               .from('gift_ledger')
               .select('amount')
               .eq('stream_id', streamId)
               .in('receiver_id', guestUserIds)
               .eq('status', 'processed');
             
             if (guestGiftData && guestGiftData.length > 0) {
               guestGifts = guestGiftData.reduce((sum, g) => sum + (g.amount || 0), 0);
             } else {
               // Fallback to gifts table
               const { data: fallbackGuestGifts } = await supabase
                 .from('gifts')
                 .select('coins_spent')
                 .eq('stream_id', streamId)
                 .in('receiver_id', guestUserIds);
               
               if (fallbackGuestGifts && fallbackGuestGifts.length > 0) {
                 guestGifts = fallbackGuestGifts.reduce((sum, g) => sum + (g.coins_spent || 0), 0);
               }
             }
           }
         }
 
         // Fetch user's received gifts (gifts user received on this stream)
         let userGifts = 0;
         if (user?.id) {
           // Try gift_ledger first
           const { data: giftData } = await supabase
             .from('gift_ledger')
             .select('amount')
             .eq('stream_id', streamId)
             .eq('receiver_id', user.id)
             .eq('status', 'processed');
           
           if (giftData && giftData.length > 0) {
             userGifts = giftData.reduce((sum, g) => sum + (g.amount || 0), 0);
           } else {
             // Fallback to gifts table
             const { data: fallbackGifts } = await supabase
               .from('gifts')
               .select('coins_spent')
               .eq('stream_id', streamId)
               .eq('receiver_id', user.id);
             
             if (fallbackGifts && fallbackGifts.length > 0) {
               userGifts = fallbackGifts.reduce((sum, g) => sum + (g.coins_spent || 0), 0);
             }
           }
         }
 
         setStats({
           title: stream.title || 'Stream Ended',
           viewers: stream.current_viewers || stream.viewer_count || 0,
           likes: stream.total_likes || 0
         });
         setMyGifts(userGifts);
         setBroadcasterGiftTotal(broadcasterGifts);
         setGuestGiftTotal(guestGifts);
       } catch (err) {
         console.error('Error fetching stream stats:', err);
         setStats({ title: 'Stream Ended', viewers: 0, likes: 0 });
       } finally {
         setLoading(false);
       }
     };
 
     fetchStreamStats();
   }, [streamId, user?.id, location.state]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
      </div>
    );
  }

  const displayStats = stats || { viewers: 0, likes: 0, title: 'Stream Ended' };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-lg w-full bg-zinc-900 border border-white/10 rounded-2xl p-8 flex flex-col items-center text-center shadow-2xl">
        <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-yellow-500/50">
          <Trophy size={40} className="text-yellow-500" />
        </div>
        
        <h1 className="text-3xl font-bold mb-2">Broadcast Ended</h1>
        <p className="text-zinc-400 mb-8">{displayStats.title || "Great stream! Here's how it went:"}</p>

         <div className="grid grid-cols-3 gap-4 w-full mb-8">
             <div className="bg-black/40 rounded-xl p-4 flex flex-col items-center border border-white/5">
                 <Users className="text-blue-400 mb-2" size={24} />
                 <span className="text-2xl font-bold">{displayStats.viewers || 0}</span>
                 <span className="text-xs text-zinc-500 uppercase tracking-wider">Viewers</span>
             </div>
             <div className="bg-black/40 rounded-xl p-4 flex flex-col items-center border border-white/5">
                 <Heart className="text-pink-500 mb-2" size={24} />
                 <span className="text-2xl font-bold">{displayStats.likes || 0}</span>
                 <span className="text-xs text-zinc-500 uppercase tracking-wider">Likes</span>
             </div>
             <div className="bg-black/40 rounded-xl p-4 flex flex-col items-center border border-white/5">
                 <Gift className="text-yellow-500 mb-2" size={24} />
                 <span className="text-2xl font-bold">{broadcasterGiftTotal || 0}</span>
                 <span className="text-xs text-zinc-500 uppercase tracking-wider">Broadcaster Gifts</span>
             </div>
         </div>
         
         <div className="grid grid-cols-2 gap-4 w-full mb-6">
             <div className="bg-black/40 rounded-xl p-4 flex flex-col items-center border border-white/5">
                 <Gift className="text-yellow-500 mb-2" size={24} />
                 <span className="text-2xl font-bold">{myGifts || 0}</span>
                 <span className="text-xs text-zinc-500 uppercase tracking-wider">My Gifts</span>
             </div>
             <div className="bg-black/40 rounded-xl p-4 flex flex-col items-center border border-white/5">
                 <Users className="text-green-400 mb-2" size={24} />
                 <span className="text-2xl font-bold">{guestGiftTotal || 0}</span>
                 <span className="text-xs text-zinc-500 uppercase tracking-wider">Guest Gifts</span>
             </div>
         </div>

        <button 
            onClick={() => navigate('/')}
            className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition flex items-center justify-center gap-2"
        >
            <Home size={20} />
            Back to Home
        </button>
      </div>
    </div>
  );
}
