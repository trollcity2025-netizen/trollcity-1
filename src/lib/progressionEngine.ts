import { supabase } from './supabase'
import { triggerMaiReaction } from './maiEngine'

export type DnaEventType =
  | 'SENT_CHAOS_GIFT'
  | 'HELPED_SMALL_STREAMER'
  | 'WON_FAMILY_WAR'
  | 'LOST_FAMILY_WAR'
  | 'SILENT_WATCHER'
  | 'STREAM_EVENT'
  | 'PURCHASE_EVENT'
  | 'LEGACY_EVENT'
  | 'EPIC_GIFT_CHAOS'
  | 'HIGH_SPENDER'
  | 'PAYMENT_METHOD_LINKED'
  | 'STREAM_START'
  | 'WAR_BEGIN'
  | 'HIGH_SPENDER_EVENT'

export async function addXp(userId: string, amount: number, reason?: string) {
  // Skip for guest IDs
  if (!userId || userId.startsWith('TC-')) {
    console.log('Guest user detected, skipping XP add');
    return { data: null, error: null };
  }
  
  const { data, error } = await supabase.rpc('add_xp', { p_user_id: userId, p_amount: Math.max(0, Math.floor(amount)), p_reason: reason || null })

  // Family XP earning hook: Allocate XP to family stats
  if (data && amount > 0) {
    try {
      // Check if user is in a family
      const { data: familyMember } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('user_id', userId)
        .single()

      if (familyMember?.family_id) {
        const familyXpBonus = Math.floor(amount * 0.05) // 5% of earned XP goes to family
        if (familyXpBonus > 0) {
          // Use RPC function to atomically update family stats
          const { data: _familyResult, error: familyError } = await supabase.rpc('increment_family_stats', {
            p_family_id: familyMember.family_id,
            p_coin_bonus: 0,
            p_xp_bonus: familyXpBonus
          })

          if (familyError) {
            console.warn('Failed to update family stats for XP earning:', familyError)
          } else {
            console.log(`Allocated ${familyXpBonus} XP to family ${familyMember.family_id}`)
          }
        }

        // Track XP earning for family tasks
        try {
          const { trackXpEarning } = await import('./familyTasks')
          await trackXpEarning(userId, amount)
        } catch (taskErr) {
          console.warn('Failed to track XP earning for tasks:', taskErr)
        }

        // Track XP earning for active wars
        try {
          const { trackWarActivity } = await import('./familyWars')
          await trackWarActivity(userId, 'xp_earned', amount)
        } catch (warErr) {
          console.warn('Failed to track XP earning for wars:', warErr)
        }
      }
    } catch (familyErr) {
      console.warn('Family XP allocation failed:', familyErr)
      // Don't fail the main XP transaction for family allocation errors
    }
  }

  return { data, error }
}

export async function recordEvent(userId: string, eventType: DnaEventType, payload?: any) {
  const { data, error } = await supabase.rpc('record_dna_event', { p_user_id: userId, p_event_type: eventType, p_data: payload || {} })
  return { data, error }
}

export async function mutateDnaForUser(userId: string, eventType: DnaEventType, payload?: any) {
  return await recordEvent(userId, eventType, payload)
}

export async function recordAppEvent(userId: string, eventType: DnaEventType, metadata?: any) {
  const payload = metadata || {}
  const { data, error } = await supabase.rpc('record_dna_event', { p_user_id: userId, p_event_type: eventType, p_data: payload })
  try { await triggerMaiReaction(userId, eventType, payload) } catch {}
  return { data, error }
}

export function dnaClassFor(primary: string | null | undefined) {
  const key = String(primary || '').toUpperCase()
  if (key === 'CHAOS_DNA') return 'dna-chaos'
  if (key === 'MAD_TROLL_DNA') return 'dna-mad'
  if (key === 'GHOST_DNA') return 'dna-ghost'
  if (key === 'GUARDIAN_DNA') return 'dna-guardian'
  if (key === 'WARRIOR_DNA') return 'dna-warrior'
  if (key === 'LEGACY_DNA') return 'dna-legacy'
  if (key === 'GAMBLER_DNA') return 'dna-gambler'
  return ''
}

export async function currentIdentity(userId: string) {
  try {
    const { data: lvl, error: lvlError } = await supabase.from('user_stats').select('level, xp_total, xp_to_next_level, updated_at').eq('user_id', userId).maybeSingle()
    if (lvlError && lvlError.code !== 'PGRST116') {
      console.error('Error fetching user stats:', lvlError)
    }
    const { data: dna, error: dnaError } = await supabase.from('troll_dna_profiles').select('*').eq('user_id', userId).maybeSingle()
    if (dnaError && dnaError.code !== 'PGRST116') {
      console.error('Error fetching DNA profile:', dnaError)
    }
    
    // Calculate level info using the helper function
    const { level, next_level_xp, xp_into_level, remaining_xp } = lvl ? calculateLevelFromXP(lvl.xp_total || 0) : { level: 1, next_level_xp: 100, xp_into_level: 0, remaining_xp: 100 };
    
    const levelData = {
      level: level,
      xp: xp_into_level,        // XP into current level (for progress bar)
      next_level_xp: next_level_xp  // XP needed for current level (for progress bar)
    }

    return { level: levelData, dna: dna || { primary_dna: null, traits: [] } }
  } catch (err) {
    console.error('Exception in currentIdentity:', err)
    return { level: { level: 1, xp: 0, next_level_xp: 100 }, dna: { primary_dna: null, traits: [] } }
  }
}

// Helper function to calculate level and remaining XP from absolute XP
function calculateLevelFromXP(absoluteXp: number): { 
  level: number; 
  next_level_xp: number;  // XP needed for CURRENT level (for progress bar)
  xp_into_level: number;   // XP earned into current level
  remaining_xp: number;   // XP remaining to next level
} {
  let levelValue = 1;
  let xpNeededThisLevel = 100;
  let prevLevelAbsolute = 0;
  let nextLevelAbsolute = 100;
  
  if (absoluteXp < 100) {
    levelValue = 1;
    xpNeededThisLevel = 100;
    prevLevelAbsolute = 0;
    nextLevelAbsolute = 100;
  } else if (absoluteXp < 250) {
    levelValue = 2;
    xpNeededThisLevel = 150;
    prevLevelAbsolute = 100;
    nextLevelAbsolute = 250;
  } else if (absoluteXp < 500) {
    levelValue = 3;
    xpNeededThisLevel = 250;
    prevLevelAbsolute = 250;
    nextLevelAbsolute = 500;
  } else if (absoluteXp < 800) {
    levelValue = 4;
    xpNeededThisLevel = 300;
    prevLevelAbsolute = 500;
    nextLevelAbsolute = 800;
  } else if (absoluteXp < 1200) {
    levelValue = 5;
    xpNeededThisLevel = 400;
    prevLevelAbsolute = 800;
    nextLevelAbsolute = 1200;
  } else if (absoluteXp < 1700) {
    levelValue = 6;
    xpNeededThisLevel = 500;
    prevLevelAbsolute = 1200;
    nextLevelAbsolute = 1700;
  } else if (absoluteXp < 2300) {
    levelValue = 7;
    xpNeededThisLevel = 600;
    prevLevelAbsolute = 1700;
    nextLevelAbsolute = 2300;
  } else if (absoluteXp < 3000) {
    levelValue = 8;
    xpNeededThisLevel = 700;
    prevLevelAbsolute = 2300;
    nextLevelAbsolute = 3000;
  } else if (absoluteXp < 4000) {
    levelValue = 9;
    xpNeededThisLevel = 1000;
    prevLevelAbsolute = 3000;
    nextLevelAbsolute = 4000;
  } else {
    // Level 10+: Each level requires 1000 more XP
    levelValue = 10 + Math.floor((absoluteXp - 4000) / 1000);
    xpNeededThisLevel = 1000;
    prevLevelAbsolute = 4000 + ((levelValue - 10) * 1000);
    nextLevelAbsolute = prevLevelAbsolute + 1000;
  }
  
  const xpIntoLevel = Math.max(0, absoluteXp - prevLevelAbsolute);
  const remainingXp = Math.max(0, xpNeededThisLevel - xpIntoLevel);
  
  return {
    level: levelValue,
    next_level_xp: xpNeededThisLevel,  // XP needed for CURRENT level (for progress bar)
    xp_into_level: xpIntoLevel,         // XP earned into current level
    remaining_xp: remainingXp            // XP remaining to next level
  };
}

export async function getLevelProfile(userId: string) {
  try {
    const { data, error } = await supabase.from('user_stats').select('level, xp_total, xp_to_next_level, updated_at').eq('user_id', userId).maybeSingle()
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching level profile:', error)
    }
    if (data) {
      // Calculate level info using the helper function
      const { level, next_level_xp, xp_into_level, remaining_xp } = calculateLevelFromXP(data.xp_total || 0);
      return {
        level: level,
        xp: xp_into_level,  // XP into current level (for progress bar)
        total_xp: data.xp_total || 0,
        next_level_xp: next_level_xp,  // XP needed for current level (for progress bar)
        remaining_xp: remaining_xp,    // XP remaining to next level (for display)
        updated_at: data.updated_at || new Date().toISOString()
      }
    }
    return { level: 1, xp: 0, total_xp: 0, next_level_xp: 100, remaining_xp: 100, updated_at: new Date().toISOString() }
  } catch (err) {
    console.error('Exception in getLevelProfile:', err)
    return { level: 1, xp: 0, total_xp: 0, next_level_xp: 100, remaining_xp: 100, updated_at: new Date().toISOString() }
  }
}

export async function getDnaProfile(userId: string) {
  try {
    const { data, error } = await supabase.from('troll_dna_profiles').select('*').eq('user_id', userId).maybeSingle()
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching DNA profile:', error)
    }
    return data || { primary_dna: null, traits: [], aura_style: null, personality_scores: {}, evolution_score: 0 }
  } catch (err) {
    console.error('Exception in getDnaProfile:', err)
    return { primary_dna: null, traits: [], aura_style: null, personality_scores: {}, evolution_score: 0 }
  }
}

export async function getUserFullIdentity(userId: string) {
  const [lvl, dna, recentRes] = await Promise.all([
    getLevelProfile(userId),
    getDnaProfile(userId),
    supabase.from('troll_dna_events').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
  ])
  
  return { level: lvl, dna, events: recentRes.data || [] }
}
