import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import MuxViewer from '../broadcast/MuxViewer';
import { trollCityTheme } from '../../styles/trollCityTheme';

interface FeaturedStream {
  id: string;
  mux_playback_id: string;
  title: string;
  user_profiles: {
    username: string;
    avatar_url: string;
  };
}

export default function FeaturedStreamPreview() {
  const [stream, setStream] = useState<FeaturedStream | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const navigate = useNavigate();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchFeaturedStream = async () => {
      const { data, error } = await supabase
        .from('streams')
        .select('id, mux_playback_id, title, user_profiles(username, avatar_url)')
        .eq('is_live', true)
        .not('mux_playback_id', 'is', null)
        .order('current_viewers', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        console.warn('No featured stream available for guest preview.', error);
      } else {
        setStream(data as FeaturedStream);
      }
    };

    fetchFeaturedStream();
  }, []);

  useEffect(() => {
    if (stream) {
      timerRef.current = setTimeout(() => {
        setShowPreview(false);
      }, 60000); // 1 minute timer
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [stream]);

  const handleInteraction = () => {
    navigate('/auth?reason=preview_interaction');
  };

  if (!stream) {
    return null; // Don't render anything if there are no live streams to preview
  }

  return (
    <section className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-3xl p-5 md:p-6 mb-6`}>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Featured Live Stream</h2>
        <div className="aspect-video bg-black rounded-2xl overflow-hidden relative">
            {showPreview ? (
                <>
                    <MuxViewer playbackId={stream.mux_playback_id} />
                    <div 
                        className="absolute inset-0 cursor-pointer" 
                        onClick={handleInteraction}
                        title="Sign up to interact"
                    />
                </>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-900/50 to-black p-4">
                    <h3 className="text-2xl font-bold text-white mb-2">Preview Ended</h3>
                    <p className={`${trollCityTheme.text.muted} mb-6 text-center`}>Sign up or log in to continue watching and join the chat.</p>
                    <button 
                        onClick={() => navigate('/auth')}
                        className="px-6 py-3 rounded-xl text-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-600 hover:opacity-90 transition-opacity"
                    >
                        Continue to Troll City
                    </button>
                </div>
            )}
        </div>
    </section>
  );
}
