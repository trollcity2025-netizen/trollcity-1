/**
 * PromoSlot - Rotating promotional ad slot component
 * Handles fetching, displaying, and rotating multiple ads
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { CityAd, AdPlacement } from '../../types/cityAds';
import { supabase } from '../../lib/supabase';
import PromoAdCard from './PromoAdCard';

interface PromoSlotProps {
  placement: AdPlacement;
  variant?: 'sidebar' | 'featured' | 'horizontal';
}

export default function PromoSlot({ placement, variant = 'sidebar' }: PromoSlotProps) {
  const [ads, setAds] = useState<CityAd[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rotationTimeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch active ads for this placement
  const fetchAds = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      console.log('[PromoSlot] Fetching ads for placement:', placement);
      
      // Fetch official city ads
      const { data: officialAds, error: officialError } = await supabase
        .from('city_ads')
        .select('*')
        .eq('placement', placement)
        .eq('is_active', true)
        .or(`start_at.is.null,start_at.lte.${now}`)
        .or(`end_at.is.null,end_at.gte.${now}`)
        .order('priority', { ascending: false })
        .order('display_order', { ascending: true });

      // Fetch user submitted active ads
      const { data: userAds, error: userError } = await supabase
        .from('user_advertisements')
        .select('*')
        .eq('status', 'active')
        .or('placement.is.null,placement.eq.' + placement)
        .order('slot_start_time', { ascending: true });

      // Combine ads with official ads taking priority
      const combinedAds = [
        ...(officialAds || []),
        ...(userAds || []).map(ad => ({
          ...ad,
          cta_link: ad.link_url,
          cta_text: 'Learn More',
          priority: 0,
          is_active: true,
          label: 'Sponsored'
        }))
      ];

      setAds(combinedAds);
    } catch (e) {
      console.error('[PromoSlot] Failed to fetch ads:', e);
      setAds([]);
    } finally {
      setLoading(false);
    }
  }, [placement]);

  // Track impression when ad is displayed
  const trackImpression = useCallback(async (adId: string) => {
    try {
      await supabase.rpc('increment_ad_impressions', { ad_id: adId });
    } catch (e) {
      // Fallback: get current count and increment
      try {
        const { data } = await supabase
          .from('city_ads')
          .select('impressions_count')
          .eq('id', adId)
          .single();
        
        if (data) {
          await supabase
            .from('city_ads')
            .update({ impressions_count: (data.impressions_count || 0) + 1 })
            .eq('id', adId);
        }
      } catch (err) {
        console.error('Failed to track impression:', err);
      }
    }
  }, []);

  // Rotate to next ad
  const rotateToNext = useCallback(() => {
    if (ads.length <= 1 || isHovered) return;
    
    setCurrentIndex((prev) => {
      const nextIndex = (prev + 1) % ads.length;
      // Track impression for new ad
      if (ads[nextIndex]) {
        trackImpression(ads[nextIndex].id);
      }
      return nextIndex;
    });
  }, [ads.length, isHovered, ads, trackImpression]);

  // Setup rotation interval (8-12 seconds random)
  useEffect(() => {
    if (ads.length <= 1 || isHovered) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Random rotation time between 8-12 seconds
    const randomTime = 8000 + Math.random() * 4000;
    
    intervalRef.current = setInterval(() => {
      rotateToNext();
    }, randomTime);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [ads.length, isHovered, rotateToNext]);

  // Fetch ads on mount
  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  // Track impression for current ad when it changes
  useEffect(() => {
    if (ads.length > 0 && ads[currentIndex]) {
      trackImpression(ads[currentIndex].id);
    }
  }, [currentIndex, ads, trackImpression]);

  // Loading state
  if (loading) {
    const loadingHeight = variant === 'horizontal' ? 'h-[100px]' : variant === 'sidebar' ? 'h-[180px]' : 'h-[400px]';
    return (
      <div className={`w-full ${loadingHeight} 
        bg-slate-900/50 rounded-xl animate-pulse border border-slate-800`}>
        <div className="flex items-center justify-center h-full">
          <div className="text-slate-500 text-sm">Loading promo...</div>
        </div>
      </div>
    );
  }

  // Empty state - show advertise prompt when no ads
  if (ads.length === 0) {
    return (
      <div className={`w-full ${variant === 'horizontal' ? 'h-[100px]' : variant === 'sidebar' ? 'h-[180px]' : 'h-[400px]'} 
        bg-slate-900/50 rounded-xl border border-slate-800 flex flex-col items-center justify-center gap-2 p-4`}>
        <div className="text-purple-400 text-lg font-semibold">Want to Advertise?</div>
        <p className="text-slate-400 text-xs text-center">
          Advertise on Troll City for 1000 Troll Coins • Lasts 7 days
        </p>
        <button 
          className="mt-2 px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors"
          onClick={() => window.location.href = '/city-registry/advertise'}
        >
          Submit Your Ad
        </button>
      </div>
    );
  }

  const currentAd = ads[currentIndex];

  return (
    <div 
      className="w-full h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Single ad */}
      {ads.length === 1 ? (
        <PromoAdCard ad={currentAd} variant={variant} />
      ) : (
        <>
          {/* Current ad with fade transition */}
          <div className="relative w-full h-full">
            {ads.map((ad, index) => (
              <div
                key={ad.id}
                className={`absolute inset-0 transition-opacity duration-500 ${
                  index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                }`}
              >
                <PromoAdCard ad={ad} variant={variant} />
              </div>
            ))}
          </div>

          {/* Navigation dots (if multiple ads) */}
          {ads.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
              {ads.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentIndex(index);
                    trackImpression(ads[index].id);
                  }}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    index === currentIndex
                      ? 'bg-purple-500 w-3'
                      : 'bg-slate-600 hover:bg-slate-500'
                  }`}
                  aria-label={`View ad ${index + 1}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Hook for fetching ads data (for external use)
export function useCityAds(placement: AdPlacement) {
  const [ads, setAds] = useState<CityAd[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const { data, error } = await supabase
          .from('city_ads')
          .select('*')
          .eq('placement', placement)
          .eq('is_active', true)
          .or('start_at.is.null,start_at.lte.' + new Date().toISOString())
          .or('end_at.is.null,end_at.gte.' + new Date().toISOString())
          .order('priority', { ascending: false })
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: false });

        if (error) throw error;
        setAds(data || []);
      } catch (e) {
        console.error('Failed to fetch ads:', e);
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, [placement]);

  return { ads, loading };
}