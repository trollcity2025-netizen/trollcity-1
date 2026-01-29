// Auto Clock-Out Scanner Edge Function
// Runs every hour using Supabase Scheduled Function
// Auto-clocks out officers after 6 hours of work or 30 minutes of inactivity

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async () => {
  const requestId = `auto_clockout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log(`[AutoClockOut ${requestId}] Starting auto clock-out scan...`)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all active shifts (where clock_out is null)
    // Using the new table 'officer_work_sessions'
    const { data: shifts, error: shiftsError } = await supabase
      .from('officer_work_sessions')
      .select('*')
      .is('clock_out', null) // active shifts only

    if (shiftsError) {
      console.error(`[AutoClockOut ${requestId}] Error fetching shifts:`, shiftsError)
      return new Response(JSON.stringify({ 
        success: false, 
        error: shiftsError.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!shifts || shifts.length === 0) {
      console.log(`[AutoClockOut ${requestId}] No active shifts found`)
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active shifts to process',
        clockedOut: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`[AutoClockOut ${requestId}] Found ${shifts.length} active shift(s)`)

    let clockedOutCount = 0
    const now = Date.now()

    for (const shift of shifts) {
      const start = new Date(shift.clock_in).getTime()
      // Use last_activity if available, otherwise default to clock_in
      const lastActivityTime = shift.last_activity ? new Date(shift.last_activity).getTime() : start

      const hoursWorked = (now - start) / (1000 * 60 * 60)
      const inactiveMinutes = (now - lastActivityTime) / (1000 * 60)

      console.log(`[AutoClockOut ${requestId}] Shift ${shift.id}:`, {
        officer_id: shift.officer_id,
        hoursWorked: hoursWorked.toFixed(2),
        inactiveMinutes: inactiveMinutes.toFixed(2)
      })

      // Auto clock-out conditions:
      // 1. Worked 6+ hours
      // 2. Inactive for 30+ minutes
      if (hoursWorked >= 6 || inactiveMinutes >= 30) {
        // Calculate earnings: 100 coins per hour (rounded down)
        const coinsEarned = Math.floor(hoursWorked * 100)

        // 1. Close the session
        const { error: updateError } = await supabase
          .from('officer_work_sessions')
          .update({
            clock_out: new Date().toISOString(),
            hours_worked: hoursWorked,
            coins_earned: coinsEarned,
            auto_clocked_out: true,
          })
          .eq('id', shift.id)

        if (updateError) {
          console.error(`[AutoClockOut ${requestId}] Error clocking out shift ${shift.id}:`, updateError)
          continue
        }

        console.log(`[AutoClockOut ${requestId}] ✅ Clocked out shift ${shift.id}:`, {
          hoursWorked: hoursWorked.toFixed(2),
          coinsEarned
        })

        // 2. Credit coins to officer's account using centralized RPC
        if (coinsEarned > 0) {
          const { error: creditError } = await supabase.rpc('troll_bank_credit_coins', {
            p_user_id: shift.officer_id,
            p_coins: coinsEarned,
            p_bucket: 'paid', // Salary counts as paid/earned
            p_source: 'officer_salary',
            p_ref_id: shift.id,
            p_metadata: {
              session_id: shift.id,
              hours: hoursWorked,
              auto_clocked_out: true
            }
          })

          if (creditError) {
             console.error(`[AutoClockOut ${requestId}] Error crediting coins for shift ${shift.id}:`, creditError)
             // Note: We don't rollback the clock-out, but we log the error.
             // In a perfect world, we'd use a transaction for both, but Edge Functions + REST makes that harder without a dedicated RPC.
             // Given the constraints, this is acceptable. The user is clocked out, but might miss coins. 
             // Admin can reconcile via logs if needed.
          } else {
             console.log(`[AutoClockOut ${requestId}] 💰 Credited ${coinsEarned} coins to officer ${shift.officer_id}`)
          }
        }

        clockedOutCount++
      }
    }

    console.log(`[AutoClockOut ${requestId}] ✅ Completed: ${clockedOutCount} shift(s) clocked out`)

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Auto clock-out finished',
      clockedOut: clockedOutCount,
      totalShifts: shifts.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error(`[AutoClockOut ${requestId}] ❌ Unhandled exception:`, error)
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Unknown error',
      requestId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
