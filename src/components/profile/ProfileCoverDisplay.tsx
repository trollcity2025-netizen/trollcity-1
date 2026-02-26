import React from 'react';
import { cn } from '../../lib/utils';

interface ProfileCoverDisplayProps {
  coverPhotoUrl?: string | null;
  positionX?: number;
  positionY?: number;
  zoom?: number;
  className?: string;
  showPlaceholder?: boolean;
}

export default function ProfileCoverDisplay({
  coverPhotoUrl,
  positionX = 50,
  positionY = 50,
  zoom = 1,
  className,
  showPlaceholder = true
}: ProfileCoverDisplayProps) {
  // Default placeholder gradient when no cover photo
  const placeholderGradient = "bg-gradient-to-r from-purple-900 via-pink-900 to-purple-900";

  if (!coverPhotoUrl && !showPlaceholder) {
    return null;
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        // 3:1 aspect ratio (300px height for 900px width)
        "h-[200px] md:h-[250px] lg:h-[300px]",
        !coverPhotoUrl && placeholderGradient,
        className
      )}
    >
      {coverPhotoUrl ? (
        <>
          {/* Cover Photo Image */}
          <img
            src={coverPhotoUrl}
            alt="Cover Photo"
            className="absolute inset-0 w-full h-full"
            style={{
              objectFit: 'cover',
              objectPosition: 'center center'
            }}
          />
          
          {/* Gradient Overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        </>
      ) : (
        /* Placeholder when no cover photo */
        <div className={cn(
          "absolute inset-0",
          placeholderGradient
        )}>
          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-pink-500 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          </div>
        </div>
      )}
    </div>
  );
}
