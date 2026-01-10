import { useState, useEffect, useMemo } from 'react';
import { Participant } from 'livekit-client';

export type LayoutMode = 'single' | 'dual-vertical' | 'dual-horizontal' | 'grid-2x2' | 'grid-3x2' | 'grid-auto' | 'main-side-bottom';

interface TileStyle {
  width: string;
  height: string;
  left?: string;
  top?: string;
  position?: 'absolute' | 'relative';
}

export function useBroadcastLayout(
  participants: Participant[],
  containerWidth: number,
  containerHeight: number,
  isLandscape: boolean,
  fixedSlotCount?: number
) {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('single');
  
  // Determine mode based on count and orientation
  useEffect(() => {
    const count = fixedSlotCount || participants.length;
    
    if (count <= 1) {
      setLayoutMode('single');
    } else if (count === 2) {
      setLayoutMode(isLandscape ? 'dual-horizontal' : 'dual-vertical');
    } else {
      // Use the custom layout for 3+ participants to match the specific design request
      setLayoutMode('main-side-bottom');
    }
  }, [participants.length, isLandscape, fixedSlotCount]);

  // Calculate grid dimensions
  const layout = useMemo(() => {
    const count = fixedSlotCount || participants.length;
    const styles: TileStyle[] = [];
    const gap = 8; // px
    const padding = 8; // px

    const availWidth = containerWidth - (padding * 2);
    const availHeight = containerHeight - (padding * 2);

    if (layoutMode === 'single') {
      styles.push({ width: '100%', height: '100%', position: 'absolute', top: '0', left: '0' });
    } 
    else if (layoutMode === 'dual-vertical') {
      // Host Top, Guest Bottom
      const itemHeight = (availHeight - gap) / 2;
      styles.push({ 
        width: `${availWidth}px`, 
        height: `${itemHeight}px`, 
        position: 'absolute', 
        top: `${padding}px`, 
        left: `${padding}px` 
      });
      styles.push({ 
        width: `${availWidth}px`, 
        height: `${itemHeight}px`, 
        position: 'absolute', 
        top: `${padding + itemHeight + gap}px`, 
        left: `${padding}px` 
      });
    }
    else if (layoutMode === 'dual-horizontal') {
      // Host Left, Guest Right
      const itemWidth = (availWidth - gap) / 2;
      styles.push({ 
        width: `${itemWidth}px`, 
        height: `${availHeight}px`, 
        position: 'absolute', 
        top: `${padding}px`, 
        left: `${padding}px` 
      });
      styles.push({ 
        width: `${itemWidth}px`, 
        height: `${availHeight}px`, 
        position: 'absolute', 
        top: `${padding}px`, 
        left: `${padding + itemWidth + gap}px` 
      });
    }
    else if (layoutMode === 'main-side-bottom') {
        // Layout:
        // Top Section (75% height):
        //   - Main (Left, 75% width)
        //   - Side Column (Right, 25% width, 2 rows)
        // Bottom Section (25% height):
        //   - Row of up to 4 items
        
        // If we have few participants (e.g. 3), we don't need the bottom row?
        // Actually, if we have 3, we fill Top Left, Top Right 1, Top Right 2.
        // If we have 4, we put the 4th in bottom row.
        
        const hasBottomRow = count > 3;
        const topHeightRatio = hasBottomRow ? 0.75 : 1.0;
        
        const topSectionHeight = (availHeight * topHeightRatio) - (hasBottomRow ? gap/2 : 0);
        const bottomSectionHeight = hasBottomRow ? (availHeight * (1 - topHeightRatio) - gap/2) : 0;
        
        const mainWidth = (availWidth * 0.75) - gap/2;
        const sideWidth = (availWidth * 0.25) - gap/2;
        
        // 0: Main Broadcaster - 70% width as requested
        const broadcasterWidth = mainWidth * 0.7; // Make broadcaster box 70% of original width
        const broadcasterLeft = padding + (mainWidth - broadcasterWidth); // Center it
        styles.push({
            width: `${broadcasterWidth}px`,
            height: `${topSectionHeight}px`,
            position: 'absolute',
            left: `${broadcasterLeft}px`,
            top: `${padding}px`
        });
        
        // 1 & 2: Side Column
        const sideItemHeight = (topSectionHeight - gap) / 2;
        for (let i = 1; i <= 2; i++) {
            if (i < count) {
                styles.push({
                    width: `${sideWidth}px`,
                    height: `${sideItemHeight}px`,
                    position: 'absolute',
                    left: `${padding + mainWidth + gap}px`,
                    top: `${padding + ((i - 1) * (sideItemHeight + gap))}px`
                });
            }
        }
        
        // 3+: Bottom Row
        if (hasBottomRow) {
            const bottomStartIndex = 3;
            const remainingCount = count - bottomStartIndex;
            const effectiveBottomCount = Math.min(remainingCount, 4); // Max 4 in bottom row
            
            const bottomItemWidth = (availWidth - (gap * (effectiveBottomCount - 1))) / effectiveBottomCount;

            for (let i = 0; i < effectiveBottomCount; i++) {
                 styles.push({
                    width: `${bottomItemWidth}px`,
                    height: `${bottomSectionHeight}px`,
                    position: 'absolute',
                    left: `${padding + (i * (bottomItemWidth + gap))}px`,
                    top: `${padding + topSectionHeight + gap}px`
                });
            }
        }
    }
    else {
      // Fallback Grid logic (grid-2x2, grid-3x2, etc)
      let cols = 2;
      let rows = 2;
      
      if (layoutMode === 'grid-3x2') {
        cols = isLandscape ? 3 : 2;
        rows = isLandscape ? 2 : 3;
      }
      
      if (count > 6) {
          cols = Math.ceil(Math.sqrt(count));
          rows = Math.ceil(count / cols);
      }

      const itemWidth = (availWidth - (gap * (cols - 1))) / cols;
      const itemHeight = (availHeight - (gap * (rows - 1))) / rows;

      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        
        styles.push({
          width: `${itemWidth}px`,
          height: `${itemHeight}px`,
          position: 'absolute',
          left: `${padding + (col * (itemWidth + gap))}px`,
          top: `${padding + (row * (itemHeight + gap))}px`,
        });
      }
    }

    return styles;
  }, [layoutMode, containerWidth, containerHeight, participants.length, fixedSlotCount, isLandscape]);

  return { layoutMode, tileStyles: layout };
}
