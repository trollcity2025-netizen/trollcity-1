// Process Referral Bonuses Edge Function
// Calculates and pays out 5% bonus to recruiters when referred users earn 40,000+ coins in a month
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { withCors, handleCorsPreflight } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const requestId = `ref_bonus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log(`[ReferralBonuses ${requestId}] Request received:`, {
    method: req.method,
    url: req.url,
  })

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight()
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      return withCors({ 
        success: false, 
        error: 'Missing Supabase configuration' 
      }, 500)
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Get current month in 'YYYY-MM' format
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    
    console.log(`[ReferralBonuses ${requestId}] Processing bonuses for month: ${currentMonth}`)
    
    // Get all active referrals where recruiter is an approved Empire Partner
    const { data: referrals, error: referralsError } = await supabase
      .from('referrals')
      .select(`
        recruiter_id,
        referred_user_id,
        recruiter:user_profiles!referrals_recruiter_id_fkey (
          is_empire_partner
        )
      `)
    
    if (referralsError) {
      console.error(`[ReferralBonuses ${requestId}] Error fetching referrals:`, referralsError)
      return withCors({ 
        success: false, 
        error: `Failed to fetch referrals: ${referralsError.message}` 
      }, 500)
    }
    
    if (!referrals || referrals.length === 0) {
      return withCors({ 
        success: true, 
        message: 'No referrals found',
        bonusesProcessed: 0,
        totalBonusPaid: 0,
        month: currentMonth
      })
    }
    
    console.log(`[ReferralBonuses ${requestId}] Found ${referrals.length} referrals to process`)
    
    const results = []
    let totalBonusPaid = 0
    let bonusesProcessed = 0
    
    // Process each referral
    for (const referral of referrals) {
      const { recruiter_id, referred_user_id } = referral
      
      // Verify recruiter is still an approved Empire Partner
      const recruiter = Array.isArray(referral.recruiter) ? referral.recruiter[0] : referral.recruiter
      if (!recruiter?.is_empire_partner) {
        console.log(`[ReferralBonuses ${requestId}] Skipping referral - recruiter ${recruiter_id} is not an Empire Partner`)
        continue
      }
      
      try {
        // Check if bonus already paid for this user/month
        const { data: existingBonus } = await supabase
          .from('referral_monthly_bonus')
          .select('id')
          .eq('referred_user_id', referred_user_id)
          .eq('month', currentMonth)
          .single()
        
        if (existingBonus) {
          console.log(`[ReferralBonuses ${requestId}] Bonus already paid for user ${referred_user_id} in ${currentMonth}`)
          continue
        }
        
        // Get total coins earned by referred user this month
        const { data: coinsData, error: coinsError } = await supabase
          .rpc('get_user_monthly_coins_earned', {
            p_user_id: referred_user_id,
            p_month: currentMonth
          })
        
        if (coinsError) {
          console.error(`[ReferralBonuses ${requestId}] Error getting coins for user ${referred_user_id}:`, coinsError)
          continue
        }
        
        const monthlyCoins = Number(coinsData) || 0
        
        console.log(`[ReferralBonuses ${requestId}] User ${referred_user_id} earned ${monthlyCoins} coins in ${currentMonth}`)
        
        // Check if eligible (>= 40,000 coins)
        if (monthlyCoins >= 40000) {
          const bonusAmount = Math.floor(monthlyCoins * 0.05) // 5% bonus
          
          // Get current recruiter balance
          const { data: recruiterProfile, error: balanceError } = await supabase
            .from('user_profiles')
            .select('paid_coin_balance')
            .eq('id', recruiter_id)
            .single()
          
          if (balanceError) {
            console.error(`[ReferralBonuses ${requestId}] Error getting recruiter balance:`, balanceError)
            continue
          }
          
          const currentBalance = recruiterProfile?.paid_coin_balance || 0
          const newBalance = currentBalance + bonusAmount
          
          // Update recruiter's troll_coin_balance
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({ paid_coin_balance: newBalance })
            .eq('id', recruiter_id)
          
          if (updateError) {
            console.error(`[ReferralBonuses ${requestId}] Error updating recruiter balance:`, updateError)
            continue
          }
          
          // Record the bonus payout
          const { error: bonusError } = await supabase
            .from('referral_monthly_bonus')
            .insert({
              recruiter_id,
              referred_user_id,
              month: currentMonth,
              coins_earned: monthlyCoins,
              bonus_paid_coins: bonusAmount
            })
          
          if (bonusError) {
            console.error(`[ReferralBonuses ${requestId}] Error recording bonus:`, bonusError)
            // Rollback balance update if possible
            await supabase
              .from('user_profiles')
              .update({ paid_coin_balance: currentBalance })
              .eq('id', recruiter_id)
            continue
          }
          
          totalBonusPaid += bonusAmount
          bonusesProcessed++
          
          results.push({
            recruiter_id,
            referred_user_id,
            monthlyCoins,
            bonusAmount,
            status: 'paid'
          })
          
          console.log(`[ReferralBonuses ${requestId}] ✅ Paid ${bonusAmount} coins to recruiter ${recruiter_id} for user ${referred_user_id}`)
        } else {
          results.push({
            recruiter_id,
            referred_user_id,
            monthlyCoins,
            bonusAmount: 0,
            status: 'not_eligible',
            reason: `User earned ${monthlyCoins} coins, need 40,000+`
          })
        }
      } catch (error: any) {
        console.error(`[ReferralBonuses ${requestId}] Error processing referral:`, error)
        results.push({
          recruiter_id,
          referred_user_id,
          status: 'error',
          error: error.message
        })
      }
    }
    
    return withCors({
      success: true,
      month: currentMonth,
      bonusesProcessed,
      totalBonusPaid,
      results,
      summary: {
        totalReferrals: referrals.length,
        bonusesPaid: bonusesProcessed,
        totalCoinsPaid: totalBonusPaid
      }
    })
  } catch (error: any) {
    console.error(`[ReferralBonuses ${requestId}] ❌ Unhandled exception:`, error)
    return withCors({ 
      success: false,
      error: error.message || 'Unknown error',
      requestId
    }, 500)
  }
})

