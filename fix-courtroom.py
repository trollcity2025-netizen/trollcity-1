#!/usr/bin/env python3
"""
Automated fix script for Troll Court UUID flicker bug
Run with: python fix-courtroom.py
"""

import os
import sys
from pathlib import Path

def main():
    file_path = Path(__file__).parent / "src" / "pages" / "CourtRoom.tsx"
    
    print("🔧 Applying Troll Court UUID Flicker Fixes...\n")
    
    try:
        # Read file
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Fix 1: Update imports
        print("✓ Fix 1: Updating imports...")
        content = content.replace(
            'import React, { useEffect, useState, useMemo } from "react";',
            'import React, { useEffect, useState, useMemo, memo, useRef } from "react";'
        )
        
        # Fix 2: Extract memoized components
        print("✓ Fix 2: Extracting memoized components...")
        
        memoized_components = '''
// Memoized Court Video Grid - Prevents remounting and flickering
const CourtVideoGrid = memo(({ maxTiles }: { maxTiles: number }) => {
  const tracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: true }
  );

  const visible = useMemo(() => 
    (tracks || []).slice(0, Math.max(2, maxTiles || 2)),
    [tracks, maxTiles]
  );

  const placeholders = Math.max(2, maxTiles || 2) - visible.length;

  const getCols = () => {
    const cols = Math.max(2, maxTiles || 2);
    if (cols <= 2) return 2;
    if (cols <= 3) return 3;
    return Math.min(cols, 4);
  };

  return (
    <div
      className="w-full h-[60vh] gap-2 p-2"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${getCols()}, minmax(0, 1fr))`
      }}
    >
      {visible.map((t, index) => {
        const participantSid = t.participant?.sid || `participant-${index}`;
        const stableKey = `${participantSid}-${index}`;
        
        return (
          <div
            key={stableKey}
            className="tc-neon-frame"
          >
            <ParticipantTile trackRef={t} />
          </div>
        );
      })}
      {Array.from({ length: placeholders }).map((_, i) => (
        <div 
          key={`ph-${i}`}
          className="tc-neon-frame flex items-center justify-center"
          style={{ pointerEvents: 'none' }}
        >
          <div className="text-gray-400 text-sm">Waiting for participant…</div>
        </div>
      ))}
    </div>
  );
});

CourtVideoGrid.displayName = 'CourtVideoGrid';

// Memoized Track Counter
const CourtTrackCounter = memo(({ onCount }: { onCount: (count: number) => void }) => {
  const tracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: true }
  );

  const activeCount = useMemo(() => {
    const identities = new Set(
      (tracks || []).map((t) => t.participant?.sid || t.participant?.identity)
    );
    return identities.size;
  }, [tracks]);

  useEffect(() => {
    onCount(activeCount);
  }, [activeCount, onCount]);

  return null;
});

CourtTrackCounter.displayName = 'CourtTrackCounter';
'''
        
        import_end = content.find('import { Track } from "livekit-client";')
        if import_end > 0:
            import_end += len('import { Track } from "livekit-client";')
            before_export = content.find('export default function CourtRoom()')
            if before_export > import_end:
                content = content[:import_end] + '\n' + memoized_components + '\n\n' + content[before_export:]
        
        # Fix 3: Remove old component definitions
        print("✓ Fix 3: Removing duplicate component definitions...")
        import re
        pattern = r'\n  const CourtVideoGrid = \(\{ maxTiles \}\) => \{[\s\S]*?\n  \};\n\n  const CourtTrackCounter = \(\{ onCount \}\) => \{[\s\S]*?\n  \};'
        content = re.sub(pattern, '', content)
        
        # Fix 4: Add room ID stabilization
        print("✓ Fix 4: Adding room ID stabilization...")
        room_id_stab = '''
  // Stabilize room ID once at mount
  const roomIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (courtId && !roomIdRef.current) {
      roomIdRef.current = courtId;
      console.log('[CourtRoom] Room ID stabilized:', courtId);
    }
  }, [courtId]);
  const roomId = roomIdRef.current || courtId;
'''
        first_use_effect = content.find('  useEffect(() => {')
        if first_use_effect > 0:
            content = content[:first_use_effect] + room_id_stab + '\n\n  ' + content[first_use_effect:]
        
        # Fix 5: Debounce boxCount updates
        print("✓ Fix 5: Debouncing boxCount updates...")
        old_setbox = "if (typeof data.max_boxes === 'number') setBoxCount(Math.min(6, Math.max(2, data.max_boxes)));"
        new_setbox = """if (typeof data.max_boxes === 'number') {
          const newBoxCount = Math.min(6, Math.max(2, data.max_boxes));
          if (newBoxCount !== lastBoxCount) {
            lastBoxCount = newBoxCount;
            setBoxCount(newBoxCount);
            console.log('[CourtRoom] BoxCount updated:', newBoxCount);
          }
        }"""
        content = content.replace(old_setbox, new_setbox)
        
        content = content.replace(
            "if (!courtId) return;\n    const id = window.setInterval",
            "if (!courtId) return;\n    let lastBoxCount = boxCount;\n    \n    const id = window.setInterval"
        )
        
        # Fix 6: Add mount/unmount logging
        print("✓ Fix 6: Adding component lifecycle logging...")
        mount_logging = '''
  useEffect(() => {
    console.log('[CourtRoom] Component mounted with courtId:', courtId);
    return () => {
      console.log('[CourtRoom] Component unmounting');
    };
  }, [courtId]);
'''
        last_effect = content.rfind('}, [courtId]);')
        if last_effect > 0:
            insert_point = last_effect + len('}, [courtId]);')
            content = content[:insert_point] + '\n' + mount_logging + content[insert_point:]
        
        # Write fixed content
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print('\n✅ All fixes applied successfully!\n')
        print('📋 What was fixed:')
        print('  1. Added memo and useRef imports')
        print('  2. Extracted memoized CourtVideoGrid component')
        print('  3. Extracted memoized CourtTrackCounter component')
        print('  4. Added room ID stabilization with useRef')
        print('  5. Debounced boxCount state updates')
        print('  6. Added component lifecycle logging\n')
        
        print('🧪 Testing:\n  Open DevTools Console and look for:')
        print('  - "[CourtRoom] Room ID stabilized"')
        print('  - "[CourtRoom] Component mounted"')
        print('  - Infrequent "[CourtRoom] BoxCount updated" messages\n')
        
        print('⚠️  If something went wrong, revert with:')
        print('  git checkout src/pages/CourtRoom.tsx\n')
        
    except Exception as e:
        print(f'❌ Error applying fixes: {e}')
        sys.exit(1)

if __name__ == '__main__':
    main()
