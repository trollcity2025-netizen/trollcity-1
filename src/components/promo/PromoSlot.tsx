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
      
      // DEBUG: First check ALL ads in database
      const { data: allAds } = await supabase.from('city_ads').select('*');
      console.log('[PromoSlot] ALL ads in DB:', JSON.stringify(allAds, null, 2));
      
      // First try: with date filters
      const { data, error } = await supabase
        .from('city_ads')
        .select('*')
        .eq('placement', placement)
        .eq('is_active', true)
        .or(`start_at.is.null,start_at.lte.${now}`)
        .or(`end_at.is.null,end_at.gte.${now}`)
        .order('priority', { ascending: false })
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      console.log('[PromoSlot] Query result (with date filters):', { count: data?.length, error });

      // Fallback: if no ads with date filters, try getting all active ads
      if ((!data || data.length === 0) && !error) {
        console.log('[PromoSlot] No ads with date filters, trying fallback...');
        const { data: fallbackData } = await supabase
          .from('city_ads')
          .select('*')
          .eq('placement', placement)
          .eq('is_active', true)
          .order('priority', { ascending: false })
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: false });
        
        console.log('[PromoSlot] Fallback result:', { count: fallbackData?.length });
        
        if (fallbackData && fallbackData.length > 0) {
          setAds(fallbackData);
          return;
        }
      }

      // Last resort: try without any filters except placement
      if ((!data || data.length === 0) && !error) {
        console.log('[PromoSlot] Trying without is_active filter...');
        const { data: anyData } = await supabase
          .from('city_ads')
          .select('*')
          .eq('placement', placement);
        
        console.log('[PromoSlot] Any ads for placement:', { count: anyData?.length });
        
        if (anyData && anyData.length > 0) {
          setAds(anyData);
          return;
        }
      }

      if (error) throw error;
      setAds(data || []);
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

  // Empty state - no ads
  if (ads.length === 0) {
    return null; // Don't render anything if no ads
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