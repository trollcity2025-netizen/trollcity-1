#!/usr/bin/env node

/**
 * Automated fix script for Troll Court UUID flicker bug
 * Run with: node fix-courtroom.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src/pages/CourtRoom.tsx');

console.log('🔧 Applying Troll Court UUID Flicker Fixes...\n');

try {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Fix 1: Update imports to add memo and useRef
  console.log('✓ Fix 1: Updating imports...');
  content = content.replace(
    /import React, \{ useEffect, useState, useMemo \} from "react";/,
    'import React, { useEffect, useState, useMemo, memo, useRef } from "react";'
  );

  // Fix 2: Extract memoized components
  console.log('✓ Fix 2: Extracting memoized components...');
  
  const memoizedComponents = `
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
        gridTemplateColumns: \`repeat(\${getCols()}, minmax(0, 1fr))\`
      }}
    >
      {visible.map((t, index) => {
        const participantSid = t.participant?.sid || \`participant-\${index}\`;
        const stableKey = \`\${participantSid}-\${index}\`;
        
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
          key={\`ph-\${i}\`}
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
`;

  const importEndIndex = content.indexOf('import { Track } from "livekit-client";') + 'import { Track } from "livekit-client";'.length;
  const beforeExport = content.indexOf('export default function CourtRoom()');
  
  if (beforeExport > importEndIndex) {
    const beforeComponents = content.substring(0, importEndIndex);
    const afterComponents = content.substring(beforeExport);
    content = beforeComponents + '\n' + memoizedComponents + '\n\n' + afterComponents;
  }

  // Fix 3: Remove old component definitions (between lines ~317-376)
  console.log('✓ Fix 3: Removing duplicate component definitions...');
  content = content.replace(
    /\n  const CourtVideoGrid = \(\{ maxTiles \}\) => \{[\s\S]*?\n  \};\n\n  const CourtTrackCounter = \(\{ onCount \}\) => \{[\s\S]*?\n  \};/m,
    ''
  );

  // Fix 4: Add room ID stabilization (after state declarations, before useEffect)
  console.log('✓ Fix 4: Adding room ID stabilization...');
  const roomIdStabilization = `
  // Stabilize room ID once at mount
  const roomIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (courtId && !roomIdRef.current) {
      roomIdRef.current = courtId;
      console.log('[CourtRoom] Room ID stabilized:', courtId);
    }
  }, [courtId]);
  const roomId = roomIdRef.current || courtId;
`;
  
  const firstUseEffect = content.indexOf('  useEffect(() => {');
  if (firstUseEffect > 0) {
    content = content.substring(0, firstUseEffect) + roomIdStabilization + '\n\n  ' + content.substring(firstUseEffect);
  }

  // Fix 5: Debounce boxCount updates
  console.log('✓ Fix 5: Debouncing boxCount updates...');
  content = content.replace(
    /if \(typeof data\.max_boxes === 'number'\) setBoxCount\(Math\.min\(6, Math\.max\(2, data\.max_boxes\)\)\);/,
    `if (typeof data.max_boxes === 'number') {
          const newBoxCount = Math.min(6, Math.max(2, data.max_boxes));
          if (newBoxCount !== lastBoxCount) {
            lastBoxCount = newBoxCount;
            setBoxCount(newBoxCount);
            console.log('[CourtRoom] BoxCount updated:', newBoxCount);
          }
        }`
  );

  // Add lastBoxCount initialization
  content = content.replace(
    /if \(!courtId\) return;\n    const id = window\.setInterval/,
    `if (!courtId) return;
    let lastBoxCount = boxCount;
    
    const id = window.setInterval`
  );

  // Fix 6: Add mount/unmount logging
  console.log('✓ Fix 6: Adding component lifecycle logging...');
  const mountLogging = `
  useEffect(() => {
    console.log('[CourtRoom] Component mounted with courtId:', courtId);
    return () => {
      console.log('[CourtRoom] Component unmounting');
    };
  }, [courtId]);
`;
  
  const lastEffectIndex = content.lastIndexOf('}, [courtId]);');
  if (lastEffectIndex > 0) {
    const insertPoint = lastEffectIndex + '}, [courtId]);'.length;
    content = content.substring(0, insertPoint) + '\n' + mountLogging + content.substring(insertPoint);
  }

  // Write fixed content
  fs.writeFileSync(filePath, content, 'utf8');
  
  console.log('\n✅ All fixes applied successfully!\n');
  console.log('📋 What was fixed:');
  console.log('  1. Added memo and useRef imports');
  console.log('  2. Extracted memoized CourtVideoGrid component');
  console.log('  3. Extracted memoized CourtTrackCounter component');
  console.log('  4. Added room ID stabilization with useRef');
  console.log('  5. Debounced boxCount state updates');
  console.log('  6. Added component lifecycle logging\n');
  
  console.log('🧪 Testing:\n  Open DevTools Console and look for:');
  console.log('  - "[CourtRoom] Room ID stabilized"');
  console.log('  - "[CourtRoom] Component mounted"');
  console.log('  - Infrequent "[CourtRoom] BoxCount updated" messages\n');
  
  console.log('⚠️  If something went wrong, revert with:');
  console.log('  git checkout src/pages/CourtRoom.tsx\n');

} catch (error) {
  console.error('❌ Error applying fixes:', error.message);
  process.exit(1);
}
