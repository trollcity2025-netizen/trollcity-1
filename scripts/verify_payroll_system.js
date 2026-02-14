
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function verifyPayrollSystem() {
  console.log('🔍 Verifying Payroll & Cashout System...')

  try {
    // 1. Check Cashout Forecast RPC
    console.log('\nTesting get_cashout_forecast()...')
    const { data: forecast, error: forecastError } = await supabase.rpc('get_cashout_forecast', {
      projection_percent: 100
    })

    if (forecastError) {
      console.error('❌ get_cashout_forecast failed:', forecastError.message)
    } else {
      console.log('✅ Cashout Forecast Data:', JSON.stringify(forecast, null, 2))
    }

    // 2. Check Officer Pool Stats RPC
    console.log('\nTesting get_officer_pool_stats()...')
    const { data: poolStats, error: poolError } = await supabase.rpc('get_officer_pool_stats')

    if (poolError) {
      console.error('❌ get_officer_pool_stats failed:', poolError.message)
    } else {
      console.log('✅ Officer Pool Stats:', JSON.stringify(poolStats, null, 2))
    }

    // 3. Check Officer Distributions RPC
    console.log('\nTesting get_officer_distributions()...')
    const { data: distributions, error: distError } = await supabase.rpc('get_officer_distributions')

    if (distError) {
      console.error('❌ get_officer_distributions failed:', distError.message)
    } else {
      console.log('✅ Officer Distributions:', JSON.stringify(distributions, null, 2))
    }
    
    // 4. Check if User Earnings Summary view is accessible
    console.log('\nChecking user_earnings_summary view...')
    const { data: _summaryData, error: summaryError } = await supabase
      .from('user_earnings_summary')
      .select('count')
      .limit(1)
      .single()

    if (summaryError) {
       // It might be a view, count might not work directly if not cast, or just select * limit 1
       const { data: summaryData2, error: summaryError2 } = await supabase
        .from('user_earnings_summary')
        .select('user_id')
        .limit(1)
        
        if (summaryError2) {
            console.error('❌ user_earnings_summary access failed:', summaryError2.message)
        } else {
            console.log('✅ user_earnings_summary is accessible. Rows found:', summaryData2.length)
        }
    } else {
      console.log('✅ user_earnings_summary is accessible.')
    }

  } catch (err) {
    console.error('Unexpected error:', err)
  }
}

verifyPayrollSystem()
