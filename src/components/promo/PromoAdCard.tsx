/**
 * PromoAdCard - Reusable promotional ad card component
 * Used in both sidebar and right panel slots
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CityAd } from '../../types/cityAds';
import { supabase } from '../../lib/supabase';

interface PromoAdCardProps {
  ad: CityAd;
  variant?: 'sidebar' | 'featured' | 'horizontal';
  onClick?: () => void;
}

export default function PromoAdCard({ ad, variant = 'sidebar', onClick }: PromoAdCardProps) {
  const navigate = useNavigate();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);

  const isSidebar = variant === 'sidebar';
  const isFeatured = variant === 'featured';
  const isHorizontal = variant === 'horizontal';

  // Check if URL is internal (Troll City route) vs external
  const isInternalLink = (url: string) => url.startsWith('/');

  // Handle click - track and navigate
  // Preload image immediately to prevent flash when opening lightbox
  React.useEffect(() => {
    const img = new Image();
    img.src = ad.image_url;
  }, [ad.image_url]);

  const handleClick = async () => {
    // Open lightbox immediately first - no delay for user
    setShowLightbox(true);
    onClick?.();
    
    // Animate in after render
    setTimeout(() => setLightboxVisible(true), 10);

    // Track click in background without blocking UI
    try {
      await supabase.rpc('increment_ad_clicks', { ad_id: ad.id });
    } catch (e) {
      // Fallback: direct update
      try {
        await supabase
          .from('city_ads')
          .update({ clicks_count: (ad.clicks_count || 0) + 1 })
          .eq('id', ad.id);
      } catch (err) {
        console.error('Failed to track ad click:', err);
      }
    }
  };
  
  const closeLightbox = () => {
    setLightboxVisible(false);
    setTimeout(() => setShowLightbox(false), 300);
  };

  const baseClasses = `relative overflow-hidden rounded-xl transition-all duration-300 cursor-pointer`;
  
  const sizeClasses = isHorizontal
    ? 'w-full h-full min-h-[100px] max-h-[140px]'
    : isSidebar 
    ? 'w-full h-full min-h-[150px] max-h-[180px]' 
    : 'w-full h-full min-h-[350px] max-h-[500px]';

  const hoverClasses = isHovered 
    ? 'transform scale-[1.02] shadow-xl shadow-purple-500/20' 
    : '';

  const backgroundStyle = ad.background_style 
    ? { background: ad.background_style }
    : { background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)' };

  return (
    <div 
      className={`${baseClasses} ${sizeClasses} ${hoverClasses}`}
      style={backgroundStyle}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        {!imageLoaded && (
          <div className="absolute inset-0 bg-slate-800 animate-pulse" />
        )}
        <img
          src={ad.image_url}
          alt={ad.title}
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            imageLoaded ? 'opacity-60' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          loading="eager"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/50 to-transparent" />
      </div>

      {/* Content */}
      <div className={`relative z-10 h-full ${isHorizontal ? 'flex items-center justify-between p-3 md:p-4' : 'flex flex-col justify-end p-3'}`}>
        {isHorizontal ? (
          <>
            {/* Horizontal layout: text left, CTA right */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {ad.label && (
                <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-purple-600/80 text-white border border-purple-400/30">
                  {ad.label}
                </span>
              )}
              <div className="min-w-0">
                <h3 className="font-bold text-white text-sm md:text-base truncate">{ad.title}</h3>
                {ad.subtitle && (
                  <p className="text-xs text-purple-200 truncate">{ad.subtitle}</p>
                )}
              </div>
            </div>
            {ad.cta_text && (
              <button
                className="shrink-0 ml-3 px-4 py-2 rounded-lg font-semibold text-xs
                  bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500
                  text-white border border-purple-400/30 shadow-lg shadow-purple-900/30
                  transition-all duration-200 hover:scale-105"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
              >
                {ad.cta_text}
              </button>
            )}
          </>
        ) : (
          <>
            {/* Vertical layout for sidebar/featured */}
            {ad.label && (
              <div className="mb-1 inline-flex">
                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-purple-600/80 text-white border border-purple-400/30">
                  {ad.label}
                </span>
              </div>
            )}
            <h3 className={`font-bold text-white mb-0.5 ${isSidebar ? 'text-sm' : 'text-xl'}`}>
              {ad.title}
            </h3>
            {ad.subtitle && (
              <p className="text-xs text-purple-200 mb-1">{ad.subtitle}</p>
            )}
            {isFeatured && ad.description && (
              <p className="text-sm text-slate-300 mb-3 line-clamp-2">{ad.description}</p>
            )}
            {ad.cta_text && (
              <button
                className="mt-auto self-start px-3 py-1.5 rounded-lg font-semibold text-xs
                  bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500
                  text-white border border-purple-400/30 shadow-lg shadow-purple-900/30
                  transition-all duration-200 hover:scale-105"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
              >
                {ad.cta_text}
              </button>
            )}
          </>
        )}

        {/* Stats (for admin preview) */}
        {(ad.clicks_count > 0 || ad.impressions_count > 0) && (
          <div className="absolute top-2 right-2 flex gap-2 text-xs text-slate-400">
            {ad.impressions_count > 0 && (
              <span>{ad.impressions_count} views</span>
            )}
            {ad.clicks_count > 0 && (
              <span>{ad.clicks_count} clicks</span>
            )}
          </div>
        )}
      </div>

      {/* Glow effect on hover */}
      {isHovered && (
        <div className="absolute inset-0 rounded-xl border-2 border-purple-500/50 pointer-events-none" />
      )}

    {/* Lightbox portal - renders directly to body, no parent reflow */}
    {showLightbox && createPortal(
      <div
        className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-300 ease-out ${lightboxVisible ? 'bg-black/70' : 'bg-black/0'}`}
        onClick={closeLightbox}
      >
        <div
          className={`relative max-w-[95vw] max-h-[95vh] overflow-hidden rounded-xl bg-slate-900 transition-all duration-300 ease-out ${lightboxVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="absolute top-2 right-2 z-20 rounded-full bg-slate-800/90 p-2 text-white hover:bg-slate-700 transition-colors duration-200"
            onClick={closeLightbox}
            aria-label="Close image preview"
          >
            ✕
          </button>

          <img
            src={ad.image_url}
            alt={ad.title}
            className="max-h-[90vh] w-auto object-contain transition-opacity duration-300"
          />
          {ad.title && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-3 text-white text-sm">
              {ad.title}
            </div>
          )}
        </div>
      </div>,
      document.body
    )}
    </div>
  );
}