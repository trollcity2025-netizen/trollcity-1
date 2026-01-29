// Officer Activity Tracker
// Updates last_activity timestamp in officer_work_sessions when officers perform actions

import { supabase } from './supabase'

/**
 * Updates the last_activity timestamp for an officer's active shift
 * Should be called whenever an officer performs any moderation action
 * 
 * @param officerId - The ID of the officer performing the action
 * @param activeShiftId - Optional: The ID of the active shift (if already known, skips lookup)
 * @returns Promise<boolean> - true if update was successful, false otherwise
 */
export async function updateOfficerActivity(officerId: string, activeShiftId?: string): Promise<boolean> {
  try {
    let shiftId = activeShiftId

    // If shift ID not provided, find the active shift
    if (!shiftId) {
      const { data: activeShift, error: findError } = await supabase
        .from('officer_work_sessions')
        .select('id')
        .eq('officer_id', officerId)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .single()

      if (findError) {
        // No active shift found - this is okay, officer might not be clocked in
        if (findError.code === 'PGRST116') {
          console.log(`[OfficerActivity] No active shift found for officer ${officerId}`)
          return false
        }
        console.error('[OfficerActivity] Error finding active shift:', findError)
        return false
      }

      if (!activeShift) {
        console.log(`[OfficerActivity] No active shift found for officer ${officerId}`)
        return false
      }

      shiftId = activeShift.id
    }

    // Update last_activity timestamp directly using shift ID
    const { error: updateError } = await supabase
      .from('officer_work_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', shiftId)

    if (updateError) {
      console.error('[OfficerActivity] Error updating activity:', updateError)
      return false
    }

    return true
  } catch (error) {
    console.error('[OfficerActivity] Unexpected error:', error)
    return false
  }
}

