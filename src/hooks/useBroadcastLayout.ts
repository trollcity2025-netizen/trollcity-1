import { useState, useEffect, useMemo } from 'react';
import { Participant } from 'livekit-client';

export type LayoutMode = 'single' | 'dual-vertical' | 'dual-horizontal' | 'grid-2x2' | 'grid-3x2' | 'grid-auto';

interface LayoutConfig {
  mode: LayoutMode;
  rows: number;
  cols: number;
  gap: number;
  padding: number;
}

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
  isLandscape: boolean
) {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('single');
  
  // Determine mode based on count and orientation
  useEffect(() => {
    const count = participants.length;
    
    if (count <= 1) {
      setLayoutMode('single');
    } else if (count === 2) {
      setLayoutMode(isLandscape ? 'dual-horizontal' : 'dual-vertical');
    } else if (count <= 4) {
      setLayoutMode('grid-2x2');
    } else if (count <= 6) {
      setLayoutMode('grid-3x2');
    } else {
      setLayoutMode('grid-auto');
    }
  }, [participants.length, isLandscape]);

  // Calculate grid dimensions
  const layout = useMemo(() => {
    const count = participants.length;
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
    else {
      // Grid logic
      let cols = 2;
      let rows = 2;
      
      if (layoutMode === 'grid-3x2') {
        cols = isLandscape ? 3 : 2;
        rows = isLandscape ? 2 : 3;
      }
      
      if (count > 6) {
          // simple auto grid for now
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
  }, [layoutMode, containerWidth, containerHeight, participants.length]);

  return { layoutMode, tileStyles: layout };
}
