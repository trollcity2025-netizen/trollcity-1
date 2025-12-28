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

    // Get all active shifts (where shift_end is null)
    const { data: shifts, error: shiftsError } = await supabase
      .from('officer_shift_logs')
      .select('*')
      .is('shift_end', null) // active shifts only

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
      const start = new Date(shift.shift_start).getTime()
      const lastActivity = new Date(shift.last_activity).getTime()

      const hoursWorked = (now - start) / (1000 * 60 * 60)
      const inactiveMinutes = (now - lastActivity) / (1000 * 60)

      console.log(`[AutoClockOut ${requestId}] Shift ${shift.id}:`, {
        officer_id: shift.officer_id,
        hoursWorked: hoursWorked.toFixed(2),
        inactiveMinutes: inactiveMinutes.toFixed(2)
      })

      // Auto clock-out conditions:
      // 1. Worked 6+ hours
      // 2. Inactive for 30+ minutes
      if (hoursWorked >= 6 || inactiveMinutes >= 30) {
        const coinsEarned = Math.floor(hoursWorked * 10000000) // 10 million free coins per hour

        const { error: updateError } = await supabase
          .from('officer_shift_logs')
          .update({
            shift_end: new Date().toISOString(),
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

        clockedOutCount++

        // Optionally: Credit coins to officer's account
        // This would require additional logic to update user_profiles.troll_coin_balance
        // Uncomment if you want automatic coin crediting:
        /*
        const { error: creditError } = await supabase
          .from('user_profiles')
          .update({
            paid_coin_balance: supabase.raw(`paid_coin_balance + ${coinsEarned}`)
          })
          .eq('id', shift.officer_id)

        if (creditError) {
          console.error(`[AutoClockOut ${requestId}] Error crediting coins:`, creditError)
        }
        */
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

