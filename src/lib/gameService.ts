import { supabase } from '@/lib/supabase'

// Game reward constants
export const GAME_REWARD_AMOUNT = 10
export const GAME_COOLDOWN_SECONDS = 30

/**
 * Award coins to a game winner
 * This function securely calls the backend to award coins
 */
export async function awardGameCoins(
  userId: string,
  gameType: string,
  matchId: string,
  amount: number = GAME_REWARD_AMOUNT
): Promise<{ success: boolean; error?: string; coinsAwarded?: number }> {
  try {
    const { data, error } = await supabase.rpc('award_game_coins', {
      p_user_id: userId,
      p_game_type: gameType,
      p_match_id: matchId,
      p_amount: amount
    })

    if (error) throw error

    const result = data as { success: boolean; error?: string; coins_awarded?: number }
    return {
      success: result.success,
      error: result.error,
      coinsAwarded: result.coins_awarded
    }
  } catch (err: any) {
    console.error('Error awarding game coins:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Create a new game match
 */
export async function createGameMatch(
  gameType: string,
  players: string[]
): Promise<{ matchId?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('create_game_match', {
      p_game_type: gameType,
      p_players: players
    })

    if (error) throw error

    return { matchId: data }
  } catch (err: any) {
    console.error('Error creating game match:', err)
    return { error: err.message }
  }
}

/**
 * Set the winner of a match
 */
export async function setMatchWinner(
  matchId: string,
  winnerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('set_match_winner', {
      p_match_id: matchId,
      p_winner_id: winnerId
    })

    if (error) throw error

    return { success: data }
  } catch (err: any) {
    console.error('Error setting match winner:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Check if user is on cooldown for a game
 */
export async function checkGameCooldown(
  userId: string,
  gameType: string,
  seconds: number = GAME_COOLDOWN_SECONDS
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_game_cooldown', {
      p_user_id: userId,
      p_game_type: gameType,
      p_seconds: seconds
    })

    if (error) throw error

    return data
  } catch (err) {
    console.error('Error checking game cooldown:', err)
    return false
  }
}

/**
 * Full game completion flow:
 * 1. Create match
 * 2. Set winner
 * 3. Award coins
 */
export async function completeGameMatch(
  gameType: string,
  players: string[],
  winnerId: string
): Promise<{ success: boolean; matchId?: string; error?: string }> {
  try {
    // Create match
    const { matchId, error: createError } = await createGameMatch(gameType, players)
    if (createError || !matchId) {
      return { success: false, error: createError }
    }

    // Set winner
    const { success: winnerSet, error: winnerError } = await setMatchWinner(matchId, winnerId)
    if (!winnerSet || winnerError) {
      return { success: false, error: winnerError }
    }

    // Award coins to winner
    const { success: coinsAwarded, error: awardError } = await awardGameCoins(
      winnerId,
      gameType,
      matchId
    )

    if (!coinsAwarded) {
      return { success: false, error: awardError }
    }

    return { success: true, matchId }
  } catch (err: any) {
    console.error('Error completing game match:', err)
    return { success: false, error: err.message }
  }
}

// Game type definitions
export const GAME_TYPES = {
  TWO_TRUTHS_LIE: 'two-truths-lie',
  FAME_SHAME_WHEEL: 'fame-shame-wheel',
  TROLL_IDENTITY_HUNT: 'troll-identity-hunt',
  REACTION_SPEED: 'reaction-speed',
  MULTIPLAYER_SOLITAIRE: 'multiplayer-solitaire',
  MULTIPLAYER_DOMINOES: 'multiplayer-dominoes'
} as const

// Game metadata
export const GAME_METADATA: Record<string, { name: string; description: string; minPlayers: number; maxPlayers: number }> = {
  [GAME_TYPES.TWO_TRUTHS_LIE]: {
    name: 'Two Truths & A Lie',
    description: 'Share three statements, let others guess which one is false',
    minPlayers: 2,
    maxPlayers: 10
  },
  [GAME_TYPES.FAME_SHAME_WHEEL]: {
    name: 'Fame or Shame Wheel',
    description: 'Spin the wheel and complete challenges',
    minPlayers: 2,
    maxPlayers: 20
  },
  [GAME_TYPES.TROLL_IDENTITY_HUNT]: {
    name: 'Troll Identity Hunt',
    description: 'Guess the secret identity by asking questions',
    minPlayers: 2,
    maxPlayers: 8
  },
  [GAME_TYPES.REACTION_SPEED]: {
    name: 'Reaction Speed Arena',
    description: 'Test your reflexes and be the fastest',
    minPlayers: 1,
    maxPlayers: 50
  },
  [GAME_TYPES.MULTIPLAYER_SOLITAIRE]: {
    name: 'Multiplayer Solitaire',
    description: 'Race against others to clear the board',
    minPlayers: 1,
    maxPlayers: 4
  },
  [GAME_TYPES.MULTIPLAYER_DOMINOES]: {
    name: 'Multiplayer Dominoes',
    description: 'Classic dominoes with real players',
    minPlayers: 2,
    maxPlayers: 4
  }
}
