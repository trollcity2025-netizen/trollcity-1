import { useEffect, useState } from 'react';
import { usePresidentSystem } from '@/hooks/usePresidentSystem';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Crown, Radio } from 'lucide-react';

interface Stream {
  id: string;
  user_id: string;
  title: string;
  thumbnail_url?: string;
  viewer_count: number;
}

export default function PresidentInaugurationCard() {
  const { currentPresident } = usePresidentSystem();
  const [presidentStream, setPresidentStream] = useState<Stream | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentPresident) return;

    const fetchStream = async () => {
      const { data } = await supabase
        .from('streams')
        .select('*')
        .eq('user_id', currentPresident.user_id)
        .eq('is_live', true)
        .maybeSingle();
      
      if (data) {
        setPresidentStream(data);
      } else {
        setPresidentStream(null);
      }
    };

    fetchStream();

    // Subscribe to changes
    const channel = supabase
      .channel('president-stream')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streams', filter: `user_id=eq.${currentPresident.user_id}` }, 
        () => fetchStream()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentPresident]);

  if (!currentPresident || !presidentStream) return null;

  return (
    <div className="w-full mb-12 animate-fade-in-up">
      <div className="relative w-full max-w-4xl mx-auto bg-slate-900 rounded-2xl overflow-hidden border-2 border-amber-500 shadow-[0_0_50px_rgba(245,158,11,0.3)]">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-6 z-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 rounded-lg animate-pulse">
              <Radio className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-wider drop-shadow-lg">
                Presidential Inauguration
              </h2>
              <p className="text-amber-400 font-bold flex items-center gap-2">
                <Crown className="w-4 h-4" />
                President {currentPresident.username} is Live
              </p>
            </div>
          </div>
          <div className="bg-red-600 px-3 py-1 rounded-full text-white text-xs font-bold uppercase tracking-widest animate-pulse">
            Live Broadcast
          </div>
        </div>

        {/* Thumbnail / Click Area */}
        <div 
          className="relative aspect-video group cursor-pointer"
          onClick={() => navigate(`/watch/${presidentStream.id}`)}
        >
          {presidentStream.thumbnail_url ? (
            <img 
              src={presidentStream.thumbnail_url} 
              alt="Inauguration Stream" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
          ) : (
            <div className="w-full h-full bg-slate-800 flex items-center justify-center">
              <Crown className="w-24 h-24 text-amber-500/20" />
            </div>
          )}
          
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
          
          {/* Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-20 h-20 bg-amber-500 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
              <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[24px] border-l-black border-b-[12px] border-b-transparent ml-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
